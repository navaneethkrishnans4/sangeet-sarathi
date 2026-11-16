import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import crypto from "crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { 
  appendCandidatesToGoogleSheet, 
  toTitleCase,
  MUSIC_MASTER_SHEET_ID,
  ROCK_POP_MASTER_SHEET_ID
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
  if (clean === "initial" || clean === "in" || clean.includes("initial")) return "Initial";
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

function normalizeInstrument(inst: string, explicitSuite?: string): { instrument: string; examType: string } {
  const clean = (inst || "").toLowerCase().trim();
  const suiteLower = (explicitSuite || "").toLowerCase().trim();

  let examType = "Classical & Jazz";
  if (suiteLower.includes("rock") || suiteLower.includes("pop") || suiteLower.includes("r&p") || suiteLower.includes("rp")) {
    examType = "Rock & Pop";
  } else if (suiteLower.includes("classical") || suiteLower.includes("jazz")) {
    examType = "Classical & Jazz";
  } else if (clean.includes("drum") || (clean.includes("vocal") && clean.includes("rock")) || clean.includes("bass")) {
    examType = "Rock & Pop";
  }

  let instrument = "Electronic Keyboard";
  if (clean.includes("ekb") || clean.includes("electronic keyboard") || clean.includes("keyboard")) {
    instrument = "Electronic Keyboard";
  } else if (clean.includes("piano")) {
    instrument = "Piano";
  } else if (clean.includes("classical guitar")) {
    instrument = "Classical Guitar";
  } else if (clean.includes("acoustic guitar") || clean.includes("guitar")) {
    instrument = "Acoustic Guitar";
  } else if (clean.includes("drum")) {
    instrument = "Drum Kit";
  } else if (clean.includes("vocal") || clean.includes("sing")) {
    instrument = "Vocals";
  } else if (clean.includes("violin")) {
    instrument = "Violin";
  } else if (clean.includes("sax")) {
    instrument = "Saxophone";
  } else if (inst) {
    instrument = toTitleCase(inst.trim());
  }

  return { instrument, examType };
}

function parseProduct(prodName: string, fallbackSubj?: string): { grade: string; instrument: string } {
  let grade = "Grade 1";
  if (prodName) {
    const gMatch = prodName.match(/(?:grade|geade)\s*([a-zA-Z0-9]+)/i) || 
                   prodName.match(/\b(initial|in)\b/i) ||
                   prodName.match(/\b([1-8])\b/);
    if (gMatch) {
      const rawG = gMatch[1] || gMatch[0];
      if (rawG.toLowerCase() === "in" || rawG.toLowerCase() === "initial") grade = "Initial";
      else if (/^\d+$/.test(rawG)) grade = "Grade " + rawG;
      else grade = "Grade " + rawG;
    }
  }

  let instrument = fallbackSubj ? fallbackSubj.trim() : "";
  if (!instrument && prodName) {
    let clean = prodName
      .replace(/classical and jazz/gi, "")
      .replace(/rock and pop/gi, "")
      .replace(/technical/gi, "")
      .replace(/\(digital\)/gi, "")
      .replace(/grade\s*[a-zA-Z0-9]+/gi, "")
      .replace(/\binitial\b/gi, "")
      .replace(/\bin\b/gi, "")
      .trim();
    if (clean) instrument = clean;
  }
  if (!instrument) instrument = "Electronic Keyboard";

  return { grade, instrument };
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
  if (email && email.includes("@") && !GENERIC_EMAILS.includes(email.toLowerCase().trim())) {
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

  const primaryName = toTitleCase(teacherName?.trim() || schoolName?.trim() || "Excel Upload Teacher");
  const uniqueKey = (email && email.includes("@") && !GENERIC_EMAILS.includes(email.toLowerCase().trim()))
    ? `EMAIL:${email.toLowerCase().trim()}`
    : `NAME:${primaryName.toLowerCase()}`;
  
  const newId = generateUuid(uniqueKey);
  const newTeacher = await prisma.teacherAcademy.upsert({
    where: { uniqueKey },
    update: {
      teacherName: teacherName?.trim() ? toTitleCase(teacherName.trim()) : undefined,
      schoolName: schoolName?.trim() ? toTitleCase(schoolName.trim()) : undefined,
      primary_email: email && !GENERIC_EMAILS.includes(email.toLowerCase().trim()) ? email.trim() : undefined
    },
    create: {
      id: newId,
      uniqueKey,
      name: primaryName,
      teacherName: teacherName?.trim() ? toTitleCase(teacherName.trim()) : null,
      schoolName: schoolName?.trim() ? toTitleCase(schoolName.trim()) : null,
      primary_email: email && !GENERIC_EMAILS.includes(email.toLowerCase().trim()) ? email.trim() : null
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
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const sessionMonth = (formData.get("sessionMonth") as string) || "November";

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = xlsx.read(buffer, { type: "buffer", cellDates: true });

    const sheetName = wb.Sheets["Enrolment Sheet"] ? "Enrolment Sheet" : wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json({ success: false, error: "Workbook has no valid sheet" }, { status: 400 });
    }

    const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: "The uploaded file is empty" }, { status: 400 });
    }

    // 1. Detect Header Row & Columns
    let headerRowIdx = -1;
    let fnCol = -1;
    let lnCol = -1;
    let singleNameCol = -1;
    let dobCol = -1;
    let suiteCol = -1;
    let prodCol = -1;
    let gradeCol = -1;
    let subjCol = -1;
    let emailCol = -1;
    let schoolCol = -1;
    let teacherCol = -1;
    let submitterCol = -1;

    for (let r = 0; r < Math.min(rows.length, 15); r++) {
      const row = rows[r].map(c => String(c || "").trim().toLowerCase());
      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        if (fnCol === -1 && (val === "first name" || val.includes("first name"))) fnCol = c;
        else if (lnCol === -1 && (val.includes("last name") || val.includes("middle & last") || val.includes("middle and last") || val === "surname")) lnCol = c;
        else if (singleNameCol === -1 && (val === "name" || val === "candidate name" || val === "student name")) singleNameCol = c;

        if (dobCol === -1 && (val.includes("dob") || val.includes("birth") || val.includes("date of birth"))) dobCol = c;
        if (suiteCol === -1 && (val.includes("exam suite") || val.includes("suite"))) suiteCol = c;
        if (prodCol === -1 && (val.includes("product") || val.includes("examination"))) prodCol = c;
        if (gradeCol === -1 && (val === "grade" || val === "exam level")) gradeCol = c;
        if (subjCol === -1 && (val.includes("subject") || val.includes("instrument"))) subjCol = c;
        if (emailCol === -1 && (val.includes("submitter email") || val.includes("email id") || val === "email")) emailCol = c;
        if (schoolCol === -1 && (val.includes("school") || val.includes("academy") || val.includes("institute"))) schoolCol = c;
        if (teacherCol === -1 && (val.includes("teacher name") || val === "teacher")) teacherCol = c;
        if (submitterCol === -1 && (val.includes("applicant name") || val === "applicant" || val.includes("submitter name"))) submitterCol = c;
      }

      if ((fnCol !== -1 || singleNameCol !== -1) && (prodCol !== -1 || gradeCol !== -1 || subjCol !== -1)) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0;
      fnCol = 1;
      lnCol = 2;
      dobCol = 3;
      suiteCol = 6;
      subjCol = 8;
      gradeCol = 9;
      submitterCol = 10;
      teacherCol = 11;
      schoolCol = 12;
      emailCol = 5;
    }

    // Detect teacher from top rows or filename
    let detectedTeacherName = "";
    let detectedSchoolName = "";
    for (let r = 0; r < headerRowIdx; r++) {
      const line = rows[r].join(" ");
      if (/teacher|submitter/i.test(line)) {
        const m = line.match(/(?:teacher|submitter)\s*[:\-]?\s*([A-Za-z\s]+)/i);
        if (m) detectedTeacherName = m[1].trim();
      }
      if (/school|academy/i.test(line)) {
        const m = line.match(/(?:school|academy)\s*[:\-]?\s*([A-Za-z\s]+)/i);
        if (m) detectedSchoolName = m[1].trim();
      }
    }

    if (!detectedTeacherName && !detectedSchoolName) {
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "").replace(/[_\-]/g, " ");
      detectedTeacherName = cleanFileName;
    }

    let defaultTeacherInfo = await resolveTeacher(detectedTeacherName, detectedSchoolName);

    let totalFee = 0;
    const processedCandidates: any[] = [];

    // 2. Extract Candidates
    for (let r = headerRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      let rawFirstName = "";
      let rawLastName = "";

      if (fnCol !== -1 && row[fnCol]) {
        rawFirstName = String(row[fnCol]).trim();
        rawLastName = lnCol !== -1 && row[lnCol] ? String(row[lnCol]).trim() : "";
      } else if (singleNameCol !== -1 && row[singleNameCol]) {
        const raw = String(row[singleNameCol]).trim();
        const parts = raw.split(/\s+/).filter(Boolean);
        rawFirstName = parts.slice(0, parts.length - 1).join(" ") || parts[0];
        rawLastName = parts.length > 1 ? parts[parts.length - 1] : "";
      }

      // Skip non-student header/instruction rows
      if (
        !rawFirstName || 
        rawFirstName.toLowerCase() === "first name" || 
        rawFirstName.toLowerCase() === "leave blank" || 
        rawFirstName.toLowerCase().startsWith("order") || 
        rawFirstName.toLowerCase().includes("order no") ||
        rawFirstName.startsWith("#")
      ) {
        continue;
      }

      const prodVal = prodCol !== -1 ? String(row[prodCol] || "").trim() : "";
      const gradeVal = gradeCol !== -1 ? String(row[gradeCol] || "").trim() : "";
      const subjVal = subjCol !== -1 ? String(row[subjCol] || "").trim() : "";
      const suiteVal = suiteCol !== -1 ? String(row[suiteCol] || "").trim() : "";

      if (!prodVal && !gradeVal && !subjVal) continue;

      let extractedGrade = gradeVal;
      let extractedSubj = subjVal;
      if (prodVal) {
        const parsed = parseProduct(prodVal, subjVal);
        if (!extractedGrade) extractedGrade = parsed.grade;
        if (!extractedSubj) extractedSubj = parsed.instrument;
      }

      // Check row-level teacher or school
      const rowTeacher = (teacherCol !== -1 && row[teacherCol] ? String(row[teacherCol]).trim() : "") ||
                         (submitterCol !== -1 && row[submitterCol] ? String(row[submitterCol]).trim() : "");
      const rowSchool = schoolCol !== -1 && row[schoolCol] ? String(row[schoolCol]).trim() : "";
      const rowEmail = emailCol !== -1 && row[emailCol] ? String(row[emailCol]).trim() : "";

      let currentTeacher = defaultTeacherInfo;
      if (rowTeacher || rowSchool || rowEmail) {
        currentTeacher = await resolveTeacher(rowTeacher || detectedTeacherName, rowSchool || detectedSchoolName, rowEmail);
      }

      // DOB
      let dobStr = "01/01/2000";
      if (dobCol !== -1 && row[dobCol]) {
        const dVal = row[dobCol];
        if (dVal instanceof Date) {
          dobStr = `${String(dVal.getDate()).padStart(2, "0")}/${String(dVal.getMonth() + 1).padStart(2, "0")}/${dVal.getFullYear()}`;
        } else if (typeof dVal === "number") {
          const parsedDate = xlsx.SSF.parse_date_code(dVal);
          if (parsedDate) {
            dobStr = `${String(parsedDate.d).padStart(2, "0")}/${String(parsedDate.m).padStart(2, "0")}/${parsedDate.y}`;
          }
        } else if (typeof dVal === "string" && dVal.trim()) {
          const cleanDob = dVal.trim();
          const m = cleanDob.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
          if (m) {
            let day = m[1].padStart(2, "0");
            let month = m[2].padStart(2, "0");
            let year = m[3];
            if (year.length === 2) year = "20" + year;
            dobStr = `${day}/${month}/${year}`;
          } else {
            dobStr = cleanDob;
          }
        }
      }

      const normFirstName = toTitleCase(rawFirstName);
      const normLastName = toTitleCase(rawLastName);
      const normGrade = normalizeGrade(extractedGrade);
      const { instrument, examType } = normalizeInstrument(extractedSubj, suiteVal);
      const fee = getFeeForGrade(normGrade);
      totalFee += fee;

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
          teacherId: currentTeacher.teacherId,
          sessionMonth,
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
          teacherId: currentTeacher.teacherId,
          sessionMonth,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      await prisma.auditLog.create({
        data: {
          action: "UPSERT",
          tableName: "Candidate",
          recordId: candDeterministicId,
          newValue: `Fee: ${fee}, Teacher: ${currentTeacher.displayName} (${currentTeacher.teacherId}), Month: ${sessionMonth}`,
          description: `Excel Upload (${file.name}): ${normFirstName} ${normLastName} (${normGrade} ${instrument})`
        }
      }).catch(err => console.warn("AuditLog warning:", err));

      processedCandidates.push({
        id: candDeterministicId,
        firstName: normFirstName,
        lastName: normLastName,
        name: `${normFirstName} ${normLastName}`.trim(),
        dob: dobStr,
        grade: normGrade,
        instrument,
        examType,
        fee,
        email: rowEmail || currentTeacher.primaryEmail,
        submitterName: currentTeacher.displayName,
        submitterEmail: currentTeacher.primaryEmail || "trinitykochi.ops.office@gmail.com",
        schoolName: currentTeacher.schoolName || detectedSchoolName || ""
      });
    }

    if (processedCandidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No candidate records could be found in the uploaded Excel file. Please ensure rows contain candidate names, examination/grade, and subjects."
      }, { status: 400 });
    }

    // 3. Partition and Append to Correct Trinity Master Google Sheets
    const musicCands = processedCandidates.filter(c => c.examType !== "Rock & Pop");
    const rpCands = processedCandidates.filter(c => c.examType === "Rock & Pop");

    let musicAppended = 0;
    let rpAppended = 0;

    if (musicCands.length > 0) {
      const res = await appendCandidatesToGoogleSheet({
        candidates: musicCands,
        targetSheetId: MUSIC_MASTER_SHEET_ID,
        submitterName: defaultTeacherInfo.displayName,
        schoolName: defaultTeacherInfo.schoolName || detectedSchoolName || "",
        submitterEmail: defaultTeacherInfo.primaryEmail || "trinitykochi.ops.office@gmail.com"
      });
      if (res.success) musicAppended = res.rowsAppended;
    }

    if (rpCands.length > 0) {
      const res = await appendCandidatesToGoogleSheet({
        candidates: rpCands,
        targetSheetId: ROCK_POP_MASTER_SHEET_ID,
        submitterName: defaultTeacherInfo.displayName,
        schoolName: defaultTeacherInfo.schoolName || detectedSchoolName || "",
        submitterEmail: defaultTeacherInfo.primaryEmail || "trinitykochi.ops.office@gmail.com"
      });
      if (res.success) rpAppended = res.rowsAppended;
    }

    const candidateLines = processedCandidates.map(
      (c, idx) => `${idx + 1}. ${c.name} - ${c.grade} ${c.instrument} (${c.examType}) : ₹${c.fee.toLocaleString("en-IN")}`
    ).join("\n");

    const sheetOutput = `✅ Successfully appended ${musicAppended + rpAppended} candidate(s) to Master Google Sheet(s)!\n- Classical & Jazz: ${musicAppended} rows\n- Rock & Pop: ${rpAppended} rows\n\n${candidateLines}`;

    const dbOutput = `Teacher/Academy: ${defaultTeacherInfo.displayName} [ID: ${defaultTeacherInfo.teacherId}]\nSession Month: ${sessionMonth}\nTotal Candidates: ${processedCandidates.length}\nTotal Expected Fees: ₹${totalFee.toLocaleString("en-IN")}\nDatabase: Successfully recorded in PostgreSQL!`;

    return NextResponse.json({
      success: true,
      message: `Excel Roster (${file.name}) successfully processed ${processedCandidates.length} candidate(s) into database and Google Sheet!`,
      sheetOutput,
      dbOutput,
      candidates: processedCandidates,
      totalFee,
      teacher: defaultTeacherInfo.displayName,
      count: processedCandidates.length
    });

  } catch (error: any) {
    console.error("API Error in /api/entries/excel:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
