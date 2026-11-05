import os
import sys
import uuid
import shutil
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch
from datetime import datetime
from dotenv import load_dotenv

# Ensure root workspace directory is in python path
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from data_engine.bank_parsers import extract_deposits
from data_engine.filters import evaluate_transaction_type, is_cash_deposit
from data_engine.reconciliation import ReconciliationMatcher

load_dotenv(ROOT_DIR / ".env")
DB_URL = os.environ.get("DATABASE_URL", "").replace("?pgbouncer=true", "")

BASE_DIR = Path(os.path.dirname(__file__))
STATEMENT_DIR = BASE_DIR.parent.parent / "App and Scripts" / "Bank Statement"
ARCHIVE_DIR = STATEMENT_DIR / "Archive"
ARCHIVE_DIR.mkdir(exist_ok=True)

MIN_DEPOSIT = 0.0

def load_new_pdfs(cur, pdf_paths=None, dry_run=False):
    """
    Extracts credit deposits from bank statement PDFs, filters out shop/non-exam
    transactions, and loads potential Trinity deposits into TempBankTransaction.
    """
    if pdf_paths:
        new_pdfs = [Path(p) for p in pdf_paths if Path(p).exists()]
    else:
        new_pdfs = [f for f in STATEMENT_DIR.glob("*.pdf") if f.is_file()]
        
    print(f"📂 Found {len(new_pdfs)} PDF(s) to process.")
    if not new_pdfs:
        return 0

    # 1. Fetch existing transactions into memory for fast deduplication
    cur.execute('SELECT "transactionDate", amount, LEFT(narration, 80) as prefix FROM "BankTransaction"')
    existing_main = set((r["transactionDate"].date() if hasattr(r["transactionDate"], "date") else r["transactionDate"], 
                         round(float(r["amount"]), 2), r["prefix"]) for r in cur.fetchall())

    cur.execute('SELECT "transactionDate", amount, LEFT(narration, 80) as prefix FROM "TempBankTransaction"')
    existing_temp = set((r["transactionDate"].date() if hasattr(r["transactionDate"], "date") else r["transactionDate"], 
                         round(float(r["amount"]), 2), r["prefix"]) for r in cur.fetchall())

    total_inserted = 0
    total_shop_excluded = 0
    total_shop_amount = 0.0

    for pdf_path in sorted(new_pdfs):
        print(f"  🔍 Extracting deposits from {pdf_path.name}...")
        txs, bank_type = extract_deposits(pdf_path)
        print(f"     Detected Bank: {bank_type} | Total Credits: {len(txs)}")

        records_to_insert = []
        for tx in txs:
            # Evaluate against shop filter (Paytm QR settlements, POS settlements, small purchases)
            is_shop, reason = evaluate_transaction_type(tx)
            if is_shop:
                total_shop_excluded += 1
                total_shop_amount += tx["amount"]
                continue

            if tx["amount"] < MIN_DEPOSIT and not is_cash_deposit(tx["narration"]):
                continue

            tx_date_key = tx["date"].date() if hasattr(tx["date"], "date") else tx["date"]
            prefix = tx["narration"][:80]
            lookup_key = (tx_date_key, round(float(tx["amount"]), 2), prefix)

            if lookup_key not in existing_main and lookup_key not in existing_temp:
                records_to_insert.append((
                    str(uuid.uuid4()),
                    tx["date"],
                    tx["narration"],
                    tx["amount"],
                    tx.get("session_month"),
                    datetime.now(),
                    datetime.now()
                ))
                existing_temp.add(lookup_key)

        if not dry_run and records_to_insert:
            execute_batch(cur, """
                INSERT INTO "TempBankTransaction" 
                (id, "transactionDate", narration, amount, "sessionMonth", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, records_to_insert)

        total_inserted += len(records_to_insert)
        print(f"     ✅ Staged {len(records_to_insert)} new candidate deposits into TempBankTransaction.")

        if not pdf_paths and not dry_run:
            shutil.move(str(pdf_path), str(ARCHIVE_DIR / pdf_path.name))
            print(f"     📦 Archived {pdf_path.name}")

    if total_shop_excluded > 0:
        print(f"  🛡️ Excluded {total_shop_excluded} shop / POS / non-Trinity transactions (Total: ₹{total_shop_amount:,.2f}).")

    return total_inserted

def reconcile_transactions(pdf_paths=None, dry_run=False):
    """
    Orchestrates statement ingestion and multi-pass reconciliation.
    """
    print("🔌 Connecting to PostgreSQL Engine...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # 1. Load PDFs into staging area (TempBankTransaction)
        new_count = load_new_pdfs(cur, pdf_paths=pdf_paths, dry_run=dry_run)
        if not dry_run:
            conn.commit()
            print(f"✅ Committed {new_count} new deposits into TempBankTransaction.")
        else:
            print(f"🧪 [DRY RUN] Identified {new_count} deposits for staging.")

        # 2. Fetch all Unreconciled Transactions from Temp Workspace
        cur.execute('SELECT * FROM "TempBankTransaction" WHERE "mappedTeacherId" IS NULL')
        unreconciled = cur.fetchall()
        if not unreconciled:
            print("✅ All workspace transactions are already reconciled!")
            return

        # 3. Load Aliases, Teachers, and Candidates from DB
        cur.execute('SELECT alias, "teacherId" FROM "TeacherAlias"')
        aliases = cur.fetchall()

        cur.execute('SELECT id, name, "teacherName", "schoolName" FROM "TeacherAcademy"')
        teachers = {t["id"]: t for t in cur.fetchall()}

        cur.execute('SELECT "teacherId", SUM("expectedFee") as total_fee FROM "Candidate" WHERE "status" = %s GROUP BY "teacherId"', ('Active',))
        teacher_totals = cur.fetchall()

        cur.execute('SELECT "id", "teacherId", "expectedFee", "firstName", "lastName" FROM "Candidate" WHERE "status" = %s', ('Active',))
        candidates = cur.fetchall()

        print(f"🔍 Reconciling {len(unreconciled)} transactions in workspace...")

        # 4. Run Multi-Pass Matcher
        matcher = ReconciliationMatcher(aliases, teachers, candidates, teacher_totals)
        matched_results = matcher.match_batch(unreconciled)

        updates = []
        matched_count = 0
        cash_count = 0

        for r in matched_results:
            tid = r.get("mappedTeacherId")
            method = r.get("matchMethod", "Unassigned")
            tx_id = r["id"]

            if tid:
                matched_count += 1
                updates.append((tid, method, datetime.now(), tx_id))
            elif is_cash_deposit(r["narration"]):
                cash_count += 1
                updates.append((None, method, datetime.now(), tx_id))
            else:
                updates.append((None, method, datetime.now(), tx_id))

        if not dry_run and updates:
            execute_batch(cur, """
                UPDATE "TempBankTransaction"
                SET "mappedTeacherId" = %s, "matchMethod" = %s, "updatedAt" = %s
                WHERE id = %s
            """, updates)
            conn.commit()

        print(f"🎉 Reconciled {matched_count} transactions out of {len(unreconciled)}!")
        print(f"   - High-confidence Matched: {matched_count}")
        print(f"   - Cash Deposits (Held Unassigned for verification): {cash_count}")
        print(f"   - Remaining Unassigned (For manual review): {len(unreconciled) - matched_count}")

    except Exception as e:
        conn.rollback()
        print(f"❌ Error during reconciliation: {e}")
        raise e
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Reconcile bank statements into PostgreSQL")
    parser.add_argument("--pdf", nargs="*", help="PDF file paths to reconcile")
    parser.add_argument("--dry-run", action="store_true", help="Run extraction and matching without saving changes to DB")
    args = parser.parse_args()

    reconcile_transactions(pdf_paths=args.pdf, dry_run=args.dry_run)
