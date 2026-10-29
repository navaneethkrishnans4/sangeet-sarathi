import os
import re
import uuid
import shutil
import pdfplumber
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
DB_URL = os.environ.get("DATABASE_URL", "").replace("?pgbouncer=true", "")

BASE_DIR = Path(os.path.dirname(__file__))
# We pull PDFs from the old directory as requested to avoid breaking the old workflow
STATEMENT_DIR = BASE_DIR.parent.parent / "App and Scripts" / "Bank Statement"
ARCHIVE_DIR = STATEMENT_DIR / "Archive"
ARCHIVE_DIR.mkdir(exist_ok=True)

MIN_DEPOSIT = 0.0

def parse_amount(text):
    try: return float(text.replace(",", ""))
    except: return 0.0

def extract_deposits_hdfc(pdf_path):
    deposits = []
    with pdfplumber.open(pdf_path) as pdf:
        full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    
    lines = full_text.split("\n")
    date_re = re.compile(r"^(\d{2}/\d{2}/\d{2})\s")
    blocks, current_block = [], []
    
    for line in lines:
        line = line.strip()
        if not line: continue
        if date_re.match(line):
            if current_block: blocks.append(" ".join(current_block))
            current_block = [line]
        else:
            line_no_space = line.replace(" ", "")
            if "STATEMENTSUMMARY" in line_no_space.upper(): break
            junk_keywords = ["Statementofaccount", "Nomination", "AccountNo", "From :", "RTGS", "PageNo", "HDFCBANKLIMITED", "Closingbalance", "Contentsofthis", "ODLimit", "CustID", "AccountStatus", "JOINTHOLDERS", "AccountBranch", "RegisteredOfficeAddress", "StateaccountbranchGSTN"]
            if not any(kw.lower() in line_no_space.lower() for kw in junk_keywords):
                current_block.append(line)
                
    if current_block: blocks.append(" ".join(current_block))
    
    amount_re = re.compile(r"([\d,]+\.\d{2})")
    prev_balance = None
    
    for block in blocks:
        m_date = date_re.match(block)
        if not m_date: continue
        amounts = amount_re.findall(block)
        if len(amounts) < 2: continue
        balance = parse_amount(amounts[-1])
        amount = parse_amount(amounts[-2])
        
        is_credit = False
        if prev_balance is not None and abs(balance - prev_balance - amount) < 1.0:
            is_credit = True
        elif prev_balance is not None and balance > prev_balance and abs((balance - prev_balance) - amount) < 1.0:
            is_credit = True
        # Fallback for first transaction or math failure on obvious credits
        elif any(kw in block.upper() for kw in ["-CR", " CR ", "CREDIT", "NEFT CR", "IMPS-CR"]):
            # Verify it's a credit by checking if it's not a debit keyword
            if not any(dk in block.upper() for dk in ["RETURN", "BOUNCE", "REVERSAL"]):
                is_credit = True

        if is_credit:
            date_str = m_date.group(1)
            date_obj = datetime.strptime(f"{date_str[:2]}-{date_str[3:5]}-20{date_str[6:]}", "%d-%m-%Y")
            deposits.append({
                "date": date_obj,
                "narration": block,
                "amount": amount,
            })
            
        prev_balance = balance
    return deposits

def extract_deposits_canara(pdf_path):
    deposits = []
    with pdfplumber.open(pdf_path) as pdf:
        full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    
    blocks = re.split(r"Chq:\s*\S+", full_text)
    amount_re = re.compile(r"([\d,]+\.\d{2})")
    date_re = re.compile(r"(\d{2}-\d{2}-\d{4})")
    prev_balance = None
    
    for block in blocks:
        block = block.strip()
        if not block: continue
        if "Opening Balance" in block:
            obs = amount_re.findall(block)
            if obs: prev_balance = parse_amount(obs[-1])
            continue
            
        cleaned = "\n".join(ln for ln in block.split("\n") if not any(kw in ln for kw in ["Date Particulars", "Branch Code", "IFSC", "page "])).strip()
        if not cleaned: continue
        m_date = date_re.search(cleaned)
        if not m_date: continue
        amounts = amount_re.findall(cleaned)
        if len(amounts) < 2: continue
        
        balance = parse_amount(amounts[-1])
        amount = parse_amount(amounts[-2])
        
        is_credit = False
        if prev_balance is not None and abs(balance - prev_balance - amount) < 1.0:
            is_credit = True
        elif prev_balance is not None and balance > prev_balance and abs((balance - prev_balance) - amount) < 1.0:
            is_credit = True
        elif any(kw in cleaned.upper() for kw in ["-CR", " CR ", "CREDIT", "NEFT CR", "IMPS-CR"]):
            if not any(dk in cleaned.upper() for dk in ["RETURN", "BOUNCE", "REVERSAL"]):
                is_credit = True

        if is_credit:
            date_obj = datetime.strptime(m_date.group(1), "%d-%m-%Y")
            deposits.append({
                "date": date_obj,
                "narration": re.sub(r"\s+", " ", cleaned).strip(),
                "amount": amount,
            })
            
        prev_balance = balance
    return deposits

def load_new_pdfs(cur, pdf_paths=None):
    if pdf_paths:
        new_pdfs = [Path(p) for p in pdf_paths if Path(p).exists()]
    else:
        new_pdfs = [f for f in STATEMENT_DIR.glob("*.pdf") if f.is_file()]
        
    print(f"📂 Found {len(new_pdfs)} PDF(s) to process.")
    total_inserted = 0
    for pdf_path in sorted(new_pdfs):
        name = pdf_path.name.lower()
        if "hdfc" in name or "acct statement" in name:
            txs = extract_deposits_hdfc(pdf_path)
        else:
            txs = extract_deposits_canara(pdf_path)
            
        for tx in txs:
            if tx["amount"] < MIN_DEPOSIT and "CASH DEPOSIT" not in tx["narration"].upper():
                continue
                
            prefix = tx["narration"][:80]
            cur.execute('''
                SELECT id FROM "BankTransaction" 
                WHERE "transactionDate" = %s AND amount = %s AND narration LIKE %s
            ''', (tx["date"], tx["amount"], prefix + '%'))
            exists_in_main = cur.fetchone()

            cur.execute('''
                SELECT id FROM "TempBankTransaction" 
                WHERE "transactionDate" = %s AND amount = %s AND narration LIKE %s
            ''', (tx["date"], tx["amount"], prefix + '%'))
            exists_in_temp = cur.fetchone()
            
            if not exists_in_main and not exists_in_temp:
                cur.execute("""
                    INSERT INTO "TempBankTransaction" (id, "transactionDate", narration, amount, "createdAt", "updatedAt")
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (str(uuid.uuid4()), tx["date"], tx["narration"], tx["amount"], datetime.now(), datetime.now()))
                total_inserted += 1
                
        if not pdf_paths:
            shutil.move(str(pdf_path), str(ARCHIVE_DIR / pdf_path.name))
            print(f"  📦 Extracted and archived {pdf_path.name}")
        else:
            print(f"  📦 Extracted {pdf_path.name}")
        
    return total_inserted

def extract_payer_key(narration):
    narr = narration.upper()
    if "CASH DEPOSIT" in narr: return None
    
    # 1. Extract UPI sender name prefix (e.g. UPI-AKASH G -> AKASH G)
    m = re.search(r"UPI-([A-Z\s]+?)(?:-|\d|@|\b)", narr)
    if m and len(m.group(1).strip()) >= 3:
        return m.group(1).strip()

    m = re.search(r"UPI/CR/\d+/([^/]+)/", narr)
    if m: return m.group(1).strip()

    m_upi = re.search(r"([A-Z0-9]+)@[A-Z0-9]+", narr)
    if m_upi:
        upi = m_upi.group(1)
        if len(upi) >= 4 and "**" not in narr[max(0, m_upi.start()-2):m_upi.start()]:
            return upi.strip()

    m = re.search(r"MOB-IMPS-\s*CR/([^/]+)/", narr)
    if m: return m.group(1).strip()
    m = re.search(r"INET-IMPS-CR/([^/]+)/", narr)
    if m: return m.group(1).strip()
    m = re.search(r"NEFT CR-[A-Z0-9]+-[A-Z0-9\s]+-([A-Z\s]+)\s+\d", narr)
    if m: return m.group(1).strip()
    m = re.search(r"NEFT CR-[A-Z0-9]+-([A-Z\s]+)", narr)
    if m: return m.group(1).strip()
    return None

def reconcile_transactions(pdf_paths=None):
    print("🔌 Connecting to PostgreSQL Engine...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Load any new PDFs directly into the database
    new_count = load_new_pdfs(cur, pdf_paths=pdf_paths)
    conn.commit()
    print(f"✅ Loaded {new_count} new deposits into TempBankTransaction table.")
        
    # 2. Fetch all Unreconciled Transactions from Temp Workspace
    cur.execute('SELECT * FROM "TempBankTransaction" WHERE "mappedTeacherId" IS NULL')
    unreconciled = cur.fetchall()
    if not unreconciled:
        print("✅ All transactions are fully reconciled!")
        conn.close()
        return
        
    # 3. Load Aliases and Candidates for matching
    cur.execute('SELECT alias, "teacherId" FROM "TeacherAlias"')
    aliases = cur.fetchall()
    
    cur.execute('SELECT id, name FROM "TeacherAcademy"')
    teachers = {t["id"]: t["name"] for t in cur.fetchall()}
    
    cur.execute('SELECT "teacherId", SUM("expectedFee") as total_fee FROM "Candidate" WHERE "status" = %s GROUP BY "teacherId"', ('Active',))
    teacher_totals = cur.fetchall()
    
    cur.execute('SELECT "teacherId", "expectedFee", "firstName", "lastName" FROM "Candidate" WHERE "status" = %s', ('Active',))
    candidates = cur.fetchall()
    
    print(f"🔍 Reconciling {len(unreconciled)} transactions...")
    matched_count = 0
    remaining_after_pass1 = []

    # ---------------------------------------------------------
    # PASS 1: EXPLICIT ALIAS MATCH (Highest Priority)
    # ---------------------------------------------------------
    for tx in unreconciled:
        narration = re.sub(r"\s+", " ", tx["narration"].upper())
        narration_nospace = re.sub(r"[^A-Z0-9]", "", narration)
        narration_letters = re.sub(r"[^A-Z]", "", narration)
        
        hit_teacher_id = None
        for al in aliases:
            pat = al["alias"].upper()
            pat_nospace = re.sub(r"[^A-Z0-9]", "", pat)
            pat_letters = re.sub(r"[^A-Z]", "", pat)

            if (pat in narration) or \
               (pat_nospace and len(pat_nospace) >= 4 and pat_nospace in narration_nospace) or \
               (pat_letters and len(pat_letters) >= 6 and pat_letters in narration_letters):
                hit_teacher_id = al["teacherId"]
                break

        if hit_teacher_id:
            cur.execute("""
                UPDATE "TempBankTransaction" 
                SET "mappedTeacherId" = %s, "matchMethod" = 'Pass 1: Alias', "updatedAt" = %s
                WHERE narration = %s
            """, (hit_teacher_id, datetime.now(), tx["narration"]))
            matched_count += 1
        else:
            remaining_after_pass1.append(tx)

    # ---------------------------------------------------------
    # PASS 2A: GROUPED PAYER SUM MATCH
    # ---------------------------------------------------------
    grouped_payers = {}
    for tx in remaining_after_pass1:
        key = extract_payer_key(tx["narration"])
        if key:
            grouped_payers.setdefault(key, []).append(tx)

    remaining_after_pass2a = []
    matched_in_pass2a = set()

    for p_key, tx_list in grouped_payers.items():
        if len(tx_list) > 1:
            total_grouped_amount = sum(t["amount"] for t in tx_list)
            hit_t_id = None
            for tt in teacher_totals:
                if abs(tt["total_fee"] - total_grouped_amount) < 1.0:
                    hit_t_id = tt["teacherId"]
                    break
            
            if hit_t_id:
                hit_m = f"Pass 2: Grouped Payer Sum Match ({p_key} - ₹{total_grouped_amount})"
                for t_item in tx_list:
                    matched_in_pass2a.add(t_item["id"])
                    cur.execute("""
                        UPDATE "TempBankTransaction" 
                        SET "mappedTeacherId" = %s, "matchMethod" = %s, "updatedAt" = %s
                        WHERE narration = %s
                    """, (hit_t_id, hit_m, datetime.now(), t_item["narration"]))
                matched_count += len(tx_list)

    for tx in remaining_after_pass1:
        if tx["id"] not in matched_in_pass2a:
            remaining_after_pass2a.append(tx)

    # ---------------------------------------------------------
    # PASS 2 & 3: EXACT AMOUNT / MULTI-TOKEN MATCH
    # ---------------------------------------------------------
    for tx in remaining_after_pass2a:
        narration = re.sub(r"\s+", " ", tx["narration"].upper())
        narration_nospace = re.sub(r"[^A-Z0-9]", "", narration)
        narration_letters = re.sub(r"[^A-Z]", "", narration)
        amount = tx["amount"]
        
        hit_teacher_id = None
        hit_method = None
        
        # Pass 2: Exact Grouped Total Amount Match
        for tt in teacher_totals:
            if abs(tt["total_fee"] - amount) < 1.0:
                t_name = teachers.get(tt["teacherId"], "")
                teacher_name_letters = re.sub(r"[^A-Z]", "", t_name.upper())
                if len(teacher_name_letters) >= 4 and teacher_name_letters in narration_nospace:
                    hit_teacher_id = tt["teacherId"]
                    hit_method = "Pass 2: Dynamic Amount+Name Match"
                    break

        # Pass 3: Candidate Name + Fee Amount / Multi-Token Match
        if not hit_teacher_id:
            for cand in candidates:
                cand_fee = cand["expectedFee"]
                c_first = cand["firstName"] or ""
                c_last = cand["lastName"] or ""
                c_full = f"{c_first} {c_last}".strip()

                if "NAVNEETH" in c_full.upper() or "NAVANEETH" in c_full.upper():
                    if cand["teacherId"] and cand["teacherId"] in teachers:
                        c_full = teachers[cand["teacherId"]]
                
                # A. Exact Fee Match + Name Token
                if abs(cand_fee - amount) < 1.0 and cand["teacherId"]:
                    tokens = [c_full, c_first, c_last]
                    tokens.extend(c_full.upper().split())
                    
                    for tok in set(tokens):
                        tok_letters = re.sub(r"[^A-Z]", "", tok.upper())
                        if tok_letters and len(tok_letters) >= 4 and tok_letters in narration_letters:
                            hit_teacher_id = cand["teacherId"]
                            hit_method = f"Pass 3: Candidate Match ({c_first} {c_last} - ₹{cand_fee})"
                            break

                # B. Multi-Token Candidate Name Match
                if not hit_teacher_id and cand["teacherId"]:
                    name_words = list(set([w for w in c_full.upper().split() if len(w) >= 3]))
                    matched_words = []
                    for w in name_words:
                        w_clean = re.sub(r"[^A-Z]", "", w)
                        if w_clean in narration_letters:
                            matched_words.append(w_clean)
                        elif len(w_clean) >= 5 and w_clean[:5] in narration_letters:
                            matched_words.append(w_clean)

                    if len(matched_words) >= 2 or (len(name_words) == 1 and len(matched_words) == 1 and len(matched_words[0]) >= 5):
                        hit_teacher_id = cand["teacherId"]
                        hit_method = f"Pass 3: Truncated Candidate Name Match ({c_first} {c_last})"
                        break

                if hit_teacher_id:
                    break

        if hit_teacher_id:
            cur.execute("""
                UPDATE "TempBankTransaction" 
                SET "mappedTeacherId" = %s, "matchMethod" = %s, "updatedAt" = %s
                WHERE narration = %s
            """, (hit_teacher_id, hit_method, datetime.now(), tx["narration"]))
            
            matched_count += 1

    conn.commit()
    print(f"🎉 Reconciled {matched_count} transactions out of {len(unreconciled)}!")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Reconcile bank statements into PostgreSQL")
    parser.add_argument("--pdf", nargs="*", help="PDF file paths to reconcile")
    args = parser.parse_args()
    
    reconcile_transactions(pdf_paths=args.pdf)
