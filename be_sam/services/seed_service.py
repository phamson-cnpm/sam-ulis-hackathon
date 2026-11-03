
"""Khởi tạo lần chạy đầu. KHÔNG có dữ liệu giả lập: chỉ tạo tài khoản quản trị hệ thống của Phòng KHTC (mật khẩu trong
.env) và ngưỡng mặc định theo mục 5.3 đề tài. Tài sản, dữ liệu cán bộ và tài khoản cá nhân của cán bộ do Phòng KHTC nhập,
cấp; danh mục do Phòng QTNL nhập."""
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core.security import hash_password
from models import Account, Threshold

logger = logging.getLogger("uvicorn.error")


def _account_specs():
    # Bản cũ có thêm ba tài khoản dùng chung (canbo, qtnl, daumoi); nay mỗi cán bộ một tài khoản cá nhân nên không tạo.
    return [("admin", settings.ADMIN_USERNAME, settings.ADMIN_PASSWORD, settings.ADMIN_DISPLAY_NAME)]


async def ensure_accounts(db: AsyncSession) -> None:
    """Tạo tài khoản quản trị hệ thống nếu chưa có. Đã có thì giữ nguyên mật khẩu đang dùng."""
    existing = {a.kind for a in (await db.execute(select(Account))).scalars()}
    for kind, username, password, display in _account_specs():
        if kind in existing:
            continue
        if not password:
            logger.warning("Chưa đặt mật khẩu cho tài khoản %s (%s) trong .env nên chưa tạo.", kind, username)
            continue
        db.add(Account(kind=kind, username=username, password_hash=hash_password(password), display_name=display))
        logger.info("Đã tạo tài khoản %s (%s).", kind, username)


async def ensure_thresholds(db: AsyncSession) -> None:
    if await db.get(Threshold, 1) is None:
        db.add(
            Threshold(id=1, red_pct=20, orange_pct=30, orange_count=3, repeat_count=2, warehouse_months=12, cumulative_pct=40)
        )


async def run_seed(db: AsyncSession) -> None:
    await ensure_accounts(db)
    await ensure_thresholds(db)
    await db.commit()
