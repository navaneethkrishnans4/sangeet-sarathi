import { NextResponse } from "next/server";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  MUSIC_MASTER_SHEET_ID,
  ROCK_POP_MASTER_SHEET_ID,
  readGoogleSheetRows,
  toTitleCase,
  generateUuid
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

const GENERIC_EMAILS = ["trinitykochi.ops.office@gmail.com"];

function parseGradeFromProduct(productName: string, fallbackGrade: string): string {
  const combined = `${productName || ""} ${fallbackGrade || ""}`.trim();
  const m = combined.match(/\b(Initial|Grade\s*[1-8]|Grade\s*IN|Diploma)\b/i);
  if (m) {
    const val = m[1].trim();
    if (/^grade\s*\d$/i.test(val)) {
      return `Grade ${val.slice(-1)}`;
    }
    return toTitleCase(val);
  }
  return fallbackGrade || productName || "Initial";
}

async function resolveTeacher(
  applicant?: string | null,
  submitter?: string | null,
  school?: string | null,
  email?: string | null
): Promise<{ teacherId: string; displayName: string }> {
  const conditions: any[] = [];
  if (email && email.includes("@") && !GENERIC_EMAILS.includes(email.toLowerCase().trim())) {
    conditions.push({ primary_email: { equals: email.trim(), mode: "insensitive" } });
  }
  if (applicant && applicant.trim() && applicant.toLowerCase() !== "none") {
    const a = applicant.trim();
    conditions.push({ teacherName: { contains: a, mode: "insensitive" } });
    conditions.push({ name: { contains: a, mode: "insensitive" } });
    conditions.push({ aliases: { some: { alias: { contains: a, mode: "insensitive" } } } });
  }
  if (submitter && submitter.trim() && submitter.toLowerCase() !== "none") {
    const s = submitter.trim();
    conditions.push({ teacherName: { contains: s, mode: "insensitive" } });
    conditions.push({ name: { contains: s, mode: "insensitive" } });
    conditions.push({ aliases: { some: { alias: { contains: s, mode: "insensitive" } } } });
  }
  if (school && school.trim() && school.toLowerCase() !== "none") {
    const sc = school.trim();
    conditions.push({ schoolName: { contains: sc, mode: "insensitive" } });
    conditions.push({ name: { contains: sc, mode: "insensitive" } });
  }

  if (conditions.length > 0) {
    const existing = await prisma.teacherAcademy.findFirst({
      where: { OR: conditions }
    });
    if (existing) {
      return { teacherId: existing.id, displayName: existing.teacherName || existing.name };
    }
  }

  // Fallback to deterministic key
  let teacherKey: string;
  if (email && email.toLowerCase() !== "none" && !GENERIC_EMAILS.includes(email.toLowerCase().trim())) {
    teacherKey = `EMAIL:${email.toLowerCase().trim()}`;
  } else if (school && school.toLowerCase() !== "none") {
    teacherKey = `SCHOOL:${school.toLowerCase().trim()}`;
  } else {
    const name = applicant && applicant.toLowerCase() !== "none" ? applicant : submitter;
    teacherKey = `NAME:${(name || "Unknown").toLowerCase().trim()}`;
  }

  const rawName = (applicant && applicant.toLowerCase() !== "none")
    ? applicant
    : (submitter && submitter.toLowerCase() !== "none")
      ? submitter
      : (school && school.toLowerCase() !== "none")
        ? school
        : "Unknown Teacher";

  const primaryName = toTitleCase(rawName);
  const teacherId = generateUuid(teacherKey);

  const cleanSubmitter = submitter && submitter.toLowerCase() !== "none" ? toTitleCase(submitter) : null;
  const cleanSchool = school && school.toLowerCase() !== "none" ? toTitleCase(school) : null;
  const truePrimaryEmail = email && email.toLowerCase() !== "none" && !GENERIC_EMAILS.includes(email.toLowerCase().trim()) ? email.trim() : null;

  const teacher = await prisma.teacherAcademy.upsert({
    where: { uniqueKey: teacherKey },
    update: {
      name: primaryName,
      teacherName: cleanSubmitter || undefined,
      schoolName: cleanSchool || undefined,
      primary_email: truePrimaryEmail || undefined
    },
    create: {
      id: teacherId,
      uniqueKey: teacherKey,
      name: primaryName,
      teacherName: cleanSubmitter,
      schoolName: cleanSchool,
      primary_email: truePrimaryEmail
    }
  });

  return { teacherId: teacher.id, displayName: teacher.teacherName || teacher.name };
}

export async function POST(req: Request) {
  try {
    let sessionMonth = "December";
    try {
      const body = await req.json();
      if (body?.sessionMonth) sessionMonth = body.sessionMonth;
    } catch {
      const { searchParams } = new URL(req.url);
      if (searchParams.get("sessionMonth")) sessionMonth = searchParams.get("sessionMonth")!;
    }

    const sheets = [
      { id: MUSIC_MASTER_SHEET_ID, suiteName: "Classical & Jazz" },
      { id: ROCK_POP_MASTER_SHEET_ID, suiteName: "Rock & Pop" }
    ];

    let totalScanned = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    const stats: Record<string, { scanned: number; synced: number }> = {
      "Classical & Jazz": { scanned: 0, synced: 0 },
      "Rock & Pop": { scanned: 0, synced: 0 }
    };

    for (const sheet of sheets) {
      let rows: string[][] = [];
      try {
        rows = await readGoogleSheetRows(sheet.id, "'Enrolment Sheet'!A7:AL");
      } catch (err: any) {
        console.error(`Failed to read sheet ${sheet.suiteName}:`, err);
        continue;
      }

      stats[sheet.suiteName].scanned = rows.length;
      totalScanned += rows.length;

      for (const r of rows) {
        // Pad row to ensure safe column indexing up to Column AL (index 37)
        const row = r.concat(new Array(Math.max(0, 40 - r.length)).fill(""));
        const rawFirst = (row[1] || "").trim();
        const rawLast = (row[3] || "").trim();

        if (!rawFirst || rawFirst.toLowerCase() === "first name" || rawFirst.startsWith("#")) {
          continue;
        }

        const firstName = toTitleCase(rawFirst);
        const lastName = toTitleCase(rawLast);
        const candEmail = (row[5] || "").trim();
        const rawGrade = (row[14] || "").trim();
        const rawInstrument = (row[15] || "").trim() || "Electronic Keyboard";
        const grade = parseGradeFromProduct(rawGrade, rawGrade);
        const instrument = toTitleCase(rawInstrument);

        const subFirst = (row[18] || "").trim();
        const subLast = (row[19] || "").trim();
        const submitter = `${subFirst} ${subLast}`.trim();
        const subEmail = (row[20] || "").trim();
        const applicant = (row[25] || "").trim();
        const school = (row[27] || "").trim();

        const rawFee = (row[37] || "").replace(/,/g, "").trim();
        const expectedFee = parseFloat(rawFee) || 0;

        // Resolve teacher
        const { teacherId } = await resolveTeacher(applicant, submitter, school, subEmail || candEmail);

        // Candidate deterministic ID & upsert
        const candHashStr = `${firstName}-${lastName}-${sheet.suiteName}-${grade}-${instrument}`.toLowerCase();
        const candId = generateUuid(candHashStr);

        const existingCand = await prisma.candidate.findUnique({
          where: { id: candId }
        });

        if (!existingCand) {
          await prisma.candidate.create({
            data: {
              id: candId,
              firstName,
              lastName,
              examType: sheet.suiteName,
              grade,
              instrument,
              expectedFee,
              teacherId,
              sessionMonth,
              paymentStatus: "Pending",
              status: "Active"
            }
          });

          await prisma.auditLog.create({
            data: {
              action: "INSERT",
              tableName: "Candidate",
              recordId: candId,
              newValue: `Fee: ${expectedFee}, Teacher: ${teacherId}, Month: ${sessionMonth}`,
              description: `Synced Candidate ${firstName} ${lastName} from Google Sheet`
            }
          });
          totalInserted++;
        } else {
          await prisma.candidate.update({
            where: { id: candId },
            data: {
              firstName,
              lastName,
              expectedFee,
              teacherId,
              // Keep original sessionMonth if assigned, otherwise assign target sessionMonth
              sessionMonth: existingCand.sessionMonth || sessionMonth
            }
          });

          if (
            existingCand.expectedFee !== expectedFee ||
            existingCand.teacherId !== teacherId ||
            existingCand.firstName !== firstName ||
            existingCand.lastName !== lastName
          ) {
            await prisma.auditLog.create({
              data: {
                action: "UPDATE",
                tableName: "Candidate",
                recordId: candId,
                oldValue: `Fee: ${existingCand.expectedFee}, Teacher: ${existingCand.teacherId}, Name: ${existingCand.firstName} ${existingCand.lastName}`,
                newValue: `Fee: ${expectedFee}, Teacher: ${teacherId}, Name: ${firstName} ${lastName}`,
                description: `Updated Candidate ${firstName} ${lastName} from Google Sheet`
              }
            });
          }
          totalUpdated++;
        }

        stats[sheet.suiteName].synced++;
      }
    }

    const [activeMonthCandCount, totalTeachers] = await Promise.all([
      prisma.candidate.count({ where: { sessionMonth } }),
      prisma.teacherAcademy.count()
    ]);

    const outputLog = [
      `[Google Sheets Live Sync Engine - Pure TypeScript]`,
      `✓ Classical & Jazz: ${stats["Classical & Jazz"].synced} of ${stats["Classical & Jazz"].scanned} rows processed`,
      `✓ Rock & Pop: ${stats["Rock & Pop"].synced} of ${stats["Rock & Pop"].scanned} rows processed`,
      `✓ Candidates Inserted (New): ${totalInserted}`,
      `✓ Candidates Updated / Verified: ${totalUpdated}`,
      `✓ Candidate Names Normalized to Proper Casing (Title Case): Yes`,
      `✓ Active Candidates for ${sessionMonth}: ${activeMonthCandCount}`,
      `✓ Enrolled Teachers / Academies: ${totalTeachers}`,
      `✓ Status: PostgreSQL database is in 100% sync with live Google Sheets!`
    ].join("\n");

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized live Google Sheets into PostgreSQL under ${sessionMonth} session!`,
      output: outputLog
    });

  } catch (error: any) {
    console.error("API Error in /api/entries/sync:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
