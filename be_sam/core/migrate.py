
"""Đưa cấu trúc bảng lên bản mới nhất bằng Alembic (giống lệnh `alembic upgrade head`).
Backend tự chạy mỗi khi khởi động (core/database.py init_db), nên cập nhật mã nguồn rồi chạy lại là xong."""
import logging
import os

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, pool

from config import BASE_DIR, settings

logger = logging.getLogger("uvicorn.error")


def alembic_config() -> Config:
    cfg = Config(os.path.join(BASE_DIR, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BASE_DIR, "alembic"))
    cfg.attributes["configure_logger"] = False  # giữ nguyên nhật ký của uvicorn
    return cfg


def upgrade_to_head() -> None:
    engine = create_engine(settings.sync_database_url, poolclass=pool.NullPool)
    try:
        with engine.connect() as conn:
            tables = set(inspect(conn).get_table_names())
    finally:
        engine.dispose()
    cfg = alembic_config()
    if "alembic_version" not in tables and "assets" in tables:
        # Cơ sở dữ liệu tạo trước khi dùng Alembic (file SQL ngày 27/10, 28/10 hoặc bản backend tự tạo bảng):
        # ghi nhận đang ở bản nào rồi nâng cấp tiếp, không tạo lại bảng
        current = "0002" if "disposal_decisions" in tables else "0001"
        logger.info("Cơ sở dữ liệu có sẵn bảng, chưa có Alembic: ghi nhận bản %s.", current)
        command.stamp(cfg, current)
    command.upgrade(cfg, "head")
    logger.info("Cấu trúc bảng đã ở bản mới nhất (alembic upgrade head).")
