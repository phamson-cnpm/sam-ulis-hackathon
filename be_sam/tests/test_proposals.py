"""Cột Đề xuất và luồng duyệt đề xuất xử lý tài sản (mục 5.6, 5.8 đề tài); Không duyệt bắt buộc lý do
(cả đề nghị ngoại lệ); thông báo đẩy về điện thoại (mục 5.9)."""
import asyncio

from sqlalchemy import select

from config import settings
from models import Notification, Proposal, PushSubscription
from tests.factory import QTNL_UNIT, Team, as_focal, inspect, make_asset, person, report, uid

API = "/api/v1"


def no_code(h):
    return {k: v for k, v in h.items() if k != "X-Confirm-Code"}


async def notes(client, h):
    return (await client.get(f"{API}/notifications", headers=h)).json()


async def test_dau_moi_gui_danh_sach_de_xuat_thanh_ly(client, db):
    t = await Team().setup(db, client)
    unit = f"Khoa Đề xuất {uid(3)}"
    a1 = await make_asset(db, unit=unit, name="Điều hòa cũ")
    a2 = await make_asset(db, unit=unit, name="Máy chiếu cũ")
    other = await make_asset(db, unit="Khoa NN&VH Pháp")
    p, f, hf = await as_focal(db, client, unit)

    body = {"kind": "thanh_ly", "items": [{"assetId": a1.id, "reason": "Hết hao mòn, sửa nhiều lần"}, {"assetId": a2.id, "reason": "Hư hỏng không sửa được"}]}
    # Thiếu mã xác nhận: 428 để giao diện hỏi mã
    r = await client.post(f"{API}/proposals", json=body, headers=no_code(hf))
    assert r.status_code == 428 and r.json()["reason"] == "code_required"
    # Tài sản đơn vị khác: không đề xuất được
    r = await client.post(f"{API}/proposals", json={"kind": "thanh_ly", "items": [{"assetId": other.id, "reason": "x"}]}, headers=hf)
    assert r.status_code == 403
    # Thiếu lý do
    r = await client.post(f"{API}/proposals", json={"kind": "thanh_ly", "items": [{"assetId": a1.id}]}, headers=hf)
    assert r.status_code == 400
    r = await client.post(f"{API}/proposals", json=body, headers=hf)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["batchCode"].startswith("DSDX-") and len(out["proposals"]) == 2
    d1 = next(x for x in out["proposals"] if x["assetId"] == a1.id)
    assert d1["code"].startswith("DX-") and d1["status"] == "cho_lanh_dao" and d1["statusLabel"] == "Chờ lãnh đạo duyệt"
    # Mỗi tài sản một đề xuất đang xử lý
    dup = await client.post(f"{API}/proposals", json={"kind": "dieu_chuyen", "items": [{"assetId": a1.id, "reason": "x"}]}, headers=hf)
    assert dup.status_code == 400 and d1["code"] in dup.json()["message"]
    # Lãnh đạo Phòng QTNL nhận thông báo, có liên kết mở đúng màn hình
    n = next(n for n in await notes(client, t.h_leader) if out["batchCode"] in n["text"])
    assert n["link"] == "approvals:proposals" and "chờ duyệt" in n["text"]
    # Cột Đề xuất ở danh sách tài sản (Phòng QTNL, Phòng KHTC) và của đầu mối
    full = {x["id"]: x for x in (await client.get(f"{API}/assets", headers=t.h_khtc)).json()}
    assert full[a1.id]["proposal"]["code"] == d1["code"] and full[a1.id]["proposal"]["kindLabel"] == "Thanh lý"
    mine = {x["id"]: x for x in (await client.get(f"{API}/focal/assets", headers=hf)).json()}
    assert mine[a1.id]["proposal"]["status"] == "cho_lanh_dao" and mine[other.id]["proposal"] is None
    # Đầu mối xem đề xuất của đơn vị mình
    lst = (await client.get(f"{API}/proposals", headers=hf)).json()
    assert {x["assetId"] for x in lst} == {a1.id, a2.id}
    # Cán bộ không xem
    assert (await client.get(f"{API}/proposals", headers=t.h_canbo)).status_code == 403


async def test_luong_duyet_ky_thuat_xem_xet_khtc_tiep_nhan(client, db):
    t = await Team().setup(db, client)
    unit = f"Khoa Luồng {uid(3)}"
    a = await make_asset(db, unit=unit)
    p, f, hf = await as_focal(db, client, unit)
    d = (await client.post(f"{API}/proposals", json={"kind": "thanh_ly", "items": [{"assetId": a.id, "reason": "Máy chậm, đã dùng 9 năm"}]}, headers=hf)).json()["proposals"][0]
    url = f"{API}/proposals/{d['id']}"

    # Không duyệt bắt buộc lý do; lãnh đạo nhập mã xác nhận
    r = await client.post(f"{url}/decide", json={"action": "khong_duyet"}, headers=t.h_leader)
    assert r.status_code == 400 and r.json()["message"] == "Nhập lý do không duyệt"
    r = await client.post(f"{url}/decide", json={"action": "duyet"}, headers=no_code(t.h_leader))
    assert r.status_code == 428
    # Kỹ thuật viên không quyết định thay lãnh đạo
    assert (await client.post(f"{url}/decide", json={"action": "duyet"}, headers=t.h_ktv)).status_code == 403

    # Cần kỹ thuật xem xét: chọn kỹ thuật viên
    bad = await client.post(f"{url}/decide", json={"action": "ky_thuat", "techId": t.reporter.id}, headers=t.h_leader)
    assert bad.json()["message"] == "Chọn kỹ thuật viên xem xét"
    r = await client.post(f"{url}/decide", json={"action": "ky_thuat", "techId": t.ktv.id}, headers=t.h_leader)
    assert r.json()["status"] == "cho_ky_thuat"
    assert any(d["code"] in n["text"] and n["link"] == f"proposals:{d['id']}" for n in await notes(client, t.h_ktv))
    # Kỹ thuật viên khác không ghi ý kiến thay
    other_ktv, h2 = await person(db, client, "ktv", QTNL_UNIT, code=f"QT-{uid(4)}")
    assert (await client.post(f"{url}/tech", json={"opinion": "dong_y"}, headers=h2)).status_code == 403
    assert (await client.post(f"{url}/tech", json={"opinion": "khong_dong_y"}, headers=t.h_ktv)).status_code == 400  # thiếu nhận xét
    r = await client.post(f"{url}/tech", json={"opinion": "khong_dong_y", "note": "Máy ổn định, nâng RAM 8 GB"}, headers=t.h_ktv)
    assert r.json()["status"] == "cho_lanh_dao" and r.json()["techOpinion"] == "khong_dong_y"
    assert any("Đã có ý kiến kỹ thuật" in n["text"] for n in await notes(client, t.h_leader))

    # Không duyệt: lý do hiện ở cột Đề xuất và gửi kèm thông báo cho người đề xuất
    reason = "Tài sản còn sử dụng tốt theo ý kiến kỹ thuật"
    r = await client.post(f"{url}/decide", json={"action": "khong_duyet", "reason": reason}, headers=t.h_leader)
    assert r.json()["status"] == "khong_duyet" and r.json()["decisionNote"] == reason
    assert any(n["text"].endswith(f"Lý do: {reason}") for n in await notes(client, hf))
    cell = next(x for x in (await client.get(f"{API}/focal/assets", headers=hf)).json() if x["id"] == a.id)["proposal"]
    assert cell["status"] == "khong_duyet" and cell["decisionNote"] == reason
    full = (await client.get(url, headers=t.h_khtc)).json()
    assert [h["action"] for h in full["history"]] == [
        "Gửi đề xuất", f"Cần kỹ thuật xem xét, giao {t.ktv.name}", "Ý kiến kỹ thuật: Không đồng ý", "Không duyệt",
    ]

    # Có căn cứ mới thì lập đề xuất khác; lần này duyệt, Phòng KHTC tiếp nhận
    d2 = (await client.post(f"{API}/proposals", json={"kind": "thay_the", "items": [{"assetId": a.id, "reason": "Đưa vào kế hoạch mua sắm 2028"}]}, headers=hf)).json()["proposals"][0]
    r = await client.post(f"{API}/proposals/{d2['id']}/decide", json={"action": "duyet"}, headers=t.h_leader)
    assert r.json()["status"] == "da_duyet"
    assert (await client.get(f"{API}/me/counts", headers=t.h_khtc)).json()["proposals"] >= 1
    assert any(d2["code"] in n["text"] for n in await notes(client, t.h_khtc))
    r = await client.post(f"{API}/proposals/khtc", json={"action": "tiep_nhan", "ids": [d2["id"]]}, headers=t.h_khtc)
    assert r.status_code == 200 and r.json()[0]["status"] == "khtc_tiep_nhan"
    assert any(f"Phòng KHTC đã tiếp nhận đề xuất {d2['code']}" in n["text"] for n in await notes(client, hf))
    # Ban Giám hiệu không đồng ý: Phòng KHTC ghi Không duyệt, bắt buộc lý do
    assert (await client.post(f"{API}/proposals/khtc", json={"action": "khong_duyet", "ids": [d2["id"]]}, headers=t.h_khtc)).status_code == 400
    r = await client.post(f"{API}/proposals/khtc", json={"action": "khong_duyet", "ids": [d2["id"]], "reason": "Chưa bố trí được kinh phí"}, headers=t.h_khtc)
    assert r.json()[0]["status"] == "khong_duyet"


async def test_ky_thuat_vien_de_xuat_lanh_dao_khong_tu_duyet(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db, location="KHO.TB", unit=QTNL_UNIT, in_use="2024-01-05")
    rows = {x["id"]: x for x in (await client.get(f"{API}/assets", headers=t.h_ktv)).json()}
    assert rows[a.id]["light"]["code"] == "vang_3_1"
    assert rows[a.id]["suggestion"] == {"kind": "dieu_chuyen", "text": "Điều chuyển"}  # gợi ý theo màu đèn
    r = await client.post(f"{API}/proposals", json={"kind": "dieu_chuyen", "reason": "Nằm kho 12 tháng", "assetIds": [a.id]}, headers=t.h_ktv)
    assert r.status_code == 200 and r.json()["batchCode"] is None
    pid = r.json()["proposals"][0]["id"]
    # Lãnh đạo không lập đề xuất; không tự duyệt đề xuất do chính mình lập
    assert (await client.post(f"{API}/proposals", json={"kind": "thanh_ly", "reason": "x", "assetIds": [a.id]}, headers=t.h_leader)).status_code == 403
    prop = await db.get(Proposal, pid)
    prop.created_by = t.leader.id
    await db.commit()
    r = await client.post(f"{API}/proposals/{pid}/decide", json={"action": "duyet"}, headers=t.h_leader)
    assert r.json()["message"] == "Không tự duyệt đề xuất do chính mình lập"
    # Đề xuất không làm đổi màu đèn
    rows = {x["id"]: x for x in (await client.get(f"{API}/assets", headers=t.h_ktv)).json()}
    assert rows[a.id]["light"]["code"] == "vang_3_1"


async def test_khong_dong_y_mo_khoa_bat_buoc_ly_do(client, db):
    t = await Team().setup(db, client)
    a = await make_asset(db, residual=0)
    rep = await report(client, t, a)
    ins = await inspect(client, t, rep)
    body = {"assetId": a.id, "inspectionId": ins["id"], "reportId": rep["id"], "lines": [{"content": "Thay bo mạch", "costGroup": "tinh", "estimate": 6_000_000}]}
    est = (await client.post(f"{API}/estimates", json={**body, "exception": {"reason": "Phục vụ thi", "extraTime": "", "tempEquipment": ""}}, headers=t.h_ktv)).json()
    exc = est["exception"]
    url = f"{API}/exceptions/{exc['id']}/decide"
    r = await client.post(url, json={"approve": False, "docNo": "131/ĐHNN-KHTC"}, headers=t.h_khtc)
    assert r.status_code == 400 and r.json()["message"] == "Nhập lý do không duyệt"
    r = await client.post(url, json={"approve": False, "docNo": "131/ĐHNN-KHTC", "conclusion": "Đề nghị thanh lý, mua mới"}, headers=t.h_khtc)
    assert r.status_code == 200
    n = next(n for n in await notes(client, t.h_ktv) if exc["code"] in n["text"])
    assert n["text"].endswith("Lý do: Đề nghị thanh lý, mua mới") and n["link"] == f"case:{rep['id']}"


async def test_thong_bao_day_bat_tat_va_gui(client, db, monkeypatch):
    """Nút chuông: bật thông báo về máy này; có phiếu mới thì máy chủ gửi bản ngắn (không số điện thoại) tới thiết bị
    của kỹ thuật viên; thiết bị đã gỡ quyền (410) thì tự xóa đăng ký."""
    from services import push_service

    t = await Team().setup(db, client)
    assert (await client.get(f"{API}/push/config", headers=t.h_ktv)).json() == {"enabled": False, "publicKey": None}
    monkeypatch.setattr(settings, "PUSH_ENABLED", True)
    cfg = (await client.get(f"{API}/push/config", headers=t.h_ktv)).json()
    assert cfg["enabled"] and len(cfg["publicKey"]) == 87  # khóa công khai VAPID (P-256, base64url)
    assert (await client.get(f"{API}/push/config", headers=t.h_leader)).json()["publicKey"] == cfg["publicKey"]  # khóa giữ nguyên

    sent = []

    def fake_send(sub, data, key):
        sent.append((sub["endpoint"], data))
        return 410 if "gone" in sub["endpoint"] else None

    monkeypatch.setattr(push_service, "_send", fake_send)
    ep = f"https://fcm.googleapis.com/fcm/send/{uid(8)}"
    gone = f"https://updates.push.services.mozilla.com/gone/{uid(8)}"
    keys = {"p256dh": "BNc" + "x" * 84, "auth": "a" * 22}
    assert (await client.post(f"{API}/push/subscribe", json={"endpoint": "http://x", "keys": keys}, headers=t.h_ktv)).status_code == 400
    assert (await client.post(f"{API}/push/subscribe", json={"subscription": {"endpoint": ep, "keys": keys}}, headers=t.h_ktv)).json() == {"on": True}
    await client.post(f"{API}/push/subscribe", json={"endpoint": gone, "keys": keys}, headers=t.h_ktv)
    assert (await client.post(f"{API}/push/status", json={"endpoint": ep}, headers=t.h_ktv)).json() == {"on": True}
    assert (await client.post(f"{API}/push/status", json={"endpoint": ep}, headers=t.h_leader)).json() == {"on": False}

    a = await make_asset(db, location="B2.204")
    rep = await report(client, t, a, urgent=True, situation="Đang thi")
    for _ in range(50):  # gửi chạy nền sau khi lưu xong
        if len(sent) >= 2:
            break
        await asyncio.sleep(0.05)
    data = next(d for e, d in sent if e == ep)
    assert rep["code"] in data and "B2.204" in data and "Đang thi" in data and "Khẩn cấp" in data
    assert "0912" not in data  # không có số điện thoại trên màn hình khóa
    assert f'"url": "/?go=case:{rep["id"]}"' in data
    await asyncio.sleep(0.1)
    await db.commit()
    left = {s.endpoint for s in (await db.execute(select(PushSubscription).where(PushSubscription.user_id == t.ktv.id))).scalars()}
    assert left == {ep}  # đăng ký hết hiệu lực đã tự xóa

    # Tắt ở nút chuông: máy đó thôi nhận
    assert (await client.post(f"{API}/push/unsubscribe", json={"endpoint": ep}, headers=t.h_ktv)).json() == {"on": False}
    assert (await client.post(f"{API}/push/status", json={"endpoint": ep}, headers=t.h_ktv)).json() == {"on": False}
    # Danh sách thông báo trong chuông vẫn giữ
    assert (await db.execute(select(Notification).where(Notification.user_id == t.ktv.id))).scalars().first() is not None
