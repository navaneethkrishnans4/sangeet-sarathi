import { NextResponse } from "next/server";
import crypto from "crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { appendCandidatesToGoogleSheet } from "@/lib/googleSheets";

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

function normalizeInstrument(inst: string): { instrument: string; examType: string } {
  const clean = (inst || "").toLowerCase().trim();
  if (clean.includes("ekb") || clean.includes("electronic keyboard") || clean.includes("keyboard")) {
    return { instrument: "Electronic Keyboard", examType: "Classical & Jazz" };
  }
  if (clean.includes("piano")) {
    return { instrument: "Piano", examType: "Classical & Jazz" };
  }
  if (clean.includes("classical guitar")) {
    return { instrument: "Classical Guitar", examType: "Classical & Jazz" };
  }
  if (clean.includes("acoustic guitar") || clean.includes("guitar")) {
    return { instrument: "Acoustic Guitar", examType: "Rock & Pop" };
  }
  if (clean.includes("drum")) {
    return { instrument: "Drum Kit", examType: "Rock & Pop" };
  }
  if (clean.includes("vocal") || clean.includes("sing")) {
    return { instrument: "Vocals", examType: "Rock & Pop" };
  }
  if (clean.includes("violin")) {
    return { instrument: "Violin", examType: "Classical & Jazz" };
  }
  return { instrument: inst ? inst.trim() : "Electronic Keyboard", examType: "Classical & Jazz" };
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = (fullName || "")
    .replace(/^\[.*?\]\s*/, "")
    .replace(/^.*?:/i, "")
    .replace(/^\d+[\.\)]\s*/, "")
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  return {
    firstName: parts.slice(0, parts.length - 1).join(" "),
    lastName: parts[parts.length - 1]
  };
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
  grade: string;
  instrument: string;
  email?: string | null;
}

interface ExtractedData {
  submitterName: string | null;
  academyName: string | null;
  candidates: ExtractedCandidate[];
}

async function extractWithGemini(rawText: string): Promise<ExtractedData | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const genAI = new GoogleGenerativeAI(apiKey);

  const prompt = `Extract Trinity examination candidate details and submitter information from the following text into a JSON object.
Standardize:
- grade: format as 'Grade 1', 'Grade 2', 'Initial', 'Grade 3', etc.
- instrument: 'Electronic Keyboard' for EKB/keyboard, 'Piano', 'Acoustic Guitar', 'Drum Kit', 'Violin', 'Classical Guitar', etc.
- firstName and lastName: split student full name properly. If single word or initials, split reasonably (e.g., 'THEJUS V' and 'NAIR').
- dob: DD/MM/YYYY.
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
      "grade": string,
      "instrument": string,
      "email": string | null
    }
  ]
}`;

  const modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });
      const res = await model.generateContent(prompt);
      const text = res.response.text();
      const parsed = JSON.parse(text);
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

  const submMatch = rawText.match(/submiter\s*name\s*[:\-]?\s*([A-Za-z\s]+?)(?:\s+convert|\s+please|,|\.|\n|$)/i) || 
                    rawText.match(/teacher\s*name\s*[:\-]?\s*([A-Za-z\s]+?)(?:\s+convert|\s+please|,|\.|\n|$)/i);
  if (submMatch) submitterName = submMatch[1].trim();

  const acadMatch = rawText.match(/academy\s*(?:name)?\s*[:\-]?\s*([A-Za-z\s]+?)(?:,|\.|\n|$)/i) ||
                    rawText.match(/from\s+([A-Za-z\s]+?(?:Pitch|Academy|School|Music|Institute))/i);
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

      if (/\b(?:grade|geade|initial|g[- ]?\d)\b/i.test(line)) {
        gradeStr = line;
        continue;
      }

      if (!candidateName && line.length > 2) {
        candidateName = line;
      }
    }

    if (candidateName && (gradeStr || dobStr)) {
      const { firstName, lastName } = splitName(candidateName);
      let rawGrade = "";
      let rawInst = "";

      const gMatch = gradeStr.match(/(?:grade|geade)\s*([a-zA-Z0-9]+)/i) || 
                     gradeStr.match(/\b(initial|in)\b/i) ||
                     gradeStr.match(/\b([1-8])\b/);
      if (gMatch) {
        rawGrade = gMatch[0];
        rawInst = gradeStr.replace(gMatch[0], "").trim();
      } else {
        rawGrade = "Grade 1";
        rawInst = gradeStr;
      }

      candidates.push({
        firstName,
        lastName,
        dob: dobStr,
        grade: rawGrade,
        instrument: rawInst,
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

  // If no match found, create a new teacher record
  const primaryName = submitterName?.trim() || academyName?.trim() || "Unknown Teacher";
  const uniqueKey = email?.trim() 
    ? `EMAIL:${email.trim().toLowerCase()}` 
    : `NAME:${primaryName.toLowerCase()}`;
  
  const newId = generateUuid(uniqueKey);
  const newTeacher = await prisma.teacherAcademy.upsert({
    where: { uniqueKey },
    update: {
      teacherName: submitterName?.trim() || undefined,
      schoolName: academyName?.trim() || undefined,
      primary_email: email?.trim() || undefined
    },
    create: {
      id: newId,
      uniqueKey,
      name: primaryName,
      teacherName: submitterName?.trim() || null,
      schoolName: academyName?.trim() || null,
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

    // 1. Extract candidates (Gemini with fallback to Regex)
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

    // 2. Resolve Teacher / Academy
    const { teacherId, displayName, primaryEmail, schoolName } = await resolveTeacher(
      extracted.submitterName,
      extracted.academyName
    );

    const resolvedSchool = schoolName || extracted.academyName || "";
    const resolvedEmail = primaryEmail || "trinitykochi.ops.office@gmail.com";

    // 3. Process & Upsert Candidates into PostgreSQL
    let totalFee = 0;
    const processedCandidates: any[] = [];

    for (const cand of extracted.candidates) {
      const normGrade = normalizeGrade(cand.grade);
      const { instrument, examType } = normalizeInstrument(cand.instrument);
      const fee = getFeeForGrade(normGrade);
      totalFee += fee;

      const candDeterministicId = generateUuid(
        `${cand.firstName}-${cand.lastName}-${examType}-${normGrade}-${instrument}`.toLowerCase().trim()
      );

      await prisma.candidate.upsert({
        where: { id: candDeterministicId },
        update: {
          firstName: cand.firstName.trim(),
          lastName: cand.lastName.trim(),
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
          firstName: cand.firstName.trim(),
          lastName: cand.lastName.trim(),
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
          description: `WhatsApp Entry: ${cand.firstName} ${cand.lastName} (${normGrade} ${instrument})`
        }
      }).catch(err => console.warn("AuditLog warning:", err));

      processedCandidates.push({
        id: candDeterministicId,
        firstName: cand.firstName.trim(),
        lastName: cand.lastName.trim(),
        name: `${cand.firstName} ${cand.lastName}`,
        dob: cand.dob || "01/01/2000",
        grade: normGrade,
        instrument,
        examType,
        fee,
        email: cand.email || resolvedEmail
      });
    }

    // 4. Synchronize with Trinity Master Google Sheet
    const sheetResult = await appendCandidatesToGoogleSheet({
      candidates: processedCandidates,
      submitterName: displayName,
      submitterEmail: resolvedEmail,
      schoolName: resolvedSchool
    });

    const candidateLines = processedCandidates.map(
      (c, idx) => `${idx + 1}. ${c.name} - ${c.grade} ${c.instrument} (${c.examType}) : ₹${c.fee.toLocaleString("en-IN")}`
    ).join("\n");

    const sheetOutput = sheetResult.success
      ? `✅ Successfully appended ${sheetResult.rowsAppended} candidate(s) to Trinity ${sheetResult.sheetType} Master Google Sheet!\n\n${candidateLines}`
      : `⚠️ Google Sheet status: ${sheetResult.error || "Sync pending"}\n\n${candidateLines}`;

    const dbOutput = `Teacher/Academy: ${displayName} [ID: ${teacherId}]\nSession Month: ${targetMonth}\nTotal Candidates: ${processedCandidates.length}\nTotal Expected Fees: ₹${totalFee.toLocaleString("en-IN")}\nDatabase: Successfully synchronized with PostgreSQL!`;

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${processedCandidates.length} candidate(s) into database and Google Sheet!`,
      sheetOutput,
      dbOutput,
      candidates: processedCandidates,
      totalFee,
      teacher: displayName,
      sheetStatus: sheetResult
    });

  } catch (error: any) {
    console.error("API Error in /api/entries/whatsapp:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
