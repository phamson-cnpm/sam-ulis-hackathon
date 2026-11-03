
"""Tạo dữ liệu và phiên đăng nhập cho bài kiểm tra (trong cơ sở dữ liệu kiểm tra, không dùng dữ liệu giả lập của fe_sam)."""
import datetime as dt
import uuid

from sqlalchemy import select

from core.security import code_hash, encrypt_code, hash_password
from models import Asset, AssetGroup, Staff, Unit
from tests.conftest import bearer

QTNL_UNIT = "Phòng Quản trị nguồn lực"


def uid(n: int = 6) -> str:
    return uuid.uuid4().hex[:n].upper()


async def ensure_unit(db, name):
    if not (await db.execute(select(Unit).where(Unit.name == name))).scalar_one_or_none():
        db.add(Unit(name=name))
        await db.flush()


async def ensure_group(db, code, name):
    if not await db.get(AssetGroup, code):
        db.add(AssetGroup(code=code, name=name))
        await db.flush()


async def make_asset(db, *, group="0404", unit="Khoa NN&VH Anh", cost=20_000_000, residual=10_000_000, location="A2.201", in_use="2022-01-10", status="dang_su_dung", name=None) -> Asset:
    await ensure_unit(db, unit)
    await ensure_group(db, group, {"0404": "Máy chiếu", "0416": "Điều hòa", "0401": "Máy tính bàn, máy chủ"}.get(group, f"Nhóm {group}"))
    d = dt.date.fromisoformat(in_use)
    a = Asset(
        code=f"{group}.{d.year}.{uid(5)}",
        name=name or f"Tài sản thử {uid(3)}",
        group_code=group,
        in_use_date=d,
        location=location,
        unit=unit,
        original_cost=cost,
        depreciation_months=60,
        accumulated_depreciation=cost - residual,
        residual_value=residual,
        funding_source="001",
        status=status,
        last_interaction_date=d,
    )
    db.add(a)
    await db.commit()
    return a


async def make_staff(db, name=None, unit="Khoa NN&VH Anh", group="canbo", code=None, position="", phone="", password=None, staff_code=None) -> Staff:
    """Cán bộ trong dữ liệu cán bộ; password: cấp luôn tài khoản cá nhân (đã đổi mật khẩu ban đầu)."""
    await ensure_unit(db, unit)
    s = Staff(name=name or f"Cán bộ {uid(4)}", unit=unit, group=group, position=position, phone=phone, staff_code=staff_code)
    if code:
        s.code_hash, s.code_enc = code_hash(code), encrypt_code(code)
    if password:
        s.username = staff_code or f"cb{uid(8).lower()}"
        s.password_hash = hash_password(password)
        s.must_change_password = False
    db.add(s)
    await db.commit()
    return s


async def login(client, username, password) -> str:
    r = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["accessToken"]


async def as_khtc(client) -> dict:
    """Tài khoản quản trị hệ thống của Phòng KHTC (tạo từ .env)."""
    return bearer(await login(client, "khtc", "admin-pass"))


async def as_staff(client, staff: Staff, password: str = "Mat-khau-1", code: str | None = None) -> dict:
    """Đăng nhập tài khoản cá nhân; code: gửi kèm mã xác nhận cá nhân (header X-Confirm-Code) ở mọi yêu cầu."""
    h = bearer(await login(client, staff.username, password))
    if code:
        h["X-Confirm-Code"] = code
    return h


async def person(db, client, group="canbo", unit="Khoa NN&VH Anh", code=None, **kw):
    """Cán bộ có tài khoản cá nhân và đã đăng nhập: trả về (cán bộ, headers)."""
    s = await make_staff(db, unit=unit, group=group, code=code, password="Mat-khau-1", **kw)
    return s, await as_staff(client, s, code=code)


async def as_focal(db, client, unit: str, staff: Staff | None = None):
    """Phòng KHTC cấp mã đầu mối cho một cán bộ của đơn vị: trả về (cán bộ, mã đầu mối, headers có mã)."""
    if staff is None:
        staff = await make_staff(db, unit=unit, password="Mat-khau-1")
    h = await as_khtc(client)
    r = await client.post("/api/v1/focal/reissue", json={"unit": unit, "staffId": staff.id}, headers=h)
    assert r.status_code == 200, r.text
    f = r.json()
    return staff, f, await as_staff(client, staff, code=f["code"])


class Team:
    """Một kỹ thuật viên, một lãnh đạo Phòng QTNL (có mã xác nhận cá nhân), một cán bộ báo hỏng; mỗi người một tài khoản."""

    async def setup(self, db, client):
        self.ktv_code = f"QT-{uid(4)}"
        self.leader_code = f"QT-{uid(4)}"
        self.ktv, self.h_ktv = await person(db, client, "ktv", QTNL_UNIT, self.ktv_code, position="Kỹ thuật viên")
        self.leader, self.h_leader = await person(db, client, "lanhdao_qtnl", QTNL_UNIT, self.leader_code, position="Trưởng phòng")
        self.reporter, self.h_canbo = await person(db, client, "canbo", "Khoa NN&VH Anh", phone="0912 000 111")
        self.h_khtc = await as_khtc(client)
        return self


async def report(client, team, asset, urgent=False, situation=""):
    r = await client.post(
        "/api/v1/reports/batch",
        json={
            "reporterId": team.reporter.id,
            "phone": "0912 000 111",
            "items": [{"assetId": asset.id, "location": asset.location, "content": "Không lên hình", "situation": situation, "urgent": urgent}],
        },
        headers=team.h_canbo,
    )
    assert r.status_code == 200, r.text
    return r.json()["reports"][0]


async def inspect(client, team, rep, proposal="sua_chua"):
    r = await client.post(
        "/api/v1/inspections",
        json={"reportId": rep["id"], "assetId": rep["assetId"], "inspectedAt": "2026-10-24T09:00", "findings": "Hỏng bo nguồn", "target": "tai_san", "proposal": proposal},
        headers=team.h_ktv,
    )
    assert r.status_code == 200, r.text
    return r.json()
