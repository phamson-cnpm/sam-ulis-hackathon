
"""Danh mục do Phòng QTNL soạn: nội dung báo hỏng theo nhóm tài sản, tình huống đang xảy ra (khẩn cấp đứng đầu),
nội dung công việc sửa chữa (nhóm tính vào đèn hoặc bảo dưỡng, vật tư). Đơn vị, nhóm tài sản do Phòng KHTC nhập."""
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.errors import bad
from models import AssetGroup, FaultItem, RepairJob, RepairJobGroup, Situation, Unit
from services import serialize as S
from services.code_service import next_code
from services.common import clean, get_or_404
from services.text import vi_key


async def units(db: AsyncSession) -> list:
    names = [u.name for u in (await db.execute(select(Unit))).scalars()]
    return sorted(names, key=vi_key)


async def ensure_unit(db: AsyncSession, name: str) -> Unit:
    name = clean(name)
    if not name:
        raise bad("Chưa có tên đơn vị")
    u = (await db.execute(select(Unit).where(Unit.name == name))).scalar_one_or_none()
    if u is None:
        u = Unit(name=name)
        db.add(u)
        await db.flush()
    return u


async def asset_groups(db: AsyncSession) -> list:
    return [{"code": g.code, "name": g.name} for g in (await db.execute(select(AssetGroup).order_by(AssetGroup.code))).scalars()]


# ---------------------------------------------------------------- Nội dung báo hỏng
async def fault_lists(db: AsyncSession) -> list:
    groups = {g["code"]: g["name"] for g in await asset_groups(db)}
    rows = (await db.execute(select(FaultItem).order_by(FaultItem.group_code, FaultItem.sort, FaultItem.id))).scalars()
    lists: dict = {"": []}
    for f in rows:
        lists.setdefault(f.group_code, []).append(f.text)
    return [
        {"groupCode": code, "name": groups.get(code, code) if code else "Danh sách chung", "items": items}
        for code, items in sorted(lists.items(), key=lambda kv: (kv[0] != "", kv[0]))
    ]


async def add_fault(db: AsyncSession, group_code: str, text: str) -> None:
    t = clean(text)
    if not t:
        raise bad("Chưa nhập nội dung")
    group_code = group_code or ""
    if group_code:
        await get_or_404(db, AssetGroup, group_code, "Không tìm thấy nhóm tài sản")
    exists = (
        await db.execute(select(FaultItem).where(FaultItem.group_code == group_code, FaultItem.text == t))
    ).scalar_one_or_none()
    if exists:
        raise bad("Nội dung này đã có trong danh sách")
    sort = (await db.execute(select(func.max(FaultItem.sort)).where(FaultItem.group_code == group_code))).scalar() or 0
    db.add(FaultItem(group_code=group_code, text=t, sort=sort + 1))


async def remove_fault(db: AsyncSession, group_code: str, text: str) -> None:
    f = (
        await db.execute(select(FaultItem).where(FaultItem.group_code == (group_code or ""), FaultItem.text == text))
    ).scalar_one_or_none()
    if f:
        await db.delete(f)


# ---------------------------------------------------------------- Tình huống đang xảy ra
async def situations(db: AsyncSession) -> list:
    rows = (await db.execute(select(Situation).order_by(Situation.urgent.desc(), Situation.sort, Situation.id))).scalars()
    return [{"text": s.text, "urgent": bool(s.urgent)} for s in rows]


async def add_situation(db: AsyncSession, text: str, urgent: bool) -> None:
    t = clean(text)
    if not t:
        raise bad("Chưa nhập tình huống")
    if (await db.execute(select(Situation).where(Situation.text == t))).scalar_one_or_none():
        raise bad("Tình huống này đã có trong danh sách")
    sort = (await db.execute(select(func.max(Situation.sort)))).scalar() or 0
    db.add(Situation(text=t, urgent=bool(urgent), sort=sort + 1))


async def set_situation_urgent(db: AsyncSession, text: str, urgent: bool) -> None:
    s = (await db.execute(select(Situation).where(Situation.text == text))).scalar_one_or_none()
    if s:
        s.urgent = bool(urgent)


async def remove_situation(db: AsyncSession, text: str) -> None:
    s = (await db.execute(select(Situation).where(Situation.text == text))).scalar_one_or_none()
    if s:
        await db.delete(s)


# ---------------------------------------------------------------- Công việc sửa chữa
async def repair_jobs(db: AsyncSession, active_only: bool) -> list:
    q = select(RepairJob).order_by(RepairJob.code)
    if active_only:
        q = q.where(RepairJob.active.is_(True))
    return [S.repair_job(j) for j in (await db.execute(q)).scalars()]


async def add_repair_job(db: AsyncSession, name: str, group_code: str, cost_group: str) -> dict:
    n = clean(name)
    if not n:
        raise bad("Chưa nhập nội dung công việc")
    if group_code:
        await get_or_404(db, AssetGroup, group_code, "Không tìm thấy nhóm tài sản")
    job = RepairJob(
        code=await next_code(db, "SC-", 3),
        name=n,
        cost_group="khong_tinh" if cost_group == "khong_tinh" else "tinh",
        active=True,
    )
    if group_code:
        job.groups = [RepairJobGroup(group_code=group_code)]
    db.add(job)
    await db.flush()
    return S.repair_job(job)


async def set_repair_job_active(db: AsyncSession, job_id: str, active: bool) -> None:
    j = await get_or_404(db, RepairJob, job_id, "Không tìm thấy công việc")
    j.active = bool(active)
