import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";
import { GoogleGenerativeAI } from "@google/generative-ai";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const { text, sessionMonth } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "Empty text provided" }, { status: 400 });
    }

    // 1. Parse with Gemini First
    let processedText = text;
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
      
      const prompt = `You are an expert data extractor. The following text contains messy, unstructured student entries for Trinity exams.
Extract the candidate details and output ONLY a strictly formatted list. Do not include any markdown, backticks, or conversational text.

Format rules:
1. Number each candidate's block (e.g. 1. Candidate Name).
2. The second line must be the Date of Birth (DD/MM/YYYY).
3. The third line must be the Grade and Subject (e.g. Electronic Keyboard grade 1).
4. The fourth line must be the Candidate/Parent Email.
5. If there is a shared academy or submitter, put it as a footer at the bottom in the format:
submitter name : [Name]
academy name : [Academy]

Raw Text:
${text}`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      processedText = response.text().trim();
      
      // Strip markdown block if Gemini accidentally wraps it
      if (processedText.startsWith("\`\`\`")) {
        const lines = processedText.split("\n");
        processedText = lines.slice(1, lines.length - 1).join("\n");
      }
      
    } catch (aiError) {
      console.error("Gemini Parsing failed, falling back to raw text:", aiError);
    }

    // 2. Create a temporary directory
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-"));
    const tempTxtPath = path.join(tmpDir, "whatsapp_paste.txt");

    // 3. Write the cleaned WhatsApp text to the file
    fs.writeFileSync(tempTxtPath, processedText, "utf-8");

    // Paths
    const newDbEngineDir = path.resolve(process.cwd(), "data_engine");
    
    // Command 1: Run the cloud-native converter script to append to Google Sheets
    const convertCmd = `python3 convert_teacher_entries.py --input-folder "${tmpDir}" --master-music-sheet-id 1o-c-nrvq-LoQYyvAmGBgxsNQ6X9hll52LC-APwYxcqE --master-rp-sheet-id 1ee7cgY_YJjgTpMPtH7pQtVVDN1JWAjGlcONtqwae1VA --credentials-file credentials.json`;

    console.log("Running data_engine/convert_teacher_entries.py...");
    const { stdout: legacyOut, stderr: legacyErr } = await execAsync(convertCmd, { cwd: newDbEngineDir });
    
    if ((legacyErr && legacyErr.includes("Error")) || (legacyOut && (legacyOut.includes("ERROR") || legacyOut.includes("were NOT written")))) {
      console.error(legacyErr || legacyOut);
      return NextResponse.json({ success: false, error: "Failed to push to Master Sheet or incomplete records found", details: legacyErr || legacyOut }, { status: 500 });
    }

    // Command 2: Run the new sync script to pull from Google Sheets to PostgreSQL
    const monthArg = sessionMonth || "September";
    const syncCmd = `python3 sync_google_sheets_to_db.py --session-month "${monthArg}"`;
    console.log("Running new sync_google_sheets_to_db.py...");
    const { stdout: syncOut, stderr: syncErr } = await execAsync(syncCmd, { cwd: newDbEngineDir });

    if (syncErr && syncErr.includes("Error")) {
      console.error(syncErr);
      return NextResponse.json({ success: false, error: "Failed to sync to PostgreSQL", details: syncErr }, { status: 500 });
    }

    // Cleanup temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });

    return NextResponse.json({ 
      success: true, 
      message: "Data successfully appended to Google Sheets and synced into PostgreSQL Database!",
      sheetOutput: "[AI REFORMATTED TEXT]\n" + processedText + "\n\n" + legacyOut,
      dbOutput: syncOut
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
