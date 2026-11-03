
from sqlalchemy import Boolean, Column, DateTime, String

from core.clock import now
from core.database import TABLE_OPTS, Base
from models.common import id_col

# admin: tài khoản quản trị hệ thống của Phòng KHTC (tạo từ .env, dùng lần đầu để cấp tài khoản cho cán bộ).
# canbo, qtnl, daumoi: tài khoản dùng chung của bản cũ, đã thôi dùng (bản 0003 khóa lại, giữ để tra lịch sử).
ACCOUNT_KINDS = ("admin", "canbo", "qtnl", "daumoi")


class Account(Base):
    """Tài khoản hệ thống. Cán bộ, giảng viên đăng nhập bằng tài khoản cá nhân trong bảng staff."""

    __tablename__ = "accounts"
    __table_args__ = TABLE_OPTS

    id = id_col()
    kind = Column(String(16), nullable=False, unique=True)
    username = Column(String(64), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=now)
    updated_at = Column(DateTime, nullable=False, default=now, onupdate=now)


class AuthSession(Base):
    """Phiên đăng nhập trên một thiết bị: giữ bản băm của Refresh Token (cookie HTTP-Only).
    Hiện chưa đặt thời hạn (mục VII đề tài): phiên còn đến khi đăng xuất, đổi, đặt lại mật khẩu hoặc bị khóa tài khoản.
    subject_kind staff: cán bộ (bảng staff); account: tài khoản hệ thống (bảng accounts)."""

    __tablename__ = "auth_sessions"
    __table_args__ = TABLE_OPTS

    id = id_col()
    subject_kind = Column(String(8), nullable=False)
    subject_id = Column(String(36), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True)
    user_agent = Column(String(255), nullable=False, default="")
    ip = Column(String(64), nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=now)
    last_used_at = Column(DateTime, nullable=False, default=now)
    revoked_at = Column(DateTime, nullable=True)
