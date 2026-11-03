
from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import ANY_PERSON, QTNL, Actor
from services import catalog_service as C

router = APIRouter(prefix="/catalog", tags=["Danh mục"])


@router.get("/units")
async def units(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await C.units(db)


@router.get("/asset-groups")
async def asset_groups(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await C.asset_groups(db)


@router.get("/fault-lists")
async def fault_lists(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await C.fault_lists(db)


@router.post("/faults")
async def add_fault(body: dict = Body(...), actor: Actor = Depends(QTNL), db: AsyncSession = Depends(get_db)):
    await C.add_fault(db, body.get("groupCode") or "", body.get("text"))
    return {"success": True}


@router.post("/faults/remove")
async def remove_fault(body: dict = Body(...), actor: Actor = Depends(QTNL), db: AsyncSession = Depends(get_db)):
    await C.remove_fault(db, body.get("groupCode") or "", body.get("text") or "")
    return {"success": True}


@router.get("/situations")
async def situations(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await C.situations(db)


@router.post("/situations")
async def add_situation(body: dict = Body(...), actor: Actor = Depends(QTNL), db: AsyncSession = Depends(get_db)):
    await C.add_situation(db, body.get("text"), bool(body.get("urgent")))
    return {"success": True}


@router.patch("/situations")
async def set_situation_urgent(body: dict = Body(...), actor: Actor = Depends(QTNL), db: AsyncSession = Depends(get_db)):
    await C.set_situation_urgent(db, body.get("text") or "", bool(body.get("urgent")))
    return {"success": True}


@router.post("/situations/remove")
async def remove_situation(body: dict = Body(...), actor: Actor = Depends(QTNL), db: AsyncSession = Depends(get_db)):
    await C.remove_situation(db, body.get("text") or "")
    return {"success": True}


@router.get("/repair-jobs")
async def repair_jobs(all: bool = False, actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await C.repair_jobs(db, active_only=not all)


@router.post("/repair-jobs")
async def add_repair_job(body: dict = Body(...), actor: Actor = Depends(QTNL), db: AsyncSession = Depends(get_db)):
    return await C.add_repair_job(db, body.get("name"), body.get("groupCode") or "", body.get("costGroup") or "tinh")


@router.patch("/repair-jobs/{job_id}")
async def set_repair_job_active(job_id: str, body: dict = Body(...), actor: Actor = Depends(QTNL), db: AsyncSession = Depends(get_db)):
    await C.set_repair_job_active(db, job_id, bool(body.get("active")))
    return {"success": True}
