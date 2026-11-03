
"""Thu hồi tài sản hỏng về kho (5 bước) và biên bản bàn giao (cấp phát, điều chuyển chính thức)."""
from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import KHTC, QTNL_OR_KHTC, Actor, require
from services import recall_service as R

router = APIRouter(tags=["Thu hồi, bàn giao"])
KTV = require("ktv")
OK = {"success": True}


@router.get("/recalls")
async def list_recalls(actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await R.list_recalls(db)


@router.get("/recalls/pending")
async def pending(actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    """Hồ sơ đủ căn cứ (hư hỏng toàn phần đã xác nhận, hoặc không được duyệt chi phí) nhưng chưa đề nghị thu hồi."""
    return await R.pending(db)


@router.get("/recalls/eligibility/{report_id}")
async def eligibility(report_id: str, actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await R.eligibility(db, report_id)


@router.post("/recalls")
async def propose(body: dict = Body(...), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    """Bước 1: kỹ thuật viên Phòng QTNL đề nghị thu hồi tài sản hỏng về kho (đề tài mục VII: lãnh đạo Phòng QTNL không lập)."""
    return await R.propose(db, actor, body)


@router.post("/recalls/{recall_id}/decide")
async def decide(recall_id: str, body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Bước 2: Phòng KHTC xác nhận hoặc không đồng ý."""
    await R.decide(db, actor, recall_id, bool(body.get("approve")), body.get("reason") or "")
    return OK


@router.post("/recalls/{recall_id}/handover")
async def create_for_recall(recall_id: str, body: dict = Body(...), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    """Bước 3: kỹ thuật viên lập biên bản giao nhận tài sản, ký rồi nộp Phòng KHTC."""
    return await R.create_for_recall(db, actor, recall_id, body)


@router.post("/recalls/{recall_id}/complete")
async def complete(recall_id: str, body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Bước 4: Phòng KHTC nhập điều chuyển chính thức; số văn bản, bản quét có thể đính kèm sau."""
    await R.complete(db, actor, recall_id, body)
    return OK


@router.post("/recalls/{recall_id}/attach")
async def attach_docs(recall_id: str, body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    await R.attach_docs(db, recall_id, body)
    return OK


@router.get("/handovers")
async def list_handovers(actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await R.list_handovers(db)


@router.post("/handovers")
async def create_handover(body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Cấp phát hoặc điều chuyển chính thức: lưu là cập nhật vị trí, đơn vị, ngày tương tác của từng tài sản."""
    return await R.create_handover(db, actor, body)
