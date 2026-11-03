
from sqlalchemy import BigInteger, Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from core.database import TABLE_OPTS, Base
from models.common import actor_col, id_col


class Notification(Base):
    """Thông báo trong phần mềm. user_id: id cán bộ hoặc id tài khoản admin nhận thông báo."""

    __tablename__ = "notifications"
    __table_args__ = TABLE_OPTS

    id = id_col()
    user_id = Column(String(36), nullable=False, index=True)
    at = Column(DateTime, nullable=False, index=True)
    text = Column(Text, nullable=False)
    read = Column(Boolean, nullable=False, default=False)
    # Màn hình mở khi bấm thông báo (trong chuông hoặc thông báo đẩy), dạng "tab:id", ví dụ "queue:<id phiếu>"
    link = Column(String(96), nullable=True)


class FocalLog(Base):
    """Nhật ký theo mã đầu mối: nhập mã, xem, tải Excel, in, tải Word."""

    __tablename__ = "focal_logs"
    __table_args__ = TABLE_OPTS

    id = id_col()
    at = Column(DateTime, nullable=False, index=True)
    focal_id = Column(String(36), ForeignKey("unit_focals.id"), nullable=False, index=True)
    unit = Column(String(191), nullable=False)
    name = Column(String(191), nullable=False)  # cán bộ đầu mối đang giữ mã lúc thao tác
    action = Column(String(16), nullable=False, index=True)
    detail = Column(Text, nullable=True)


class ExportLog(Base):
    """Nhật ký in, tải Word, tải Excel của Phòng QTNL (theo người đã nhập mã) và Phòng KHTC (theo tài khoản)."""

    __tablename__ = "export_logs"
    __table_args__ = TABLE_OPTS

    id = id_col()
    at = Column(DateTime, nullable=False, index=True)
    user_id = actor_col(index=True)
    name = Column(String(191), nullable=False)
    role = Column(String(16), nullable=False)
    unit = Column(String(191), nullable=False, default="")
    action = Column(String(16), nullable=False)
    detail = Column(Text, nullable=True)


class StoredFile(Base):
    """Tệp tải lên: bản quét biên bản kiểm tra, dự toán đã ký, biên bản giao nhận."""

    __tablename__ = "files"
    __table_args__ = TABLE_OPTS

    id = id_col()
    original_name = Column(String(255), nullable=False)
    stored_path = Column(String(512), nullable=False)
    mime = Column(String(128), nullable=False, default="application/octet-stream")
    size = Column(BigInteger, nullable=False, default=0)
    uploaded_by = actor_col()
    uploaded_at = Column(DateTime, nullable=False)


class CodeCounter(Base):
    """Bộ đếm cấp số phiếu (PH-2026-, DOT-, BB-, DT-, NL-, TH-, BG-, DC-TT-, SC-). Khóa dòng khi cấp nên không trùng số."""

    __tablename__ = "code_counters"
    __table_args__ = TABLE_OPTS

    prefix = Column(String(32), primary_key=True)
    value = Column(Integer, nullable=False, default=0)


class AppSetting(Base):
    """Giá trị chung, ví dụ ngày chốt số liệu sổ sách của lần nhập tài sản gần nhất."""

    __tablename__ = "app_settings"
    __table_args__ = TABLE_OPTS

    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=True)
