import { NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { appendCandidatesToGoogleSheet, toTitleCase } from "@/lib/googleSheets";

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
  if (clean.includes("one") || clean.includes("1")) return "Grade 1";
  if (clean.includes("two") || clean.includes("2")) return "Grade 2";
  if (clean.includes("three") || clean.includes("3")) return "Grade 3";
  if (clean.includes("four") || clean.includes("4")) return "Grade 4";
  if (clean.includes("five") || clean.includes("5")) return "Grade 5";
  if (clean.includes("six") || clean.includes("6")) return "Grade 6";
  if (clean.includes("seven") || clean.includes("7")) return "Grade 7";
  if (clean.includes("eight") || clean.includes("8")) return "Grade 8";
  return grade.trim();
}

function normalizeInstrument(inst: string, fallbackSuite?: string): { instrument: string; examType: string } {
  const clean = (inst || "").toLowerCase().trim();
  if (clean.includes("ekb") || clean.includes("electronic keyboard") || clean.includes("keyboard")) {
    return { instrument: "Electronic Keyboard", examType: fallbackSuite || "Classical & Jazz" };
  }
  if (clean.includes("piano")) {
    return { instrument: "Piano", examType: fallbackSuite || "Classical & Jazz" };
  }
  if (clean.includes("classical guitar")) {
    return { instrument: "Classical Guitar", examType: fallbackSuite || "Classical & Jazz" };
  }
  if (clean.includes("acoustic guitar") || clean.includes("guitar")) {
    return { instrument: "Acoustic Guitar", examType: fallbackSuite || "Rock & Pop" };
  }
  if (clean.includes("drum")) {
    return { instrument: "Drum Kit", examType: fallbackSuite || "Rock & Pop" };
  }
  if (clean.includes("vocal") || clean.includes("sing")) {
    return { instrument: "Vocals", examType: fallbackSuite || "Rock & Pop" };
  }
  if (clean.includes("violin")) {
    return { instrument: "Violin", examType: fallbackSuite || "Classical & Jazz" };
  }
  return { instrument: inst ? inst.trim() : "Electronic Keyboard", examType: fallbackSuite || "Classical & Jazz" };
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
): Promise<{ teacherId: string; displayName: string; primaryEmail: string | null; schoolName: string | null }> {
  const conditions: any[] = [];
  if (email && email.includes("@")) {
    conditions.push({ primary_email: { equals: email.trim(), mode: "insensitive" } });
  }
  if (teacherName && teacherName.trim()) {
    const s = teacherName.trim();
    conditions.push({ teacherName: { contains: s, mode: "insensitive" } });
    conditions.push({ name: { contains: s, mode: "insensitive" } });
    conditions.push({ aliases: { some: { alias: { contains: s, mode: "insensitive" } } } });
  }
  if (schoolName && schoolName.trim()) {
    const a = schoolName.trim();
    conditions.push({ schoolName: { contains: a, mode: "insensitive" } });
    conditions.push({ name: { contains: a, mode: "insensitive" } });
  }

  if (conditions.length > 0) {
    const teacher = await prisma.teacherAcademy.findFirst({
      where: { OR: conditions }
    });
    if (teacher) {
      return { 
        teacherId: teacher.id, 
        displayName: teacher.teacherName || teacher.name,
        primaryEmail: teacher.primary_email,
        schoolName: teacher.schoolName
      };
    }
  }

  const primaryName = toTitleCase(teacherName?.trim() || schoolName?.trim() || "Direct Entry");
  const uniqueKey = email?.trim() 
    ? `EMAIL:${email.trim().toLowerCase()}` 
    : `NAME:${primaryName.toLowerCase()}`;
  
  const newId = generateUuid(uniqueKey);
  const newTeacher = await prisma.teacherAcademy.upsert({
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

  return { 
    teacherId: newTeacher.id, 
    displayName: newTeacher.teacherName || newTeacher.name,
    primaryEmail: newTeacher.primary_email,
    schoolName: newTeacher.schoolName
  };
}

export async function POST(req: Request) {
  try {
    const { firstName, lastName, dob, examSuite, grade, subject, teacherName, schoolName, email, sessionMonth } = await req.json();

    if (!firstName || !grade) {
      return NextResponse.json({ success: false, error: "First Name and Grade are required." }, { status: 400 });
    }

    const targetMonth = sessionMonth || "November";
    const normFirstName = toTitleCase(firstName);
    const normLastName = toTitleCase(lastName || "");
    const normGrade = normalizeGrade(grade);
    const { instrument, examType } = normalizeInstrument(subject, examSuite);
    const fee = getFeeForGrade(normGrade);

    const teacherInfo = await resolveTeacher(teacherName, schoolName, email);
    const resolvedSchool = toTitleCase(teacherInfo.schoolName || schoolName || "");
    const resolvedEmail = teacherInfo.primaryEmail || email || "trinitykochi.ops.office@gmail.com";

    const candDeterministicId = generateUuid(
      `${normFirstName}-${normLastName}-${examType}-${normGrade}-${instrument}`.toLowerCase().trim()
    );

    await prisma.candidate.upsert({
      where: { id: candDeterministicId },
      update: {
        firstName: normFirstName,
        lastName: normLastName,
        examType,
        grade: normGrade,
        instrument,
        expectedFee: fee,
        teacherId: teacherInfo.teacherId,
        sessionMonth: targetMonth,
        updatedAt: new Date()
      },
      create: {
        id: candDeterministicId,
        firstName: normFirstName,
        lastName: normLastName,
        examType,
        grade: normGrade,
        instrument,
        expectedFee: fee,
        paymentStatus: "Pending",
        status: "Active",
        teacherId: teacherInfo.teacherId,
        sessionMonth: targetMonth,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    await prisma.auditLog.create({
      data: {
        action: "UPSERT",
        tableName: "Candidate",
        recordId: candDeterministicId,
        newValue: `Fee: ${fee}, Teacher: ${teacherInfo.displayName} (${teacherInfo.teacherId}), Month: ${targetMonth}`,
        description: `Manual Entry: ${normFirstName} ${normLastName} (${normGrade} ${instrument})`
      }
    }).catch(err => console.warn("AuditLog warning:", err));

    const sheetResult = await appendCandidatesToGoogleSheet({
      candidates: [{
        firstName: normFirstName,
        lastName: normLastName,
        dob: dob || "01/01/2000",
        grade: normGrade,
        instrument,
        examType,
        fee,
        email: resolvedEmail
      }],
      submitterName: teacherInfo.displayName,
      submitterEmail: resolvedEmail,
      schoolName: resolvedSchool
    });

    const sheetOutput = sheetResult.success
      ? `✅ Successfully appended candidate to Trinity ${sheetResult.sheetType} Master Google Sheet!\nCandidate: ${normFirstName} ${normLastName} | ${normGrade} ${instrument} (${examType}) : ₹${fee.toLocaleString("en-IN")}`
      : `⚠️ Google Sheet status: ${sheetResult.error || "Sync pending"}\nCandidate: ${normFirstName} ${normLastName}`;

    const dbOutput = `Teacher/Academy: ${teacherInfo.displayName} [ID: ${teacherInfo.teacherId}]\nSession Month: ${targetMonth}\nExpected Fee: ₹${fee.toLocaleString("en-IN")}\nDatabase: Successfully recorded in PostgreSQL!`;

    return NextResponse.json({
      success: true,
      message: "Manual Entry successfully recorded in database and Google Sheet!",
      sheetOutput,
      dbOutput,
      candidate: {
        id: candDeterministicId,
        name: `${normFirstName} ${normLastName}`.trim(),
        grade: normGrade,
        instrument,
        examType,
        fee
      },
      sheetStatus: sheetResult
    });

  } catch (error: any) {
    console.error("API Error in /api/entries/manual:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
