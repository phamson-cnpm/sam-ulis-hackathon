"""Thông báo đẩy về điện thoại, máy tính (Web Push, mục 5.9 đề tài).

- Mỗi người tự bật, tắt ở nút chuông cho từng thiết bị: trình duyệt tạo một đăng ký (endpoint + khóa), máy chủ lưu theo
  tài khoản. Tắt là xóa đăng ký của thiết bị đó. Danh sách thông báo trong chuông vẫn giữ như cũ.
- Khi phát sinh thông báo (services.common.notify), sau khi lưu xong máy chủ gửi bản ngắn tới mọi thiết bị đã bật của
  người nhận qua dịch vụ đẩy của trình duyệt, ký bằng khóa VAPID. Đăng ký hết hiệu lực (404, 410) tự xóa.
- Nội dung đẩy hiện trên màn hình khóa nên chỉ có mã phiếu, tài sản, vị trí, tình huống; không có số điện thoại, chi phí.
- Khóa VAPID: đặt VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY trong .env; để trống thì tự sinh lần đầu và lưu trong bảng
  app_settings (giữ nguyên khóa thì các đăng ký cũ vẫn dùng được).
"""
import asyncio
import hashlib
import json
import logging
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core import clock
from core.errors import bad
from models import AppSetting, PushSubscription

logger = logging.getLogger("uvicorn.error")

_KEY_PRIV = "vapid_private_key"
_KEY_PUB = "vapid_public_key"
_cache: dict = {}
_tasks: set = set()  # giữ tham chiếu tác vụ chạy nền đến khi xong


def _hash(endpoint: str) -> str:
    return hashlib.sha256(endpoint.encode()).hexdigest()


def _generate() -> tuple:
    from cryptography.hazmat.primitives import serialization
    from py_vapid import Vapid, b64urlencode

    v = Vapid()
    v.generate_keys()
    priv = b64urlencode(v.private_key.private_numbers().private_value.to_bytes(32, "big"))
    pub = b64urlencode(v.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint))
    return priv, pub


async def vapid_keys(db: AsyncSession) -> tuple:
    """(khóa riêng, khóa công khai) dạng base64url. Khóa công khai gửi cho trình duyệt khi bật chuông."""
    if settings.VAPID_PRIVATE_KEY and settings.VAPID_PUBLIC_KEY:
        return settings.VAPID_PRIVATE_KEY, settings.VAPID_PUBLIC_KEY
    if "keys" in _cache:
        return _cache["keys"]
    priv = await db.get(AppSetting, _KEY_PRIV)
    pub = await db.get(AppSetting, _KEY_PUB)
    if not (priv and pub and priv.value and pub.value):
        p, q = _generate()
        if priv is None:
            db.add(AppSetting(key=_KEY_PRIV, value=p))
        else:
            priv.value = p
        if pub is None:
            db.add(AppSetting(key=_KEY_PUB, value=q))
        else:
            pub.value = q
        await db.flush()
        _cache["keys"] = (p, q)
    else:
        _cache["keys"] = (priv.value, pub.value)
    return _cache["keys"]


# ---------------------------------------------------------------- Bật, tắt ở nút chuông
async def config(db: AsyncSession) -> dict:
    if not settings.PUSH_ENABLED:
        return {"enabled": False, "publicKey": None}
    _, pub = await vapid_keys(db)
    return {"enabled": True, "publicKey": pub}


def _sub_fields(sub: dict) -> tuple:
    endpoint = (sub or {}).get("endpoint") or ""
    keys = (sub or {}).get("keys") or {}
    if not endpoint.startswith("https://") or not keys.get("p256dh") or not keys.get("auth"):
        raise bad("Đăng ký nhận thông báo của trình duyệt không hợp lệ")
    if len(endpoint) > 2000 or len(keys["p256dh"]) > 255 or len(keys["auth"]) > 255:
        raise bad("Đăng ký nhận thông báo của trình duyệt không hợp lệ")
    return endpoint, keys["p256dh"], keys["auth"]


async def subscribe(db: AsyncSession, user_id: str, sub: dict, user_agent: str = "") -> dict:
    """Bật thông báo về máy này. Cùng một thiết bị (endpoint) đăng nhập tài khoản khác thì chuyển sang người mới."""
    if not settings.PUSH_ENABLED:
        raise bad("Máy chủ chưa bật thông báo đẩy")
    endpoint, p256dh, auth = _sub_fields(sub)
    h = _hash(endpoint)
    row = (await db.execute(select(PushSubscription).where(PushSubscription.endpoint_hash == h))).scalar_one_or_none()
    if row is None:
        row = PushSubscription(endpoint=endpoint, endpoint_hash=h, created_at=clock.now())
        db.add(row)
    row.user_id = user_id
    row.p256dh, row.auth = p256dh, auth
    row.user_agent = (user_agent or "")[:255]
    row.last_error = None
    await db.flush()
    return {"on": True}


async def unsubscribe(db: AsyncSession, user_id: str, endpoint: Optional[str]) -> dict:
    """Tắt thông báo về máy này (chỉ xóa đăng ký của chính người đang đăng nhập)."""
    if endpoint:
        await db.execute(
            delete(PushSubscription).where(PushSubscription.endpoint_hash == _hash(endpoint), PushSubscription.user_id == user_id)
        )
    return {"on": False}


async def status(db: AsyncSession, user_id: str, endpoint: Optional[str]) -> dict:
    if not endpoint:
        return {"on": False}
    row = (
        await db.execute(
            select(PushSubscription.id).where(PushSubscription.endpoint_hash == _hash(endpoint), PushSubscription.user_id == user_id)
        )
    ).first()
    return {"on": bool(row)}


async def drop_user(db: AsyncSession, user_id: str) -> None:
    """Khóa tài khoản: thôi gửi thông báo đẩy tới mọi thiết bị của người đó."""
    await db.execute(delete(PushSubscription).where(PushSubscription.user_id == user_id))


# ---------------------------------------------------------------- Gửi
def payload(text: str, link: Optional[str]) -> str:
    """Bản ngắn hiện trên màn hình khóa; url mở đúng màn hình khi bấm (giao diện đọc tham số ?go=)."""
    body = text if len(text) <= 180 else text[:177] + "..."
    return json.dumps(
        {"title": "SAM – Quản lý tài sản", "body": body, "url": f"/?go={link}" if link else "/", "tag": link or "sam"},
        ensure_ascii=False,
    )


def _send(sub: dict, data: str, private_key: str) -> Optional[int]:
    """Gửi một thông báo (chạy trong luồng riêng). Trả mã HTTP lỗi nếu có, None nếu thành công."""
    from pywebpush import WebPushException, webpush

    try:
        webpush(sub, data, vapid_private_key=private_key, vapid_claims={"sub": settings.VAPID_SUBJECT}, ttl=24 * 3600, timeout=10)
        return None
    except WebPushException as e:
        return getattr(e.response, "status_code", None) or 0


async def deliver(items: list) -> int:
    """items: [(user_ids, text, link)]. Mở phiên riêng (request đã xong). Trả số lần gửi thành công."""
    from core.database import AsyncSessionLocal

    sent = 0
    async with AsyncSessionLocal() as db:
        priv, _ = await vapid_keys(db)
        user_ids = {u for ids, _, _ in items for u in ids}
        subs = {}
        for row in (await db.execute(select(PushSubscription).where(PushSubscription.user_id.in_(user_ids)))).scalars():
            subs.setdefault(row.user_id, []).append(row)
        gone = set()
        for ids, text, link in items:
            data = payload(text, link)
            for uid in ids:
                for row in subs.get(uid, []):
                    if row.id in gone:
                        continue
                    info = {"endpoint": row.endpoint, "keys": {"p256dh": row.p256dh, "auth": row.auth}}
                    code = await asyncio.to_thread(_send, info, data, priv)
                    if code is None:
                        sent += 1
                    elif code in (404, 410):
                        gone.add(row.id)  # thiết bị đã gỡ quyền hoặc đăng ký hết hạn
                    else:
                        row.last_error = f"{clock.stamp(clock.now())}: HTTP {code}"
        if gone:
            await db.execute(delete(PushSubscription).where(PushSubscription.id.in_(gone)))
        await db.commit()
    return sent


def schedule(items: list) -> None:
    """Gọi sau khi request lưu xong: gửi nền, lỗi chỉ ghi log (thông báo trong chuông đã lưu)."""
    if not settings.PUSH_ENABLED or not items:
        return

    async def run():
        try:
            await deliver(items)
        except Exception:  # noqa: BLE001
            logger.exception("Gửi thông báo đẩy không thành công")

    try:
        task = asyncio.get_running_loop().create_task(run())
    except RuntimeError:
        return
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
