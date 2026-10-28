import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const execAsync = promisify(exec);

async function getSummaryMetrics(month?: string | null, orderNumberStr?: string | null) {
  const candidateWhere: any = {};
  if (month) candidateWhere.sessionMonth = month;
  if (orderNumberStr) candidateWhere.orderNumber = { orderNumber: orderNumberStr };

  const totalExp = await prisma.candidate.aggregate({
    where: candidateWhere,
    _sum: { expectedFee: true }
  });
  const totalExpectedFees = totalExp._sum.expectedFee || 0;

  // Classical & Jazz total expected vs reconciled
  const classicalExp = await prisma.candidate.aggregate({
    where: { 
      ...candidateWhere,
      examType: { contains: "classical", mode: "insensitive" }
    },
    _sum: { expectedFee: true }
  });
  const classicalExpected = classicalExp._sum.expectedFee || 0;

  const classicalRec = await prisma.candidate.aggregate({
    where: { 
      ...candidateWhere,
      examType: { contains: "classical", mode: "insensitive" },
      paymentStatus: "Reconciled"
    },
    _sum: { expectedFee: true }
  });
  const classicalTotal = classicalRec._sum.expectedFee || 0;

  // Rock & Pop total expected vs reconciled
  const rockPopExp = await prisma.candidate.aggregate({
    where: { 
      ...candidateWhere,
      examType: { contains: "rock", mode: "insensitive" }
    },
    _sum: { expectedFee: true }
  });
  const rockPopExpected = rockPopExp._sum.expectedFee || 0;

  const rockPopRec = await prisma.candidate.aggregate({
    where: { 
      ...candidateWhere,
      examType: { contains: "rock", mode: "insensitive" },
      paymentStatus: "Reconciled"
    },
    _sum: { expectedFee: true }
  });
  const rockPopTotal = rockPopRec._sum.expectedFee || 0;

  // 4. Total received bank deposits from BankTransaction table
  const bankWhere: any = {};
  if (month) bankWhere.sessionMonth = month;
  const bankExp = await prisma.bankTransaction.aggregate({
    where: bankWhere,
    _sum: { amount: true }
  });
  const totalReceived = bankExp._sum.amount || 0;

  // 5. Remaining amount to be received
  const remainingToReceive = Math.max(0, totalExpectedFees - totalReceived);

  const allCandidatesList = await prisma.candidate.findMany({
    where: candidateWhere,
    orderBy: { updatedAt: "desc" },
    include: { teacher: true }
  });

  const allCandidates = allCandidatesList.map(c => ({
    id: c.id,
    candidateName: `${c.firstName} ${c.lastName || ""}`.trim(),
    examType: c.examType,
    grade: c.grade,
    instrument: c.instrument,
    fee: c.expectedFee,
    teacherName: c.teacher?.teacherName || c.teacher?.name || "",
    schoolName: c.teacher?.schoolName || "",
    reconciledStatus: (c.paymentStatus === "Reconciled" ? "Reconciled" : "Pending") as "Reconciled" | "Pending" | "Mismatch"
  }));

  const reconciledItems = allCandidates.filter(c => c.reconciledStatus === "Reconciled");

  // 7. Fetch unmatched bank deposits
  const unmatchedWhere: any = { reconciledTeacherId: null };
  if (month) unmatchedWhere.sessionMonth = month;
  const unmatched = await prisma.bankTransaction.findMany({
    where: unmatchedWhere,
    take: 50,
    orderBy: { transactionDate: "desc" }
  });

  const unmatchedDeposits = unmatched.map(u => ({
    id: u.id,
    date: u.transactionDate ? new Date(u.transactionDate).toLocaleDateString("en-GB") : "",
    narration: u.narration,
    amount: u.amount,
    sourceBank: "Bank Statement"
  }));

  const orderNumbers = await prisma.orderNumber.findMany({
    select: { orderNumber: true, examType: true },
    orderBy: { orderNumber: "asc" }
  });

  return {
    metrics: {
      totalReceived,
      classicalTotal,
      classicalExpected,
      rockPopTotal,
      rockPopExpected,
      remainingToReceive,
      totalExpectedFees
    },
    reconciledItems,
    allCandidates,
    unmatchedDeposits,
    availableOrderNumbers: orderNumbers.map(o => ({
      orderNumber: o.orderNumber,
      label: o.examType ? `${o.orderNumber} (${o.examType})` : o.orderNumber
    }))
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const month = url.searchParams.get("month");
    const orderNumber = url.searchParams.get("orderNumber");
    
    const data = await getSummaryMetrics(month, orderNumber);
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("Reconciliation GET Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("statements") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: "No PDF statement files uploaded." }, { status: 400 });
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "recon-statements-"));
    const tempFilePaths: string[] = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const tempPath = path.join(tmpDir, file.name);
      fs.writeFileSync(tempPath, buffer);
      tempFilePaths.push(tempPath);
    }

    const dbEngineDir = path.resolve(process.cwd(), "data_engine");
    const pdfArgs = tempFilePaths.map(p => `"${p}"`).join(" ");
    const reconCmd = `python3 reconcile_db.py --pdf ${pdfArgs}`;

    console.log("Running reconciliation engine:", reconCmd);
    const { stdout, stderr } = await execAsync(reconCmd, { cwd: dbEngineDir });

    // Cleanup temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });

    // Re-fetch updated metrics
    const updatedData = await getSummaryMetrics();

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${files.length} bank statement PDF(s)!`,
      output: stdout + (stderr ? "\nSTDERR:\n" + stderr : ""),
      ...updatedData
    });

  } catch (error: any) {
    console.error("Reconciliation POST Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
