"""
reconcile.py — Trinity Bank Statement Reconciliation
=====================================================
Pass 1: Match deposits in bank statements against bank_aliases.csv
         (by Bank_Transaction_Pattern, Teacher_Name, or School_Name)

Usage:
    python3 reconcile.py
"""

import re
import csv
import json
import shutil
import pdfplumber
import openpyxl
import gspread
from pathlib import Path
from openpyxl.styles import Font, PatternFill

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR       = Path("/Users/navneethkrishnans/Documents/Trinity/Entries")
APP_DIR        = BASE_DIR / "App and Scripts"

# Load environment variables
STATEMENT_DIR  = APP_DIR / "Bank Statement"
ALIASES_CSV    = APP_DIR / "bank_aliases.csv"
DASHBOARD_PATH = BASE_DIR / "Fee_Dashboard.xlsx"

# Minimum deposit amount to consider (fees start at 5500)
MIN_DEPOSIT = 5500.0


# ── Step 1: Parse Bank Statements ─────────────────────────────────────────────

def parse_amount(text):
    """Convert '1,23,456.78' → 123456.78"""
    try:
        return float(text.replace(",", ""))
    except:
        return 0.0


def extract_deposits_hdfc(pdf_path):
    """
    Parse HDFC statement PDF.
    Format: DD/MM/YY  <narration>  <ref_no>  DD/MM/YY  <amount>  <balance>
    Deposits are identified when closing_balance > previous_balance.
    """
    deposits = []

    with pdfplumber.open(pdf_path) as pdf:
        full_text = ""
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                full_text += t + "\n"

    # Remove page header boilerplate (lines before the transaction table on each page)
    # Keep only lines that look like transaction data
    lines = full_text.split("\n")

    # Rebuild text: merge multi-line transactions into single logical lines
    # A new transaction starts when a line begins with DD/MM/YY pattern
    date_re = re.compile(r"^(\d{2}/\d{2}/\d{2})\s")
    blocks = []
    current_block = []

    for line in lines:
        line = line.strip()
        if not line:
            continue
        if date_re.match(line):
            if current_block:
                blocks.append(" ".join(current_block))
            current_block = [line]
        else:
            line_no_space = line.replace(" ", "")
            if "STATEMENTSUMMARY" in line_no_space.upper():
                break
                
            # Skip page footer/header lines from being glued to the transaction
            junk_keywords = ["Statementofaccount", "Nomination", "AccountNo", "From :", "RTGS", "PageNo", "HDFCBANKLIMITED", "Closingbalance", "Contentsofthis", "Stateaccount", "RegisteredOffice", "CustID", "AccountBranch", "Address", "City", "State", "Phoneno", "Email", "AccountType", "BranchCode", "JOINTHOLDERS", "MICR", "GSTIN", "GSTN", "ODLimit", "Currency", "A/COpenDate", "AccountStatus", "IFSC", "GROUNDFLOOR", "PUDUPARIYARAM"]
            if not any(kw.lower() in line_no_space.lower() for kw in junk_keywords):
                current_block.append(line)

    if current_block:
        blocks.append(" ".join(current_block))

    # From each block extract: date, narration, amount, balance
    # Numbers at the end of the joined line: last = balance, second-to-last = amount
    amount_re = re.compile(r"([\d,]+\.\d{2})")
    prev_balance = None

    for block in blocks:
        m_date = date_re.match(block)
        if not m_date:
            continue

        # Header/footer lines are already filtered out during block building

        amounts = amount_re.findall(block)
        if len(amounts) < 2:
            continue  # Need at least amount + balance

        balance = parse_amount(amounts[-1])
        amount  = parse_amount(amounts[-2])

        if prev_balance is None:
            prev_balance = balance
            continue

        # Deposit: balance went UP
        if abs(balance - prev_balance - amount) < 1.0:
            date_str = m_date.group(1)
            date = f"{date_str[:2]}-{date_str[3:5]}-20{date_str[6:]}"
            narration = block  # full block text as narration
            deposits.append({
                "date":       date,
                "narration":  narration,
                "amount":     amount,
                "bank":       "HDFC"
            })

        prev_balance = balance

    return deposits


def extract_deposits_canara(pdf_path):
    """
    Parse Canara Bank ePassbook PDF.
    Blocks are separated by 'Chq: <ref>' lines.
    Deposits identified when balance increases vs previous balance.
    """
    deposits = []

    with pdfplumber.open(pdf_path) as pdf:
        full_text = ""
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                full_text += t + "\n"

    # Split into transaction blocks at each "Chq:" marker
    blocks = re.split(r"Chq:\s*\S+", full_text)

    amount_re = re.compile(r"([\d,]+\.\d{2})")
    date_re   = re.compile(r"(\d{2}-\d{2}-\d{4})")
    prev_balance = None

    # Keywords that identify page-header lines (not transaction data)
    HEADER_KEYWORDS = ["Date Particulars", "Branch Code", "IFSC", "page "]

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Opening balance line — initialise tracker and skip
        if "Opening Balance" in block:
            obs = amount_re.findall(block)
            if obs:
                prev_balance = parse_amount(obs[-1])
            continue

        # Strip page-header lines from the block line-by-line.
        # Canara PDFs sometimes merge a page header with the first transaction
        # on that page into a single Chq-delimited block. We remove only the
        # header lines so the real transaction data is preserved.
        cleaned = "\n".join(
            ln for ln in block.split("\n")
            if not any(kw in ln for kw in HEADER_KEYWORDS)
        ).strip()
        if not cleaned:
            continue

        m_date = date_re.search(cleaned)
        if not m_date:
            continue

        amounts = amount_re.findall(cleaned)
        if len(amounts) < 2:
            continue

        balance = parse_amount(amounts[-1])
        amount  = parse_amount(amounts[-2])

        if prev_balance is None:
            prev_balance = balance
            continue

        # Deposit: closing balance went UP by exactly the transaction amount
        if abs(balance - prev_balance - amount) < 1.0:
            date = m_date.group(1)
            narration = re.sub(r"\s+", " ", cleaned).strip()
            deposits.append({
                "date":      date,
                "narration": narration,
                "amount":    amount,
                "bank":      "Canara"
            })

        # Always update so the next block has a correct reference balance
        prev_balance = balance

    return deposits




def load_all_deposits():
    """Load deposits by first parsing any new PDFs to CSV, then reading the CSV."""
    extracted_csv_path = STATEMENT_DIR / "extracted_transactions.csv"
    archive_dir = STATEMENT_DIR / "Archive"
    archive_dir.mkdir(exist_ok=True)
    
    # 1. Parse any new PDFs and append to CSV
    new_pdfs = list(STATEMENT_DIR.glob("*.pdf"))
    if new_pdfs:
        print(f"\n📂 Found {len(new_pdfs)} new PDF(s). Extracting to CSV...")
        
        file_exists = extracted_csv_path.exists()
        with open(extracted_csv_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["Date", "Narration", "Amount", "Bank"])
                
            for pdf_path in sorted(new_pdfs):
                name = pdf_path.name.lower()
                if "hdfc" in name or "acct statement" in name:
                    txs = extract_deposits_hdfc(pdf_path)
                else:
                    txs = extract_deposits_canara(pdf_path)
                    
                print(f"  📄 Extracted {len(txs)} deposits from {pdf_path.name}")
                
                for tx in txs:
                    writer.writerow([tx["date"], tx["narration"], tx["amount"], tx["bank"]])
                
                # Move to Archive
                shutil.move(str(pdf_path), str(archive_dir / pdf_path.name))
                print(f"  📦 Archived {pdf_path.name}")

    # 2. Load all transactions from CSV
    all_deposits = []
    seen_refs = set()  # Dedup by 12-digit UPI reference
    
    if extracted_csv_path.exists():
        with open(extracted_csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    amt = float(row["Amount"])
                except ValueError:
                    continue
                    
                tx = {
                    "date": row["Date"],
                    "narration": row["Narration"],
                    "amount": amt,
                    "bank": row["Bank"]
                }
                
                # Dedup using 12-digit reference number if present
                ref_match = re.search(r'\b(\d{12})\b', tx["narration"])
                if ref_match:
                    ref = ref_match.group(1)
                    if ref in seen_refs:
                        continue
                    seen_refs.add(ref)

                if tx["amount"] >= MIN_DEPOSIT or ("CASH DEPOSIT" not in tx["narration"].upper()):
                    all_deposits.append(tx)
                    
        print(f"✅ Loaded {len(all_deposits)} unique deposits from extracted_transactions.csv")
    else:
        print("⚠️ No extracted_transactions.csv found and no new PDFs to parse.")

    return all_deposits

def extract_payer_key(narration):
    narr = narration.upper()
    if "CASH DEPOSIT" in narr: return None
    
    # 1. Try to extract the unmasked UPI ID (e.g. AKASHJOSCO221 from HARIDAS-AKASHJOSCO221@OKHDFC)
    m_upi = re.search(r"([A-Z0-9]+)@[A-Z0-9]+", narr)
    if m_upi:
        upi = m_upi.group(1)
        # If it's a real unmasked ID (Canara masks them like **01354)
        if len(upi) >= 4 and "**" not in narr[max(0, m_upi.start()-2):m_upi.start()]:
            return upi.strip()
    m = re.search(r"UPI-([A-Z\s]+)\b", narr)
    if m: return m.group(1).strip()
    m = re.search(r"UPI/CR/\d+/([^/]+)/", narr)
    if m: return m.group(1).strip()
    m = re.search(r"MOB-IMPS-\s*CR/([^/]+)/", narr)
    if m: return m.group(1).strip()
    m = re.search(r"INET-IMPS-CR/([^/]+)/", narr)
    if m: return m.group(1).strip()
    m = re.search(r"NEFT CR-[A-Z0-9]+-[A-Z0-9\s]+-([A-Z\s]+)\s+\d", narr)
    if m: return m.group(1).strip()
    m = re.search(r"NEFT CR-[A-Z0-9]+-([A-Z\s]+)", narr)
    if m: return m.group(1).strip()
    return None


# ── Step 2: Load bank_aliases.csv ─────────────────────────────────────────────

def load_aliases():
    """
    Load bank_aliases.csv.
    Returns list of dicts: {pattern, teacher, school}
    """
    aliases = []
    with open(ALIASES_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            aliases.append({
                "pattern": row.get("Bank_Transaction_Pattern", "").strip().upper(),
                "teacher": row.get("Teacher_Name", "").strip().upper(),
                "school":  row.get("School_Name", "").strip().upper(),
            })
    return aliases


# ── Step 3: Pass 1 — Alias Matching ───────────────────────────────────────────

def pass1_alias_match(deposits, aliases):
    """
    For each deposit, check if any alias row matches the narration.
    Match condition: narration contains pattern OR teacher name OR school name
    (all comparisons are case-insensitive, whitespace-normalised).
    Returns: (matched_list, unmatched_list)
    """
    matched   = []
    unmatched = []

    for tx in deposits:
        narration_upper   = re.sub(r"\s+", " ", tx["narration"].upper())
        # Strip everything except A-Z and 0-9 (for ANUMANUELMULL-style matching)
        narration_nospace = re.sub(r"[^A-Z0-9]", "", narration_upper)
        # Strip everything except A-Z (for LENINVERGHESE-style matching where
        # a date like 18-07-2026 sits between the two words in the narration)
        narration_letters = re.sub(r"[^A-Z]", "", narration_upper)
        
        matching_aliases = []

        for alias in aliases:
            hit = False

            for field in ["pattern", "teacher", "school"]:
                val = alias[field]
                if not val:
                    continue
                # Check 1: normal substring match
                if val in narration_upper:
                    hit = True; break
                # Check 2: alphanumeric-only (handles ANUMANUELMULL vs ANU MANUEL MULL)
                val_nospace = re.sub(r"[^A-Z0-9]", "", val)
                if val_nospace and val_nospace in narration_nospace:
                    hit = True; break
                # Check 3: letters-only (handles LENINVERGHESE split by an embedded date)
                val_letters = re.sub(r"[^A-Z]", "", val)
                if len(val_letters) >= 6 and val_letters in narration_letters:
                    hit = True; break

            if hit:
                matching_aliases.append(alias)

        if matching_aliases:
            # Sort by match_count (default 0) to distribute across identical patterns
            matching_aliases.sort(key=lambda a: a.get("match_count", 0))
            found_alias = matching_aliases[0]
            # Increment match count for the chosen alias
            found_alias["match_count"] = found_alias.get("match_count", 0) + 1
            
            tx["alias"] = found_alias
            matched.append(tx)
        else:
            unmatched.append(tx)

    return matched, unmatched



# ── Step 3.4: Pass 2 — Grouped Exact Amount Match ─────────────────────────────

def pass2_grouped_match(unmatched_deposits, candidates, aggregated, matched_so_far):
    """
    Groups deposits by the same payer. If the sum is >= 5500, attempt to match.
    First tries to match Amount + Name. If that fails, tries to match Amount ONLY, 
    but ONLY if the amount is unique among remaining candidates/aggregated.
    """
    newly_matched = []
    still_unmatched = []
    
    # 1. Identify which master sheet entries are already "consumed"
    matched_names = set()
    for tx in matched_so_far:
        if tx["alias"]["teacher"]: matched_names.add(tx["alias"]["teacher"].upper())
        if tx["alias"]["school"]: matched_names.add(tx["alias"]["school"].upper())
        
    remaining_agg = [agg for agg in aggregated.values() if agg["display_name"].upper() not in matched_names]
    remaining_cand = [c for c in candidates if c["display_name"].upper() not in matched_names]
    
    # Pre-calculate amount frequencies to enforce uniqueness
    amount_counts = {}
    for agg in remaining_agg:
        amt = round(agg["total_fee"], 2)
        amount_counts[amt] = amount_counts.get(amt, 0) + 1
    for cand in remaining_cand:
        amt = round(cand["fee"], 2)
        amount_counts[amt] = amount_counts.get(amt, 0) + 1
        
    def is_amount_unique(amount):
        return amount_counts.get(round(amount, 2), 0) == 1
    
    # 2. Group by payer
    grouped = {}
    for tx in unmatched_deposits:
        payer = extract_payer_key(tx["narration"])
        if payer:
            grouped.setdefault(payer, []).append(tx)
        else:
            grouped[id(tx)] = [tx]
            
    # 3. Match Grouped
    tx_to_process = []
    for key, group in grouped.items():
        if len(group) == 1:
            tx_to_process.append(group[0])
        else:
            total = sum(t["amount"] for t in group)
            if total >= 5500:
                merged = {
                    "date": group[-1]["date"],
                    "narration": " | ".join(t["narration"] for t in group),
                    "amount": total,
                    "bank": group[0]["bank"],
                    "_original_txs": group
                }
                tx_to_process.append(merged)
            else:
                tx_to_process.extend(group)
                
    for tx in tx_to_process:
        amount = tx["amount"]
        narration_upper = re.sub(r"\s+", " ", tx["narration"].upper())
        narration_letters = re.sub(r"[^A-Z]", "", narration_upper)
        
        hit_alias = None
        
        # Only attempt Pass 2 match if it's a grouped transaction
        if "_original_txs" in tx:
            
            # --- STRATEGY A: AMOUNT + NAME MATCH (SAFE) ---
            # Match by Aggregated Total (Name Match)
            for agg_data in remaining_agg:
                if abs(agg_data["total_fee"] - amount) < 1.0:
                    for name in agg_data["names_to_match"]:
                        if not name or len(name) < 4: continue
                        name_letters = re.sub(r"[^A-Z]", "", name.upper())
                        if name_letters and len(name_letters) >= 4 and name_letters in narration_letters:
                            hit_alias = {
                                "pattern": f"Pass 2 (Agg/N): {name[:12]}",
                                "teacher": agg_data["display_name"],
                                "school": ""
                            }
                            break
                if hit_alias:
                    remaining_agg.remove(agg_data)
                    break
                    
            if not hit_alias:
                # Match by Individual Candidate Fee (Name Match)
                for cand in remaining_cand:
                    if abs(cand["fee"] - amount) < 1.0:
                        names = [cand["cand_name"], cand["school"], cand["submitter"], cand["applicant"]]
                        for n in [cand["cand_name"], cand["school"], cand["submitter"], cand["applicant"]]:
                            if n: names.extend(n.upper().split())
                        
                        for name in names:
                            if not name or len(name) < 4: continue
                            name_letters = re.sub(r"[^A-Z]", "", name.upper())
                            if name_letters and len(name_letters) >= 4 and name_letters in narration_letters:
                                hit_alias = {
                                    "pattern": f"Pass 2 (Cand/N): {name[:12]}",
                                    "teacher": cand["display_name"],
                                    "school": ""
                                }
                                break
                    if hit_alias:
                        remaining_cand.remove(cand)
                        break
                        
            # --- STRATEGY B: AMOUNT ONLY MATCH (REQUIRES UNIQUENESS) ---
            if not hit_alias and is_amount_unique(amount):
                # Match by Aggregated Total (Amount Only)
                for agg_data in remaining_agg:
                    if abs(agg_data["total_fee"] - amount) < 1.0:
                        hit_alias = {
                            "pattern": f"Pass 2 (Agg/Amt): {agg_data['display_name'][:12]}",
                            "teacher": agg_data["display_name"],
                            "school": ""
                        }
                        remaining_agg.remove(agg_data)
                        break
                        
                if not hit_alias:
                    # Match by Individual Candidate Fee (Amount Only)
                    for cand in remaining_cand:
                        if abs(cand["fee"] - amount) < 1.0:
                            hit_alias = {
                                "pattern": f"Pass 2 (Cand/Amt): {cand['display_name'][:12]}",
                                "teacher": cand["display_name"],
                                "school": ""
                            }
                            remaining_cand.remove(cand)
                            break
                        
        if hit_alias:
            if "_original_txs" in tx:
                for orig_tx in tx["_original_txs"]:
                    newly_matched.append({**orig_tx, "alias": hit_alias})
            else:
                newly_matched.append({**tx, "alias": hit_alias})
        else:
            # Failed to match grouped, OR it's an individual tx
            if "_original_txs" in tx:
                still_unmatched.extend(tx["_original_txs"])
            else:
                still_unmatched.append(tx)
                
    return newly_matched, still_unmatched
# ── Step 3.5: Pass 3 — Dynamic Google Sheet Matching ──────────────────────────

def pass3_dynamic_match(unmatched_deposits, candidates, aggregated):
    """
    Matches individual deposits against Master Data dynamically based on name and exact amount.
    """
    newly_matched = []
    still_unmatched = []
    
    for tx in unmatched_deposits:
        amount = tx["amount"]
        narration_upper = re.sub(r"\s+", " ", tx["narration"].upper())
        narration_letters = re.sub(r"[^A-Z]", "", narration_upper)
        
        hit_alias = None

        # 1. Match by Aggregated Total
        for canon_id, agg_data in aggregated.items():
            if abs(agg_data["total_fee"] - amount) < 1.0:
                for name in agg_data["names_to_match"]:
                    if not name or len(name) < 4: continue
                    name_letters = re.sub(r"[^A-Z]", "", name.upper())
                    if name_letters and len(name_letters) >= 4 and name_letters in narration_letters:
                        hit_alias = {
                            "pattern": f"Pass 3 (Agg): {name[:15]}",
                            "teacher": agg_data["display_name"],
                            "school": ""
                        }
                        break
            if hit_alias: break
            
        if hit_alias:
            newly_matched.append({**tx, "alias": hit_alias})
            continue
            
        # 2. Match by Individual Candidate Fee
        for cand in candidates:
            if abs(cand["fee"] - amount) < 1.0:
                names = [cand["cand_name"], cand["school"], cand["submitter"], cand["applicant"]]
                for n in [cand["cand_name"], cand["school"], cand["submitter"], cand["applicant"]]:
                    if n: names.extend(n.upper().split())
                
                for name in names:
                    if not name or len(name) < 4: continue
                    name_letters = re.sub(r"[^A-Z]", "", name.upper())
                    if name_letters and len(name_letters) >= 4 and name_letters in narration_letters:
                        hit_alias = {
                            "pattern": f"Pass 3 (Cand): {name[:15]}",
                            "teacher": cand["display_name"],
                            "school": ""
                        }
                        break
            if hit_alias: break
            
        if hit_alias:
            newly_matched.append({**tx, "alias": hit_alias})
        else:
            still_unmatched.append(tx)
            
    return newly_matched, still_unmatched

# ── Step 3.6: Pass 4 — Exact Amount Match ──────────────────────────────────────────

def pass4_exact_amount_match(unmatched, candidates, aggregated, matched_so_far):
    """
    Match remaining individual deposits exactly against remaining Google Sheet data by amount only.
    REQUIRES UNIQUENESS: If multiple candidates owe the exact same amount, it is skipped to avoid guessing.
    """
    newly_matched = []
    still_unmatched = []
    
    # 1. Identify which master sheet entries are already "consumed"
    matched_names = set()
    for tx in matched_so_far:
        if tx["alias"]["teacher"]: matched_names.add(tx["alias"]["teacher"].upper())
        if tx["alias"]["school"]: matched_names.add(tx["alias"]["school"].upper())
        
    remaining_agg = [agg for agg in aggregated.values() if agg["display_name"].upper() not in matched_names]
    remaining_cand = [c for c in candidates if c["display_name"].upper() not in matched_names]
    
    # Pre-calculate amount frequencies to enforce uniqueness
    amount_counts = {}
    for agg in remaining_agg:
        amt = round(agg["total_fee"], 2)
        amount_counts[amt] = amount_counts.get(amt, 0) + 1
    for cand in remaining_cand:
        amt = round(cand["fee"], 2)
        amount_counts[amt] = amount_counts.get(amt, 0) + 1
        
    def is_amount_unique(amount):
        return amount_counts.get(round(amount, 2), 0) == 1
            
    for tx in unmatched:
        amount = tx["amount"]
        hit_alias = None
        
        # Only attempt blind match if the amount is totally unique among remainders
        if is_amount_unique(amount):
            # Match by Aggregated Total
            for agg_data in remaining_agg:
                if abs(agg_data["total_fee"] - amount) < 1.0:
                    hit_alias = {
                        "pattern": f"Pass 4 (Agg): {agg_data['display_name'][:15]}",
                        "teacher": agg_data["display_name"],
                        "school": ""
                    }
                    remaining_agg.remove(agg_data)
                    break
                    
            if not hit_alias:
                # Match by Individual Candidate Fee
                for cand in remaining_cand:
                    if abs(cand["fee"] - amount) < 1.0:
                        hit_alias = {
                            "pattern": f"Pass 4 (Cand): {cand['display_name'][:15]}",
                            "teacher": cand["display_name"],
                            "school": ""
                        }
                        remaining_cand.remove(cand)
                        break
                
        if hit_alias:
            newly_matched.append({**tx, "alias": hit_alias})
        else:
            still_unmatched.append(tx)
            
    return newly_matched, still_unmatched

def get_canon_id(applicant, submitter, school, sub_email, cand_email):
    generic_emails = ["trinitykochi.ops.office@gmail.com"]
    if sub_email and sub_email.lower() != "none" and sub_email.lower() not in generic_emails:
        return f"EMAIL:{sub_email.lower()}"
    elif cand_email and cand_email.lower() != "none" and cand_email.lower() not in generic_emails:
        return f"EMAIL:{cand_email.lower()}"
    elif school and school.lower() != "none":
        return f"SCHOOL:{school.lower()}"
    else:
        name = applicant if (applicant and applicant.lower() != "none") else submitter
        if not name or name.lower() == "none":
            name = "Unknown"
        return f"NAME:{name.lower()}"

def fetch_master_data():
    creds_path = APP_DIR / "credentials.json"
    if not creds_path.exists():
        creds_path = APP_DIR / "trinity-503109-765805d01c09.json"
        
    gc = gspread.service_account(filename=str(creds_path))
    # Note: Hardcoding defaults for simplicity, these correspond to the current sheets
    music_sheet_id = '1o-c-nrvq-LoQYyvAmGBgxsNQ6X9hll52LC-APwYxcqE'
    rp_sheet_id = '1ee7cgY_YJjgTpMPtH7pQtVVDN1JWAjGlcONtqwae1VA'

    candidates = []
    aggregated = {}

    for sheet_id in [music_sheet_id, rp_sheet_id]:
        try:
            sh = gc.open_by_key(sheet_id)
            ws = sh.worksheet("Enrolment Sheet")
        except Exception as e:
            continue
            
        all_rows = ws.get_all_values()
        
        for r in range(6, len(all_rows)):
            row = all_rows[r]
            row += [""] * (40 - len(row))
            
            first_name = row[1].strip()
            if not first_name:
                continue
                
            cand_name = (row[1].strip() + " " + row[2].strip() + " " + row[3].strip()).strip()
            school = row[27].strip()
            submitter = (row[18].strip() + " " + row[19].strip()).strip()
            applicant = row[25].strip()
            
            cand_email = row[5].strip()
            sub_email = row[20].strip()
            
            fee_val = row[37].strip()
            try:
                fee = float(fee_val.replace(',', '')) if fee_val else 0.0
            except ValueError:
                fee = 0.0
                
            canon_id = get_canon_id(applicant, submitter, school, sub_email, cand_email)
            display_name = applicant or submitter or school or "Unknown"
            
            candidates.append({
                "cand_name": cand_name,
                "school": school,
                "submitter": submitter,
                "applicant": applicant,
                "fee": fee,
                "canon_id": canon_id,
                "display_name": display_name
            })
            
            if canon_id not in aggregated:
                aggregated[canon_id] = {
                    "total_fee": 0.0,
                    "names_to_match": set([school, submitter, applicant]),
                    "display_name": display_name
                }
            aggregated[canon_id]["total_fee"] += fee
            aggregated[canon_id]["names_to_match"].update([school, submitter, applicant])
            
            # Also add all name words (e.g. John, Shahil) to help match aggregated totals paid on behalf of a student/submitter
            for n in [cand_name, school, submitter, applicant]:
                if n:
                    words = [w for w in n.split() if len(w) >= 4]
                    aggregated[canon_id]["names_to_match"].update(words)
            
    return candidates, aggregated


# ── Step 4: Update Fee_Dashboard.xlsx ─────────────────────────────────────────

def update_dashboard(matched, unmatched):
    print("📝 Opening Fee Dashboard...")
    """
    Open Fee_Dashboard.xlsx and write reconciliation results.
    Columns written:
      Col 7  — Reconciled Amount (INR)
      Col 8  — Status
      Col 9  — Bank Account
      Col 10 — Matched Narration(s)
    """
    wb = openpyxl.load_workbook(DASHBOARD_PATH)
    ws = wb.active

    COL_AMOUNT    = 7
    COL_STATUS    = 8
    COL_BANK      = 9
    COL_NARRATION = 10
    COL_MATCHED_BY= 11

    # Write headers if not present
    ws.cell(row=1, column=COL_AMOUNT,    value="Reconciled (INR)").font    = Font(bold=True)
    ws.cell(row=1, column=COL_STATUS,    value="Status").font               = Font(bold=True)
    ws.cell(row=1, column=COL_BANK,      value="Bank Account").font         = Font(bold=True)
    ws.cell(row=1, column=COL_NARRATION, value="Matched Narration").font    = Font(bold=True)
    ws.cell(row=1, column=COL_MATCHED_BY, value="Matched Pass").font       = Font(bold=True)

    green_fill  = PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid")
    yellow_fill = PatternFill(start_color="FFEB9C", end_color="FFEB9C", fill_type="solid")
    red_fill    = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")

    # Build lookup: teacher_name_upper → row number
    row_map = {}
    for r in range(2, ws.max_row + 1):
        val = ws.cell(row=r, column=1).value
        if val and str(val).strip().upper() != "GRAND TOTAL":
            row_map[str(val).strip().upper()] = r

    # Group matched deposits by teacher
    teacher_data = {}
    for tx in matched:
        alias   = tx["alias"]
        teacher = alias["teacher"] or alias["school"]  # display name

        # Find the matching row in dashboard
        target_row = None
        for key in row_map:
            if alias["teacher"] and alias["teacher"].upper() in key:
                target_row = row_map[key]
                teacher = ws.cell(row=target_row, column=1).value
                break
            if alias["school"] and alias["school"].upper() in key:
                target_row = row_map[key]
                teacher = ws.cell(row=target_row, column=1).value
                break

        if target_row is None:
            continue

        if target_row not in teacher_data:
            teacher_data[target_row] = {
                "teacher":    teacher,
                "expected":   ws.cell(row=target_row, column=6).value or 0,
                "total":      0.0,
                "banks":      [],
                "narrations": [],
                "passes":     []
            }

        teacher_data[target_row]["total"]      += tx["amount"]
        teacher_data[target_row]["banks"].append(tx["bank"])
        teacher_data[target_row]["narrations"].append(f"[{tx['date']}] {tx['narration'][:60]}")
        
        if alias.get("pattern", "").startswith("Pass 2"):
            pass_str = "Pass 2"
        elif alias.get("pattern", "").startswith("Pass 3"):
            pass_str = "Pass 3"
        elif alias.get("pattern", "").startswith("Pass 4"):
            pass_str = "Pass 4"
        else:
            pass_str = "Pass 1"
        teacher_data[target_row]["passes"].append(pass_str)

    # Write to spreadsheet
    for row_num, data in teacher_data.items():
        expected = float(data["expected"])
        actual   = data["total"]

        ws.cell(row=row_num, column=COL_AMOUNT,    value=actual)
        ws.cell(row=row_num, column=COL_BANK,      value=", ".join(set(data["banks"])))
        ws.cell(row=row_num, column=COL_NARRATION, value=" | ".join(data["narrations"]))
        ws.cell(row=row_num, column=COL_MATCHED_BY, value=", ".join(set(data["passes"])))

        status_cell = ws.cell(row=row_num, column=COL_STATUS)
        if actual >= expected > 0:
            status_cell.value = "✅ MATCHED"
            status_cell.fill  = green_fill
        elif 0 < actual < expected:
            status_cell.value = f"⚠️ PARTIAL (paid {actual:,.0f} of {expected:,.0f})"
            status_cell.fill  = yellow_fill
        elif actual > expected > 0:
            status_cell.value = f"⚠️ OVERPAID (paid {actual:,.0f} vs {expected:,.0f})"
            status_cell.fill  = yellow_fill
        elif actual > expected > 0:
            status_cell.value = f"⚠️ OVERPAID (+{actual - expected:,.0f})"
            status_cell.fill  = yellow_fill

    matched_rows = set(teacher_data.keys())
    for r in range(2, ws.max_row + 1):
        val = ws.cell(row=r, column=1).value
        if not val or str(val).strip().upper() == "GRAND TOTAL": continue
        if r not in matched_rows:
            status_cell = ws.cell(row=r, column=COL_STATUS)
            expected = ws.cell(row=r, column=6).value or 0
            ws.cell(row=r, column=COL_AMOUNT).value = ""
            ws.cell(row=r, column=COL_BANK).value = ""
            ws.cell(row=r, column=COL_NARRATION).value = ""
            ws.cell(row=r, column=COL_MATCHED_BY).value = ""
            if float(expected) > 0:
                status_cell.value = "❌ NOT REMITTED"
                status_cell.fill  = red_fill

    grand_total_row = None
    for r in range(2, ws.max_row + 1):
        if str(ws.cell(row=r, column=1).value).strip().upper() == "GRAND TOTAL":
            grand_total_row = r
            break
            
    if grand_total_row and ws.max_row > grand_total_row:
        ws.delete_rows(grand_total_row + 1, ws.max_row - grand_total_row)
        
    unmatched_filtered = [tx for tx in unmatched if tx["amount"] >= MIN_DEPOSIT]
    if unmatched_filtered:
        start_row = ws.max_row + 2
        ws.cell(row=start_row, column=1, value="UNMATCHED DEPOSITS (Not in Master)").font = Font(bold=True, color="FF0000")
        start_row += 1
        grey_fill = PatternFill(start_color="D3D3D3", end_color="D3D3D3", fill_type="solid")
        for tx in unmatched_filtered:
            ws.cell(row=start_row, column=1, value="Unknown Remitter").fill = grey_fill
            ws.cell(row=start_row, column=2, value=tx['date'])
            ws.cell(row=start_row, column=3, value=tx['narration'][:100])
            ws.cell(row=start_row, column=COL_AMOUNT, value=tx['amount'])
            ws.cell(row=start_row, column=COL_BANK, value=tx['bank'])
            start_row += 1

    wb.save(DASHBOARD_PATH)
    print(f"\n✅ Dashboard updated: {DASHBOARD_PATH}")


# ── Step 5: Print Results ──────────────────────────────────────────────────────

def print_results(matched, unmatched, pass1_count, pass2_count, pass3_count, pass4_count):
    print("\n" + "=" * 70)
    print(f"RECONCILIATION RESULTS")
    print("=" * 70)

    print(f"\n✅ MATCHED ({len(matched)} deposits):")
    print(f"  {'Date':<14} {'Amount':>10}  {'Matched By':<20}  {'Teacher/Academy':<25}  Narration (truncated)")
    print(f"  {'-'*14} {'-'*10}  {'-'*20}  {'-'*25}  {'-'*40}")

    for tx in matched:
        alias = tx["alias"]
        # Determine which column caused the match if not Pass 2
        narr = re.sub(r"\s+", " ", tx["narration"].upper())
        if alias["pattern"].startswith("Pass 2") or alias["pattern"].startswith("Pass 3") or alias["pattern"].startswith("Pass 4"):
            matched_by = alias["pattern"]
        elif alias["pattern"] and alias["pattern"] in narr:
            matched_by = f"Pattern: {alias['pattern'][:18]}"
        elif alias["teacher"] and alias["teacher"].upper() in narr:
            matched_by = f"Teacher: {alias['teacher'][:18]}"
        elif alias["school"] and alias["school"].upper() in narr:
            matched_by = f"School: {alias['school'][:19]}"
        else:
            matched_by = "Exact match"

        display_teacher = alias["teacher"] or alias["school"] or "?"
        narration_short = re.sub(r"\s+", " ", tx["narration"]).strip()[:40]

        print(f"  {tx['date']:<14} {tx['amount']:>10,.2f}  {matched_by:<20}  {display_teacher:<25}  {narration_short}")

    unmatched_filtered = [tx for tx in unmatched if tx["amount"] >= MIN_DEPOSIT]
    print(f"\n❌ UNMATCHED deposits >= ₹{MIN_DEPOSIT:,.0f} ({len(unmatched_filtered)}):")
    print(f"  {'Date':<14} {'Amount':>10}  Narration (truncated)")
    print(f"  {'-'*14} {'-'*10}  {'-'*50}")
    for tx in unmatched_filtered:
        narration_short = re.sub(r"\s+", " ", tx["narration"]).strip()[:55]
        print(f"  {tx['date']:<14} {tx['amount']:>10,.2f}  {narration_short}")

    print("\n" + "=" * 70)
    total_matched = sum(t["amount"] for t in matched)
    total_unmatched = sum(t["amount"] for t in unmatched)
    print(f"  Total matched amount  : ₹{total_matched:>12,.2f} (Pass 1: {pass1_count} | Pass 2: {pass2_count} | Pass 3: {pass3_count} | Pass 4: {pass4_count})")
    print(f"  Total unmatched amount: ₹{total_unmatched:>12,.2f}")
    print("=" * 70 + "\n")



def apply_manual_overrides(matched, unmatched):
    overrides_path = APP_DIR / "manual_overrides.json"
    if not overrides_path.exists():
        return matched, unmatched
    try:
        with open(overrides_path, "r", encoding="utf-8") as f:
            overrides = json.load(f)
    except Exception:
        return matched, unmatched
        
    all_tx = matched + unmatched
    new_matched = []
    new_unmatched = []
    
    for tx in all_tx:
        # Format amount identically to JS (e.g., 6050.0 -> "6050")
        amt_str = str(int(tx['amount'])) if float(tx['amount']).is_integer() else str(tx['amount'])
        tx_id = f"{tx['date']}_{amt_str}_{tx['narration']}"
        tx['id'] = tx_id
        if tx_id in overrides:
            target = overrides[tx_id]
            if target == "__UNMATCHED__":
                tx.pop("alias", None)
                new_unmatched.append(tx)
            else:
                tx["alias"] = {"pattern": "Manual Match", "teacher": target, "school": ""}
                new_matched.append(tx)
        else:
            if "alias" in tx:
                new_matched.append(tx)
            else:
                new_unmatched.append(tx)
                
    return new_matched, new_unmatched

if __name__ == "__main__":
    print("\n📂 Loading bank statements from:", STATEMENT_DIR)
    all_deposits = load_all_deposits()
    large_deposits = sum(1 for t in all_deposits if t["amount"] >= MIN_DEPOSIT)
    print(f"  → {len(all_deposits)} deposits found ({large_deposits} ≥ ₹{MIN_DEPOSIT:,.0f})\n")

    print("📋 Loading aliases from:", ALIASES_CSV)
    aliases = load_aliases()
    print(f"  → {len(aliases)} alias rows loaded\n")

    print("🔍 Running Pass 1: Alias CSV Matching...")
    matched, unmatched = pass1_alias_match(all_deposits, aliases)
    pass1_count = len(matched)
    
    pass2_count = 0
    if unmatched:
        print(f"  → {len(unmatched)} deposits unmatched. Running Pass 2: Grouped Exact Amount Matching...")
        candidates, aggregated = fetch_master_data()
        pass2_matched, still_unmatched = pass2_grouped_match(unmatched, candidates, aggregated, matched)
        matched.extend(pass2_matched)
        unmatched = still_unmatched
        pass2_count = len(pass2_matched)
        print(f"  → Pass 2 matched {pass2_count} additional deposits!\n")

    pass3_count = 0
    if unmatched:
        print(f"  → {len(unmatched)} deposits unmatched. Running Pass 3: Dynamic Name & Amount Matching...")
        if 'candidates' not in locals():
            candidates, aggregated = fetch_master_data()
        pass3_matched, still_unmatched = pass3_dynamic_match(unmatched, candidates, aggregated)
        matched.extend(pass3_matched)
        unmatched = still_unmatched
        pass3_count = len(pass3_matched)
        print(f"  → Pass 3 matched {pass3_count} additional deposits!\n")

    pass4_count = 0
    if unmatched:
        print(f"  → {len(unmatched)} deposits unmatched. Running Pass 4: Exact Amount Matching...")
        if 'candidates' not in locals():
            candidates, aggregated = fetch_master_data()
        pass4_matched, still_unmatched = pass4_exact_amount_match(unmatched, candidates, aggregated, matched)
        matched.extend(pass4_matched)
        unmatched = still_unmatched
        pass4_count = len(pass4_matched)
        print(f"  → Pass 4 matched {pass4_count} additional deposits!\n")


    matched, unmatched = apply_manual_overrides(matched, unmatched)

    print_results(matched, unmatched, pass1_count, pass2_count, pass3_count, pass4_count)

    print("💾 Updating Fee Dashboard...")
    update_dashboard(matched, unmatched)
    
    # Dump json for UI
    try:
        with open(APP_DIR / "reconciliation_data.json", "w", encoding="utf-8") as f:
            json.dump({"matched": matched, "unmatched": unmatched}, f)
    except Exception as e:
        print("Failed to write reconciliation_data.json:", e)

