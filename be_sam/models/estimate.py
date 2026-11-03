
from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from core.database import TABLE_OPTS, Base
from models.common import actor_col, id_col

# Phiếu "khong_dong_y" không tính vào số lần sửa và chi phí
ESTIMATE_STATUSES = ("cho_lanh_dao", "can_kiem_tra_lai", "da_xac_nhan", "da_ky_du", "khong_dong_y")


class Estimate(Base):
    """Phiếu dự toán sửa chữa, thay thế: mỗi mã tài sản một phiếu. Gửi lãnh đạo rồi thì không sửa trực tiếp."""

    __tablename__ = "estimates"
    __table_args__ = TABLE_OPTS

    id = id_col()
    code = Column(String(32), nullable=False, unique=True)
    created_at = Column(Date, nullable=False, index=True)
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=False, index=True)
    inspection_id = Column(String(36), ForeignKey("inspections.id"), nullable=True, index=True)
    report_id = Column(String(36), ForeignKey("reports.id"), nullable=True, index=True)
    created_by = actor_col()
    status = Column(String(16), nullable=False, default="cho_lanh_dao", index=True)
    locked = Column(Boolean, nullable=False, default=False)
    light_before = Column(String(16), nullable=True)
    light_after = Column(String(16), nullable=True)
    confirmed_by = actor_col()
    confirmed_at = Column(DateTime, nullable=True)
    return_reason = Column(Text, nullable=True)
    signed_scan_id = Column(String(36), ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    voucher_no = Column(String(64), nullable=True)
    voucher_date = Column(Date, nullable=True)
    voucher_total = Column(BigInteger, nullable=True)  # tổng tiền hóa đơn; hóa đơn gộp nhiều mã thì tổng các mã phải khớp
    actual_entered_at = Column(DateTime, nullable=True)

    lines = relationship("EstimateLine", order_by="EstimateLine.sort", lazy="selectin", cascade="all, delete-orphan")
    history = relationship("EstimateHistory", order_by="EstimateHistory.id", lazy="selectin", cascade="all, delete-orphan")
    signed_scan = relationship("StoredFile", lazy="selectin")


class EstimateLine(Base):
    """Dòng dự toán. cost_group tinh: tính vào số lần sửa và chi phí xét đèn; khong_tinh: ghi riêng."""

    __tablename__ = "estimate_lines"
    __table_args__ = TABLE_OPTS

    id = id_col()
    estimate_id = Column(String(36), ForeignKey("estimates.id", ondelete="CASCADE"), nullable=False, index=True)
    sort = Column(Integer, nullable=False, default=0)
    job_id = Column(String(36), ForeignKey("repair_jobs.id"), nullable=True)
    content = Column(String(255), nullable=False)
    cost_group = Column(String(16), nullable=False, default="tinh")
    estimate = Column(BigInteger, nullable=False, default=0)
    actual = Column(BigInteger, nullable=True)


class EstimateHistory(Base):
    """Lịch sử lập, trả lại, sửa, gửi lại, xác nhận: không tạo phiếu mới nên không tính trùng số lần sửa."""

    __tablename__ = "estimate_history"
    __table_args__ = TABLE_OPTS

    id = Column(Integer, primary_key=True, autoincrement=True)  # số tăng dần: giữ đúng thứ tự thao tác trong cùng một phút
    estimate_id = Column(String(36), ForeignKey("estimates.id", ondelete="CASCADE"), nullable=False, index=True)
    at = Column(DateTime, nullable=False)
    by = actor_col()
    action = Column(String(255), nullable=False)
    note = Column(Text, nullable=True)


class ExceptionRequest(Base):
    """Đề nghị ngoại lệ khi phiếu dự toán bị khóa (Đỏ 1.1, Cam). status: cho_mo_khoa | da_mo_khoa | khong_dong_y."""

    __tablename__ = "exceptions"
    __table_args__ = TABLE_OPTS

    id = id_col()
    code = Column(String(32), nullable=False, unique=True)
    estimate_id = Column(String(36), ForeignKey("estimates.id"), nullable=False, index=True)
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=False, index=True)
    reason = Column(Text, nullable=False)
    extra_time = Column(String(255), nullable=False, default="")
    temp_equipment = Column(String(255), nullable=False, default="")
    status = Column(String(16), nullable=False, default="cho_mo_khoa", index=True)
    created_by = actor_col()
    created_at = Column(DateTime, nullable=False)
    doc_no = Column(String(64), nullable=True)
    doc_date = Column(Date, nullable=True)
    conclusion = Column(Text, nullable=True)
    decided_by = actor_col()
    decided_at = Column(DateTime, nullable=True)
    # Bản quét văn bản phê duyệt có đủ chữ ký (Phòng KHTC đính kèm khi mở khóa)
    scan_file_id = Column(String(36), ForeignKey("files.id", ondelete="SET NULL"), nullable=True)

    scan_file = relationship("StoredFile", lazy="selectin")
