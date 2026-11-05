import re
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from ..filters.shop_filter import is_cash_deposit

GENERIC_SCHOOL_WORDS = {
    "ACADEMY", "SCHOOL", "MUSIC", "INSTITUTE", "CENTRE", "CENTER", 
    "COLLEGE", "CONSERVATORY", "OF", "THE", "AND", "&", "LIMITED", 
    "LTD", "PVT", "INDIA", "PRIVATE", "ONLINE", "PLATFORM", "EDUCATION",
    "TRINITY", "TCL", "EXAM", "EXAMS", "EXAMINATION", "GRADE", "GRADES",
    "FEE", "FEES", "INITIAL", "THEORY", "DIGITAL", "KERALA", "BANK",
    "GRAMIN", "KRISHNAN", "NAVNEETH", "NAVANEETH", "PALGHAT", "SANTHANA"
}

def clean_alphanumeric(text: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", text.upper()) if text else ""

def clean_letters(text: str) -> str:
    return re.sub(r"[^A-Z]", "", text.upper()) if text else ""

def extract_payer_key(narration: str) -> Optional[str]:
    narr = narration.upper()
    if is_cash_deposit(narr):
        return None
    
    # 1. UPI Sender Name
    m = re.search(r"UPI-([A-Z\s]+?)(?:-|\d|@|\b)", narr)
    if m and len(m.group(1).strip()) >= 3:
        return m.group(1).strip()

    m = re.search(r"UPI/([A-Z\s]+?)/", narr)
    if m and len(m.group(1).strip()) >= 3 and not m.group(1).startswith("CR") and not m.group(1).isdigit():
        return m.group(1).strip()

    m = re.search(r"UPI/CR/\d+/([^/]+)/", narr)
    if m:
        return m.group(1).strip()

    # 2. IMPS Sender Name
    m = re.search(r"MMT/IMPS/\d+/[^/]+/([A-Z\s]+)/", narr)
    if m:
        return m.group(1).strip()
    m = re.search(r"MOB-IMPS-\s*CR/([^/]+)/", narr)
    if m:
        return m.group(1).strip()
    m = re.search(r"INET-IMPS-CR/([^/]+)/", narr)
    if m:
        return m.group(1).strip()

    # 3. NEFT Sender Name
    m = re.search(r"NEFT\s*-\s*[A-Z0-9]+\s*-\s*[A-Z0-9\s]+-([A-Z\s]+)", narr)
    if m:
        return m.group(1).strip()
        
    return None

class ReconciliationMatcher:
    def __init__(self, aliases: List[Dict[str, Any]], teachers: Dict[str, Dict[str, Any]], 
                 candidates: List[Dict[str, Any]], teacher_totals: List[Dict[str, Any]]):
        self.aliases = aliases
        self.teachers = teachers
        self.candidates = candidates
        self.teacher_totals = teacher_totals
        
        # Build distinctive academy rules
        # Strips generic words and produces high-confidence distinctive academy tokens
        stop_re = re.compile(
            r"\b(ACADEMY|SCHOOL|MUSIC|INSTITUTE|CENTRE|CENTER|CONSERVATORY|OF|THE|AND|&|LIMITED|LTD|"
            r"PVT|INDIA|PRIVATE|ONLINE|PLATFORM|EDUCATION|TRINITY|TCL|EXAM|EXAMS|EXAMINATION|GRADE|"
            r"GRADES|FEE|FEES|INITIAL|THEORY|DIGITAL|KERALA|BANK|GRAMIN|KRISHNAN|NAVNEETH|NAVANEETH|"
            r"PALGHAT|SANTHANA|INTERNATIONAL|FINE|ARTS)\b", 
            re.IGNORECASE
        )

        self.distinctive_academy_rules = []
        for tid, t in teachers.items():
            s_name = (t.get("schoolName") or "").strip().upper()
            if s_name:
                cleaned_sname = stop_re.sub("", s_name).strip()
                dist = clean_alphanumeric(cleaned_sname)
                if len(dist) >= 6 and dist not in GENERIC_SCHOOL_WORDS:
                    self.distinctive_academy_rules.append((dist, tid, s_name))
                # Also add individual words if >= 6 letters and not generic
                tokens = [w for w in re.split(r"[\s,]+", cleaned_sname) if len(w) >= 6 and w not in GENERIC_SCHOOL_WORDS]
                for tok in tokens:
                    tok_clean = clean_alphanumeric(tok)
                    if len(tok_clean) >= 6 and tok_clean != dist and tok_clean not in GENERIC_SCHOOL_WORDS:
                        self.distinctive_academy_rules.append((tok_clean, tid, s_name))

    def match_transaction(self, tx: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
        """
        Runs Pass 1 on a single transaction.
        Returns: (matched_teacher_id, match_method) or (None, None)
        """
        narration = tx["narration"].upper()
        narration_clean = clean_alphanumeric(narration)
        narration_letters = clean_letters(narration)

        # BEWARE: User rule: not all transaction and cash deposit are directly related to Trinity fees!
        # Never auto-match ANY cash deposit (CAM or branch cash) - leave for manual verification
        if is_cash_deposit(narration):
            return None, None

        # 1. Teacher Aliases (Highest Priority)
        for al in self.aliases:
            pat = al["alias"].upper()
            pat_clean = clean_alphanumeric(pat)
            pat_letters = clean_letters(pat)

            if (pat in narration) or \
               (pat_clean and len(pat_clean) >= 4 and pat_clean in narration_clean) or \
               (pat_letters and len(pat_letters) >= 6 and pat_letters in narration_letters):
                return al["teacherId"], f"Pass 1: Alias Match ({al['alias']})"

        # 2. Distinctive Academy / School Names
        for tok, tid, school_name in self.distinctive_academy_rules:
            if tok in narration_clean:
                return tid, f"Pass 1: Academy Match ({school_name})"

        return None, None

    def match_batch(self, transactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Executes multi-pass matching across a batch of transactions.
        """
        results = []
        remaining_p1 = []

        # -----------------------------------------------------
        # PASS 1: Explicit Alias and Distinctive Academy Matching
        # -----------------------------------------------------
        for tx in transactions:
            tid, method = self.match_transaction(tx)
            if tid:
                tx_copy = dict(tx)
                tx_copy["mappedTeacherId"] = tid
                tx_copy["matchMethod"] = method
                results.append(tx_copy)
            else:
                remaining_p1.append(tx)

        # -----------------------------------------------------
        # PASS 2: Grouped Payer Sum Match
        # -----------------------------------------------------
        grouped_payers: Dict[str, List[Dict[str, Any]]] = {}
        for tx in remaining_p1:
            k = extract_payer_key(tx["narration"])
            if k:
                grouped_payers.setdefault(k, []).append(tx)

        matched_p2_ids = set()
        for p_key, tx_list in grouped_payers.items():
            if len(tx_list) > 1:
                total_grp = sum(t["amount"] for t in tx_list)
                hit_tid = None
                for tt in self.teacher_totals:
                    if abs(tt["total_fee"] - total_grp) < 1.0:
                        hit_tid = tt["teacherId"]
                        break
                
                if hit_tid:
                    method_str = f"Pass 2: Grouped Payer Sum ({p_key} - ₹{total_grp:.2f})"
                    for t_item in tx_list:
                        matched_p2_ids.add(t_item.get("id") or t_item["narration"])
                        tx_copy = dict(t_item)
                        tx_copy["mappedTeacherId"] = hit_tid
                        tx_copy["matchMethod"] = method_str
                        results.append(tx_copy)

        remaining_p2 = [t for t in remaining_p1 if (t.get("id") or t["narration"]) not in matched_p2_ids]

        # -----------------------------------------------------
        # PASS 3: Candidate Name + Fee Tier Match
        # -----------------------------------------------------
        for tx in remaining_p2:
            narration = tx["narration"].upper()
            narration_letters = clean_letters(narration)
            amount = tx["amount"]

            # BEWARE: User rule: not all transaction and cash deposit are directly related to Trinity fees!
            # Cash deposits MUST NEVER be auto-matched to candidates
            if is_cash_deposit(narration):
                tx_copy = dict(tx)
                tx_copy["mappedTeacherId"] = None
                tx_copy["matchMethod"] = "Unassigned (Cash Deposit - Needs Verification)"
                results.append(tx_copy)
                continue

            hit_tid = None
            hit_method = None

            for cand in self.candidates:
                cand_fee = cand["expectedFee"]
                if abs(cand_fee - amount) > 1.0:
                    continue

                c_first = (cand.get("firstName") or "").strip().upper()
                c_last = (cand.get("lastName") or "").strip().upper()
                c_full = f"{c_first} {c_last}".strip()

                if "NAVNEETH" in c_full or "NAVANEETH" in c_full:
                    continue

                first_clean = clean_letters(c_first)
                last_clean = clean_letters(c_last)
                full_clean = clean_letters(c_full)

                match_found = False
                if len(full_clean) >= 6 and full_clean in narration_letters:
                    match_found = True
                elif len(first_clean) >= 4 and len(last_clean) >= 4:
                    if first_clean in narration_letters and last_clean in narration_letters:
                        match_found = True
                elif len(first_clean) >= 5 and first_clean in narration_letters:
                    match_found = True

                if match_found and cand.get("teacherId"):
                    hit_tid = cand["teacherId"]
                    hit_method = f"Pass 3: Candidate Match ({c_first} {c_last} - ₹{cand_fee:.2f})"
                    break

            tx_copy = dict(tx)
            if hit_tid:
                tx_copy["mappedTeacherId"] = hit_tid
                tx_copy["matchMethod"] = hit_method
            else:
                tx_copy["mappedTeacherId"] = None
                tx_copy["matchMethod"] = "Unassigned"
            results.append(tx_copy)

        return results
