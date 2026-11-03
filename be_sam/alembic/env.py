
"""Alembic dùng kết nối MySQL trong .env (config.py) và các bảng khai báo trong models/."""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

import models  # noqa: F401  nạp model để đăng ký với Base.metadata
from config import settings
from core.database import Base

config = context.config
# Chạy bằng lệnh alembic thì in nhật ký; backend tự chạy lúc khởi động thì giữ nguyên nhật ký của uvicorn
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name, disable_existing_loggers=False)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """alembic upgrade head --sql: in câu lệnh SQL ra màn hình, không chạy."""
    context.configure(
        url=settings.sync_database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def _run(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connection = config.attributes.get("connection")
    if connection is not None:
        _run(connection)
        return
    engine = create_engine(settings.sync_database_url, poolclass=pool.NullPool)
    with engine.connect() as conn:
        _run(conn)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
