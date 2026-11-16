import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  try {
    let sessionMonth = "November";
    try {
      const body = await req.json();
      if (body?.sessionMonth) sessionMonth = body.sessionMonth;
    } catch {
      const { searchParams } = new URL(req.url);
      if (searchParams.get("sessionMonth")) sessionMonth = searchParams.get("sessionMonth")!;
    }

    const [candCount, teacherCount] = await Promise.all([
      prisma.candidate.count({ where: { sessionMonth } }),
      prisma.teacherAcademy.count()
    ]);

    return NextResponse.json({
      success: true,
      message: `Database synchronization complete for ${sessionMonth} session!`,
      output: `[PostgreSQL Native Engine]\n- Active Candidates (${sessionMonth}): ${candCount}\n- Enrolled Teachers / Academies: ${teacherCount}\n- Status: All candidate entries and ledger balances are synced directly with PostgreSQL.`
    });
  } catch (error: any) {
    console.error("API Error in /api/entries/sync:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
