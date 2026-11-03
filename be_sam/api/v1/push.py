"""Nút chuông: bật, tắt thông báo đẩy về máy này (Web Push, mục 5.9 đề tài)."""
from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import ANY_PERSON, Actor
from services import push_service as P
from services.common import notify

router = APIRouter(prefix="/push", tags=["Thông báo đẩy"])


@router.get("/config")
async def config(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    """Máy chủ có bật thông báo đẩy không và khóa công khai VAPID để trình duyệt đăng ký."""
    return await P.config(db)


@router.post("/subscribe")
async def subscribe(request: Request, body: dict = Body(...), actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    """body: PushSubscription của trình duyệt ({endpoint, keys: {p256dh, auth}})."""
    out = await P.subscribe(db, actor.id, body.get("subscription") or body, request.headers.get("user-agent", ""))
    if body.get("test"):
        await notify(db, [actor.id], "Đã bật thông báo về máy này. Bấm vào đây để mở SAM.", "notifications")
    return out


@router.post("/unsubscribe")
async def unsubscribe(body: dict = Body(default={}), actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await P.unsubscribe(db, actor.id, body.get("endpoint"))


@router.post("/status")
async def status(body: dict = Body(default={}), actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    """Thiết bị (endpoint) này đã bật thông báo cho tài khoản đang đăng nhập chưa."""
    return await P.status(db, actor.id, body.get("endpoint"))
