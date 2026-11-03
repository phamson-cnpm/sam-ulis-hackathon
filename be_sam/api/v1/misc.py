
"""Biểu mẫu in, thông báo, nhật ký xuất file, tệp tải lên, nhập Excel, số việc chờ, danh bạ cho giao diện."""
from fastapi import APIRouter, Body, Depends, File, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import ANY_PERSON, KHTC, QTNL_OR_KHTC, Actor
from core.errors import bad, forbidden
from models import StoredFile
from services import file_service, import_service, misc_service as M
from services.common import get_or_404

router = APIRouter(tags=["Chung"])
OK = {"success": True}


@router.get("/meta")
async def meta(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    """Ngày làm việc, năm tính chi phí, ngày chốt số liệu sổ sách của lần nhập tài sản gần nhất."""
    return await M.meta(db)


@router.get("/me/counts")
async def counts(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await M.counts(db, actor)


@router.get("/refs")
async def refs(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    """Tên người, tài sản (rút gọn), danh mục báo hỏng, tình huống: để giao diện tra nhanh theo id."""
    return await M.refs(db, actor)


# ---------------------------------------------------------------- Biểu mẫu in
@router.get("/forms/case/{report_id}")
async def case_dossier(report_id: str, actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await M.case_dossier(db, actor, report_id)


@router.get("/forms/handover/{handover_id}")
async def handover_dossier(handover_id: str, actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await M.handover_dossier(db, actor, handover_id)


@router.get("/forms/asset/{asset_id}")
async def asset_dossier(asset_id: str, actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await M.asset_dossier(db, actor, asset_id)


# ---------------------------------------------------------------- Thông báo, nhật ký xuất file
@router.get("/notifications")
async def notifications(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await M.notifications(db, actor)


@router.post("/notifications/read-all")
async def read_all(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    await M.mark_all_read(db, actor)
    return OK


@router.post("/export-logs")
async def log_export(body: dict = Body(...), actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    await M.log_export(db, actor, body.get("action") or "", body.get("detail") or "")
    return OK


@router.get("/export-logs")
async def export_logs(actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    return await M.export_logs(db)


# ---------------------------------------------------------------- Tệp tải lên
@router.post("/files")
async def upload(file: UploadFile = File(...), actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await file_service.save_upload(db, actor, file)


@router.get("/files/{file_id}")
async def download(file_id: str, actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    sf = await get_or_404(db, StoredFile, file_id, "Không tìm thấy tệp")
    return FileResponse(file_service.file_path(sf), media_type=sf.mime, filename=sf.original_name)


# ---------------------------------------------------------------- Nhập Excel (Phòng KHTC)
@router.post("/import")
async def import_excel(file: UploadFile = File(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Nhập danh sách tài sản, danh mục nhóm tài sản hoặc danh sách cán bộ từ file Excel (.xlsx)."""
    if not (file.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise bad("Chọn file Excel (.xlsx)")
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise bad("File lớn hơn 20 MB")
    return await import_service.import_excel(db, actor, data)


_ = forbidden
