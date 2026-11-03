"""Đăng nhập theo mục VII đề tài (bản 30/10/2026): mỗi cán bộ, giảng viên một tài khoản cá nhân do Phòng KHTC cấp.

Mô hình Access Token + Refresh Token:
- POST /auth/login: đúng mật khẩu thì trả Access Token trong JSON (hạn ACCESS_TOKEN_MINUTES, mặc định 15 phút) và đặt
  Refresh Token trong cookie HTTP-Only (Secure, SameSite=Strict, chỉ gửi tới /api/v1/auth). Máy chủ chỉ lưu bản băm.
- Giao diện giữ Access Token trong bộ nhớ (không lưu localStorage). Mở lại web hoặc Access Token hết hạn: gọi
  POST /auth/refresh-token, trình duyệt tự đính kèm cookie, phiên còn hiệu lực thì nhận Access Token mới.
- Refresh Token chưa đặt hạn (REFRESH_TOKEN_DAYS=0): phiên còn đến khi đăng xuất, đổi, đặt lại mật khẩu hoặc bị khóa.
- Thao tác có giá trị xác nhận (xác nhận dự toán, duyệt đề xuất, gửi danh sách đề xuất thanh lý...) nhập thêm mã xác
  nhận cá nhân do Phòng KHTC cấp cho cán bộ đầu mối, kỹ thuật viên, lãnh đạo Phòng QTNL (verify_code).

Tài khoản hệ thống admin (Phòng KHTC, tạo từ .env) dùng lần đầu để cấp tài khoản cho cán bộ.
"""
import datetime as dt
import time
from collections import defaultdict, deque
from typing import Optional

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core import clock
from core.errors import ApiError, bad, forbidden, unauthorized
from core.security import code_hash, create_token, hash_password, new_refresh_token, token_hash, verify_password
from models import Account, AuthSession, Staff, UnitFocal
from models.staff import QTNL_GROUPS

CODE_ROLES = ("ktv", "lanhdao_qtnl", "daumoi")  # vai trò có mã xác nhận cá nhân
MIN_PASSWORD = 8

# ---------------------------------------------------------------- Chặn dò mật khẩu, dò mã
# Sai quá MAX_FAILS lần trong WINDOW giây (theo tài khoản và máy đang nhập) thì máy đó tạm khóa đến hết khoảng đó.
MAX_FAILS = 8
WINDOW = 15 * 60
_fails: dict = defaultdict(deque)


def _check_limit(key: str) -> None:
    q = _fails[key]
    now = time.monotonic()
    while q and now - q[0] > WINDOW:
        q.popleft()
    if len(q) >= MAX_FAILS:
        wait = int((WINDOW - (now - q[0])) // 60) + 1
        raise ApiError(f"Nhập sai quá nhiều lần. Thử lại sau {wait} phút.", 429, "too_many_attempts")


def _fail(key: str) -> None:
    _fails[key].append(time.monotonic())


def _clear(key: str) -> None:
    _fails.pop(key, None)


def reset_limits() -> None:
    _fails.clear()


# ---------------------------------------------------------------- Người đang thao tác
def staff_user(s: Staff, role: str, focal: Optional[UnitFocal] = None) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "unit": s.unit,
        "position": s.position or "",
        "phone": s.phone or "",
        "email": s.email or "",
        "role": role,
        "staff_code": s.staff_code,
        "group": s.group,
        "username": s.username,
        "focal_unit": focal.unit if focal else None,
    }


def admin_user(a: Account) -> dict:
    return {"id": a.id, "name": a.display_name, "unit": settings.KHTC_UNIT, "role": "khtc", "username": a.username}


async def active_focal(db: AsyncSession, staff_id: str) -> Optional[UnitFocal]:
    return (
        await db.execute(select(UnitFocal).where(UnitFocal.staff_id == staff_id, UnitFocal.status == "dang_dung"))
    ).scalars().first()


async def role_of(db: AsyncSession, s: Staff) -> tuple:
    """Vai trò khi đăng nhập: khtc (quản trị), ktv, lanhdao_qtnl theo dữ liệu cán bộ; daumoi khi đang giữ mã đầu mối
    còn hiệu lực; còn lại là cán bộ, giảng viên. Trả về (role, focal)."""
    if s.group == "khtc":
        return "khtc", None
    if s.group in QTNL_GROUPS:
        return s.group, None
    f = await active_focal(db, s.id)
    if f:
        return "daumoi", f
    return "canbo", None


def _expires_at(created: dt.datetime) -> Optional[dt.datetime]:
    return created + dt.timedelta(days=settings.REFRESH_TOKEN_DAYS) if settings.REFRESH_TOKEN_DAYS > 0 else None


def access_token(kind: str, subject_id: str, session_id: str) -> dict:
    return {
        "access_token": create_token({"sub": subject_id, "typ": kind, "sid": session_id}),
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_MINUTES * 60,
    }


async def session_body(db: AsyncSession, kind: str, subject, session_id: str) -> dict:
    if kind == "account":
        user, must = admin_user(subject), False
    else:
        role, focal = await role_of(db, subject)
        user, must = staff_user(subject, role, focal), bool(subject.must_change_password)
    return {"account_kind": kind, "user": user, "must_change_password": must, **access_token(kind, subject.id, session_id)}


# ---------------------------------------------------------------- Đăng nhập, làm mới, đăng xuất
REVOKED_MESSAGE = (
    "Phiên đăng nhập đã kết thúc (đã đăng xuất ở cửa sổ hoặc thiết bị khác, đổi hoặc đặt lại mật khẩu, tài khoản bị "
    "khóa hoặc xóa). Đăng nhập lại."
)
async def _find_login(db: AsyncSession, username: str):
    """Tài khoản hệ thống (admin) trước, rồi tài khoản cá nhân của cán bộ. Không phân biệt hoa thường."""
    u = username.strip().lower()
    a = (await db.execute(select(Account).where(func.lower(Account.username) == u))).scalar_one_or_none()
    if a is not None:
        return "account", a
    s = (await db.execute(select(Staff).where(func.lower(Staff.username) == u))).scalar_one_or_none()
    if s is not None:
        return "staff", s
    return None, None


def _usable(kind: str, subject) -> bool:
    if subject is None or not subject.active:
        return False
    if kind == "account":
        return subject.kind == "admin"
    return bool(subject.password_hash)


async def login(db: AsyncSession, username: str, password: str, ip: str = "", user_agent: str = "") -> tuple:
    """Trả về (body JSON, Refresh Token để đặt vào cookie)."""
    key = f"login:{username.strip().lower()}:{ip}"
    _check_limit(key)
    kind, subject = await _find_login(db, username)
    if not _usable(kind, subject) or not verify_password(password, subject.password_hash):
        _fail(key)
        raise unauthorized("Tên đăng nhập hoặc mật khẩu không đúng", "bad_credentials")
    _clear(key)
    raw = new_refresh_token()
    at = clock.now()
    sess = AuthSession(
        subject_kind=kind,
        subject_id=subject.id,
        token_hash=token_hash(raw),
        user_agent=(user_agent or "")[:255],
        ip=(ip or "")[:64],
        created_at=at,
        last_used_at=at,
    )
    db.add(sess)
    if kind == "staff":
        subject.last_login_at = at
    await db.flush()
    return await session_body(db, kind, subject, sess.id), raw


async def _subject(db: AsyncSession, kind: str, subject_id: str):
    return await db.get(Account if kind == "account" else Staff, subject_id)


async def refresh(db: AsyncSession, raw: Optional[str]) -> dict:
    """Mở lại web hoặc Access Token hết hạn: cookie Refresh Token còn hiệu lực thì cấp Access Token mới."""
    if not raw:
        raise unauthorized("Chưa đăng nhập", "no_session")
    sess = (await db.execute(select(AuthSession).where(AuthSession.token_hash == token_hash(raw)))).scalar_one_or_none()
    if sess is None or sess.revoked_at is not None:
        raise unauthorized(REVOKED_MESSAGE, "session_revoked")
    exp = _expires_at(sess.created_at)
    if exp is not None and clock.now() > exp:
        raise unauthorized("Phiên đăng nhập đã hết hạn. Đăng nhập lại.", "session_expired")
    subject = await _subject(db, sess.subject_kind, sess.subject_id)
    if not _usable(sess.subject_kind, subject):
        sess.revoked_at = clock.now()
        raise unauthorized("Tài khoản không còn hiệu lực. Liên hệ Phòng KHTC.", "account_inactive")
    sess.last_used_at = clock.now()
    return await session_body(db, sess.subject_kind, subject, sess.id)


async def logout(db: AsyncSession, raw: Optional[str], session_id: Optional[str] = None) -> bool:
    """Đăng xuất phiên của cửa sổ đang dùng (session_id lấy từ Access Token). Cookie Refresh Token dùng chung cho mọi
    cửa sổ của trình duyệt và thuộc lần đăng nhập gần nhất: chỉ hủy phiên của cookie (và xóa cookie) khi cookie đúng là
    phiên này, hoặc khi không có Access Token. Trả True nếu cần xóa cookie.
    (Trước đây luôn hủy phiên của cookie: đăng xuất ở cửa sổ này có thể đẩy người đang dùng ở cửa sổ khác ra.)"""
    cookie_sess = None
    if raw:
        cookie_sess = (await db.execute(select(AuthSession).where(AuthSession.token_hash == token_hash(raw)))).scalar_one_or_none()
    ids = set()
    if session_id:
        ids.add(session_id)
    clear = cookie_sess is None or not session_id or cookie_sess.id == session_id
    if cookie_sess is not None and clear:
        ids.add(cookie_sess.id)
    if ids:
        for s in (await db.execute(select(AuthSession).where(AuthSession.id.in_(ids), AuthSession.revoked_at.is_(None)))).scalars():
            s.revoked_at = clock.now()
    return clear


async def revoke_sessions(db: AsyncSession, kind: str, subject_id: str, keep_session_id: Optional[str] = None) -> int:
    """Đăng xuất trên mọi thiết bị (khóa tài khoản, đặt lại hoặc đổi mật khẩu). keep: giữ phiên đang dùng."""
    q = (
        update(AuthSession)
        .where(AuthSession.subject_kind == kind, AuthSession.subject_id == subject_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=clock.now())
    )
    if keep_session_id:
        q = q.where(AuthSession.id != keep_session_id)
    res = await db.execute(q)
    return res.rowcount or 0


async def change_password(db: AsyncSession, actor, current: str, new: str) -> None:
    subject = actor.staff if actor.staff is not None else actor.account
    key = f"password:{subject.id}"
    _check_limit(key)
    if not verify_password(current or "", subject.password_hash or ""):
        _fail(key)
        raise bad("Mật khẩu hiện tại không đúng", "bad_password")
    _clear(key)
    new = new or ""
    if len(new) < MIN_PASSWORD:
        raise bad(f"Mật khẩu mới cần ít nhất {MIN_PASSWORD} ký tự")
    if new == current:
        raise bad("Mật khẩu mới phải khác mật khẩu hiện tại")
    subject.password_hash = hash_password(new)
    if actor.staff is not None:
        actor.staff.must_change_password = False
    await revoke_sessions(db, actor.kind, subject.id, keep_session_id=actor.session_id)


# ---------------------------------------------------------------- Xác thực mỗi lần gọi
async def resolve(db: AsyncSession, payload: dict) -> dict:
    """Access Token còn hạn chưa đủ: phiên phải chưa bị hủy (đăng xuất, khóa tài khoản có hiệu lực ngay),
    tài khoản còn hoạt động. Vai trò tính lại mỗi lần (Phòng KHTC đổi vai trò, thu hồi mã đầu mối có hiệu lực ngay)."""
    kind, sid, sub = payload.get("typ"), payload.get("sid"), payload.get("sub")
    if kind not in ("staff", "account") or not sid or not sub:
        raise unauthorized("Phiên đăng nhập cũ không còn dùng được. Đăng nhập lại.", "token_invalid")
    sess = await db.get(AuthSession, sid)
    if sess is None or sess.revoked_at is not None or sess.subject_id != sub:
        raise unauthorized(REVOKED_MESSAGE, "session_revoked")
    subject = await _subject(db, kind, sub)
    if not _usable(kind, subject):
        raise unauthorized("Tài khoản không còn hiệu lực. Liên hệ Phòng KHTC.", "account_inactive")
    if kind == "account":
        return {"kind": kind, "account": subject, "staff": None, "focal": None, "role": "khtc", "user": admin_user(subject), "session_id": sid}
    role, focal = await role_of(db, subject)
    return {"kind": kind, "account": None, "staff": subject, "focal": focal, "role": role, "user": staff_user(subject, role, focal), "session_id": sid}


# ---------------------------------------------------------------- Mã xác nhận cá nhân cho thao tác quan trọng
async def verify_code(db: AsyncSession, actor, code: Optional[str], roles: tuple = CODE_ROLES, reason: str = "bad_code",
                      message: str = "Mã xác nhận cá nhân không đúng") -> None:
    """Nhập mã xác nhận cá nhân khi thao tác có giá trị như chữ ký. Phiên đăng nhập được giữ lâu dài trên thiết bị
    (Refresh Token chưa đặt hạn), mã này bảo đảm đúng người thao tác. Mã của kỹ thuật viên, lãnh đạo Phòng QTNL ở bảng
    staff; mã cán bộ đầu mối ở bảng unit_focals (mã đang dùng của chính người đó)."""
    if actor.role not in roles:
        raise forbidden()
    if not (code or "").strip():
        raise ApiError("Nhập mã xác nhận cá nhân để tiếp tục", 428, "code_required")
    key = f"code:{actor.id}"
    _check_limit(key)
    h = code_hash(code)
    if actor.role == "daumoi":
        ok = actor.focal is not None and actor.focal.code_hash == h
    else:
        ok = actor.staff is not None and actor.staff.code_hash == h
    if not ok:
        _fail(key)
        raise bad(message, reason)
    _clear(key)
