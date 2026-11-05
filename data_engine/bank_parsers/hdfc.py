import re
import pdfplumber
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from .base import parse_amount, month_name_from_date

def extract_deposits_hdfc(pdf_path: str | Path) -> List[Dict[str, Any]]:
    """
    Extract credit (deposit) transactions from HDFC Bank statements.
    """
    deposits = []
    pdf_path = Path(pdf_path)

    with pdfplumber.open(pdf_path) as pdf:
        full_text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    
    lines = full_text.split("\n")
    date_re = re.compile(r"^(\d{2}/\d{2}/\d{2})\s")
    blocks, current_block = [], []
    
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
            junk_keywords = [
                "Statementofaccount", "Nomination", "AccountNo", "From :", "RTGS", "PageNo", 
                "HDFCBANKLIMITED", "Closingbalance", "Contentsofthis", "ODLimit", "CustID", 
                "AccountStatus", "JOINTHOLDERS", "AccountBranch", "RegisteredOfficeAddress", "StateaccountbranchGSTN"
            ]
            if not any(kw.lower() in line_no_space.lower() for kw in junk_keywords):
                current_block.append(line)
                
    if current_block:
        blocks.append(" ".join(current_block))
    
    amount_re = re.compile(r"([\d,]+\.\d{2})")
    prev_balance = None
    
    for block in blocks:
        m_date = date_re.match(block)
        if not m_date:
            continue
        amounts = amount_re.findall(block)
        if len(amounts) < 2:
            continue
        balance = parse_amount(amounts[-1])
        amount = parse_amount(amounts[-2])
        
        is_credit = False
        if prev_balance is not None and abs(balance - prev_balance - amount) < 1.0:
            is_credit = True
        elif prev_balance is not None and balance > prev_balance and abs((balance - prev_balance) - amount) < 1.0:
            is_credit = True
        elif any(kw in block.upper() for kw in ["-CR", " CR ", "CREDIT", "NEFT CR", "IMPS-CR"]):
            if not any(dk in block.upper() for dk in ["RETURN", "BOUNCE", "REVERSAL"]):
                is_credit = True

        if is_credit and amount > 0:
            date_str = m_date.group(1)
            date_obj = datetime.strptime(f"{date_str[:2]}-{date_str[3:5]}-20{date_str[6:]}", "%d-%m-%Y")
            clean_narration = re.sub(r"\s+", " ", block).strip()
            deposits.append({
                "date": date_obj,
                "narration": clean_narration,
                "amount": amount,
                "bank": "HDFC",
                "session_month": month_name_from_date(date_obj)
            })
            
        prev_balance = balance
        
    return deposits
