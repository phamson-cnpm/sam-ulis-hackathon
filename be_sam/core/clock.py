
"""Ngày giờ làm việc theo giờ Việt Nam. Lưu DATETIME không múi giờ (giờ Việt Nam)."""
import datetime as dt
from typing import Optional
from zoneinfo import ZoneInfo

from config import settings

_TZ = ZoneInfo(settings.TIMEZONE)


def now() -> dt.datetime:
    """Thời điểm hiện tại, chính xác đến phút như các phiếu trên fe_sam."""
    t = dt.datetime.now(_TZ).replace(tzinfo=None, second=0, microsecond=0)
    if settings.AS_OF_DATE:
        d = dt.date.fromisoformat(settings.AS_OF_DATE)
        t = t.replace(year=d.year, month=d.month, day=d.day)
    return t


def today() -> dt.date:
    return now().date()


def stamp(value: Optional[dt.datetime]) -> Optional[str]:
    """Định dạng giống fe_sam: 2026-10-24T09:30."""
    return value.strftime("%Y-%m-%dT%H:%M") if value else None


def day(value: Optional[dt.date]) -> Optional[str]:
    return value.isoformat() if value else None
