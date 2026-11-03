
"""Thu hồi tài sản hỏng về kho (khác thu hồi thiết bị tạm), 5 bước:
1. Phòng QTNL đề nghị → 2. Phòng KHTC xác nhận → 3. Kỹ thuật viên lập biên bản giao nhận →
4. Phòng KHTC nhập điều chuyển chính thức, vị trí về kho (số văn bản, bản quét có thể đính kèm sau) →
5. "Đã thu hồi về kho, chờ phương án xử lý", giữ màu đèn.
Biên bản bàn giao khi cấp phát, điều chuyển chính thức (Phòng KHTC nhập): lưu là cập nhật đơn vị, vị trí của tài sản."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core import clock
from core.deps import Actor
from core.errors import bad
from models import Asset, Estimate, ExceptionRequest, Handover, HandoverItem, HandoverPerson, Inspection, Recall, Report
from services import serialize as S
from services.asset_service import light_context, light_of
from services.catalog_service import ensure_unit
from services.code_service import next_code
from services.common import clean, file_or_none, get_or_404, notify, notify_role, parse_date

PLANS = ("cho_thanh_ly", "tan_dung", "sua_sau")
KINDS = ("cap_phat", "dieu_chuyen")


def _eligibility(report, asset, ins, ests, active_recall, excs) -> dict:
    if not report or not report.asset_id or not asset or asset.status != "dang_su_dung" or active_recall:
        return {"ok": False}
    if ins and ins.proposal == "hong_toan_phan" and ins.total_loss_status == "da_xac_nhan":
        return {"ok": True, "basis": "hong_toan_phan", "note": f"Biên bản {ins.code} đã xác nhận hư hỏng toàn phần"}
    est = ests[-1] if ests else None
    if est and est.status == "khong_dong_y":
        x = excs.get(est.id)
        note = f"Đề nghị ngoại lệ {x.code} không được mở khóa" if x and x.status == "khong_dong_y" else f"Dự toán {est.code} không được duyệt"
        return {"ok": True, "basis": "khong_duyet", "note": note}
    return {"ok": False}


async def eligibility(db: AsyncSession, report_id: str) -> dict:
    """Hồ sơ có được đề nghị thu hồi không: hư hỏng toàn phần đã xác nhận, hoặc dự toán không được duyệt."""
    report = await db.get(Report, report_id)
    if not report or not report.asset_id:
        return {"ok": False}
    asset = await db.get(Asset, report.asset_id)
    active = (
        await db.execute(select(Recall.id).where(Recall.asset_id == report.asset_id, Recall.status != "khong_dong_y"))
    ).first()
    ins = (await db.execute(select(Inspection).where(Inspection.report_id == report.id).order_by(Inspection.code))).scalars().first()
    ests = list((await db.execute(select(Estimate).where(Estimate.report_id == report.id).order_by(Estimate.created_at, Estimate.code))).scalars())
    excs = {x.estimate_id: x for x in (await db.execute(select(ExceptionRequest).where(ExceptionRequest.estimate_id.in_([e.id for e in ests])))).scalars()} if ests else {}
    return _eligibility(report, asset, ins, ests, active, excs)


async def pending(db: AsyncSession) -> list:
    """Các hồ sơ đủ căn cứ nhưng Phòng QTNL chưa đề nghị thu hồi."""
    reports = list((await db.execute(select(Report).where(Report.asset_id.is_not(None)).order_by(Report.created_at))).scalars())
    assets = {a.id: a for a in (await db.execute(select(Asset).where(Asset.id.in_({r.asset_id for r in reports})))).scalars()} if reports else {}
    active = set((await db.execute(select(Recall.asset_id).where(Recall.status != "khong_dong_y"))).scalars())
    ins = {}
    for i in (await db.execute(select(Inspection).order_by(Inspection.code))).scalars():
        ins.setdefault(i.report_id, i)
    ests = {}
    for e in (await db.execute(select(Estimate).order_by(Estimate.created_at, Estimate.code))).scalars():
        ests.setdefault(e.report_id, []).append(e)
    excs = {x.estimate_id: x for x in (await db.execute(select(ExceptionRequest))).scalars()}
    out = []
    for r in reports:
        a = assets.get(r.asset_id)
        check = _eligibility(r, a, ins.get(r.id), ests.get(r.id, []), r.asset_id in active, excs)
        if check["ok"]:
            out.append({"report": S.report(r), "check": check, "asset": S.asset(a)})
    return out


async def list_recalls(db: AsyncSession) -> list:
    return [S.recall(r) for r in (await db.execute(select(Recall).order_by(Recall.proposed_at.desc()))).scalars()]


async def propose(db: AsyncSession, actor: Actor, data: dict) -> dict:
    check = await eligibility(db, data.get("reportId"))
    if not check["ok"]:
        raise bad("Tài sản không thuộc trường hợp thu hồi tài sản hỏng về kho")
    report = await db.get(Report, data["reportId"])
    asset = await db.get(Asset, report.asset_id)
    rec = Recall(
        code=await next_code(db, "TH-"),
        asset_id=asset.id,
        report_id=report.id,
        basis=check["basis"],
        basis_note=check["note"],
        plan=data.get("plan") if data.get("plan") in PLANS else "cho_thanh_ly",
        note=clean(data.get("note")),
        to_location=clean(data.get("toLocation")) or "KHO.TB",
        status="cho_khtc",
        proposed_by=actor.id,
        proposed_at=clock.now(),
    )
    db.add(rec)
    await notify_role(db, "khtc", f"Đề nghị thu hồi tài sản hỏng {rec.code}: {asset.name} ({asset.code}) về kho, chờ xác nhận.", "handovers")
    await db.flush()
    return S.recall(rec)


async def decide(db: AsyncSession, actor: Actor, recall_id: str, approve: bool, reason: str) -> None:
    rec = await db.get(Recall, recall_id) if recall_id else None
    if not rec or rec.status != "cho_khtc":
        raise bad("Đề nghị không ở bước chờ xác nhận")
    if not approve and not clean(reason):
        raise bad("Nhập lý do không đồng ý")
    rec.status = "da_xac_nhan" if approve else "khong_dong_y"
    rec.decided_by = actor.id
    rec.decided_at = clock.now()
    rec.reject_reason = None if approve else clean(reason)
    await notify(
        db,
        [rec.proposed_by],
        f"Phòng KHTC đã xác nhận đề nghị thu hồi tài sản hỏng {rec.code}. Lập biên bản giao nhận tài sản, ký rồi nộp Phòng KHTC."
        if approve
        else f"Phòng KHTC không đồng ý đề nghị thu hồi tài sản hỏng {rec.code}: {clean(reason)}",
        "handovers",
    )


def _people(side: str, rows: list) -> list:
    out = []
    for i, p in enumerate(rows or []):
        name = clean(p.get("name"))
        if name:
            out.append(HandoverPerson(side=side, sort=i, name=name, unit=clean(p.get("unit"))))
    return out


async def create_for_recall(db: AsyncSession, actor: Actor, recall_id: str, data: dict) -> dict:
    """Bước 3: kỹ thuật viên lập biên bản giao nhận, nộp Phòng KHTC (chưa đổi sổ)."""
    rec = await db.get(Recall, recall_id) if recall_id else None
    if not rec or rec.status != "da_xac_nhan":
        raise bad("Đề nghị thu hồi chưa được Phòng KHTC xác nhận")
    asset = await get_or_404(db, Asset, rec.asset_id, "Không tìm thấy tài sản")
    givers, receivers = _people("giver", data.get("givers")), _people("receiver", data.get("receivers"))
    if not givers or not receivers:
        raise bad("Nhập ít nhất một người đại diện mỗi bên.")
    f = await file_or_none(db, data.get("fileId"))
    h = Handover(
        code=await next_code(db, "BG-"),
        kind="thu_hoi",
        date=parse_date(data.get("date")) or clock.today(),
        created_by=actor.id,
        created_at=clock.now(),
        giver_unit=asset.unit,
        receiver_unit=settings.QTNL_UNIT,
        place=rec.to_location,
        scan_file_id=f.id if f else None,
        recall_id=rec.id,
        applied=False,
        transfer_no="",
    )
    h.people = givers + receivers
    h.items = [HandoverItem(sort=0, asset_id=asset.id, uom="Cái", qty=1, note=clean(data.get("note")))]
    db.add(h)
    await db.flush()
    rec.status = "da_giao_nhan"
    rec.handover_id = h.id
    await notify_role(
        db, "khtc", f"Biên bản giao nhận {h.code} (thu hồi tài sản hỏng {rec.code}) đã nộp, chờ nhập điều chuyển chính thức.", "handovers"
    )
    return S.handover(h)


async def complete(db: AsyncSession, actor: Actor, recall_id: str, data: dict) -> None:
    """Bước 4: Phòng KHTC nhập điều chuyển chính thức theo biên bản giao nhận; tài sản về kho, giữ màu đèn."""
    rec = await db.get(Recall, recall_id) if recall_id else None
    if not rec or rec.status != "da_giao_nhan":
        raise bad("Chưa có biên bản giao nhận")
    h = await get_or_404(db, Handover, rec.handover_id, "Không tìm thấy biên bản giao nhận")
    transfer_date = parse_date(data.get("transferDate")) or clock.today()
    transfer_no = clean(data.get("transferNo"))
    f = await file_or_none(db, data.get("fileId"))
    at = clock.now()
    ids = [it.asset_id for it in h.items]
    ctx = await light_context(db, ids)
    for it in h.items:
        a = await db.get(Asset, it.asset_id)
        if not a:
            continue
        a.recall_light = light_of(ctx, S.asset(a))["code"]  # màu đèn lúc thu hồi, tính trước khi đổi vị trí
        a.status = "thu_hoi_kho"
        a.location = h.place
        await ensure_unit(db, h.receiver_unit)
        a.unit = h.receiver_unit
        a.recalled_at = transfer_date
        a.last_interaction_date = transfer_date
    h.applied = True
    h.applied_at = at
    h.applied_by = actor.id
    h.transfer_no = transfer_no
    if f:
        h.scan_file_id = f.id
    rec.status = "hoan_thanh"
    rec.transfer_no = transfer_no or None
    rec.transfer_date = transfer_date
    rec.completed_by = actor.id
    rec.completed_at = at
    asset = await db.get(Asset, rec.asset_id)
    await notify(db, [rec.proposed_by], f"Tài sản hỏng {asset.name} ({asset.code}) đã thu hồi về {h.place}, chờ phương án xử lý.", "handovers")


async def attach_docs(db: AsyncSession, recall_id: str, data: dict) -> None:
    """Số văn bản, bản quét có thể đính kèm sau khi đã nhập điều chuyển."""
    rec = await db.get(Recall, recall_id) if recall_id else None
    if not rec or rec.status != "hoan_thanh":
        raise bad("Đề nghị chưa nhập điều chuyển")
    h = await db.get(Handover, rec.handover_id) if rec.handover_id else None
    no = clean(data.get("transferNo"))
    if no:
        rec.transfer_no = no
        if h:
            h.transfer_no = no
    f = await file_or_none(db, data.get("fileId"))
    if f and h:
        h.scan_file_id = f.id


# ---------------------------------------------------------------- Biên bản bàn giao (cấp phát, điều chuyển chính thức)
async def list_handovers(db: AsyncSession) -> list:
    return [S.handover(h) for h in (await db.execute(select(Handover).order_by(Handover.date.desc(), Handover.code.desc()))).scalars()]


async def create_handover(db: AsyncSession, actor: Actor, data: dict) -> dict:
    items = [it for it in (data.get("items") or []) if it.get("assetId")]
    if not items:
        raise bad("Chưa chọn tài sản nào")
    if data.get("kind") not in KINDS:
        raise bad("Chọn loại biên bản")
    receiver_unit = clean(data.get("receiverUnit"))
    if not receiver_unit:
        raise bad("Chọn đơn vị nhận.")
    place = clean(data.get("place"))
    if not place:
        raise bad("Nhập nơi bố trí tài sản.")
    givers, receivers = _people("giver", data.get("givers")), _people("receiver", data.get("receivers"))
    if not givers or not receivers:
        raise bad("Nhập ít nhất một người đại diện mỗi bên.")
    await ensure_unit(db, receiver_unit)
    f = await file_or_none(db, data.get("fileId"))
    date = parse_date(data.get("date")) or clock.today()
    at = clock.now()
    h = Handover(
        code=await next_code(db, "BG-"),
        kind=data["kind"],
        date=date,
        created_by=actor.id,
        created_at=at,
        giver_unit=clean(data.get("giverUnit")),
        receiver_unit=receiver_unit,
        place=place,
        scan_file_id=f.id if f else None,
        applied=True,
        applied_at=at,
        applied_by=actor.id,
        transfer_no=clean(data.get("transferNo")),
    )
    h.people = givers + receivers
    h.items = []
    for i, it in enumerate(items):
        a = await get_or_404(db, Asset, it["assetId"], "Không tìm thấy tài sản")
        try:
            qty = max(1, int(it.get("qty") or 1))
        except (TypeError, ValueError):
            qty = 1
        h.items.append(HandoverItem(sort=i, asset_id=a.id, uom=clean(it.get("uom")) or "Cái", qty=qty, note=clean(it.get("note"))))
        # Lưu biên bản là cập nhật đơn vị, vị trí và ngày tương tác của tài sản
        a.location = place
        a.unit = receiver_unit
        a.last_interaction_date = date
    db.add(h)
    await db.flush()
    return S.handover(h)
