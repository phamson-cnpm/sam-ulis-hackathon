"""Cột Đề xuất và luồng duyệt đề xuất xử lý tài sản (mục 5.6 đề tài, bản 30/10/2026).

Luồng: cán bộ đầu mối (tài sản đơn vị mình, gửi nhiều tài sản một lần) hoặc kỹ thuật viên (mọi tài sản) gửi đề xuất,
nhập mã xác nhận cá nhân → "Chờ lãnh đạo duyệt" → lãnh đạo Phòng QTNL (mã xác nhận, không tự duyệt đề xuất mình lập):
  - Duyệt → "Đã duyệt", chuyển Phòng KHTC → Phòng KHTC tiếp nhận ("Phòng KHTC đã tiếp nhận") tổng hợp trình Ban Giám
    hiệu; Ban Giám hiệu không đồng ý thì Phòng KHTC ghi "Không duyệt" kèm lý do.
  - Cần kỹ thuật xem xét (chọn kỹ thuật viên) → "Chờ kỹ thuật xem xét" → kỹ thuật viên ghi ý kiến (mã xác nhận) →
    trở lại "Chờ lãnh đạo duyệt".
  - Không duyệt (bắt buộc lý do) → lý do hiện ở cột Đề xuất và gửi kèm thông báo cho người đề xuất.
Đề xuất không làm đổi màu đèn. Mỗi tài sản chỉ có một đề xuất đang xử lý.
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import clock
from core.deps import Actor
from core.errors import bad, forbidden, not_found
from models import Asset, Proposal, ProposalHistory, Staff
from models.proposal import OPEN_STATUSES, PROPOSAL_KINDS
from services.code_service import next_code
from services.common import clean, notify, notify_role

KIND_LABEL = {"thanh_ly": "Thanh lý", "dieu_chuyen": "Điều chuyển", "thay_the": "Thay thế"}
STATUS_LABEL = {
    "cho_lanh_dao": "Chờ lãnh đạo duyệt",
    "cho_ky_thuat": "Chờ kỹ thuật xem xét",
    "da_duyet": "Đã duyệt",
    "khong_duyet": "Không duyệt",
    "khtc_tiep_nhan": "Phòng KHTC đã tiếp nhận",
}
TECH_OPINIONS = ("dong_y", "khong_dong_y", "de_xuat_khac")
TECH_LABEL = {"dong_y": "Đồng ý", "khong_dong_y": "Không đồng ý", "de_xuat_khac": "Đề xuất khác"}

# Gợi ý ở cột Đề xuất khi tài sản chưa có đề xuất (theo màu đèn, chỉ để tham khảo)
SUGGESTIONS = {
    "do_1_1": ("thanh_ly", "Thanh lý"),
    "do_1_2": ("thanh_ly", "Thanh lý"),
    "cam": (None, "Kiểm tra kỹ thuật, bảo hành"),
    "vang_3_1": ("dieu_chuyen", "Điều chuyển"),
    "vang_3_3": ("thay_the", "Thay thế khi lập kế hoạch mua sắm"),
}


def suggestion(light_code: Optional[str]) -> Optional[dict]:
    s = SUGGESTIONS.get(light_code or "")
    return {"kind": s[0], "text": s[1]} if s else None


def _days(p: Proposal) -> int:
    return max(0, (clock.today() - p.status_at.date()).days) if p.status_at else 0


def out(p: Proposal, full: bool = True) -> dict:
    d = {
        "id": p.id,
        "code": p.code,
        "assetId": p.asset_id,
        "kind": p.kind,
        "kindLabel": KIND_LABEL.get(p.kind, p.kind),
        "reason": p.reason,
        "status": p.status,
        "statusLabel": STATUS_LABEL.get(p.status, p.status),
        "statusAt": clock.stamp(p.status_at),
        "waitingDays": _days(p) if p.status in OPEN_STATUSES else None,
        "decisionNote": p.decision_note,
        "techOpinion": p.tech_opinion,
        "createdAt": clock.stamp(p.created_at),
        "createdBy": p.created_by,
        "createdRole": p.created_role,
    }
    if full:
        d.update(
            {
                "batchCode": p.batch_code,
                "unit": p.unit,
                "techId": p.tech_id,
                "techNote": p.tech_note,
                "techAt": clock.stamp(p.tech_at),
                "decidedBy": p.decided_by,
                "decidedAt": clock.stamp(p.decided_at),
                "receivedBy": p.received_by,
                "receivedAt": clock.stamp(p.received_at),
                "history": [
                    {"at": clock.stamp(h.at), "by": h.by, "action": h.action, "note": h.note or ""} for h in p.history
                ],
            }
        )
    return d


async def latest_by_asset(db: AsyncSession, asset_ids: Optional[list] = None) -> dict:
    """Đề xuất mới nhất của từng tài sản (đang xử lý, hoặc kết quả gần nhất) để hiện ở cột Đề xuất."""
    q = select(Proposal).order_by(Proposal.created_at, Proposal.code)
    if asset_ids is not None:
        if not asset_ids:
            return {}
        q = q.where(Proposal.asset_id.in_(asset_ids))
    latest = {}
    for p in (await db.execute(q)).scalars():
        latest[p.asset_id] = p
    return latest


async def attach(db: AsyncSession, views: list, asset_ids: Optional[list] = None) -> list:
    """Thêm cột Đề xuất (đề xuất gần nhất, gợi ý theo màu đèn) vào danh sách tài sản đã tính đèn."""
    latest = await latest_by_asset(db, asset_ids)
    for v in views:
        p = latest.get(v["id"])
        v["proposal"] = out(p, full=False) if p else None
        v["suggestion"] = suggestion(v["light"]["code"]) if v.get("status") != "da_thanh_ly" else None
    return views


def _log(p: Proposal, actor: Actor, action: str, note: str = "", at=None) -> None:
    p.history.append(ProposalHistory(at=at or clock.now(), by=actor.id, action=action, note=note or None))


def _move(p: Proposal, status: str, at) -> None:
    p.status = status
    p.status_at = at


# ---------------------------------------------------------------- Gửi đề xuất
async def create(db: AsyncSession, actor: Actor, data: dict, code: Optional[str]) -> dict:
    """data: {kind, reason, items: [{assetId, kind?, reason?}]} hoặc {kind, reason, assetIds: [...]}.
    Cán bộ đầu mối chỉ đề xuất tài sản của đơn vị mình; kỹ thuật viên đề xuất mọi tài sản."""
    from services.auth_service import verify_code

    if actor.role not in ("daumoi", "ktv"):
        raise forbidden("Chỉ cán bộ đầu mối, kỹ thuật viên gửi đề xuất")
    items = data.get("items") or [{"assetId": a} for a in (data.get("assetIds") or [])]
    if not items:
        raise bad("Chọn tài sản cần đề xuất")
    if len(items) > 200:
        raise bad("Mỗi lần gửi tối đa 200 tài sản")
    default_kind = data.get("kind") or "thanh_ly"
    default_reason = clean(data.get("reason"))
    # Kiểm tra toàn bộ danh sách trước khi hỏi mã, để người gửi sửa một lần
    checked, seen = [], set()
    for it in items:
        aid = it.get("assetId")
        if not aid or aid in seen:
            continue
        seen.add(aid)
        a = await db.get(Asset, aid)
        if a is None:
            raise bad("Không tìm thấy tài sản")
        if a.status == "da_thanh_ly":
            raise bad(f"Tài sản {a.code} đã thanh lý")
        if actor.role == "daumoi" and (actor.focal is None or a.unit != actor.focal.unit):
            raise forbidden(f"Tài sản {a.code} không thuộc đơn vị của bạn; chỉ đề xuất tài sản của đơn vị mình")
        kind = it.get("kind") or default_kind
        if kind not in PROPOSAL_KINDS:
            raise bad("Loại đề xuất không đúng")
        reason = clean(it.get("reason")) or default_reason
        if not reason:
            raise bad(f"Nhập lý do đề xuất cho tài sản {a.code}")
        open_p = (
            await db.execute(select(Proposal.code).where(Proposal.asset_id == a.id, Proposal.status.in_(OPEN_STATUSES)))
        ).scalars().first()
        if open_p:
            raise bad(f"Tài sản {a.code} đang có đề xuất {open_p} chưa xử lý xong")
        checked.append((a, kind, reason[:2000]))
    if not checked:
        raise bad("Chọn tài sản cần đề xuất")
    await verify_code(db, actor, code, roles=("daumoi", "ktv"))
    at = clock.now()
    batch = await next_code(db, "DSDX-") if len(checked) > 1 else None
    created = []
    for a, kind, reason in checked:
        p = Proposal(
            code=await next_code(db, "DX-"),
            batch_code=batch,
            asset_id=a.id,
            unit=a.unit,
            kind=kind,
            reason=reason,
            status="cho_lanh_dao",
            created_by=actor.id,
            created_role=actor.role,
            created_at=at,
            status_at=at,
        )
        _log(p, actor, "Gửi đề xuất", "", at)
        db.add(p)
        created.append(p)
    await db.flush()
    who = f"{actor.name} ({'cán bộ đầu mối ' + actor.focal.unit if actor.role == 'daumoi' else 'kỹ thuật viên'})"
    if len(created) == 1:
        p, a = created[0], checked[0][0]
        text = f"{who} đề xuất {KIND_LABEL[p.kind].lower()} {a.name} ({a.code}), {p.code}: chờ duyệt."
        link = f"approvals:proposal:{p.id}"
    else:
        kinds = {p.kind for p in created}
        k = KIND_LABEL[created[0].kind].lower() if len(kinds) == 1 else "xử lý"
        text = f"{who} gửi danh sách {len(created)} đề xuất {k} tài sản ({batch}): chờ duyệt."
        link = "approvals:proposals"
    await notify_role(db, "lanhdao_qtnl", text, link)
    return {"batchCode": batch, "proposals": [out(p) for p in created]}


# ---------------------------------------------------------------- Danh sách
async def _get(db: AsyncSession, pid: str) -> Proposal:
    p = await db.get(Proposal, pid)
    if p is None:
        raise not_found("Không tìm thấy đề xuất")
    return p


def _visible(actor: Actor, p: Proposal) -> bool:
    if actor.role in ("khtc", "ktv", "lanhdao_qtnl"):
        return True
    if actor.role == "daumoi" and actor.focal is not None and p.unit == actor.focal.unit:
        return True
    return p.created_by == actor.id


async def list_for(db: AsyncSession, actor: Actor, status: Optional[str] = None) -> list:
    """Phòng KHTC, Phòng QTNL: mọi đề xuất; cán bộ đầu mối: đề xuất về tài sản đơn vị mình."""
    from services.asset_service import light_context, light_of
    from services import serialize as S

    q = select(Proposal).order_by(Proposal.created_at.desc(), Proposal.code.desc())
    if status:
        q = q.where(Proposal.status.in_(status.split(",")))
    if actor.role == "daumoi":
        q = q.where((Proposal.unit == actor.focal.unit) | (Proposal.created_by == actor.id))
    elif actor.role not in ("khtc", "ktv", "lanhdao_qtnl"):
        q = q.where(Proposal.created_by == actor.id)
    rows = list((await db.execute(q)).scalars())
    ids = list({p.asset_id for p in rows})
    assets = {a.id: a for a in (await db.execute(select(Asset).where(Asset.id.in_(ids)))).scalars()} if ids else {}
    ctx = await light_context(db, None if len(ids) > 200 else ids)
    res = []
    for p in rows:
        a = assets.get(p.asset_id)
        asset = None
        if a:
            d = S.asset(a)
            asset = {
                "id": a.id, "code": a.code, "name": a.name, "unit": a.unit, "location": a.location or "",
                "originalCost": a.original_cost or 0, "status": a.status, "inUseDate": d["inUseDate"],
                "light": {"code": light_of(ctx, d)["code"]},
            }
        res.append({**out(p), "asset": asset})
    return res


async def get_one(db: AsyncSession, actor: Actor, pid: str) -> dict:
    p = await _get(db, pid)
    if not _visible(actor, p):
        raise forbidden("Không xem được đề xuất này")
    return next(x for x in await list_for(db, actor) if x["id"] == p.id)


# ---------------------------------------------------------------- Lãnh đạo Phòng QTNL quyết định
async def decide(db: AsyncSession, actor: Actor, pid: str, data: dict, code: Optional[str]) -> dict:
    """action: duyet | ky_thuat (techId) | khong_duyet (reason bắt buộc)."""
    from services.auth_service import verify_code

    p = await _get(db, pid)
    action = data.get("action")
    if action not in ("duyet", "ky_thuat", "khong_duyet"):
        raise bad("Chọn Duyệt, Cần kỹ thuật xem xét hoặc Không duyệt")
    if p.status != "cho_lanh_dao" and not (action == "ky_thuat" and p.status == "cho_ky_thuat"):
        raise bad("Đề xuất không ở trạng thái chờ lãnh đạo duyệt")
    if p.created_by == actor.id:
        raise bad("Không tự duyệt đề xuất do chính mình lập")
    note = clean(data.get("note") or data.get("reason"))
    tech = None
    if action == "khong_duyet" and not note:
        raise bad("Nhập lý do không duyệt")
    if action == "ky_thuat":
        tech = await db.get(Staff, data.get("techId")) if data.get("techId") else None
        if tech is None or tech.group != "ktv" or not tech.active:
            raise bad("Chọn kỹ thuật viên xem xét")
    await verify_code(db, actor, code, roles=("lanhdao_qtnl",))
    a = await db.get(Asset, p.asset_id)
    at = clock.now()
    name = f"{a.name} ({a.code})" if a else p.asset_id
    link = f"proposals:{p.id}"
    if action == "duyet":
        _move(p, "da_duyet", at)
        p.decided_by, p.decided_at, p.decision_note = actor.id, at, note or None
        _log(p, actor, "Duyệt, chuyển Phòng KHTC", note, at)
        await notify(db, [p.created_by], f"Đề xuất {p.code} ({KIND_LABEL[p.kind].lower()} {name}) đã được duyệt, chuyển Phòng KHTC.", link)
        await notify_role(db, "khtc", f"Đề xuất {p.code} ({KIND_LABEL[p.kind].lower()} {name}) đã duyệt, chờ Phòng KHTC tiếp nhận.", link)
    elif action == "ky_thuat":
        _move(p, "cho_ky_thuat", at)
        p.tech_id = tech.id
        p.tech_opinion = p.tech_note = p.tech_at = None
        _log(p, actor, f"Cần kỹ thuật xem xét, giao {tech.name}", note, at)
        loc = f" tại {a.location}" if a and a.location else ""
        await notify(db, [tech.id], f"Được giao xem xét đề xuất {p.code}: {KIND_LABEL[p.kind].lower()} {name}{loc}.", f"proposals:{p.id}")
    else:
        _move(p, "khong_duyet", at)
        p.decided_by, p.decided_at, p.decision_note = actor.id, at, note
        _log(p, actor, "Không duyệt", note, at)
        await notify(db, [p.created_by], f"Đề xuất {p.code} ({name}) không được duyệt. Lý do: {note}", link)
    await db.flush()
    return out(p)


# ---------------------------------------------------------------- Kỹ thuật viên ghi ý kiến
async def tech_opinion(db: AsyncSession, actor: Actor, pid: str, data: dict, code: Optional[str]) -> dict:
    from services.auth_service import verify_code

    p = await _get(db, pid)
    if p.status != "cho_ky_thuat":
        raise bad("Đề xuất không ở trạng thái chờ kỹ thuật xem xét")
    if p.tech_id != actor.id:
        raise forbidden("Đề xuất được giao cho kỹ thuật viên khác")
    opinion = data.get("opinion")
    if opinion not in TECH_OPINIONS:
        raise bad("Chọn ý kiến kỹ thuật: đồng ý, không đồng ý hoặc đề xuất khác")
    note = clean(data.get("note"))
    if opinion != "dong_y" and not note:
        raise bad("Nhập nhận xét kỹ thuật")
    await verify_code(db, actor, code, roles=("ktv",))
    at = clock.now()
    p.tech_opinion, p.tech_note, p.tech_at = opinion, note or None, at
    _move(p, "cho_lanh_dao", at)
    _log(p, actor, f"Ý kiến kỹ thuật: {TECH_LABEL[opinion]}", note, at)
    await notify_role(db, "lanhdao_qtnl", f"Đã có ý kiến kỹ thuật cho đề xuất {p.code} ({TECH_LABEL[opinion].lower()}): chờ quyết định.", f"approvals:proposal:{p.id}")
    await db.flush()
    return out(p)


# ---------------------------------------------------------------- Phòng KHTC tiếp nhận
async def khtc_action(db: AsyncSession, actor: Actor, data: dict) -> list:
    """action: tiep_nhan (ids, đề xuất Đã duyệt) | khong_duyet (Ban Giám hiệu không đồng ý, bắt buộc lý do)."""
    action = data.get("action")
    ids = data.get("ids") or ([data["id"]] if data.get("id") else [])
    if not ids:
        raise bad("Chọn đề xuất")
    note = clean(data.get("note") or data.get("reason"))
    if action == "khong_duyet" and not note:
        raise bad("Nhập lý do không duyệt")
    if action not in ("tiep_nhan", "khong_duyet"):
        raise bad("Thao tác không đúng")
    at = clock.now()
    done = []
    for pid in ids:
        p = await _get(db, pid)
        link = f"proposals:{p.id}"
        if action == "tiep_nhan":
            if p.status != "da_duyet":
                raise bad(f"Đề xuất {p.code} chưa được lãnh đạo Phòng QTNL duyệt")
            _move(p, "khtc_tiep_nhan", at)
            p.received_by, p.received_at = actor.id, at
            _log(p, actor, "Phòng KHTC tiếp nhận", note, at)
            await notify(db, [p.created_by], f"Phòng KHTC đã tiếp nhận đề xuất {p.code}, tổng hợp trình Ban Giám hiệu.", link)
        else:
            if p.status not in ("da_duyet", "khtc_tiep_nhan"):
                raise bad(f"Đề xuất {p.code} không ở trạng thái Phòng KHTC xử lý")
            _move(p, "khong_duyet", at)
            p.decided_by, p.decided_at, p.decision_note = actor.id, at, note
            _log(p, actor, "Không duyệt (Ban Giám hiệu)", note, at)
            await notify(db, [p.created_by], f"Đề xuất {p.code} không được duyệt. Lý do: {note}", link)
        done.append(out(p))
    await db.flush()
    return done
