#!/usr/bin/env python3
"""
convert_teacher_entries.py
===========================
Reads teacher/music-school "exam entry" Excel files from a folder, normalizes
the many spelling/format variations teachers use, and appends the converted
rows into the Master Mass Enrolment Spreadsheet — in the exact column layout
Trinity's Enrolment Sheet expects.

Designed to be run by an agent (e.g. Goose) on a schedule or on demand:
    python convert_teacher_entries.py --input-folder ./teacher_files --master-file ./Master.xlsx

Behaviour summary
-----------------
- Scans --input-folder for .xlsx files (skips ones already processed before,
  tracked in a small JSON state file next to the master).
- Detects each file's header row and maps its columns to canonical fields,
  regardless of exact column order/naming (templates differ school to school).
- Normalizes: exam suite, pathway, subject/instrument, grade, DOB, name
  splitting, submitter/applicant fields, and applies the fixed office
  defaults (Consent Received=Y, ID Document Type, Nationality, etc.).
- Cross-checks the built "Examination/Product Name" against the master's own
  "List of Examinations" sheet, so we never write a product name that
  doesn't actually exist as a valid Trinity product.
- Anything that can't be confidently resolved (unknown subject, unsupported
  exam suite such as Rock & Pop, missing DOB, ambiguous pathway, etc.) is
  NOT guessed — it's written to a "review_needed_<timestamp>.csv" report
  instead, with a clear reason, so a human makes the final call.
- Makes a timestamped backup of the master file before writing to it.

This script does not need internet access and only depends on openpyxl and
python-dateutil (both pure Python, install with pip if missing).
"""

import argparse
import csv
import json
import os
import re
import shutil
import sys
from datetime import datetime, date
from pathlib import Path

import gspread
import openpyxl
from openpyxl.utils import get_column_letter, column_index_from_string
from openpyxl.styles import PatternFill
import psycopg2
from dotenv import load_dotenv

# Load Postgres configuration
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
DB_URL = os.environ.get("DATABASE_URL", "").replace("?pgbouncer=true", "")

def get_teacher_profile_from_db(search_term):
    if not DB_URL or not search_term: return None
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        search_like = f"%{search_term}%"
        cur.execute('''
            SELECT "teacherName", "schoolName", primary_email 
            FROM "TeacherAcademy" 
            WHERE "teacherName" ILIKE %s OR "schoolName" ILIKE %s OR primary_email ILIKE %s
            LIMIT 1
        ''', (search_like, search_like, search_like))
        row = cur.fetchone()
        conn.close()
        if row:
            t_name = row[0] or ""
            fn, ln = split_name(t_name)
            return {
                "applicant": t_name,
                "submitter_first_name": fn,
                "submitter_last_name": ln,
                "school": row[1] or "",
                "submitter_email": row[2] or ""
            }
    except Exception as e:
        print(f"DB Lookup Error: {e}")
    return None

try:
    from dateutil import parser as dateparser
except ImportError:
    print("ERROR: python-dateutil is required. Install with:")
    print("  pip install python-dateutil --break-system-packages")
    sys.exit(1)


# ============================================================================
# CONFIG — tweak these as your process evolves
# ============================================================================

# Fixed office defaults applied to every successfully-converted record.
# These are NOT read from the teacher files — they reflect current office
# policy for this exam cycle. Change here if the policy changes.
DEFAULTS = {
    "submitter_same_as_candidate": "N",
    "applicant_same_as_candidate": "N",
    "consent_received": "Y",
    "school_on_cert": "Y",
    "id_document_type": "Government ID Card",
    "id_document_number": "XXXXXXXXXXX",
    "nationality": "India",
}



import csv

def load_csv_profiles():
    csv_path = Path(__file__).resolve().parent / "teacher_profiles.csv"
    sender_emails = {}
    known_academies = set()
    csv_profiles_by_email = {}
    csv_profiles_by_name = {}

    if csv_path.exists():
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                t_name = row.get("Teacher_Name", "").strip()
                email = row.get("Email", "").strip().lower()
                academy = row.get("Primary_Academy_Name", "").strip()
                aliases = row.get("WhatsApp_Aliases", "").strip()
                
                if academy:
                    known_academies.add(academy)
                
                prof = {
                    "applicant": t_name,
                    "submitter_first_name": t_name,
                    "submitter_last_name": "",
                    "submitter_email": email,
                    "school": academy
                }
                if email:
                    csv_profiles_by_email[email] = prof
                if t_name:
                    csv_profiles_by_name[t_name.lower()] = prof
                    
                if aliases:
                    for alias in aliases.split(';'):
                        alias = alias.strip().lower()
                        if alias:
                            sender_emails[alias] = email
                            csv_profiles_by_name[alias] = prof
                            
    return sender_emails, known_academies, csv_profiles_by_email, csv_profiles_by_name

SENDER_EMAILS, KNOWN_ACADEMIES, CSV_PROFILES_BY_EMAIL, CSV_PROFILES_BY_NAME = load_csv_profiles()

def load_teacher_profiles(*workbooks):
    profiles_by_email = {}
    profiles_by_name = {}
    
    col_sub_fn = column_index_from_string(MASTER_COLS['submitter_first_name'])
    col_sub_ln = column_index_from_string(MASTER_COLS['submitter_last_name'])
    col_sub_email = column_index_from_string(MASTER_COLS['submitter_email'])
    col_cand_email = column_index_from_string(MASTER_COLS['candidate_email'])
    col_app = column_index_from_string(MASTER_COLS['applicant'])
    col_school = column_index_from_string(MASTER_COLS['school'])

    for ws_values in workbooks:
        if not ws_values:
            continue
        for r, row in enumerate(ws_values):
            if r < MASTER_FIRST_DATA_ROW - 1:
                continue
            
            def get_val(col_idx):
                if col_idx - 1 < len(row):
                    return str(row[col_idx - 1] or "").strip()
                return ""

            email = get_val(col_sub_email).lower()
            cand_email = get_val(col_cand_email).lower()
            app = get_val(col_app)
            sub_fn = get_val(col_sub_fn)
            sub_ln = get_val(col_sub_ln)
            school = get_val(col_school)

            prof = {
                "applicant": app or f"{sub_fn} {sub_ln}".strip(),
                "submitter_first_name": sub_fn or app,
                "submitter_last_name": sub_ln,
                "submitter_email": email,
                "school": school,
            }
            
            # Skip if the submitter email is identical to the candidate email.
            # This indicates the previous entry lacked a submitter email and borrowed the candidate's email,
            # so we shouldn't permanently link this submitter name to this candidate's email!
            is_polluted = (email == cand_email)

            if email and not is_polluted and email not in profiles_by_email:
                profiles_by_email[email] = prof
            if app and app.lower() not in profiles_by_name and not is_polluted:
                profiles_by_name[app.lower()] = prof

    return profiles_by_email, profiles_by_name
# (Column letters as they exist in the current master template.)
MASTER_SHEET_NAME = "Enrolment Sheet"
MASTER_HEADER_ROW = 4
MASTER_FIRST_DATA_ROW = 7
LIST_OF_EXAMS_SHEET_NAME = "List of Examinations"

MASTER_COLS = {
    "first_name": "B",
    "middle_name": "C",
    "last_name": "D",
    "dob": "E",
    "candidate_email": "F",
    "gender": "J",
    "exam_suite": "N",
    "product_name": "O",
    "subject": "P",
    "product_code": "Q",
    "submitter_same_as_candidate": "R",
    "submitter_first_name": "S",
    "submitter_last_name": "T",
    "submitter_email": "U",
    "applicant_same_as_candidate": "Y",
    "applicant": "Z",
    "consent_received": "AA",
    "school": "AB",
    "school_on_cert": "AC",
    "id_document_type": "AI",
    "id_document_number": "AJ",
    "nationality": "AK",
    "fee": "AL",
}

FEE_STRUCTURE = {
    "IN": 5500,
    "1": 6050,
    "2": 6700,
    "3": 7700,
    "4": 8600,
    "5": 9700,
    "6": 11300,
    "7": 12200,
    "8": 13500
}
# Subject/instrument spelling & abbreviation normalization.
# Key = normalized (lowercased, punctuation/spaces stripped) teacher text.
# Value = the exact dropdown value used in the master.
SUBJECT_ALIASES = {
    "guitar": "Acoustic Guitar",
    "accguitar": "Acoustic Guitar",
    "acousticguitar": "Acoustic Guitar",
    "acuasticguitar": "Acoustic Guitar",
    "classicalguitar": "Classical Guitar",
    "plectrumguitar": "Acoustic Guitar",
    "ek": "Electronic Keyboard",
    "ekb": "Electronic Keyboard",
    "electronickeyboard": "Electronic Keyboard",
    "keyboard": "Electronic Keyboard",
    "electrickeyboard": "Electronic Keyboard",
    "keyboardelectronic": "Electronic Keyboard",
    "digitalkeyboard": "Digital Keyboard",
    "violin": "Violin",
    "piano": "Piano",
    "pno": "Piano",
    "singing": "Singing",
    "vocal": "Singing",
    "vocals": "Singing",
    "voice": "Singing",
    "drum": "Drum Kit",
    "drums": "Drum Kit",
    "drumkit": "Drum Kit",
    "drumset": "Drum Kit",
    "drumsset": "Drum Kit",
    "cello": "Cello",
    "flute": "Flute",
    "clarinet": "Clarinet",
    "saxophone": "Saxophone",
    "trumpet": "Trumpet",
    "trombone": "Trombone",
}

# Full valid subject list, pulled once at runtime from the master's Lookup
# sheet (see load_valid_subjects()) — used as a fallback fuzzy-match safety
# net for anything not already covered by SUBJECT_ALIASES above.

# Exam suite normalization — only suites we've actually confirmed a mapping
# for are listed. Anything else (e.g. Rock & Pop) is deliberately left
# unmapped and gets flagged for manual review, because the master's own
# "List of Examinations" sheet currently has no Rock & Pop product catalog.
EXAM_SUITE_ALIASES = {
    "classical": "Classical and Jazz (Digital)",
    "classicaljazz": "Classical and Jazz (Digital)",
    "classicalandjazz": "Classical and Jazz (Digital)",
}

STATE_FILENAME = ".processed_teacher_files.json"


# ============================================================================
# Header detection & column mapping for incoming teacher files
# ============================================================================

# (canonical_field, [substrings to match against a lowercased header cell])
# Checked in this order; each header column can only be claimed once, and
# more specific/combined patterns are listed before the generic ones they
# overlap with (e.g. "subject with grade" before plain "subject").
HEADER_PATTERNS = [
    ("subject_grade_combined", ["subject with grade"]),
    ("applicant_teacher_combined", ["applicant name / teacher name", "applicant name/teacher name",
                                     "applicant / teacher", "applicant name / submitter name",
                                     "applicant name/submitter name", "applicant / submitter"]),
    ("last_name", ["middle & last name", "middle and last name"]),
    ("first_name", ["first name"]),
    ("last_name", ["last name"]),
    ("dob", ["dob", "date of birth", "birth"]),
    ("gender", ["gender"]),
    ("submitter_email", ["submitter email"]),
    ("candidate_email", ["candidate email", "email address", "email"]),
    ("exam_suite", ["exam suite"]),
    ("pathway", ["technical pathway", "repertoire pathway", "pathway"]),
    ("subject", ["subject"]),
    ("grade", ["grade"]),
    ("applicant_name", ["applicant name"]),
    ("teacher_name", ["teacher name"]),
    ("school", ["school"]),
    ("mobile", ["mobile"]),
    ("amount", ["amount"]),
]


def clean_name(text):
    """Capitalize the first letter of each word and lowercase the rest, for all name-like fields."""
    if not text:
        return ""
    words = str(text).strip().split()
    capitalized = [w[0].upper() + w[1:].lower() if len(w) > 0 else w for w in words]
    return " ".join(capitalized)


def normalize_key(text):
    """Lowercase and strip everything except letters/digits, for fuzzy-safe matching."""
    return re.sub(r"[^a-z0-9]", "", str(text).lower())


class ListWrapper:
    """Wrapper to make a Google Sheet (list of lists) behave like an openpyxl worksheet."""
    def __init__(self, values):
        self.values = values
        self.max_row = len(values)
        self.max_column = max(len(row) for row in values) if values else 0

    def cell(self, row, column):
        r_idx = row - 1
        c_idx = column - 1
        val = None
        if 0 <= r_idx < len(self.values):
            r = self.values[r_idx]
            if 0 <= c_idx < len(r):
                val = r[c_idx]

        class CellObj:
            def __init__(self, value):
                self.value = value
        return CellObj(val)


def find_header_row(ws, max_scan_rows=10):
    """Find the row that contains 'First Name' as a header — that's our header row."""
    for r in range(1, max_scan_rows + 1):
        for c in range(1, ws.max_column + 1):
            v = ws.cell(row=r, column=c).value
            if v and "first name" in str(v).lower():
                return r
    return None


def map_headers(ws, header_row):
    """Map this file's actual columns to our canonical field names."""
    headers = {}
    for c in range(1, ws.max_column + 1):
        v = ws.cell(row=header_row, column=c).value
        if v is not None and str(v).strip() != "":
            headers[c] = re.sub(r"\s+", " ", str(v).strip().lower())

    mapping = {}
    claimed = set()
    for canonical, patterns in HEADER_PATTERNS:
        if canonical in mapping:
            continue  # already found (e.g. "last_name" via combined match)
        for c, htext in headers.items():
            if c in claimed:
                continue
            if any(p in htext for p in patterns):
                mapping[canonical] = c
                claimed.add(c)
                break
    return mapping


# ============================================================================
# Field-level parsing / normalization helpers
# ============================================================================

def parse_dob(value):
    """Return a datetime.date, or None if unparseable/blank."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    if not text:
        return None
    try:
        return dateparser.parse(text, dayfirst=True).date()
    except (ValueError, OverflowError):
        return None


def is_suspicious_name(full_name):
    """Detect if any word is repeated in the name, which might indicate a typo."""
    if not full_name:
        return False
    words = [w.lower() for w in str(full_name).strip().split()]
    return len(words) != len(set(words))


def split_name(full_name):
    """First token = first name, remainder = last name. Matches observed office convention."""
    if not full_name:
        return "", ""
    parts = str(full_name).strip().split(None, 1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


ORDINAL_GRADE_MAP = {
    "first": "1",
    "second": "2",
    "third": "3",
    "fourth": "4",
    "fifth": "5",
    "sixth": "6",
    "seventh": "7",
    "eighth": "8",
}


def extract_grade_code(text):
    """
    Pull a grade code ('IN' or a digit string like '4') out of free text like:
    'Grade 4', 'Grade - 4', 'G01', 'Initial', 'Grade Initial'.
    Returns (grade_code, remainder_text_with_grade_removed) or (None, original_text).
    """
    if not text:
        return None, text

    # "Initial" in any form -> IN
    m = re.search(r"\binitial\b", text, re.IGNORECASE)
    if m:
        remainder = (text[: m.start()] + text[m.end():]).strip(" -.")
        return "IN", remainder

    # Check written ordinal words (e.g. "first", "second", etc.)
    for word, code in ORDINAL_GRADE_MAP.items():
        m = re.search(r"\b" + word + r"\b", text, re.IGNORECASE)
        if m:
            remainder = (text[: m.start()] + text[m.end():]).strip(" -.")
            remainder = re.sub(r"\bgrade\s*s?\b", "", remainder, flags=re.IGNORECASE).strip(" -.")
            return code, remainder

    # "G01", "G1" style abbreviation
    m = re.search(r"\bG(\d{1,2})\b", text, re.IGNORECASE)
    if m:
        remainder = (text[: m.start()] + text[m.end():]).strip(" -.")
        return str(int(m.group(1))), remainder

    # "Grade 4", "Grade - 4", "Grade-4"
    m = re.search(r"\bgrade\b\s*-?\s*(\d{1,2})\b", text, re.IGNORECASE)
    if m:
        remainder = (text[: m.start()] + text[m.end():]).strip(" -.")
        return str(int(m.group(1))), remainder

    # bare number as last resort
    m = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\b", text)
    if m:
        remainder = (text[: m.start()] + text[m.end():]).strip(" -.")
        return str(int(m.group(1))), remainder

    return None, text


def normalize_subject(raw_text, valid_subjects):
    """
    Map free-text subject/instrument to the master's exact dropdown value.
    Returns (normalized_value_or_None, matched_how).
    """
    if not raw_text or not raw_text.strip():
        return None, "empty"

    # Strip common suite/pathway terms that teachers append by mistake
    cleaned = re.sub(
        r'\b(?:classical\s*&\s*jazz|classical\s*and\s*jazz|technical\s*pathway|repertoire\s*pathway|pathway|grade|grades|initial)\b',
        '',
        raw_text,
        flags=re.IGNORECASE
    )
    cleaned = cleaned.replace("-", "").strip()

    key = normalize_key(cleaned)
    if key in SUBJECT_ALIASES:
        return SUBJECT_ALIASES[key], "alias"

    # exact case-insensitive match against the real valid subject list
    for v in valid_subjects:
        if normalize_key(v) == key:
            return v, "exact"

    # fuzzy fallback
    import difflib
    close = difflib.get_close_matches(cleaned.strip(), valid_subjects, n=1, cutoff=0.72)
    if close:
        return close[0], "fuzzy"

    return None, "unresolved"


def normalize_exam_suite(raw_text):
    if not raw_text:
        return None
    key = normalize_key(raw_text)
    for alias_key, full_value in EXAM_SUITE_ALIASES.items():
        if alias_key in key:
            return full_value
    return None  # e.g. Rock & Pop, or anything unrecognized


def extract_pathway(*texts):
    """Search one or more free-text cells for 'Technical' or 'Repertoire'."""
    combined = " ".join(t for t in texts if t).lower()
    if "repertoire" in combined:
        return "Repertoire"
    if "technical" in combined:
        return "Technical"
    return None


def load_valid_subjects(sheet_values):
    subjects = []
    for r, row in enumerate(sheet_values):
        if r < 1: continue # Skip header
        if row and len(row) > 0 and row[0]:
            subjects.append(str(row[0]).strip())
    return subjects


def load_examination_catalog(sheet_values):
    """
    Returns dict: (exam_suite_full, product_name_normalized) -> (product_name_exact, product_code)
    """
    catalog = {}
    for r, row in enumerate(sheet_values):
        if r < 1: continue # Skip header
        if len(row) >= 3:
            suite = row[0]
            name = row[1]
            code = row[2]
            if suite and name:
                catalog[(str(suite).strip(), normalize_key(name))] = (str(name).strip(), str(code).strip())
    return catalog


def build_product_name_key(pathway, subject_norm, grade_code):
    # Trinity uses "Singing Technical Grade X" only for grades 6-8. 
    # For Initial to 5, it groups it under "Classical and Jazz Technical Grade X".
    if subject_norm == "Singing" and str(grade_code).upper() in ["6", "7", "8"]:
        prefix = "Singing"
    else:
        prefix = "Classical and Jazz"
        
    return f"{prefix} {pathway} Grade {grade_code} (Digital)"


ROCK_POP_SUBJECTS = ["Bass", "Drums", "Guitar", "Keyboards", "Vocals"]


def normalize_rock_pop_subject(raw_text):
    """
    Normalizes a Rock & Pop subject/instrument to the exact dropdown values.
    """
    if not raw_text:
        return None
    key = normalize_key(raw_text)

    # Check common aliases/typos for Rock & Pop instruments
    if "vocals" in key or "vocal" in key or "singing" in key:
        return "Vocals"
    if "keyboards" in key or "keyboard" in key or "ekb" in key:
        return "Keyboards"
    if "guitar" in key:
        return "Guitar"
    if "drums" in key or "drum" in key:
        return "Drums"
    if "bass" in key:
        return "Bass"

    # Exact match against the five valid lookup options
    for s in ROCK_POP_SUBJECTS:
        if normalize_key(s) == key:
            return s

    # Fuzzy match fallback
    import difflib
    close = difflib.get_close_matches(raw_text.strip(), ROCK_POP_SUBJECTS, n=1, cutoff=0.72)
    if close:
        return close[0]

    return None


def build_rock_pop_product_name_key(grade_code):
    if grade_code == "IN":
        return "Rock and Pop Initial (Digital)"
    elif grade_code in ("ATCL", "LTCL", "FTCL"):
        return f"Rock and Pop {grade_code} Performance (Digital)"
    else:
        return f"Rock and Pop Grade {grade_code} (Digital)"


# ============================================================================
# Per-file processing
# ============================================================================

def process_sheet_data(ws, source_name, music_subjects, music_catalog, rp_subjects, rp_catalog, start_row=1):
    """
    Core parsing/normalization logic shared between local Excel files and Google Sheets.
    """
    header_row = find_header_row(ws)
    if header_row is None:
        return [], [{"file": source_name, "row": None,
                      "reason": "Could not find a header row (no 'First Name' column found)."}]

    mapping = map_headers(ws, header_row)
    if "first_name" not in mapping:
        return [], [{"file": source_name, "row": None,
                      "reason": "Could not map a 'First Name' column even though header row was found."}]

    records = []
    issues = []

    def cell(row, canonical):
        col = mapping.get(canonical)
        if col is None:
            return None
        return ws.cell(row=row, column=col).value

    # Process rows starting after the header or at the specified start_row
    first_data_row = max(header_row + 1, start_row)
    for r in range(first_data_row, ws.max_row + 1):
        first_name = cell(r, "first_name")
        if first_name is None or str(first_name).strip() == "":
            continue  # blank template row, skip silently

        row_issues = []

        last_name = cell(r, "last_name") or ""

        dob_raw = cell(r, "dob")
        dob = parse_dob(dob_raw)
        if dob is None:
            row_issues.append(f"DOB could not be parsed (raw value: {dob_raw!r})")

        gender = cell(r, "gender")
        if gender:
            gender = str(gender).strip().upper()[:1]  # 'F'/'M'
        else:
            row_issues.append("Gender missing in source file — needs manual entry")

        # ---- Names for submitter / applicant ----
        if "applicant_teacher_combined" in mapping:
            applicant_full = str(cell(r, "applicant_teacher_combined") or "").strip()
            teacher_full = applicant_full
        else:
            applicant_full = str(cell(r, "applicant_name") or "").strip()
            teacher_full = str(cell(r, "teacher_name") or applicant_full).strip()

        cand_email = cell(r, "candidate_email")
        sub_email = cell(r, "submitter_email")
        
        if not sub_email:
            sub_email = SENDER_EMAILS.get(teacher_full.lower())
        if not sub_email:
            sub_email = SENDER_EMAILS.get(applicant_full.lower())
            
        sub_email = sub_email or cand_email
        if not cand_email:
            cand_email = sub_email

        if not sub_email:
            row_issues.append("Submitter/Candidate email missing")

        # ---- Subject + grade (combined or separate columns) ----
        if "subject_grade_combined" in mapping:
            combined_raw = str(cell(r, "subject_grade_combined") or "")
            grade_code, subject_raw = extract_grade_code(combined_raw)
        else:
            subject_raw = str(cell(r, "subject") or "")
            grade_raw = str(cell(r, "grade") or "")
            grade_code, _ = extract_grade_code(grade_raw)
            if grade_code is None:
                # grade word might have landed in the subject cell instead
                grade_code, subject_raw = extract_grade_code(subject_raw)

        if grade_code is None:
            row_issues.append(f"Could not extract a grade from source data")

        # ---- Exam suite + pathway ----
        exam_suite_raw = cell(r, "exam_suite") or ""
        pathway_raw = cell(r, "pathway") or ""

        # Detect Rock & Pop vs Classical
        combined_text = (str(exam_suite_raw) + " " + str(subject_raw)).lower()
        is_rp = any(term in combined_text for term in ["rock", "pop", "r&p", "rap"])

        product_name = None
        product_code = None

        if is_rp:
            # Rock & Pop flow
            dest_master = "rock_pop"
            subject_norm = normalize_rock_pop_subject(subject_raw)
            if subject_norm is None:
                row_issues.append(f"Rock & Pop Subject/instrument '{subject_raw}' not recognized — needs manual mapping")
            
            exam_suite_full = "Rock and Pop (Digital)"

            if grade_code:
                key = build_rock_pop_product_name_key(grade_code)
                found = rp_catalog.get((exam_suite_full, normalize_key(key)))
                if found:
                    product_name, product_code = found
                else:
                    row_issues.append(
                        f"Built Rock & Pop product name '{key}' does not exist in List of Examinations (check grade validity)."
                    )
        else:
            # Classical flow
            dest_master = "music"
            subject_norm, match_type = normalize_subject(subject_raw, music_subjects)
            if subject_norm is None:
                row_issues.append(f"Classical Subject/instrument '{subject_raw}' not recognized — needs manual mapping")
            elif match_type == "fuzzy":
                row_issues.append(f"Classical Subject '{subject_raw}' fuzzy-matched to '{subject_norm}' — please confirm")

            exam_suite_full = normalize_exam_suite(exam_suite_raw)
            if exam_suite_full is None:
                exam_suite_full = "Classical and Jazz (Digital)" # Default fallback

            pathway = extract_pathway(exam_suite_raw, pathway_raw)
            if pathway is None:
                row_issues.append(f"Could not determine Technical/Repertoire pathway from '{exam_suite_raw}' / '{pathway_raw}'")

            if exam_suite_full and pathway and subject_norm and grade_code:
                key = build_product_name_key(pathway, subject_norm, grade_code)
                found = music_catalog.get((exam_suite_full, normalize_key(key)))
                if found:
                    product_name, product_code = found
                else:
                    row_issues.append(
                        f"Built Classical product name '{key}' does not exist in List of Examinations (check grade validity)."
                    )

        submitter_first, submitter_last = split_name(teacher_full)

        school = cell(r, "school") or ""

        # Clean and proper-case all name fields
        first_name_clean = clean_name(first_name)
        last_name_clean = clean_name(last_name)
        submitter_first = clean_name(submitter_first)
        submitter_last = clean_name(submitter_last)
        applicant_full = clean_name(applicant_full)
        school = clean_name(school)
        # Normalization rule: "Harpeggio Academy" -> "Harpeggio Academy of Music & Fine Arts"
        if "harpeggio" in school.lower():
            school = "Harpeggio Academy of Music & Fine Arts"

        # If school says "nil", leave blank and force school_on_cert = "N"
        if school.lower().strip() == "nil":
            school = ""
            school_on_cert_val = "N"
        else:
            school_on_cert_val = "N" if is_rp else DEFAULTS["school_on_cert"]

        record = {
            "first_name": first_name_clean,
            "last_name": last_name_clean,
            "dob": dob,
            "candidate_email": cand_email,
            "gender": gender,
            "exam_suite": exam_suite_full,
            "product_name": product_name,
            "subject": subject_norm,
            "product_code": None,  # left blank to match current office convention
            "submitter_same_as_candidate": DEFAULTS["submitter_same_as_candidate"],
            "submitter_first_name": submitter_first,
            "submitter_last_name": submitter_last,
            "submitter_email": sub_email,
            "applicant_same_as_candidate": DEFAULTS["applicant_same_as_candidate"],
            "applicant": applicant_full,
            "consent_received": DEFAULTS["consent_received"],
            "school": school,
            "school_on_cert": school_on_cert_val,
            "id_document_type": DEFAULTS["id_document_type"],
            "id_document_number": DEFAULTS["id_document_number"],
            "nationality": DEFAULTS["nationality"],
            "fee": FEE_STRUCTURE.get(str(grade_code).upper()) if grade_code else None,
            "_dest_master": dest_master,
        }

        if row_issues:
            issues.append({
                "file": source_name,
                "row": r,
                "candidate": f"{first_name_clean} {last_name_clean}".strip(),
                "reason": "; ".join(row_issues),
            })
            record["_incomplete"] = True
        else:
            record["_incomplete"] = False

        records.append(record)

    return records, issues


def process_teacher_file(path, music_subjects, music_catalog, rp_subjects, rp_catalog):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    return process_sheet_data(ws, path.name, music_subjects, music_catalog, rp_subjects, rp_catalog)


def process_google_sheet(values, sheet_name, music_subjects, music_catalog, rp_subjects, rp_catalog, last_processed_row=0):
    ws = ListWrapper(values)
    start_row = last_processed_row + 1
    return process_sheet_data(ws, sheet_name, music_subjects, music_catalog, rp_subjects, rp_catalog, start_row=start_row)


def split_multi_candidate_message(msg):
    lines = msg["lines"]
    sender = msg["sender"]
    full_text = "\n".join(lines)
    
    # Strategy 1: Split by double-newlines (blank lines separating blocks)
    chunks = re.split(r'\n\s*\n+', full_text.strip())
    if len(chunks) > 1:
        candidate_chunks = []
        common_lines = []
        for chunk in chunks:
            chunk_clean = chunk.lower()
            # If the chunk contains 'for all', 'submitter', 'academy', and NO DOB
            # it is likely the global footer block.
            if ('for all' in chunk_clean or 'submitter' in chunk_clean or 'academy' in chunk_clean) and not re.search(r'\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b', chunk_clean):
                common_lines.extend(chunk.split('\n'))
            else:
                candidate_chunks.append(chunk.split('\n'))
                
        if candidate_chunks:
            sub_messages = []
            for cand_lines in candidate_chunks:
                sub_messages.append({
                    "sender": sender,
                    "lines": cand_lines + common_lines
                })
            return sub_messages

    # Strategy 2: Fall back to existing numbered list splitting
    cand_block_re = re.compile(r'^\s*\d+\s*[,.)\-]\s*(.*)$')
    footer_re = re.compile(r'\b(?:submitter|school|academy|all are|regards|thanks)\b', re.IGNORECASE)

    cand_blocks = []
    current_block = None
    common_lines = []

    for line in lines:
        line_clean = line.strip()
        if not line_clean:
            continue

        if footer_re.search(line_clean) and not re.search(r'\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b', line_clean):
            common_lines.append(line)
            continue

        m = cand_block_re.match(line_clean)
        if m:
            if current_block:
                cand_blocks.append(current_block)
            name_part = m.group(1).strip()
            current_block = [name_part]
        else:
            if current_block:
                current_block.append(line)
            else:
                common_lines.append(line)

    if current_block:
        cand_blocks.append(current_block)

    if not cand_blocks:
        return [msg]

    sub_messages = []
    for idx, block_lines in enumerate(cand_blocks):
        sub_messages.append({
            "sender": sender,
            "lines": block_lines + common_lines
        })

    return sub_messages


def parse_whatsapp_file(path, music_subjects, music_catalog, rp_subjects, rp_catalog, profiles_by_email={}, profiles_by_name={}):
    """
    Parses a WhatsApp chat log file.
    Groups lines into messages by sender, and parses entries.
    Returns (records, issues).
    """
    messages = []
    current_message = None

    header_re = re.compile(
        r'^\[?(\d{1,4}[/.-]\d{1,4}[/.-]\d{1,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:[aApP][mM])?|'
        r'\d{1,2}:\d{2}\s*(?:[aApP][mM])?,\s+\d{1,4}[/.-]\d{1,4}[/.-]\d{1,4})\]?\s*(?:-\s*)?([^:]+):\s*(.*)$'
    )

    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            line_str = line.strip('\n')
            match = header_re.match(line_str)
            if match:
                if current_message:
                    messages.append(current_message)
                sender = match.group(2).strip()
                content_first_line = match.group(3)
                current_message = {
                    "sender": sender,
                    "lines": [content_first_line]
                }
            else:
                if current_message:
                    current_message["lines"].append(line_str)
                else:
                    current_message = {
                        "sender": "Unknown Sender",
                        "lines": [line_str]
                    }
        if current_message:
            messages.append(current_message)

    # Split any multi-candidate messages
    split_messages = []
    for msg in messages:
        split_messages.extend(split_multi_candidate_message(msg))
    messages = split_messages

    records = []
    issues = []

    for msg_idx, msg in enumerate(messages):
        sender = msg["sender"]
        non_empty_lines = [l.strip() for l in msg["lines"] if l.strip()]
        if not non_empty_lines:
            continue

        full_text = "\n".join(non_empty_lines)

        # 1. DOB extraction across full message
        dob = None
        m_date = re.search(r'\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b', full_text)
        if m_date:
            dob = parse_dob(m_date.group(0))

        # 2. Gender extraction across full message
        gender = ""
        if re.search(r'\b(?:female|f)\b', full_text, re.IGNORECASE):
            gender = "F"
        elif re.search(r'\b(?:male|m)\b', full_text, re.IGNORECASE):
            gender = "M"

        # 3. Email extraction
        emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', full_text)
        candidate_email = emails[0] if emails else None

        # 4. Exam suite detection across full message
        is_rp = any(re.search(r'\b' + term + r'\b', full_text, re.IGNORECASE) for term in ["rock", "pop", "r&p", "rp", "rap"])

        # 5. Line-by-line label & unassigned name extraction
        candidate_name = None
        submitter_name_extracted = None
        school_extracted = None
        unassigned_name_lines = []
        subject_grade_line = None

        for line in non_empty_lines:
            line_clean = line.strip()
            if not line_clean:
                continue

            # Check explicit labels
            m_sub = re.search(r'^\s*(?:submitter|applicant|teacher|tutor)(?:\'?s?\s*name)?\s*:?\s*(.*)$', line_clean, re.IGNORECASE)
            if m_sub and m_sub.group(1).strip():
                submitter_name_extracted = m_sub.group(1).strip(',. ')
                continue

            m_cand = re.search(r'^\s*(?:candidate|student|candidate\s*name|student\s*name|name)\s*:?\s*(.*)$', line_clean, re.IGNORECASE)
            if m_cand and m_cand.group(1).strip():
                candidate_name = m_cand.group(1).strip(',. ')
                continue

            m_sch = re.search(r'^\s*(?:school|academy|centre|studio)\s*(?:name)?\s*:?\s*(.*)$', line_clean, re.IGNORECASE)
            if m_sch and m_sch.group(1).strip():
                sch_clean = m_sch.group(1).strip(',. ')
                if sch_clean.lower() not in ["is empty", "empty", "nil", "none", "na", "n/a", "no", "-"]:
                    school_extracted = sch_clean
                else:
                    school_extracted = ""
                continue

            if any(term in line_clean.lower() for term in ["academy", "school", "music", "studio", "centre"]) and "submitter" not in line_clean.lower():
                sch_clean = re.sub(r'^(?:school|academy|centre|studio|music)\s*(?:name)?\s*:?\s*', '', line_clean, flags=re.IGNORECASE).strip(',. ')
                if sch_clean:
                    if sch_clean.lower() not in ["is empty", "empty", "nil", "none", "na", "n/a", "no", "-"]:
                        school_extracted = sch_clean
                    else:
                        school_extracted = ""
                continue

            # Skip pure email, pure dob, gender, grade/suite, instrument lines
            if "@" in line_clean:
                continue
            if re.search(r'^\s*(?:gender|sex)?\s*:?\s*(?:male|female|m|f)\s*$', line_clean, re.IGNORECASE):
                continue
            if re.search(r'\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b', line_clean):
                continue
            if re.search(r'\b(?:grade|initial|g\d{1,2}|rp|rock|pop)\b', line_clean, re.IGNORECASE):
                subject_grade_line = (subject_grade_line + " " + line_clean) if subject_grade_line else line_clean
                continue
            if re.search(r'\b(?:vocals|drums|piano|guitar|keyboard|keyboards|bass|violin|singing)\b', line_clean, re.IGNORECASE):
                subject_grade_line = (subject_grade_line + " " + line_clean) if subject_grade_line else line_clean
                continue

            if re.search(r'\b(?:for all the entries|all are|regards|thanks|please find)\b', line_clean, re.IGNORECASE):
                continue

            cleaned_line = re.sub(r'^(?:name|student|candidate|submitter|applicant|dob|grade|subject)\s*(?:name)?\s*:?\s*', '', line_clean, flags=re.IGNORECASE).strip(',. ')
            if cleaned_line:
                unassigned_name_lines.append(cleaned_line)

        # Dynamic Teacher Profile Lookup first
        # Master fallback profiles
        if 'profiles_by_email' not in locals():
            profiles_by_email = {}
            profiles_by_name = {}

        # Merge CSV profiles over master profiles
        merged_profiles_email = {**profiles_by_email, **CSV_PROFILES_BY_EMAIL}
        merged_profiles_name = {**profiles_by_name, **CSV_PROFILES_BY_NAME}
        
        # Populate all known academies for fuzzy matching
        all_academies = set(KNOWN_ACADEMIES)
        for p in merged_profiles_email.values():
            if p.get("school"): all_academies.add(p["school"])

        sender_email = SENDER_EMAILS.get(sender.lower())
        if not sender_email and submitter_name_extracted:
            sender_email = SENDER_EMAILS.get(submitter_name_extracted.lower())
        if not sender_email:
            sender_email = candidate_email or ""

        prof = None
        if candidate_email and candidate_email.lower() in merged_profiles_email:
            prof = merged_profiles_email[candidate_email.lower()]
        elif sender_email and sender_email.lower() in merged_profiles_email:
            prof = merged_profiles_email[sender_email.lower()]
        elif submitter_name_extracted and submitter_name_extracted.lower() in merged_profiles_name:
            prof = merged_profiles_name[submitter_name_extracted.lower()]
        elif sender and sender.lower() in merged_profiles_name:
            prof = merged_profiles_name[sender.lower()]

        # Query PostgreSQL database as a final fallback
        if not prof:
            if candidate_email: prof = get_teacher_profile_from_db(candidate_email)
            if not prof and sender_email: prof = get_teacher_profile_from_db(sender_email)
            if not prof and submitter_name_extracted: prof = get_teacher_profile_from_db(submitter_name_extracted)
            if not prof and sender: prof = get_teacher_profile_from_db(sender)

        # Apply Fuzzy Typo Correction for School Name
        if school_extracted and all_academies:
            import difflib
            matches = difflib.get_close_matches(school_extracted, all_academies, n=1, cutoff=0.78)
            if matches:
                school_extracted = matches[0] # Correct typo
            else:
                pass # Genuine new academy, keep school_extracted as is!

        if prof:
            if not submitter_name_extracted:
                submitter_name_extracted = prof["applicant"]
            if not school_extracted:
                school_extracted = prof["school"]
            sender_email = prof["submitter_email"] or sender_email
            unassigned_name_lines = [l for l in unassigned_name_lines if l.lower() != prof["applicant"].lower()]


        # Resolve Candidate & Submitter names from unassigned name lines
        import difflib
        if not candidate_name and unassigned_name_lines:
            if len(unassigned_name_lines) == 1:
                candidate_name = unassigned_name_lines[0]
            elif len(unassigned_name_lines) >= 2:
                if candidate_email:
                    user_part = candidate_email.split('@')[0].lower()
                    sim0 = difflib.SequenceMatcher(None, user_part, unassigned_name_lines[0].lower()).ratio()
                    sim1 = difflib.SequenceMatcher(None, user_part, unassigned_name_lines[1].lower()).ratio()
                    if sim1 > sim0:
                        if not submitter_name_extracted:
                            submitter_name_extracted = unassigned_name_lines[1]
                        candidate_name = unassigned_name_lines[0]
                    else:
                        if not submitter_name_extracted:
                            submitter_name_extracted = unassigned_name_lines[0]
                        candidate_name = unassigned_name_lines[1]
                else:
                    candidate_name = unassigned_name_lines[0]
                    if not submitter_name_extracted:
                        submitter_name_extracted = unassigned_name_lines[1]

        if not subject_grade_line:
            subject_grade_line = full_text

        # Filter out obvious non-entry messages
        if not candidate_name and not subject_grade_line:
            continue

        row_issues = []
        
        if not candidate_name:
            row_issues.append("Could not determine Candidate Name")
        if not dob:
            row_issues.append("Missing Date of Birth (DOB)")

        # Validate Gender (if missing, leave blank or print info)
        if not gender:
            gender = ""  # Leave blank for manual entry if needed, but allow record to be written

        # Parse Subject & Grade
        subject_norm = None
        grade_code = None
        if subject_grade_line:
            grade_code, remainder = extract_grade_code(subject_grade_line)
            if grade_code is None:
                grade_code, remainder = extract_grade_code(candidate_name)
            
            subject_raw = remainder or subject_grade_line

            # Detect Rock & Pop vs Classical
            combined_detect = (str(full_text) + " " + str(subject_grade_line) + " " + str(candidate_name)).lower()
            is_rp = any(re.search(r'\b' + term + r'\b', combined_detect) for term in ["rock", "pop", "r&p", "rp", "rap"])

            product_name = None
            product_code = None

            if is_rp:
                dest_master = "rock_pop"
                subject_norm = normalize_rock_pop_subject(subject_raw)
                if subject_norm is None:
                    row_issues.append(f"Rock & Pop Subject '{subject_raw}' not recognized — needs manual mapping")
                
                exam_suite_full = "Rock and Pop (Digital)"

                if grade_code:
                    key = build_rock_pop_product_name_key(grade_code)
                    found = rp_catalog.get((exam_suite_full, normalize_key(key)))
                    if found:
                        product_name, product_code = found
                    else:
                        row_issues.append(
                            f"Built Rock & Pop product name '{key}' does not exist in List of Examinations (check grade validity)."
                        )
            else:
                dest_master = "music"
                subject_norm, match_type = normalize_subject(subject_raw, music_subjects)
                if subject_norm is None:
                    row_issues.append(f"Classical Subject/instrument '{subject_raw}' not recognized — needs manual mapping")
                elif match_type == "fuzzy":
                    row_issues.append(f"Classical Subject '{subject_raw}' fuzzy-matched to '{subject_norm}' — please confirm")

                exam_suite_full = "Classical and Jazz (Digital)"
                pathway = "Technical" # Default for WhatsApp Classical

                if subject_norm and grade_code:
                    key = build_product_name_key(pathway, subject_norm, grade_code)
                    found = music_catalog.get((exam_suite_full, normalize_key(key)))
                    if found:
                        product_name, product_code = found
                    else:
                        row_issues.append(
                            f"Built Classical product name '{key}' does not exist in List of Examinations (check grade validity)."
                        )

            if grade_code is None:
                row_issues.append("Could not extract a grade from WhatsApp message")

        # Submitter & Applicant mapping
        sender_email = SENDER_EMAILS.get(sender.lower())
        if not sender_email and submitter_name_extracted:
            sender_email = SENDER_EMAILS.get(submitter_name_extracted.lower())
        if not sender_email:
            sender_email = candidate_email or ""

        submitter_disp_name = submitter_name_extracted or sender
        submitter_first, submitter_last = split_name(submitter_disp_name)
        submitter_first = clean_name(submitter_first)
        submitter_last = clean_name(submitter_last)
        applicant_full = clean_name(submitter_disp_name)

        school_val = clean_name(school_extracted or "")

        # Dynamic reverse lookup from email or name in teacher profiles!
        prof = None
        if candidate_email and candidate_email.lower() in profiles_by_email:
            prof = profiles_by_email[candidate_email.lower()]
        elif sender_email and sender_email.lower() in profiles_by_email:
            prof = profiles_by_email[sender_email.lower()]
        elif submitter_name_extracted and submitter_name_extracted.lower() in profiles_by_name:
            prof = profiles_by_name[submitter_name_extracted.lower()]
        elif sender and sender.lower() in profiles_by_name:
            prof = profiles_by_name[sender.lower()]

        if not prof:
            if candidate_email: prof = get_teacher_profile_from_db(candidate_email)
            if not prof and sender_email: prof = get_teacher_profile_from_db(sender_email)
            if not prof and submitter_name_extracted: prof = get_teacher_profile_from_db(submitter_name_extracted)
            if not prof and sender: prof = get_teacher_profile_from_db(sender)

        if prof:
            applicant_full = prof["applicant"]
            submitter_first = prof["submitter_first_name"]
            submitter_last = prof["submitter_last_name"]
            if not submitter_last and submitter_first:
                submitter_first, submitter_last = split_name(submitter_first)
            sender_email = prof["submitter_email"] or sender_email
            if not school_val and prof["school"]:
                school_val = prof["school"]

        if not sender_email:
            row_issues.append(f"No known email for WhatsApp sender '{sender}', add to lookup table")

        # Splitting and Capitalizing names
        if candidate_name:
            candidate_name = re.sub(r'^\d+[\.,\)]\s*', '', candidate_name)
        first_name, last_name = split_name(candidate_name)
        first_name_clean = clean_name(first_name)
        last_name_clean = clean_name(last_name)

        if is_suspicious_name(f"{first_name_clean} {last_name_clean}"):
            print(f"  [WARNING] Suspicious Name Formatting detected for '{first_name_clean} {last_name_clean}'. Words are repeated.")
            is_suspicious = True
        else:
            is_suspicious = False

        # Normalization rule: "Harpeggio Academy" -> "Harpeggio Academy of Music & Fine Arts"
        if "harpeggio" in school_val.lower():
            school_val = "Harpeggio Academy of Music & Fine Arts"

        # If school is present and non-empty, set school_on_cert to 'Y'
        if school_val.lower().strip() in ["nil", "none", "na", "n/a", "no", "-"]:
            school_val = ""
            school_on_cert_val = "N"
        elif school_val:
            school_on_cert_val = "Y"
        else:
            school_on_cert_val = "N"

        # Print informational warning for pathway assumption
        if not is_rp:
            print(f"  [INFO] Candidate '{first_name_clean} {last_name_clean}': Classical pathway assumed = Technical")

        record = {
            "first_name": first_name_clean,
            "last_name": last_name_clean,
            "dob": dob,
            "candidate_email": sender_email,
            "gender": gender,
            "exam_suite": exam_suite_full,
            "product_name": product_name,
            "subject": subject_norm,
            "product_code": None,
            "submitter_same_as_candidate": "N",
            "submitter_first_name": submitter_first,
            "submitter_last_name": submitter_last,
            "submitter_email": sender_email,
            "applicant_same_as_candidate": "N",
            "applicant": applicant_full,
            "consent_received": "Y",
            "school": school_val,
            "school_on_cert": school_on_cert_val,
            "id_document_type": DEFAULTS["id_document_type"],
            "id_document_number": DEFAULTS["id_document_number"],
            "nationality": DEFAULTS["nationality"],
            "fee": FEE_STRUCTURE.get(str(grade_code).upper()) if grade_code else None,
            "_dest_master": dest_master,
            "_suspicious_name": is_suspicious,
        }

        if row_issues:
            issues.append({
                "file": path.name,
                "row": f"Msg {msg_idx + 1}",
                "candidate": f"{first_name_clean} {last_name_clean}".strip(),
                "reason": "; ".join(row_issues),
            })
            record["_incomplete"] = True
        else:
            record["_incomplete"] = False

        records.append(record)

    return records, issues


# ============================================================================
# Writing to master
# ============================================================================

def find_next_empty_row(ws):
    r = MASTER_FIRST_DATA_ROW
    while ws.cell(row=r, column=column_index_from_string(MASTER_COLS["first_name"])).value not in (None, ""):
        r += 1
    return r


def write_records_to_master(ws, records, start_row):
    existing = set()
    col_fn = column_index_from_string(MASTER_COLS["first_name"])
    col_ln = column_index_from_string(MASTER_COLS["last_name"])
    col_prod = column_index_from_string(MASTER_COLS["product_name"])
    col_dob = column_index_from_string(MASTER_COLS["dob"])

    for r in range(MASTER_FIRST_DATA_ROW, ws.max_row + 1):
        fn = str(ws.cell(row=r, column=col_fn).value or "").strip().lower()
        ln = str(ws.cell(row=r, column=col_ln).value or "").strip().lower()
        prod = str(ws.cell(row=r, column=col_prod).value or "").strip().lower()
        dob_val = str(ws.cell(row=r, column=col_dob).value or "").strip().lower()
        if fn or ln:
            existing.add((fn, ln, prod))
            if dob_val:
                existing.add((fn, ln, dob_val))

    row = start_row
    written_count = 0
    written_records_list = []
    for rec in records:
        if rec.get("_incomplete"):
            continue
        
        rec_fn = str(rec.get("first_name") or "").strip().lower()
        rec_ln = str(rec.get("last_name") or "").strip().lower()
        rec_prod = str(rec.get("product_name") or "").strip().lower()
        rec_dob = str(rec.get("dob") or "").strip().lower()

        if (rec_fn, rec_ln, rec_prod) in existing or (rec_dob and (rec_fn, rec_ln, rec_dob) in existing):
            print(f"  [SKIP DUPLICATE] Candidate '{rec.get('first_name')} {rec.get('last_name')}' ({rec.get('product_name')}) is already in Master Sheet.")
            continue

        for field, col_letter in MASTER_COLS.items():
            value = rec.get(field)
            if value is None:
                continue
            cell = ws.cell(row=row, column=column_index_from_string(col_letter), value=value)
            if field == "dob" and isinstance(value, (date, datetime)):
                cell.number_format = 'dd/mm/yyyy'
            
            if rec.get("_suspicious_name") and field in ["first_name", "last_name", "applicant", "submitter_first_name", "submitter_last_name"]:
                cell.fill = PatternFill(start_color="FFFFC7CE", end_color="FFFFC7CE", fill_type="solid")
        
        existing.add((rec_fn, rec_ln, rec_prod))
        if rec_dob:
            existing.add((rec_fn, rec_ln, rec_dob))
        row += 1
        written_count += 1
        written_records_list.append(rec)

    return written_count, written_records_list


# ============================================================================
# State tracking (avoid reprocessing the same file twice on reruns)
# ============================================================================

def load_state(state_path):
    if state_path.exists():
        with open(state_path, "r") as f:
            return json.load(f)
    return {"processed": {}}


def save_state(state_path, state):
    with open(state_path, "w") as f:
        json.dump(state, f, indent=2)


# ============================================================================
# Main
# ============================================================================

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input-folder", default=None, help="Folder to scan for teacher .xlsx files")
    ap.add_argument("--whatsapp-file", default=None, help="Path to a WhatsApp chat log text file")
    ap.add_argument("--google-sheet-id", default=None, help="Google Sheet ID for Google Form Responses")
    ap.add_argument("--force-reprocess", action="store_true", help="Force reprocessing")
    ap.add_argument("--master-music-sheet-id", required=True, help="Google Sheet ID for Music Master")
    ap.add_argument("--master-rp-sheet-id", required=True, help="Google Sheet ID for Rock and Pop Master")
    ap.add_argument("--credentials-file", default="credentials.json", help="Path to the Google service account credentials JSON file")
    args = ap.parse_args()

    if not args.input_folder and not args.whatsapp_file and not args.google_sheet_id:
        ap.error("At least one of --input-folder, --whatsapp-file, or --google-sheet-id must be specified.")

    # 1. Connect to Google Sheets
    print("Connecting to Google Sheets...")
    import gspread
    gc = gspread.service_account(filename=str(args.credentials_file))
    
    music_sh = gc.open_by_key(args.master_music_sheet_id)
    rp_sh = gc.open_by_key(args.master_rp_sheet_id)

    # 2. Fetch lookups from Google Sheets (instead of local .xlsx)
    print("Fetching Music lookup tables from Google Sheets...")
    music_subjects = load_valid_subjects(music_sh.worksheet("Lookup").get_all_values())
    music_catalog = load_examination_catalog(music_sh.worksheet(LIST_OF_EXAMS_SHEET_NAME).get_all_values())
    music_enrollments = music_sh.worksheet(MASTER_SHEET_NAME).get_all_values()

    print("Fetching Rock & Pop lookup tables from Google Sheets...")
    rp_subjects = load_valid_subjects(rp_sh.worksheet("Lookup").get_all_values())
    rp_catalog = load_examination_catalog(rp_sh.worksheet(LIST_OF_EXAMS_SHEET_NAME).get_all_values())
    rp_enrollments = rp_sh.worksheet(MASTER_SHEET_NAME).get_all_values()

    profiles_by_email, profiles_by_name = load_teacher_profiles(music_enrollments, rp_enrollments)

    # Fetch existing names from cloud to prevent duplicates
    existing_music_names = set()
    for r, row in enumerate(music_enrollments):
        if r < MASTER_FIRST_DATA_ROW - 1: continue
        first = row[column_index_from_string(MASTER_COLS['first_name']) - 1] if len(row) >= column_index_from_string(MASTER_COLS['first_name']) else ""
        last = row[column_index_from_string(MASTER_COLS['last_name']) - 1] if len(row) >= column_index_from_string(MASTER_COLS['last_name']) else ""
        existing_music_names.add(f"{first} {last}".strip().lower())
        
    existing_rp_names = set()
    for r, row in enumerate(rp_enrollments):
        if r < MASTER_FIRST_DATA_ROW - 1: continue
        first = row[column_index_from_string(MASTER_COLS['first_name']) - 1] if len(row) >= column_index_from_string(MASTER_COLS['first_name']) else ""
        last = row[column_index_from_string(MASTER_COLS['last_name']) - 1] if len(row) >= column_index_from_string(MASTER_COLS['last_name']) else ""
        existing_rp_names.add(f"{first} {last}".strip().lower())

    to_process = []
    is_whatsapp = False
    is_google_sheet = False
    state_path = Path(".convert_state.json")
    state = load_state(state_path)
    sheet_values = None
    sheet_name = ""
    last_processed_row = 0

    if args.google_sheet_id:
        is_google_sheet = True
        sheet_id = args.google_sheet_id
        try:
            sh = gc.open_by_key(sheet_id)
            try:
                ws = sh.worksheet("Form Responses 1")
            except gspread.WorksheetNotFound:
                try:
                    ws = sh.worksheet("Form Response 1")
                except gspread.WorksheetNotFound:
                    ws = sh.get_worksheet(0)
            sheet_name = sh.title + " / " + ws.title
            print(f"Connected to Google Form Sheet: '{sheet_name}'")
            sheet_values = ws.get_all_values()
            
            state_key = f"google_sheet_{sheet_id}"
            last_processed_row = state["processed"].get(state_key, 0)
            total_rows = len(sheet_values)

            if not args.force_reprocess and total_rows <= last_processed_row:
                print(f"No new rows to process in Google Form Sheet (last processed row: {last_processed_row}, total rows: {total_rows}).")
                return
            print(f"Found new rows in Google Form Sheet (processing rows {last_processed_row + 1} to {total_rows}).")
            to_process.append(Path(state_key))
        except Exception as e:
            print(f"ERROR connecting to Google Form Sheet ({sheet_id}): {e}")
            sys.exit(1)
    elif args.whatsapp_file:
        is_whatsapp = True
        whatsapp_path = Path(args.whatsapp_file)
        if not whatsapp_path.is_file():
            print(f"ERROR: WhatsApp file not found: {whatsapp_path}")
            sys.exit(1)
        to_process.append(whatsapp_path)
    else:
        input_folder = Path(args.input_folder)
        if not input_folder.is_dir():
            print(f"ERROR: input folder not found: {input_folder}")
            sys.exit(1)
        teacher_files = sorted(
            f for f in input_folder.iterdir()
            if f.is_file() and f.suffix.lower() in (".xlsx", ".txt") and not f.name.startswith("~$")
        )
        for f in teacher_files:
            mtime = f.stat().st_mtime
            prev = state["processed"].get(f.name)
            if not args.force_reprocess and prev is not None and prev == mtime:
                continue
            to_process.append(f)

    if not to_process:
        print("No files to process.")
        return

    print(f"Found {len(to_process)} file(s) to process:")
    for f in to_process:
        print(f"  - {f.name}")

    all_records = []
    all_issues = []

    for f in to_process:
        try:
            if is_google_sheet:
                records, issues = process_google_sheet(sheet_values, sheet_name, music_subjects, music_catalog, rp_subjects, rp_catalog, last_processed_row=last_processed_row)
                state_key = f"google_sheet_{args.google_sheet_id}"
                state["processed"][state_key] = len(sheet_values)
            elif is_whatsapp or (isinstance(f, Path) and f.suffix.lower() == ".txt"):
                records, issues = parse_whatsapp_file(f, music_subjects, music_catalog, rp_subjects, rp_catalog, profiles_by_email, profiles_by_name)
                state["processed"][f.name] = f.stat().st_mtime
            else:
                records, issues = process_teacher_file(f, music_subjects, music_catalog, rp_subjects, rp_catalog)
                state["processed"][f.name] = f.stat().st_mtime
        except Exception as e:
            all_issues.append({"file": f.name if not is_google_sheet else sheet_name, "row": None, "reason": f"Failed to process: {e}"})
            continue
        all_records.extend(records)
        all_issues.extend(issues)

    # Filter out records that already exist in the cloud
    new_records = []
    for r in all_records:
        if r.get("_incomplete"):
            new_records.append(r)
            continue
        cand_name = f"{r.get('first_name', '')} {r.get('last_name', '')}".strip().lower()
        if r.get("_dest_master") == "music" and cand_name in existing_music_names:
            print(f"  [SKIP DUPLICATE] Candidate '{cand_name.title()}' is already in Music Master Sheet.")
            continue
        if r.get("_dest_master") == "rock_pop" and cand_name in existing_rp_names:
            print(f"  [SKIP DUPLICATE] Candidate '{cand_name.title()}' is already in Rock & Pop Master Sheet.")
            continue
        new_records.append(r)

    music_records = [r for r in new_records if r.get("_dest_master") == "music" and not r.get("_incomplete")]
    rp_records = [r for r in new_records if r.get("_dest_master") == "rock_pop" and not r.get("_incomplete")]

    n_incomplete = sum(1 for r in new_records if r.get("_incomplete"))

    def push_to_sheet(sheet_ws, records, sheet_type):
        rows_to_append = []
        for rec in records:
            row = [""] * 40
            for field, col_letter in MASTER_COLS.items():
                val = rec.get(field)
                if val is None:
                    continue
                if field == "dob" and isinstance(val, (date, datetime)):
                    val = val.strftime('%d/%m/%Y')
                col_idx = column_index_from_string(col_letter) - 1
                row[col_idx] = str(val)
            rows_to_append.append(row)
        
        if rows_to_append:
            try:
                sheet_ws.append_rows(rows_to_append)
                print(f"Successfully synced {len(rows_to_append)} rows to {sheet_type} Google Sheet.")
            except Exception as e:
                print(f"ERROR syncing {sheet_type} to Google Sheets: {e}")
                sys.exit(1)

    if music_records:
        push_to_sheet(music_sh.worksheet(MASTER_SHEET_NAME), music_records, "Music")
    
    if rp_records:
        push_to_sheet(rp_sh.worksheet(MASTER_SHEET_NAME), rp_records, "Rock & Pop")

    if n_incomplete:
        print(f"\n{n_incomplete} record(s) were NOT written — they need manual review (see report below).")

    if all_issues:
        print(f"\n{len(all_issues)} issue(s) logged for manual review.")
        for iss in all_issues:
            print(f"  - {iss.get('file')} {iss.get('candidate')} : {iss.get('reason')}")
    else:
        print("\nNo issues — every row resolved cleanly.")
    
    save_state(state_path, state)
    print("Execution complete.")


if __name__ == "__main__":
    main()
