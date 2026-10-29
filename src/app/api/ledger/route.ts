import { NextResponse } from "next/server";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function GET() {
  try {
    const teachers = await prisma.teacherAcademy.findMany({
      include: {
        candidates: {
          where: { status: "Active" }
        },
        transactions: true
      },
      orderBy: { name: "asc" }
    });

    const ledger = teachers.map((teacher) => {
      const candidateCount = teacher.candidates.length;
      const amountPaid = teacher.transactions.reduce((sum, tx) => sum + tx.amount, 0);

      return {
        id: teacher.id,
        teacherName: teacher.teacherName || teacher.name,
        academyName: teacher.schoolName || "No Academy Name",
        candidateCount,
        amountPaid
      };
    });

    return NextResponse.json({ success: true, ledger });
  } catch (error: any) {
    console.error("Ledger API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
