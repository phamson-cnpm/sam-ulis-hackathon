"""Xác thực Bearer Access Token và phân quyền theo vai trò (bảng phân quyền mục VII đề tài)."""
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.errors import forbidden, unauthorized
from core.security import decode_token
from models import Account, Staff, UnitFocal

security_bearer = HTTPBearer(auto_error=False)


@dataclass
class Actor:
    """Người đang thao tác. kind staff: cán bộ đăng nhập bằng tài khoản cá nhân; account: tài khoản hệ thống admin."""

    kind: str
    role: str  # khtc | canbo | ktv | lanhdao_qtnl | daumoi
    user: dict
    session_id: str
    account: Optional[Account] = None
    staff: Optional[Staff] = None
    focal: Optional[UnitFocal] = None  # mã đầu mối đang dùng của cán bộ đầu mối

    @property
    def id(self) -> str:
        """Id ghi vào các cột người thao tác: id cán bộ hoặc id tài khoản hệ thống."""
        return self.user["id"]

    @property
    def name(self) -> str:
        return self.user["name"]

    @property
    def unit(self) -> str:
        return self.user.get("unit") or ""

    @property
    def must_change_password(self) -> bool:
        return bool(self.staff is not None and self.staff.must_change_password)


async def get_account_actor(
    credentials: HTTPAuthorizationCredentials = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> Actor:
    """Đã đăng nhập (kể cả khi còn phải đổi mật khẩu lần đầu)."""
    from services.auth_service import resolve

    if not credentials:
        raise unauthorized("Chưa đăng nhập", "no_token")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise unauthorized("Phiên làm việc đã hết hạn", "token_expired")
    return Actor(**await resolve(db, payload))


def require(*roles: str):
    """Dependency: đã đổi mật khẩu lần đầu và có một trong các vai trò (để trống là mọi vai trò)."""

    async def dep(actor: Actor = Depends(get_account_actor)) -> Actor:
        if actor.must_change_password:
            raise forbidden("Đổi mật khẩu ban đầu trước khi làm việc", "password_change_required")
        if roles and actor.role not in roles:
            raise forbidden()
        return actor

    return dep


def confirm_code(x_confirm_code: Optional[str] = Header(default=None, alias="X-Confirm-Code")) -> Optional[str]:
    """Mã xác nhận cá nhân gửi kèm thao tác quan trọng (giao diện hỏi mã khi máy chủ trả 428 code_required)."""
    return x_confirm_code


# Các nhóm vai trò hay dùng
ANY_PERSON = require()
KHTC = require("khtc")
QTNL = require("ktv", "lanhdao_qtnl")
QTNL_LEADER = require("lanhdao_qtnl")
QTNL_OR_KHTC = require("ktv", "lanhdao_qtnl", "khtc")
