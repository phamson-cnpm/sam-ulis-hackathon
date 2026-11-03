
"""Danh mục Phòng QTNL; dữ liệu cán bộ, vai trò, mã xác nhận cá nhân; mã cán bộ đầu mối (cấp, đổi, thu hồi, nhật ký),
tài sản toàn trường của đầu mối; phân quyền theo bảng mục VII đề tài; ngưỡng cảnh báo; nhập Excel; số việc chờ;
danh bạ cho giao diện."""
import io

import openpyxl
from sqlalchemy import select

from models import Asset, AssetGroup, Staff
from tests.conftest import bearer
from tests.factory import QTNL_UNIT, Team, as_focal, as_khtc, as_staff, inspect, make_asset, make_staff, person, report, uid

API = "/api/v1"


async def test_danh_muc_phong_qtnl(client, db):
    t = await Team().setup(db, client)
    await make_asset(db, group="0416")
    h = t.h_ktv
    assert (await client.post(f"{API}/catalog/faults", json={"groupCode": "0416", "text": "Không mát"}, headers=h)).status_code == 200
    dup = await client.post(f"{API}/catalog/faults", json={"groupCode": "0416", "text": "Không mát"}, headers=h)
    assert dup.json()["message"] == "Nội dung này đã có trong danh sách"
    lists = (await client.get(f"{API}/catalog/fault-lists", headers=t.h_canbo)).json()
    assert lists[0]["groupCode"] == "" and lists[0]["name"] == "Danh sách chung"
    assert "Không mát" in next(l for l in lists if l["groupCode"] == "0416")["items"]

    name = f"Mất điện {uid(3)}"
    await client.post(f"{API}/catalog/situations", json={"text": f"Bình thường {uid(3)}", "urgent": False}, headers=h)
    await client.post(f"{API}/catalog/situations", json={"text": name, "urgent": True}, headers=h)
    sit = (await client.get(f"{API}/catalog/situations", headers=h)).json()
    assert sit[0]["urgent"] is True  # khẩn cấp đứng đầu
    job = (await client.post(f"{API}/catalog/repair-jobs", json={"name": "Thay block máy nén", "groupCode": "0416", "costGroup": "tinh"}, headers=h)).json()
    assert job["code"].startswith("SC-") and job["groupCodes"] == ["0416"]
    await client.patch(f"{API}/catalog/repair-jobs/{job['id']}", json={"active": False}, headers=h)
    active = (await client.get(f"{API}/catalog/repair-jobs", headers=h)).json()
    assert job["id"] not in {j["id"] for j in active}
    # Cán bộ không sửa được danh mục
    assert (await client.post(f"{API}/catalog/faults", json={"groupCode": "", "text": "x"}, headers=t.h_canbo)).status_code == 403


async def test_du_lieu_can_bo_va_ma_ca_nhan(client, db):
    h = await as_khtc(client)
    r = await client.post(f"{API}/staff", json={"name": "Phan Văn Tùng", "unit": QTNL_UNIT, "position": "Kỹ thuật viên", "phone": "0983", "group": "ktv", "staffCode": f"ULIS{uid(5)}"}, headers=h)
    s = r.json()
    assert r.status_code == 200 and s["code"].startswith("QT-") and s["role"] == "ktv"
    lst = (await client.get(f"{API}/staff", headers=h)).json()
    assert next(p for p in lst if p["id"] == s["id"])["personalCode"] == s["code"]
    # Đổi mã xác nhận: mã cũ hết hiệu lực ngay
    s2 = (await client.post(f"{API}/staff/{s['id']}/code", headers=h)).json()
    assert s2["code"].startswith("QT-") and s2["code"] != s["code"]
    # Cán bộ đầu mối không đặt trực tiếp ở dữ liệu cán bộ (mỗi đơn vị một người, cấp ở mục Mã cán bộ đầu mối)
    bad = await client.patch(f"{API}/staff/{s['id']}", json={"group": "daumoi"}, headers=h)
    assert bad.status_code == 400
    # Rời Phòng QTNL thì mã hết hiệu lực
    up = (await client.patch(f"{API}/staff/{s['id']}", json={"group": "canbo"}, headers=h)).json()
    assert up["code"] is None and up["role"] == "canbo"
    # Danh bạ: chỉ Phòng KHTC thấy mã cá nhân
    t = await Team().setup(db, client)
    ppl_khtc = (await client.get(f"{API}/refs", headers=h)).json()["people"]
    ppl_ktv = (await client.get(f"{API}/refs", headers=t.h_ktv)).json()["people"]
    assert next(p for p in ppl_khtc if p["id"] == t.ktv.id)["code"] == t.ktv_code
    assert "code" not in next(p for p in ppl_ktv if p["id"] == t.ktv.id)
    assert any(p["role"] == "khtc" and p["position"] == "Tài khoản admin" for p in ppl_ktv)


async def test_ma_dau_moi_cap_doi_thu_hoi(client, db):
    h = await as_khtc(client)
    unit = f"Khoa Thử nghiệm {uid(3)}"
    a = await make_asset(db, unit=unit)
    other = await make_asset(db, unit="Khoa NN&VH Đức")
    p1 = await make_staff(db, name="Trần Thị Mai", unit=unit, phone="0901", password="Mat-khau-1")
    p2 = await make_staff(db, name="Lê Văn Bình", unit=unit, password="Mat-khau-1")
    lst = (await client.get(f"{API}/focal", headers=h)).json()
    row = next(f for f in lst if f["unit"] == unit)
    assert row["status"] == "chua_cap"  # đơn vị chưa từng có mã: hiện để cấp lần đầu
    # Phải chọn cán bộ từ dữ liệu cán bộ (đầu mối đăng nhập bằng tài khoản cá nhân)
    assert (await client.post(f"{API}/focal/reissue", json={"unit": unit, "name": "Người ngoài"}, headers=h)).status_code == 400
    f1 = (await client.post(f"{API}/focal/reissue", json={"unit": unit, "staffId": p1.id}, headers=h)).json()
    assert f1["status"] == "dang_dung" and f1["code"].startswith(f"{f1['abbr']}-")
    await db.commit()
    await db.refresh(p1)
    assert p1.group == "daumoi"

    hf = await as_staff(client, p1, code=f1["code"])
    assert (await client.get(f"{API}/auth/me", headers=hf)).json()["user"]["role"] == "daumoi"
    assets = (await client.get(f"{API}/focal/assets", headers=hf)).json()
    ids = {x["id"] for x in assets}
    assert a.id in ids and other.id in ids  # xem tài sản toàn trường (giao diện lọc theo đơn vị)
    row = next(x for x in assets if x["id"] == a.id)
    # Chỉ các cột: màu đèn, mã, tên, phòng ban, vị trí, nguyên giá, Đề xuất
    assert set(row) == {"id", "code", "name", "unit", "location", "originalCost", "light", "proposal", "suggestion"}
    assert set(row["light"]) == {"code"}
    assert (await client.post(f"{API}/focal/log", json={"action": "xem", "detail": "Danh sách tài sản"}, headers=hf)).status_code == 200
    assert (await client.post(f"{API}/export-logs", json={"action": "xuat_excel", "detail": "Danh sách đơn vị"}, headers=hf)).status_code == 200
    assert (await client.post(f"{API}/export-logs", json={"action": "tai_pdf", "detail": "Danh sách đơn vị"}, headers=hf)).status_code == 200
    logs = [l for l in (await client.get(f"{API}/focal/logs", headers=h)).json() if l["focalId"] == f1["id"]]
    assert sorted(l["action"] for l in logs) == ["tai_pdf", "xem", "xuat_excel"]
    assert all(l["code"] == f1["code"] for l in logs)
    xl = (await client.get(f"{API}/export-logs", headers=h)).json()
    assert any(l["role"] == "daumoi" and l["userId"] == p1.id and l["code"] == f1["code"] for l in xl)
    # Đầu mối không xem danh sách đầy đủ (có giá trị còn lại, chi phí), phiếu của người khác
    assert (await client.get(f"{API}/assets", headers=hf)).status_code == 403
    assert (await client.get(f"{API}/reports", headers=hf)).status_code == 403
    one = (await client.get(f"{API}/assets/{a.id}", headers=hf)).json()
    assert "residualValue" not in one and "accumulatedDepreciation" not in one and one["originalCost"] == a.original_cost

    # Đổi người: mã cũ hết hiệu lực ngay, người cũ trở lại vai trò cán bộ
    f2 = (await client.post(f"{API}/focal/reissue", json={"unit": unit, "staffId": p2.id}, headers=h)).json()
    assert f2["code"] != f1["code"] and f2["abbr"] == f1["abbr"]
    me = await client.get(f"{API}/auth/me", headers=hf)
    assert me.status_code == 200 and me.json()["user"]["role"] == "canbo"
    assert (await client.get(f"{API}/focal/assets", headers=hf)).status_code == 403
    await db.commit()
    await db.refresh(p1)
    assert p1.group == "canbo"
    rows = [f for f in (await client.get(f"{API}/focal", headers=h)).json() if f["unit"] == unit]
    assert [f["status"] for f in rows] == ["dang_dung", "da_thu_hoi"]
    assert rows[1]["revokeReason"] == "Đơn vị thay cán bộ đầu mối"
    # Một người không làm đầu mối hai đơn vị
    dup = await client.post(f"{API}/focal/reissue", json={"unit": "Khoa NN&VH Đức", "staffId": p2.id}, headers=h)
    assert dup.status_code == 400
    # Thu hồi
    assert (await client.post(f"{API}/focal/{f2['id']}/revoke", json={"reason": "Nghỉ hưu"}, headers=h)).status_code == 200
    again = await client.post(f"{API}/focal/{f2['id']}/revoke", json={"reason": "x"}, headers=h)
    assert again.json()["message"] == "Mã không còn hiệu lực"


async def test_dau_moi_bao_hong_va_xem_phieu_cua_minh(client, db):
    unit = f"Khoa Báo hỏng {uid(3)}"
    a = await make_asset(db, unit=unit)
    p, f, hf = await as_focal(db, client, unit)
    r = await client.post(f"{API}/reports/batch", json={"phone": "", "items": [{"assetId": a.id, "content": "Hỏng", "location": a.location}]}, headers=hf)
    assert r.status_code == 200
    rep = r.json()["reports"][0]
    assert rep["accountId"] == p.id and rep["reporterId"] == p.id and rep["source"] == "can_bo"
    mine = (await client.get(f"{API}/reports/mine", headers=hf)).json()
    assert [x["id"] for x in mine] == [rep["id"]]
    d = (await client.get(f"{API}/forms/case/{rep['id']}", headers=hf)).json()
    assert d["report"]["id"] == rep["id"] and d["estimate"] is None and d["inspection"] is None
    # Không xem được hồ sơ phiếu của người khác
    t = await Team().setup(db, client)
    other = await report(client, t, await make_asset(db))
    assert (await client.get(f"{API}/forms/case/{other['id']}", headers=hf)).status_code == 403


async def test_phan_quyen(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db)
    rep = await report(client, t, a)
    # Cán bộ: chỉ báo hỏng, theo dõi phiếu của mình
    for path in ("/assets", "/reports", "/estimates", "/staff", "/focal", "/export-logs", "/proposals", "/focal/assets"):
        assert (await client.get(f"{API}{path}", headers=t.h_canbo)).status_code == 403, path
    # Phòng KHTC: xem toàn bộ, không lập biên bản, dự toán, phiếu tạm
    assert (await client.get(f"{API}/reports/{rep['id']}/case", headers=t.h_khtc)).status_code == 200
    assert (await client.post(f"{API}/inspections", json={"reportId": rep["id"], "assetId": a.id, "findings": "x", "proposal": "tai_cho"}, headers=t.h_khtc)).status_code == 403
    # Tài khoản quản trị hệ thống không báo hỏng; cán bộ Phòng KHTC báo hỏng như mọi cán bộ (tài khoản cá nhân)
    assert (await client.post(f"{API}/reports/batch", json={"items": [{"assetId": a.id, "content": "x"}]}, headers=t.h_khtc)).status_code == 403
    k, hk = await person(db, client, "khtc", "Phòng Kế hoạch - Tài chính")
    r = await client.post(f"{API}/reports/batch", json={"items": [{"assetId": a.id, "content": "Hỏng", "location": a.location}]}, headers=hk)
    assert r.status_code == 200 and r.json()["reports"][0]["reporterId"] == k.id
    # Kỹ thuật viên: không đặt ngưỡng, không mở khóa ngoại lệ, không cấp mã, không cấp tài khoản
    assert (await client.put(f"{API}/thresholds", json={}, headers=t.h_ktv)).status_code == 403
    assert (await client.post(f"{API}/focal/reissue", json={}, headers=t.h_ktv)).status_code == 403
    assert (await client.post(f"{API}/staff/{t.reporter.id}/account", json={}, headers=t.h_ktv)).status_code == 403
    # Kỹ thuật viên lập phiếu khi tự phát hiện sự cố: nguồn "QTNL phát hiện"; lập thay người báo qua điện thoại
    r = await client.post(f"{API}/reports/batch", json={"reporterId": t.ktv.id, "phone": "", "items": [{"assetId": a.id, "content": "Phát hiện khi kiểm tra", "location": a.location}]}, headers=t.h_ktv)
    assert r.json()["reports"][0]["source"] == "qtnl"
    r = await client.post(f"{API}/reports/batch", json={"reporterId": t.reporter.id, "phone": "", "items": [{"assetId": a.id, "content": "Báo qua điện thoại", "location": a.location}]}, headers=t.h_ktv)
    rep2 = r.json()["reports"][0]
    assert rep2["reporterId"] == t.reporter.id and rep2["accountId"] == t.ktv.id


async def test_nguong_xem_truoc_luu_nhat_ky(client, db):
    h = await as_khtc(client)
    th = (await client.get(f"{API}/thresholds", headers=h)).json()
    assert th == {"redPct": 20, "orangePct": 30, "orangeCount": 3, "repeatCount": 2, "warehouseMonths": 12, "cumulativePct": 40}
    a = await make_asset(db, location="KHO.TB", unit="Phòng Quản trị nguồn lực", in_use="2026-01-05")
    nxt = {**th, "warehouseMonths": 6}
    changes = (await client.post(f"{API}/thresholds/preview", json=nxt, headers=h)).json()
    hit = next(c for c in changes if c["asset"]["id"] == a.id)
    assert hit["from"]["code"] == "xanh_duong" and hit["to"]["code"] == "vang_3_1"
    saved = (await client.put(f"{API}/thresholds", json=nxt, headers=h)).json()
    assert saved["warehouseMonths"] == 6
    logs = (await client.get(f"{API}/thresholds/logs", headers=h)).json()
    assert logs[0]["field"] == "warehouseMonths" and logs[0]["oldValue"] == 12 and logs[0]["newValue"] == 6
    await client.put(f"{API}/thresholds", json=th, headers=h)


def _xlsx(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


async def _import(client, h, content, name="du_lieu.xlsx"):
    return await client.post(f"{API}/import", files={"file": (name, io.BytesIO(content), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}, headers=h)


async def test_nhap_excel_tai_san_nhom_can_bo(client, db):
    import datetime as dt

    h = await as_khtc(client)
    # Danh mục nhóm (DM_NHOM_TSCD.xlsx)
    g = await _import(client, h, _xlsx([["DANH MỤC NHÓM TÀI SẢN CỐ ĐỊNH"], [], ["Mã nhóm", "Tên nhóm"], ["0918", "Thiết bị thử nghiệm"], ["0919", "Thiết bị đo"]]))
    assert g.status_code == 200 and g.json()["kind"] == "groups" and g.json()["added"] == 2
    # Danh sách tài sản (cùng dạng file Du_lieu_tai_san_moi_23_10_2026.xlsx)
    c1, c2 = f"0918.2012.{uid(4)}", f"0920.2024.{uid(4)}"
    rows = [
        ["BẢNG TÍNH KHẤU HAO TÀI SẢN"],
        ["01/01/2025 - 31/12/2025"],
        [],
        ["Stt", "Mã tài sản", "Tên tài sản", "Ngày sử dụng", "Vị trí", "Phòng ban", "Nguyên giá", "Tỷ lệ kh theo tháng", "Số tháng khấu hao", "Giá trị hao mòn lũy kế", "Giá trị còn lại", "Nguồn vốn"],
        [1, c1, "Máy đo thử", dt.datetime(2012, 12, 31), "KHO.TB", "Phòng  Thử   nghiệm", 17755900, 1.67, 60, 17755900, 0, "001"],
        [2, c2, "Thiết bị mới", dt.datetime(2024, 4, 15), "A5.309", "Khoa NN&VH Anh", 24360000, 1.67, 60, 1218000, 23142000, "002"],
        [3, "", "Thiếu mã", None, "", "Khoa NN&VH Anh", 1, 0, 0, 0, 0, ""],
        [None, "", "Tổng cộng", None, None, None, 42115900, None, None, None, None, None],
    ]
    r = await _import(client, h, _xlsx(rows))
    s = r.json()
    assert r.status_code == 200, r.text
    assert s["kind"] == "assets" and s["added"] == 2 and s["bookDate"] == "31/12/2025"
    assert s["groupsAdded"] == 1 and s["skipped"] == [{"row": 7, "reason": "Thiếu mã tài sản"}]
    await db.commit()
    a1 = (await db.execute(select(Asset).where(Asset.code == c1))).scalar_one()
    assert (a1.unit, a1.group_code, a1.residual_value, a1.last_interaction_date.isoformat()) == ("Phòng Thử nghiệm", "0918", 0, "2012-12-31")
    assert (await db.get(AssetGroup, "0920")).name == "Nhóm 0920"
    # Tài sản nằm kho từ ngày đưa vào sử dụng: Vàng 3.1
    view = (await client.get(f"{API}/assets/{a1.id}", headers=h)).json()
    assert view["light"]["code"] == "do_1_1" or view["light"]["warehouseMonths"] > 12
    # Nhập lại: không thêm trùng; đổi giá trị còn lại thì cập nhật
    rows[5][10] = 20000000
    s2 = (await _import(client, h, _xlsx(rows))).json()
    assert (s2["added"], s2["updated"], s2["unchanged"]) == (0, 1, 1)
    meta = (await client.get(f"{API}/meta", headers=h)).json()
    assert meta["assetBookDate"] == "31/12/2025" and meta["today"] == "2026-10-24"
    # Danh sách cán bộ
    st = await _import(client, h, _xlsx([["Mã số hiệu CBCCVC", "Họ tên", "Đơn vị", "Chức vụ hiện tại", "Ngày sinh"], ["ULIS9001", "Nguyễn Văn Nhập", "Khoa NN&VH Anh", "Giảng viên", "01/01/1980"]]))
    assert st.json()["kind"] == "staff" and st.json()["added"] == 1
    await db.commit()
    p = (await db.execute(select(Staff).where(Staff.staff_code == "ULIS9001"))).scalar_one()
    assert (p.name, p.group) == ("Nguyễn Văn Nhập", "canbo")
    # File không nhận ra
    bad = await _import(client, h, _xlsx([["A", "B"], [1, 2]]))
    assert bad.status_code == 400
    # Chỉ Phòng KHTC được nhập
    t = await Team().setup(db, client)
    assert (await _import(client, t.h_ktv, _xlsx(rows))).status_code == 403


async def test_so_viec_cho_tren_menu(client, db):
    t = await Team().setup(db, client)
    before = (await client.get(f"{API}/me/counts", headers=t.h_ktv)).json()["queue"]
    a = await make_asset(db)
    rep = await report(client, t, a)
    assert (await client.get(f"{API}/me/counts", headers=t.h_ktv)).json()["queue"] == before + 1
    ins = await inspect(client, t, rep, proposal="hong_toan_phan")
    c = (await client.get(f"{API}/me/counts", headers=t.h_leader)).json()
    assert c["approvals"] >= 1
    k = (await client.get(f"{API}/me/counts", headers=t.h_khtc)).json()
    assert set(k) == {"exceptions", "handovers", "proposals"}
    assert ins["code"].startswith("BB-")


async def test_danh_ba_tai_san_theo_vai_tro(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db)
    await report(client, t, a)
    full = (await client.get(f"{API}/refs", headers=t.h_ktv)).json()
    mine = (await client.get(f"{API}/refs", headers=t.h_canbo)).json()
    assert len(full["assets"]) >= len(mine["assets"]) >= 1
    assert {x["id"] for x in mine["assets"]} <= {x["id"] for x in full["assets"]}
    assert set(mine["assets"][0]["light"]) == {"code", "labels"}
    assert isinstance(mine["situations"], list) and mine["faultLists"][0]["groupCode"] == ""
