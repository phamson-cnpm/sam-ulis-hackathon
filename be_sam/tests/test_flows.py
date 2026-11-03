
"""Luồng hồ sơ theo đề tài, cùng quy tắc với bản demo fe_sam (mockApi.js):
báo hỏng → biên bản → dự toán → lãnh đạo xác nhận (nhập lại mã) → ký đủ → chi phí thực tế;
khóa phiếu dự toán và đề nghị ngoại lệ; thiết bị tạm chỉ khi khẩn cấp; hư hỏng toàn phần; thu hồi về kho 5 bước."""
import io

from sqlalchemy import select

from models import Asset, Notification, Report
from tests.factory import Team, inspect, make_asset, report

API = "/api/v1"


async def upload(client, headers, name="ban_quet.pdf"):
    r = await client.post(f"{API}/files", files={"file": (name, io.BytesIO(b"%PDF-1.4 test"), "application/pdf")}, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


async def test_bao_nhieu_tai_san_mot_lan_tach_moi_ma_mot_phieu(client, db):
    t = await Team().setup(db, client)
    a1, a2 = await make_asset(db), await make_asset(db, group="0416")
    r = await client.post(
        f"{API}/reports/batch",
        json={
            "reporterId": t.reporter.id,
            "phone": "0988 777 666",
            "items": [
                {"assetId": a1.id, "location": a1.location, "content": "Không lên hình", "situation": "", "urgent": False},
                {"assetId": a2.id, "location": a2.location, "content": "Không mát", "situation": "Đang thi", "urgent": True},
                {"assetId": None, "assetName": "Bàn học bị gãy chân", "location": "B1.101", "content": "Gãy chân", "situation": "", "urgent": False},
            ],
        },
        headers=t.h_canbo,
    )
    body = r.json()
    assert r.status_code == 200 and body["batchCode"].startswith("DOT-")
    reps = body["reports"]
    assert len(reps) == 3 and len({x["code"] for x in reps}) == 3
    assert all(x["code"].startswith("PH-2026-") and x["batchCode"] == body["batchCode"] for x in reps)
    assert all(x["status"] == "da_gui" and x["reporterName"] == t.reporter.name for x in reps)
    # Kỹ thuật viên nhận thông báo, có chữ "Khẩn cấp"
    notes = (await client.get(f"{API}/notifications", headers=t.h_ktv)).json()
    assert any(n["text"].startswith("Khẩn cấp: ") and body["batchCode"] in n["text"] for n in notes)
    # Số điện thoại mới cập nhật vào dữ liệu cán bộ
    await db.commit()
    await db.refresh(t.reporter)
    assert t.reporter.phone == "0988 777 666"
    # Cán bộ thấy phiếu của mình; tài sản đã có phiếu đang mở thì cảnh báo báo trùng
    mine = (await client.get(f"{API}/reports/mine", headers=t.h_canbo)).json()
    assert {x["id"] for x in reps} <= {x["id"] for x in mine}
    hit = (await client.get(f"{API}/assets/search", params={"q": a1.code}, headers=t.h_canbo)).json()
    assert hit[0]["openReport"]["code"] == reps[0]["code"]
    assert "yearCost" not in hit[0]["light"]  # cán bộ không nhận số liệu chi phí


async def test_du_toan_lanh_dao_xac_nhan_bang_ma_ky_du_chi_phi_thuc_te(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db)
    rep = await report(client, t, a)
    assert (await client.post(f"{API}/reports/{rep['id']}/accept", headers=t.h_ktv)).status_code == 200
    ins = await inspect(client, t, rep)
    prev = (await client.post(f"{API}/assets/{a.id}/preview-light", json={"draftLines": [{"costGroup": "tinh", "estimate": 2_000_000}]}, headers=t.h_ktv)).json()
    assert prev["after"]["yearCost"] == 2_000_000 and prev["after"]["provisional"] is True
    lines = [
        {"content": "Thay bo nguồn", "costGroup": "tinh", "estimate": 2_000_000},
        {"content": "Vệ sinh", "costGroup": "khong_tinh", "estimate": 300_000},
    ]
    r = await client.post(f"{API}/estimates", json={"assetId": a.id, "inspectionId": ins["id"], "reportId": rep["id"], "lines": lines}, headers=t.h_ktv)
    est = r.json()["estimate"]
    assert r.status_code == 200 and est["status"] == "cho_lanh_dao" and est["locked"] is False and est["code"].startswith("DT-")
    assert [h["action"] for h in est["history"]] == ["Lập dự toán"]

    # Lãnh đạo nhập sai mã thì báo lỗi; nhập mã của người khác cũng không được
    bad = await client.post(f"{API}/estimates/{est['id']}/confirm", json={"leaderCode": t.ktv_code}, headers=t.h_leader)
    assert bad.status_code == 400 and bad.json()["message"] == "Mã xác nhận của lãnh đạo không đúng"
    # Trả lại kèm lý do → kỹ thuật viên sửa, gửi lại trên chính phiếu đó
    assert (await client.post(f"{API}/estimates/{est['id']}/return", json={"reason": "Xem lại đơn giá"}, headers=t.h_leader)).status_code == 200
    assert (await client.post(f"{API}/estimates/{est['id']}/resubmit", json={"lines": lines[:1]}, headers=t.h_ktv)).status_code == 200
    ok = await client.post(f"{API}/estimates/{est['id']}/confirm", json={"leaderCode": t.leader_code}, headers=t.h_leader)
    assert ok.status_code == 200, ok.text

    f = await upload(client, t.h_ktv)
    assert (await client.post(f"{API}/estimates/{est['id']}/signed", json={"fileId": f["id"]}, headers=t.h_ktv)).status_code == 200
    case = (await client.get(f"{API}/reports/{rep['id']}/case", headers=t.h_ktv)).json()
    e = case["estimate"]
    assert e["status"] == "da_ky_du" and e["signedScan"] == "ban_quet.pdf" and e["canEnterActual"] == {"ok": True}
    assert [h["action"] for h in e["history"]] == ["Lập dự toán", "Trả lại", "Sửa và gửi lại", "Xác nhận dự toán", "Đính kèm bản đã ký đủ"]

    line_id = e["lines"][0]["id"]
    r = await client.post(f"{API}/estimates/{est['id']}/actual", json={"actuals": {line_id: 1_800_000}, "voucherNo": "HĐ 15/2026", "voucherDate": "2026-10-24"}, headers=t.h_ktv)
    assert r.status_code == 200, r.text
    case = (await client.get(f"{API}/reports/{rep['id']}/case", headers=t.h_ktv)).json()
    assert case["report"]["status"] == "hoan_thanh" and case["estimate"]["lines"][0]["actual"] == 1_800_000
    assert case["asset"]["light"]["yearCost"] == 1_800_000 and case["asset"]["light"]["provisional"] is False
    # Người báo nhận thông báo đã xử lý xong
    notes = (await client.get(f"{API}/notifications", headers=t.h_canbo)).json()
    assert any(n["text"] == f"Phiếu {rep['code']} ({a.name}) đã xử lý xong." for n in notes)


async def test_khong_tu_xac_nhan_phieu_do_minh_lap(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db)
    rep = await report(client, t, a)
    # Lãnh đạo không có quyền lập dự toán (chỉ kỹ thuật viên)
    r = await client.post(f"{API}/estimates", json={"assetId": a.id, "reportId": rep["id"], "lines": [{"content": "x", "costGroup": "tinh", "estimate": 1}]}, headers=t.h_leader)
    assert r.status_code == 403


async def test_khoa_phieu_du_toan_va_de_nghi_ngoai_le(client, db):
    t = await Team().setup(db, client)
    # Đã hết hao mòn: chi phí trong năm chạm 20% nguyên giá thì Đỏ 1.1, khóa phiếu dự toán
    a = await make_asset(db, cost=10_000_000, residual=0, in_use="2015-03-01")
    rep = await report(client, t, a)
    ins = await inspect(client, t, rep)
    body = {"assetId": a.id, "inspectionId": ins["id"], "reportId": rep["id"], "lines": [{"content": "Thay main", "costGroup": "tinh", "estimate": 2_500_000}]}
    locked = await client.post(f"{API}/estimates", json=body, headers=t.h_ktv)
    assert locked.status_code == 400 and locked.json()["message"] == "Tài sản bị khóa phiếu dự toán: cần lập đề nghị ngoại lệ"
    r = await client.post(f"{API}/estimates", json={**body, "exception": {"reason": "Máy duy nhất phục vụ thi", "extraTime": "Đến hết học kỳ", "tempEquipment": "Không có"}}, headers=t.h_ktv)
    est, exc = r.json()["estimate"], r.json()["exception"]
    assert est["locked"] is True and est["lightAfter"] == "do_1_1" and exc["status"] == "cho_mo_khoa"
    khtc_notes = (await client.get(f"{API}/notifications", headers=t.h_khtc)).json()
    assert any(exc["code"] in n["text"] for n in khtc_notes)
    # Ký đủ nhưng chưa mở khóa thì chưa nhập chi phí thực tế
    await client.post(f"{API}/estimates/{est['id']}/confirm", json={"leaderCode": t.leader_code}, headers=t.h_leader)
    f = (await client.post(f"{API}/files", files={"file": ("ky.pdf", io.BytesIO(b"x"), "application/pdf")}, headers=t.h_ktv)).json()
    await client.post(f"{API}/estimates/{est['id']}/signed", json={"fileId": f["id"]}, headers=t.h_ktv)
    case = (await client.get(f"{API}/reports/{rep['id']}/case", headers=t.h_ktv)).json()
    assert case["estimate"]["canEnterActual"] == {"ok": False, "reason": "Chờ Phòng KHTC mở khóa theo văn bản phê duyệt"}
    # Phòng KHTC mở khóa theo văn bản, đính kèm bản quét
    scan = (await client.post(f"{API}/files", files={"file": ("vb.pdf", io.BytesIO(b"x"), "application/pdf")}, headers=t.h_khtc)).json()
    d = await client.post(f"{API}/exceptions/{exc['id']}/decide", json={"approve": True, "docNo": "130/ĐHNN-KHTC", "docDate": "2026-10-24", "conclusion": "Đồng ý", "fileId": scan["id"]}, headers=t.h_khtc)
    assert d.status_code == 200, d.text
    case = (await client.get(f"{API}/reports/{rep['id']}/case", headers=t.h_ktv)).json()
    assert case["exception"]["status"] == "da_mo_khoa" and case["exception"]["scanFile"] == "vb.pdf"
    assert case["estimate"]["canEnterActual"] == {"ok": True}
    assert case["estimate"]["history"][-1]["action"] == "Mở khóa theo 130/ĐHNN-KHTC"


async def test_thiet_bi_tam_chi_khi_khan_cap(client, db):
    t = await Team().setup(db, client)
    a, spare = await make_asset(db), await make_asset(db, location="KHO.TB", unit="Phòng Quản trị nguồn lực")
    normal = await report(client, t, a)
    for path, body in (
        ("temp-transfers", {"reportId": normal["id"], "replacementAssetId": spare.id, "receiverName": "Người A"}),
        ("no-spares", {"reportId": normal["id"], "need": "Máy chiếu", "reason": "Kho hết"}),
    ):
        r = await client.post(f"{API}/{path}", json=body, headers=t.h_ktv)
        assert r.status_code == 400 and r.json()["message"] == "Chỉ cấp thiết bị tạm khi phiếu khẩn cấp"
    a2 = await make_asset(db)
    urgent = await report(client, t, a2, urgent=True, situation="Đang thi")
    r = await client.post(f"{API}/temp-transfers", json={"reportId": urgent["id"], "originalAssetId": a2.id, "replacementAssetId": spare.id, "source": "kho_qtnl", "useLocation": "A2.201", "receiverName": "Người A", "receiverUnit": "Khoa NN&VH Anh", "issuedAt": "2026-10-24T08:15"}, headers=t.h_ktv)
    assert r.status_code == 200 and r.json()["code"].startswith("DC-TT-")
    ns = await client.post(f"{API}/no-spares", json={"reportId": urgent["id"], "need": "Micro", "reason": "Kho hết micro"}, headers=t.h_ktv)
    assert ns.status_code == 200 and ns.json()["groupCode"] == "0404"
    case = (await client.get(f"{API}/reports/{urgent['id']}/case", headers=t.h_ktv)).json()
    assert case["report"]["hasTempEquipment"] is True and case["report"]["status"] == "dang_xu_ly"
    assert len(case["temps"]) == 1 and len(case["noSpares"]) == 1


async def test_hu_hong_toan_phan_thu_hoi_ve_kho_5_buoc(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db, cost=15_000_000, residual=6_000_000)
    rep = await report(client, t, a)
    ins = await inspect(client, t, rep, proposal="hong_toan_phan")
    assert ins["totalLossStatus"] == "cho_xac_minh"
    pend = (await client.get(f"{API}/inspections/pending-total-loss", headers=t.h_leader)).json()
    assert ins["id"] in {i["id"] for i in pend}
    view = (await client.get(f"{API}/assets/{a.id}", headers=t.h_ktv)).json()
    assert "Chờ xác minh" in view["light"]["labels"]
    # Xác nhận phải nhập lại mã của chính lãnh đạo
    r = await client.post(f"{API}/inspections/{ins['id']}/total-loss", json={"approve": True, "leaderCode": t.leader_code}, headers=t.h_leader)
    assert r.status_code == 200, r.text
    view = (await client.get(f"{API}/assets/{a.id}", headers=t.h_ktv)).json()
    assert view["light"]["code"] == "do_1_2"
    light_before = view["light"]["code"]

    elig = (await client.get(f"{API}/recalls/eligibility/{rep['id']}", headers=t.h_ktv)).json()
    assert elig["ok"] is True and elig["basis"] == "hong_toan_phan"
    pending = (await client.get(f"{API}/recalls/pending", headers=t.h_ktv)).json()
    assert rep["id"] in {p["report"]["id"] for p in pending}
    # Đề tài mục VII: đề nghị thu hồi do kỹ thuật viên lập; lãnh đạo Phòng QTNL không lập
    lead = await client.post(f"{API}/recalls", json={"reportId": rep["id"], "plan": "cho_thanh_ly"}, headers=t.h_leader)
    assert lead.status_code == 403
    rec = (await client.post(f"{API}/recalls", json={"reportId": rep["id"], "plan": "cho_thanh_ly", "toLocation": "KHO.TB"}, headers=t.h_ktv)).json()
    assert rec["status"] == "cho_khtc"
    dup = await client.post(f"{API}/recalls", json={"reportId": rep["id"], "plan": "cho_thanh_ly"}, headers=t.h_ktv)
    assert dup.status_code == 400  # không đề nghị trùng
    assert (await client.post(f"{API}/recalls/{rec['id']}/decide", json={"approve": True}, headers=t.h_khtc)).status_code == 200
    h = await client.post(f"{API}/recalls/{rec['id']}/handover", json={"date": "2026-10-24", "givers": [{"name": "Người A", "unit": a.unit}], "receivers": [{"name": "Người B", "unit": "Phòng Quản trị nguồn lực"}], "note": "Chờ thanh lý"}, headers=t.h_ktv)
    assert h.status_code == 200 and h.json()["kind"] == "thu_hoi"
    # Biên bản giao nhận chưa đổi sổ
    await db.commit()
    await db.refresh(a)
    assert a.unit == "Khoa NN&VH Anh"
    # Bước 4: nhập điều chuyển khi chưa có số văn bản, bản quét (đính kèm sau)
    assert (await client.post(f"{API}/recalls/{rec['id']}/complete", json={"transferNo": "", "transferDate": "2026-10-24"}, headers=t.h_khtc)).status_code == 200
    view = (await client.get(f"{API}/assets/{a.id}", headers=t.h_ktv)).json()
    assert view["status"] == "thu_hoi_kho" and view["location"] == "KHO.TB" and view["unit"] == "Phòng Quản trị nguồn lực"
    assert view["light"]["code"] == light_before
    assert view["light"]["labels"][0] == "Hỏng, đã thu hồi về kho, chờ phương án xử lý"
    scan = (await client.post(f"{API}/files", files={"file": ("bb_ky.pdf", io.BytesIO(b"x"), "application/pdf")}, headers=t.h_khtc)).json()
    assert (await client.post(f"{API}/recalls/{rec['id']}/attach", json={"transferNo": "452/ĐHNN-KHTC", "fileId": scan["id"]}, headers=t.h_khtc)).status_code == 200
    recs = (await client.get(f"{API}/recalls", headers=t.h_khtc)).json()
    done = next(r for r in recs if r["id"] == rec["id"])
    assert done["status"] == "hoan_thanh" and done["transferNo"] == "452/ĐHNN-KHTC"
    hos = (await client.get(f"{API}/handovers", headers=t.h_khtc)).json()
    assert next(x for x in hos if x["recallId"] == rec["id"])["scanFile"] == "bb_ky.pdf"
    # Hồ sơ in: biên bản bàn giao
    d = (await client.get(f"{API}/forms/handover/{h.json()['id']}", headers=t.h_khtc)).json()
    assert d["handoverAssets"][0]["code"] == a.code


async def test_khtc_khong_dong_y_thi_de_nghi_lai_duoc(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db)
    rep = await report(client, t, a)
    ins = await inspect(client, t, rep, proposal="hong_toan_phan")
    await client.post(f"{API}/inspections/{ins['id']}/total-loss", json={"approve": True, "leaderCode": t.leader_code}, headers=t.h_leader)
    rec = (await client.post(f"{API}/recalls", json={"reportId": rep["id"], "plan": "sua_sau"}, headers=t.h_ktv)).json()
    await client.post(f"{API}/recalls/{rec['id']}/decide", json={"approve": False, "reason": "Đơn vị còn cần dùng"}, headers=t.h_khtc)
    elig = (await client.get(f"{API}/recalls/eligibility/{rep['id']}", headers=t.h_ktv)).json()
    assert elig["ok"] is True


async def test_ban_giao_cap_phat_cap_nhat_don_vi_vi_tri(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db, unit="Phòng Quản trị nguồn lực", location="KHO.TB")
    r = await client.post(f"{API}/handovers", json={"kind": "dieu_chuyen", "date": "2026-10-24", "giverUnit": a.unit, "givers": [{"name": "A", "unit": a.unit}], "receiverUnit": "Khoa NN&VH Pháp", "receivers": [{"name": "B", "unit": "Khoa NN&VH Pháp"}], "place": "A2.305", "items": [{"assetId": a.id, "uom": "Cái", "qty": 1, "note": ""}], "transferNo": "452/ĐHNN-KHTC"}, headers=t.h_khtc)
    assert r.status_code == 200 and r.json()["code"].startswith("BG-")
    await db.commit()
    await db.refresh(a)
    assert (a.unit, a.location, a.last_interaction_date.isoformat()) == ("Khoa NN&VH Pháp", "A2.305", "2026-10-24")
    empty = await client.post(f"{API}/handovers", json={"kind": "cap_phat", "items": []}, headers=t.h_khtc)
    assert empty.status_code == 400


async def test_tai_san_tieu_huy_khi_bao_hong_cap_nhat_ngay_tuong_tac(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db, in_use="2020-01-01")
    await report(client, t, a)
    a2 = (await db.execute(select(Asset).where(Asset.id == a.id).execution_options(populate_existing=True))).scalar_one()
    assert a2.last_interaction_date.isoformat() == "2026-10-24"
    n = (await db.execute(select(Notification))).scalars().all()
    assert n
    assert (await db.execute(select(Report).where(Report.asset_id == a.id))).scalar_one()
