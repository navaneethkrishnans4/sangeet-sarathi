import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { firstName, lastName, dob, examSuite, grade, subject, teacherName, schoolName, email, sessionMonth } = await req.json();

    if (!firstName || !examSuite || !grade) {
      return NextResponse.json({ success: false, error: "First Name, Exam Suite, and Grade are required." }, { status: 400 });
    }

    // Format text representation of candidate entry
    const formattedText = `1. ${firstName} ${lastName || ""}`.trim() + `\n` +
      `${dob || "01/01/2000"}\n` +
      `${examSuite} ${grade} ${subject || ""}`.trim() + `\n` +
      `${email || ""}\n\n` +
      `submitter name : ${teacherName || "Direct Entry"}\n` +
      `academy name : ${schoolName || ""}`;

    // Create a temporary directory
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manual-entry-"));
    const tempTxtPath = path.join(tmpDir, "manual_entry.txt");
    fs.writeFileSync(tempTxtPath, formattedText, "utf-8");

    const newDbEngineDir = path.resolve(process.cwd(), "data_engine");
    const convertCmd = `python3 convert_teacher_entries.py --input-folder "${tmpDir}" --master-music-sheet-id 1o-c-nrvq-LoQYyvAmGBgxsNQ6X9hll52LC-APwYxcqE --master-rp-sheet-id 1ee7cgY_YJjgTpMPtH7pQtVVDN1JWAjGlcONtqwae1VA --credentials-file credentials.json`;

    console.log("Running data_engine/convert_teacher_entries.py for Manual Entry...");
    const { stdout: legacyOut, stderr: legacyErr } = await execAsync(convertCmd, { cwd: newDbEngineDir });

    if ((legacyErr && legacyErr.includes("Error")) || (legacyOut && (legacyOut.includes("ERROR") || legacyOut.includes("were NOT written")))) {
      console.error(legacyErr || legacyOut);
      return NextResponse.json({ success: false, error: "Failed to push to Master Sheet or incomplete records found", details: legacyErr || legacyOut }, { status: 500 });
    }

    // Run sync script to pull into Postgres
    const monthArg = sessionMonth || "September";
    const syncCmd = `python3 sync_google_sheets_to_db.py --session-month "${monthArg}"`;
    const { stdout: syncOut, stderr: syncErr } = await execAsync(syncCmd, { cwd: newDbEngineDir });

    fs.rmSync(tmpDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      message: "Manual Entry successfully written to Google Sheets and synced to PostgreSQL!",
      sheetOutput: legacyOut,
      dbOutput: syncOut
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
