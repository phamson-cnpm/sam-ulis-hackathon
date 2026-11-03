
from sqlalchemy import BigInteger, Column, Date, DateTime, ForeignKey, Integer, String, Text

from core.clock import now
from core.database import TABLE_OPTS, Base
from models.common import actor_col, id_col

ASSET_STATUSES = ("dang_su_dung", "thu_hoi_kho", "da_thanh_ly")


class Asset(Base):
    """Tài sản theo mã tem. Số liệu sổ sách (nguyên giá, hao mòn, GTCL) do Phòng KHTC nhập từ phần mềm quản lý tài sản."""

    __tablename__ = "assets"
    __table_args__ = TABLE_OPTS

    id = id_col()
    code = Column(String(64), nullable=False, unique=True)  # mã tem
    name = Column(String(255), nullable=False, index=True)
    group_code = Column(String(16), ForeignKey("asset_groups.code", onupdate="CASCADE"), nullable=False, index=True)
    in_use_date = Column(Date, nullable=True)
    location = Column(String(64), nullable=False, default="", index=True)
    unit = Column(String(191), ForeignKey("units.name", onupdate="CASCADE"), nullable=False, index=True)
    original_cost = Column(BigInteger, nullable=False, default=0)
    depreciation_months = Column(Integer, nullable=True)
    accumulated_depreciation = Column(BigInteger, nullable=False, default=0)
    residual_value = Column(BigInteger, nullable=False, default=0)
    funding_source = Column(String(32), nullable=False, default="")
    status = Column(String(16), nullable=False, default="dang_su_dung", index=True)
    # Ngày tương tác gần nhất (báo hỏng, cấp tạm, bàn giao): tính số tháng nằm kho cho đèn Vàng 3.1
    last_interaction_date = Column(Date, nullable=True)
    total_loss_confirmed_at = Column(Date, nullable=True)
    # Phòng KHTC quyết định với tài sản chờ thanh lý (mục 5.3 đề tài): ngày thanh lý, ngày loại khỏi danh sách
    disposed_at = Column(Date, nullable=True)
    disposal_cleared_at = Column(Date, nullable=True)
    # Màu đèn lúc thu hồi về kho (giữ màu khi chờ phương án xử lý)
    recall_light = Column(String(16), nullable=True)
    recalled_at = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False, default=now)
    updated_at = Column(DateTime, nullable=False, default=now, onupdate=now)


class DisposalDecision(Base):
    """Quyết định của Phòng KHTC với tài sản chờ thanh lý. decision: thanh_ly | loai_khoi_danh_sach."""

    __tablename__ = "disposal_decisions"
    __table_args__ = TABLE_OPTS

    id = id_col()
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=False, index=True)
    decision = Column(String(24), nullable=False)
    basis = Column(String(255), nullable=False)  # căn cứ: số, ngày văn bản
    note = Column(Text, nullable=True)
    light_before = Column(String(16), nullable=True)
    by = actor_col()
    at = Column(DateTime, nullable=False, index=True)


class Threshold(Base):
    """Ngưỡng cảnh báo do Phòng KHTC đặt; chỉ một dòng id = 1. Mặc định theo mục 5.3 đề tài."""

    __tablename__ = "thresholds"
    __table_args__ = TABLE_OPTS

    id = Column(Integer, primary_key=True)
    red_pct = Column(Integer, nullable=False, default=20)
    orange_pct = Column(Integer, nullable=False, default=30)
    orange_count = Column(Integer, nullable=False, default=3)
    repeat_count = Column(Integer, nullable=False, default=2)
    warehouse_months = Column(Integer, nullable=False, default=12)
    cumulative_pct = Column(Integer, nullable=False, default=40)


class ThresholdLog(Base):
    __tablename__ = "threshold_logs"
    __table_args__ = TABLE_OPTS

    id = id_col()
    at = Column(DateTime, nullable=False, index=True)
    by = actor_col()
    field = Column(String(32), nullable=False)
    old_value = Column(Integer, nullable=True)
    new_value = Column(Integer, nullable=True)
