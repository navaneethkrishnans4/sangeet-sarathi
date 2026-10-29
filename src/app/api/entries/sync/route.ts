import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const dbEngineDir = path.resolve(process.cwd(), "data_engine");
    const formSheetId = "1OvS1YA9PVKCMCrATyRRsW3sYUIzO88X6UUqVOFakUt0";
    
    // Command 1: Safely process only NEW incoming form rows from "Form Responses 1" tab
    const convertCmd = `python3 convert_teacher_entries.py --google-sheet-id "${formSheetId}" --master-music-sheet-id 1o-c-nrvq-LoQYyvAmGBgxsNQ6X9hll52LC-APwYxcqE --master-rp-sheet-id 1ee7cgY_YJjgTpMPtH7pQtVVDN1JWAjGlcONtqwae1VA --credentials-file credentials.json`;
    console.log("Running convert_teacher_entries.py --google-sheet-id...");
    const { stdout: convertOut, stderr: convertErr } = await execAsync(convertCmd, { cwd: dbEngineDir });

    if ((convertErr && convertErr.includes("Error")) || (convertOut && (convertOut.includes("ERROR") || convertOut.includes("were NOT written")))) {
      console.error(convertErr || convertOut);
      return NextResponse.json({ success: false, error: "Failed to process Google Form Responses or incomplete records found", details: convertErr || convertOut }, { status: 500 });
    }

    // Extract sessionMonth if provided in JSON or searchParams
    let sessionMonth = "September";
    try {
      const body = await req.json();
      if (body?.sessionMonth) sessionMonth = body.sessionMonth;
    } catch {
      const { searchParams } = new URL(req.url);
      if (searchParams.get("sessionMonth")) sessionMonth = searchParams.get("sessionMonth")!;
    }

    // Command 2: Sync Master Sheets to PostgreSQL
    const syncCmd = `python3 sync_google_sheets_to_db.py --session-month "${sessionMonth}"`;
    console.log("Running sync_google_sheets_to_db.py...");
    const { stdout: syncOut, stderr: syncErr } = await execAsync(syncCmd, { cwd: dbEngineDir });

    if (syncErr && syncErr.includes("Error")) {
      console.error(syncErr);
      return NextResponse.json({ success: false, error: "Failed to sync Google Sheets to Database", details: syncErr }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Successfully processed new Google Form responses and synchronized Master Sheets to PostgreSQL!",
      output: `[Form Responses Engine]:\n${convertOut}\n\n[Database Sync Engine]:\n${syncOut}`
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
