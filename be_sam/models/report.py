
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from core.database import TABLE_OPTS, Base
from models.common import actor_col, id_col


class Report(Base):
    """Phiếu báo hỏng: mỗi mã tài sản một phiếu, cùng mã đợt khi báo nhiều tài sản một lần.
    status: da_gui | dang_xu_ly | hoan_thanh. source: can_bo | qtnl.
    merged_into_id: phiếu trùng cùng một sự cố được kỹ thuật viên gộp vào phiếu chính, tính là một lần (mục 5.3)."""

    __tablename__ = "reports"
    __table_args__ = TABLE_OPTS

    id = id_col()
    code = Column(String(32), nullable=False, unique=True)
    batch_code = Column(String(32), nullable=False, index=True)
    reporter_id = actor_col(index=True)
    reporter_name = Column(String(191), nullable=False)
    reporter_unit = Column(String(191), nullable=False, default="")
    account_id = actor_col(index=True)  # tài khoản đã gửi phiếu
    phone = Column(String(32), nullable=False, default="")
    created_at = Column(DateTime, nullable=False, index=True)
    source = Column(String(16), nullable=False, default="can_bo")
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=True, index=True)
    asset_name = Column(String(255), nullable=False, default="")
    location = Column(String(64), nullable=False, default="")
    content = Column(Text, nullable=False)
    situation = Column(String(255), nullable=False, default="")
    urgent = Column(Boolean, nullable=False, default=False)
    status = Column(String(16), nullable=False, default="da_gui", index=True)
    technician_id = actor_col(index=True)
    has_temp_equipment = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime, nullable=True)
    merged_into_id = Column(String(36), ForeignKey("reports.id"), nullable=True, index=True)
    merged_by = actor_col()
    merged_at = Column(DateTime, nullable=True)


class Inspection(Base):
    """Biên bản kiểm tra kỹ thuật. target: tai_san | phu_kien. proposal: tai_cho | sua_chua | hong_toan_phan.
    total_loss_status: cho_xac_minh | da_xac_nhan | tra_lai (chỉ khi đề xuất hư hỏng toàn phần)."""

    __tablename__ = "inspections"
    __table_args__ = TABLE_OPTS

    id = id_col()
    code = Column(String(32), nullable=False, unique=True)
    report_id = Column(String(36), ForeignKey("reports.id"), nullable=False, index=True)
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=False, index=True)
    inspected_at = Column(DateTime, nullable=True)
    technician_id = actor_col()
    findings = Column(Text, nullable=False)
    target = Column(String(16), nullable=False, default="tai_san")
    proposal = Column(String(16), nullable=False)
    proposal_note = Column(Text, nullable=True)
    temp_solution = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    total_loss_status = Column(String(16), nullable=True, index=True)
    total_loss_by = actor_col()
    total_loss_at = Column(DateTime, nullable=True)
    total_loss_return_reason = Column(Text, nullable=True)
    scan_file_id = Column(String(36), ForeignKey("files.id", ondelete="SET NULL"), nullable=True)

    scan_file = relationship("StoredFile", lazy="selectin")


class TempTransfer(Base):
    """Phiếu điều chuyển tạm thời (cấp thiết bị thay thế khi phiếu khẩn cấp). source: kho_qtnl | don_vi_khac | doi_phong."""

    __tablename__ = "temp_transfers"
    __table_args__ = TABLE_OPTS

    id = id_col()
    code = Column(String(32), nullable=False, unique=True)
    report_id = Column(String(36), ForeignKey("reports.id"), nullable=False, index=True)
    original_asset_id = Column(String(36), ForeignKey("assets.id"), nullable=True, index=True)
    replacement_asset_id = Column(String(36), ForeignKey("assets.id"), nullable=True, index=True)
    source = Column(String(16), nullable=False, default="kho_qtnl")
    use_location = Column(String(64), nullable=False, default="")
    expected_return = Column(String(255), nullable=False, default="")
    receiver_name = Column(String(191), nullable=False, default="")
    receiver_unit = Column(String(191), nullable=False, default="")
    created_by = actor_col()
    issued_at = Column(DateTime, nullable=True)
    returned_at = Column(DateTime, nullable=True)


class NoSpare(Base):
    """Kho không có thiết bị thay thế: ghi nhận kèm lý do, làm dữ liệu cho kế hoạch mua sắm thiết bị dự phòng."""

    __tablename__ = "no_spares"
    __table_args__ = TABLE_OPTS

    id = id_col()
    report_id = Column(String(36), ForeignKey("reports.id"), nullable=False, index=True)
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=True)
    group_code = Column(String(16), nullable=False, default="", index=True)
    need = Column(String(255), nullable=False)
    reason = Column(Text, nullable=False)
    situation = Column(String(255), nullable=False, default="")
    recorded_by = actor_col()
    recorded_at = Column(DateTime, nullable=False, index=True)
