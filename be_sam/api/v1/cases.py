
"""Phiếu báo hỏng, biên bản kiểm tra, thiết bị tạm, kho không có thiết bị, dự toán, ngoại lệ, ngưỡng."""
from typing import Optional

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import ANY_PERSON, KHTC, QTNL, QTNL_LEADER, QTNL_OR_KHTC, Actor, confirm_code, require
from services import case_service as C
from services.auth_service import verify_code

router = APIRouter(tags=["Hồ sơ phiếu báo hỏng"])
KTV = require("ktv")


async def ktv_code(db: AsyncSession, actor: Actor, code: Optional[str]) -> None:
    """Kỹ thuật viên nhập mã xác nhận cá nhân khi gửi dự toán (kèm đề nghị ngoại lệ), nhập, sửa chi phí thực tế.
    Thiếu mã thì máy chủ trả 428 code_required để giao diện hỏi mã rồi gửi lại."""
    await verify_code(db, actor, code, roles=("ktv",))


def leader_code(body: dict, header: Optional[str]) -> str:
    """Mã xác nhận của lãnh đạo: ô nhập trên hộp xác nhận (leaderCode) hoặc header X-Confirm-Code."""
    return (body.get("leaderCode") or header or "").strip()

OK = {"success": True}


# ---------------------------------------------------------------- Phiếu báo hỏng
@router.post("/reports/batch")
async def create_batch(body: dict = Body(...), actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    """Báo nhiều tài sản một lần: mỗi mã tài sản một phiếu, cùng mã đợt."""
    return await C.create_batch(db, actor, body.get("reporterId"), body.get("phone") or "", body.get("items") or [])


@router.get("/reports/mine")
async def mine(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    return await C.my_reports(db, actor)


@router.get("/reports")
async def all_reports(actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await C.all_reports(db)


@router.post("/reports/{report_id}/accept")
async def accept(report_id: str, actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    await C.accept(db, actor, report_id)
    return OK


@router.get("/reports/{report_id}/merge-candidates")
async def merge_candidates(report_id: str, actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    """Phiếu chưa xong có thể cùng một sự cố (cùng mã tài sản, hoặc cùng vị trí khi chưa có mã)."""
    return await C.merge_candidates(db, report_id)


@router.post("/reports/{report_id}/merge")
async def merge(report_id: str, body: dict = Body(...), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    """Gộp phiếu trùng một sự cố vào phiếu chính (mainId): tính là một lần sửa chữa."""
    return await C.merge_report(db, actor, report_id, body.get("mainId"))


@router.post("/reports/{report_id}/unmerge")
async def unmerge(report_id: str, actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    return await C.unmerge_report(db, actor, report_id)


@router.get("/reports/{report_id}/case")
async def get_case(report_id: str, actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await C.get_case(db, report_id)


# ---------------------------------------------------------------- Biên bản kiểm tra
@router.post("/inspections")
async def create_inspection(body: dict = Body(...), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    return await C.create_inspection(db, actor, body)


@router.post("/inspections/{inspection_id}/scan")
async def attach_scan(inspection_id: str, body: dict = Body(...), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    await C.attach_inspection_scan(db, inspection_id, body.get("fileId"))
    return OK


@router.get("/inspections/pending-total-loss")
async def pending_total_loss(actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await C.pending_total_loss(db)


@router.post("/inspections/{inspection_id}/total-loss")
async def decide_total_loss(inspection_id: str, body: dict = Body(...), code: Optional[str] = Depends(confirm_code), actor: Actor = Depends(QTNL_LEADER), db: AsyncSession = Depends(get_db)):
    """Lãnh đạo Phòng QTNL xác nhận hoặc trả lại (kèm lý do), đều nhập mã xác nhận cá nhân."""
    await C.decide_total_loss(db, actor, inspection_id, bool(body.get("approve")), body.get("reason") or "", leader_code(body, code))
    return OK


# ---------------------------------------------------------------- Thiết bị tạm, kho không có thiết bị
@router.post("/temp-transfers")
async def create_temp(body: dict = Body(...), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    return await C.create_temp(db, actor, body)


@router.post("/temp-transfers/{temp_id}/return")
async def return_temp(temp_id: str, actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    await C.return_temp(db, temp_id)
    return OK


@router.get("/temp-transfers/active")
async def active_temps(actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await C.active_temps(db)


@router.post("/no-spares")
async def create_no_spare(body: dict = Body(...), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    return await C.create_no_spare(db, actor, body)


@router.get("/no-spares")
async def list_no_spares(actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await C.list_no_spares(db)


# ---------------------------------------------------------------- Dự toán
@router.get("/estimates")
async def list_estimates(actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await C.list_estimates(db)


@router.post("/estimates")
async def create_estimate(body: dict = Body(...), code: Optional[str] = Depends(confirm_code), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    """Gửi dự toán cho lãnh đạo phòng; tài sản bị khóa (Đỏ 1.1, Cam) thì phải kèm đề nghị ngoại lệ. Cần mã xác nhận."""
    await ktv_code(db, actor, code)
    return await C.create_estimate(db, actor, body, body.get("exception"))


@router.post("/estimates/{est_id}/resubmit")
async def resubmit(est_id: str, body: dict = Body(...), code: Optional[str] = Depends(confirm_code), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    await ktv_code(db, actor, code)
    await C.resubmit_estimate(db, actor, est_id, body.get("lines") or [])
    return OK


@router.post("/estimates/{est_id}/confirm")
async def confirm(est_id: str, body: dict = Body(...), code: Optional[str] = Depends(confirm_code), actor: Actor = Depends(QTNL_LEADER), db: AsyncSession = Depends(get_db)):
    await C.confirm_estimate(db, actor, est_id, leader_code(body, code))
    return OK


@router.post("/estimates/{est_id}/return")
async def return_back(est_id: str, body: dict = Body(...), code: Optional[str] = Depends(confirm_code), actor: Actor = Depends(QTNL_LEADER), db: AsyncSession = Depends(get_db)):
    await C.return_estimate(db, actor, est_id, body.get("reason") or "", leader_code(body, code))
    return OK


@router.post("/estimates/{est_id}/signed")
async def mark_signed(est_id: str, body: dict = Body(...), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    await C.mark_signed(db, actor, est_id, body.get("fileId"))
    return OK


@router.post("/estimates/{est_id}/reject")
async def mark_rejected(est_id: str, body: dict = Body(...), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    await C.mark_rejected(db, actor, est_id, body.get("reason") or "")
    return OK


@router.post("/estimates/{est_id}/actual")
async def enter_actual(est_id: str, body: dict = Body(...), code: Optional[str] = Depends(confirm_code), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    await ktv_code(db, actor, code)
    await C.enter_actual(
        db, actor, est_id, body.get("actuals") or {}, body.get("voucherNo") or "", body.get("voucherDate"), body.get("voucherTotal")
    )
    return OK


@router.post("/estimates/{est_id}/actual/correct")
async def correct_actual(est_id: str, body: dict = Body(...), code: Optional[str] = Depends(confirm_code), actor: Actor = Depends(KTV), db: AsyncSession = Depends(get_db)):
    """Sửa chi phí thực tế khi nhập nhầm; lưu lịch sử người sửa, thời gian, số cũ và số mới."""
    await ktv_code(db, actor, code)
    await C.correct_actual(
        db,
        actor,
        est_id,
        body.get("actuals") or {},
        body.get("voucherNo") or "",
        body.get("voucherDate"),
        body.get("voucherTotal"),
        body.get("note") or "",
    )
    return OK


# ---------------------------------------------------------------- Đề nghị ngoại lệ
@router.get("/exceptions")
async def list_exceptions(actor: Actor = Depends(QTNL_OR_KHTC), db: AsyncSession = Depends(get_db)):
    return await C.list_exceptions(db)


@router.post("/exceptions/{exc_id}/decide")
async def decide_exception(exc_id: str, body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    """Phòng KHTC mở khóa (hoặc không, bắt buộc lý do ở conclusion) theo văn bản phê duyệt có đủ chữ ký."""
    await C.decide_exception(db, actor, exc_id, body)
    return OK


# ---------------------------------------------------------------- Ngưỡng cảnh báo
@router.get("/thresholds")
async def get_thresholds(actor: Actor = Depends(ANY_PERSON), db: AsyncSession = Depends(get_db)):
    from services.asset_service import get_thresholds

    return await get_thresholds(db)


@router.get("/thresholds/logs")
async def threshold_logs(actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    return await C.threshold_logs(db)


@router.post("/thresholds/preview")
async def preview_thresholds(body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    return await C.preview_thresholds(db, body)


@router.put("/thresholds")
async def save_thresholds(body: dict = Body(...), actor: Actor = Depends(KHTC), db: AsyncSession = Depends(get_db)):
    return await C.save_thresholds(db, actor, body)


_ = QTNL  # nhóm vai trò dùng ở router khác
