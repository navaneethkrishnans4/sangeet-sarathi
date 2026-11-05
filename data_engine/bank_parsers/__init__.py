from .detector import detect_bank_type
from .icici import extract_deposits_icici
from .hdfc import extract_deposits_hdfc
from .canara import extract_deposits_canara

def extract_deposits(pdf_path):
    bank_type = detect_bank_type(pdf_path)
    if bank_type == "ICICI":
        return extract_deposits_icici(pdf_path), "ICICI"
    elif bank_type == "HDFC":
        return extract_deposits_hdfc(pdf_path), "HDFC"
    elif bank_type == "CANARA":
        return extract_deposits_canara(pdf_path), "CANARA"
    else:
        # Default try ICICI if table exists, otherwise Canara
        try:
            txs = extract_deposits_icici(pdf_path)
            if txs:
                return txs, "ICICI"
        except Exception:
            pass
        return extract_deposits_canara(pdf_path), "CANARA"

__all__ = [
    "detect_bank_type",
    "extract_deposits",
    "extract_deposits_icici",
    "extract_deposits_hdfc",
    "extract_deposits_canara"
]
