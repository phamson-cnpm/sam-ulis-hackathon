
"""Hàm dùng chung cho các nghiệp vụ."""
import datetime as dt
from typing import Iterable, Optional, Type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import clock
from core.errors import bad, not_found
from models import Account, Notification, Staff, StoredFile


async def get_or_404(db: AsyncSession, model: Type, id_: Optional[str], message: str):
    obj = await db.get(model, id_) if id_ else None
    if obj is None:
        raise not_found(message)
    return obj


async def user_ids_with_role(db: AsyncSession, role: str) -> list:
    """Người nhận thông báo theo vai trò: Phòng KHTC là tài khoản quản trị hệ thống và cán bộ có vai trò quản trị;
    kỹ thuật viên, lãnh đạo Phòng QTNL theo vai trò trên tài khoản cá nhân (dữ liệu cán bộ)."""
    ids = list((await db.execute(select(Staff.id).where(Staff.group == role, Staff.active.is_(True)))).scalars())
    if role == "khtc":
        ids += list((await db.execute(select(Account.id).where(Account.kind == "admin", Account.active.is_(True)))).scalars())
    return ids


async def notify(db: AsyncSession, user_ids: Iterable[Optional[str]], text: str, link: Optional[str] = None) -> None:
    """Thông báo trong chuông; đồng thời xếp hàng thông báo đẩy về các thiết bị đã bật chuông (gửi sau khi lưu xong,
    xem core.database.get_db). link: màn hình mở khi bấm, dạng "tab:id"."""
    at = clock.now()
    ids = list(dict.fromkeys(u for u in user_ids if u))
    for uid in ids:
        db.add(Notification(user_id=uid, at=at, text=text, read=False, link=link))
    if ids:
        db.info.setdefault("push", []).append((ids, text, link))


async def notify_role(db: AsyncSession, role: str, text: str, link: Optional[str] = None) -> None:
    await notify(db, await user_ids_with_role(db, role), text, link)


def parse_dt(value: Optional[str]) -> Optional[dt.datetime]:
    """Nhận '2026-10-24T09:30' hoặc '2026-10-24'."""
    if not value:
        return None
    try:
        v = str(value).strip()
        return dt.datetime.fromisoformat(v if "T" in v or " " in v else v + "T00:00").replace(second=0, microsecond=0)
    except ValueError:
        raise bad("Ngày giờ không đúng định dạng")


def parse_date(value: Optional[str]) -> Optional[dt.date]:
    if not value:
        return None
    try:
        return dt.date.fromisoformat(str(value).strip()[:10])
    except ValueError:
        raise bad("Ngày không đúng định dạng")


async def file_or_none(db: AsyncSession, file_id: Optional[str]) -> Optional[StoredFile]:
    """Tệp vừa tải lên (bản quét); không có id thì bỏ qua."""
    if not file_id:
        return None
    f = await db.get(StoredFile, file_id)
    if f is None:
        raise bad("Không tìm thấy tệp đã tải lên, tải lại tệp")
    return f


def clean(text: Optional[str]) -> str:
    return " ".join(str(text or "").split())
