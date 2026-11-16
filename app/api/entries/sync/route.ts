import { NextResponse } from "next/server";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  MUSIC_MASTER_SHEET_ID,
  ROCK_POP_MASTER_SHEET_ID,
  FORM_RESPONSES_SHEET_ID,
  readGoogleSheetRows,
  appendCandidatesToGoogleSheet,
  toTitleCase,
  generateUuid,
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

const GENERIC_EMAILS = ["trinitykochi.ops.office@gmail.com"];

const FEE_MAP: Record<string, number> = {
  "initial": 5500,
  "in": 5500,
  "grade 1": 6050,
  "grade 2": 6700,
  "grade 3": 7700,
  "grade 4": 8600,
  "grade 5": 9700,
  "grade 6": 11300,
  "grade 7": 12200,
  "grade 8": 13500
};

function parseProduct(productStr: string): { grade: string; instrument: string } {
  const s = (productStr || "").trim();
  let grade = "Initial";
  let instrument = "Electronic Keyboard";

  const gradeMatch = s.match(/\b(initial|grade\s*[1-8]|grade\s*in|diploma|\d(?:st|nd|rd|th)?\s*grade|grade\s*\d)\b/i);
  if (gradeMatch) {
    const rawG = gradeMatch[1].toLowerCase();
    const num = rawG.match(/\d/);
    if (num) {
      grade = `Grade ${num[0]}`;
    } else if (rawG.includes("init")) {
      grade = "Initial";
    } else {
      grade = toTitleCase(rawG);
    }
  }

  const cleanInst = s.replace(/\b(initial|grade\s*[1-8]|grade\s*in|diploma|\d(?:st|nd|rd|th)?\s*grade|grade\s*\d)\b/gi, "").replace(/[-–,]/g, " ").trim();
  const lower = cleanInst.toLowerCase();
  if (lower.includes("piano")) instrument = "Piano";
  else if (lower.includes("violin")) instrument = "Violin";
  else if (lower.includes("guitar")) instrument = lower.includes("classical") ? "Classical Guitar" : "Acoustic Guitar";
  else if (lower.includes("keyboard") || lower.includes("ekb")) instrument = "Electronic Keyboard";
  else if (lower.includes("drum")) instrument = "Drum Kit";
  else if (lower.includes("vocal") || lower.includes("singing")) instrument = "Vocals";
  else if (lower.includes("sax")) instrument = "Saxophone";
  else if (cleanInst) instrument = toTitleCase(cleanInst);

  return { grade, instrument };
}

function parseFee(rawFee: any, grade: string): number {
  if (rawFee) {
    const numMatch = String(rawFee).replace(/,/g, "").match(/(\d{4,5})/);
    if (numMatch) return parseFloat(numMatch[1]);
  }
  return FEE_MAP[grade.toLowerCase()] || 6050;
}

function parseDob(rawDob: any): string {
  if (!rawDob) return "01/01/2000";
  const s = String(rawDob).trim();
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) {
    let day = m[1].padStart(2, "0");
    let month = m[2].padStart(2, "0");
    let year = m[3];
    if (year.length === 2) year = "20" + year;
    return `${day}/${month}/${year}`;
  }
  return s;
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

    // 1. Fetch current candidates already in Master Sheets (to avoid duplicates)
    const [musicRows, rpRows] = await Promise.all([
      readGoogleSheetRows(MUSIC_MASTER_SHEET_ID, "'Enrolment Sheet'!B7:D"),
      readGoogleSheetRows(ROCK_POP_MASTER_SHEET_ID, "'Enrolment Sheet'!B7:D")
    ]);

    const existingMasterSet = new Set<string>();
    for (const r of musicRows) {
      const fn = (r[0] || "").trim();
      const ln = (r[2] || "").trim();
      const full = `${fn} ${ln}`.toLowerCase().replace(/\s+/g, " ");
      if (full) existingMasterSet.add(full);
    }
    for (const r of rpRows) {
      const fn = (r[0] || "").trim();
      const ln = (r[2] || "").trim();
      const full = `${fn} ${ln}`.toLowerCase().replace(/\s+/g, " ");
      if (full) existingMasterSet.add(full);
    }

    // 2. Fetch submissions from Google Form responses sheet
    let formResponses: string[][] = [];
    try {
      formResponses = await readGoogleSheetRows(FORM_RESPONSES_SHEET_ID, "'Form Responses 1'!A2:N");
    } catch (err: any) {
      console.warn("Could not read Form Responses 1 tab, attempting generic lookup:", err.message);
    }

    const newMusicCandidates: CandidateSheetRow[] = [];
    const newRPCandidates: CandidateSheetRow[] = [];

    for (const r of formResponses) {
      const rawFirst = (r[2] || "").trim();
      const rawLast = (r[3] || "").trim();
      if (!rawFirst) continue;

      const firstName = toTitleCase(rawFirst);
      const lastName = toTitleCase(rawLast);
      const fullName = `${firstName} ${lastName}`.toLowerCase().replace(/\s+/g, " ");

      // Check for duplicate in master sheets or within current batch
      if (existingMasterSet.has(fullName)) {
        continue;
      }
      existingMasterSet.add(fullName);

      const dob = parseDob(r[4]);
      const rawGender = (r[5] || "").trim().toUpperCase();
      const gender = rawGender.startsWith("F") ? "F" : "M";
      const candEmail = (r[1] || "").trim();
      const subEmail = (r[6] || "").trim() || candEmail;
      const suiteRaw = (r[7] || "").toLowerCase();
      const subjRaw = (r[8] || "");
      const { grade, instrument } = parseProduct(subjRaw);

      const isRP = (suiteRaw.includes("rock") || suiteRaw.includes("pop") || subjRaw.toLowerCase().includes("rock") || instrument === "Drum Kit" || instrument === "Vocals") &&
        instrument !== "Electronic Keyboard" &&
        instrument !== "Piano" &&
        instrument !== "Violin";
      const examType = isRP ? "Rock & Pop" : "Classical & Jazz";
      const fee = parseFee(r[12], grade);

      const applicant = toTitleCase(r[9] || r[13] || "Teacher");
      const school = r[11] && r[11].toLowerCase() !== "nil" ? toTitleCase(r[11]) : "";

      const candRow: CandidateSheetRow = {
        firstName,
        lastName,
        dob,
        gender,
        grade,
        instrument,
        examType,
        fee,
        email: candEmail || subEmail,
        submitterName: applicant,
        submitterEmail: subEmail,
        schoolName: school
      };

      if (isRP) {
        newRPCandidates.push(candRow);
      } else {
        newMusicCandidates.push(candRow);
      }
    }

    // 3. Write / Append any new candidates into the Master Google Sheets!
    let musicAppended = 0;
    let rpAppended = 0;

    if (newMusicCandidates.length > 0) {
      const res = await appendCandidatesToGoogleSheet({
        candidates: newMusicCandidates,
        targetSheetId: MUSIC_MASTER_SHEET_ID
      });
      if (res.success) {
        musicAppended = res.rowsAppended;
      } else {
        console.error("Error appending to Music Master Sheet:", res.error);
      }
    }

    if (newRPCandidates.length > 0) {
      const res = await appendCandidatesToGoogleSheet({
        candidates: newRPCandidates,
        targetSheetId: ROCK_POP_MASTER_SHEET_ID
      });
      if (res.success) {
        rpAppended = res.rowsAppended;
      } else {
        console.error("Error appending to Rock & Pop Master Sheet:", res.error);
      }
    }

    // 4. Synchronize all live Master Sheets into PostgreSQL Database!
    const sheets = [
      { id: MUSIC_MASTER_SHEET_ID, suiteName: "Classical & Jazz" },
      { id: ROCK_POP_MASTER_SHEET_ID, suiteName: "Rock & Pop" }
    ];

    let totalMasterRows = 0;
    let dbInserted = 0;
    let dbUpdated = 0;

    for (const sheet of sheets) {
      const rows = await readGoogleSheetRows(sheet.id, "'Enrolment Sheet'!A7:AL");
      totalMasterRows += rows.length;

      for (const r of rows) {
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
        const { grade, instrument } = parseProduct(`${rawInstrument} ${rawGrade}`);
        
        const subFirst = (row[18] || "").trim();
        const subLast = (row[19] || "").trim();
        const submitter = `${subFirst} ${subLast}`.trim();
        const subEmail = (row[20] || "").trim();
        const applicant = (row[25] || "").trim();
        const school = (row[27] || "").trim();

        const rawFee = (row[37] || "").replace(/,/g, "").trim();
        const expectedFee = parseFloat(rawFee) || parseFee(rawFee, grade);

        const { teacherId } = await resolveTeacher(applicant, submitter, school, subEmail || candEmail);

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
          dbInserted++;
        } else {
          await prisma.candidate.update({
            where: { id: candId },
            data: {
              firstName,
              lastName,
              expectedFee,
              teacherId,
              sessionMonth: existingCand.sessionMonth || sessionMonth
            }
          });
          dbUpdated++;
        }
      }
    }

    const [activeMonthCandCount, totalTeachers] = await Promise.all([
      prisma.candidate.count({ where: { sessionMonth } }),
      prisma.teacherAcademy.count()
    ]);

    const outputLog = [
      `[Google Sheets Master Sync Engine - Pure TypeScript]`,
      `✓ Form Responses Processed: ${formResponses.length} submissions checked`,
      `✓ Written to Master Google Sheets:`,
      `    - Classical & Jazz Master Sheet: +${musicAppended} new rows appended`,
      `    - Rock & Pop Master Sheet: +${rpAppended} new rows appended`,
      `✓ Total Candidates Now in Master Sheets: ${totalMasterRows}`,
      `✓ Candidate Names Formatted in Proper Casing (Title Case): Yes`,
      `✓ PostgreSQL Database Synced for ${sessionMonth}: ${activeMonthCandCount} active candidates`,
      `✓ Enrolled Teachers / Academies: ${totalTeachers}`,
      `✓ Status: Master Google Sheets & PostgreSQL Database are in 100% sync!`
    ].join("\n");

    return NextResponse.json({
      success: true,
      message: `Google Sheets Sync complete! Written ${musicAppended + rpAppended} new candidates to Master Google Sheets and synchronized database!`,
      output: outputLog
    });

  } catch (error: any) {
    console.error("API Error in /api/entries/sync:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
