"""Xóa cán bộ khỏi danh sách (02/11/2026): cán bộ đã có lịch sử thì ẩn (staff.deleted_at, deleted_by), giữ dòng để
lịch sử phiếu, nhật ký vẫn hiện đúng tên; cán bộ chưa có lịch sử thì xóa hẳn (không cần cột mới).

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0004'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('staff', sa.Column('deleted_at', sa.DateTime(), nullable=True))
    op.add_column('staff', sa.Column('deleted_by', sa.String(length=36), nullable=True))


def downgrade() -> None:
    op.drop_column('staff', 'deleted_by')
    op.drop_column('staff', 'deleted_at')
