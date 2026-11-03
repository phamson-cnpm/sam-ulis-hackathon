"""Bổ sung ngày 30/10/2026 theo góp ý (mục 5.6, 5.8, 5.9, VII đề tài).

1. Tài khoản cá nhân: mỗi cán bộ một tài khoản do Phòng KHTC cấp (cột username, password_hash, active,
   must_change_password, last_login_at của bảng staff); phiên đăng nhập trên từng thiết bị giữ bản băm Refresh Token
   (bảng auth_sessions). Thôi dùng tài khoản chung (canbo, qtnl, daumoi): khóa lại, giữ dòng để tra lịch sử.
2. Bỏ nhóm "lãnh đạo đơn vị": chuyển về cán bộ, giảng viên. Cán bộ đang giữ mã đầu mối có vai trò đầu mối;
   phiếu, thông báo của bản cũ ghi theo id mã đầu mối thì chuyển sang id cán bộ đầu mối.
3. Đề xuất xử lý tài sản (cột Đề xuất): bảng proposals, proposal_history.
4. Thông báo đẩy về điện thoại (Web Push): bảng push_subscriptions; cột notifications.link (màn hình mở khi bấm).

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0003'
down_revision: Union[str, None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('auth_sessions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('subject_kind', sa.String(length=8), nullable=False),
    sa.Column('subject_id', sa.String(length=36), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('user_agent', sa.String(length=255), nullable=False),
    sa.Column('ip', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('last_used_at', sa.DateTime(), nullable=False),
    sa.Column('revoked_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_auth_sessions_subject_id'), 'auth_sessions', ['subject_id'], unique=False)
    op.create_table('push_subscriptions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('endpoint', sa.Text(), nullable=False),
    sa.Column('endpoint_hash', sa.String(length=64), nullable=False),
    sa.Column('p256dh', sa.String(length=255), nullable=False),
    sa.Column('auth', sa.String(length=255), nullable=False),
    sa.Column('user_agent', sa.String(length=255), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('last_error', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('endpoint_hash'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_push_subscriptions_user_id'), 'push_subscriptions', ['user_id'], unique=False)
    op.create_table('proposals',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('batch_code', sa.String(length=32), nullable=True),
    sa.Column('asset_id', sa.String(length=36), nullable=False),
    sa.Column('unit', sa.String(length=191), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('created_by', sa.String(length=36), nullable=True),
    sa.Column('created_role', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('tech_id', sa.String(length=36), nullable=True),
    sa.Column('tech_opinion', sa.String(length=16), nullable=True),
    sa.Column('tech_note', sa.Text(), nullable=True),
    sa.Column('tech_at', sa.DateTime(), nullable=True),
    sa.Column('decided_by', sa.String(length=36), nullable=True),
    sa.Column('decided_at', sa.DateTime(), nullable=True),
    sa.Column('decision_note', sa.Text(), nullable=True),
    sa.Column('received_by', sa.String(length=36), nullable=True),
    sa.Column('received_at', sa.DateTime(), nullable=True),
    sa.Column('status_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_proposals_asset_id'), 'proposals', ['asset_id'], unique=False)
    op.create_index(op.f('ix_proposals_batch_code'), 'proposals', ['batch_code'], unique=False)
    op.create_index(op.f('ix_proposals_created_at'), 'proposals', ['created_at'], unique=False)
    op.create_index(op.f('ix_proposals_created_by'), 'proposals', ['created_by'], unique=False)
    op.create_index(op.f('ix_proposals_status'), 'proposals', ['status'], unique=False)
    op.create_table('proposal_history',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('proposal_id', sa.String(length=36), nullable=False),
    sa.Column('at', sa.DateTime(), nullable=False),
    sa.Column('by', sa.String(length=36), nullable=True),
    sa.Column('action', sa.String(length=255), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['proposal_id'], ['proposals.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_proposal_history_proposal_id'), 'proposal_history', ['proposal_id'], unique=False)
    op.add_column('staff', sa.Column('username', sa.String(length=64), nullable=True))
    op.add_column('staff', sa.Column('password_hash', sa.String(length=255), nullable=True))
    op.add_column('staff', sa.Column('active', sa.Boolean(), server_default=sa.text('true'), nullable=False))
    op.add_column('staff', sa.Column('must_change_password', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('staff', sa.Column('last_login_at', sa.DateTime(), nullable=True))
    op.create_unique_constraint('username', 'staff', ['username'])
    op.add_column('notifications', sa.Column('link', sa.String(length=96), nullable=True))

    # Dữ liệu: bỏ nhóm lãnh đạo đơn vị; cán bộ giữ mã đầu mối có vai trò đầu mối
    op.execute("UPDATE staff SET `group` = 'canbo' WHERE `group` = 'lanhdao_dv'")
    op.execute(
        "UPDATE staff s JOIN unit_focals f ON f.staff_id = s.id AND f.status = 'dang_dung' "
        "SET s.`group` = 'daumoi' WHERE s.`group` = 'canbo'"
    )
    # Phiếu, thông báo của tài khoản đầu mối dùng chung: chuyển từ id mã đầu mối sang id cán bộ
    for table, col in (("reports", "reporter_id"), ("reports", "account_id"), ("notifications", "user_id")):
        op.execute(
            f"UPDATE {table} t JOIN unit_focals f ON t.{col} = f.id SET t.{col} = f.staff_id WHERE f.staff_id IS NOT NULL"
        )
    # Thôi dùng tài khoản chung
    op.execute("UPDATE accounts SET active = 0 WHERE kind IN ('canbo', 'qtnl', 'daumoi')")


def downgrade() -> None:
    op.execute("UPDATE accounts SET active = 1 WHERE kind IN ('canbo', 'qtnl', 'daumoi')")
    op.drop_column('notifications', 'link')
    op.drop_constraint('username', 'staff', type_='unique')
    op.drop_column('staff', 'last_login_at')
    op.drop_column('staff', 'must_change_password')
    op.drop_column('staff', 'active')
    op.drop_column('staff', 'password_hash')
    op.drop_column('staff', 'username')
    # Xóa bảng là xóa luôn chỉ mục (chỉ mục của khóa ngoại không xóa riêng được)
    op.drop_table('proposal_history')
    op.drop_table('proposals')
    op.drop_table('push_subscriptions')
    op.drop_table('auth_sessions')
