import { NextResponse } from "next/server";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const teacherId = params.id;

    const teacher = await prisma.teacherAcademy.findUnique({
      where: { id: teacherId },
      include: {
        candidates: {
          where: { status: "Active" },
          orderBy: { firstName: "asc" }
        },
        transactions: true
      }
    });

    if (!teacher) {
      return NextResponse.json({ success: false, error: "Teacher not found" }, { status: 404 });
    }

    const totalPaid = teacher.transactions.reduce((sum, tx) => sum + tx.amount, 0);

    const students = teacher.candidates.map(c => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`.trim(),
      grade: c.grade,
      subject: c.examType,
      expectedFee: c.expectedFee,
      enrolmentMonth: c.createdAt.toLocaleString('default', { month: 'short', year: 'numeric' }),
      paymentStatus: c.paymentStatus
    }));

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacher.id,
        name: teacher.teacherName || teacher.name,
        schoolName: teacher.schoolName || "No Academy Name",
        totalPaid
      },
      students
    });

  } catch (error: any) {
    console.error("Ledger Detail API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
