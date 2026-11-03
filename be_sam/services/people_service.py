
"""Dữ liệu cán bộ (Phòng KHTC nhập); tài khoản cá nhân của từng cán bộ (cấp, đặt lại mật khẩu, khóa, đăng xuất mọi
thiết bị); vai trò và mã xác nhận cá nhân của kỹ thuật viên, lãnh đạo Phòng QTNL, cán bộ đầu mối (cấp, đổi, thu hồi);
nhật ký theo mã đầu mối."""
from typing import Optional

import sqlalchemy as sa
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core import clock
from core.deps import Actor
from core.errors import bad, not_found
from core.security import code_hash, decrypt_code, encrypt_code, hash_password, random_code, random_password
from models import Account, AuthSession, FocalLog, Notification, Staff, Unit, UnitFocal
from models.staff import QTNL_GROUPS
from services import serialize as S
from services.catalog_service import ensure_unit
from services.common import clean, get_or_404
from services.text import unit_abbr, vi_key


# ---------------------------------------------------------------- Mã xác nhận

async def _live(db: AsyncSession, staff_id: str) -> Staff:
    """Cán bộ còn trong danh sách (chưa bị xóa)."""
    s = await get_or_404(db, Staff, staff_id, "Không tìm thấy cán bộ")
    if s.deleted_at is not None:
        raise not_found("Cán bộ này đã bị xóa khỏi danh sách")
    return s

async def _unique_code(db: AsyncSession, prefix: str) -> str:
    for _ in range(50):
        c = random_code(prefix)
        h = code_hash(c)
        used = (await db.execute(select(Staff.id).where(Staff.code_hash == h))).first() or (
            await db.execute(select(UnitFocal.id).where(UnitFocal.code_hash == h))
        ).first()
        if not used:
            return c
    raise bad("Không cấp được mã mới, thử lại")


def _set_code(s: Staff, code: Optional[str]) -> None:
    s.code_hash = code_hash(code) if code else None
    s.code_enc = encrypt_code(code) if code else None


# ---------------------------------------------------------------- Dữ liệu cán bộ
async def active_focal_codes(db: AsyncSession) -> dict:
    rows = (await db.execute(select(UnitFocal).where(UnitFocal.status == "dang_dung"))).scalars()
    return {f.staff_id: decrypt_code(f.code_enc) for f in rows if f.staff_id}


# Vai trò Phòng KHTC đặt trực tiếp trên dữ liệu cán bộ; cán bộ đầu mối đặt ở mục Mã cán bộ đầu mối (mỗi đơn vị một người)
SETTABLE_GROUPS = ("canbo", "ktv", "lanhdao_qtnl", "khtc")


async def staff_list(db: AsyncSession) -> list:
    focal_rows = {f.staff_id: f for f in (await db.execute(select(UnitFocal).where(UnitFocal.status == "dang_dung"))).scalars() if f.staff_id}
    out = []
    for s in (await db.execute(select(Staff).where(Staff.deleted_at.is_(None)))).scalars():
        d = S.staff(s, with_code=True)
        f = focal_rows.get(s.id)
        d["personalCode"] = d["code"] if s.group in QTNL_GROUPS else (decrypt_code(f.code_enc) if f else None)
        d["focalUnit"] = f.unit if f else None
        out.append(d)
    return sorted(out, key=lambda p: (vi_key(p["unit"]), vi_key(p["name"])))


async def staff_one(db: AsyncSession, staff_id: str) -> dict:
    return next(x for x in await staff_list(db) if x["id"] == staff_id)


def _check_group(group: str) -> None:
    if group == "daumoi":
        raise bad("Cán bộ đầu mối được thiết lập ở mục Mã cán bộ đầu mối (mỗi đơn vị một người)")
    if group not in SETTABLE_GROUPS:
        raise bad("Vai trò không đúng")


async def staff_create(db: AsyncSession, data: dict, actor: Actor) -> dict:
    name = clean(data.get("name"))
    unit = clean(data.get("unit"))
    if not name or not unit:
        raise bad("Nhập họ tên và đơn vị")
    group = data.get("group") or "canbo"
    _check_group(group)
    staff_code = clean(data.get("staffCode")) or None
    if staff_code and (await db.execute(select(Staff.id).where(Staff.staff_code == staff_code, Staff.deleted_at.is_(None)))).first():
        raise bad(f"Mã số cán bộ {staff_code} đã có trong dữ liệu cán bộ")
    await ensure_unit(db, unit)
    s = Staff(
        staff_code=staff_code,
        name=name,
        unit=unit,
        position=clean(data.get("position")),
        phone=clean(data.get("phone")),
        email=clean(data.get("email")),
        group=group,
        created_by=actor.id,
    )
    if group in QTNL_GROUPS:
        _set_code(s, await _unique_code(db, "QT"))
    db.add(s)
    await db.flush()
    return await staff_one(db, s.id)


async def staff_update(db: AsyncSession, staff_id: str, patch: dict, actor: Optional[Actor] = None) -> dict:
    s = await _live(db, staff_id)
    for key, col in (("name", "name"), ("position", "position"), ("phone", "phone"), ("staffCode", "staff_code"), ("email", "email")):
        if patch.get(key) is not None:
            setattr(s, col, clean(patch[key]))
    if not s.name:
        raise bad("Nhập họ tên và đơn vị")
    if patch.get("unit"):
        await ensure_unit(db, patch["unit"])
        s.unit = clean(patch["unit"])
    group = patch.get("group")
    if group and group != s.group and not (group == "canbo" and s.group == "daumoi"):
        _check_group(group)
        if actor is not None and actor.id == s.id and s.group == "khtc":
            raise bad("Không tự bỏ vai trò quản trị của chính mình")
        # Vào Phòng QTNL thì cấp mã cá nhân; rời Phòng QTNL thì mã cũ hết hiệu lực
        if group in QTNL_GROUPS and not s.code_hash:
            _set_code(s, await _unique_code(db, "QT"))
        if group not in QTNL_GROUPS and s.group in QTNL_GROUPS:
            _set_code(s, None)
        # Cán bộ đầu mối chuyển vai trò khác thì mã đầu mối đang dùng hết hiệu lực
        if s.group == "daumoi":
            for f in (await db.execute(select(UnitFocal).where(UnitFocal.staff_id == s.id, UnitFocal.status == "dang_dung"))).scalars():
                f.status, f.revoked_at, f.revoke_reason = "da_thu_hoi", clock.now(), "Cán bộ chuyển vai trò khác"
                f.revoked_by = actor.id if actor else None
        s.group = group
    elif group == "canbo" and s.group == "daumoi":
        raise bad("Thu hồi mã đầu mối ở mục Mã cán bộ đầu mối để bỏ vai trò cán bộ đầu mối")
    # Tên đầu mối trên mã đang dùng đi theo dữ liệu cán bộ
    for f in (await db.execute(select(UnitFocal).where(UnitFocal.staff_id == s.id, UnitFocal.status == "dang_dung"))).scalars():
        f.name, f.phone, f.position = s.name, s.phone, s.position
    await db.flush()
    return await staff_one(db, s.id)


# ---------------------------------------------------------------- Tài khoản cá nhân
async def _username_taken(db: AsyncSession, username: str, staff_id: str) -> bool:
    u = username.lower()
    if (await db.execute(select(Account.id).where(func.lower(Account.username) == u))).first():
        return True
    return bool((await db.execute(select(Staff.id).where(func.lower(Staff.username) == u, Staff.id != staff_id))).first())


async def _issue(db: AsyncSession, s: Staff, username: Optional[str]) -> dict:
    from services.auth_service import revoke_sessions

    username = clean(username) or s.username or s.staff_code
    if not username:
        raise bad(f"{s.name}: nhập mã số cán bộ trước khi cấp tài khoản (tên đăng nhập là mã số cán bộ)")
    if " " in username or len(username) > 64:
        raise bad("Tên đăng nhập không có dấu cách, tối đa 64 ký tự")
    if await _username_taken(db, username, s.id):
        raise bad(f"Tên đăng nhập {username} đã được dùng")
    password = random_password()
    s.username = username
    s.password_hash = hash_password(password)
    s.must_change_password = True
    s.active = True
    await revoke_sessions(db, "staff", s.id)
    return {"staffId": s.id, "name": s.name, "unit": s.unit, "staffCode": s.staff_code or "", "username": username, "password": password}


async def account_issue(db: AsyncSession, staff_id: str, data: dict) -> dict:
    """Cấp tài khoản hoặc đặt lại mật khẩu: mật khẩu ban đầu ngẫu nhiên, chỉ hiện một lần để in, gửi riêng cho cán bộ;
    cán bộ đổi ở lần đăng nhập đầu tiên. Đặt lại mật khẩu thì mọi thiết bị đang đăng nhập bị đăng xuất."""
    s = await _live(db, staff_id)
    out = await _issue(db, s, data.get("username"))
    await db.flush()
    return out


async def account_issue_all(db: AsyncSession, data: dict) -> dict:
    """Cấp tài khoản cho mọi cán bộ chưa có (lọc theo đơn vị nếu chọn). Cán bộ chưa có mã số cán bộ thì bỏ qua."""
    q = select(Staff).where(Staff.password_hash.is_(None), Staff.deleted_at.is_(None))
    if clean(data.get("unit")):
        q = q.where(Staff.unit == clean(data.get("unit")))
    issued, skipped = [], []
    for s in sorted((await db.execute(q)).scalars(), key=lambda x: (vi_key(x.unit), vi_key(x.name))):
        if not s.staff_code:
            skipped.append({"staffId": s.id, "name": s.name, "unit": s.unit, "reason": "Chưa có mã số cán bộ"})
            continue
        try:
            issued.append(await _issue(db, s, None))
        except Exception as e:  # noqa: BLE001 - trùng tên đăng nhập: bỏ qua, báo lại
            skipped.append({"staffId": s.id, "name": s.name, "unit": s.unit, "reason": getattr(e, "message", str(e))})
    await db.flush()
    return {"issued": issued, "skipped": skipped}


async def account_set_active(db: AsyncSession, staff_id: str, active: bool, actor: Actor) -> dict:
    """Khóa (nghỉ việc, chuyển công tác) hoặc mở lại. Khóa thì đăng xuất mọi thiết bị, thôi gửi thông báo đẩy."""
    from services.auth_service import revoke_sessions
    from services.push_service import drop_user

    s = await _live(db, staff_id)
    if not active and actor.id == s.id:
        raise bad("Không tự khóa tài khoản của chính mình")
    s.active = bool(active)
    if not active:
        await revoke_sessions(db, "staff", s.id)
        await drop_user(db, s.id)
    await db.flush()
    return await staff_one(db, s.id)


async def account_logout_all(db: AsyncSession, staff_id: str) -> int:
    from services.auth_service import revoke_sessions
    from services.push_service import drop_user

    s = await _live(db, staff_id)
    n = await revoke_sessions(db, "staff", s.id)
    await drop_user(db, s.id)
    return n


# Bảng chỉ thuộc về riêng người đó (xóa cùng khi xóa hẳn), không tính là lịch sử
_OWN_TABLES = {"staff", "auth_sessions", "push_subscriptions", "notifications"}


async def _has_history(db: AsyncSession, staff_id: str) -> bool:
    """Cán bộ đã xuất hiện trong dữ liệu khác chưa (người báo hỏng, kỹ thuật viên, người lập, duyệt, nhật ký, mã đầu
    mối...). Dò mọi cột id 36 ký tự không trỏ sang bảng khác: các cột người thao tác lưu id cán bộ."""
    from core.database import Base

    for table in Base.metadata.sorted_tables:
        if table.name in _OWN_TABLES:
            continue
        for col in table.columns:
            if col.primary_key or not isinstance(col.type, sa.String) or col.type.length != 36:
                continue
            if any(fk.column.table.name != "staff" for fk in col.foreign_keys):
                continue
            if (await db.execute(select(col).where(col == staff_id).limit(1))).first():
                return True
    return False


async def staff_delete(db: AsyncSession, staff_id: str, actor: Actor) -> dict:
    """Xóa cán bộ khỏi danh sách. Có tài khoản thì xóa tài khoản, đăng xuất mọi thiết bị, thôi gửi thông báo đẩy;
    đang là cán bộ đầu mối thì thu hồi mã đầu mối. Chưa có lịch sử thì xóa hẳn; đã có lịch sử (phiếu, nhật ký...) thì
    ẩn khỏi danh sách và ô chọn người, giữ tên trong lịch sử. Trả {"mode": "removed" | "hidden", "name"}."""
    from services.auth_service import revoke_sessions
    from services.push_service import drop_user

    s = await _live(db, staff_id)
    if actor.id == s.id:
        raise bad("Không tự xóa chính mình")
    for f in (await db.execute(select(UnitFocal).where(UnitFocal.staff_id == s.id, UnitFocal.status == "dang_dung"))).scalars():
        await focal_revoke(db, f.id, "Xóa cán bộ khỏi danh sách", actor)
    await revoke_sessions(db, "staff", s.id)
    await drop_user(db, s.id)
    await db.flush()
    name = s.name
    if not await _has_history(db, s.id):
        await db.execute(delete(Notification).where(Notification.user_id == s.id))
        await db.execute(delete(AuthSession).where(AuthSession.subject_kind == "staff", AuthSession.subject_id == s.id))
        await db.delete(s)
        await db.flush()
        return {"mode": "removed", "name": name}
    s.deleted_at = clock.now()
    s.deleted_by = actor.id
    s.username = None
    s.password_hash = None
    s.must_change_password = False
    s.active = False
    s.code_hash = None
    s.code_enc = None
    if s.group == "daumoi":
        s.group = "canbo"
    await db.flush()
    return {"mode": "hidden", "name": name}


async def account_delete(db: AsyncSession, staff_id: str, actor: Actor) -> dict:
    """Xóa tài khoản đăng nhập của cán bộ: bỏ tên đăng nhập, mật khẩu, đăng xuất mọi thiết bị, thôi gửi thông báo đẩy.
    Dữ liệu cán bộ (họ tên, đơn vị, vai trò) và lịch sử phiếu, nhật ký vẫn giữ để tra cứu; cần thì cấp lại tài khoản."""
    from services.auth_service import revoke_sessions
    from services.push_service import drop_user

    s = await _live(db, staff_id)
    if actor.id == s.id:
        raise bad("Không tự xóa tài khoản của chính mình")
    if not s.password_hash and not s.username:
        raise bad(f"{s.name} chưa có tài khoản")
    s.username = None
    s.password_hash = None
    s.must_change_password = False
    s.active = True
    s.last_login_at = None
    await revoke_sessions(db, "staff", s.id)
    await drop_user(db, s.id)
    await db.flush()
    return await staff_one(db, s.id)


async def code_reissue(db: AsyncSession, staff_id: str) -> dict:
    """Đổi mã xác nhận cá nhân của kỹ thuật viên, lãnh đạo Phòng QTNL (mã cũ hết hiệu lực ngay)."""
    s = await _live(db, staff_id)
    if s.group not in QTNL_GROUPS:
        raise bad("Chỉ kỹ thuật viên, lãnh đạo Phòng QTNL có mã xác nhận cá nhân theo dữ liệu cán bộ; mã đầu mối đổi ở mục Mã cán bộ đầu mối")
    _set_code(s, await _unique_code(db, "QT"))
    await db.flush()
    return await staff_one(db, s.id)


# ---------------------------------------------------------------- Mã cán bộ đầu mối
async def _abbr_for(db: AsyncSession, unit: Unit) -> str:
    if unit.abbr:
        return unit.abbr
    last = (
        await db.execute(select(UnitFocal).where(UnitFocal.unit == unit.name).order_by(UnitFocal.issued_at.desc()))
    ).scalars().first()
    if last:
        unit.abbr = last.abbr
        return last.abbr
    base = unit_abbr(unit.name)
    taken = set((await db.execute(select(Unit.abbr).where(Unit.abbr.is_not(None)))).scalars())
    abbr, n = base, 2
    while abbr in taken:
        abbr, n = f"{base}{n}", n + 1
    unit.abbr = abbr
    return abbr


async def focal_list(db: AsyncSession) -> list:
    focals = list((await db.execute(select(UnitFocal))).scalars())
    stats = {
        fid: (n, last)
        for fid, n, last in (
            await db.execute(select(FocalLog.focal_id, func.count(), func.max(FocalLog.at)).group_by(FocalLog.focal_id))
        ).all()
    }
    out = []
    for f in focals:
        d = S.focal(f)
        n, last = stats.get(f.id, (0, None))
        d["logCount"] = n
        d["lastAccess"] = clock.stamp(last)
        out.append(d)
    # Đơn vị chưa từng được cấp mã: hiện một dòng để Phòng KHTC cấp mã lần đầu
    have = {f.unit for f in focals}
    for u in (await db.execute(select(Unit))).scalars():
        if u.name not in have:
            out.append(
                {
                    "id": f"unit:{u.id}",
                    "unit": u.name,
                    "abbr": u.abbr or unit_abbr(u.name),
                    "name": "",
                    "position": "",
                    "phone": "",
                    "code": "",
                    "issuedAt": None,
                    "issuedBy": None,
                    "status": "chua_cap",
                    "revokedAt": None,
                    "revokedBy": None,
                    "revokeReason": None,
                    "staffId": None,
                    "logCount": 0,
                    "lastAccess": None,
                }
            )
    return sorted(out, key=lambda f: (vi_key(f["unit"]), 0 if f["status"] == "dang_dung" else 1))


async def focal_logs(db: AsyncSession) -> list:
    codes = {f.id: decrypt_code(f.code_enc) for f in (await db.execute(select(UnitFocal))).scalars()}
    rows = (await db.execute(select(FocalLog).order_by(FocalLog.at.desc()))).scalars()
    return [S.focal_log(l, codes.get(l.focal_id)) for l in rows]


async def focal_reissue(db: AsyncSession, unit_name: str, data: dict, actor: Actor) -> dict:
    """Đổi cán bộ đầu mối hoặc cấp mã mới: thu hồi mã đang dùng của đơn vị, cấp mã mới (mã cũ hết hiệu lực ngay)."""
    unit = (await db.execute(select(Unit).where(Unit.name == unit_name))).scalar_one_or_none()
    if unit is None:
        raise bad("Không tìm thấy đơn vị")
    at = clock.now()
    st = await db.get(Staff, data["staffId"]) if data.get("staffId") else None
    if data.get("staffId") and (not st or st.deleted_at is not None):
        raise bad("Không tìm thấy cán bộ trong dữ liệu cán bộ")
    if st is None:
        # Cán bộ đầu mối đăng nhập bằng tài khoản cá nhân nên phải chọn từ dữ liệu cán bộ
        raise bad("Chọn cán bộ đầu mối từ dữ liệu cán bộ")
    if not st.active:
        raise bad("Tài khoản của cán bộ này đang bị khóa")
    other = (
        await db.execute(select(UnitFocal).where(UnitFocal.staff_id == st.id, UnitFocal.status == "dang_dung", UnitFocal.unit != unit.name))
    ).scalars().first()
    if other:
        raise bad(f"{st.name} đang là cán bộ đầu mối của {other.unit}")
    person = {"name": st.name, "position": st.position, "phone": st.phone, "staff_id": st.id}
    current = (
        await db.execute(select(UnitFocal).where(UnitFocal.unit == unit.name, UnitFocal.status == "dang_dung"))
    ).scalar_one_or_none()
    abbr = await _abbr_for(db, unit)
    if current:
        current.status = "da_thu_hoi"
        current.revoked_at = at
        current.revoked_by = actor.id
        current.revoke_reason = "Đơn vị thay cán bộ đầu mối" if person["name"] != current.name else "Cấp mã mới"
        # Người cũ thôi làm đầu mối thì trở lại nhóm cán bộ trong dữ liệu cán bộ
        if current.staff_id and current.staff_id != person["staff_id"]:
            old = await db.get(Staff, current.staff_id)
            if old and old.group == "daumoi":
                old.group = "canbo"
    if st.group == "canbo":
        st.group = "daumoi"
    code = await _unique_code(db, abbr)
    f = UnitFocal(
        unit=unit.name,
        abbr=abbr,
        staff_id=person["staff_id"],
        name=person["name"],
        position=person["position"] or "Cán bộ đầu mối",
        phone=person["phone"] or "",
        code_hash=code_hash(code),
        code_enc=encrypt_code(code),
        status="dang_dung",
        issued_at=at,
        issued_by=actor.id,
    )
    db.add(f)
    await db.flush()
    return S.focal(f)


async def focal_revoke(db: AsyncSession, focal_id: str, reason: str, actor: Actor) -> None:
    f = await db.get(UnitFocal, focal_id)
    if not f or f.status != "dang_dung":
        raise bad("Mã không còn hiệu lực")
    f.status = "da_thu_hoi"
    f.revoked_at = clock.now()
    f.revoked_by = actor.id
    f.revoke_reason = clean(reason) or "Thu hồi"
    # Thôi làm đầu mối thì trở lại vai trò cán bộ, giảng viên (tài khoản cá nhân vẫn dùng bình thường)
    if f.staff_id:
        st = await db.get(Staff, f.staff_id)
        if st and st.group == "daumoi":
            st.group = "canbo"


async def focal_log(db: AsyncSession, focal: UnitFocal, action: str, detail: str = "") -> None:
    at = clock.now()
    if action == "xem":
        # Mở lại cùng trang trong cùng một phút thì không ghi thêm dòng "xem"
        last = (
            await db.execute(
                select(FocalLog)
                .where(FocalLog.focal_id == focal.id, FocalLog.action == "xem")
                .order_by(FocalLog.at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if last and last.detail == detail and last.at == at:
            return
    db.add(FocalLog(at=at, focal_id=focal.id, unit=focal.unit, name=focal.name, action=action, detail=detail))


# ---------------------------------------------------------------- Danh bạ cho giao diện (tên người theo id)
async def people(db: AsyncSession, viewer_role: str) -> list:
    """Cán bộ (để chọn người báo, hiện tên người thao tác), tài khoản admin, cán bộ đầu mối.
    Mã cá nhân chỉ trả cho Phòng KHTC."""
    out = []
    for s in (await db.execute(select(Staff))).scalars():
        d = S.staff(s)
        if s.deleted_at is not None:
            d["deleted"] = True  # chỉ để hiện tên trong lịch sử; không hiện ở ô chọn người
        if viewer_role == "khtc" and s.group in QTNL_GROUPS:
            d["code"] = decrypt_code(s.code_enc)
        out.append(d)
    for a in (await db.execute(select(Account).where(Account.kind == "admin"))).scalars():
        out.append({"id": a.id, "name": a.display_name, "unit": settings.KHTC_UNIT, "position": "Tài khoản admin", "role": "khtc", "kind": "account"})
    for f in (await db.execute(select(UnitFocal))).scalars():
        out.append({"id": f.id, "name": f.name, "unit": f.unit, "position": "Cán bộ đầu mối", "phone": f.phone or "", "role": "daumoi", "kind": "focal", "staffId": f.staff_id})
    return out
