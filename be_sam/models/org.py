
from sqlalchemy import Column, Integer, String

from core.database import TABLE_OPTS, Base


class Unit(Base):
    """Đơn vị quản lý, sử dụng. abbr là tiền tố mã đầu mối (ví dụ ANH-X2FQ)."""

    __tablename__ = "units"
    __table_args__ = TABLE_OPTS

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(191), nullable=False, unique=True)
    abbr = Column(String(16), nullable=True)


class AssetGroup(Base):
    """Nhóm tài sản theo mã nhóm của phần mềm quản lý tài sản (ví dụ 0416 Điều hòa)."""

    __tablename__ = "asset_groups"
    __table_args__ = TABLE_OPTS

    code = Column(String(16), primary_key=True)
    name = Column(String(255), nullable=False)
