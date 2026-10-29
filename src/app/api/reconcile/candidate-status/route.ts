import { NextResponse } from "next/server";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { candidateId, candidateIds, status } = body;

    if (!status || (!candidateId && (!candidateIds || candidateIds.length === 0))) {
      return NextResponse.json(
        { success: false, error: "Candidate ID(s) and target status are required." },
        { status: 400 }
      );
    }

    const idsToUpdate: string[] = candidateIds || [candidateId];

    // 1. Fetch details of candidates being updated
    const candidates = await prisma.candidate.findMany({
      where: { id: { in: idsToUpdate } }
    });

    // 2. Update paymentStatus in Postgres Candidate table
    await prisma.candidate.updateMany({
      where: { id: { in: idsToUpdate } },
      data: { paymentStatus: status, updatedAt: new Date() }
    });

    // 3. Sync BankTransaction entries for manual reconciliation balance tracking
    for (const c of candidates) {
      const narrationTag = `Manual Reconciliation: ${c.firstName} ${c.lastName || ''} (${c.id})`.trim();

      if (status === "Reconciled") {
        const existingTx = await prisma.bankTransaction.findFirst({
          where: { narration: narrationTag }
        });

        if (!existingTx) {
          await prisma.bankTransaction.create({
            data: {
              transactionDate: new Date(),
              narration: narrationTag,
              amount: c.expectedFee,
              reconciledMethod: "Manual Override",
              reconciledTeacherId: c.teacherId,
              status: "Matched",
              sessionMonth: c.sessionMonth || "September"
            }
          });
        }
      } else {
        // If marked pending, remove manual bank transaction entry
        await prisma.bankTransaction.deleteMany({
          where: { narration: narrationTag }
        });
      }
    }

    // 4. Log audit entries
    const auditEntries = idsToUpdate.map(id => ({
      action: "MANUAL_RECONCILE_STATUS_TOGGLE",
      tableName: "Candidate",
      recordId: id,
      newValue: status,
      description: `Manually set paymentStatus to ${status} (Manual Override Bank Transaction Synced)`
    }));

    await prisma.auditLog.createMany({
      data: auditEntries
    });

    return NextResponse.json({
      success: true,
      message: `Successfully updated ${idsToUpdate.length} candidate(s) to '${status}' with manual bank balance updated!`
    });
  } catch (error: any) {
    console.error("Manual Candidate Reconcile API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
