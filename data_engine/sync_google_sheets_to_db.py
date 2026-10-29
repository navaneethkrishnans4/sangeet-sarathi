import os
import json
import hashlib
import uuid
from datetime import datetime
import gspread
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Load database URL from .env in the parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
DB_URL = os.environ.get("DATABASE_URL", "").replace("?pgbouncer=true", "")

BASE_DIR = os.path.dirname(__file__)
CREDS_PATH = os.path.join(BASE_DIR, 'credentials.json')
if not os.path.exists(CREDS_PATH):
    CREDS_PATH = os.path.join(BASE_DIR, 'trinity-503109-765805d01c09.json')

GENERIC_EMAILS = ["trinitykochi.ops.office@gmail.com"]

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

def sync_data(session_month="September"):
    print("🔌 Connecting to PostgreSQL...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    print("🔑 Authenticating with Google Sheets...")
    gc = gspread.service_account(filename=CREDS_PATH)

    sheets = [
        ('1o-c-nrvq-LoQYyvAmGBgxsNQ6X9hll52LC-APwYxcqE', 'Classical & Jazz'),
        ('1ee7cgY_YJjgTpMPtH7pQtVVDN1JWAjGlcONtqwae1VA', 'Rock & Pop')
    ]

    total_upserted = 0

    for sheet_id, exam_type in sheets:
        print(f"📄 Reading {exam_type} Enrolment Sheet...")
        try:
            ws = gc.open_by_key(sheet_id).worksheet('Enrolment Sheet')
            rows = ws.get_all_values()
            
            # Start from row 7 (index 6)
            for r in rows[6:]:
                r += [''] * (40 - len(r))
                first_name = r[1].strip()
                last_name = r[3].strip()
                
                if not first_name:
                    continue

                sub_email = r[5].strip()
                instrument = r[15].strip()
                grade = r[14].strip()
                
                cand_email = r[20].strip()
                applicant = r[25].strip()
                school = r[27].strip()
                submitter = f"{r[18].strip()} {r[19].strip()}".strip()
                
                fee_val = r[37].strip().replace(',', '')
                try:
                    expected_fee = float(fee_val) if fee_val else 0.0
                except ValueError:
                    expected_fee = 0.0

                # 1. Resolve Teacher
                teacher_key, _ = get_teacher_key_and_name(applicant, submitter, school, sub_email, cand_email)
                
                # Figure out the best display name
                actual_name = applicant if (applicant and applicant.lower() != "none") else submitter
                if not actual_name or actual_name.lower() == "none":
                    actual_name = school if (school and school.lower() != "none") else "Unknown"
                
                # Upsert TeacherAcademy
                teacher_id = str(uuid.uuid5(uuid.NAMESPACE_OID, teacher_key))
                
                # If sub_email is missing, we DO NOT pollute the primary_email with cand_email
                true_primary_email = sub_email if sub_email and sub_email.lower() != "none" else None
                
                cur.execute("""
                    INSERT INTO "TeacherAcademy" (id, "uniqueKey", name, "teacherName", "schoolName", primary_email, "createdAt", "updatedAt")
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT ("uniqueKey") DO UPDATE 
                    SET name = EXCLUDED.name,
                        "teacherName" = EXCLUDED."teacherName",
                        "schoolName" = EXCLUDED."schoolName",
                        primary_email = EXCLUDED.primary_email,
                        "updatedAt" = EXCLUDED."updatedAt"
                    RETURNING id
                """, (teacher_id, teacher_key, actual_name, submitter if submitter and submitter.lower() != "none" else None, school if school and school.lower() != "none" else None, true_primary_email, datetime.now(), datetime.now()))
                
                resolved_teacher_id = cur.fetchone()[0]

                # 2. Upsert Candidate
                # Create a deterministic ID for the candidate
                cand_hash_str = f"{first_name}-{last_name}-{exam_type}-{grade}-{instrument}".lower()
                cand_id = str(uuid.uuid5(uuid.NAMESPACE_OID, cand_hash_str))

                # Check if exists for audit log
                cur.execute('SELECT "expectedFee", "teacherId" FROM "Candidate" WHERE id = %s', (cand_id,))
                existing_cand = cur.fetchone()

                if not existing_cand:
                    cur.execute("""
                        INSERT INTO "Candidate" (id, "firstName", "lastName", "examType", grade, instrument, "expectedFee", "teacherId", "sessionMonth", "createdAt", "updatedAt")
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (cand_id, first_name, last_name, exam_type, grade, instrument, expected_fee, resolved_teacher_id, session_month, datetime.now(), datetime.now()))
                    log_audit(cur, "INSERT", "Candidate", cand_id, None, f"Fee: {expected_fee}, Teacher: {resolved_teacher_id}, Month: {session_month}", f"Inserted Candidate {first_name} {last_name}")
                else:
                    cur.execute("""
                        UPDATE "Candidate" 
                        SET "firstName" = %s, "lastName" = %s, "expectedFee" = %s, "teacherId" = %s, 
                            "sessionMonth" = COALESCE("sessionMonth", %s), "updatedAt" = %s
                        WHERE id = %s
                    """, (first_name, last_name, expected_fee, resolved_teacher_id, session_month, datetime.now(), cand_id))
                    
                    if float(existing_cand[0]) != expected_fee or existing_cand[1] != resolved_teacher_id:
                        log_audit(cur, "UPDATE", "Candidate", cand_id, f"Fee: {existing_cand[0]}, Teacher: {existing_cand[1]}", f"Fee: {expected_fee}, Teacher: {resolved_teacher_id}", f"Updated Candidate {first_name} {last_name}")

                total_upserted += 1

        except Exception as e:
            print(f"❌ Error processing {exam_type}: {e}")
            conn.rollback()
            raise e

    conn.commit()
    print(f"✅ Successfully synced {total_upserted} candidates into PostgreSQL (Target Session Month: {session_month})!")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Sync Google Sheets candidate data into PostgreSQL")
    parser.add_argument("--session-month", "-m", default="September", help="Target session month for newly inserted candidates (defaults to September)")
    args = parser.parse_args()
    sync_data(session_month=args.session_month)

