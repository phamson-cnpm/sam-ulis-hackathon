
"""Xử lý chữ tiếng Việt: bỏ dấu, khóa sắp xếp, viết tắt tên đơn vị."""
import re
import unicodedata


def fold(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.replace("đ", "d").replace("Đ", "D")


def vi_key(s: str):
    """Sắp xếp gần với localeCompare('vi'): so theo chữ bỏ dấu trước, rồi theo chữ gốc."""
    return (fold(s).lower(), str(s or ""))


def unit_abbr(unit: str) -> str:
    """Viết tắt tên đơn vị làm tiền tố mã đầu mối: Khoa NN&VH Anh → ANH; Phòng Đào tạo & Người học → DTNH."""
    s = re.sub(r"^(Khoa|Phòng|Trung tâm|Viện|Ban)\s+", "", str(unit or "").strip(), flags=re.I)
    s = re.sub(r"^NN&VH\s+", "", s)
    words = [w for w in re.split(r"[\s&,\-–]+", fold(s)) if w and w.isalnum()]
    if not words:
        return "DV"
    if len(words) == 1:
        return words[0][:6].upper()
    return "".join(w[0] for w in words)[:6].upper()
