import re
import pdfplumber
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from .base import parse_amount, month_name_from_date

def extract_deposits_canara(pdf_path: str | Path) -> List[Dict[str, Any]]:
    """
    Extract credit (deposit) transactions from Canara Bank statements.
    """
    deposits = []
    pdf_path = Path(pdf_path)

    with pdfplumber.open(pdf_path) as pdf:
        full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    
    blocks = re.split(r"Chq:\s*\S+", full_text)
    amount_re = re.compile(r"([\d,]+\.\d{2})")
    date_re = re.compile(r"(\d{2}-\d{2}-\d{4})")
    prev_balance = None
    
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        if "Opening Balance" in block:
            obs = amount_re.findall(block)
            if obs:
                prev_balance = parse_amount(obs[-1])
            continue
            
        cleaned = "\n".join(
            ln for ln in block.split("\n") 
            if not any(kw in ln for kw in ["Date Particulars", "Branch Code", "IFSC", "page "])
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
        amount = parse_amount(amounts[-2])
        
        is_credit = False
        if prev_balance is not None and abs(balance - prev_balance - amount) < 1.0:
            is_credit = True
        elif prev_balance is not None and balance > prev_balance and abs((balance - prev_balance) - amount) < 1.0:
            is_credit = True
        elif any(kw in cleaned.upper() for kw in ["-CR", " CR ", "CREDIT", "NEFT CR", "IMPS-CR"]):
            if not any(dk in cleaned.upper() for dk in ["RETURN", "BOUNCE", "REVERSAL"]):
                is_credit = True

        if is_credit and amount > 0:
            date_obj = datetime.strptime(m_date.group(1), "%d-%m-%Y")
            deposits.append({
                "date": date_obj,
                "narration": re.sub(r"\s+", " ", cleaned).strip(),
                "amount": amount,
                "bank": "CANARA",
                "session_month": month_name_from_date(date_obj)
            })
            
        prev_balance = balance
        
    return deposits
