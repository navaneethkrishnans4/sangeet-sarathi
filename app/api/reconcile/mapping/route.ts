import { NextResponse } from "next/server";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function GET(req: Request) {
  try {
    const tempTransactions = await prisma.tempBankTransaction.findMany({
      orderBy: { createdAt: "desc" },
      include: { mappedTeacher: true }
    });

    let dataSource = "temp";
    let formattedTransactions = [];

    const url = new URL(req.url);
    const month = url.searchParams.get("month");

    if (tempTransactions.length > 0) {
      formattedTransactions = tempTransactions.map(t => ({
        id: t.id,
        date: t.transactionDate ? new Date(t.transactionDate).toLocaleDateString("en-GB") : "",
        narration: t.narration,
        amount: t.amount,
        mappedTeacherId: t.mappedTeacherId || "",
        mappedTeacherName: t.mappedTeacher ? 
          (
            (t.mappedTeacher.teacherName && !t.mappedTeacher.teacherName.toLowerCase().includes("navneeth") && !t.mappedTeacher.teacherName.toLowerCase().includes("navaneeth"))
              ? t.mappedTeacher.teacherName 
              : t.mappedTeacher.name
          ) : "Unknown Teacher",
        mappedSchoolName: t.mappedTeacher?.schoolName || "",
        matchMethod: t.matchMethod || "Unassigned",
        isRuleSaved: t.isRuleSaved,
        status: t.status,
        sessionMonth: t.sessionMonth
      }));
    } else {
      dataSource = "main";
      
      const whereClause: any = {};
      if (month) {
        whereClause.OR = [
          { sessionMonth: month },
          { status: { in: ["Pending", "Mismatch"] } }
        ];
      }

      const mainTransactions = await prisma.bankTransaction.findMany({
        where: whereClause,
        orderBy: { transactionDate: "desc" },
        include: { reconciledTeacher: true }
      });
      formattedTransactions = mainTransactions.map(t => ({
        id: t.id,
        date: t.transactionDate ? new Date(t.transactionDate).toLocaleDateString("en-GB") : "",
        narration: t.narration,
        amount: t.amount,
        mappedTeacherId: t.reconciledTeacherId || "",
        mappedTeacherName: t.reconciledTeacher ? 
          (
            (t.reconciledTeacher.teacherName && !t.reconciledTeacher.teacherName.toLowerCase().includes("navneeth") && !t.reconciledTeacher.teacherName.toLowerCase().includes("navaneeth"))
              ? t.reconciledTeacher.teacherName 
              : t.reconciledTeacher.name
          ) : "Unknown Teacher",
        mappedSchoolName: t.reconciledTeacher?.schoolName || "",
        matchMethod: t.reconciledMethod || "Unassigned",
        isRuleSaved: true, // Rule is already saved since it's in Main DB
        status: t.status,
        sessionMonth: t.sessionMonth
      }));
    }

    const teachers = await prisma.teacherAcademy.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        teacherName: true,
        schoolName: true,
        primary_email: true
      }
    });

    const rules = await prisma.teacherAlias.findMany({
      include: { teacher: true },
      take: 100
    });

    // We already extracted month above
    
    const candidateWhere: any = { status: "Active" };
    if (month) candidateWhere.sessionMonth = month;

    const candidates = await prisma.candidate.findMany({
      where: candidateWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        grade: true,
        expectedFee: true,
        teacherId: true,
        teacher: {
          select: {
            name: true,
            teacherName: true,
            schoolName: true
          }
        },
        paymentStatus: true
      },
      orderBy: { firstName: "asc" }
    });

    return NextResponse.json({
      success: true,
      dataSource,
      tempTransactions: formattedTransactions,
      teachers: teachers.map(t => ({
        id: t.id,
        displayName: `${t.teacherName || t.name} ${t.schoolName ? `(${t.schoolName})` : ''}`.trim()
      })),
      rules: rules.map(r => ({
        id: r.id,
        alias: r.alias,
        teacherId: r.teacherId,
        teacherName: r.teacher.teacherName || r.teacher.name
      })),
      candidates: candidates.map(c => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        grade: c.grade,
        fee: c.expectedFee,
        teacherId: c.teacherId,
        teacherName: c.teacher ? (
        (c.teacher.teacherName && !c.teacher.teacherName.toLowerCase().includes("navneeth") && !c.teacher.teacherName.toLowerCase().includes("navaneeth"))
          ? c.teacher.teacherName
          : c.teacher.name
      ) : "",
        schoolName: c.teacher?.schoolName || "",
        paymentStatus: c.paymentStatus
      }))
    });
  } catch (error: any) {
    console.error("Mapping GET Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "remap") {
      const { tempId, teacherId, dataSource } = body;
      if (!tempId) {
        return NextResponse.json({ success: false, error: "Missing tempId" }, { status: 400 });
      }

      if (dataSource === "main") {
        await prisma.bankTransaction.update({
          where: { id: tempId },
          data: {
            reconciledTeacherId: teacherId,
            reconciledMethod: "Manual Override"
          }
        });
      } else {
        await prisma.tempBankTransaction.update({
          where: { id: tempId },
          data: {
            mappedTeacherId: teacherId,
            matchMethod: "Manual Override"
          }
        });
      }

      return NextResponse.json({ success: true, message: "Transaction re-mapped successfully." });
    }

    if (action === "save_rule") {
      const { tempId, teacherId, customAlias, dataSource } = body;
      if (!tempId || !teacherId) {
        return NextResponse.json({ success: false, error: "Missing tempId or teacherId" }, { status: 400 });
      }

      let txNarration = "";
      
      if (dataSource === "main") {
        const tx = await prisma.bankTransaction.findUnique({ where: { id: tempId } });
        if (!tx) return NextResponse.json({ success: false, error: "Transaction not found" }, { status: 404 });
        txNarration = tx.narration;
      } else {
        const tx = await prisma.tempBankTransaction.findUnique({ where: { id: tempId } });
        if (!tx) return NextResponse.json({ success: false, error: "Temporary transaction not found" }, { status: 404 });
        txNarration = tx.narration;
      }

      const aliasToSave = (customAlias || txNarration).trim();

      // Upsert TeacherAlias rule
      await prisma.teacherAlias.upsert({
        where: { alias: aliasToSave },
        update: { teacherId },
        create: {
          alias: aliasToSave,
          teacherId
        }
      });

      if (dataSource === "main") {
        await prisma.bankTransaction.update({
          where: { id: tempId },
          data: {
            reconciledTeacherId: teacherId,
            reconciledMethod: "Pass 1: Saved Rule"
          }
        });
      } else {
        await prisma.tempBankTransaction.update({
          where: { id: tempId },
          data: {
            isRuleSaved: true,
            mappedTeacherId: teacherId,
            matchMethod: "Pass 1: Saved Rule"
          }
        });
      }

      return NextResponse.json({ 
        success: true, 
        message: `Saved narration header rule for "${aliasToSave}"!` 
      });
    }

    if (action === "clear_temp") {
      await prisma.tempBankTransaction.deleteMany({});
      return NextResponse.json({ success: true, message: "Temporary transaction workspace cleared successfully." });
    }

    if (action === "ignore_transactions") {
      const { tempIds, dataSource } = body;
      if (!Array.isArray(tempIds)) {
        return NextResponse.json({ success: false, error: "Missing tempIds array" }, { status: 400 });
      }
      if (dataSource === "main") {
        await prisma.bankTransaction.deleteMany({
          where: { id: { in: tempIds } }
        });
      } else {
        await prisma.tempBankTransaction.deleteMany({
          where: { id: { in: tempIds } }
        });
      }
      return NextResponse.json({ success: true, message: `Ignored and deleted ${tempIds.length} transactions.` });
    }

    if (action === "save_mappings_to_db") {
      const { dataSource, sessionMonth } = body;
      
      let mappedTeacherIds: string[] = [];
      let tempTxs: any[] = [];
      
      if (dataSource === "temp") {
        tempTxs = await prisma.tempBankTransaction.findMany();
        mappedTeacherIds = [...new Set(tempTxs.filter(t => t.mappedTeacherId).map(t => t.mappedTeacherId as string))];
      } else {
        const mainTxs = await prisma.bankTransaction.findMany({
          where: { status: { not: "Matched" } }
        });
        mappedTeacherIds = [...new Set(mainTxs.filter(t => t.reconciledTeacherId).map(t => t.reconciledTeacherId as string))];
      }

      // Calculate teacher status (Lifetime Match)
      const teacherStatus: Record<string, string> = {};
      for (const tid of mappedTeacherIds) {
        const mainTxsAgg = await prisma.bankTransaction.aggregate({
          where: { reconciledTeacherId: tid },
          _sum: { amount: true }
        });
        let totalTxAmount = mainTxsAgg._sum.amount || 0;
        
        if (dataSource === "temp") {
          const teacherTempTxs = tempTxs.filter(t => t.mappedTeacherId === tid);
          totalTxAmount += teacherTempTxs.reduce((sum, t) => sum + t.amount, 0);
        }
        
        const candsAgg = await prisma.candidate.aggregate({
          where: { teacherId: tid, status: "Active" },
          _sum: { expectedFee: true }
        });
        const totalCandFee = candsAgg._sum.expectedFee || 0;
        
        teacherStatus[tid] = Math.abs(totalTxAmount - totalCandFee) < 1.0 ? "Matched" : "Mismatch";
      }
      
      if (dataSource === "temp") {
        for (const t of tempTxs) {
          const newStatus = t.mappedTeacherId ? (teacherStatus[t.mappedTeacherId] || "Pending") : "Pending";
          await prisma.bankTransaction.upsert({
            where: { narration: t.narration },
            update: {
              reconciledTeacherId: t.mappedTeacherId,
              reconciledMethod: t.matchMethod || (t.mappedTeacherId ? "Manual Confirmation" : "Unassigned"),
              status: newStatus
            },
            create: {
              transactionDate: t.transactionDate || new Date(),
              narration: t.narration,
              amount: t.amount,
              reconciledTeacherId: t.mappedTeacherId,
              reconciledMethod: t.matchMethod || (t.mappedTeacherId ? "Manual Confirmation" : "Unassigned"),
              status: newStatus,
              sessionMonth: sessionMonth || null
            }
          });
        }
        
        if (mappedTeacherIds.length > 0) {
          await prisma.candidate.updateMany({
            where: { teacherId: { in: mappedTeacherIds }, paymentStatus: { not: "Reconciled" } },
            data: { paymentStatus: "Reconciled" }
          });
        }

        await prisma.tempBankTransaction.deleteMany({});
      } else {
        // If main workspace, just update the statuses for any teachers we modified
        for (const tid of mappedTeacherIds) {
          await prisma.bankTransaction.updateMany({
            where: { reconciledTeacherId: tid },
            data: { status: teacherStatus[tid] }
          });
        }
      }

      // Sync the NotYetPaid table (rebuild it based on pending candidates)
      await prisma.notYetPaid.deleteMany({});
      const pendingCandidates = await prisma.candidate.findMany({
        where: { paymentStatus: { not: "Reconciled" }, status: "Active" },
        include: { teacher: true }
      });

      for (const pc of pendingCandidates) {
        if (pc.teacherId) {
          await prisma.notYetPaid.create({
            data: {
              candidateName: `${pc.firstName} ${pc.lastName}`.trim(),
              subject: pc.examType,
              grade: pc.grade,
              amount: pc.expectedFee,
              teacherId: pc.teacherId,
              teacherName: pc.teacher?.teacherName || pc.teacher?.name || "Unknown Teacher"
            }
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: dataSource === "temp" ? "Successfully saved workspace to main database!" : "Saved updates and synced NotYetPaid table!"
      });
    }

    if (action === "update_candidate_teacher") {
      const { candidateId, teacherId } = body;
      await prisma.candidate.update({
        where: { id: candidateId },
        data: { teacherId: teacherId || null }
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid action specified" }, { status: 400 });

  } catch (error: any) {
    console.error("Mapping POST Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
