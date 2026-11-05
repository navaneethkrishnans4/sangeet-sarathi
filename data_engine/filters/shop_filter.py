import re
from typing import Dict, Any, Tuple

SHOP_KEYWORDS = [
    "PAYTM PAYMENTS SERVICES",
    "PAYTM PAYMENT SERVICES",
    "PAYTMPAYMENTS",
    "ICICIPOS_SET",
    "ICICIPOS",
    "EZY/ICICIPOS",
]

EXAM_KEYWORDS = [
    "TRINITY", "EXAM", "TCL", "GRADE", "INITIAL", "CANDIDATE", "THEORY", "FEES", "EXAM FEE"
]

def is_cash_deposit(narration: str) -> bool:
    """
    Check if a transaction is a cash deposit (branch or CAM cash deposit machine).
    """
    narr_upper = narration.upper()
    return (
        "CASH DEP" in narr_upper or 
        "BY CASH" in narr_upper or 
        "CAM/" in narr_upper or 
        "CASH DEPOSIT" in narr_upper
    )

def evaluate_transaction_type(tx: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Evaluates whether a transaction is a shop/retail transaction or candidate for Trinity reconciliation.
    
    Returns:
        (is_shop, reason)
        If is_shop is True, the transaction should be excluded from automatic Trinity reconciliation.
    """
    narration = tx.get("narration", "")
    narr_upper = narration.upper()
    narr_nospace = re.sub(r"[^A-Z0-9]", "", narr_upper)
    amount = float(tx.get("amount", 0.0))
    bank = tx.get("bank", "")

    # User instruction: Avoid all "CASH DEP" and "BY CASH" transactions
    if is_cash_deposit(narr_upper):
        return True, "Excluded Cash Deposit (CASH DEP / BY CASH)"

    # Only ICICI account is shared with the music shop (Sangeet Sarathi Current Account)
    # HDFC and Canara accounts are dedicated exam accounts unless specified otherwise
    if bank != "ICICI":
        return False, "Non-ICICI account"

    # 1. Direct merchant settlement from Paytm QR
    if any(re.sub(r"[^A-Z0-9]", "", kw) in narr_nospace for kw in SHOP_KEYWORDS[:3]):
        return True, "Paytm Shop QR Settlement"
    if "PAYTM" in narr_upper and any(w in narr_upper for w in ["SERVICES", "SETTLEMENT", "SETTLE"]):
        return True, "Paytm Shop QR Settlement"

    # 2. Card Swipe POS Terminal daily batch settlement
    if any(re.sub(r"[^A-Z0-9]", "", kw) in narr_nospace for kw in SHOP_KEYWORDS[3:]):
        return True, "Card Swipe POS Terminal Settlement"

    # 3. Micro test/verification transactions (<= ₹10)
    if amount <= 10.0:
        return True, f"Micro Test/Verification Amount (₹{amount:.2f})"

    # 4. Small retail purchases (< ₹500) without explicit exam keywords
    # Trinity examination fees are always >= ₹3,000 per student
    has_exam_keyword = any(kw in narr_upper for kw in EXAM_KEYWORDS)
    if amount < 500.0 and not has_exam_keyword:
        return True, f"Small Retail Shop Purchase (< ₹500: ₹{amount:.2f})"

    # 5. Obvious shop retail items (e.g. bridge, strings, repair) with low amounts
    if any(kw in narr_upper for kw in ["/BRIDGE/", "VIOL", "STRINGS", "REPAIR"]) and amount < 2000.0 and not has_exam_keyword:
        return True, "Retail Shop Item / Repair"

    return False, "Potential Trinity Deposit"
