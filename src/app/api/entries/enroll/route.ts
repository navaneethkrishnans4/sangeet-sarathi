import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  appendCandidatesToGoogleSheet,
  toTitleCase,
  MUSIC_MASTER_SHEET_ID,
  ROCK_POP_MASTER_SHEET_ID,
  CandidateSheetRow
} from "@/lib/googleSheets";

export const maxDuration = 120;

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FEE_MAP: Record<string, number> = {
  "initial": 5500,
  "in": 5500,
  "grade 1": 6050,
  "1": 6050,
  "grade 2": 6700,
  "2": 6700,
  "grade 3": 7700,
  "3": 7700,
  "grade 4": 8600,
  "4": 8600,
  "grade 5": 9700,
  "5": 9700,
  "grade 6": 11300,
  "6": 11300,
  "grade 7": 12200,
  "7": 12200,
  "grade 8": 13500,
  "8": 13500
};

function getFeeForGrade(grade: string): number {
  if (!grade) return 0;
  const clean = grade.toLowerCase().trim();
  if (FEE_MAP[clean]) return FEE_MAP[clean];
  const numMatch = clean.match(/\d+/);
  if (numMatch && FEE_MAP[numMatch[0]]) return FEE_MAP[numMatch[0]];
  if (clean.includes("init") || clean.includes("in")) return 5500;
  return 0;
}

function normalizeGrade(grade: string): string {
  if (!grade) return "Grade 1";
  const clean = grade.toLowerCase().trim();
  if (clean.includes("init") || clean === "in") return "Initial";

  const match = clean.match(/(?:grade|geade)?\s*([1-8])(?:st|nd|rd|th)?\b/i) ||
                clean.match(/\b([1-8])(?:st|nd|rd|th)?\s*(?:grade|geade)?\b/i);
  if (match) {
    return `Grade ${match[1]}`;
  }

  if (/\b(one|first)\b/i.test(clean)) return "Grade 1";
  if (/\b(two|second)\b/i.test(clean)) return "Grade 2";
  if (/\b(three|third)\b/i.test(clean)) return "Grade 3";
  if (/\b(four|fourth)\b/i.test(clean)) return "Grade 4";
  if (/\b(five|fifth)\b/i.test(clean)) return "Grade 5";
  if (/\b(six|sixth)\b/i.test(clean)) return "Grade 6";
  if (/\b(seven|seventh)\b/i.test(clean)) return "Grade 7";
  if (/\b(eight|eighth)\b/i.test(clean)) return "Grade 8";

  return grade.trim();
}

function generateUuid(name: string): string {
  const hash = crypto.createHash("sha1").update(name).digest("hex");
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "5" + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join("-");
}

async function resolveTeacher(
  teacherName?: string | null,
  schoolName?: string | null,
  email?: string | null
): Promise<{ teacherId: string; displayName: string }> {
  const conditions: any[] = [];
  if (email && email.includes("@")) {
    conditions.push({ primary_email: { equals: email.trim(), mode: "insensitive" } });
  }
  if (teacherName && teacherName.trim()) {
    const t = teacherName.trim();
    conditions.push({ teacherName: { contains: t, mode: "insensitive" } });
    conditions.push({ name: { contains: t, mode: "insensitive" } });
    conditions.push({ aliases: { some: { alias: { contains: t, mode: "insensitive" } } } });
  }
  if (schoolName && schoolName.trim()) {
    const s = schoolName.trim();
    conditions.push({ schoolName: { contains: s, mode: "insensitive" } });
    conditions.push({ name: { contains: s, mode: "insensitive" } });
  }

  if (conditions.length > 0) {
    const existing = await prisma.teacherAcademy.findFirst({
      where: { OR: conditions }
    });
    if (existing) {
      return { teacherId: existing.id, displayName: existing.teacherName || existing.name };
    }
  }

  const primaryName = toTitleCase(teacherName?.trim() || schoolName?.trim() || "Teacher");
  const uniqueKey = email?.trim() ? `EMAIL:${email.trim().toLowerCase()}` : `NAME:${primaryName.toLowerCase()}`;
  const newId = generateUuid(uniqueKey);

  const teacher = await prisma.teacherAcademy.upsert({
    where: { uniqueKey },
    update: {
      teacherName: teacherName?.trim() ? toTitleCase(teacherName.trim()) : undefined,
      schoolName: schoolName?.trim() ? toTitleCase(schoolName.trim()) : undefined,
      primary_email: email?.trim() || undefined
    },
    create: {
      id: newId,
      uniqueKey,
      name: primaryName,
      teacherName: teacherName?.trim() ? toTitleCase(teacherName.trim()) : null,
      schoolName: schoolName?.trim() ? toTitleCase(schoolName.trim()) : null,
      primary_email: email?.trim() || null
    }
  });

  return { teacherId: teacher.id, displayName: teacher.teacherName || teacher.name };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      submitterName,
      submitterMobile,
      submitterEmail,
      defaultSchoolName,
      defaultTeacherName,
      candidates,
      paymentScreenshotBase64,
      paymentScreenshotFileName,
      paymentRefNote,
      sessionMonth
    } = body;

    if (!submitterName || !submitterName.trim()) {
      return NextResponse.json({ success: false, error: "Submitter / Applicant name is required." }, { status: 400 });
    }

    if (!submitterMobile || !submitterMobile.trim()) {
      return NextResponse.json({ success: false, error: "Submitter mobile number is required." }, { status: 400 });
    }

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ success: false, error: "Please add at least one candidate." }, { status: 400 });
    }

    const targetMonth = sessionMonth || "December";
    const cleanSubName = toTitleCase(submitterName.trim());
    const cleanSubEmail = (submitterEmail || "").trim() || "trinitykochi.ops.office@gmail.com";
    const cleanSubMobile = (submitterMobile || "").trim();

    // 1. Process payment screenshot if provided
    let screenshotUrl: string | null = null;
    if (paymentScreenshotBase64 && typeof paymentScreenshotBase64 === "string") {
      try {
        const matches = paymentScreenshotBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const base64Data = matches ? matches[2] : paymentScreenshotBase64;
        const buffer = Buffer.from(base64Data, "base64");

        const uploadsDir = path.join(process.cwd(), "public", "uploads", "payments");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const ext = (paymentScreenshotFileName && path.extname(paymentScreenshotFileName)) || ".png";
        const safeBase = cleanSubName.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const fileName = `${Date.now()}_${safeBase}${ext}`;
        const filePath = path.join(uploadsDir, fileName);

        fs.writeFileSync(filePath, buffer);
        screenshotUrl = `/uploads/payments/${fileName}`;
      } catch (uploadErr) {
        console.warn("Screenshot save warning:", uploadErr);
      }
    }

    // 2. Process Candidates
    let totalFee = 0;
    const processedCandidates: Array<CandidateSheetRow & { id: string; suite: string; teacherId: string }> = [];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const rawFirst = (c.firstName || "").trim();
      const rawLast = (c.lastName || "").trim();

      if (!rawFirst) {
        return NextResponse.json({ success: false, error: `Candidate #${i + 1} first name is required.` }, { status: 400 });
      }

      const firstName = toTitleCase(rawFirst);
      const lastName = toTitleCase(rawLast);
      const dob = (c.dob || "").trim() || "01/01/2000";
      const gender = (c.gender || "M").trim().toUpperCase().startsWith("F") ? "F" : "M";

      const candTeacher = toTitleCase((c.teacherName || "").trim() || (defaultTeacherName || "").trim() || cleanSubName);
      const candSchool = toTitleCase((c.schoolName || "").trim() || (defaultSchoolName || "").trim() || "");

      const normGrade = normalizeGrade(c.grade || "Grade 1");
      const instrument = toTitleCase((c.instrument || "").trim() || "Electronic Keyboard");
      const fee = getFeeForGrade(normGrade);
      totalFee += fee;

      // Determine Exam Suite
      const requestedSuite = (c.examSuite || "").trim().toLowerCase();
      const instLower = instrument.toLowerCase();

      let isRP = (requestedSuite.includes("rock") || requestedSuite.includes("pop") || requestedSuite.includes("r&p")) &&
        !instLower.includes("keyboard") &&
        !instLower.includes("ekb") &&
        !instLower.includes("piano") &&
        !instLower.includes("violin");

      if (instLower.includes("drum") || instLower.includes("electric guitar") || instLower.includes("bass")) {
        isRP = true;
      }

      const examType = isRP ? "Rock & Pop" : "Classical & Jazz";

      const { teacherId } = await resolveTeacher(candTeacher, candSchool, cleanSubEmail);

      const candDeterministicId = generateUuid(
        `${firstName}-${lastName}-${examType}-${normGrade}-${instrument}`.toLowerCase().trim()
      );

      // Upsert into Database
      await prisma.candidate.upsert({
        where: { id: candDeterministicId },
        update: {
          firstName,
          lastName,
          examType,
          grade: normGrade,
          instrument,
          expectedFee: fee,
          teacherId,
          sessionMonth: targetMonth,
          updatedAt: new Date()
        },
        create: {
          id: candDeterministicId,
          firstName,
          lastName,
          examType,
          grade: normGrade,
          instrument,
          expectedFee: fee,
          paymentStatus: "Pending",
          status: "Active",
          teacherId,
          sessionMonth: targetMonth,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          action: "UPSERT",
          tableName: "Candidate",
          recordId: candDeterministicId,
          newValue: `Fee: ₹${fee}, Teacher: ${candTeacher} (${teacherId}), Month: ${targetMonth}, Submitter: ${cleanSubName} (${cleanSubMobile})`,
          description: `Custom Form Enrollment: ${firstName} ${lastName} (${normGrade} ${instrument}) | Screenshot: ${screenshotUrl || "Via WhatsApp"}`
        }
      }).catch(err => console.warn("AuditLog warning:", err));

      processedCandidates.push({
        id: candDeterministicId,
        firstName,
        lastName,
        dob,
        gender,
        grade: normGrade,
        instrument,
        examType,
        suite: examType,
        fee,
        email: cleanSubEmail,
        submitterName: cleanSubName,
        submitterEmail: cleanSubEmail,
        schoolName: candSchool,
        teacherId
      });
    }

    // 3. Write directly to Master Google Sheets with Yellow Highlight!
    const musicCands = processedCandidates.filter(c => c.examType !== "Rock & Pop");
    const rpCands = processedCandidates.filter(c => c.examType === "Rock & Pop");

    let musicAppended = 0;
    let rpAppended = 0;

    if (musicCands.length > 0) {
      const res = await appendCandidatesToGoogleSheet({
        candidates: musicCands,
        targetSheetId: MUSIC_MASTER_SHEET_ID,
        highlightYellow: true,
        submitterName: cleanSubName,
        submitterEmail: cleanSubEmail,
        schoolName: defaultSchoolName ? toTitleCase(defaultSchoolName) : ""
      });
      if (res.success) musicAppended = res.rowsAppended;
    }

    if (rpCands.length > 0) {
      const res = await appendCandidatesToGoogleSheet({
        candidates: rpCands,
        targetSheetId: ROCK_POP_MASTER_SHEET_ID,
        highlightYellow: true,
        submitterName: cleanSubName,
        submitterEmail: cleanSubEmail,
        schoolName: defaultSchoolName ? toTitleCase(defaultSchoolName) : ""
      });
      if (res.success) rpAppended = res.rowsAppended;
    }

    // 4. Construct WhatsApp Message URL for 6282920294
    const candListText = processedCandidates
      .map((c, i) => `${i + 1}. ${c.firstName} ${c.lastName} - ${c.grade} ${c.instrument} (${c.examType}) : ₹${c.fee}`)
      .join("\n");

    const waMessage = `Hello, I have submitted the Trinity Exam Enrollment Form on the website.
Submitter: ${cleanSubName}
Mobile: ${cleanSubMobile}
Total Candidates: ${processedCandidates.length}
Total Fee: ₹${totalFee.toLocaleString("en-IN")}
Payment Ref: ${paymentRefNote || "UPI Payment"}

Candidates:
${candListText}

I am attaching my payment screenshot below for verification.`;

    const whatsappUrl = `https://wa.me/916282920294?text=${encodeURIComponent(waMessage)}`;

    return NextResponse.json({
      success: true,
      message: `Successfully enrolled ${processedCandidates.length} candidate(s)!`,
      summary: {
        totalCandidates: processedCandidates.length,
        totalFee,
        musicAppended,
        rpAppended,
        screenshotUrl,
        whatsappUrl
      },
      candidates: processedCandidates.map(c => ({
        name: `${c.firstName} ${c.lastName}`,
        grade: c.grade,
        instrument: c.instrument,
        examType: c.examType,
        gender: c.gender,
        fee: c.fee
      }))
    });

  } catch (error: any) {
    console.error("API Error in /api/entries/enroll:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to process enrollment" }, { status: 500 });
  }
}

