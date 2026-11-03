
"""Các bảng dữ liệu SAM, bản ngày 27/10/2026 (30 bảng).

Cơ sở dữ liệu tạo trước khi dùng Alembic bằng file SQL gửi ngày 27/10 (cấu trúc bảng này):
backend tự ghi nhận đang ở bản này rồi nâng cấp tiếp (core/migrate.py).

Revision ID: 0001
Revises: 
Create Date: 2026-10-28 09:04:18.474162
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('accounts',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('username', sa.String(length=64), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('display_name', sa.String(length=255), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('kind'),
    sa.UniqueConstraint('username'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('app_settings',
    sa.Column('key', sa.String(length=64), nullable=False),
    sa.Column('value', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('key'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('asset_groups',
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.PrimaryKeyConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('code_counters',
    sa.Column('prefix', sa.String(length=32), nullable=False),
    sa.Column('value', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('prefix'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('export_logs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('at', sa.DateTime(), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=True),
    sa.Column('name', sa.String(length=191), nullable=False),
    sa.Column('role', sa.String(length=16), nullable=False),
    sa.Column('unit', sa.String(length=191), nullable=False),
    sa.Column('action', sa.String(length=16), nullable=False),
    sa.Column('detail', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_export_logs_at'), 'export_logs', ['at'], unique=False)
    op.create_index(op.f('ix_export_logs_user_id'), 'export_logs', ['user_id'], unique=False)
    op.create_table('fault_items',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('group_code', sa.String(length=16), nullable=False),
    sa.Column('text', sa.String(length=255), nullable=False),
    sa.Column('sort', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('group_code', 'text', name='uq_fault_group_text'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_fault_items_group_code'), 'fault_items', ['group_code'], unique=False)
    op.create_table('files',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('original_name', sa.String(length=255), nullable=False),
    sa.Column('stored_path', sa.String(length=512), nullable=False),
    sa.Column('mime', sa.String(length=128), nullable=False),
    sa.Column('size', sa.BigInteger(), nullable=False),
    sa.Column('uploaded_by', sa.String(length=36), nullable=True),
    sa.Column('uploaded_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('notifications',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.String(length=36), nullable=False),
    sa.Column('at', sa.DateTime(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('read', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_notifications_at'), 'notifications', ['at'], unique=False)
    op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
    op.create_table('repair_jobs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=16), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('cost_group', sa.String(length=16), nullable=False),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('situations',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('text', sa.String(length=255), nullable=False),
    sa.Column('urgent', sa.Boolean(), nullable=False),
    sa.Column('sort', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('text'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('threshold_logs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('at', sa.DateTime(), nullable=False),
    sa.Column('by', sa.String(length=36), nullable=True),
    sa.Column('field', sa.String(length=32), nullable=False),
    sa.Column('old_value', sa.Integer(), nullable=True),
    sa.Column('new_value', sa.Integer(), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_threshold_logs_at'), 'threshold_logs', ['at'], unique=False)
    op.create_table('thresholds',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('red_pct', sa.Integer(), nullable=False),
    sa.Column('orange_pct', sa.Integer(), nullable=False),
    sa.Column('orange_count', sa.Integer(), nullable=False),
    sa.Column('repeat_count', sa.Integer(), nullable=False),
    sa.Column('warehouse_months', sa.Integer(), nullable=False),
    sa.Column('cumulative_pct', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('units',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('name', sa.String(length=191), nullable=False),
    sa.Column('abbr', sa.String(length=16), nullable=True),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('assets',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=64), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('group_code', sa.String(length=16), nullable=False),
    sa.Column('in_use_date', sa.Date(), nullable=True),
    sa.Column('location', sa.String(length=64), nullable=False),
    sa.Column('unit', sa.String(length=191), nullable=False),
    sa.Column('original_cost', sa.BigInteger(), nullable=False),
    sa.Column('depreciation_months', sa.Integer(), nullable=True),
    sa.Column('accumulated_depreciation', sa.BigInteger(), nullable=False),
    sa.Column('residual_value', sa.BigInteger(), nullable=False),
    sa.Column('funding_source', sa.String(length=32), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('last_interaction_date', sa.Date(), nullable=True),
    sa.Column('total_loss_confirmed_at', sa.Date(), nullable=True),
    sa.Column('disposal_light', sa.String(length=16), nullable=True),
    sa.Column('disposal_year', sa.Integer(), nullable=True),
    sa.Column('recall_light', sa.String(length=16), nullable=True),
    sa.Column('recalled_at', sa.Date(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['group_code'], ['asset_groups.code'], onupdate='CASCADE'),
    sa.ForeignKeyConstraint(['unit'], ['units.name'], onupdate='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_assets_group_code'), 'assets', ['group_code'], unique=False)
    op.create_index(op.f('ix_assets_location'), 'assets', ['location'], unique=False)
    op.create_index(op.f('ix_assets_name'), 'assets', ['name'], unique=False)
    op.create_index(op.f('ix_assets_status'), 'assets', ['status'], unique=False)
    op.create_index(op.f('ix_assets_unit'), 'assets', ['unit'], unique=False)
    op.create_table('repair_job_groups',
    sa.Column('job_id', sa.String(length=36), nullable=False),
    sa.Column('group_code', sa.String(length=16), nullable=False),
    sa.ForeignKeyConstraint(['group_code'], ['asset_groups.code'], onupdate='CASCADE'),
    sa.ForeignKeyConstraint(['job_id'], ['repair_jobs.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('job_id', 'group_code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_table('staff',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('staff_code', sa.String(length=32), nullable=True),
    sa.Column('name', sa.String(length=191), nullable=False),
    sa.Column('unit', sa.String(length=191), nullable=False),
    sa.Column('position', sa.String(length=191), nullable=False),
    sa.Column('phone', sa.String(length=32), nullable=False),
    sa.Column('email', sa.String(length=191), nullable=False),
    sa.Column('group', sa.String(length=16), nullable=False),
    sa.Column('code_hash', sa.String(length=64), nullable=True),
    sa.Column('code_enc', sa.String(length=255), nullable=True),
    sa.Column('created_by', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['unit'], ['units.name'], onupdate='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code_hash'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_staff_name'), 'staff', ['name'], unique=False)
    op.create_index(op.f('ix_staff_staff_code'), 'staff', ['staff_code'], unique=False)
    op.create_index(op.f('ix_staff_unit'), 'staff', ['unit'], unique=False)
    op.create_table('reports',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('batch_code', sa.String(length=32), nullable=False),
    sa.Column('reporter_id', sa.String(length=36), nullable=True),
    sa.Column('reporter_name', sa.String(length=191), nullable=False),
    sa.Column('reporter_unit', sa.String(length=191), nullable=False),
    sa.Column('account_id', sa.String(length=36), nullable=True),
    sa.Column('phone', sa.String(length=32), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('source', sa.String(length=16), nullable=False),
    sa.Column('asset_id', sa.String(length=36), nullable=True),
    sa.Column('asset_name', sa.String(length=255), nullable=False),
    sa.Column('location', sa.String(length=64), nullable=False),
    sa.Column('content', sa.Text(), nullable=False),
    sa.Column('situation', sa.String(length=255), nullable=False),
    sa.Column('urgent', sa.Boolean(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('technician_id', sa.String(length=36), nullable=True),
    sa.Column('has_temp_equipment', sa.Boolean(), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_reports_account_id'), 'reports', ['account_id'], unique=False)
    op.create_index(op.f('ix_reports_asset_id'), 'reports', ['asset_id'], unique=False)
    op.create_index(op.f('ix_reports_batch_code'), 'reports', ['batch_code'], unique=False)
    op.create_index(op.f('ix_reports_created_at'), 'reports', ['created_at'], unique=False)
    op.create_index(op.f('ix_reports_reporter_id'), 'reports', ['reporter_id'], unique=False)
    op.create_index(op.f('ix_reports_status'), 'reports', ['status'], unique=False)
    op.create_index(op.f('ix_reports_technician_id'), 'reports', ['technician_id'], unique=False)
    op.create_table('unit_focals',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('unit', sa.String(length=191), nullable=False),
    sa.Column('abbr', sa.String(length=16), nullable=False),
    sa.Column('staff_id', sa.String(length=36), nullable=True),
    sa.Column('name', sa.String(length=191), nullable=False),
    sa.Column('position', sa.String(length=191), nullable=False),
    sa.Column('phone', sa.String(length=32), nullable=False),
    sa.Column('code_hash', sa.String(length=64), nullable=False),
    sa.Column('code_enc', sa.String(length=255), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('issued_at', sa.DateTime(), nullable=False),
    sa.Column('issued_by', sa.String(length=36), nullable=True),
    sa.Column('revoked_at', sa.DateTime(), nullable=True),
    sa.Column('revoked_by', sa.String(length=36), nullable=True),
    sa.Column('revoke_reason', sa.String(length=255), nullable=True),
    sa.ForeignKeyConstraint(['staff_id'], ['staff.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['unit'], ['units.name'], onupdate='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code_hash'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_unit_focals_staff_id'), 'unit_focals', ['staff_id'], unique=False)
    op.create_index(op.f('ix_unit_focals_status'), 'unit_focals', ['status'], unique=False)
    op.create_index(op.f('ix_unit_focals_unit'), 'unit_focals', ['unit'], unique=False)
    op.create_table('focal_logs',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('at', sa.DateTime(), nullable=False),
    sa.Column('focal_id', sa.String(length=36), nullable=False),
    sa.Column('unit', sa.String(length=191), nullable=False),
    sa.Column('name', sa.String(length=191), nullable=False),
    sa.Column('action', sa.String(length=16), nullable=False),
    sa.Column('detail', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['focal_id'], ['unit_focals.id'], ),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_focal_logs_action'), 'focal_logs', ['action'], unique=False)
    op.create_index(op.f('ix_focal_logs_at'), 'focal_logs', ['at'], unique=False)
    op.create_index(op.f('ix_focal_logs_focal_id'), 'focal_logs', ['focal_id'], unique=False)
    op.create_table('inspections',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('report_id', sa.String(length=36), nullable=False),
    sa.Column('asset_id', sa.String(length=36), nullable=False),
    sa.Column('inspected_at', sa.DateTime(), nullable=True),
    sa.Column('technician_id', sa.String(length=36), nullable=True),
    sa.Column('findings', sa.Text(), nullable=False),
    sa.Column('target', sa.String(length=16), nullable=False),
    sa.Column('proposal', sa.String(length=16), nullable=False),
    sa.Column('proposal_note', sa.Text(), nullable=True),
    sa.Column('temp_solution', sa.Text(), nullable=True),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('total_loss_status', sa.String(length=16), nullable=True),
    sa.Column('total_loss_by', sa.String(length=36), nullable=True),
    sa.Column('total_loss_at', sa.DateTime(), nullable=True),
    sa.Column('total_loss_return_reason', sa.Text(), nullable=True),
    sa.Column('scan_file_id', sa.String(length=36), nullable=True),
    sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ),
    sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ),
    sa.ForeignKeyConstraint(['scan_file_id'], ['files.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_inspections_asset_id'), 'inspections', ['asset_id'], unique=False)
    op.create_index(op.f('ix_inspections_report_id'), 'inspections', ['report_id'], unique=False)
    op.create_index(op.f('ix_inspections_total_loss_status'), 'inspections', ['total_loss_status'], unique=False)
    op.create_table('no_spares',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('report_id', sa.String(length=36), nullable=False),
    sa.Column('asset_id', sa.String(length=36), nullable=True),
    sa.Column('group_code', sa.String(length=16), nullable=False),
    sa.Column('need', sa.String(length=255), nullable=False),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('situation', sa.String(length=255), nullable=False),
    sa.Column('recorded_by', sa.String(length=36), nullable=True),
    sa.Column('recorded_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ),
    sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_no_spares_group_code'), 'no_spares', ['group_code'], unique=False)
    op.create_index(op.f('ix_no_spares_recorded_at'), 'no_spares', ['recorded_at'], unique=False)
    op.create_index(op.f('ix_no_spares_report_id'), 'no_spares', ['report_id'], unique=False)
    op.create_table('recalls',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('asset_id', sa.String(length=36), nullable=False),
    sa.Column('report_id', sa.String(length=36), nullable=False),
    sa.Column('basis', sa.String(length=16), nullable=False),
    sa.Column('basis_note', sa.String(length=255), nullable=False),
    sa.Column('plan', sa.String(length=16), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.Column('to_location', sa.String(length=64), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('proposed_by', sa.String(length=36), nullable=True),
    sa.Column('proposed_at', sa.DateTime(), nullable=False),
    sa.Column('decided_by', sa.String(length=36), nullable=True),
    sa.Column('decided_at', sa.DateTime(), nullable=True),
    sa.Column('reject_reason', sa.Text(), nullable=True),
    sa.Column('handover_id', sa.String(length=36), nullable=True),
    sa.Column('transfer_no', sa.String(length=64), nullable=True),
    sa.Column('transfer_date', sa.Date(), nullable=True),
    sa.Column('completed_by', sa.String(length=36), nullable=True),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ),
    sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_recalls_asset_id'), 'recalls', ['asset_id'], unique=False)
    op.create_index(op.f('ix_recalls_proposed_at'), 'recalls', ['proposed_at'], unique=False)
    op.create_index(op.f('ix_recalls_report_id'), 'recalls', ['report_id'], unique=False)
    op.create_index(op.f('ix_recalls_status'), 'recalls', ['status'], unique=False)
    op.create_table('temp_transfers',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('report_id', sa.String(length=36), nullable=False),
    sa.Column('original_asset_id', sa.String(length=36), nullable=True),
    sa.Column('replacement_asset_id', sa.String(length=36), nullable=True),
    sa.Column('source', sa.String(length=16), nullable=False),
    sa.Column('use_location', sa.String(length=64), nullable=False),
    sa.Column('expected_return', sa.String(length=255), nullable=False),
    sa.Column('receiver_name', sa.String(length=191), nullable=False),
    sa.Column('receiver_unit', sa.String(length=191), nullable=False),
    sa.Column('created_by', sa.String(length=36), nullable=True),
    sa.Column('issued_at', sa.DateTime(), nullable=True),
    sa.Column('returned_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['original_asset_id'], ['assets.id'], ),
    sa.ForeignKeyConstraint(['replacement_asset_id'], ['assets.id'], ),
    sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_temp_transfers_original_asset_id'), 'temp_transfers', ['original_asset_id'], unique=False)
    op.create_index(op.f('ix_temp_transfers_replacement_asset_id'), 'temp_transfers', ['replacement_asset_id'], unique=False)
    op.create_index(op.f('ix_temp_transfers_report_id'), 'temp_transfers', ['report_id'], unique=False)
    op.create_table('estimates',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('created_at', sa.Date(), nullable=False),
    sa.Column('asset_id', sa.String(length=36), nullable=False),
    sa.Column('inspection_id', sa.String(length=36), nullable=True),
    sa.Column('report_id', sa.String(length=36), nullable=True),
    sa.Column('created_by', sa.String(length=36), nullable=True),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('locked', sa.Boolean(), nullable=False),
    sa.Column('light_before', sa.String(length=16), nullable=True),
    sa.Column('light_after', sa.String(length=16), nullable=True),
    sa.Column('confirmed_by', sa.String(length=36), nullable=True),
    sa.Column('confirmed_at', sa.DateTime(), nullable=True),
    sa.Column('return_reason', sa.Text(), nullable=True),
    sa.Column('signed_scan_id', sa.String(length=36), nullable=True),
    sa.Column('voucher_no', sa.String(length=64), nullable=True),
    sa.Column('voucher_date', sa.Date(), nullable=True),
    sa.Column('actual_entered_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ),
    sa.ForeignKeyConstraint(['inspection_id'], ['inspections.id'], ),
    sa.ForeignKeyConstraint(['report_id'], ['reports.id'], ),
    sa.ForeignKeyConstraint(['signed_scan_id'], ['files.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_estimates_asset_id'), 'estimates', ['asset_id'], unique=False)
    op.create_index(op.f('ix_estimates_created_at'), 'estimates', ['created_at'], unique=False)
    op.create_index(op.f('ix_estimates_inspection_id'), 'estimates', ['inspection_id'], unique=False)
    op.create_index(op.f('ix_estimates_report_id'), 'estimates', ['report_id'], unique=False)
    op.create_index(op.f('ix_estimates_status'), 'estimates', ['status'], unique=False)
    op.create_table('handovers',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('kind', sa.String(length=16), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('created_by', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('giver_unit', sa.String(length=191), nullable=False),
    sa.Column('receiver_unit', sa.String(length=191), nullable=False),
    sa.Column('place', sa.String(length=64), nullable=False),
    sa.Column('scan_file_id', sa.String(length=36), nullable=True),
    sa.Column('recall_id', sa.String(length=36), nullable=True),
    sa.Column('applied', sa.Boolean(), nullable=False),
    sa.Column('applied_at', sa.DateTime(), nullable=True),
    sa.Column('applied_by', sa.String(length=36), nullable=True),
    sa.Column('transfer_no', sa.String(length=64), nullable=False),
    sa.ForeignKeyConstraint(['recall_id'], ['recalls.id'], ),
    sa.ForeignKeyConstraint(['scan_file_id'], ['files.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_handovers_date'), 'handovers', ['date'], unique=False)
    op.create_index(op.f('ix_handovers_kind'), 'handovers', ['kind'], unique=False)
    op.create_index(op.f('ix_handovers_recall_id'), 'handovers', ['recall_id'], unique=False)
    # Khóa ngoại vòng recalls <-> handovers: thêm khi đã có đủ hai bảng
    op.create_foreign_key('fk_recalls_handover', 'recalls', 'handovers', ['handover_id'], ['id'])
    op.create_table('estimate_history',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('estimate_id', sa.String(length=36), nullable=False),
    sa.Column('at', sa.DateTime(), nullable=False),
    sa.Column('by', sa.String(length=36), nullable=True),
    sa.Column('action', sa.String(length=255), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['estimate_id'], ['estimates.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_estimate_history_estimate_id'), 'estimate_history', ['estimate_id'], unique=False)
    op.create_table('estimate_lines',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('estimate_id', sa.String(length=36), nullable=False),
    sa.Column('sort', sa.Integer(), nullable=False),
    sa.Column('job_id', sa.String(length=36), nullable=True),
    sa.Column('content', sa.String(length=255), nullable=False),
    sa.Column('cost_group', sa.String(length=16), nullable=False),
    sa.Column('estimate', sa.BigInteger(), nullable=False),
    sa.Column('actual', sa.BigInteger(), nullable=True),
    sa.ForeignKeyConstraint(['estimate_id'], ['estimates.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['job_id'], ['repair_jobs.id'], ),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_estimate_lines_estimate_id'), 'estimate_lines', ['estimate_id'], unique=False)
    op.create_table('exceptions',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('code', sa.String(length=32), nullable=False),
    sa.Column('estimate_id', sa.String(length=36), nullable=False),
    sa.Column('asset_id', sa.String(length=36), nullable=False),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('extra_time', sa.String(length=255), nullable=False),
    sa.Column('temp_equipment', sa.String(length=255), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('created_by', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('doc_no', sa.String(length=64), nullable=True),
    sa.Column('doc_date', sa.Date(), nullable=True),
    sa.Column('conclusion', sa.Text(), nullable=True),
    sa.Column('decided_by', sa.String(length=36), nullable=True),
    sa.Column('decided_at', sa.DateTime(), nullable=True),
    sa.Column('scan_file_id', sa.String(length=36), nullable=True),
    sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ),
    sa.ForeignKeyConstraint(['estimate_id'], ['estimates.id'], ),
    sa.ForeignKeyConstraint(['scan_file_id'], ['files.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_exceptions_asset_id'), 'exceptions', ['asset_id'], unique=False)
    op.create_index(op.f('ix_exceptions_estimate_id'), 'exceptions', ['estimate_id'], unique=False)
    op.create_index(op.f('ix_exceptions_status'), 'exceptions', ['status'], unique=False)
    op.create_table('handover_items',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('handover_id', sa.String(length=36), nullable=False),
    sa.Column('sort', sa.Integer(), nullable=False),
    sa.Column('asset_id', sa.String(length=36), nullable=False),
    sa.Column('uom', sa.String(length=32), nullable=False),
    sa.Column('qty', sa.Integer(), nullable=False),
    sa.Column('note', sa.Text(), nullable=True),
    sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ),
    sa.ForeignKeyConstraint(['handover_id'], ['handovers.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_handover_items_asset_id'), 'handover_items', ['asset_id'], unique=False)
    op.create_index(op.f('ix_handover_items_handover_id'), 'handover_items', ['handover_id'], unique=False)
    op.create_table('handover_people',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('handover_id', sa.String(length=36), nullable=False),
    sa.Column('side', sa.String(length=8), nullable=False),
    sa.Column('sort', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=191), nullable=False),
    sa.Column('unit', sa.String(length=191), nullable=False),
    sa.ForeignKeyConstraint(['handover_id'], ['handovers.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    mysql_charset='utf8mb4',
    mysql_collate='utf8mb4_unicode_ci',
    mysql_engine='InnoDB'
    )
    op.create_index(op.f('ix_handover_people_handover_id'), 'handover_people', ['handover_id'], unique=False)


def downgrade() -> None:
    # Xóa bảng là xóa luôn chỉ mục (MySQL không cho xóa riêng chỉ mục đang dùng cho khóa ngoại)
    op.drop_constraint('fk_recalls_handover', 'recalls', type_='foreignkey')
    op.drop_table('handover_people')
    op.drop_table('handover_items')
    op.drop_table('exceptions')
    op.drop_table('estimate_lines')
    op.drop_table('estimate_history')
    op.drop_table('handovers')
    op.drop_table('estimates')
    op.drop_table('temp_transfers')
    op.drop_table('recalls')
    op.drop_table('no_spares')
    op.drop_table('inspections')
    op.drop_table('focal_logs')
    op.drop_table('unit_focals')
    op.drop_table('reports')
    op.drop_table('staff')
    op.drop_table('repair_job_groups')
    op.drop_table('assets')
    op.drop_table('units')
    op.drop_table('thresholds')
    op.drop_table('threshold_logs')
    op.drop_table('situations')
    op.drop_table('repair_jobs')
    op.drop_table('notifications')
    op.drop_table('files')
    op.drop_table('fault_items')
    op.drop_table('export_logs')
    op.drop_table('code_counters')
    op.drop_table('asset_groups')
    op.drop_table('app_settings')
    op.drop_table('accounts')
