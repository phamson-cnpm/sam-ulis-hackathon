
"""Cấp số phiếu tăng dần theo tiền tố: PH-2026-0001, DOT-0001, BB-0001, DT-0001, NL-0001, TH-0001, BG-0001,
DC-TT-0001, SC-001. Dòng bộ đếm bị khóa đến hết giao dịch, nên hai người gửi cùng lúc không bị trùng số."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def next_code(db: AsyncSession, prefix: str, width: int = 4) -> str:
    await db.execute(
        text(
            "INSERT INTO code_counters (prefix, value) VALUES (:p, 1) "
            "ON DUPLICATE KEY UPDATE value = value + 1"
        ),
        {"p": prefix},
    )
    value = (await db.execute(text("SELECT value FROM code_counters WHERE prefix = :p"), {"p": prefix})).scalar_one()
    return f"{prefix}{str(value).zfill(width)}"
