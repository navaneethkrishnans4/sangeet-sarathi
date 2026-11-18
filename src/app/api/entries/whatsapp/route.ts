import { NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { appendCandidatesToGoogleSheet, toTitleCase, MUSIC_MASTER_SHEET_ID, ROCK_POP_MASTER_SHEET_ID } from "@/lib/googleSheets";

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

  // Check for explicit Grade + Number or Ordinal: e.g. "Grade 2", "2nd Grade", "2nd", "Grade 2nd"
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

function normalizeInstrument(inst: string, fullContext?: string): { instrument: string; examType: string } {
  const clean = (inst || "").toLowerCase().trim();
  const context = (fullContext || "").toLowerCase();
  const isExplicitRP = context.includes("rock and pop") || context.includes("rock & pop") || context.includes("r&p") || context.includes("rp");

  if (clean.includes("ekb") || clean.includes("electronic keyboard") || clean.includes("keyboard")) {
    return { instrument: "Electronic Keyboard", examType: "Classical & Jazz" };
  }
  if (clean.includes("piano")) {
    return { instrument: "Piano", examType: "Classical & Jazz" };
  }
  if (clean.includes("classical guitar")) {
    return { instrument: "Classical Guitar", examType: "Classical & Jazz" };
  }
  if (clean.includes("electric guitar") || clean.includes("bass")) {
    return { instrument: clean.includes("bass") ? "Bass" : "Electric Guitar", examType: "Rock & Pop" };
  }
  if (clean.includes("acoustic guitar") || clean.includes("guitar")) {
    return { instrument: "Acoustic Guitar", examType: isExplicitRP ? "Rock & Pop" : "Classical & Jazz" };
  }
  if (clean.includes("drum kit") || clean.includes("drumkit")) {
    return { instrument: "Drum Kit", examType: "Classical & Jazz" };
  }
  if (clean.includes("drum")) {
    return { instrument: isExplicitRP ? "Drums" : "Drums", examType: "Rock & Pop" };
  }
  if (clean.includes("vocal") || clean.includes("sing")) {
    return { instrument: "Vocals", examType: "Rock & Pop" };
  }
  if (clean.includes("violin")) {
    return { instrument: "Violin", examType: "Classical & Jazz" };
  }
  return { instrument: inst ? inst.trim() : "Electronic Keyboard", examType: isExplicitRP ? "Rock & Pop" : "Classical & Jazz" };
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = (fullName || "")
    .replace(/^\[.*?\]\s*/, "")
    .replace(/^.*?:/i, "")
    .replace(/^\d+[\.\)]\s*/, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: "" };
  if (parts.length === 1) return { firstName: toTitleCase(parts[0]), lastName: "" };
  if (parts.length === 2) return { firstName: toTitleCase(parts[0]), lastName: toTitleCase(parts[1]) };
  return {
    firstName: toTitleCase(parts.slice(0, parts.length - 1).join(" ")),
    lastName: toTitleCase(parts[parts.length - 1])
  };
}

export function inferGender(firstName: string, lastName: string): string {
  const full = `${firstName} ${lastName}`.toLowerCase().trim();
  const f = (firstName || "").toLowerCase().trim();
  const femalePatterns = [
    /\b(mayukha|madhuchandrika|ankitha|amala|rachel|teresa|prajna|michelle|varunavisri|navami|elena|vanshika|anlin|anagha|shriya|karen|pauline|senolin|aleena|amelia|anjana|anya|gianna|johannah|samyuktha|shreya|siona|veda|kshitija|joanna|anna|eshana|freya|serah|jenolyn|sthuthi|meghna|adina|devavaiga|rishima|leya)\b/,
    /(devi|kumari|ammu|mary|mol|priya|lakshmi|ananya|diya|sneha|arya)$/
  ];
  if (femalePatterns.some(p => p.test(f) || p.test(full))) return "F";
  return "M";
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

interface ExtractedCandidate {
  firstName: string;
  lastName: string;
  dob?: string;
  gender?: string | null;
  grade: string;
  instrument: string;
  email?: string | null;
}

interface ExtractedData {
  submitterName: string | null;
  academyName: string | null;
  candidates: ExtractedCandidate[];
}

function parseGradeAndInstrument(rawStr: string): { grade: string; instrument: string } {
  const clean = (rawStr || "").trim();

  // 1. Ordinal followed by grade: "1st grade", "2nd grade", "3rd grade", "1st geade", "2 grade", "2nd"
  const ordGradeMatch = clean.match(/(\d+)(?:st|nd|rd|th)?\s*(?:grade|geade)/i);
  if (ordGradeMatch) {
    const num = ordGradeMatch[1];
    const inst = clean.replace(ordGradeMatch[0], "").replace(/[\.\,\:\-]+/g, " ").trim();
    return { grade: `Grade ${num}`, instrument: inst };
  }

  // 2. Grade followed by number or name: "grade 2", "grade 2nd", "grade initial", "grade one"
  const prefixGradeMatch = clean.match(/(?:grade|geade)\s*([a-zA-Z0-9]+)/i);
  if (prefixGradeMatch) {
    const val = prefixGradeMatch[1];
    const inst = clean.replace(prefixGradeMatch[0], "").replace(/[\.\,\:\-]+/g, " ").trim();
    const numMatch = val.match(/\d+/);
    return {
      grade: numMatch ? `Grade ${numMatch[0]}` : (val.toLowerCase().includes("init") ? "Initial" : val),
      instrument: inst
    };
  }

  // 3. Standalone ordinal: "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"
  const ordMatch = clean.match(/\b([1-8])(?:st|nd|rd|th)\b/i);
  if (ordMatch) {
    const num = ordMatch[1];
    const inst = clean.replace(ordMatch[0], "").replace(/[\.\,\:\-]+/g, " ").trim();
    return { grade: `Grade ${num}`, instrument: inst };
  }

  // 4. Initial
  const initMatch = clean.match(/\b(initial|init|in)\b/i);
  if (initMatch) {
    const inst = clean.replace(initMatch[0], "").replace(/[\.\,\:\-]+/g, " ").trim();
    return { grade: "Initial", instrument: inst };
  }

  // 5. Standalone digit 1-8
  const digitMatch = clean.match(/\b([1-8])\b/);
  if (digitMatch) {
    const num = digitMatch[1];
    const inst = clean.replace(digitMatch[0], "").replace(/[\.\,\:\-]+/g, " ").trim();
    return { grade: `Grade ${num}`, instrument: inst };
  }

  return { grade: "Grade 1", instrument: clean.replace(/[\.\,\:\-]+/g, " ").trim() };
}

async function extractWithGemini(rawText: string): Promise<ExtractedData | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `Extract Trinity examination candidate details and submitter information from the following text into a JSON object.
Standardize:
- grade: format as 'Grade 1', 'Grade 2', 'Initial', 'Grade 3', etc.
- instrument: 'Electronic Keyboard' for EKB/keyboard, 'Piano', 'Acoustic Guitar', 'Drum Kit', 'Violin', 'Classical Guitar', etc.
- firstName and lastName: split student full name properly and format with Proper Casing (e.g. 'Thejus V' and 'Nair', 'Parthiv' and 'Pradeep'). Single letter initials must stay uppercase (e.g. 'V', 'K', 'A', 'N').
- dob: DD/MM/YYYY.
- gender: 'M' or 'F' (infer accurately based on the candidate's Indian/Christian/English name; e.g. Mayukha -> F, Madhuchandrika -> F, Ankitha -> F, Amala -> F, Teresa -> F, Rachel -> F, Thejus -> M, Parthiv -> M, Aadhil -> M, Vidhun -> M, Reyansh -> M, Daniel -> M).
- submitterName: extracted submitter/teacher name.
- academyName: extracted academy/music school name.

Text:
${rawText}

Output JSON schema:
{
  "submitterName": string | null,
  "academyName": string | null,
  "candidates": [
    {
      "firstName": string,
      "lastName": string,
      "dob": string,
      "gender": "M" | "F",
      "grade": string,
      "instrument": string,
      "email": string | null
    }
  ]
}`;

  const modelsToTry = ["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-3.8-flash"];
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      let parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        if (parsed[0] && Array.isArray(parsed[0].candidates)) {
          parsed = parsed[0];
        } else if (parsed[0] && (parsed[0].firstName || parsed[0].name)) {
          parsed = { submitterName: null, academyName: null, candidates: parsed };
        }
      }
      if (parsed && Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.warn(`Gemini extraction with ${modelName} failed:`, e);
    }
  }
  return null;
}

function extractWithRegex(rawText: string): ExtractedData {
  let submitterName: string | null = null;
  let academyName: string | null = null;

  const submMatch = rawText.match(/(?:submiter|submitter|teacher)\s*(?:name)?\s*[:\-]?\s*([A-Za-z\s]+?)(?:\s+convert|\s+please|,|\.|\n|$)/i);
  if (submMatch) submitterName = submMatch[1].trim();

  const acadMatch = rawText.match(/(?:academy|school|institute)\s*(?:name)?\s*[:\-]?\s*([A-Za-z\s]+?)(?:,|\.|\n|$)/i) ||
                    rawText.match(/from\s+([A-Za-z\s]+?(?:Pitch|Academy|School|Music|Institute))/i) ||
                    rawText.match(/\b([A-Za-z\s]+?(?:School\s+of\s+Music|Music\s+School|Academy))\b/i);
  if (acadMatch) academyName = acadMatch[1].trim();

  const senderMatch = rawText.match(/\]\s*([^:\n]+):/);
  if (senderMatch && !submitterName) {
    submitterName = senderMatch[1].trim();
  }

  const candidates: ExtractedCandidate[] = [];
  const blocks = rawText.split(/(?=\[\d{1,2}:\d{2}\s*(?:am|pm).*?\]|\b\d+[\.\)]\s+)/i);

  for (const block of blocks) {
    const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let candidateName = "";
    let gradeStr = "";
    let dobStr = "";
    let emailStr: string | null = null;
    let genderStr: string | null = null;

    for (const rawLine of lines) {
      if (/they are from|submiter|submitter|academy name/i.test(rawLine)) continue;
      const line = rawLine.replace(/^\[.*?\]\s*[^:]*:\s*/, "").trim();

      const dobMatch = line.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/);
      if (dobMatch) {
        dobStr = dobMatch[0];
        continue;
      }

      const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        emailStr = emailMatch[0];
        continue;
      }

      if (/^(?:gender\s*:\s*)?(male|female|m|f)\b/i.test(line)) {
        const m = line.match(/\b(male|female|m|f)\b/i);
        if (m) genderStr = m[1].toUpperCase().startsWith("F") ? "F" : "M";
        continue;
      }

      if (/\b(?:grade|geade|initial|init|g[- ]?\d|\d(?:st|nd|rd|th)\s*(?:grade|geade)?)\b/i.test(line)) {
        gradeStr = line;
        continue;
      }

      if (/^teacher\s*:/i.test(line)) {
        if (!submitterName) {
          const t = line.replace(/^teacher\s*:\s*/i, "").trim();
          if (t) submitterName = t;
        }
        continue;
      }

      if (/school|academy|music/i.test(line) && !candidateName) {
        if (!academyName) {
          const a = line.replace(/[\.\,\:\-]+/g, " ").trim();
          if (a.length > 5) academyName = a;
        }
        continue;
      }

      if (!candidateName && line.length > 2 && !/school|academy|institute/i.test(line)) {
        candidateName = line;
      }
    }

    if (candidateName && (gradeStr || dobStr)) {
      const { firstName, lastName } = splitName(candidateName);
      const { grade, instrument } = parseGradeAndInstrument(gradeStr);

      candidates.push({
        firstName,
        lastName,
        dob: dobStr,
        gender: genderStr || inferGender(firstName, lastName),
        grade,
        instrument,
        email: emailStr
      });
    }
  }

  return { submitterName, academyName, candidates };
}

async function resolveTeacher(
  submitterName?: string | null,
  academyName?: string | null,
  email?: string | null
): Promise<{ teacherId: string; displayName: string; primaryEmail: string | null; schoolName: string | null }> {
  const conditions: any[] = [];
  if (email && email.includes("@")) {
    conditions.push({ primary_email: { equals: email.trim(), mode: "insensitive" } });
  }
  if (submitterName && submitterName.trim()) {
    const s = submitterName.trim();
    conditions.push({ teacherName: { contains: s, mode: "insensitive" } });
    conditions.push({ name: { contains: s, mode: "insensitive" } });
    conditions.push({ aliases: { some: { alias: { contains: s, mode: "insensitive" } } } });
  }
  if (academyName && academyName.trim()) {
    const a = academyName.trim();
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

  const primaryName = toTitleCase(submitterName?.trim() || academyName?.trim() || "Unknown Teacher");
  const uniqueKey = email?.trim() 
    ? `EMAIL:${email.trim().toLowerCase()}` 
    : `NAME:${primaryName.toLowerCase()}`;
  
  const newId = generateUuid(uniqueKey);
  const newTeacher = await prisma.teacherAcademy.upsert({
    where: { uniqueKey },
    update: {
      teacherName: submitterName?.trim() ? toTitleCase(submitterName.trim()) : undefined,
      schoolName: academyName?.trim() ? toTitleCase(academyName.trim()) : undefined,
      primary_email: email?.trim() || undefined
    },
    create: {
      id: newId,
      uniqueKey,
      name: primaryName,
      teacherName: submitterName?.trim() ? toTitleCase(submitterName.trim()) : null,
      schoolName: academyName?.trim() ? toTitleCase(academyName.trim()) : null,
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
    const { text, sessionMonth } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "Empty text provided" }, { status: 400 });
    }

    const targetMonth = sessionMonth || "November";

    let extracted = await extractWithGemini(text);
    if (!extracted || !extracted.candidates || extracted.candidates.length === 0) {
      extracted = extractWithRegex(text);
    }

    if (!extracted || !extracted.candidates || extracted.candidates.length === 0) {
      return NextResponse.json({
        success: false,
        error: "Could not extract any candidates from the text. Please verify formatting."
      }, { status: 400 });
    }

    const { teacherId, displayName, primaryEmail, schoolName } = await resolveTeacher(
      extracted.submitterName,
      extracted.academyName
    );

    const resolvedSchool = toTitleCase(schoolName || extracted.academyName || "");
    const resolvedEmail = primaryEmail || "trinitykochi.ops.office@gmail.com";

    let totalFee = 0;
    const processedCandidates: any[] = [];

    for (const cand of extracted.candidates) {
      const normFirstName = toTitleCase(cand.firstName);
      const normLastName = toTitleCase(cand.lastName);
      const normGrade = normalizeGrade(cand.grade);
      const { instrument, examType } = normalizeInstrument(cand.instrument, text);
      const rawGender = (cand.gender || inferGender(normFirstName, normLastName)).trim().toUpperCase();
      const gender = rawGender.startsWith("F") ? "F" : "M";
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
          teacherId,
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
          newValue: `Fee: ${fee}, Teacher: ${displayName} (${teacherId}), Month: ${targetMonth}`,
          description: `WhatsApp Entry: ${normFirstName} ${normLastName} (${normGrade} ${instrument})`
        }
      }).catch(err => console.warn("AuditLog warning:", err));

      processedCandidates.push({
        id: candDeterministicId,
        firstName: normFirstName,
        lastName: normLastName,
        name: `${normFirstName} ${normLastName}`,
        dob: cand.dob || "01/01/2000",
        gender,
        grade: normGrade,
        instrument,
        examType,
        fee,
        email: cand.email || resolvedEmail
      });
    }

    // Partition candidates by exam suite and append to respective Google Sheets
    const musicCands = processedCandidates.filter(c => c.examType !== "Rock & Pop");
    const rpCands = processedCandidates.filter(c => c.examType === "Rock & Pop");

    let musicAppended = 0;
    let rpAppended = 0;

    if (musicCands.length > 0) {
      const res = await appendCandidatesToGoogleSheet({
        candidates: musicCands,
        targetSheetId: MUSIC_MASTER_SHEET_ID,
        submitterName: displayName,
        submitterEmail: resolvedEmail,
        schoolName: resolvedSchool
      });
      if (res.success) musicAppended = res.rowsAppended;
    }

    if (rpCands.length > 0) {
      const res = await appendCandidatesToGoogleSheet({
        candidates: rpCands,
        targetSheetId: ROCK_POP_MASTER_SHEET_ID,
        submitterName: displayName,
        submitterEmail: resolvedEmail,
        schoolName: resolvedSchool
      });
      if (res.success) rpAppended = res.rowsAppended;
    }

    const candidateLines = processedCandidates.map(
      (c, idx) => `${idx + 1}. ${c.name} - ${c.grade} ${c.instrument} (${c.examType}) : ₹${c.fee.toLocaleString("en-IN")}`
    ).join("\n");

    const totalAppended = musicAppended + rpAppended;
    const sheetOutput = totalAppended > 0
      ? `✅ Successfully appended ${totalAppended} candidate(s) to Master Google Sheet(s)!\n- Classical & Jazz: ${musicAppended} rows\n- Rock & Pop: ${rpAppended} rows\n\n${candidateLines}`
      : `⚠️ Google Sheet status: Sync completed (${candidateLines})`;

    const dbOutput = `Teacher/Academy: ${displayName} [ID: ${teacherId}]\nSession Month: ${targetMonth}\nTotal Candidates: ${processedCandidates.length}\nTotal Expected Fees: ₹${totalFee.toLocaleString("en-IN")}\nDatabase: Successfully synchronized with PostgreSQL!`;

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedCandidates.length} candidate(s) into database and Google Sheet!`,
      sheetOutput,
      dbOutput,
      candidates: processedCandidates,
      totalFee,
      teacher: displayName,
      sheetStatus: {
        success: totalAppended > 0,
        rowsAppended: totalAppended,
        musicAppended,
        rpAppended
      }
    });

  } catch (error: any) {
    console.error("API Error in /api/entries/whatsapp:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
