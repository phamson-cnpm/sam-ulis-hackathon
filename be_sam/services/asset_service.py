
"""Tài sản: đèn, danh sách, tìm, lịch sử, đèn tạm tính khi soạn dự toán."""
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core import clock
from core.deps import Actor
from core.errors import bad
from models import (
    Asset,
    AssetGroup,
    DisposalDecision,
    Estimate,
    ExceptionRequest,
    Handover,
    HandoverItem,
    Inspection,
    Recall,
    Report,
    TempTransfer,
    Threshold,
)
from services import serialize as S
from services.common import clean, get_or_404, notify_role
from services.light_service import RED, compute_light

FULL_ROLES = ("khtc", "ktv", "lanhdao_qtnl")


@dataclass
class LightContext:
    th: dict
    as_of: str
    estimates: dict = field(default_factory=dict)  # asset_id -> [estimate dict]
    pending: set = field(default_factory=set)  # tài sản có biên bản hư hỏng toàn phần chờ xác minh
    groups: dict = field(default_factory=dict)  # mã nhóm -> tên nhóm


async def get_thresholds(db: AsyncSession) -> dict:
    t = await db.get(Threshold, 1)
    return S.thresholds(t)


async def light_context(db: AsyncSession, asset_ids: Optional[list] = None) -> LightContext:
    ctx = LightContext(th=await get_thresholds(db), as_of=clock.today().isoformat())
    q = select(Estimate)
    qi = select(Inspection.asset_id).where(Inspection.total_loss_status == "cho_xac_minh")
    if asset_ids is not None:
        q = q.where(Estimate.asset_id.in_(asset_ids))
        qi = qi.where(Inspection.asset_id.in_(asset_ids))
    for e in (await db.execute(q)).scalars():
        ctx.estimates.setdefault(e.asset_id, []).append(S.estimate(e))
    ctx.pending = set((await db.execute(qi)).scalars())
    ctx.groups = {g.code: g.name for g in (await db.execute(select(AssetGroup))).scalars()}
    return ctx


def light_of(ctx: LightContext, a: dict, th: Optional[dict] = None, **opts) -> dict:
    return compute_light(
        a,
        ctx.estimates.get(a["id"], []),
        th or ctx.th,
        ctx.as_of,
        exclude_estimate_id=opts.get("exclude_estimate_id"),
        draft_lines=opts.get("draft_lines"),
        pending_total_loss=a["id"] in ctx.pending,
    )


def view(ctx: LightContext, a: Asset) -> dict:
    d = S.asset(a)
    return {**d, "light": light_of(ctx, d), "groupName": ctx.groups.get(a.group_code, a.group_code)}


# Số liệu sổ sách chỉ Phòng KHTC, Phòng QTNL nhận (máy chủ bỏ hẳn khỏi dữ liệu trả về, không chỉ ẩn trên giao diện)
BOOK_FIELDS = ("accumulatedDepreciation", "residualValue", "depreciationMonths", "fundingSource")
# Cán bộ đầu mối xem tài sản toàn trường chỉ với các cột này (mục 5.8 đề tài) cùng màu đèn và cột Đề xuất
FOCAL_FIELDS = ("id", "code", "name", "unit", "location", "originalCost")


def view_without_cost(ctx: LightContext, a: Asset, keep_cost: bool = False) -> dict:
    """Tài khoản đầu mối, cán bộ: bỏ số liệu chi phí sửa chữa, giá trị còn lại khỏi dữ liệu trả về.
    keep_cost: cán bộ đầu mối được xem nguyên giá."""
    v = view(ctx, a)
    keep = ("code", "labels", "locked", "fullyDepreciated", "warehouseMonths", "pendingTotalLoss")
    v["light"] = {k: v["light"][k] for k in keep}
    for k in BOOK_FIELDS:
        v.pop(k, None)
    if not keep_cost:
        v.pop("originalCost", None)
    return v


def view_focal(ctx: LightContext, a: Asset) -> dict:
    """Danh sách tài sản toàn trường của cán bộ đầu mối: màu đèn, mã, tên, phòng ban, vị trí, nguyên giá (và Đề xuất)."""
    d = S.asset(a)
    return {**{k: d[k] for k in FOCAL_FIELDS}, "light": {"code": light_of(ctx, d)["code"]}}


def view_for(role: str, ctx: LightContext, a: Asset) -> dict:
    return view(ctx, a) if role in FULL_ROLES else view_without_cost(ctx, a, keep_cost=role == "daumoi")


async def views(db: AsyncSession, assets: list, role: str = "khtc") -> list:
    ctx = await light_context(db, None if len(assets) > 200 else [a.id for a in assets])
    return [view_for(role, ctx, a) for a in assets]


async def open_reports(db: AsyncSession, asset_ids: list) -> dict:
    """Phiếu chưa xử lý xong của từng tài sản (để cảnh báo báo trùng)."""
    if not asset_ids:
        return {}
    rows = (
        await db.execute(
            select(Report).where(Report.asset_id.in_(asset_ids), Report.status != "hoan_thanh").order_by(Report.created_at)
        )
    ).scalars()
    out = {}
    for r in rows:
        out.setdefault(r.asset_id, S.report(r))
    return out


async def list_all(db: AsyncSession) -> list:
    """Danh sách tài sản gắn đèn, kèm cột Đề xuất (đề xuất gần nhất hoặc gợi ý theo màu đèn)."""
    from services.proposal_service import attach

    assets = list((await db.execute(select(Asset).order_by(Asset.code))).scalars())
    return await attach(db, await views(db, assets))


async def list_focal(db: AsyncSession) -> list:
    """Cán bộ đầu mối: tài sản toàn trường (trừ đã thanh lý), chỉ các cột được xem; giao diện lọc theo đơn vị."""
    from services.proposal_service import attach

    assets = list((await db.execute(select(Asset).where(Asset.status != "da_thanh_ly").order_by(Asset.code))).scalars())
    ctx = await light_context(db, None if len(assets) > 200 else [a.id for a in assets])
    return await attach(db, [view_focal(ctx, a) for a in assets], None if len(assets) > 200 else [a.id for a in assets])


async def search(db: AsyncSession, q: str, limit: int, role: str) -> list:
    s = (q or "").strip()
    if not s:
        return []
    like = f"%{s}%"
    rows = list(
        (
            await db.execute(
                select(Asset)
                .where(
                    Asset.status == "dang_su_dung",
                    or_(Asset.code.like(like), Asset.name.like(like), Asset.location.like(like)),
                )
                .order_by(case((Asset.code.like(f"{s}%"), 0), else_=1), Asset.code)
                .limit(max(1, min(limit, 50)))
            )
        ).scalars()
    )
    out = await views(db, rows, role)
    opens = await open_reports(db, [a.id for a in rows])
    for v in out:
        v["openReport"] = opens.get(v["id"])
    return out


async def get_view(db: AsyncSession, asset_id: str, role: str) -> dict:
    a = await get_or_404(db, Asset, asset_id, "Không tìm thấy tài sản")
    v = (await views(db, [a], role))[0]
    v["openReport"] = (await open_reports(db, [a.id])).get(a.id)
    return v


async def history(db: AsyncSession, asset_id: str) -> dict:
    await get_or_404(db, Asset, asset_id, "Không tìm thấy tài sản")
    reports = (await db.execute(select(Report).where(Report.asset_id == asset_id).order_by(Report.created_at.desc()))).scalars()
    inspections = (await db.execute(select(Inspection).where(Inspection.asset_id == asset_id))).scalars()
    estimates = (
        await db.execute(select(Estimate).where(Estimate.asset_id == asset_id).order_by(Estimate.created_at.desc(), Estimate.code.desc()))
    ).scalars()
    temps = (
        await db.execute(
            select(TempTransfer).where(
                or_(TempTransfer.original_asset_id == asset_id, TempTransfer.replacement_asset_id == asset_id)
            )
        )
    ).scalars()
    exceptions = (await db.execute(select(ExceptionRequest).where(ExceptionRequest.asset_id == asset_id))).scalars()
    decisions = (
        await db.execute(select(DisposalDecision).where(DisposalDecision.asset_id == asset_id).order_by(DisposalDecision.at.desc()))
    ).scalars()
    recalls = (await db.execute(select(Recall).where(Recall.asset_id == asset_id))).scalars()
    handovers = (
        await db.execute(
            select(Handover)
            .where(Handover.id.in_(select(HandoverItem.handover_id).where(HandoverItem.asset_id == asset_id)))
            .order_by(Handover.date.desc())
        )
    ).scalars()
    return {
        "reports": [S.report(r) for r in reports],
        "inspections": [S.inspection(i) for i in inspections],
        "estimates": [S.estimate(e) for e in estimates],
        "tempTransfers": [S.temp_transfer(t) for t in temps],
        "exceptions": [S.exception(x) for x in exceptions],
        "recalls": [S.recall(r) for r in recalls],
        "handovers": [S.handover(h) for h in handovers],
        "disposalDecisions": [S.disposal_decision(d) for d in decisions],
    }


async def preview_light(db: AsyncSession, asset_id: str, draft_lines: list, exclude_estimate_id: Optional[str]) -> dict:
    a = await get_or_404(db, Asset, asset_id, "Không tìm thấy tài sản")
    ctx = await light_context(db, [a.id])
    d = S.asset(a)
    return {
        "before": light_of(ctx, d, exclude_estimate_id=exclude_estimate_id),
        "after": light_of(ctx, d, draft_lines=draft_lines, exclude_estimate_id=exclude_estimate_id),
    }


# ---------------------------------------------------------------- Danh sách chờ thanh lý (mục 5.3 đề tài)
DISPOSAL_DECISIONS = ("thanh_ly", "loai_khoi_danh_sach")


async def decide_disposal(db: AsyncSession, actor: Actor, asset_id: str, data: dict) -> dict:
    """Tài sản chờ thanh lý (Đỏ 1.1, Đỏ 1.2) giữ đèn đỏ sang năm mới cho đến khi Phòng KHTC quyết định:
    thanh lý (trạng thái "Đã thanh lý", thôi tính đèn, vẫn lưu lịch sử) hoặc loại khỏi danh sách (đèn tính lại bình thường)."""
    a = await get_or_404(db, Asset, asset_id, "Không tìm thấy tài sản")
    decision = data.get("decision")
    if decision not in DISPOSAL_DECISIONS:
        raise bad("Chọn quyết định")
    basis = clean(data.get("basis"))
    if not basis:
        raise bad("Nhập căn cứ (số, ngày văn bản)")
    if a.status == "da_thanh_ly":
        raise bad("Tài sản đã thanh lý")
    ctx = await light_context(db, [a.id])
    before = light_of(ctx, S.asset(a))
    if before["code"] not in RED:
        raise bad("Tài sản không ở danh sách chờ thanh lý")
    today = clock.today()
    if decision == "thanh_ly":
        a.status = "da_thanh_ly"
        a.disposed_at = today
    else:
        after = light_of(ctx, {**S.asset(a), "disposalClearedAt": today.isoformat()})
        if after["code"] in RED:
            raise bad(
                f"Tài sản vẫn đèn đỏ theo chi phí sửa chữa năm {today.year}, chưa loại khỏi danh sách được; "
                "cần sửa tiếp thì theo quy trình đề nghị ngoại lệ"
            )
        a.disposal_cleared_at = today
    d = DisposalDecision(
        asset_id=a.id,
        decision=decision,
        basis=basis,
        note=clean(data.get("note")) or None,
        light_before=before["code"],
        by=actor.id,
        at=clock.now(),
    )
    db.add(d)
    text = "đã thanh lý" if decision == "thanh_ly" else "được loại khỏi danh sách chờ thanh lý"
    await notify_role(db, "ktv", f"{a.name} ({a.code}) {text} theo {basis}.")
    await db.flush()
    return {"asset": (await views(db, [a]))[0], "decision": S.disposal_decision(d)}
