"""Cột Đề xuất và luồng duyệt đề xuất xử lý tài sản (mục 5.6 đề tài)."""
from typing import Optional

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import KHTC, QTNL_LEADER, Actor, confirm_code, require
from services import proposal_service as P

router = APIRouter(prefix="/proposals", tags=["Đề xuất xử lý tài sản"])
CAN_SEE = require("khtc", "ktv", "lanhdao_qtnl", "daumoi")
CAN_PROPOSE = require("ktv", "daumoi")
KTV = require("ktv")


@router.get("")
async def list_proposals(status: Optional[str] = None, actor: Actor = Depends(CAN_SEE), db: AsyncSession = Depends(get_db)):
    """status: lọc theo trạng thái, nhiều trạng thái cách nhau dấu phẩy."""
    return await P.list_for(db, actor, status)


@router.get("/{proposal_id}")
async def get_proposal(proposal_id: str, actor: Actor = Depends(CAN_SEE), db: AsyncSession = Depends(get_db)):
    return await P.get_one(db, actor, proposal_id)


@router.post("")
async def create(body: dict = Body(...), code: Optional[str] = Depends(confirm_code), actor: Actor = Depends(CAN_PROPOSE), db: AsyncSession = Depends(get_db)):
    """Gửi đề xuất (một hoặc nhiều tài sản). Cần mã xác nhận cá nhân ở header X-Confirm-Code."""
    return await P.create(db, actor, body, code)


@router.post("/khtc")
async def khtc_action(body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Phòng KHTC tiếp nhận đề xuất đã duyệt, hoặc ghi Không duyệt khi Ban Giám hiệu không đồng ý."""
    return await P.khtc_action(db, actor, body)


@router.post("/{proposal_id}/decide")
async def decide(proposal_id: str, body: dict = Body(...), code: Optional[str] = Depends(confirm_code), actor: Actor = Depends(QTNL_LEADER), db: AsyncSession = Depends(get_db)):
    """Lãnh đạo Phòng QTNL: action duyet | ky_thuat (techId) | khong_duyet (reason bắt buộc)."""
    return await P.decide(db, actor, proposal_id, body, code or body.get("leaderCode"))


@router.post("/{proposal_id}/tech")
async def tech(proposal_id: str, body: dict = Body(...), code: Optional[str] = Depends(confirm_code), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    """Kỹ thuật viên được giao ghi ý kiến: opinion dong_y | khong_dong_y | de_xuat_khac, note."""
    return await P.tech_opinion(db, actor, proposal_id, body, code)
