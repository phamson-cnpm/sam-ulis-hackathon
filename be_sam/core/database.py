
import asyncio
import logging
from typing import AsyncGenerator

import pymysql
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from config import settings

logger = logging.getLogger("uvicorn.error")

Base = declarative_base()

# Mọi bảng: InnoDB, utf8mb4 (tiếng Việt có dấu)
TABLE_OPTS = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"}

engine = create_async_engine(
    settings.async_database_url,
    echo=settings.SQL_ECHO,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


def ensure_database_exists() -> None:
    """Tạo cơ sở dữ liệu nếu chưa có (kết nối đồng bộ bằng pymysql trước khi chạy engine async)."""
    conn = pymysql.connect(
        host=settings.MYSQL_HOST,
        port=settings.MYSQL_PORT,
        user=settings.MYSQL_USER,
        password=settings.MYSQL_PASSWORD,
        charset="utf8mb4",
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{settings.MYSQL_DB}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            )
        conn.commit()
    finally:
        conn.close()


async def init_db() -> None:
    """Tạo cơ sở dữ liệu nếu chưa có, rồi đưa cấu trúc bảng lên bản mới nhất bằng Alembic (alembic/versions/)."""
    from core.migrate import upgrade_to_head

    ensure_database_exists()
    await asyncio.to_thread(upgrade_to_head)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Mỗi request một phiên: xong thì commit, lỗi thì hoàn tác toàn bộ. Thông báo đẩy về điện thoại chỉ gửi sau khi
    lưu thành công (lỗi thì không gửi), chạy nền để không làm chậm phản hồi."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            session.info.pop("push", None)
            await session.rollback()
            raise
        queued = session.info.pop("push", None)
        if queued:
            from services.push_service import schedule

            schedule(queued)
