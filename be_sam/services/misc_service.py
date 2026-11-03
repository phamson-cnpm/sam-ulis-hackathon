
"""Biểu mẫu in (gom dữ liệu hồ sơ), thông báo, nhật ký xuất file, số việc đang chờ, danh bạ cho giao diện."""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core import clock
from core.deps import Actor
from core.errors import bad
from models import (
    AppSetting,
    Asset,
    Estimate,
    ExceptionRequest,
    ExportLog,
    FocalLog,
    Handover,
    Inspection,
    Notification,
    Proposal,
    Recall,
    Report,
    UnitFocal,
)
from services import serialize as S
from services.asset_service import FULL_ROLES, get_thresholds, history, light_context, view, view_without_cost
from services.case_service import get_case, own_report_or_403
from services.common import get_or_404
from services.people_service import focal_log, people

EXPORT_ACTIONS = ("xuat_excel", "tai_pdf", "in", "tai_word")


# ---------------------------------------------------------------- Biểu mẫu in
async def case_dossier(db: AsyncSession, actor: Actor, report_id: str) -> dict:
    """Đủ dữ liệu để điền sẵn các biểu mẫu của một hồ sơ. Cán bộ, đầu mối chỉ xem phiếu của mình,
    không thấy biên bản, chi phí (mục 5.1 đề tài)."""
    report = await own_report_or_403(db, actor, report_id)
    users = await people(db, actor.role)
    if actor.role not in FULL_ROLES:
        asset = None
        if report.asset_id:
            a = await db.get(Asset, report.asset_id)
            ctx = await light_context(db, [a.id])
            asset = view_without_cost(ctx, a)
        return {
            "report": S.report(report), "asset": asset, "inspection": None, "estimate": None, "exception": None,
            "temps": [], "batch": [], "recall": None, "handover": None, "noSpares": [], "assetEstimates": [],
            "replacementAssets": [], "handoverAssets": [], "thresholds": await get_thresholds(db), "users": users,
        }
    c = await get_case(db, report_id)
    asset_ests = []
    if c["asset"]:
        asset_ests = [
            S.estimate(e)
            for e in (await db.execute(select(Estimate).where(Estimate.asset_id == c["asset"]["id"]).order_by(Estimate.created_at, Estimate.code))).scalars()
        ]
    repl_ids = [t["replacementAssetId"] for t in c["temps"] if t["replacementAssetId"]]
    ho_ids = [it["assetId"] for it in (c["handover"]["items"] if c["handover"] else [])]
    by_id = {a.id: a for a in (await db.execute(select(Asset).where(Asset.id.in_(repl_ids + ho_ids)))).scalars()} if repl_ids or ho_ids else {}
    return {
        **c,
        "assetEstimates": asset_ests,
        "replacementAssets": [S.asset(by_id[i]) for i in repl_ids if i in by_id],
        "handoverAssets": [S.asset(by_id[i]) for i in ho_ids if i in by_id],
        "thresholds": await get_thresholds(db),
        "users": users,
    }


async def handover_dossier(db: AsyncSession, actor: Actor, handover_id: str) -> dict:
    h = await get_or_404(db, Handover, handover_id, "Không tìm thấy biên bản")
    rec = (await db.execute(select(Recall).where(Recall.handover_id == h.id))).scalars().first()
    ids = [it.asset_id for it in h.items]
    by_id = {a.id: a for a in (await db.execute(select(Asset).where(Asset.id.in_(ids)))).scalars()} if ids else {}
    return {
        "handover": S.handover(h),
        "recall": S.recall(rec) if rec else None,
        "handoverAssets": [S.asset(by_id[i]) for i in ids if i in by_id],
        "users": await people(db, actor.role),
    }


async def asset_dossier(db: AsyncSession, actor: Actor, asset_id: str) -> dict:
    a = await get_or_404(db, Asset, asset_id, "Không tìm thấy tài sản")
    ctx = await light_context(db, [a.id])
    return {"asset": view(ctx, a), "history": await history(db, asset_id), "users": await people(db, actor.role)}


# ---------------------------------------------------------------- Thông báo
async def notifications(db: AsyncSession, actor: Actor) -> list:
    rows = (await db.execute(select(Notification).where(Notification.user_id == actor.id).order_by(Notification.at.desc()).limit(200))).scalars()
    return [S.notification(n) for n in rows]


async def mark_all_read(db: AsyncSession, actor: Actor) -> None:
    for n in (await db.execute(select(Notification).where(Notification.user_id == actor.id, Notification.read.is_(False)))).scalars():
        n.read = True


# ---------------------------------------------------------------- Nhật ký xuất file
async def log_export(db: AsyncSession, actor: Actor, action: str, detail: str) -> None:
    """Mọi lần In, Tải Word, Tải Excel, Tải PDF đều ghi lại theo tài khoản cá nhân của người thao tác; cán bộ đầu mối
    ghi thêm theo mã đầu mối của đơn vị (Phòng KHTC tra theo đơn vị)."""
    if action not in EXPORT_ACTIONS and not (actor.role == "daumoi" and action == "xem"):
        raise bad("Thao tác không đúng")
    detail = (detail or "")[:2000]
    if actor.role == "daumoi":
        await focal_log(db, actor.focal, action, detail)
        return
    u = actor.user or {}
    db.add(
        ExportLog(at=clock.now(), user_id=actor.id, name=u.get("name", ""), role=actor.role, unit=u.get("unit", ""), action=action, detail=detail)
    )


async def export_logs(db: AsyncSession) -> list:
    """Gộp nhật ký xuất file của tài khoản cá nhân và của các mã đầu mối, mới nhất trước."""
    from core.security import decrypt_code

    rows = [S.export_log(l) for l in (await db.execute(select(ExportLog))).scalars()]
    codes = {f.id: decrypt_code(f.code_enc) for f in (await db.execute(select(UnitFocal))).scalars()}
    staff_of = {f.id: f.staff_id for f in (await db.execute(select(UnitFocal))).scalars()}
    for l in (await db.execute(select(FocalLog).where(FocalLog.action.in_(EXPORT_ACTIONS)))).scalars():
        rows.append({**S.focal_log(l, codes.get(l.focal_id)), "role": "daumoi", "userId": staff_of.get(l.focal_id) or l.focal_id})
    return sorted(rows, key=lambda r: r["at"], reverse=True)


# ---------------------------------------------------------------- Số việc đang chờ trên menu
async def counts(db: AsyncSession, actor: Actor) -> dict:
    from services.recall_service import pending

    async def n(q):
        return (await db.execute(q)).scalar_one()

    def proposals(*where):
        return n(select(func.count()).select_from(Proposal).where(*where))

    out = {}
    if actor.role == "ktv":
        out["queue"] = await n(select(func.count()).select_from(Report).where(Report.status == "da_gui"))
        out["handovers"] = await n(select(func.count()).select_from(Recall).where(Recall.status == "da_xac_nhan")) + len(await pending(db))
        out["proposals"] = await proposals(Proposal.status == "cho_ky_thuat", Proposal.tech_id == actor.id)
    elif actor.role == "lanhdao_qtnl":
        out["approvals"] = (
            await n(select(func.count()).select_from(Estimate).where(Estimate.status == "cho_lanh_dao"))
            + await n(select(func.count()).select_from(Inspection).where(Inspection.total_loss_status == "cho_xac_minh"))
            + await proposals(Proposal.status == "cho_lanh_dao")
        )
    elif actor.role == "khtc":
        out["exceptions"] = await n(select(func.count()).select_from(ExceptionRequest).where(ExceptionRequest.status == "cho_mo_khoa"))
        out["handovers"] = await n(select(func.count()).select_from(Recall).where(Recall.status.in_(("cho_khtc", "da_giao_nhan"))))
        out["proposals"] = await proposals(Proposal.status == "da_duyet")
    return out


# ---------------------------------------------------------------- Danh bạ, tài sản, danh mục cho giao diện
def _lite(v: dict) -> dict:
    keep = ("id", "code", "name", "groupCode", "groupName", "location", "unit", "status", "inUseDate")
    return {**{k: v.get(k) for k in keep}, "light": {"code": v["light"]["code"], "labels": v["light"]["labels"]}}


async def refs(db: AsyncSession, actor: Actor) -> dict:
    from services.catalog_service import fault_lists, situations

    if actor.role in FULL_ROLES:
        rows = list((await db.execute(select(Asset).order_by(Asset.code))).scalars())
    else:
        ids = select(Report.asset_id).where((Report.reporter_id == actor.id) | (Report.account_id == actor.id))
        q = select(Asset).where(Asset.id.in_(ids))
        if actor.role == "daumoi":
            q = select(Asset).where((Asset.id.in_(ids)) | (Asset.unit == actor.focal.unit))
        rows = list((await db.execute(q)).scalars())
    ctx = await light_context(db, None if len(rows) > 200 else [a.id for a in rows])
    return {
        "people": await people(db, actor.role),
        "assets": [_lite(view(ctx, a)) for a in rows],
        "faultLists": await fault_lists(db),
        "situations": await situations(db),
    }


async def meta(db: AsyncSession) -> dict:
    book = await db.get(AppSetting, "asset_book_date")
    today = clock.today()
    return {"today": today.isoformat(), "fiscalYear": today.year, "assetBookDate": book.value if book else None, "qtnlUnit": settings.QTNL_UNIT}
