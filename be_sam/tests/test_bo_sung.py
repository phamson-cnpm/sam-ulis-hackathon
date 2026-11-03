
"""Các phần đề tài ghi mà bản mockup chưa thể hiện:
- tài sản chờ thanh lý giữ đèn đỏ sang năm mới cho đến khi Phòng KHTC quyết định thanh lý hoặc loại khỏi danh sách (mục 5.3);
- gộp phiếu trùng cùng một sự cố thành một lần (mục 5.3);
- sửa chi phí thực tế khi nhập nhầm, có truy vết (mục IV, 5.5);
- hóa đơn gộp nhiều mã: tổng các mã không vượt tổng hóa đơn (mục 5.5)."""
import datetime as dt
import io

from models import Estimate, EstimateHistory, EstimateLine
from tests.factory import Team, inspect, make_asset, report

API = "/api/v1"


async def old_estimate(db, asset, created: str, amount: int, status="da_ky_du"):
    """Phiếu dự toán đã có từ năm trước (dữ liệu nhập thẳng, không qua giao diện)."""
    e = Estimate(code=f"DT-CU-{asset.code[-5:]}-{created}", created_at=dt.date.fromisoformat(created), asset_id=asset.id, status=status)
    e.lines = [EstimateLine(sort=0, content="Thay linh kiện", cost_group="tinh", estimate=amount, actual=amount)]
    e.history = [EstimateHistory(at=dt.datetime.fromisoformat(created + "T08:00"), action="Lập dự toán")]
    db.add(e)
    await db.commit()
    return e


async def light(client, headers, asset):
    return (await client.get(f"{API}/assets/{asset.id}", headers=headers)).json()["light"]


async def upload(client, headers):
    r = await client.post(f"{API}/files", files={"file": ("ky.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")}, headers=headers)
    return r.json()["id"]


async def test_giu_do_sang_nam_moi_den_khi_khtc_loai_khoi_danh_sach(client, db):
    t = await Team().setup(db, client)
    # Đã hết hao mòn, năm 2025 sửa 25% nguyên giá: Đỏ 1.1 năm 2025, sang 2026 vẫn đỏ, khóa phiếu dự toán
    a = await make_asset(db, cost=10_000_000, residual=0, in_use="2015-01-05")
    await old_estimate(db, a, "2025-06-10", 2_500_000)
    l = await light(client, t.h_khtc, a)
    assert l["code"] == "do_1_1" and l["keptFrom"] == 2025 and l["locked"] is True
    assert l["labels"][:2] == ["Chờ thanh lý", "Giữ từ năm 2025"] and l["yearCount"] == 0

    url = f"{API}/assets/{a.id}/disposal-decision"
    # Chỉ Phòng KHTC quyết định; phải có căn cứ
    assert (await client.post(url, json={"decision": "loai_khoi_danh_sach", "basis": "x"}, headers=t.h_ktv)).status_code == 403
    r = await client.post(url, json={"decision": "loai_khoi_danh_sach", "basis": ""}, headers=t.h_khtc)
    assert r.status_code == 400 and r.json()["message"] == "Nhập căn cứ (số, ngày văn bản)"
    r = await client.post(url, json={"decision": "loai_khoi_danh_sach", "basis": "Biên bản họp 12/BB-KHTC ngày 20/10/2026", "note": "Còn dùng tốt"}, headers=t.h_khtc)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["asset"]["light"]["code"] == "xanh_la" and body["asset"]["disposalClearedAt"] == "2026-10-24"
    assert body["decision"]["lightBefore"] == "do_1_1"
    hist = (await client.get(f"{API}/assets/{a.id}/history", headers=t.h_khtc)).json()
    assert hist["disposalDecisions"][0]["basis"] == "Biên bản họp 12/BB-KHTC ngày 20/10/2026"
    # Không còn ở danh sách chờ thanh lý thì không quyết định lần nữa
    r = await client.post(url, json={"decision": "thanh_ly", "basis": "QĐ 1"}, headers=t.h_khtc)
    assert r.status_code == 400 and r.json()["message"] == "Tài sản không ở danh sách chờ thanh lý"
    notes = (await client.get(f"{API}/notifications", headers=t.h_ktv)).json()
    assert any("được loại khỏi danh sách chờ thanh lý" in n["text"] for n in notes)


async def test_do_theo_chi_phi_nam_nay_chi_chot_thanh_ly(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db, cost=10_000_000, residual=0, in_use="2015-01-05")
    await old_estimate(db, a, "2026-03-10", 2_500_000)
    assert (await light(client, t.h_khtc, a))["code"] == "do_1_1"
    url = f"{API}/assets/{a.id}/disposal-decision"
    r = await client.post(url, json={"decision": "loai_khoi_danh_sach", "basis": "BB 1"}, headers=t.h_khtc)
    assert r.status_code == 400 and r.json()["message"].startswith("Tài sản vẫn đèn đỏ theo chi phí sửa chữa năm 2026")
    r = await client.post(url, json={"decision": "thanh_ly", "basis": "QĐ 245/QĐ-ĐHNN ngày 22/10/2026"}, headers=t.h_khtc)
    assert r.status_code == 200, r.text
    v = r.json()["asset"]
    assert v["status"] == "da_thanh_ly" and v["light"]["code"] == "da_thanh_ly" and v["disposedAt"] == "2026-10-24"
    # Tài sản đã thanh lý: không tìm thấy khi báo hỏng, không báo hỏng được, lịch sử vẫn còn
    assert (await client.get(f"{API}/assets/search", params={"q": a.code}, headers=t.h_canbo)).json() == []
    r = await client.post(
        f"{API}/reports/batch",
        json={"reporterId": t.reporter.id, "phone": "", "items": [{"assetId": a.id, "location": a.location, "content": "Hỏng"}]},
        headers=t.h_canbo,
    )
    assert r.status_code == 400 and r.json()["message"] == f"Tài sản {a.code} đã thanh lý"
    hist = (await client.get(f"{API}/assets/{a.id}/history", headers=t.h_khtc)).json()
    assert len(hist["estimates"]) == 1 and hist["disposalDecisions"][0]["decision"] == "thanh_ly"


async def test_hu_hong_toan_phan_loai_khoi_danh_sach(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db)
    rep = await report(client, t, a)
    ins = await inspect(client, t, rep, proposal="hong_toan_phan")
    r = await client.post(f"{API}/inspections/{ins['id']}/total-loss", json={"approve": True, "leaderCode": t.leader_code}, headers=t.h_leader)
    assert r.status_code == 200, r.text
    assert (await light(client, t.h_khtc, a))["code"] == "do_1_2"
    r = await client.post(f"{API}/assets/{a.id}/disposal-decision", json={"decision": "loai_khoi_danh_sach", "basis": "Sửa được bằng linh kiện tận dụng"}, headers=t.h_khtc)
    assert r.status_code == 200 and r.json()["asset"]["light"]["code"] == "xanh_duong"


async def test_gop_phieu_trung_mot_su_co(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db)
    main = await report(client, t, a)
    dup = await report(client, t, a, urgent=True, situation="Đang thi")
    other = await make_asset(db)
    rep_other = await report(client, t, other)

    cands = (await client.get(f"{API}/reports/{dup['id']}/merge-candidates", headers=t.h_ktv)).json()
    assert [c["id"] for c in cands] == [main["id"]]
    r = await client.post(f"{API}/reports/{dup['id']}/merge", json={"mainId": rep_other["id"]}, headers=t.h_ktv)
    assert r.status_code == 400 and r.json()["message"] == "Hai phiếu khác mã tài sản"
    r = await client.post(f"{API}/reports/{dup['id']}/merge", json={"mainId": main["id"]}, headers=t.h_ktv)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["mergedIntoId"] == main["id"] and d["mergedIntoCode"] == main["code"] and d["status"] == "dang_xu_ly"
    case = (await client.get(f"{API}/reports/{main['id']}/case", headers=t.h_ktv)).json()
    assert case["report"]["status"] == "dang_xu_ly" and case["report"]["urgent"] is True  # phiếu trùng khẩn cấp thì phiếu chính khẩn cấp
    assert [m["id"] for m in case["merged"]] == [dup["id"]]
    assert (await client.post(f"{API}/reports/{dup['id']}/accept", headers=t.h_ktv)).status_code == 400
    # Người báo được báo; phiếu của mình hiện theo phiếu chính
    notes = (await client.get(f"{API}/notifications", headers=t.h_canbo)).json()
    assert any(n["text"] == f"Phiếu {dup['code']} trùng sự cố với phiếu {main['code']}, được gộp để xử lý một lần." for n in notes)

    # Bỏ gộp rồi gộp lại
    r = await client.post(f"{API}/reports/{dup['id']}/unmerge", headers=t.h_ktv)
    assert r.status_code == 200 and r.json()["mergedIntoId"] is None
    assert (await client.post(f"{API}/reports/{dup['id']}/merge", json={"mainId": main["id"]}, headers=t.h_ktv)).status_code == 200

    # Phiếu chính xử lý tại chỗ → phiếu trùng cũng hoàn thành, chỉ một biên bản
    await inspect(client, t, main, proposal="tai_cho")
    mine = {x["id"]: x for x in (await client.get(f"{API}/reports/mine", headers=t.h_canbo)).json()}
    assert mine[dup["id"]]["status"] == "hoan_thanh" and mine[dup["id"]]["mergedIntoCode"] == main["code"]
    notes = (await client.get(f"{API}/notifications", headers=t.h_canbo)).json()
    assert any(n["text"] == f"Phiếu {dup['code']} ({a.name}) đã xử lý xong cùng phiếu {main['code']}." for n in notes)
    hist = (await client.get(f"{API}/assets/{a.id}/history", headers=t.h_khtc)).json()
    assert len(hist["inspections"]) == 1
    # Phiếu đã có biên bản thì không gộp
    r = await client.post(f"{API}/reports/{rep_other['id']}/accept", headers=t.h_ktv)
    await inspect(client, t, rep_other)
    third = await report(client, t, other)
    r = await client.post(f"{API}/reports/{rep_other['id']}/merge", json={"mainId": third["id"]}, headers=t.h_ktv)
    assert r.status_code == 400 and r.json()["message"] == "Phiếu đã có biên bản kiểm tra, không gộp được"


async def _signed_estimate(client, t, asset, amount):
    rep = await report(client, t, asset)
    await client.post(f"{API}/reports/{rep['id']}/accept", headers=t.h_ktv)
    ins = await inspect(client, t, rep)
    body = {"assetId": asset.id, "inspectionId": ins["id"], "reportId": rep["id"], "lines": [{"content": "Thay mặt bàn", "costGroup": "tinh", "estimate": amount}]}
    est = (await client.post(f"{API}/estimates", json=body, headers=t.h_ktv)).json()["estimate"]
    assert (await client.post(f"{API}/estimates/{est['id']}/confirm", json={"leaderCode": t.leader_code}, headers=t.h_leader)).status_code == 200
    assert (await client.post(f"{API}/estimates/{est['id']}/signed", json={"fileId": await upload(client, t.h_ktv)}, headers=t.h_ktv)).status_code == 200
    return rep, est


async def test_hoa_don_gop_va_sua_chi_phi_nhap_nham(client, db):
    t = await Team().setup(db, client)
    assets =[await make_asset(db, group="0416") for _ in range(3)]
    ests = [await _signed_estimate(client, t, a, 1_000_000) for a in assets]

    def actual(i, amount, total=None, no="HĐ 0012345"):
        est = ests[i][1]
        body = {"actuals": {est["lines"][0]["id"]: amount}, "voucherNo": no, "voucherDate": "2026-10-20"}
        if total is not None:
            body["voucherTotal"] = total
        return client.post(f"{API}/estimates/{est['id']}/actual", json=body, headers=t.h_ktv)

    # Một hóa đơn 3.000.000 đ chia cho 3 mã tài sản
    assert (await actual(0, 1_200_000, total=3_000_000)).status_code == 200
    r = await actual(1, 2_000_000, no="hđ 0012345")  # cùng hóa đơn (khác hoa thường, khoảng trắng): lấy tổng đã nhập
    assert r.status_code == 400 and r.json()["message"] == "Tổng chi phí các mã cùng hóa đơn hđ 0012345 là 3.200.000 đ, vượt tổng hóa đơn 3.000.000 đ"
    assert (await actual(1, 900_000, no="hđ 0012345")).status_code == 200
    assert (await actual(2, 900_000)).status_code == 200
    rows = {e["id"]: e for e in (await client.get(f"{API}/estimates", headers=t.h_khtc)).json()}
    assert all(rows[e["id"]]["voucherTotal"] == 3_000_000 for _, e in ests)

    # Nhập nhầm: sửa lại số thực tế, lưu lịch sử, đèn tính lại; không được vượt tổng hóa đơn
    est = ests[0][1]
    url = f"{API}/estimates/{est['id']}/actual/correct"
    line = est["lines"][0]["id"]
    r = await client.post(url, json={"actuals": {line: 1_300_000}, "voucherNo": "HĐ 0012345", "voucherDate": "2026-10-20"}, headers=t.h_ktv)
    assert r.status_code == 400
    r = await client.post(url, json={"actuals": {line: 1_100_000}, "voucherNo": "HĐ 0012345", "voucherDate": "2026-10-20", "note": "Nhập nhầm đơn giá"}, headers=t.h_ktv)
    assert r.status_code == 200, r.text
    assert (await client.post(url, json={"actuals": {line: 1}, "voucherNo": "x"}, headers=t.h_khtc)).status_code == 403
    case = (await client.get(f"{API}/reports/{ests[0][0]['id']}/case", headers=t.h_ktv)).json()
    h = case["estimate"]["history"][-1]
    assert h["action"] == "Sửa chi phí thực tế" and h["by"] == t.ktv.id
    assert h["note"] == "Thực tế 1.200.000 đ thành 1.100.000 đ; Nhập nhầm đơn giá"
    assert case["asset"]["light"]["yearCost"] == 1_100_000
    # Chưa nhập thực tế thì chưa sửa được
    rep4, est4 = await _signed_estimate(client, t, await make_asset(db), 500_000)
    r = await client.post(f"{API}/estimates/{est4['id']}/actual/correct", json={"actuals": {}, "voucherNo": "HĐ 9"}, headers=t.h_ktv)
    assert r.status_code == 400 and r.json()["message"] == "Chưa nhập chi phí thực tế"
