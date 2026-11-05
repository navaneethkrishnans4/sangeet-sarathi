import pdfplumber
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from .base import parse_amount, month_name_from_date

def extract_deposits_icici(pdf_path: str | Path) -> List[Dict[str, Any]]:
    """
    Extract credit (deposit) transactions from ICICI Current Account statements.
    PDF layout: 8-column tables with headers:
    ['S.no', 'Transaction ID', 'Transaction date', 'Cheque No', 'Description', 'Withdrawal (Dr)', 'Deposit (Cr)', 'Available Balance']
    """
    deposits = []
    pdf_path = Path(pdf_path)

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            if not tables:
                continue
            for table in tables:
                for row in table:
                    if not row or len(row) < 8:
                        continue
                    sno, tx_id, tx_date, chq_no, desc, dr, cr, bal = [c.strip() if c else "" for c in row[:8]]
                    
                    # Skip header rows and empty rows
                    if sno.lower() == "s.no" or "particulars" in desc.lower() or not tx_date:
                        continue
                    
                    # Parse date: format in PDF is often like "01-Jun-\n2026"
                    clean_date_str = tx_date.replace("\n", "").replace(" ", "").strip()
                    try:
                        date_obj = datetime.strptime(clean_date_str, "%d-%b-%Y")
                    except Exception:
                        continue
                        
                    cr_amount = parse_amount(cr)
                    if cr_amount <= 0:
                        continue
                        
                    # Normalize description
                    clean_desc = re.sub(r"\s+", " ", desc).strip()
                    clean_tx_id = re.sub(r"\s+", "", tx_id).strip()
                    
                    deposits.append({
                        "date": date_obj,
                        "narration": clean_desc,
                        "amount": cr_amount,
                        "tx_id": clean_tx_id,
                        "bank": "ICICI",
                        "session_month": month_name_from_date(date_obj)
                    })

    return deposits
