import pdfplumber
from pathlib import Path
from typing import Optional

def detect_bank_type(pdf_path: str | Path) -> str:
    """
    Detect the bank statement type (ICICI, HDFC, or CANARA).
    Uses both file name hints and first-page header text analysis.
    """
    path = Path(pdf_path)
    filename = path.name.lower()
    
    # 1. Quick filename indicators
    if "hdfc" in filename:
        return "HDFC"
    if "canara" in filename:
        return "CANARA"
    if "icici" in filename:
        return "ICICI"
        
    # 2. Inspect document header text on the first page
    try:
        with pdfplumber.open(path) as pdf:
            if not pdf.pages:
                return "UNKNOWN"
            header_text = (pdf.pages[0].extract_text() or "").upper()
            
            # Check for ICICI specific identifiers (account number or IFSC or header)
            if "ICIC0000262" in header_text or "026205005146" in header_text or "ICICI BANK" in header_text[:500]:
                return "ICICI"
                
            # Check for HDFC specific identifiers
            if "HDFC BANK" in header_text or "CLOSING BALANCE" in header_text and "RTGS" in header_text:
                return "HDFC"
                
            # Check for Canara specific identifiers
            if "CANARA BANK" in header_text or "CANARA" in header_text[:500]:
                return "CANARA"
                
            # Check for ICICI tables
            tables = pdf.pages[0].extract_tables()
            if tables and len(tables[0]) > 0:
                first_row = [str(c).lower() for c in tables[0][0]]
                if any("withdrawal" in c for c in first_row) and any("deposit" in c for c in first_row):
                    return "ICICI"
    except Exception as e:
        print(f"Warning: could not inspect PDF header for {path.name}: {e}")

    # Fallback default
    return "CANARA"
