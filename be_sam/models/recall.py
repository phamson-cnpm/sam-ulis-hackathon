
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from core.database import TABLE_OPTS, Base
from models.common import actor_col, id_col


class Recall(Base):
    """Thu hồi tài sản hỏng về kho, 5 bước: Phòng QTNL đề nghị → Phòng KHTC xác nhận → biên bản giao nhận →
    Phòng KHTC nhập điều chuyển chính thức → về kho, chờ phương án xử lý, giữ màu đèn.
    status: cho_khtc | da_xac_nhan | da_giao_nhan | hoan_thanh | khong_dong_y.
    basis: hong_toan_phan | khong_duyet. plan: cho_thanh_ly | tan_dung | sua_sau."""

    __tablename__ = "recalls"
    __table_args__ = TABLE_OPTS

    id = id_col()
    code = Column(String(32), nullable=False, unique=True)
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=False, index=True)
    report_id = Column(String(36), ForeignKey("reports.id"), nullable=False, index=True)
    basis = Column(String(16), nullable=False)
    basis_note = Column(String(255), nullable=False, default="")
    plan = Column(String(16), nullable=False)
    note = Column(Text, nullable=True)
    to_location = Column(String(64), nullable=False, default="KHO.TB")
    status = Column(String(16), nullable=False, default="cho_khtc", index=True)
    proposed_by = actor_col()
    proposed_at = Column(DateTime, nullable=False, index=True)
    decided_by = actor_col()
    decided_at = Column(DateTime, nullable=True)
    reject_reason = Column(Text, nullable=True)
    handover_id = Column(String(36), ForeignKey("handovers.id", use_alter=True, name="fk_recalls_handover"), nullable=True)
    transfer_no = Column(String(64), nullable=True)
    transfer_date = Column(Date, nullable=True)
    completed_by = actor_col()
    completed_at = Column(DateTime, nullable=True)


class Handover(Base):
    """Biên bản bàn giao tài sản. kind: cap_phat | dieu_chuyen | thu_hoi.
    Cấp phát, điều chuyển: lưu là cập nhật đơn vị, vị trí; thu hồi: chỉ đổi sổ khi Phòng KHTC nhập điều chuyển."""

    __tablename__ = "handovers"
    __table_args__ = TABLE_OPTS

    id = id_col()
    code = Column(String(32), nullable=False, unique=True)
    kind = Column(String(16), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    created_by = actor_col()
    created_at = Column(DateTime, nullable=False)
    giver_unit = Column(String(191), nullable=False, default="")
    receiver_unit = Column(String(191), nullable=False, default="")
    place = Column(String(64), nullable=False, default="")
    scan_file_id = Column(String(36), ForeignKey("files.id", ondelete="SET NULL"), nullable=True)
    recall_id = Column(String(36), ForeignKey("recalls.id"), nullable=True, index=True)
    applied = Column(Boolean, nullable=False, default=False)
    applied_at = Column(DateTime, nullable=True)
    applied_by = actor_col()
    transfer_no = Column(String(64), nullable=False, default="")

    people = relationship("HandoverPerson", order_by="HandoverPerson.sort", lazy="selectin", cascade="all, delete-orphan")
    items = relationship("HandoverItem", order_by="HandoverItem.sort", lazy="selectin", cascade="all, delete-orphan")
    scan_file = relationship("StoredFile", lazy="selectin")


class HandoverPerson(Base):
    """Người ký bên giao (giver) và bên nhận (receiver)."""

    __tablename__ = "handover_people"
    __table_args__ = TABLE_OPTS

    id = Column(Integer, primary_key=True, autoincrement=True)
    handover_id = Column(String(36), ForeignKey("handovers.id", ondelete="CASCADE"), nullable=False, index=True)
    side = Column(String(8), nullable=False)  # giver | receiver
    sort = Column(Integer, nullable=False, default=0)
    name = Column(String(191), nullable=False)
    unit = Column(String(191), nullable=False, default="")


class HandoverItem(Base):
    __tablename__ = "handover_items"
    __table_args__ = TABLE_OPTS

    id = Column(Integer, primary_key=True, autoincrement=True)
    handover_id = Column(String(36), ForeignKey("handovers.id", ondelete="CASCADE"), nullable=False, index=True)
    sort = Column(Integer, nullable=False, default=0)
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=False, index=True)
    uom = Column(String(32), nullable=False, default="Cái")
    qty = Column(Integer, nullable=False, default=1)
    note = Column(Text, nullable=True)
