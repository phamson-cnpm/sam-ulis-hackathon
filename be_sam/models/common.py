
import uuid

from sqlalchemy import Column, String


def new_id() -> str:
    return str(uuid.uuid4())


def id_col():
    return Column(String(36), primary_key=True, default=new_id)


def actor_col(**kw):
    """Người thao tác: id cán bộ (staff), id cán bộ đầu mối (unit_focals) hoặc id tài khoản admin (accounts)."""
    return Column(String(36), nullable=True, **kw)
