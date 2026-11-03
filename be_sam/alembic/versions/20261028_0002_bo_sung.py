
"""Bổ sung ngày 28/10/2026 theo đề tài.

1. Tài sản chờ thanh lý: Phòng KHTC quyết định thanh lý hoặc loại khỏi danh sách (mục 5.3).
   Đèn đỏ giữ sang năm mới do máy chủ tính từ dữ liệu, bỏ hai cột disposal_light, disposal_year (chưa dùng).
2. Gộp phiếu báo hỏng trùng một sự cố (mục 5.3).
3. Tổng tiền hóa đơn khi một hóa đơn gộp nhiều mã tài sản (mục 5.5).

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE_OPTS = {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci", "mysql_engine": "InnoDB"}


def upgrade() -> None:
    # 1. Danh sách chờ thanh lý
    op.drop_column("assets", "disposal_light")
    op.drop_column("assets", "disposal_year")
    op.add_column("assets", sa.Column("disposed_at", sa.Date(), nullable=True))
    op.add_column("assets", sa.Column("disposal_cleared_at", sa.Date(), nullable=True))
    op.create_table(
        "disposal_decisions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("asset_id", sa.String(length=36), nullable=False),
        sa.Column("decision", sa.String(length=24), nullable=False),
        sa.Column("basis", sa.String(length=255), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("light_before", sa.String(length=16), nullable=True),
        sa.Column("by", sa.String(length=36), nullable=True),
        sa.Column("at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"]),
        sa.PrimaryKeyConstraint("id"),
        **TABLE_OPTS,
    )
    op.create_index(op.f("ix_disposal_decisions_asset_id"), "disposal_decisions", ["asset_id"], unique=False)
    op.create_index(op.f("ix_disposal_decisions_at"), "disposal_decisions", ["at"], unique=False)

    # 2. Gộp phiếu trùng
    op.add_column("reports", sa.Column("merged_into_id", sa.String(length=36), nullable=True))
    op.add_column("reports", sa.Column("merged_by", sa.String(length=36), nullable=True))
    op.add_column("reports", sa.Column("merged_at", sa.DateTime(), nullable=True))
    op.create_index(op.f("ix_reports_merged_into_id"), "reports", ["merged_into_id"], unique=False)
    op.create_foreign_key("fk_reports_merged_into", "reports", "reports", ["merged_into_id"], ["id"])

    # 3. Tổng tiền hóa đơn
    op.add_column("estimates", sa.Column("voucher_total", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("estimates", "voucher_total")

    op.drop_constraint("fk_reports_merged_into", "reports", type_="foreignkey")
    op.drop_index(op.f("ix_reports_merged_into_id"), table_name="reports")
    op.drop_column("reports", "merged_at")
    op.drop_column("reports", "merged_by")
    op.drop_column("reports", "merged_into_id")

    op.drop_table("disposal_decisions")  # xóa bảng là xóa luôn chỉ mục
    op.drop_column("assets", "disposal_cleared_at")
    op.drop_column("assets", "disposed_at")
    op.add_column("assets", sa.Column("disposal_light", sa.String(length=16), nullable=True))
    op.add_column("assets", sa.Column("disposal_year", sa.Integer(), nullable=True))
