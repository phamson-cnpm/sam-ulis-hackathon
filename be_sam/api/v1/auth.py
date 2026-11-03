"""Đăng nhập bằng tài khoản cá nhân: Access Token (JSON, 15 phút) + Refresh Token (cookie HTTP-Only), mục VII đề tài."""
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi.responses import JSONResponse

from config import settings
from core.database import get_db
from core.errors import ApiError
from core.security import token_session_id
from core.deps import Actor, get_account_actor
from schemas.auth import LoginRequest, PasswordRequest, SessionOut, TokenOut
from services import auth_service

router = APIRouter(prefix="/auth", tags=["Đăng nhập"])
COOKIE_PATH = f"{settings.API_V1_PREFIX}/auth"
FOREVER = 10 * 365 * 24 * 3600  # Refresh Token chưa đặt hạn: cookie giữ 10 năm để mở lại trình duyệt vẫn còn


def _ip(request: Request) -> str:
    return request.client.host if request.client else ""


def _set_cookie(response: Response, token: str) -> None:
    days = settings.REFRESH_TOKEN_DAYS
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        token,
        max_age=days * 24 * 3600 if days > 0 else FOREVER,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )


def _clear_cookie(response: Response) -> None:
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME, path=COOKIE_PATH, httponly=True, secure=settings.COOKIE_SECURE, samesite=settings.COOKIE_SAMESITE
    )


def _refresh_cookie(request: Request) -> Optional[str]:
    return request.cookies.get(settings.REFRESH_COOKIE_NAME)


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginRequest, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Đăng nhập thành công: Access Token trả trong JSON; Refresh Token đặt trong cookie HTTP-Only."""
    body, raw = await auth_service.login(db, payload.username, payload.password, _ip(request), request.headers.get("user-agent", ""))
    _set_cookie(response, raw)
    return body


@router.post("/refresh-token", response_model=TokenOut)
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Mở lại web hoặc Access Token hết hạn: trình duyệt tự gửi cookie Refresh Token; còn hiệu lực thì cấp Access Token
    mới, người dùng vào thẳng trang chủ không nhập lại mật khẩu."""
    try:
        return await auth_service.refresh(db, _refresh_cookie(request))
    except ApiError as e:
        # Phiên không còn hiệu lực: trả lỗi kèm lệnh xóa cookie để trình duyệt thôi gửi Refresh Token cũ
        out = JSONResponse(status_code=e.status_code, content={"message": e.message, "status_code": e.status_code, "reason": e.reason})
        _clear_cookie(out)
        return out


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Hủy phiên của cửa sổ đang dùng (theo Access Token, kể cả đã quá hạn); không có Access Token thì hủy phiên của
    cookie. Cookie chỉ bị xóa khi thuộc đúng phiên đó, để cửa sổ khác đã đăng nhập tài khoản khác không bị đẩy ra."""
    auth = request.headers.get("authorization") or ""
    sid = token_session_id(auth[7:].strip()) if auth.lower().startswith("bearer ") else None
    if await auth_service.logout(db, _refresh_cookie(request), sid):
        _clear_cookie(response)
    return {"success": True}


@router.post("/logout-all")
async def logout_all(request: Request, response: Response, actor: Actor = Depends(get_account_actor), db: AsyncSession = Depends(get_db)):
    """Đăng xuất trên mọi thiết bị của chính mình."""
    from services.push_service import drop_user

    await auth_service.revoke_sessions(db, actor.kind, actor.id)
    await drop_user(db, actor.id)  # thôi gửi thông báo đẩy tới mọi máy của tài khoản này
    _clear_cookie(response)
    return {"success": True}


@router.get("/me", response_model=SessionOut)
async def me(actor: Actor = Depends(get_account_actor)):
    return {"account_kind": actor.kind, "user": actor.user, "must_change_password": actor.must_change_password}


@router.post("/password")
async def change_password(payload: PasswordRequest, actor: Actor = Depends(get_account_actor), db: AsyncSession = Depends(get_db)):
    """Đổi mật khẩu (bắt buộc ở lần đăng nhập đầu với mật khẩu Phòng KHTC cấp). Các thiết bị khác bị đăng xuất."""
    await auth_service.change_password(db, actor, payload.current_password, payload.new_password)
    return {"success": True}



