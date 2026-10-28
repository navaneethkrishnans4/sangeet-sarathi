import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const suite = formData.get("suite") as string | null;
    const defaultMonth = (formData.get("sessionMonth") as string | null) || "November";
    const dryRun = formData.get("dryRun") === "true";

    if (!file) {
      return NextResponse.json({ success: false, error: "No Excel file uploaded" }, { status: 400 });
    }

    // Save uploaded file to temp dir
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "master-enroll-"));
    const tempFilePath = path.join(tmpDir, file.name || "master_enrolment.xlsx");
    
    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));

    // Script path
    const scriptPath = path.resolve(process.cwd(), "data_engine", "process_master_enrollment.py");
    
    let cmd = `python3 "${scriptPath}" --file "${tempFilePath}" --month "${defaultMonth}"`;
    if (suite && suite !== "auto") {
      cmd += ` --suite "${suite}"`;
    }
    if (dryRun) {
      cmd += ` --dry-run`;
    }

    console.log(`Executing: ${cmd}`);
    const { stdout, stderr } = await execAsync(cmd, { cwd: path.resolve(process.cwd(), "data_engine") });

    // Cleanup temp files
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}

    if (stderr && stderr.includes("Error during processing")) {
      console.error(stderr);
      return NextResponse.json({ success: false, error: stderr }, { status: 500 });
    }

    // Parse stdout summary
    let summary: any = { rawOutput: stdout };
    try {
      // Find JSON block or extract regex values
      const suiteMatch = stdout.match(/Suite:\s*(.+)/);
      const rowsMatch = stdout.match(/Total Rows Checked:\s*(\d+)/);
      const newMatch = stdout.match(/New Candidates Enrolled:\s*(\d+)/);
      const existingMatch = stdout.match(/Existing Candidates Synced:\s*(\d+)/);
      const feeMatch = stdout.match(/Total Fee:\s*(.+)/);
      const ordersMatch = stdout.match(/Orders:\s*(.+)/);

      summary = {
        success: stdout.includes("Success: True"),
        suite: suiteMatch ? suiteMatch[1].trim() : suite,
        totalRowsChecked: rowsMatch ? parseInt(rowsMatch[1], 10) : 0,
        newCandidatesEnrolled: newMatch ? parseInt(newMatch[1], 10) : 0,
        existingUpdated: existingMatch ? parseInt(existingMatch[1], 10) : 0,
        totalFee: feeMatch ? feeMatch[1].trim() : "₹0",
        orders: ordersMatch ? ordersMatch[1].trim() : "[]",
        isDryRun: dryRun,
        rawOutput: stdout
      };
    } catch (e) {
      console.warn("Failed to parse stdout into JSON", e);
    }

    return NextResponse.json({
      success: summary.success ?? true,
      data: summary
    });

  } catch (error: any) {
    console.error("Master upload API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
