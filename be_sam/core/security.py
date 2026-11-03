
"""Mật khẩu (bcrypt), Access Token (JWT, hạn ngắn), Refresh Token (chuỗi ngẫu nhiên, chỉ lưu bản băm) và mã xác nhận cá nhân.

Mã xác nhận cá nhân (Phòng QTNL, cán bộ đầu mối) do Phòng KHTC cấp và xem lại được, nên lưu hai cột:
- code_hash: HMAC-SHA256 của mã, dùng để tra khi người dùng nhập mã (không lưu mã trần);
- code_enc: mã đã mã hóa (Fernet), chỉ giải mã khi Phòng KHTC xem danh sách mã.
"""
import base64
import datetime as dt
import hashlib
import hmac
import os
import secrets
from typing import Optional

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken

from config import BASE_DIR, settings

CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # bỏ chữ, số dễ nhầm: I, O, 0, 1


def _secret_from_file(name: str, make) -> str:
    path = os.path.join(BASE_DIR, "data", name)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read().strip()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    value = make()
    with open(path, "w", encoding="utf-8") as f:
        f.write(value)
    os.chmod(path, 0o600)
    return value


JWT_SECRET = settings.JWT_SECRET or _secret_from_file("jwt_secret.key", lambda: secrets.token_urlsafe(48))
CODE_SECRET = settings.CODE_SECRET or _secret_from_file(
    "code_secret.key", lambda: base64.urlsafe_b64encode(os.urandom(32)).decode()
)
_fernet = Fernet(CODE_SECRET.encode())


# ---------------------------------------------------------------- Mật khẩu
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------------------------------------------------------------- Access Token (JWT), Refresh Token
def create_token(data: dict, minutes: Optional[int] = None) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {**data, "iat": now, "exp": now + dt.timedelta(minutes=minutes or settings.ACCESS_TOKEN_MINUTES)}
    return jwt.encode(payload, JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def new_refresh_token() -> str:
    """Refresh Token gửi về trình duyệt trong cookie HTTP-Only; máy chủ chỉ lưu bản băm (token_hash)."""
    return secrets.token_urlsafe(48)


def token_hash(token: str) -> str:
    return hashlib.sha256(str(token or "").encode()).hexdigest()


PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyz23456789"  # mật khẩu ban đầu: bỏ chữ, số dễ nhầm


def random_password(length: int = 10) -> str:
    return "".join(secrets.choice(PASSWORD_CHARS) for _ in range(length))


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None


def token_session_id(token: Optional[str]) -> Optional[str]:
    """Phiên (sid) ghi trong Access Token, chấp nhận token đã quá hạn (chỉ dùng khi đăng xuất: đúng chữ ký là đủ)."""
    if not token:
        return None
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], options={"verify_exp": False})
    except jwt.PyJWTError:
        return None
    return data.get("sid")


# ---------------------------------------------------------------- Mã xác nhận cá nhân
def norm_code(code: str) -> str:
    return str(code or "").strip().upper()


def code_hash(code: str) -> str:
    return hmac.new(CODE_SECRET.encode(), norm_code(code).encode(), hashlib.sha256).hexdigest()


def encrypt_code(code: str) -> str:
    return _fernet.encrypt(norm_code(code).encode()).decode()


def decrypt_code(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    try:
        return _fernet.decrypt(token.encode()).decode()
    except InvalidToken:
        return None


def random_code(prefix: str, length: int = 4) -> str:
    """Ví dụ QT-7KMP, ANH-X2FQ."""
    return f"{prefix}-" + "".join(secrets.choice(CODE_CHARS) for _ in range(length))
