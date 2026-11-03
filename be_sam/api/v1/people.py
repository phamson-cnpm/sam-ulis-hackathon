
"""Dữ liệu cán bộ, tài khoản cá nhân, vai trò và mã xác nhận cá nhân, mã cán bộ đầu mối (Phòng KHTC);
tài sản toàn trường và nhật ký theo mã (cán bộ đầu mối)."""
from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import KHTC, Actor, require
from services import asset_service as A
from services import people_service as P

router = APIRouter(tags=["Cán bộ, mã xác nhận"])
FOCAL = require("daumoi")
OK = {"success": True}


@router.get("/staff")
async def staff_list(actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    return await P.staff_list(db)


@router.post("/staff")
async def staff_create(body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    return await P.staff_create(db, body, actor)


@router.delete("/staff/{staff_id}")
async def staff_delete(staff_id: str, actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Xóa cán bộ khỏi danh sách (kèm tài khoản). Đã có lịch sử thì ẩn, giữ tên trong lịch sử; chưa có thì xóa hẳn."""
    return await P.staff_delete(db, staff_id, actor)


@router.patch("/staff/{staff_id}")
async def staff_update(staff_id: str, body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    return await P.staff_update(db, staff_id, body, actor)


# ---------------------------------------------------------------- Tài khoản cá nhân
@router.post("/staff/accounts/issue-all")
async def account_issue_all(body: dict = Body(default={}), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Cấp tài khoản cho mọi cán bộ chưa có (lọc theo đơn vị): trả danh sách tên đăng nhập, mật khẩu ban đầu để in."""
    return await P.account_issue_all(db, body)


@router.post("/staff/{staff_id}/account")
async def account_issue(staff_id: str, body: dict = Body(default={}), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Cấp tài khoản hoặc đặt lại mật khẩu. Mật khẩu ban đầu chỉ trả về một lần."""
    return await P.account_issue(db, staff_id, body)


@router.delete("/staff/{staff_id}/account")
async def account_delete(staff_id: str, actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Xóa tài khoản đăng nhập (giữ dữ liệu cán bộ và lịch sử). Mọi thiết bị đăng xuất ngay."""
    return await P.account_delete(db, staff_id, actor)


@router.post("/staff/{staff_id}/active")
async def account_active(staff_id: str, body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Khóa (active false) hoặc mở lại tài khoản. Khóa thì đăng xuất mọi thiết bị ngay."""
    return await P.account_set_active(db, staff_id, bool(body.get("active")), actor)


@router.post("/staff/{staff_id}/logout-all")
async def account_logout_all(staff_id: str, actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    return {"revoked": await P.account_logout_all(db, staff_id)}


@router.post("/staff/{staff_id}/code")
async def code_reissue(staff_id: str, actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Đổi mã xác nhận cá nhân của kỹ thuật viên, lãnh đạo Phòng QTNL."""
    return await P.code_reissue(db, staff_id)


@router.get("/focal")
async def focal_list(actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    return await P.focal_list(db)


@router.get("/focal/logs")
async def focal_logs(actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    return await P.focal_logs(db)


@router.post("/focal/reissue")
async def focal_reissue(body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Đổi cán bộ đầu mối hoặc cấp mã mới: mã đang dùng của đơn vị hết hiệu lực ngay."""
    return await P.focal_reissue(db, body.get("unit") or "", body, actor)


@router.post("/focal/{focal_id}/revoke")
async def focal_revoke(focal_id: str, body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    await P.focal_revoke(db, focal_id, body.get("reason") or "", actor)
    return OK


@router.get("/focal/assets")
async def focal_assets(actor: Actor = Depends(FOCAL), db: AsyncSession = Depends(get_db)):
    """Tài sản toàn trường theo màu đèn, chỉ các cột: màu đèn, mã, tên, phòng ban, vị trí, nguyên giá, Đề xuất
    (mục 5.8 đề tài). Giao diện lọc theo đơn vị, mặc định đơn vị mình."""
    return await A.list_focal(db)


@router.post("/focal/log")
async def focal_log(body: dict = Body(...), actor: Actor = Depends(FOCAL), db: AsyncSession = Depends(get_db)):
    action = body.get("action")
    if action not in ("xem", "xuat_excel", "tai_pdf", "in", "tai_word"):
        from core.errors import bad

        raise bad("Thao tác không đúng")
    await P.focal_log(db, actor.focal, action, (body.get("detail") or "")[:2000])
    return OK
