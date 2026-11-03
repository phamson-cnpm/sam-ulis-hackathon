
from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from core.database import TABLE_OPTS, Base
from models.common import id_col


class FaultItem(Base):
    """Nội dung báo hỏng hay gặp theo nhóm tài sản; group_code rỗng là Danh sách chung."""

    __tablename__ = "fault_items"
    __table_args__ = (UniqueConstraint("group_code", "text", name="uq_fault_group_text"), TABLE_OPTS)

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_code = Column(String(16), nullable=False, default="", index=True)
    text = Column(String(255), nullable=False)
    sort = Column(Integer, nullable=False, default=0)


class Situation(Base):
    """Tình huống đang xảy ra; mục khẩn cấp đứng đầu danh sách."""

    __tablename__ = "situations"
    __table_args__ = TABLE_OPTS

    id = Column(Integer, primary_key=True, autoincrement=True)
    text = Column(String(255), nullable=False, unique=True)
    urgent = Column(Boolean, nullable=False, default=False)
    sort = Column(Integer, nullable=False, default=0)


class RepairJob(Base):
    """Nội dung công việc sửa chữa, thay thế. cost_group: tinh (tính vào đèn) | khong_tinh (bảo dưỡng, vật tư)."""

    __tablename__ = "repair_jobs"
    __table_args__ = TABLE_OPTS

    id = id_col()
    code = Column(String(16), nullable=False, unique=True)
    name = Column(String(255), nullable=False)
    cost_group = Column(String(16), nullable=False, default="tinh")
    active = Column(Boolean, nullable=False, default=True)

    groups = relationship("RepairJobGroup", lazy="selectin", cascade="all, delete-orphan")


class RepairJobGroup(Base):
    """Công việc áp dụng cho nhóm tài sản nào; không có dòng nào là mọi nhóm."""

    __tablename__ = "repair_job_groups"
    __table_args__ = TABLE_OPTS

    job_id = Column(String(36), ForeignKey("repair_jobs.id", ondelete="CASCADE"), primary_key=True)
    group_code = Column(String(16), ForeignKey("asset_groups.code", onupdate="CASCADE"), primary_key=True)
