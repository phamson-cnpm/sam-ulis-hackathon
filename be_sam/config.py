
import os
from typing import List
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(BASE_DIR, ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "SAM - Quản lý tài sản thông minh API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    # Máy chủ web chuyển tiếp (nginx) được tin để lấy đúng địa chỉ máy người dùng từ X-Forwarded-For,
    # dùng cho việc tạm khóa khi nhập sai mật khẩu, sai mã nhiều lần. Nhiều địa chỉ cách nhau dấu phẩy, nhận cả dải.
    # 127.0.0.1: nginx cùng máy; 172.16.0.0/12: các mạng Docker (backend chạy bằng start.sh).
    FORWARDED_ALLOW_IPS: str = "127.0.0.1,172.16.0.0/12"
    API_V1_PREFIX: str = "/api/v1"

    # CORS: địa chỉ frontend fe_sam
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # MySQL / MariaDB
    MYSQL_HOST: str = "127.0.0.1"
    MYSQL_PORT: int = 3306
    MYSQL_USER: str = "root"
    MYSQL_PASSWORD: str = ""
    MYSQL_DB: str = "sam"
    SQL_ECHO: bool = False

    # JWT ký Access Token. Để trống thì tự sinh và lưu ở data/jwt_secret.key (giữ file này khi chuyển máy)
    JWT_SECRET: str = ""
    JWT_ALGORITHM: str = "HS256"

    # Đăng nhập theo mô hình Access Token + Refresh Token (mục VII đề tài):
    # Access Token trả trong JSON, giao diện chỉ giữ trong bộ nhớ, hạn ACCESS_TOKEN_MINUTES phút;
    # Refresh Token nằm trong cookie HTTP-Only, máy chủ chỉ lưu bản băm. REFRESH_TOKEN_DAYS=0: chưa đặt hạn
    # (giữ đăng nhập đến khi đăng xuất, đổi, đặt lại mật khẩu hoặc bị khóa) để cán bộ, giảng viên không phải đăng nhập lại.
    ACCESS_TOKEN_MINUTES: int = 15
    REFRESH_TOKEN_DAYS: int = 0
    REFRESH_COOKIE_NAME: str = "sam_refresh"
    # Secure: cookie chỉ gửi qua HTTPS (máy chủ thật). Chạy thử bằng http trên máy khác localhost thì đặt false.
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "strict"

    # Khóa mã hóa mã xác nhận cá nhân (Phòng KHTC xem lại được mã đã cấp).
    # Để trống thì tự sinh và lưu ở data/code_secret.key. MẤT KHÓA NÀY LÀ KHÔNG XEM LẠI ĐƯỢC MÃ ĐÃ CẤP.
    CODE_SECRET: str = ""

    # Tài khoản quản trị hệ thống của Phòng KHTC, tạo ở lần chạy đầu (để trống mật khẩu thì chưa tạo).
    # Dùng để cấp tài khoản cá nhân cho cán bộ; sau đó cán bộ Phòng KHTC được giao vai trò quản trị dùng tài khoản riêng.
    ADMIN_USERNAME: str = "khtc"
    ADMIN_PASSWORD: str = ""
    ADMIN_DISPLAY_NAME: str = "Phòng Kế hoạch - Tài chính"

    # Thông báo đẩy về điện thoại (Web Push, mục 5.9 đề tài). Khóa VAPID để trống thì tự sinh lần đầu, lưu trong bảng app_settings.
    # VAPID_SUBJECT: email liên hệ của đơn vị vận hành (dịch vụ đẩy của trình duyệt dùng khi cần báo lỗi).
    PUSH_ENABLED: bool = True
    VAPID_PRIVATE_KEY: str = ""
    VAPID_PUBLIC_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:khtc@ulis.vnu.edu.vn"

    # Tên đơn vị dùng trong nghiệp vụ (thu hồi tài sản hỏng về kho thì bên nhận là Phòng QTNL)
    QTNL_UNIT: str = "Phòng Quản trị nguồn lực"
    KHTC_UNIT: str = "Phòng Kế hoạch - Tài chính"

    # Ngày làm việc. Để trống là ngày thật theo giờ Việt Nam; chỉ đặt khi chạy kiểm tra.
    AS_OF_DATE: str = ""
    TIMEZONE: str = "Asia/Ho_Chi_Minh"

    # Tệp tải lên (bản quét biên bản, dự toán đã ký)
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 20

    @property
    def sync_database_url(self) -> str:
        """Kết nối đồng bộ (pymysql) cho Alembic."""
        return self.async_database_url.replace("mysql+aiomysql://", "mysql+pymysql://", 1)

    @property
    def async_database_url(self) -> str:
        # Mã hóa tên, mật khẩu để mật khẩu có ký tự @ : / # vẫn kết nối được
        pwd = f":{quote_plus(self.MYSQL_PASSWORD)}" if self.MYSQL_PASSWORD else ""
        return (
            f"mysql+aiomysql://{quote_plus(self.MYSQL_USER)}{pwd}@{self.MYSQL_HOST}:{self.MYSQL_PORT}/"
            f"{self.MYSQL_DB}?charset=utf8mb4"
        )


settings = Settings()
