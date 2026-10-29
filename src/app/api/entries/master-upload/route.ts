import { NextResponse } from "next/server";
import * as xlsx from "xlsx";
import crypto from "crypto";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

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

function parseCol39(val: any): { amount: number | null; billNo: string | null } {
  if (!val) return { amount: null, billNo: null };
  const s = String(val).trim();
  const billMatch = s.match(/bill\s*no\.?\s*(\d+)/i);
  const billNo = billMatch ? `Bill No. ${billMatch[1]}` : null;

  let cleaned = s.replace(/bill\s*no\.?\s*\d+/gi, "").replace(/sangeeth\s*sarathi/gi, "").trim();
  
  if (cleaned.includes("-")) {
    const parts = cleaned.match(/(\d[\d,]+(?:\.\d{1,2})?)/g);
    if (parts && parts.length >= 2) {
      const a = parseFloat(parts[0].replace(/,/g, ""));
      const b = parseFloat(parts[1].replace(/,/g, ""));
      if (!isNaN(a) && !isNaN(b)) {
        return { amount: a - b, billNo };
      }
    }
  }

  const amtMatch = cleaned.match(/(\d[\d,]+(?:\.\d{1,2})?)/);
  let amount: number | null = null;
  if (amtMatch) {
    const parsed = parseFloat(amtMatch[1].replace(/,/g, ""));
    if (!isNaN(parsed) && parsed > 500) {
      amount = parsed;
    }
  }
  return { amount, billNo };
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

    if (!connectionString) {
      return NextResponse.json({
        success: false,
        error: "DATABASE_URL is not configured in the server environment."
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

    // 2. Fetch existing database records in ONE fast parallel batch query
    const [existingCandidates, existingTeachers, existingOrders, existingBankTransactions] = await Promise.all([
      prisma.candidate.findMany({
        select: {
          id: true,
          firstName: true,
          lastName: true,
          grade: true,
          instrument: true,
          expectedFee: true,
          teacherId: true,
          orderNumberId: true,
          sessionMonth: true,
          paymentStatus: true
        }
      }),
      prisma.teacherAcademy.findMany({
        select: {
          id: true,
          uniqueKey: true,
          name: true,
          teacherName: true
        }
      }),
      prisma.orderNumber.findMany({
        select: {
          id: true,
          orderNumber: true
        }
      }),
      prisma.bankTransaction.findMany({
        select: {
          id: true,
          reconciledTeacherId: true,
          sessionMonth: true,
          amount: true,
          status: true
        }
      })
    ]);

    // Build fast in-memory lookup maps
    const orderMap = new Map<string, string>();
    for (const o of existingOrders) {
      orderMap.set(o.orderNumber, o.id);
    }

    const teacherMap = new Map<string, string>();
    const teacherDisplayMap = new Map<string, string>();
    for (const t of existingTeachers) {
      teacherMap.set(t.uniqueKey.toLowerCase(), t.id);
      teacherMap.set(t.name.toLowerCase(), t.id);
      teacherDisplayMap.set(t.id, t.teacherName || t.name);
    }

    const candidateMap = new Map<string, any>();
    const existingCandAmtByTeacherMonth = new Map<string, number>();
    for (const c of existingCandidates) {
      const key = `${c.firstName}_${c.lastName}_${c.grade}_${c.instrument}`.toLowerCase();
      candidateMap.set(key, c);
      candidateMap.set(c.id, c);
      if (c.teacherId && c.sessionMonth) {
        const tmKey = `${c.teacherId}_${c.sessionMonth}`.toLowerCase();
        existingCandAmtByTeacherMonth.set(tmKey, (existingCandAmtByTeacherMonth.get(tmKey) || 0) + (c.expectedFee || 0));
      }
    }

    const existingBankAmtByTeacherMonth = new Map<string, number>();
    for (const bt of existingBankTransactions) {
      if (bt.reconciledTeacherId && bt.sessionMonth && bt.status !== "Ignored") {
        const tmKey = `${bt.reconciledTeacherId}_${bt.sessionMonth}`.toLowerCase();
        existingBankAmtByTeacherMonth.set(tmKey, (existingBankAmtByTeacherMonth.get(tmKey) || 0) + bt.amount);
      }
    }

    // 3. Ensure OrderNumbers exist
    const ordersDetected = new Set<string>();
    for (const s of sections) {
      ordersDetected.add(s.orderNumber);
      if (!dryRun && !orderMap.has(s.orderNumber)) {
        const newOrder = await prisma.orderNumber.create({
          data: {
            orderNumber: s.orderNumber,
            centerNumber: "4048",
            examType: suite,
            examMode: "Digital"
          }
        });
        orderMap.set(s.orderNumber, newOrder.id);
      }
    }

    let totalRowsChecked = 0;
    let newCandidatesEnrolled = 0;
    let existingUpdated = 0;
    let totalFeeAmount = 0;

    const candidatesToInsert: any[] = [];
    const candidatesToUpdate: { id: string; orderNumberId: string; sessionMonth: string; expectedFee: number; teacherId: string }[] = [];
    const bankTxsToInsert: any[] = [];

    interface NewCandGroup {
      teacherId: string;
      teacherDisplayName: string;
      sectionMonth: string;
      cands: { firstName: string; lastName: string; candDeterministicId: string; fee: number; grade: string; instrument: string }[];
      explicitBatchAmt: number | null;
      billNo: string | null;
    }
    const newCandidatesByTeacherMonth = new Map<string, NewCandGroup>();

    // 4. Parse rows in-memory
    for (let i = 0; i < sections.length; i++) {
      const currentSection = sections[i];
      const nextSection = sections[i + 1];
      const startRow = currentSection.rowIndex + 1;
      const endRow = nextSection ? nextSection.rowIndex : rows.length;
      const orderNumber = currentSection.orderNumber;
      const sectionMonth = currentSection.month;
      const orderDbId = orderMap.get(orderNumber) || null;

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

        // Parse Column 39 (index 38) for batch amounts / bill numbers
        const col39Raw = row[38] !== undefined && row[38] !== "" ? row[38] : (row[39] !== "" ? row[39] : null);
        const { amount: col39BatchAmt, billNo: col39BillNo } = parseCol39(col39Raw);

        // Resolve teacher in-memory
        const { key: teacherKey, name: teacherName } = getTeacherKeyAndName(applicant, submitter, school, subEmail, candEmail);
        let teacherId = teacherMap.get(teacherKey.toLowerCase()) || teacherMap.get(teacherName.toLowerCase());

        if (!teacherId && !dryRun) {
          const truePrimaryEmail = (subEmail && subEmail.toLowerCase() !== "none") ? subEmail : null;
          const displayTeacherName = submitter || applicant || "Unknown";
          const newTeacher = await prisma.teacherAcademy.create({
            data: {
              uniqueKey: teacherKey,
              name: teacherName,
              teacherName: displayTeacherName,
              schoolName: school || null,
              primary_email: truePrimaryEmail
            }
          });
          teacherId = newTeacher.id;
          teacherMap.set(teacherKey.toLowerCase(), teacherId);
          teacherMap.set(teacherName.toLowerCase(), teacherId);
          teacherDisplayMap.set(teacherId, displayTeacherName);
        }

        // Check if candidate already exists in memory
        const candDeterministicId = generateUuid(`${firstName}-${lastName}-${suite}-${grade}-${instrument}`.toLowerCase());
        const candMatchKey = `${firstName}_${lastName}_${grade}_${instrument}`.toLowerCase();
        const existingCand = candidateMap.get(candMatchKey) || candidateMap.get(candDeterministicId);

        if (existingCand) {
          existingUpdated++;
          if (!dryRun && orderDbId && teacherId) {
            candidatesToUpdate.push({
              id: existingCand.id,
              orderNumberId: orderDbId,
              sessionMonth: sectionMonth,
              expectedFee: fee,
              teacherId
            });
            // Update in-memory record
            existingCand.orderNumberId = orderDbId;
            existingCand.sessionMonth = sectionMonth;
            existingCand.expectedFee = fee;
            existingCand.paymentStatus = "Reconciled";
          }
        } else {
          newCandidatesEnrolled++;
          if (!dryRun && orderDbId && teacherId) {
            candidatesToInsert.push({
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
              teacherId,
              orderNumberId: orderDbId
            });

            // Group newly enrolled candidates by (teacherId, sessionMonth)
            const tmKey = `${teacherId}_${sectionMonth}`.toLowerCase();
            const teacherDisplayName = teacherDisplayMap.get(teacherId) || submitter || applicant || "Unknown Teacher";
            
            if (!newCandidatesByTeacherMonth.has(tmKey)) {
              newCandidatesByTeacherMonth.set(tmKey, {
                teacherId,
                teacherDisplayName,
                sectionMonth,
                cands: [],
                explicitBatchAmt: col39BatchAmt,
                billNo: col39BillNo
              });
            }
            const group = newCandidatesByTeacherMonth.get(tmKey)!;
            group.cands.push({ firstName, lastName, candDeterministicId, fee, grade, instrument });
            if (col39BatchAmt && col39BatchAmt > 0) group.explicitBatchAmt = col39BatchAmt;
            if (col39BillNo) group.billNo = col39BillNo;

            // Add to in-memory map so duplicate rows in same file are caught
            candidateMap.set(candMatchKey, { id: candDeterministicId });
            candidateMap.set(candDeterministicId, { id: candDeterministicId });
          }
        }
      }
    }

    // Reconcile and create batch Master Enrollment Paid transactions
    if (!dryRun) {
      for (const [tmKey, group] of newCandidatesByTeacherMonth.entries()) {
        const { teacherId, teacherDisplayName, sectionMonth, cands, explicitBatchAmt, billNo } = group;
        
        const existingBankAmt = existingBankAmtByTeacherMonth.get(tmKey) || 0;
        const existingCandAmt = existingCandAmtByTeacherMonth.get(tmKey) || 0;
        const newCandAmt = cands.reduce((sum, c) => sum + c.fee, 0);
        const totalNeeded = existingCandAmt + newCandAmt;
        const remainingUnpaid = Math.max(0, totalNeeded - existingBankAmt);

        if (remainingUnpaid > 0) {
          const txAmount = explicitBatchAmt && explicitBatchAmt > 0 ? explicitBatchAmt : remainingUnpaid;
          let narration = "";
          if (cands.length === 1) {
            const c = cands[0];
            narration = `Master Enrollment Paid: ${c.firstName} ${c.lastName} (${c.candDeterministicId})${billNo ? ` [${billNo}]` : ""}`;
          } else {
            const studentNames = cands.map(c => `${c.firstName} ${c.lastName}`).join(", ");
            narration = `Master Enrollment Paid: ${teacherDisplayName} - ${sectionMonth} (${cands.length} Students: ${studentNames})${billNo ? ` [${billNo}]` : ""}`;
          }

          bankTxsToInsert.push({
            transactionDate: new Date(),
            narration,
            amount: txAmount,
            reconciledMethod: "Master Enrollment Paid",
            reconciledTeacherId: teacherId,
            status: "Matched",
            sessionMonth
          });

          existingBankAmtByTeacherMonth.set(tmKey, existingBankAmt + txAmount);
        }
      }
    }

    // 5. Commit batch updates & inserts efficiently
    if (!dryRun) {
      // Insert new candidates in bulk
      if (candidatesToInsert.length > 0) {
        await prisma.candidate.createMany({
          data: candidatesToInsert,
          skipDuplicates: true
        });
      }

      // Insert matching bank transactions in bulk
      if (bankTxsToInsert.length > 0) {
        await prisma.bankTransaction.createMany({
          data: bankTxsToInsert,
          skipDuplicates: true
        });
      }

      // Update existing candidates in parallel chunks
      const updateChunks = 25;
      for (let i = 0; i < candidatesToUpdate.length; i += updateChunks) {
        const chunk = candidatesToUpdate.slice(i, i + updateChunks);
        await Promise.all(
          chunk.map(c =>
            prisma.candidate.update({
              where: { id: c.id },
              data: {
                orderNumberId: c.orderNumberId,
                sessionMonth: c.sessionMonth,
                expectedFee: c.expectedFee,
                paymentStatus: "Reconciled",
                teacherId: c.teacherId,
                updatedAt: new Date()
              }
            })
          )
        );
      }
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
