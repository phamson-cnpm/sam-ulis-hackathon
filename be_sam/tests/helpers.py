
"""Tạo dữ liệu cho bài kiểm tra ngay trong cơ sở dữ liệu kiểm tra (không dùng dữ liệu giả lập của fe_sam)."""
import uuid

from sqlalchemy import select

from core import clock
from core.security import code_hash, encrypt_code
from models import Staff, Unit, UnitFocal


async def ensure_unit(db, name: str, abbr: str | None = None) -> Unit:
    u = (await db.execute(select(Unit).where(Unit.name == name))).scalar_one_or_none()
    if not u:
        u = Unit(name=name, abbr=abbr)
        db.add(u)
        await db.flush()
    return u


async def make_staff(db, name: str, unit: str, group: str = "canbo", code: str | None = None, position: str = "") -> Staff:
    await ensure_unit(db, unit)
    s = Staff(id=str(uuid.uuid4()), name=name, unit=unit, group=group, position=position)
    if code:
        s.code_hash = code_hash(code)
        s.code_enc = encrypt_code(code)
    db.add(s)
    await db.commit()
    return s


async def make_focal(db, unit: str, abbr: str, name: str, code: str) -> UnitFocal:
    await ensure_unit(db, unit, abbr)
    f = UnitFocal(
        unit=unit,
        abbr=abbr,
        name=name,
        code_hash=code_hash(code),
        code_enc=encrypt_code(code),
        status="dang_dung",
        issued_at=clock.now(),
    )
    db.add(f)
    await db.commit()
    return f
