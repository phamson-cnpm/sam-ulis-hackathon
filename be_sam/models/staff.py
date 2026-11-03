
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, false, true

from core.clock import now
from core.database import TABLE_OPTS, Base
from models.common import actor_col, id_col

# Vai trò trên SAM (cột group của dữ liệu cán bộ, Phòng KHTC thiết lập). Mọi tài khoản đều có quyền của cán bộ,
# giảng viên (báo hỏng, theo dõi phiếu của mình); vai trò cấp thêm quyền. Không có vai trò "lãnh đạo đơn vị":
# đơn vị làm việc với SAM qua cán bộ đầu mối (mục 5.8 đề tài).
STAFF_GROUPS = ("canbo", "daumoi", "ktv", "lanhdao_qtnl", "khtc")
QTNL_GROUPS = ("ktv", "lanhdao_qtnl")


class Staff(Base):
    """Dữ liệu cán bộ và tài khoản cá nhân (mỗi cán bộ một tài khoản do Phòng KHTC cấp, mục VII đề tài).
    Kỹ thuật viên, lãnh đạo Phòng QTNL có mã xác nhận cá nhân ở đây; mã của cán bộ đầu mối ở unit_focals."""

    __tablename__ = "staff"
    __table_args__ = TABLE_OPTS

    id = id_col()
    staff_code = Column(String(32), nullable=True, index=True)
    name = Column(String(191), nullable=False, index=True)
    unit = Column(String(191), ForeignKey("units.name", onupdate="CASCADE"), nullable=False, index=True)
    position = Column(String(191), nullable=False, default="")
    phone = Column(String(32), nullable=False, default="")
    email = Column(String(191), nullable=False, default="")
    group = Column(String(16), nullable=False, default="canbo")
    code_hash = Column(String(64), nullable=True, unique=True)
    code_enc = Column(String(255), nullable=True)
    # Tài khoản cá nhân: chưa có password_hash là chưa được cấp tài khoản
    username = Column(String(64), nullable=True, unique=True)
    password_hash = Column(String(255), nullable=True)
    active = Column(Boolean, nullable=False, default=True, server_default=true())
    must_change_password = Column(Boolean, nullable=False, default=False, server_default=false())
    last_login_at = Column(DateTime, nullable=True)
    # Xóa khỏi danh sách cán bộ khi đã có lịch sử (phiếu, nhật ký...): ẩn đi, giữ dòng để lịch sử vẫn hiện đúng tên.
    # Chưa có lịch sử thì xóa hẳn dòng (people_service.staff_delete).
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = actor_col()
    created_by = actor_col()
    created_at = Column(DateTime, nullable=False, default=now)
    updated_at = Column(DateTime, nullable=False, default=now, onupdate=now)


class UnitFocal(Base):
    """Cán bộ đầu mối của đơn vị và mã xác nhận cá nhân của người đó: mỗi đơn vị một mã đang dùng; đổi người thì cấp
    mã mới, mã cũ hết hiệu lực. Cán bộ có mã đang dùng (staff_id) mới có vai trò đầu mối khi đăng nhập."""

    __tablename__ = "unit_focals"
    __table_args__ = TABLE_OPTS

    id = id_col()
    unit = Column(String(191), ForeignKey("units.name", onupdate="CASCADE"), nullable=False, index=True)
    abbr = Column(String(16), nullable=False)
    staff_id = Column(String(36), ForeignKey("staff.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(191), nullable=False)
    position = Column(String(191), nullable=False, default="")
    phone = Column(String(32), nullable=False, default="")
    code_hash = Column(String(64), nullable=False, unique=True)
    code_enc = Column(String(255), nullable=False)
    status = Column(String(16), nullable=False, default="dang_dung", index=True)  # dang_dung | da_thu_hoi
    issued_at = Column(DateTime, nullable=False)
    issued_by = actor_col()
    revoked_at = Column(DateTime, nullable=True)
    revoked_by = actor_col()
    revoke_reason = Column(String(255), nullable=True)
