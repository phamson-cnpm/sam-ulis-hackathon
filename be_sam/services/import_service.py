
"""Phòng KHTC nhập file Excel. Tự nhận loại file theo dòng tiêu đề:
- Danh sách tài sản xuất từ phần mềm quản lý tài sản (BẢNG TÍNH KHẤU HAO TÀI SẢN): Mã tài sản, Tên tài sản, Ngày sử dụng,
  Vị trí, Phòng ban, Nguyên giá, Số tháng khấu hao, Giá trị hao mòn lũy kế, Giá trị còn lại, Nguồn vốn.
- Danh mục nhóm tài sản cố định: Mã nhóm, Tên nhóm.
- Danh sách cán bộ: Mã số hiệu CBCCVC, Họ tên, Đơn vị, Chức vụ hiện tại (số điện thoại, email nếu có).
Nhập lại cùng file là cập nhật theo mã: mã đã có thì cập nhật, chưa có thì thêm mới; không xóa dữ liệu đang có."""
import datetime as dt
import io
import re

import openpyxl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import Actor
from core.errors import bad
from models import AppSetting, Asset, AssetGroup, Staff, Unit
from services.common import clean

HEADER_ALIASES = {
    # tài sản
    "mã tài sản": "code",
    "tên tài sản": "name",
    "ngày sử dụng": "in_use_date",
    "vị trí": "location",
    "phòng ban": "unit",
    "nguyên giá": "original_cost",
    "số tháng khấu hao": "depreciation_months",
    "giá trị hao mòn lũy kế": "accumulated_depreciation",
    "giá trị còn lại": "residual_value",
    "nguồn vốn": "funding_source",
    # nhóm
    "mã nhóm": "group_code",
    "tên nhóm": "group_name",
    # cán bộ
    "mã số hiệu cbccvc": "staff_code",
    "họ tên": "staff_name",
    "họ và tên": "staff_name",
    "đơn vị": "staff_unit",
    "chức vụ hiện tại": "position",
    "chức vụ": "position",
    "số điện thoại": "phone",
    "điện thoại": "phone",
    "email": "email",
}


def _key(v) -> str:
    return " ".join(str(v or "").split()).strip().lower()


def _num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return int(round(v))
    s = re.sub(r"[^\d\-]", "", str(v))
    return int(s) if s not in ("", "-") else None


def _date(v):
    if v is None or v == "":
        return None
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    s = str(v).strip()
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return dt.datetime.strptime(s[:10], fmt).date()
        except ValueError:
            continue
    return None


def _text(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return clean(v)


def _read(content: bytes):
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception:
        raise bad("Không đọc được file. Chọn file Excel (.xlsx).")
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    for i, r in enumerate(rows[:30]):
        cols = {}
        for j, c in enumerate(r or []):
            k = HEADER_ALIASES.get(_key(c))
            if k and k not in cols:
                cols[k] = j
        if {"code", "name"} <= cols.keys() or {"group_code", "group_name"} <= cols.keys() or {"staff_name", "staff_unit"} <= cols.keys():
            return rows, i, cols
    raise bad("Không nhận ra file: cần dòng tiêu đề có Mã tài sản, Tên tài sản; hoặc Mã nhóm, Tên nhóm; hoặc Họ tên, Đơn vị.")


def _period_end(rows, header_index):
    """Ngày chốt số liệu sổ sách từ dòng tiêu đề, ví dụ '01/01/2025 - 31/12/2025' → '31/12/2025'."""
    for r in rows[:header_index]:
        for c in r or []:
            m = re.search(r"(\d{2}/\d{2}/\d{4})\s*[-–]\s*(\d{2}/\d{2}/\d{4})", str(c or ""))
            if m:
                return m.group(2)
    return None


async def _units(db: AsyncSession) -> dict:
    return {u.name: u for u in (await db.execute(select(Unit))).scalars()}


def _summary(kind, total):
    return {"kind": kind, "total": total, "added": 0, "updated": 0, "unchanged": 0, "skipped": [], "unitsAdded": 0, "groupsAdded": 0}


async def import_excel(db: AsyncSession, actor: Actor, content: bytes) -> dict:
    rows, hi, cols = _read(content)
    data = [(hi + 2 + n, r) for n, r in enumerate(rows[hi + 1 :]) if r and any(c not in (None, "") for c in r)]
    if {"code", "name"} <= cols.keys():
        return await _import_assets(db, rows, hi, cols, data)
    if {"group_code", "group_name"} <= cols.keys():
        return await _import_groups(db, cols, data)
    return await _import_staff(db, actor, cols, data)


async def _import_groups(db, cols, data) -> dict:
    out = _summary("groups", len(data))
    existing = {g.code: g for g in (await db.execute(select(AssetGroup))).scalars()}
    for rowno, r in data:
        code, name = _text(r[cols["group_code"]]), _text(r[cols["group_name"]])
        if not code or not name:
            out["skipped"].append({"row": rowno, "reason": "Thiếu mã nhóm hoặc tên nhóm"})
            continue
        g = existing.get(code)
        if g is None:
            g = AssetGroup(code=code, name=name)
            db.add(g)
            existing[code] = g
            out["added"] += 1
        elif g.name != name:
            g.name = name
            out["updated"] += 1
        else:
            out["unchanged"] += 1
    return out


async def _import_assets(db, rows, hi, cols, data) -> dict:
    out = _summary("assets", 0)
    units = await _units(db)
    groups = {g.code: g for g in (await db.execute(select(AssetGroup))).scalars()}
    existing = {a.code: a for a in (await db.execute(select(Asset))).scalars()}
    seen = set()

    def cell(r, k):
        j = cols.get(k)
        return r[j] if j is not None and j < len(r) else None

    for rowno, r in data:
        code, name = _text(cell(r, "code")), _text(cell(r, "name"))
        if not code:
            if name and not name.lower().startswith("tổng"):
                out["skipped"].append({"row": rowno, "reason": "Thiếu mã tài sản"})
            continue
        out["total"] += 1
        unit = _text(cell(r, "unit"))
        if not name:
            out["skipped"].append({"row": rowno, "code": code, "reason": "Thiếu tên tài sản"})
            continue
        if not unit:
            out["skipped"].append({"row": rowno, "code": code, "reason": "Thiếu phòng ban"})
            continue
        if code in seen:
            out["skipped"].append({"row": rowno, "code": code, "reason": "Mã tài sản trùng trong file, lấy dòng đầu"})
            continue
        seen.add(code)
        if unit not in units:
            units[unit] = Unit(name=unit)
            db.add(units[unit])
            await db.flush()  # ghi đơn vị trước tài sản (khóa ngoại)
            out["unitsAdded"] += 1
        gcode = code.split(".")[0]
        if gcode not in groups:
            groups[gcode] = AssetGroup(code=gcode, name=f"Nhóm {gcode}")
            db.add(groups[gcode])
            await db.flush()
            out["groupsAdded"] += 1
        vals = {
            "name": name,
            "group_code": gcode,
            "in_use_date": _date(cell(r, "in_use_date")),
            "location": _text(cell(r, "location")),
            "unit": unit,
            "original_cost": _num(cell(r, "original_cost")) or 0,
            "depreciation_months": _num(cell(r, "depreciation_months")),
            "accumulated_depreciation": _num(cell(r, "accumulated_depreciation")) or 0,
            "residual_value": _num(cell(r, "residual_value")) or 0,
            "funding_source": _text(cell(r, "funding_source")),
        }
        a = existing.get(code)
        if a is None:
            # Mốc tính thời gian nằm kho: ngày đưa vào sử dụng (câu C, file Câu hỏi còn lại)
            db.add(Asset(code=code, status="dang_su_dung", last_interaction_date=vals["in_use_date"], **vals))
            out["added"] += 1
            continue
        changed = False
        for k, v in vals.items():
            if getattr(a, k) != v:
                setattr(a, k, v)
                changed = True
        out["updated" if changed else "unchanged"] += 1
    await db.flush()
    end = _period_end(rows, hi)
    if end:
        s = await db.get(AppSetting, "asset_book_date")
        if s is None:
            db.add(AppSetting(key="asset_book_date", value=end))
        else:
            s.value = end
        out["bookDate"] = end
    return out


async def _import_staff(db, actor, cols, data) -> dict:
    out = _summary("staff", len(data))
    units = await _units(db)
    all_staff = list((await db.execute(select(Staff).where(Staff.deleted_at.is_(None)))).scalars())
    by_code = {s.staff_code: s for s in all_staff if s.staff_code}
    by_name = {(s.name, s.unit): s for s in all_staff}

    def cell(r, k):
        j = cols.get(k)
        return r[j] if j is not None and j < len(r) else None

    for rowno, r in data:
        name, unit = _text(cell(r, "staff_name")), _text(cell(r, "staff_unit"))
        if not name or not unit:
            out["skipped"].append({"row": rowno, "reason": "Thiếu họ tên hoặc đơn vị"})
            continue
        if unit not in units:
            units[unit] = Unit(name=unit)
            db.add(units[unit])
            await db.flush()
            out["unitsAdded"] += 1
        code = _text(cell(r, "staff_code")) or None
        position, phone, email = _text(cell(r, "position")), _text(cell(r, "phone")), _text(cell(r, "email"))
        s = by_code.get(code) if code else None
        s = s or by_name.get((name, unit))
        if s is None:
            s = Staff(staff_code=code, name=name, unit=unit, position=position, phone=phone, email=email, group="canbo", created_by=actor.id)
            db.add(s)
            by_name[(name, unit)] = s
            if code:
                by_code[code] = s
            out["added"] += 1
            continue
        vals = {"staff_code": code or s.staff_code, "name": name, "unit": unit, "position": position or s.position}
        # Số điện thoại, email cán bộ đã tự nhập khi báo hỏng thì giữ, trừ khi file có giá trị
        if phone:
            vals["phone"] = phone
        if email:
            vals["email"] = email
        changed = False
        for k, v in vals.items():
            if getattr(s, k) != v:
                setattr(s, k, v)
                changed = True
        out["updated" if changed else "unchanged"] += 1
    await db.flush()
    return out
