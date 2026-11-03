
from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import ANY_PERSON, KHTC, QTNL_OR_KHTC, Actor
from services import asset_service as A

router = APIRouter(prefix="/assets", tags=["Tài sản"])


@router.get("")
async def list_assets(actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    """Danh sách tài sản gắn đèn (Phòng KHTC, Phòng QTNL)."""
    return await A.list_all(db)


@router.get("/search")
async def search(q: str = "", limit: int = 8, actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    """Tìm theo mã tem, tên hoặc vị trí (ô nhập mã tem trên phiếu). Cán bộ, đầu mối không nhận số liệu chi phí sửa chữa."""
    return await A.search(db, q, limit, actor.role)


@router.get("/{asset_id}")
async def get_asset(asset_id: str, actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await A.get_view(db, asset_id, actor.role)


@router.get("/{asset_id}/history")
async def history(asset_id: str, actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await A.history(db, asset_id)


@router.post("/{asset_id}/preview-light")
async def preview_light(asset_id: str, body: dict = Body(default={}), actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    """Đèn hiện tại và đèn tạm tính nếu thêm các dòng dự toán đang soạn."""
    return await A.preview_light(db, asset_id, body.get("draftLines") or [], body.get("excludeEstimateId"))


@router.post("/{asset_id}/disposal-decision")
async def decide_disposal(asset_id: str, body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Phòng KHTC quyết định với tài sản chờ thanh lý: decision thanh_ly | loai_khoi_danh_sach, basis (số, ngày văn bản), note."""
    return await A.decide_disposal(db, actor, asset_id, body)
