import crypto from "crypto";
import fs from "fs";
import path from "path";

export const MUSIC_MASTER_SHEET_ID = "1o-c-nrvq-LoQYyvAmGBgxsNQ6X9hll52LC-APwYxcqE";
export const ROCK_POP_MASTER_SHEET_ID = "1ee7cgY_YJjgTpMPtH7pQtVVDN1JWAjGlcONtqwae1VA";
export const FORM_RESPONSES_SHEET_ID = "1OvS1YA9PVKCMCrATyRRsW3sYUIzO88X6UUqVOFakUt0";

export function generateUuid(name: string): string {
  const hash = crypto.createHash("sha1").update(name).digest("hex");
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    "5" + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hash.substring(18, 20),
    hash.substring(20, 32)
  ].join("-");
}

export const uuidv5 = generateUuid;

export function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .trim()
    .split(/\s+/)
    .map(word => {
      if (word.length === 1) return word.toUpperCase();
      if (/^[A-Za-z](\.[A-Za-z])*\.?$/.test(word)) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

const DEFAULT_SERVICE_ACCOUNT = {
  client_email: "trinity-sheets-service@trinity-503109.iam.gserviceaccount.com",
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDB8adPV3JBj67K
dJnKhE7XeksCcVGhG8cqG/CzxXWVBje8ZF/ajThxQmhcxKtllNBnJtE7NiVj+G/D
QbabyNo+xBTX915LR/PQsiQGGlsX9N/2c3rvZnTqW7EiUWKzcnWNke9IEfTIQ7DT
xcQ0eurOtZehVC1kfRtGlzdBBHvnPClQazFO1+UmFU8Yco3Sko/KMcJtIJzvKqif
XIfozCY6fqXD9+JvIlxNFDqecc507DNjlzrVaFIcBrPiQc2G90cxGYHqMd2BLGWQ
g07szIHEklK3PLdPl61w2rcEeu/NeQScBrzIXJrzTNbp25HzTq+iFa1U9P1n8B5u
sIA1rO0NAgMBAAECggEAHHcuelu4Xl0LZ5WzmODQfZnqdoJRW9cq5UhSjOA3gNb3
yUPmObquhRkdHjiTe4ZbDDjLTuiElma5aKw1dCoHtlyrPoOFKIF4DLKIzQiDREHh
uVd7vLWKBXfNyN6vIO10yYGY4DgaeGZPBtYpFRbRbeODTN+BBhXCshqxtm5FDUwq
q5ZHT1CWeaF3zBD7D81UhMhfYh8ozBD6t2oGPkzZBmsjG/ugmitO3ftA/Lmom5Xb
uL5dI9Iv5dwC0hZHNhA/SFhY2tDPo1kQYmt8Ty/sh9VKXSLu7YXJ0/nc+GLf6z0F
sShVUJhxgwchGM8zbzqv0jI+ia4/8GPV/MzMKWuzgQKBgQDt5BqPumQH5XE5E63C
gb0ouqWaIQTBpGoeGXo0+hWpMTEnhdIR4BQDljoNIbKwhEcBgjPz6L/FJM1j2T/K
sF9b3pfYebOyS1jXVhRMDV1UfF7cJ5StR8JL3U/BkYDtBbR9zOffBcw3vLg7sCmG
+LK6+WsZFpErDuAx5l9YcwGa4QKBgQDQtSHYtVLXhlFii9c1KlbfAcp7o6C3QCpq
14QemckAy43OG7CJsPAjgVQLQyL9i1cMSRLaR/0p/K6iuOWoxHUE4fBsitKuyR28
ZAIWXOm96LAryoTGIEyhDpZne8Nq3VprIC+lqNyALuza4z7MPQIE3rDkx5c5Maci
dk4YgTqjrQKBgDfqIYQe31wrxc0QnwrUy81C8aGkmSWaq4afnmXNUkIOWetcPOAO
tyWQrdxgS0vKC5aDMArobgq8d7o8Wg4eHovNagtrr5z8sMkMZoDps0IkaXd9piiE
cVq7jf+FX7RWXvIis21sQ2/mX7dH1LrwwbHI5i9jaoOgX3nbGBYGEh6BAoGBAIjG
O7EuW2T9FHbVmCqyXY32OYE/YYLWXTX5mQ8Iz25i98Kb6NzDhQxvo+lhjRvF5j0Z
4m4EgYeznarsKy2n2dxiSVKIw7th98fPboLDTzdyt4lrRgolfrKJwc19kTqGZ8wO
ossY17B1kCl+hVgJnzobyqeTmaoUvShbiaCLiCddAoGAVar3DTXYKODPQYXOZQNb
JlW5gy2vhn6IZlmnezn2qvNydGOsAMvBTuCp2M0CAgUvSUuh8i+Y+J9QnevivR5Y
avYWamL7VaI0kmpjRtcuk5ikYLnLsrJUqKF0fHwgb5KTREg2C3V+prGSZW+LwaO1
zswRWByQs3V2iv2VURn5xag=
-----END PRIVATE KEY-----`
};

function getCredentials(): { client_email: string; private_key: string } {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\\n/g, "\n")
    };
  }

  const possiblePaths = [
    path.join(process.cwd(), "data_engine", "credentials.json"),
    path.join(process.cwd(), "credentials.json")
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
      try {
        const raw = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ p, "utf-8"));
        if (raw.client_email && raw.private_key) {
          return raw;
        }
      } catch {}
    }
  }

  return DEFAULT_SERVICE_ACCOUNT;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.token;
  }

  const creds = getCredentials();
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const b64 = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsignedToken = `${b64(header)}.${b64(payload)}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const signature = signer.sign(creds.private_key, "base64url");
  const jwt = `${unsignedToken}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to obtain Google OAuth access token: ${JSON.stringify(tokenData)}`);
  }

  cachedToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600)
  };

  return tokenData.access_token;
}

export interface CandidateSheetRow {
  firstName: string;
  lastName: string;
  dob?: string;
  grade: string;
  instrument: string;
  examType: string;
  fee: number;
  email?: string | null;
  submitterName?: string | null;
  submitterEmail?: string | null;
  schoolName?: string | null;
}

export interface SheetAppendParams {
  candidates: CandidateSheetRow[];
  submitterName?: string | null;
  submitterEmail?: string | null;
  schoolName?: string | null;
  targetSheetId?: string;
}

export async function appendCandidatesToGoogleSheet(
  params: SheetAppendParams
): Promise<{ success: boolean; rowsAppended: number; sheetType: string; error?: string }> {
  const { candidates, submitterName, submitterEmail, schoolName, targetSheetId } = params;

  if (!candidates || candidates.length === 0) {
    return { success: true, rowsAppended: 0, sheetType: "None" };
  }

  try {
    const token = await getAccessToken();

    const isRockAndPop = targetSheetId
      ? targetSheetId === ROCK_POP_MASTER_SHEET_ID
      : candidates.some(c => 
          c.examType.toLowerCase().includes("rock") || 
          ["drum", "drums", "drum kit", "vocals", "bass"].some(k => c.instrument.toLowerCase().includes(k))
        );

    const sheetId = targetSheetId || (isRockAndPop ? ROCK_POP_MASTER_SHEET_ID : MUSIC_MASTER_SHEET_ID);
    const sheetType = isRockAndPop ? "Rock & Pop" : "Music (Classical & Jazz)";

    const rows = candidates.map(c => {
      const row = new Array(38).fill("");
      const isRP = sheetId === ROCK_POP_MASTER_SHEET_ID || c.examType.toLowerCase().includes("rock");
      const suiteName = isRP ? "Rock and Pop (Digital)" : "Classical and Jazz (Digital)";
      const prodName = isRP 
        ? `Rock and Pop ${c.grade} (Digital)` 
        : `Classical and Jazz Technical ${c.grade} (Digital)`;

      const cSubName = toTitleCase(c.submitterName || submitterName || "Teacher");
      const cSubParts = cSubName.split(/\s+/);
      const cSubFirst = cSubParts[0] || "Teacher";
      const cSubLast = cSubParts.slice(1).join(" ") || "";
      const cSubEmail = c.submitterEmail || submitterEmail || "trinitykochi.ops.office@gmail.com";
      const cSchool = c.schoolName ? toTitleCase(c.schoolName) : (schoolName ? toTitleCase(schoolName) : "");

      row[1] = toTitleCase(c.firstName); // B: First Name (Proper Casing)
      row[3] = toTitleCase(c.lastName);  // D: Last Name (Proper Casing)
      row[4] = c.dob || "01/01/2000"; // E: DOB
      row[5] = c.email || cSubEmail; // F: Candidate Email
      row[13] = suiteName; // N: Exam Suite
      row[14] = prodName; // O: Product Name
      row[15] = c.instrument; // P: Subject
      row[17] = "N"; // R: Submitter same as candidate
      row[18] = cSubFirst; // S: Submitter First Name
      row[19] = cSubLast; // T: Submitter Last Name
      row[20] = cSubEmail; // U: Submitter Email
      row[24] = "N"; // Y: Applicant same as candidate
      row[25] = cSubName; // Z: Applicant Name
      row[26] = "Y"; // AA: Consent Received
      row[27] = cSchool; // AB: School Name
      row[28] = cSchool ? "Y" : "N"; // AC: School on cert
      row[34] = "Government ID Card"; // AI: ID Doc Type
      row[35] = "XXXXXXXXXXX"; // AJ: ID Doc Number
      row[36] = "India"; // AK: Nationality
      row[37] = String(c.fee); // AL: Fee

      return row;
    });

    const range = encodeURIComponent("'Enrolment Sheet'!A:AL");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values: rows })
    });

    const data = await res.json();
    if (data.error) {
      console.error("Google Sheets append API error:", data.error);
      return { success: false, rowsAppended: 0, sheetType, error: data.error.message || "Failed to append rows" };
    }

    return {
      success: true,
      rowsAppended: rows.length,
      sheetType
    };

  } catch (err: any) {
    console.error("appendCandidatesToGoogleSheet error:", err);
    return {
      success: false,
      rowsAppended: 0,
      sheetType: "Error",
      error: err.message
    };
  }
}

export async function readGoogleSheetRows(
  sheetId: string,
  range: string = "'Enrolment Sheet'!A:AL"
): Promise<string[][]> {
  const token = await getAccessToken();
  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodedRange}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Failed to read Google Sheet");
  }
  return data.values || [];
}

