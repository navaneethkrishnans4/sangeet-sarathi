from dataclasses import dataclass
from datetime import datetime
from typing import Optional

def parse_amount(text: str) -> float:
    if not text:
        return 0.0
    try:
        return float(str(text).replace(",", "").strip())
    except Exception:
        return 0.0

def month_name_from_date(dt: datetime) -> str:
    return dt.strftime("%B")
