
"""Hồ sơ phiếu báo hỏng: báo hỏng → biên bản kiểm tra → thiết bị tạm (khi khẩn cấp) / kho không có thiết bị →
dự toán → đề nghị ngoại lệ → chi phí thực tế. Giữ đúng quy tắc, câu thông báo của fe_sam/src/utils/mockApi.js."""
import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import clock
from core.deps import Actor
from core.errors import bad, forbidden, not_found
from models import (
    Asset,
    Estimate,
    EstimateHistory,
    EstimateLine,
    ExceptionRequest,
    Handover,
    Inspection,
    NoSpare,
    Recall,
    Report,
    Staff,
    TempTransfer,
    Threshold,
    ThresholdLog,
)
from services import serialize as S
from services.asset_service import light_context, light_of, view, views
from services.code_service import next_code
from services.common import clean, file_or_none, get_or_404, notify, notify_role, parse_date, parse_dt
from services.light_service import LOCKING

PROPOSALS = ("tai_cho", "sua_chua", "hong_toan_phan")
TARGETS = ("tai_san", "phu_kien")
TEMP_SOURCES = ("kho_qtnl", "don_vi_khac", "doi_phong")


def recipients(r: Report) -> list:
    """Người báo (chọn từ dữ liệu cán bộ) và người đã gửi phiếu trên tài khoản đều nhận thông báo khi xong."""
    return [x for x in dict.fromkeys([r.reporter_id, r.account_id]) if x]


async def _finish_report(db: AsyncSession, r: Report) -> None:
    r.status = "hoan_thanh"
    r.completed_at = clock.now()
    if r.reporter_id:
        await notify(db, recipients(r), f"Phiếu {r.code} ({r.asset_name}) đã xử lý xong.", "my-reports")
    for m in await _merged_into(db, r.id):
        m.status = "hoan_thanh"
        m.completed_at = r.completed_at
        m.has_temp_equipment = r.has_temp_equipment
        if m.reporter_id:
            await notify(db, recipients(m), f"Phiếu {m.code} ({m.asset_name}) đã xử lý xong cùng phiếu {r.code}.", "my-reports")


async def _merged_into(db: AsyncSession, report_id: str) -> list:
    return list((await db.execute(select(Report).where(Report.merged_into_id == report_id).order_by(Report.code))).scalars())


async def verify_leader(db: AsyncSession, actor: Actor, code: Optional[str]) -> Staff:
    """Lãnh đạo Phòng QTNL nhập mã xác nhận cá nhân của mình khi xác nhận (mục VII đề tài)."""
    from services.auth_service import verify_code

    await verify_code(db, actor, code, roles=("lanhdao_qtnl",), reason="bad_leader_code", message="Mã xác nhận của lãnh đạo không đúng")
    return actor.staff


# ---------------------------------------------------------------- Phiếu báo hỏng
async def create_batch(db: AsyncSession, actor: Actor, reporter_id: str, phone: str, items: list) -> dict:
    if not items:
        raise bad("Chưa có tài sản nào để báo hỏng")
    if actor.staff is None:
        raise forbidden("Tài khoản quản trị hệ thống không lập phiếu báo hỏng; dùng tài khoản cá nhân")
    # Họ tên người báo tự điền theo tài khoản đang đăng nhập; kỹ thuật viên, lãnh đạo Phòng QTNL được lập phiếu thay
    # (sự cố tự phát hiện hoặc nhận báo qua điện thoại) thì chọn người báo từ dữ liệu cán bộ.
    reporter = actor.staff
    if actor.role in ("ktv", "lanhdao_qtnl") and reporter_id and reporter_id != actor.id:
        reporter = await db.get(Staff, reporter_id)
        if reporter is None:
            raise bad("Chọn người báo từ dữ liệu cán bộ")
    person = reporter
    phone = clean(phone)
    at = clock.now()
    today = clock.today()
    batch = await next_code(db, "DOT-")
    source = "qtnl" if actor.role == "ktv" else "can_bo"
    created = []
    for it in items:
        asset = await db.get(Asset, it["assetId"]) if it.get("assetId") else None
        if it.get("assetId") and asset is None:
            raise bad("Không tìm thấy tài sản")
        if asset and asset.status == "da_thanh_ly":
            raise bad(f"Tài sản {asset.code} đã thanh lý")
        name = asset.name if asset else clean(it.get("assetName"))
        location = clean(it.get("location")) or (asset.location if asset else "")
        if not asset and (not name or not location):
            raise bad("Tài sản không có tem: nhập tên và vị trí")
        if not clean(it.get("content")):
            raise bad("Nhập nội dung báo hỏng")
        r = Report(
            code=await next_code(db, f"PH-{today.year}-"),
            batch_code=batch,
            reporter_id=person.id,
            reporter_name=person.name,
            reporter_unit=person.unit,
            account_id=actor.id,
            phone=phone,
            created_at=at,
            source=source,
            asset_id=asset.id if asset else None,
            asset_name=name,
            location=location,
            content=clean(it.get("content")),
            situation=clean(it.get("situation")),
            urgent=bool(it.get("urgent")),
            status="da_gui",
        )
        db.add(r)
        created.append(r)
        if asset:
            asset.last_interaction_date = today
    urgent = any(r.urgent for r in created)
    if phone and person.phone != phone:
        person.phone = phone
    await db.flush()
    # Thông báo đẩy về điện thoại kỹ thuật viên: mã phiếu, tài sản, vị trí, tình huống (không có số điện thoại)
    first = created[0]
    if len(created) == 1:
        sit = f" Tình huống: {first.situation}." if first.situation else ""
        text = f"{'Khẩn cấp: ' if urgent else ''}Phiếu {first.code}: {first.asset_name} tại {first.location}.{sit} Người báo {person.name}."
        link = f"case:{first.id}"
    else:
        text = f"{'Khẩn cấp: ' if urgent else ''}{person.name} báo hỏng {len(created)} tài sản ({batch}), {first.location}."
        link = "queue"
    await notify_role(db, "ktv", text, link)
    return {"batchCode": batch, "reports": [S.report(r) for r in created]}


async def my_reports(db: AsyncSession, actor: Actor) -> list:
    rows = list(
        (
            await db.execute(
                select(Report)
                .where((Report.reporter_id == actor.id) | (Report.account_id == actor.id))
                .order_by(Report.created_at.desc())
            )
        ).scalars()
    )
    return await with_merged(db, rows)


async def with_merged(db: AsyncSession, rows: list) -> list:
    """Phiếu đã gộp vào phiếu chính (trùng một sự cố): trạng thái, kỹ thuật viên, nhãn thiết bị tạm theo phiếu chính."""
    ids = {r.merged_into_id for r in rows if r.merged_into_id}
    mains = {m.id: m for m in (await db.execute(select(Report).where(Report.id.in_(ids)))).scalars()} if ids else {}
    out = []
    for r in rows:
        d = S.report(r)
        m = mains.get(r.merged_into_id)
        if m:
            d.update(
                status=m.status,
                technicianId=m.technician_id,
                hasTempEquipment=bool(m.has_temp_equipment),
                completedAt=clock.stamp(m.completed_at),
                mergedIntoCode=m.code,
            )
        out.append(d)
    return out


async def all_reports(db: AsyncSession) -> list:
    return await with_merged(db, list((await db.execute(select(Report).order_by(Report.created_at, Report.code))).scalars()))


async def accept(db: AsyncSession, actor: Actor, report_id: str) -> None:
    r = await get_or_404(db, Report, report_id, "Không tìm thấy phiếu")
    if r.merged_into_id:
        raise bad("Phiếu đã gộp vào phiếu khác")
    first = r.status == "da_gui"
    r.status = "dang_xu_ly"
    r.technician_id = actor.id
    if first:
        await notify(db, recipients(r), f"Phiếu {r.code} ({r.asset_name}) đã được tiếp nhận, kỹ thuật viên {actor.name} đang xử lý.", "my-reports")


# ---------------------------------------------------------------- Gộp phiếu trùng một sự cố (mục 5.3 đề tài)
async def merge_candidates(db: AsyncSession, report_id: str) -> list:
    """Phiếu chưa xong có thể là cùng một sự cố: cùng mã tài sản; phiếu chưa có mã tài sản thì cùng vị trí."""
    r = await get_or_404(db, Report, report_id, "Không tìm thấy phiếu")
    q = select(Report).where(Report.id != r.id, Report.status != "hoan_thanh", Report.merged_into_id.is_(None))
    if r.asset_id:
        q = q.where((Report.asset_id == r.asset_id) | ((Report.asset_id.is_(None)) & (Report.location == r.location)))
    else:
        q = q.where(Report.location == r.location)
    return [S.report(x) for x in (await db.execute(q.order_by(Report.created_at, Report.code))).scalars()]


async def _can_merge(db: AsyncSession, r: Report) -> None:
    if r.merged_into_id:
        raise bad("Phiếu đã gộp vào phiếu khác")
    if r.status == "hoan_thanh":
        raise bad("Phiếu đã hoàn thành")
    for model, label in ((Inspection, "biên bản kiểm tra"), (Estimate, "dự toán"), (TempTransfer, "phiếu cấp thiết bị tạm")):
        if (await db.execute(select(model.id).where(model.report_id == r.id).limit(1))).first():
            raise bad(f"Phiếu đã có {label}, không gộp được")
    if await _merged_into(db, r.id):
        raise bad("Đã có phiếu khác gộp vào phiếu này")


async def merge_report(db: AsyncSession, actor: Actor, report_id: str, main_id: str) -> dict:
    """Phiếu trùng gộp vào phiếu chính: không lập biên bản, dự toán riêng nên chỉ tính một lần sửa chữa;
    trạng thái theo phiếu chính, người báo được báo khi xong."""
    r = await get_or_404(db, Report, report_id, "Không tìm thấy phiếu")
    main = await get_or_404(db, Report, main_id, "Không tìm thấy phiếu chính")
    if main.id == r.id:
        raise bad("Chọn phiếu khác")
    await _can_merge(db, r)
    if main.merged_into_id or main.status == "hoan_thanh":
        raise bad("Phiếu chính đã gộp hoặc đã hoàn thành")
    if r.asset_id and main.asset_id and r.asset_id != main.asset_id:
        raise bad("Hai phiếu khác mã tài sản")
    if main.status == "da_gui":
        main.status = "dang_xu_ly"
        main.technician_id = actor.id
    if not main.asset_id and r.asset_id:
        main.asset_id = r.asset_id
        main.asset_name = r.asset_name
    if not r.asset_id and main.asset_id:
        r.asset_id = main.asset_id
        r.asset_name = main.asset_name
    if r.urgent and not main.urgent:
        main.urgent = True
        main.situation = main.situation or r.situation
    r.merged_into_id = main.id
    r.merged_by = actor.id
    r.merged_at = clock.now()
    r.status = main.status
    r.technician_id = main.technician_id
    await notify(db, recipients(r), f"Phiếu {r.code} trùng sự cố với phiếu {main.code}, được gộp để xử lý một lần.", "my-reports")
    await db.flush()
    return (await with_merged(db, [r]))[0]


async def unmerge_report(db: AsyncSession, actor: Actor, report_id: str) -> dict:
    r = await get_or_404(db, Report, report_id, "Không tìm thấy phiếu")
    if not r.merged_into_id:
        raise bad("Phiếu chưa gộp")
    main = await db.get(Report, r.merged_into_id)
    if main and main.status == "hoan_thanh":
        raise bad("Phiếu chính đã hoàn thành")
    r.merged_into_id = None
    r.merged_by = None
    r.merged_at = None
    r.status = "dang_xu_ly"
    r.technician_id = actor.id
    await db.flush()
    return S.report(r)


def can_enter_actual(est: dict, exc: Optional[dict]) -> dict:
    if est["status"] != "da_ky_du":
        return {"ok": False, "reason": "Dự toán chưa có đủ chữ ký"}
    if est["actualEnteredAt"]:
        return {"ok": False, "reason": "Đã nhập chi phí thực tế"}
    if est["locked"] and (not exc or exc["status"] != "da_mo_khoa"):
        return {"ok": False, "reason": "Chờ Phòng KHTC mở khóa theo văn bản phê duyệt"}
    return {"ok": True}


def estimate_out(e: Estimate, exc: Optional[ExceptionRequest]) -> dict:
    d = S.estimate(e)
    x = S.exception(exc) if exc else None
    d["exception"] = x
    d["canEnterActual"] = can_enter_actual(d, x)
    return d


async def get_case(db: AsyncSession, report_id: str) -> dict:
    from services.recall_service import eligibility

    report = await get_or_404(db, Report, report_id, "Không tìm thấy phiếu")
    asset = None
    if report.asset_id:
        a = await get_or_404(db, Asset, report.asset_id, "Không tìm thấy tài sản")
        asset = (await views(db, [a]))[0]
    inspection = (await db.execute(select(Inspection).where(Inspection.report_id == report.id).order_by(Inspection.code))).scalars().first()
    ests = list((await db.execute(select(Estimate).where(Estimate.report_id == report.id).order_by(Estimate.created_at, Estimate.code))).scalars())
    est = next((e for e in ests if e.status != "khong_dong_y"), None) or (ests[0] if ests else None)
    exc = (await db.execute(select(ExceptionRequest).where(ExceptionRequest.estimate_id == est.id))).scalars().first() if est else None
    temps = (await db.execute(select(TempTransfer).where(TempTransfer.report_id == report.id).order_by(TempTransfer.code))).scalars()
    batch = (
        await db.execute(
            select(Report).where(Report.batch_code == report.batch_code, Report.id != report.id).order_by(Report.code)
        )
    ).scalars()
    recalls = list((await db.execute(select(Recall).where(Recall.report_id == report.id).order_by(Recall.proposed_at, Recall.code))).scalars())
    recall = next((r for r in reversed(recalls) if r.status != "khong_dong_y"), None) or (recalls[-1] if recalls else None)
    handover = await db.get(Handover, recall.handover_id) if recall and recall.handover_id else None
    no_spares = (await db.execute(select(NoSpare).where(NoSpare.report_id == report.id).order_by(NoSpare.recorded_at))).scalars()
    main = await db.get(Report, report.merged_into_id) if report.merged_into_id else None
    return {
        "report": (await with_merged(db, [report]))[0],
        "mergedInto": S.report(main) if main else None,
        "merged": [S.report(m) for m in await _merged_into(db, report.id)],
        "asset": asset,
        "inspection": S.inspection(inspection) if inspection else None,
        "estimate": estimate_out(est, exc) if est else None,
        "exception": S.exception(exc) if exc else None,
        "temps": [S.temp_transfer(t) for t in temps],
        "batch": [S.report(r) for r in batch],
        "recall": S.recall(recall) if recall else None,
        "handover": S.handover(handover) if handover else None,
        "noSpares": [S.no_spare(n) for n in no_spares],
        "recallEligibility": await eligibility(db, report.id),
    }


# ---------------------------------------------------------------- Biên bản kiểm tra
async def create_inspection(db: AsyncSession, actor: Actor, data: dict) -> dict:
    report = await get_or_404(db, Report, data.get("reportId"), "Không tìm thấy phiếu báo hỏng")
    asset = await get_or_404(db, Asset, data.get("assetId"), "Không tìm thấy tài sản")
    if data.get("proposal") not in PROPOSALS:
        raise bad("Chọn đề xuất xử lý")
    if not clean(data.get("findings")):
        raise bad("Nhập tình trạng ghi nhận khi kiểm tra.")
    if not report.asset_id:
        report.asset_id = asset.id
        report.asset_name = asset.name
    ins = Inspection(
        code=await next_code(db, "BB-"),
        report_id=report.id,
        asset_id=asset.id,
        inspected_at=parse_dt(data.get("inspectedAt")) or clock.now(),
        technician_id=actor.id,
        findings=clean(data.get("findings")),
        target=data.get("target") if data.get("target") in TARGETS else "tai_san",
        proposal=data["proposal"],
        proposal_note=data.get("proposalNote") or "",
        temp_solution=data.get("tempSolution") or "",
        note=data.get("note") or "",
        total_loss_status="cho_xac_minh" if data["proposal"] == "hong_toan_phan" else None,
    )
    db.add(ins)
    report.status = "dang_xu_ly"
    report.technician_id = report.technician_id or actor.id
    if data["proposal"] == "tai_cho":
        await _finish_report(db, report)
    if data["proposal"] == "hong_toan_phan":
        await notify_role(db, "lanhdao_qtnl", f"Biên bản {ins.code}: {asset.name} ({asset.code}) hư hỏng toàn phần, chờ xác nhận.", "approvals:total-loss")
    await db.flush()
    return S.inspection(ins)


async def attach_inspection_scan(db: AsyncSession, inspection_id: str, file_id: str) -> None:
    ins = await get_or_404(db, Inspection, inspection_id, "Không tìm thấy biên bản")
    f = await file_or_none(db, file_id)
    ins.scan_file_id = f.id if f else None


async def pending_total_loss(db: AsyncSession) -> list:
    rows = (await db.execute(select(Inspection).where(Inspection.total_loss_status == "cho_xac_minh").order_by(Inspection.code))).scalars()
    return [S.inspection(i) for i in rows]


async def decide_total_loss(db: AsyncSession, actor: Actor, inspection_id: str, approve: bool, reason: str, leader_code: str) -> None:
    i = await get_or_404(db, Inspection, inspection_id, "Không tìm thấy biên bản")
    if i.total_loss_status != "cho_xac_minh":
        raise bad("Biên bản không ở trạng thái chờ xác minh")
    asset = await get_or_404(db, Asset, i.asset_id, "Không tìm thấy tài sản")
    report = await db.get(Report, i.report_id)
    if approve:
        leader = await verify_leader(db, actor, leader_code)
        i.total_loss_status = "da_xac_nhan"
        i.total_loss_by = leader.id
        i.total_loss_at = clock.now()
        asset.total_loss_confirmed_at = clock.today()
        if report:
            await _finish_report(db, report)
        await notify_role(db, "khtc", f"{asset.name} ({asset.code}) hư hỏng toàn phần đã xác nhận, vào danh sách chờ thanh lý.", f"asset:{asset.id}")
    else:
        if not clean(reason):
            raise bad("Nhập lý do trả lại.")
        await verify_leader(db, actor, leader_code)
        i.total_loss_status = "tra_lai"
        i.total_loss_return_reason = clean(reason)
        await notify(db, [i.technician_id], f"Biên bản {i.code} bị trả lại: {clean(reason)}", f"case:{i.report_id}")


# ---------------------------------------------------------------- Thiết bị thay thế tạm thời, kho không có thiết bị
async def require_urgent(db: AsyncSession, report_id: str) -> Report:
    """Cấp thiết bị tạm chỉ áp dụng khi phiếu khẩn cấp (tình huống thuộc danh mục khẩn cấp do Phòng QTNL soạn)."""
    r = await db.get(Report, report_id) if report_id else None
    if not r or not r.urgent:
        raise bad("Chỉ cấp thiết bị tạm khi phiếu khẩn cấp", "not_urgent")
    return r


async def create_temp(db: AsyncSession, actor: Actor, data: dict) -> dict:
    report = await require_urgent(db, data.get("reportId"))
    repl = await db.get(Asset, data.get("replacementAssetId")) if data.get("replacementAssetId") else None
    if repl is None:
        raise bad("Chọn thiết bị cấp tạm (thiết bị nào cũng có mã tài sản).")
    t = TempTransfer(
        code=await next_code(db, "DC-TT-"),
        report_id=report.id,
        original_asset_id=data.get("originalAssetId") or report.asset_id,
        replacement_asset_id=repl.id,
        source=data.get("source") if data.get("source") in TEMP_SOURCES else "kho_qtnl",
        use_location=clean(data.get("useLocation")),
        expected_return=clean(data.get("expectedReturn")),
        receiver_name=clean(data.get("receiverName")),
        receiver_unit=clean(data.get("receiverUnit")),
        created_by=actor.id,
        issued_at=parse_dt(data.get("issuedAt")) or clock.now(),
    )
    db.add(t)
    report.has_temp_equipment = True
    report.status = "dang_xu_ly"
    report.technician_id = report.technician_id or actor.id
    repl.last_interaction_date = clock.today()
    await db.flush()
    return S.temp_transfer(t)


async def return_temp(db: AsyncSession, temp_id: str) -> None:
    t = await get_or_404(db, TempTransfer, temp_id, "Không tìm thấy phiếu điều chuyển tạm thời")
    t.returned_at = t.returned_at or clock.now()


async def active_temps(db: AsyncSession) -> list:
    return [S.temp_transfer(t) for t in (await db.execute(select(TempTransfer).where(TempTransfer.returned_at.is_(None)))).scalars()]


async def create_no_spare(db: AsyncSession, actor: Actor, data: dict) -> dict:
    """Phòng QTNL ghi nhận kèm lý do khi kho không có thiết bị cấp tạm: dữ liệu cho kế hoạch mua sắm thiết bị dự phòng."""
    report = await require_urgent(db, data.get("reportId"))
    if not clean(data.get("need")) or not clean(data.get("reason")):
        raise bad("Nhập thiết bị cần và lý do")
    asset = await db.get(Asset, report.asset_id) if report.asset_id else None
    n = NoSpare(
        report_id=report.id,
        asset_id=asset.id if asset else None,
        group_code=asset.group_code if asset else "",
        need=clean(data["need"]),
        reason=clean(data["reason"]),
        situation=report.situation,
        recorded_by=actor.id,
        recorded_at=clock.now(),
    )
    db.add(n)
    if report.status == "da_gui":
        report.status = "dang_xu_ly"
    report.technician_id = report.technician_id or actor.id
    await db.flush()
    return S.no_spare(n)


async def list_no_spares(db: AsyncSession) -> list:
    return [S.no_spare(n) for n in (await db.execute(select(NoSpare).order_by(NoSpare.recorded_at.desc()))).scalars()]


# ---------------------------------------------------------------- Dự toán
def _lines(raw: list) -> list:
    out = []
    for i, l in enumerate(raw or []):
        content = clean(l.get("content"))
        if not content:
            continue
        try:
            amount = int(round(float(l.get("estimate") or 0)))
        except (TypeError, ValueError):
            raise bad("Số tiền dự toán không đúng")
        if amount < 0:
            raise bad("Số tiền dự toán không đúng")
        out.append(
            EstimateLine(
                sort=i,
                job_id=l.get("jobId") or None,
                content=content,
                cost_group="khong_tinh" if l.get("costGroup") == "khong_tinh" else "tinh",
                estimate=amount,
                actual=None,
            )
        )
    if not out:
        raise bad("Chưa có dòng dự toán nào")
    return out


def _draft(lines: list) -> list:
    return [{"costGroup": l.cost_group, "estimate": l.estimate, "actual": None} for l in lines]


async def list_estimates(db: AsyncSession) -> list:
    ests = list((await db.execute(select(Estimate).order_by(Estimate.created_at.desc(), Estimate.code.desc()))).scalars())
    excs = {x.estimate_id: x for x in (await db.execute(select(ExceptionRequest))).scalars()}
    return [estimate_out(e, excs.get(e.id)) for e in ests]


async def create_estimate(db: AsyncSession, actor: Actor, data: dict, exception: Optional[dict]) -> dict:
    asset = await get_or_404(db, Asset, data.get("assetId"), "Không tìm thấy tài sản")
    lines = _lines(data.get("lines"))
    ctx = await light_context(db, [asset.id])
    a = S.asset(asset)
    before = light_of(ctx, a)
    after = light_of(ctx, a, draft_lines=_draft(lines))
    locked = after["code"] in LOCKING
    if locked and not exception:
        raise bad("Tài sản bị khóa phiếu dự toán: cần lập đề nghị ngoại lệ", "locked")
    at = clock.now()
    est = Estimate(
        code=await next_code(db, "DT-"),
        created_at=clock.today(),
        asset_id=asset.id,
        inspection_id=data.get("inspectionId"),
        report_id=data.get("reportId"),
        created_by=actor.id,
        status="cho_lanh_dao",
        locked=locked,
        light_before=before["code"],
        light_after=after["code"],
    )
    est.lines = lines
    est.history = [EstimateHistory(at=at, by=actor.id, action="Lập dự toán")]
    db.add(est)
    await db.flush()
    exc = None
    if locked and exception:
        if not clean(exception.get("reason")):
            raise bad("Nhập lý do cấp thiết")
        exc = ExceptionRequest(
            code=await next_code(db, "NL-"),
            estimate_id=est.id,
            asset_id=asset.id,
            reason=clean(exception.get("reason")),
            extra_time=clean(exception.get("extraTime")),
            temp_equipment=clean(exception.get("tempEquipment")),
            status="cho_mo_khoa",
            created_by=actor.id,
            created_at=at,
        )
        db.add(exc)
        est.history.append(EstimateHistory(at=at, by=actor.id, action=f"Lập đề nghị ngoại lệ {exc.code}"))
        await notify_role(db, "khtc", f"Đề nghị ngoại lệ {exc.code} cho {asset.name} ({asset.code}) chờ mở khóa.", "exceptions")
    await notify_role(db, "lanhdao_qtnl", f"Dự toán {est.code} ({asset.name}) chờ xác nhận.", "approvals:estimates")
    await db.flush()
    return {"estimate": estimate_out(est, exc), "exception": S.exception(exc) if exc else None}


async def _estimate(db: AsyncSession, est_id: str) -> Estimate:
    return await get_or_404(db, Estimate, est_id, "Không tìm thấy dự toán")


async def resubmit_estimate(db: AsyncSession, actor: Actor, est_id: str, raw_lines: list) -> None:
    est = await _estimate(db, est_id)
    if est.status != "can_kiem_tra_lai":
        raise bad("Dự toán không ở trạng thái cần kiểm tra lại")
    asset = await get_or_404(db, Asset, est.asset_id, "Không tìm thấy tài sản")
    est.lines = _lines(raw_lines)
    ctx = await light_context(db, [asset.id])
    est.light_after = light_of(ctx, S.asset(asset), draft_lines=_draft(est.lines), exclude_estimate_id=est.id)["code"]
    est.status = "cho_lanh_dao"
    est.history.append(EstimateHistory(at=clock.now(), by=actor.id, action="Sửa và gửi lại"))
    await notify_role(db, "lanhdao_qtnl", f"Dự toán {est.code} đã được sửa và gửi lại.", "approvals:estimates")


async def confirm_estimate(db: AsyncSession, actor: Actor, est_id: str, leader_code: str) -> None:
    est = await _estimate(db, est_id)
    leader = await verify_leader(db, actor, leader_code)
    if est.created_by == leader.id:
        raise bad("Không xác nhận phiếu do chính mình lập")
    if est.status != "cho_lanh_dao":
        raise bad("Dự toán không ở trạng thái chờ lãnh đạo phòng")
    est.status = "da_xac_nhan"
    est.confirmed_by = leader.id
    est.confirmed_at = clock.now()
    est.return_reason = None
    est.history.append(EstimateHistory(at=est.confirmed_at, by=leader.id, action="Xác nhận dự toán"))
    await notify(db, [est.created_by], f"Dự toán {est.code} đã được xác nhận, chờ in và ký.", f"case:{est.report_id}" if est.report_id else "estimates")


async def return_estimate(db: AsyncSession, actor: Actor, est_id: str, reason: str, leader_code: Optional[str] = None) -> None:
    est = await _estimate(db, est_id)
    if not clean(reason):
        raise bad("Nhập lý do trả lại.")
    if est.status != "cho_lanh_dao":
        raise bad("Dự toán không ở trạng thái chờ lãnh đạo phòng")
    await verify_leader(db, actor, leader_code)
    est.status = "can_kiem_tra_lai"
    est.return_reason = clean(reason)
    est.history.append(EstimateHistory(at=clock.now(), by=actor.id, action="Trả lại", note=clean(reason)))
    await notify(db, [est.created_by], f"Dự toán {est.code} bị trả lại: {clean(reason)}", f"case:{est.report_id}" if est.report_id else "estimates")


async def mark_signed(db: AsyncSession, actor: Actor, est_id: str, file_id: str) -> None:
    est = await _estimate(db, est_id)
    if est.status != "da_xac_nhan":
        raise bad("Dự toán chưa được lãnh đạo phòng xác nhận")
    f = await file_or_none(db, file_id)
    if not f:
        raise bad("Đính kèm bản quét đã ký đủ")
    est.status = "da_ky_du"
    est.signed_scan_id = f.id
    est.history.append(EstimateHistory(at=clock.now(), by=actor.id, action="Đính kèm bản đã ký đủ"))


async def mark_rejected(db: AsyncSession, actor: Actor, est_id: str, reason: str) -> None:
    est = await _estimate(db, est_id)
    if not clean(reason):
        raise bad("Nhập lý do")
    est.status = "khong_dong_y"
    est.return_reason = clean(reason)
    est.history.append(EstimateHistory(at=clock.now(), by=actor.id, action="Không đồng ý", note=clean(reason)))


def voucher_key(no: Optional[str]) -> str:
    """So số hóa đơn, chứng từ không phân biệt hoa thường, khoảng trắng."""
    return re.sub(r"\s+", "", no or "").lower()


def _money(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def _set_actuals(est: Estimate, actuals: dict) -> None:
    for l in est.lines:
        v = (actuals or {}).get(l.id)
        try:
            n = int(round(float(v))) if v is not None and v != "" else l.estimate
        except (TypeError, ValueError):
            raise bad("Số tiền thực tế không đúng")
        if n < 0:
            raise bad("Số tiền thực tế không đúng")
        l.actual = n


async def _apply_voucher(db: AsyncSession, est: Estimate, voucher_no: str, voucher_date: str, voucher_total) -> None:
    """Hóa đơn gộp nhiều mã tài sản: kỹ thuật viên chia chi phí cho từng mã; tổng các mã không được vượt tổng hóa đơn
    (mục 5.5 đề tài). Tổng hóa đơn ghi chung cho mọi phiếu cùng số hóa đơn."""
    no = clean(voucher_no)
    if not no:
        raise bad("Nhập số hóa đơn, chứng từ")
    total = None
    if voucher_total not in (None, ""):
        try:
            total = int(round(float(voucher_total)))
        except (TypeError, ValueError):
            raise bad("Tổng tiền hóa đơn không đúng")
        if total < 0:
            raise bad("Tổng tiền hóa đơn không đúng")
    key = voucher_key(no)
    same = [
        e
        for e in (await db.execute(select(Estimate).where(Estimate.id != est.id, Estimate.actual_entered_at.is_not(None)))).scalars()
        if voucher_key(e.voucher_no) == key
    ]
    if total is None:
        total = next((e.voucher_total for e in same if e.voucher_total is not None), None)
    if total is not None:
        used = sum(l.actual or 0 for e in same for l in e.lines) + sum(l.actual or 0 for l in est.lines)
        if used > total:
            raise bad(f"Tổng chi phí các mã cùng hóa đơn {no} là {_money(used)} đ, vượt tổng hóa đơn {_money(total)} đ")
        for e in same:
            e.voucher_total = total
    est.voucher_no = no
    est.voucher_date = parse_date(voucher_date)
    est.voucher_total = total


async def enter_actual(
    db: AsyncSession, actor: Actor, est_id: str, actuals: dict, voucher_no: str, voucher_date: str, voucher_total=None
) -> None:
    est = await _estimate(db, est_id)
    exc = (await db.execute(select(ExceptionRequest).where(ExceptionRequest.estimate_id == est.id))).scalars().first()
    check = can_enter_actual(S.estimate(est), S.exception(exc) if exc else None)
    if not check["ok"]:
        raise bad(check["reason"])
    _set_actuals(est, actuals)
    await _apply_voucher(db, est, voucher_no, voucher_date, voucher_total)
    est.actual_entered_at = clock.now()
    est.history.append(EstimateHistory(at=est.actual_entered_at, by=actor.id, action="Nhập chi phí thực tế"))
    report = await db.get(Report, est.report_id) if est.report_id else None
    if report:
        await _finish_report(db, report)
        report.completed_at = est.actual_entered_at
        temp = (
            await db.execute(select(TempTransfer).where(TempTransfer.report_id == report.id, TempTransfer.returned_at.is_(None)))
        ).scalars().first()
        if temp:
            await notify(db, [actor.id], f"Nhắc thu hồi thiết bị tạm theo phiếu {temp.code}: tài sản gốc đã sửa xong.", f"case:{report.id}")


async def correct_actual(
    db: AsyncSession, actor: Actor, est_id: str, actuals: dict, voucher_no: str, voucher_date: str, voucher_total, note: str
) -> None:
    """Phòng QTNL điều chỉnh chi phí thực tế khi nhập nhầm; ghi người sửa, thời gian sửa, số cũ và số mới; đèn tự tính lại
    (mục IV, 5.5 đề tài)."""
    est = await _estimate(db, est_id)
    if not est.actual_entered_at:
        raise bad("Chưa nhập chi phí thực tế")
    old_total = sum(l.actual or 0 for l in est.lines)
    old_voucher = est.voucher_no
    _set_actuals(est, actuals)
    await _apply_voucher(db, est, voucher_no, voucher_date, voucher_total)
    new_total = sum(l.actual or 0 for l in est.lines)
    parts = [f"Thực tế {_money(old_total)} đ thành {_money(new_total)} đ"]
    if voucher_key(old_voucher) != voucher_key(est.voucher_no):
        parts.append(f"chứng từ {old_voucher} thành {est.voucher_no}")
    if clean(note):
        parts.append(clean(note))
    est.history.append(EstimateHistory(at=clock.now(), by=actor.id, action="Sửa chi phí thực tế", note="; ".join(parts)))


# ---------------------------------------------------------------- Đề nghị ngoại lệ
async def list_exceptions(db: AsyncSession) -> list:
    """Kèm tình huống của phiếu báo hỏng: phiếu có tình huống gấp được ưu tiên (mục 5.4 đề tài)."""
    rows = list((await db.execute(select(ExceptionRequest).order_by(ExceptionRequest.created_at.desc()))).scalars())
    est_ids = [x.estimate_id for x in rows]
    reports = {}
    if est_ids:
        q = select(Estimate.id, Report.urgent, Report.situation).join(Report, Report.id == Estimate.report_id).where(Estimate.id.in_(est_ids))
        reports = {eid: (u, s) for eid, u, s in (await db.execute(q)).all()}
    out = []
    for x in rows:
        u, s = reports.get(x.estimate_id, (False, ""))
        out.append({**S.exception(x), "urgent": bool(u), "situation": s or ""})
    return out


async def decide_exception(db: AsyncSession, actor: Actor, exc_id: str, data: dict) -> None:
    x = await get_or_404(db, ExceptionRequest, exc_id, "Không tìm thấy đề nghị")
    if x.status != "cho_mo_khoa":
        raise bad("Đề nghị đã được xử lý")
    approve = bool(data.get("approve"))
    doc_no = clean(data.get("docNo"))
    if not doc_no:
        raise bad("Nhập số văn bản và đính kèm bản quét có đủ chữ ký.")
    reason = clean(data.get("conclusion"))
    if not approve and not reason:
        raise bad("Nhập lý do không duyệt")
    f = await file_or_none(db, data.get("fileId"))
    x.status = "da_mo_khoa" if approve else "khong_dong_y"
    x.doc_no = doc_no
    x.doc_date = parse_date(data.get("docDate"))
    x.conclusion = reason
    x.decided_by = actor.id
    x.decided_at = clock.now()
    if f:
        x.scan_file_id = f.id
    est = await db.get(Estimate, x.estimate_id)
    if est:
        est.history.append(
            EstimateHistory(
                at=x.decided_at,
                by=actor.id,
                action=f"Mở khóa theo {doc_no}" if approve else f"Không đồng ý mở khóa ({doc_no})",
                note="" if approve else reason,
            )
        )
        if not approve:
            est.status = "khong_dong_y"
        await notify(
            db,
            [est.created_by],
            f"Đề nghị ngoại lệ {x.code} đã được mở khóa. Có thể sửa chữa và nhập chi phí thực tế."
            if approve
            else f"Đề nghị ngoại lệ {x.code} không được đồng ý. Lý do: {reason}",
            link=f"case:{est.report_id}" if est.report_id else "estimates",
        )


# ---------------------------------------------------------------- Ngưỡng cảnh báo
def _valid_thresholds(nxt: dict) -> dict:
    out = {}
    for k in S.THRESHOLD_FIELDS:
        try:
            v = int(nxt[k])
        except (KeyError, TypeError, ValueError):
            raise bad("Ngưỡng chưa đúng")
        if v < 0 or v > 1000:
            raise bad("Ngưỡng chưa đúng")
        out[k] = v
    return out


async def threshold_logs(db: AsyncSession) -> list:
    return [S.threshold_log(l) for l in (await db.execute(select(ThresholdLog).order_by(ThresholdLog.at.desc()))).scalars()]


async def preview_thresholds(db: AsyncSession, nxt: dict) -> list:
    """Tài sản sẽ đổi màu nếu áp dụng ngưỡng mới."""
    nxt = _valid_thresholds(nxt)
    ctx = await light_context(db)
    changes = []
    for a in (await db.execute(select(Asset).order_by(Asset.code))).scalars():
        d = S.asset(a)
        frm = light_of(ctx, d)
        to = light_of(ctx, d, th=nxt)
        if frm["code"] != to["code"]:
            changes.append({"asset": view(ctx, a), "from": frm, "to": to})
    return changes


async def save_thresholds(db: AsyncSession, actor: Actor, nxt: dict) -> dict:
    nxt = _valid_thresholds(nxt)
    t = await db.get(Threshold, 1)
    at = clock.now()
    for k, col in S.THRESHOLD_FIELDS.items():
        old = getattr(t, col)
        if nxt[k] != old:
            db.add(ThresholdLog(at=at, by=actor.id, field=k, old_value=old, new_value=nxt[k]))
            setattr(t, col, nxt[k])
    return S.thresholds(t)


async def own_report_or_403(db: AsyncSession, actor: Actor, report_id: str) -> Report:
    r = await db.get(Report, report_id)
    if r is None:
        raise not_found("Không tìm thấy phiếu")
    if actor.role in ("ktv", "lanhdao_qtnl", "khtc"):
        return r
    if actor.id not in (r.reporter_id, r.account_id):
        raise forbidden("Chỉ xem được phiếu của mình")
    return r
