import { NextResponse } from "next/server";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get("table") || "Candidate";

  try {
    let data = [];
    switch (table) {
      case "Candidate":
        data = await prisma.candidate.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
        break;
      case "TeacherAcademy":
        data = await prisma.teacherAcademy.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
        break;
      case "BankTransaction":
        data = await prisma.bankTransaction.findMany({ orderBy: { transactionDate: 'desc' }, take: 100 });
        break;
      case "TempBankTransaction":
        data = await prisma.tempBankTransaction.findMany({ orderBy: { transactionDate: 'desc' }, take: 100 });
        break;
      case "NotYetPaid":
        data = await prisma.notYetPaid.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
        break;
      default:
        return NextResponse.json({ success: false, error: "Unknown table" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("Database API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
