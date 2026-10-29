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
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "excel-upload-"));
    const tempFilePath = path.join(tmpDir, file.name);
    fs.writeFileSync(tempFilePath, buffer);

    const newDbEngineDir = path.resolve(process.cwd(), "data_engine");
    const convertCmd = `python3 convert_teacher_entries.py --input-folder "${tmpDir}" --master-music-sheet-id 1o-c-nrvq-LoQYyvAmGBgxsNQ6X9hll52LC-APwYxcqE --master-rp-sheet-id 1ee7cgY_YJjgTpMPtH7pQtVVDN1JWAjGlcONtqwae1VA --credentials-file credentials.json`;

    console.log("Running data_engine/convert_teacher_entries.py for Excel File...");
    const { stdout: legacyOut, stderr: legacyErr } = await execAsync(convertCmd, { cwd: newDbEngineDir });

    if ((legacyErr && legacyErr.includes("Error")) || (legacyOut && (legacyOut.includes("ERROR") || legacyOut.includes("were NOT written")))) {
      console.error(legacyErr || legacyOut);
      return NextResponse.json({ success: false, error: "Failed to push Excel data to Master Sheet or incomplete records found", details: legacyErr || legacyOut }, { status: 500 });
    }

    const sessionMonth = (formData.get("sessionMonth") as string) || "September";
    const monthArg = sessionMonth || "September";
    const syncCmd = `python3 sync_google_sheets_to_db.py --session-month "${monthArg}"`;
    const { stdout: syncOut, stderr: syncErr } = await execAsync(syncCmd, { cwd: newDbEngineDir });

    fs.rmSync(tmpDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      message: `Excel Roster (${file.name}) successfully appended to Google Sheets and synced to PostgreSQL!`,
      sheetOutput: legacyOut,
      dbOutput: syncOut
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
