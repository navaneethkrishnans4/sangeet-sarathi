import os
import sys
import re
import uuid
import json
import argparse
from datetime import datetime
import openpyxl
import psycopg2
from dotenv import load_dotenv

# Load database URL from .env in project root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
DB_URL = os.environ.get("DATABASE_URL", "").replace("?pgbouncer=true", "")

GENERIC_EMAILS = ["trinitykochi.ops.office@gmail.com"]

# Known order to month mapping from Trinity Portal & verified submissions
KNOWN_ORDER_MAP = {
    "1-16343716094": {"month": "June", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-16381507605": {"month": "June", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-16343961733": {"month": "June", "suite": "Rock & Pop", "mode": "Digital"},
    "1-17345815801": {"month": "May", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-17521069159": {"month": "June", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-17588720391": {"month": "June", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-17588976451": {"month": "June", "suite": "Rock & Pop", "mode": "Digital"},
    "1-17602079711": {"month": "June", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-18495692371": {"month": "July", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-18495692380": {"month": "July", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-18495692388": {"month": "August", "suite": "Rock & Pop", "mode": "Digital"},
    "1-18669269617": {"month": "August", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-18851102591": {"month": "October", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-18851102603": {"month": "October", "suite": "Rock & Pop", "mode": "Digital"},
    "1-19036924829": {"month": "October", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-19036924837": {"month": "October", "suite": "Rock & Pop", "mode": "Digital"},
    "1-19047594947": {"month": "October", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-19036924639": {"month": "November", "suite": "Classical & Jazz", "mode": "Default"},
    "1-19471072401": {"month": "November", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-19471072423": {"month": "November", "suite": "Rock & Pop", "mode": "Digital"},
    "1-19680778741": {"month": "November", "suite": "Classical & Jazz", "mode": "Digital"},
    "1-19680778750": {"month": "November", "suite": "Rock & Pop", "mode": "Digital"},
}

MONTH_NAMES = {
    "jan": "January", "january": "January",
    "feb": "February", "february": "February",
    "mar": "March", "march": "March",
    "apr": "April", "april": "April",
    "may": "May",
    "jun": "June", "june": "June",
    "jul": "July", "july": "July",
    "aug": "August", "august": "August",
    "sep": "September", "september": "September",
    "oct": "October", "october": "October",
    "nov": "November", "november": "November",
    "dec": "December", "december": "December"
}

def get_teacher_key_and_name(applicant, submitter, school, sub_email, cand_email):
    """Determine the logical entity (teacher or academy) to group by."""
    if sub_email and sub_email.lower() != "none" and sub_email.lower() not in GENERIC_EMAILS:
        return f"EMAIL:{sub_email.lower()}", sub_email.lower()
    elif cand_email and cand_email.lower() != "none" and cand_email.lower() not in GENERIC_EMAILS:
        return f"EMAIL:{cand_email.lower()}", cand_email.lower()
    elif school and school.lower() != "none":
        return f"SCHOOL:{school.lower()}", school
    else:
        name = applicant if (applicant and applicant.lower() != "none") else submitter
        if not name or name.lower() == "none":
            name = "Unknown"
        return f"NAME:{name.lower()}", name

def log_audit(cur, action, table_name, record_id, old_val, new_val, desc):
    """Write an audit log to PostgreSQL."""
    audit_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO "AuditLog" (id, action, "tableName", "recordId", "oldValue", "newValue", description, "createdAt")
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (audit_id, action, table_name, record_id, old_val, new_val, desc, datetime.now()))

def detect_month_from_context(ws, row_idx, default_month="November"):
    """Detect month from date cells or text around an order row."""
    # Check current row, previous row, and next row
    for r in range(max(1, row_idx - 2), min(row_idx + 3, ws.max_row + 1)):
        for c in range(1, 40):
            val = ws.cell(r, c).value
            if isinstance(val, datetime):
                return val.strftime("%B")
            if isinstance(val, str):
                s = val.strip().lower()
                for key, full_m in MONTH_NAMES.items():
                    if re.search(r"\b" + key + r"\b", s):
                        return full_m
    return default_month

def process_file(filepath, exam_suite_override=None, default_month="November", dry_run=False):
    if not os.path.exists(filepath):
        return {"success": False, "error": f"File not found: {filepath}"}

    print(f"📄 Processing file: {filepath}...")
    wb = openpyxl.load_workbook(filepath, data_only=True)
    
    # Locate Enrolment Sheet
    sheet_name = "Enrolment Sheet" if "Enrolment Sheet" in wb.sheetnames else wb.sheetnames[0]
    ws = wb[sheet_name]

    # Detect suite from sheet title or filename if not provided
    inferred_suite = exam_suite_override
    if not inferred_suite:
        content_peek = " ".join([str(ws.cell(r, c).value or "") for r in range(1, 10) for c in range(1, 20)])
        if "rock and pop" in content_peek.lower() or "rock" in filepath.lower():
            inferred_suite = "Rock & Pop"
        else:
            inferred_suite = "Classical & Jazz"

    print(f"🎵 Detected Exam Suite: {inferred_suite}")

    # 1. Identify all order sections
    sections = []
    for r in range(1, ws.max_row + 1):
        for c in range(1, 40):
            val = str(ws.cell(r, c).value or "").strip()
            if "1-" in val and len(val) >= 10:
                m = re.search(r"1-\d{10,12}", val)
                if m and ("order" in val.lower() or r in [5, 49, 74, 90, 132, 173, 204, 260, 298, 335]):
                    order_no = m.group(0)
                    # Deduce month
                    if order_no in KNOWN_ORDER_MAP:
                        month = KNOWN_ORDER_MAP[order_no]["month"]
                    else:
                        month = detect_month_from_context(ws, r, default_month)
                    sections.append((r, order_no, month))
                    break

    if not sections:
        # Fallback if no order headers found
        sections.append((1, "UNKNOWN-ORDER", default_month))

    print(f"📋 Found {len(sections)} Order Section(s):")
    for s in sections:
        print(f"   - Order {s[1]} (Month: {s[2]}) starting at row {s[0]}")

    # Connect to DB
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    stats = {
        "suite": inferred_suite,
        "totalRowsChecked": 0,
        "newCandidatesEnrolled": 0,
        "existingUpdated": 0,
        "ordersCreatedOrLinked": set(),
        "teachersCreatedOrLinked": set(),
        "totalFeeAmount": 0.0,
        "candidates": []
    }

    try:
        for idx, (section_start, order_no, section_month) in enumerate(sections):
            section_end = sections[idx + 1][0] if idx + 1 < len(sections) else ws.max_row + 1
            
            # Resolve/Upsert OrderNumber
            cur.execute('SELECT id FROM "OrderNumber" WHERE "orderNumber" = %s', (order_no,))
            order_row = cur.fetchone()
            if order_row:
                order_db_id = order_row[0]
            else:
                order_db_id = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO "OrderNumber" (id, "orderNumber", "centerNumber", "examType", "examMode", "createdAt")
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (order_db_id, order_no, "4048", inferred_suite, "Digital", datetime.now()))
                log_audit(cur, "INSERT", "OrderNumber", order_db_id, None, order_no, f"Created OrderNumber {order_no}")

            stats["ordersCreatedOrLinked"].add(order_no)

            # Process candidates in this section
            for r in range(section_start + 1, section_end):
                first_name = str(ws.cell(r, 2).value or "").strip()
                last_name = str(ws.cell(r, 4).value or "").strip()
                grade = str(ws.cell(r, 15).value or "").strip()
                instrument = str(ws.cell(r, 16).value or "").strip()

                if not first_name or first_name in ["#", "First Name", "Leave Blank"] or first_name.startswith("Order") or not grade:
                    continue

                stats["totalRowsChecked"] += 1

                sub_email = str(ws.cell(r, 21).value or ws.cell(r, 6).value or "").strip()
                cand_email = str(ws.cell(r, 6).value or "").strip()
                applicant = str(ws.cell(r, 26).value or "").strip()
                school = str(ws.cell(r, 28).value or "").strip()
                submitter_fn = str(ws.cell(r, 19).value or "").strip()
                submitter_ln = str(ws.cell(r, 20).value or "").strip()
                submitter = f"{submitter_fn} {submitter_ln}".strip()

                # Fee from Col 38 (AL) or last column
                raw_fee = ws.cell(r, 38).value
                if raw_fee is None:
                    # check if Col 37 or 39 has numeric fee
                    for fc in [39, 37]:
                        if isinstance(ws.cell(r, fc).value, (int, float)):
                            raw_fee = ws.cell(r, fc).value
                            break
                try:
                    expected_fee = float(str(raw_fee).replace(",", "")) if raw_fee is not None else 0.0
                except:
                    expected_fee = 0.0

                stats["totalFeeAmount"] += expected_fee

                # 1. Resolve TeacherAcademy
                teacher_key, _ = get_teacher_key_and_name(applicant, submitter, school, sub_email, cand_email)
                actual_name = applicant if (applicant and applicant.lower() != "none") else submitter
                if not actual_name or actual_name.lower() == "none":
                    actual_name = school if (school and school.lower() != "none") else "Unknown"

                teacher_id = str(uuid.uuid5(uuid.NAMESPACE_OID, teacher_key.lower()))
                true_primary_email = sub_email if sub_email and sub_email.lower() != "none" else None

                # Find existing teacher by id, uniqueKey, or name
                cur.execute("""
                    SELECT id FROM "TeacherAcademy"
                    WHERE id = %s OR LOWER("uniqueKey") = LOWER(%s) OR LOWER(name) = LOWER(%s)
                    LIMIT 1
                """, (teacher_id, teacher_key, actual_name))
                t_row = cur.fetchone()

                if t_row:
                    resolved_teacher_id = t_row[0]
                    cur.execute("""
                        UPDATE "TeacherAcademy"
                        SET "teacherName" = COALESCE("teacherName", %s),
                            "schoolName" = COALESCE("schoolName", %s),
                            primary_email = COALESCE(primary_email, %s),
                            "updatedAt" = %s
                        WHERE id = %s
                    """, (submitter if submitter and submitter.lower() != "none" else None,
                          school if school and school.lower() != "none" else None,
                          true_primary_email, datetime.now(), resolved_teacher_id))
                else:
                    cur.execute("""
                        INSERT INTO "TeacherAcademy" (id, "uniqueKey", name, "teacherName", "schoolName", primary_email, "createdAt", "updatedAt")
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (teacher_id, teacher_key, actual_name, submitter if submitter and submitter.lower() != "none" else None, school if school and school.lower() != "none" else None, true_primary_email, datetime.now(), datetime.now()))
                    resolved_teacher_id = teacher_id

                stats["teachersCreatedOrLinked"].add(actual_name)

                # 2. Check Candidate
                cand_hash_str = f"{first_name}-{last_name}-{inferred_suite}-{grade}-{instrument}".lower()
                cand_id = str(uuid.uuid5(uuid.NAMESPACE_OID, cand_hash_str))

                cur.execute("""
                    SELECT id, "paymentStatus", "sessionMonth", "orderNumberId"
                    FROM "Candidate"
                    WHERE id = %s OR (LOWER("firstName") = LOWER(%s) AND LOWER("lastName") = LOWER(%s) AND LOWER(grade) = LOWER(%s) AND LOWER(instrument) = LOWER(%s))
                    LIMIT 1
                """, (cand_id, first_name, last_name, grade, instrument))
                existing_cand = cur.fetchone()

                if not existing_cand:
                    # NEW CANDIDATE -> INSERT INTO MULTIPLE TABLES
                    # Table 1: Candidate (paymentStatus = Reconciled since fee is paid)
                    cur.execute("""
                        INSERT INTO "Candidate" (
                            id, "firstName", "lastName", "examType", grade, instrument,
                            "expectedFee", "paymentStatus", status, "sessionMonth",
                            "teacherId", "orderNumberId", "createdAt", "updatedAt"
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        cand_id, first_name, last_name, inferred_suite, grade, instrument,
                        expected_fee, "Reconciled", "Active", section_month,
                        resolved_teacher_id, order_db_id, datetime.now(), datetime.now()
                    ))

                    # Table 2: BankTransaction (Auto-match since fee is confirmed paid)
                    narration_tag = f"Master Enrollment Paid: {first_name} {last_name} ({cand_id})".strip()
                    cur.execute("""
                        INSERT INTO "BankTransaction" (
                            id, "transactionDate", narration, amount, "reconciledMethod",
                            "reconciledTeacherId", status, "sessionMonth", "createdAt", "updatedAt"
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (narration) DO UPDATE
                        SET amount = EXCLUDED.amount,
                            "reconciledTeacherId" = EXCLUDED."reconciledTeacherId",
                            status = EXCLUDED.status,
                            "sessionMonth" = EXCLUDED."sessionMonth",
                            "updatedAt" = EXCLUDED."updatedAt"
                    """, (
                        str(uuid.uuid4()), datetime.now(), narration_tag, expected_fee,
                        "Master Enrollment Paid", resolved_teacher_id, "Matched", section_month,
                        datetime.now(), datetime.now()
                    ))

                    # Table 3: AuditLog
                    log_audit(cur, "INSERT", "Candidate", cand_id, None,
                              f"Order: {order_no}, Month: {section_month}, Fee: {expected_fee}, Paid: Reconciled",
                              f"Enrolled latest candidate {first_name} {last_name}")

                    stats["newCandidatesEnrolled"] += 1
                    stats["candidates"].append({
                        "name": f"{first_name} {last_name}",
                        "order": order_no,
                        "month": section_month,
                        "grade": grade,
                        "fee": expected_fee,
                        "status": "Newly Enrolled"
                    })
                else:
                    existing_cand_id = existing_cand[0]
                    # CANDIDATE ALREADY ENROLLED -> Update Order & Month & Paid status
                    cur.execute("""
                        UPDATE "Candidate"
                        SET "orderNumberId" = %s,
                            "sessionMonth" = %s,
                            "expectedFee" = %s,
                            "paymentStatus" = 'Reconciled',
                            "teacherId" = %s,
                            "updatedAt" = %s
                        WHERE id = %s
                    """, (order_db_id, section_month, expected_fee, resolved_teacher_id, datetime.now(), existing_cand_id))

                    # Ensure matching bank transaction is present
                    narration_tag = f"Master Enrollment Paid: {first_name} {last_name} ({existing_cand_id})".strip()
                    cur.execute("""
                        INSERT INTO "BankTransaction" (
                            id, "transactionDate", narration, amount, "reconciledMethod",
                            "reconciledTeacherId", status, "sessionMonth", "createdAt", "updatedAt"
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (narration) DO NOTHING
                    """, (
                        str(uuid.uuid4()), datetime.now(), narration_tag, expected_fee,
                        "Master Enrollment Paid", resolved_teacher_id, "Matched", section_month,
                        datetime.now(), datetime.now()
                    ))

                    stats["existingUpdated"] += 1
                    stats["candidates"].append({
                        "name": f"{first_name} {last_name}",
                        "order": order_no,
                        "month": section_month,
                        "grade": grade,
                        "fee": expected_fee,
                        "status": "Existing (Order & Month Synced)"
                    })

        if dry_run:
            conn.rollback()
            print("🔍 Dry Run completed. Rolled back all changes.")
        else:
            conn.commit()
            print("💾 Database transaction committed successfully!")

        stats["ordersCreatedOrLinked"] = list(stats["ordersCreatedOrLinked"])
        stats["teachersCreatedOrLinked"] = list(stats["teachersCreatedOrLinked"])
        stats["success"] = True
        return stats

    except Exception as e:
        conn.rollback()
        print(f"❌ Error during processing: {e}")
        return {"success": False, "error": str(e)}
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process and enroll master spreadsheet data into PostgreSQL")
    parser.add_argument("--file", "-f", required=True, help="Path to Master Enrolment Spreadsheet (.xlsx)")
    parser.add_argument("--suite", "-s", default=None, help="Exam suite ('Classical & Jazz' or 'Rock & Pop')")
    parser.add_argument("--month", "-m", default="November", help="Fallback session month")
    parser.add_argument("--dry-run", action="store_true", help="Preview without committing to DB")
    args = parser.parse_args()

    result = process_file(args.file, exam_suite_override=args.suite, default_month=args.month, dry_run=args.dry_run)
    print("\n--- Summary Result ---")
    print(f"Success: {result.get('success')}")
    print(f"Suite: {result.get('suite')}")
    print(f"Total Rows Checked: {result.get('totalRowsChecked')}")
    print(f"New Candidates Enrolled: {result.get('newCandidatesEnrolled')}")
    print(f"Existing Candidates Synced: {result.get('existingUpdated')}")
    print(f"Total Fee: ₹{result.get('totalFeeAmount', 0):,.0f}")
    print(f"Orders: {result.get('ordersCreatedOrLinked')}")
