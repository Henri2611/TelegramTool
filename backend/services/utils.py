import re


def clean_phone(phone: str) -> str:
    cleaned = re.sub(r"[^\d]", "", phone)
    cleaned = "+" + cleaned
    return cleaned
