from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from core.database import TABLE_OPTS, Base
from models.common import actor_col, id_col

# Đề xuất xử lý tài sản ở cột Đề xuất (mục 5.6 đề tài)
PROPOSAL_KINDS = ("thanh_ly", "dieu_chuyen", "thay_the")
# cho_lanh_dao → (cho_ky_thuat → cho_lanh_dao) → da_duyet → khtc_tiep_nhan; hoặc khong_duyet (bắt buộc lý do)
PROPOSAL_STATUSES = ("cho_lanh_dao", "cho_ky_thuat", "da_duyet", "khong_duyet", "khtc_tiep_nhan")
OPEN_STATUSES = ("cho_lanh_dao", "cho_ky_thuat", "da_duyet")


class Proposal(Base):
    """Đề xuất thanh lý, điều chuyển, thay thế một tài sản. Cán bộ đầu mối (tài sản đơn vị mình) hoặc kỹ thuật viên
    lập; lãnh đạo Phòng QTNL duyệt, giao kỹ thuật viên xem xét hoặc không duyệt kèm lý do; Phòng KHTC tiếp nhận.
    Đề xuất không làm đổi màu đèn. Mỗi tài sản chỉ có một đề xuất đang xử lý."""

    __tablename__ = "proposals"
    __table_args__ = TABLE_OPTS

    id = id_col()
    code = Column(String(32), nullable=False, unique=True)
    batch_code = Column(String(32), nullable=True, index=True)  # gửi nhiều tài sản một lần (danh sách đề xuất)
    asset_id = Column(String(36), ForeignKey("assets.id"), nullable=False, index=True)
    unit = Column(String(191), nullable=False, default="")  # đơn vị quản lý tài sản lúc đề xuất
    kind = Column(String(16), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(16), nullable=False, default="cho_lanh_dao", index=True)
    created_by = actor_col(index=True)
    created_role = Column(String(16), nullable=False, default="")
    created_at = Column(DateTime, nullable=False, index=True)
    tech_id = actor_col()  # kỹ thuật viên được giao xem xét
    tech_opinion = Column(String(16), nullable=True)  # dong_y | khong_dong_y | de_xuat_khac
    tech_note = Column(Text, nullable=True)
    tech_at = Column(DateTime, nullable=True)
    decided_by = actor_col()
    decided_at = Column(DateTime, nullable=True)
    decision_note = Column(Text, nullable=True)  # lý do không duyệt (bắt buộc) hoặc ghi chú khi duyệt
    received_by = actor_col()
    received_at = Column(DateTime, nullable=True)
    status_at = Column(DateTime, nullable=False)  # lúc chuyển sang trạng thái hiện tại (số ngày đã chờ)

    history = relationship("ProposalHistory", order_by="ProposalHistory.id", lazy="selectin", cascade="all, delete-orphan")


class ProposalHistory(Base):
    __tablename__ = "proposal_history"
    __table_args__ = TABLE_OPTS

    id = Column(Integer, primary_key=True, autoincrement=True)
    proposal_id = Column(String(36), ForeignKey("proposals.id", ondelete="CASCADE"), nullable=False, index=True)
    at = Column(DateTime, nullable=False)
    by = actor_col()
    action = Column(String(255), nullable=False)
    note = Column(Text, nullable=True)
