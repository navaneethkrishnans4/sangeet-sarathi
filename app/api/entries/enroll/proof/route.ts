import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function POST(req: Request) {
  try {
    const { 
      submitterMobile, 
      submitterName, 
      paymentRefNote, 
      paymentScreenshotBase64, 
      paymentScreenshotFileName 
    } = await req.json();

    let screenshotUrl: string | null = null;
    if (paymentScreenshotBase64 && typeof paymentScreenshotBase64 === "string") {
      const matches = paymentScreenshotBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const base64Data = matches ? matches[2] : paymentScreenshotBase64;
      const buffer = Buffer.from(base64Data, "base64");

      const uploadsDir = path.join(process.cwd(), "public", "uploads", "payments");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const ext = (paymentScreenshotFileName && path.extname(paymentScreenshotFileName)) || ".png";
      const safeBase = (submitterName || "payment").toLowerCase().replace(/[^a-z0-9]/g, "_");
      const fileName = `${Date.now()}_${safeBase}${ext}`;
      const filePath = path.join(uploadsDir, fileName);

      fs.writeFileSync(filePath, buffer);
      screenshotUrl = `/uploads/payments/${fileName}`;

      await prisma.auditLog.create({
        data: {
          action: "PAYMENT_PROOF",
          tableName: "Candidate",
          recordId: submitterMobile || "UNKNOWN",
          newValue: `Ref: ${paymentRefNote || "UPI"}, Screenshot: ${screenshotUrl}`,
          description: `Payment Proof Uploaded by ${submitterName || "Submitter"} (${submitterMobile || ""})`
        }
      }).catch(err => console.warn("AuditLog warning:", err));
    }

    return NextResponse.json({ success: true, screenshotUrl });
  } catch (err: any) {
    console.error("Proof upload error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
