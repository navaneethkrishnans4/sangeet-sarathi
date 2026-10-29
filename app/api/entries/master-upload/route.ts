import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import crypto from "crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export const maxDuration = 120; // Allow sufficient execution window

const GENERIC_EMAILS = ["trinitykochi.ops.office@gmail.com"];

const KNOWN_ORDER_MAP: Record<string, { month: string; suite: string; mode: string }> = {
  "1-16343716094": { month: "June", suite: "Classical & Jazz", mode: "Digital" },
  "1-16381507605": { month: "June", suite: "Classical & Jazz", mode: "Digital" },
  "1-16343961733": { month: "June", suite: "Rock & Pop", mode: "Digital" },
  "1-17345815801": { month: "May", suite: "Classical & Jazz", mode: "Digital" },
  "1-17521069159": { month: "June", suite: "Classical & Jazz", mode: "Digital" },
  "1-17588720391": { month: "June", suite: "Classical & Jazz", mode: "Digital" },
  "1-17588976451": { month: "June", suite: "Rock & Pop", mode: "Digital" },
  "1-17602079711": { month: "June", suite: "Classical & Jazz", mode: "Digital" },
  "1-18495692371": { month: "July", suite: "Classical & Jazz", mode: "Digital" },
  "1-18495692380": { month: "July", suite: "Classical & Jazz", mode: "Digital" },
  "1-18495692388": { month: "August", suite: "Rock & Pop", mode: "Digital" },
  "1-18669269617": { month: "August", suite: "Classical & Jazz", mode: "Digital" },
  "1-18851102591": { month: "October", suite: "Classical & Jazz", mode: "Digital" },
  "1-18851102603": { month: "October", suite: "Rock & Pop", mode: "Digital" },
  "1-19036924829": { month: "October", suite: "Classical & Jazz", mode: "Digital" },
  "1-19036924837": { month: "October", suite: "Rock & Pop", mode: "Digital" },
  "1-19047594947": { month: "October", suite: "Classical & Jazz", mode: "Digital" },
  "1-19036924639": { month: "November", suite: "Classical & Jazz", mode: "Default" },
  "1-19471072401": { month: "November", suite: "Classical & Jazz", mode: "Digital" },
  "1-19471072423": { month: "November", suite: "Rock & Pop", mode: "Digital" },
  "1-19680778741": { month: "November", suite: "Classical & Jazz", mode: "Digital" },
  "1-19680778750": { month: "November", suite: "Rock & Pop", mode: "Digital" },
};

const MONTH_NAMES: Record<string, string> = {
  jan: "January", january: "January",
  feb: "February", february: "February",
  mar: "March", march: "March",
  apr: "April", april: "April",
  may: "May",
  jun: "June", june: "June",
  jul: "July", july: "July",
  aug: "August", august: "August",
  sep: "September", september: "September",
  oct: "October", october: "October",
  nov: "November", november: "November",
  dec: "December", december: "December"
};

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

function detectMonthAroundRow(rows: any[][], rowIndex: number, fallback: string): string {
  const start = Math.max(0, rowIndex - 2);
  const end = Math.min(rows.length, rowIndex + 3);
  for (let r = start; r < end; r++) {
    for (let c = 0; c < (rows[r]?.length || 0); c++) {
      const val = rows[r][c];
      if (val instanceof Date) {
        return val.toLocaleString("en-US", { month: "long" });
      }
      if (typeof val === "string") {
        const str = val.trim().toLowerCase();
        for (const [key, fullMonth] of Object.entries(MONTH_NAMES)) {
          const regex = new RegExp(`\\b${key}\\b`, "i");
          if (regex.test(str)) {
            return fullMonth;
          }
        }
      }
    }
  }
  return fallback;
}

function getTeacherKeyAndName(applicant: string, submitter: string, school: string, subEmail: string, candEmail: string) {
  if (subEmail && subEmail.toLowerCase() !== "none" && !GENERIC_EMAILS.includes(subEmail.toLowerCase())) {
    return { key: `EMAIL:${subEmail.toLowerCase()}`, name: subEmail.toLowerCase() };
  } else if (candEmail && candEmail.toLowerCase() !== "none" && !GENERIC_EMAILS.includes(candEmail.toLowerCase())) {
    return { key: `EMAIL:${candEmail.toLowerCase()}`, name: candEmail.toLowerCase() };
  } else if (school && school.toLowerCase() !== "none") {
    return { key: `SCHOOL:${school.toLowerCase()}`, name: school };
  } else {
    let name = (applicant && applicant.toLowerCase() !== "none") ? applicant : submitter;
    if (!name || name.toLowerCase() === "none") name = "Unknown";
    return { key: `NAME:${name.toLowerCase()}`, name };
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    let suite = (formData.get("suite") as string | null) || "auto";
    const defaultMonth = (formData.get("sessionMonth") as string | null) || "November";
    const dryRun = formData.get("dryRun") === "true";

    if (!file) {
      return NextResponse.json({ success: false, error: "No Excel file uploaded" }, { status: 400 });
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return NextResponse.json({
        success: false,
        error: "DATABASE_URL environment variable is missing on this server. Please configure it in your environment settings."
      }, { status: 500 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel workbook natively
    const wb = xlsx.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = wb.Sheets["Enrolment Sheet"] ? "Enrolment Sheet" : wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      return NextResponse.json({ success: false, error: "No valid sheet found in workbook" }, { status: 400 });
    }

    const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!rows || rows.length === 0) {
      return NextResponse.json({ success: false, error: "The uploaded spreadsheet is empty." }, { status: 400 });
    }

    // Auto-detect exam suite
    if (suite === "auto" || !suite) {
      const headerPeek = rows.slice(0, 10).map(r => r.join(" ")).join(" ").toLowerCase();
      if (headerPeek.includes("rock and pop") || file.name.toLowerCase().includes("rock")) {
        suite = "Rock & Pop";
      } else {
        suite = "Classical & Jazz";
      }
    }

    // 1. Identify all order sections
    interface Section {
      rowIndex: number;
      orderNumber: string;
      month: string;
    }
    const sections: Section[] = [];

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const rowStr = row.map(c => String(c || "")).join(" ");
      if (rowStr.toLowerCase().includes("order") && rowStr.includes("1-")) {
        const m = rowStr.match(/1-\d{10,12}/);
        if (m) {
          const ord = m[0];
          const month = KNOWN_ORDER_MAP[ord]?.month || detectMonthAroundRow(rows, r, defaultMonth);
          sections.push({ rowIndex: r, orderNumber: ord, month });
        }
      }
    }

    if (sections.length === 0) {
      sections.push({ rowIndex: 0, orderNumber: "UNKNOWN-ORDER", month: defaultMonth });
    }

    // Initialize Prisma Client
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    let totalRowsChecked = 0;
    let newCandidatesEnrolled = 0;
    let existingUpdated = 0;
    let totalFeeAmount = 0;
    const ordersDetected = new Set<string>();

    try {
      for (let i = 0; i < sections.length; i++) {
        const currentSection = sections[i];
        const nextSection = sections[i + 1];
        const startRow = currentSection.rowIndex + 1;
        const endRow = nextSection ? nextSection.rowIndex : rows.length;
        const orderNumber = currentSection.orderNumber;
        const sectionMonth = currentSection.month;

        ordersDetected.add(orderNumber);

        // Resolve or create OrderNumber in DB
        let orderDbId: string | null = null;
        if (!dryRun) {
          let existingOrder = await prisma.orderNumber.findUnique({
            where: { orderNumber }
          });
          if (!existingOrder) {
            existingOrder = await prisma.orderNumber.create({
              data: {
                orderNumber,
                centerNumber: "4048",
                examType: suite,
                examMode: "Digital"
              }
            });
          }
          orderDbId = existingOrder.id;
        }

        for (let r = startRow; r < endRow; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;

          const firstName = String(row[1] || "").trim();
          const lastName = String(row[3] || "").trim();
          const grade = String(row[14] || "").trim();
          const instrument = String(row[15] || "").trim();

          if (!firstName || ["#", "First Name", "Leave Blank", "Aug", "Sep", "Oct", "Jul"].includes(firstName) || firstName.startsWith("Order") || !grade) {
            continue;
          }

          totalRowsChecked++;

          const subEmail = String(row[20] || row[5] || "").trim();
          const candEmail = String(row[5] || "").trim();
          const applicant = String(row[25] || "").trim();
          const school = String(row[27] || "").trim();
          const submitterFn = String(row[18] || "").trim();
          const submitterLn = String(row[19] || "").trim();
          const submitter = `${submitterFn} ${submitterLn}`.trim();

          // Extract fee from column 38 (index 37) or adjacent
          let fee = 0;
          const rawFee = row[37] !== "" ? row[37] : (row[38] !== "" ? row[38] : row[36]);
          if (rawFee !== undefined && rawFee !== null && rawFee !== "") {
            const parsed = parseFloat(String(rawFee).replace(/,/g, ""));
            if (!isNaN(parsed)) fee = parsed;
          }
          totalFeeAmount += fee;

          if (dryRun) {
            // For preview only, check if candidate exists
            const existing = await prisma.candidate.findFirst({
              where: {
                firstName: { equals: firstName, mode: "insensitive" },
                lastName: { equals: lastName, mode: "insensitive" },
                grade: { equals: grade, mode: "insensitive" },
                instrument: { equals: instrument, mode: "insensitive" }
              }
            });
            if (existing) {
              existingUpdated++;
            } else {
              newCandidatesEnrolled++;
            }
            continue;
          }

          // 1. Resolve TeacherAcademy
          const { key: teacherKey, name: teacherName } = getTeacherKeyAndName(applicant, submitter, school, subEmail, candEmail);
          const truePrimaryEmail = (subEmail && subEmail.toLowerCase() !== "none") ? subEmail : null;
          const displayTeacherName = submitter || applicant || "Unknown";

          let teacher = await prisma.teacherAcademy.findFirst({
            where: {
              OR: [
                { uniqueKey: { equals: teacherKey, mode: "insensitive" } },
                { name: { equals: teacherName, mode: "insensitive" } }
              ]
            }
          });

          if (!teacher) {
            teacher = await prisma.teacherAcademy.create({
              data: {
                uniqueKey: teacherKey,
                name: teacherName,
                teacherName: displayTeacherName,
                schoolName: school || null,
                primary_email: truePrimaryEmail
              }
            });
          }

          // 2. Resolve Candidate
          const candDeterministicId = generateUuid(`${firstName}-${lastName}-${suite}-${grade}-${instrument}`.toLowerCase());

          const existingCandidate = await prisma.candidate.findFirst({
            where: {
              OR: [
                { id: candDeterministicId },
                {
                  firstName: { equals: firstName, mode: "insensitive" },
                  lastName: { equals: lastName, mode: "insensitive" },
                  grade: { equals: grade, mode: "insensitive" },
                  instrument: { equals: instrument, mode: "insensitive" }
                }
              ]
            }
          });

          let targetCandId: string;

          if (existingCandidate) {
            targetCandId = existingCandidate.id;
            await prisma.candidate.update({
              where: { id: existingCandidate.id },
              data: {
                orderNumberId: orderDbId,
                sessionMonth: sectionMonth,
                expectedFee: fee,
                paymentStatus: "Reconciled",
                teacherId: teacher.id,
                updatedAt: new Date()
              }
            });
            existingUpdated++;
          } else {
            targetCandId = candDeterministicId;
            await prisma.candidate.create({
              data: {
                id: candDeterministicId,
                firstName,
                lastName,
                examType: suite,
                grade,
                instrument,
                expectedFee: fee,
                paymentStatus: "Reconciled",
                status: "Active",
                sessionMonth: sectionMonth,
                teacherId: teacher.id,
                orderNumberId: orderDbId
              }
            });
            newCandidatesEnrolled++;
          }

          // 3. Upsert BankTransaction matching record
          const narrationTag = `Master Enrollment Paid: ${firstName} ${lastName} (${targetCandId})`;
          const existingTx = await prisma.bankTransaction.findFirst({
            where: { narration: narrationTag }
          });

          if (!existingTx) {
            await prisma.bankTransaction.create({
              data: {
                transactionDate: new Date(),
                narration: narrationTag,
                amount: fee,
                reconciledMethod: "Master Enrollment Paid",
                reconciledTeacherId: teacher.id,
                status: "Matched",
                sessionMonth: sectionMonth
              }
            });
          }
        }
      }
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }

    return NextResponse.json({
      success: true,
      data: {
        suite,
        totalRowsChecked,
        newCandidatesEnrolled,
        existingUpdated,
        totalFee: `₹${totalFeeAmount.toLocaleString("en-IN")}`,
        orders: Array.from(ordersDetected),
        isDryRun: dryRun
      }
    });

  } catch (error: any) {
    console.error("Master upload API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
