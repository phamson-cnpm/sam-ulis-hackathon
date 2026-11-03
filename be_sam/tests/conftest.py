
"""Chạy kiểm tra trên một cơ sở dữ liệu riêng (mặc định sam_test), xóa và tạo lại mỗi lần chạy.
Thông tin kết nối lấy từ biến môi trường TEST_MYSQL_* (không dùng cơ sở dữ liệu thật)."""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

os.environ.update(
    {
        "MYSQL_HOST": os.environ.get("TEST_MYSQL_HOST", "127.0.0.1"),
        "MYSQL_PORT": os.environ.get("TEST_MYSQL_PORT", "3306"),
        "MYSQL_USER": os.environ.get("TEST_MYSQL_USER", "root"),
        "MYSQL_PASSWORD": os.environ.get("TEST_MYSQL_PASSWORD", ""),
        "MYSQL_DB": os.environ.get("TEST_MYSQL_DB", "sam_test"),
        "ADMIN_USERNAME": "khtc",
        "ADMIN_PASSWORD": "admin-pass",
        "AS_OF_DATE": "2026-10-24",
        "DEBUG": "false",
        # Máy khách kiểm tra chạy http://test: cookie Secure sẽ không được gửi lại nên tắt khi kiểm tra
        "COOKIE_SECURE": "false",
        # Không gửi thông báo đẩy thật ra ngoài khi kiểm tra (test_push kiểm tra riêng phần gửi)
        "PUSH_ENABLED": "false",
    }
)

import pymysql  # noqa: E402
import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from config import settings  # noqa: E402


def _recreate_test_db():
    assert settings.MYSQL_DB.endswith("_test"), "Chỉ chạy kiểm tra trên cơ sở dữ liệu có tên kết thúc bằng _test"
    conn = pymysql.connect(
        host=settings.MYSQL_HOST, port=settings.MYSQL_PORT, user=settings.MYSQL_USER, password=settings.MYSQL_PASSWORD
    )
    with conn.cursor() as cur:
        cur.execute(f"DROP DATABASE IF EXISTS `{settings.MYSQL_DB}`")
    conn.commit()
    conn.close()


@pytest.fixture(scope="session", autouse=True)
async def database():
    from core.database import AsyncSessionLocal, engine, init_db
    from services.seed_service import run_seed

    _recreate_test_db()
    await init_db()
    async with AsyncSessionLocal() as db:
        await run_seed(db)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
def _reset_limits():
    from services.auth_service import reset_limits

    reset_limits()
    yield
    reset_limits()


@pytest.fixture
async def client():
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def db():
    from core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        yield session


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
