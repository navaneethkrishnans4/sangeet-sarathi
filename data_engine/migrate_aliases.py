import os
import csv
import psycopg2
from dotenv import load_dotenv
import uuid

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
DB_URL = os.environ.get("DATABASE_URL", "").replace("?pgbouncer=true", "")

BASE_DIR = os.path.dirname(__file__)
ALIASES_CSV = os.path.join(BASE_DIR, '..', '..', 'App and Scripts', 'bank_aliases.csv')

def migrate_aliases():
    print("🔌 Connecting to DB...")
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()
    
    total = 0

    # 1. Generate default alias rules for all TeacherAcademy entities (teacherName, schoolName, name)
    cur.execute('SELECT id, name, "teacherName", "schoolName" FROM "TeacherAcademy"')
    teachers = cur.fetchall()
    
    for t_id, name, teacher_name, school_name in teachers:
        names_to_add = [name, teacher_name, school_name]
        for n in names_to_add:
            if n and len(n.strip()) >= 3:
                pat = n.strip().upper()
                cur.execute('SELECT id FROM "TeacherAlias" WHERE alias = %s', (pat,))
                if not cur.fetchone():
                    cur.execute("""
                        INSERT INTO "TeacherAlias" (id, alias, "teacherId")
                        VALUES (%s, %s, %s)
                    """, (str(uuid.uuid4()), pat, t_id))
                    total += 1

    # 2. Migrate rules from bank_aliases.csv
    if os.path.exists(ALIASES_CSV):
        with open(ALIASES_CSV, newline='', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                pattern = row.get("Bank_Transaction_Pattern", "").strip().upper()
                teacher = row.get("Teacher_Name", "").strip()
                school = row.get("School_Name", "").strip()
                
                search_names = [teacher, school]
                teacher_id = None

                for sname in search_names:
                    if not sname: continue
                    cur.execute('''
                        SELECT id FROM "TeacherAcademy" 
                        WHERE LOWER(name) = LOWER(%s) OR LOWER("teacherName") = LOWER(%s) OR LOWER("schoolName") = LOWER(%s)
                    ''', (sname, sname, sname))
                    res = cur.fetchone()
                    if res:
                        teacher_id = res[0]
                        break
                        
                if teacher_id and pattern and len(pattern) >= 3:
                    cur.execute('SELECT id FROM "TeacherAlias" WHERE alias = %s', (pattern,))
                    if not cur.fetchone():
                        cur.execute("""
                            INSERT INTO "TeacherAlias" (id, alias, "teacherId")
                            VALUES (%s, %s, %s)
                        """, (str(uuid.uuid4()), pattern, teacher_id))
                        total += 1
                        
    conn.commit()
    conn.close()
    print(f"✅ Migrated & generated {total} alias patterns in PostgreSQL!")
    
if __name__ == "__main__":
    migrate_aliases()
