"""Đăng nhập theo mục VII đề tài (bản 30/10/2026): mỗi cán bộ một tài khoản cá nhân do Phòng KHTC cấp;
Access Token trong JSON (15 phút) + Refresh Token trong cookie HTTP-Only; mở lại web thì /auth/refresh-token;
mã xác nhận cá nhân cho thao tác quan trọng; vai trò tính lại mỗi lần (thu hồi mã đầu mối có hiệu lực ngay)."""
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from config import settings
from core.security import create_token
from models import Account, Asset, Report, Staff, Threshold
from tests.conftest import bearer
from tests.factory import QTNL_UNIT, Team, as_focal, as_khtc, make_asset, make_staff, person, uid

API = "/api/v1"


async def login(client, username, password):
    return await client.post(f"{API}/auth/login", json={"username": username, "password": password})


async def fresh_client():
    """Một trình duyệt khác (không có cookie)."""
    from main import app

    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def test_health(client):
    r = await client.get("/health")
    assert r.json() == {"status": "ok"}


async def test_khoi_tao_chi_co_tai_khoan_quan_tri(db):
    """Khởi tạo chỉ tạo tài khoản quản trị hệ thống của Phòng KHTC và ngưỡng mặc định; không còn tài khoản dùng chung."""
    from services.seed_service import run_seed

    async def n(model):
        return (await db.execute(select(func.count()).select_from(model))).scalar_one()

    before = (await n(Asset), await n(Report), await n(Staff))
    await run_seed(db)
    assert (await n(Asset), await n(Report), await n(Staff)) == before
    kinds = sorted(a.kind for a in (await db.execute(select(Account))).scalars())
    assert kinds == ["admin"]
    th = await db.get(Threshold, 1)
    await db.refresh(th)
    assert (th.red_pct, th.orange_pct, th.orange_count, th.repeat_count, th.warehouse_months, th.cumulative_pct) == (20, 30, 3, 2, 12, 40)


async def test_dang_nhap_tra_access_token_va_cookie_refresh(client):
    r = await login(client, "khtc", "admin-pass")
    assert r.status_code == 200
    body = r.json()
    assert body["accountKind"] == "account" and body["user"]["role"] == "khtc"
    assert body["expiresIn"] == 15 * 60 and body["tokenType"] == "bearer" and body["accessToken"]
    assert "refreshToken" not in body  # Refresh Token không nằm trong JSON
    cookie = r.headers["set-cookie"]
    assert cookie.startswith(f"{settings.REFRESH_COOKIE_NAME}=")
    assert "HttpOnly" in cookie and "SameSite=strict" in cookie and f"Path={API}/auth" in cookie
    me = await client.get(f"{API}/auth/me", headers=bearer(body["accessToken"]))
    assert me.json()["user"]["name"] == "Phòng Kế hoạch - Tài chính"


async def test_sai_mat_khau_va_tam_khoa(client):
    r = await login(client, "khtc", "sai")
    assert r.status_code == 401 and r.json()["message"] == "Tên đăng nhập hoặc mật khẩu không đúng"
    for _ in range(7):
        await login(client, "khtc", "sai")
    locked = await login(client, "khtc", "admin-pass")
    assert locked.status_code == 429 and locked.json()["reason"] == "too_many_attempts"


async def test_mo_lai_web_tu_lam_moi_phien(client, db):
    """Biến tạm (Access Token) mất khi mở lại web: gọi /refresh-token, trình duyệt tự gửi cookie, vào thẳng trang chủ."""
    s, _ = await person(db, client, "ktv", QTNL_UNIT, code=f"QT-{uid(4)}")
    r = await client.post(f"{API}/auth/refresh-token")  # cùng trình duyệt: cookie còn
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["user"]["id"] == s.id and body["user"]["role"] == "ktv" and body["accessToken"]
    assert (await client.get(f"{API}/reports", headers=bearer(body["accessToken"]))).status_code == 200
    # Trình duyệt khác không có cookie thì phải đăng nhập
    async with await fresh_client() as other:
        no = await other.post(f"{API}/auth/refresh-token")
        assert no.status_code == 401 and no.json()["reason"] == "no_session"


async def test_access_token_het_han_va_token_cu(client, db):
    s, h = await person(db, client)
    me = (await client.get(f"{API}/auth/me", headers=h)).json()
    assert me["user"]["id"] == s.id
    # Access Token quá 15 phút
    old = create_token({"sub": s.id, "typ": "staff", "sid": "x"}, minutes=-1)
    r = await client.get(f"{API}/auth/me", headers=bearer(old))
    assert r.status_code == 401 and r.json()["reason"] == "token_expired"
    # Token kiểu cũ (tài khoản dùng chung) không còn dùng được
    legacy = create_token({"sub": "abc", "stage": "person"})
    r = await client.get(f"{API}/auth/me", headers=bearer(legacy))
    assert r.status_code == 401 and r.json()["reason"] == "token_invalid"
    assert (await client.get(f"{API}/auth/me")).json()["reason"] == "no_token"


async def test_dang_xuat_huy_phien_may_nay(client, db):
    s, h = await person(db, client)
    out = await client.post(f"{API}/auth/logout")
    assert out.status_code == 200 and 'sam_refresh=""' in out.headers["set-cookie"]
    # Access Token của phiên đã đăng xuất hết hiệu lực ngay (không chờ hết 15 phút)
    r = await client.get(f"{API}/auth/me", headers=h)
    assert r.status_code == 401 and r.json()["reason"] == "session_revoked"
    assert (await client.post(f"{API}/auth/refresh-token")).status_code == 401


async def test_cap_tai_khoan_doi_mat_khau_lan_dau(client, db):
    h = await as_khtc(client)
    code = f"ULIS{uid(5)}"
    st = (await client.post(f"{API}/staff", json={"name": "Nguyễn Thu Hà", "unit": "Khoa NN&VH Anh", "staffCode": code}, headers=h)).json()
    assert st["hasAccount"] is False and st["username"] is None
    acc = (await client.post(f"{API}/staff/{st['id']}/account", json={}, headers=h)).json()
    assert acc["username"] == code and len(acc["password"]) >= 10  # mật khẩu ban đầu chỉ hiện một lần
    lst = next(x for x in (await client.get(f"{API}/staff", headers=h)).json() if x["id"] == st["id"])
    assert lst["hasAccount"] and lst["mustChangePassword"] and "password" not in lst

    async with await fresh_client() as b:
        r = await login(b, code.lower(), acc["password"])  # tên đăng nhập không phân biệt hoa thường
        assert r.status_code == 200
        body = r.json()
        assert body["mustChangePassword"] is True and body["user"]["role"] == "canbo"
        hb = bearer(body["accessToken"])
        # Chưa đổi mật khẩu ban đầu thì chưa làm việc được
        r = await b.get(f"{API}/reports/mine", headers=hb)
        assert r.status_code == 403 and r.json()["reason"] == "password_change_required"
        short = await b.post(f"{API}/auth/password", json={"currentPassword": acc["password"], "newPassword": "123"}, headers=hb)
        assert short.status_code == 400
        wrong = await b.post(f"{API}/auth/password", json={"currentPassword": "sai", "newPassword": "Mat-khau-moi-1"}, headers=hb)
        assert wrong.json()["reason"] == "bad_password"
        ok = await b.post(f"{API}/auth/password", json={"currentPassword": acc["password"], "newPassword": "Mat-khau-moi-1"}, headers=hb)
        assert ok.status_code == 200
        assert (await b.get(f"{API}/reports/mine", headers=hb)).status_code == 200
        assert (await login(b, code, "Mat-khau-moi-1")).json()["mustChangePassword"] is False

        # Phòng KHTC đặt lại mật khẩu: mọi thiết bị đăng xuất, đăng nhập lại phải đổi mật khẩu
        acc2 = (await client.post(f"{API}/staff/{st['id']}/account", json={}, headers=h)).json()
        assert acc2["password"] != acc["password"]
        assert (await b.get(f"{API}/auth/me", headers=hb)).status_code == 401
        assert (await b.post(f"{API}/auth/refresh-token")).status_code == 401
        assert (await login(b, code, acc2["password"])).json()["mustChangePassword"] is True


async def test_khoa_tai_khoan_co_hieu_luc_ngay(client, db):
    h = await as_khtc(client)
    s, hs = await person(db, client)
    r = (await client.post(f"{API}/staff/{s.id}/active", json={"active": False}, headers=h)).json()
    assert r["active"] is False
    assert (await client.get(f"{API}/auth/me", headers=hs)).status_code == 401
    assert (await login(client, s.username, "Mat-khau-1")).status_code == 401
    await client.post(f"{API}/staff/{s.id}/active", json={"active": True}, headers=h)
    assert (await login(client, s.username, "Mat-khau-1")).status_code == 200


async def test_cap_tai_khoan_hang_loat(client, db):
    h = await as_khtc(client)
    unit = f"Khoa Cấp hàng loạt {uid(3)}"
    a = await make_staff(db, unit=unit, staff_code=f"ULIS{uid(5)}")
    b = await make_staff(db, unit=unit)  # chưa có mã số cán bộ
    r = (await client.post(f"{API}/staff/accounts/issue-all", json={"unit": unit}, headers=h)).json()
    assert [x["staffId"] for x in r["issued"]] == [a.id]
    assert [x["staffId"] for x in r["skipped"]] == [b.id] and r["skipped"][0]["reason"] == "Chưa có mã số cán bộ"
    # Tên đăng nhập không trùng tài khoản quản trị hệ thống
    c = await make_staff(db, unit=unit, staff_code="KHTC")
    dup = await client.post(f"{API}/staff/{c.id}/account", json={}, headers=h)
    assert dup.status_code == 400 and "đã được dùng" in dup.json()["message"]


async def test_vai_tro_theo_du_lieu_can_bo_va_ma_dau_moi(client, db):
    """Vai trò tính lại ở mỗi yêu cầu: Phòng KHTC thu hồi mã đầu mối thì người đó trở lại vai trò cán bộ ngay."""
    unit = f"Khoa Vai trò {uid(3)}"
    s, f, hf = await as_focal(db, client, unit)
    me = (await client.get(f"{API}/auth/me", headers=hf)).json()
    assert me["user"]["role"] == "daumoi" and me["user"]["focalUnit"] == unit
    assert (await client.get(f"{API}/focal/assets", headers=hf)).status_code == 200
    h = await as_khtc(client)
    await client.post(f"{API}/focal/{f['id']}/revoke", json={"reason": "Thôi làm đầu mối"}, headers=h)
    me = (await client.get(f"{API}/auth/me", headers=hf)).json()
    assert me["user"]["role"] == "canbo"
    assert (await client.get(f"{API}/focal/assets", headers=hf)).status_code == 403
    # Cán bộ có vai trò quản trị (Phòng KHTC) đăng nhập tài khoản cá nhân
    k, hk = await person(db, client, "khtc", "Phòng Kế hoạch - Tài chính")
    assert (await client.get(f"{API}/auth/me", headers=hk)).json()["user"]["role"] == "khtc"
    assert (await client.get(f"{API}/staff", headers=hk)).status_code == 200


async def test_ma_xac_nhan_ca_nhan_cho_thao_tac_quan_trong(client, db):
    """Kỹ thuật viên gửi dự toán phải nhập mã xác nhận: thiếu mã trả 428 để giao diện hỏi mã; sai mã trả 400."""
    t = await Team().setup(db, client)
    a = await make_asset(db)
    body = {"assetId": a.id, "lines": [{"content": "Thay bóng đèn", "costGroup": "tinh", "estimate": 500_000}]}
    no_code = {k: v for k, v in t.h_ktv.items() if k != "X-Confirm-Code"}
    r = await client.post(f"{API}/estimates", json=body, headers=no_code)
    assert r.status_code == 428 and r.json()["reason"] == "code_required"
    r = await client.post(f"{API}/estimates", json=body, headers={**no_code, "X-Confirm-Code": t.leader_code})
    assert r.status_code == 400 and r.json()["reason"] == "bad_code"  # mã của người khác
    r = await client.post(f"{API}/estimates", json=body, headers={**no_code, "X-Confirm-Code": t.ktv_code.lower()})
    assert r.status_code == 200, r.text  # mã không phân biệt hoa thường
    est = r.json()["estimate"]
    # Lãnh đạo trả lại dự toán cũng phải nhập mã
    no_leader = {k: v for k, v in t.h_leader.items() if k != "X-Confirm-Code"}
    r = await client.post(f"{API}/estimates/{est['id']}/return", json={"reason": "Xem lại"}, headers=no_leader)
    assert r.status_code == 428


async def test_tai_khoan_quan_tri_he_thong_khong_bao_hong(client, db):
    a = await make_asset(db)
    h = await as_khtc(client)
    r = await client.post(f"{API}/reports/batch", json={"items": [{"assetId": a.id, "content": "Hỏng", "location": a.location}]}, headers=h)
    assert r.status_code == 403
    # Cán bộ báo hỏng: họ tên người báo tự điền theo tài khoản, không chọn được người khác
    s, hs = await person(db, client)
    other = await make_staff(db)
    r = await client.post(f"{API}/reports/batch", json={"reporterId": other.id, "items": [{"assetId": a.id, "content": "Hỏng", "location": a.location}]}, headers=hs)
    rep = r.json()["reports"][0]
    assert rep["reporterId"] == s.id and rep["accountId"] == s.id and rep["reporterName"] == s.name


async def test_dang_xuat_chi_huy_phien_cua_cua_so_dang_dung(client, db):
    """Hai cửa sổ cùng trình duyệt: cửa sổ 1 đăng nhập A, cửa sổ 2 đăng nhập B (cookie đổi sang phiên B). Cửa sổ 1 bấm
    Đăng xuất chỉ hủy phiên A; phiên B (cookie) vẫn dùng được, cửa sổ 2 không bị đẩy ra."""
    a, ha = await person(db, client)
    b, hb = await person(db, client)  # cùng client: cookie giờ là của B
    out = await client.post(f"{API}/auth/logout", headers=ha)
    assert out.status_code == 200 and "set-cookie" not in out.headers  # cookie của B giữ nguyên
    assert (await client.get(f"{API}/auth/me", headers=ha)).json()["reason"] == "session_revoked"
    assert (await client.get(f"{API}/auth/me", headers=hb)).status_code == 200
    r = await client.post(f"{API}/auth/refresh-token")
    assert r.status_code == 200 and r.json()["user"]["id"] == b.id
    # Access Token đã quá hạn vẫn đăng xuất đúng phiên của nó
    sid = (await client.get(f"{API}/auth/me", headers=hb)).status_code
    assert sid == 200
    out = await client.post(f"{API}/auth/logout", headers=hb)
    assert 'sam_refresh=""' in out.headers["set-cookie"]
    assert (await client.post(f"{API}/auth/refresh-token")).status_code == 401


async def test_dang_xuat_bang_token_qua_han(client, db):
    s, _ = await person(db, client)
    me = (await client.post(f"{API}/auth/refresh-token")).json()
    from core.security import decode_token

    sid = decode_token(me["accessToken"])["sid"]
    expired = create_token({"sub": s.id, "typ": "staff", "sid": sid}, minutes=-1)
    out = await client.post(f"{API}/auth/logout", headers=bearer(expired))
    assert 'sam_refresh=""' in out.headers["set-cookie"]
    assert (await client.post(f"{API}/auth/refresh-token")).status_code == 401


async def test_xoa_tai_khoan_giu_du_lieu_can_bo(client, db):
    h = await as_khtc(client)
    s, _ = await person(db, client)
    async with await fresh_client() as other:
        r = await login(other, s.username, "Mat-khau-1")
        hs = bearer(r.json()["accessToken"])
        out = await client.delete(f"{API}/staff/{s.id}/account", headers=h)
        assert out.status_code == 200, out.text
        rec = out.json()
        assert rec["hasAccount"] is False and rec["username"] is None and rec["name"] == s.name
        me = await other.get(f"{API}/auth/me", headers=hs)
        assert me.status_code == 401 and me.json()["reason"] == "session_revoked"
        assert (await other.post(f"{API}/auth/refresh-token")).status_code == 401
    assert (await login(client, s.staff_code or "x", "Mat-khau-1")).status_code == 401
    # Vẫn có trong dữ liệu cán bộ, cấp lại được
    assert any(x["id"] == s.id for x in (await client.get(f"{API}/staff", headers=h)).json())
    again = await client.post(f"{API}/staff/{s.id}/account", json={"username": f"u{uid(6)}"}, headers=h)
    assert again.status_code == 200 and again.json()["password"]
    # Chưa có tài khoản thì báo lỗi; không tự xóa tài khoản của chính mình
    k, hk = await person(db, client, "khtc", "Phòng Kế hoạch - Tài chính")
    assert (await client.delete(f"{API}/staff/{k.id}/account", headers=hk)).status_code == 400


async def test_xoa_can_bo_chua_co_lich_su_thi_xoa_han(client, db):
    h = await as_khtc(client)
    code = f"ULIS{uid(5)}"
    st = (await client.post(f"{API}/staff", json={"name": "Cán bộ thử", "unit": "Khoa NN&VH Anh", "staffCode": code}, headers=h)).json()
    acc = (await client.post(f"{API}/staff/{st['id']}/account", json={}, headers=h)).json()
    r = await client.delete(f"{API}/staff/{st['id']}", headers=h)
    assert r.status_code == 200 and r.json()["mode"] == "removed"
    assert not any(x["id"] == st["id"] for x in (await client.get(f"{API}/staff", headers=h)).json())
    assert not any(p["id"] == st["id"] for p in (await client.get(f"{API}/refs", headers=h)).json()["people"])
    assert (await login(client, code, acc["password"])).status_code == 401
    assert (await client.delete(f"{API}/staff/{st['id']}", headers=h)).status_code == 404
    # Mã số cán bộ dùng lại được
    assert (await client.post(f"{API}/staff", json={"name": "Cán bộ thử", "unit": "Khoa NN&VH Anh", "staffCode": code}, headers=h)).status_code == 200


async def test_xoa_can_bo_da_co_lich_su_thi_an_giu_ten(client, db):
    unit = f"Khoa Xóa {uid(3)}"
    s, f, hf = await as_focal(db, client, unit)  # có mã đầu mối: đã có lịch sử
    h = await as_khtc(client)
    r = await client.delete(f"{API}/staff/{s.id}", headers=h)
    assert r.status_code == 200 and r.json()["mode"] == "hidden", r.text
    assert not any(x["id"] == s.id for x in (await client.get(f"{API}/staff", headers=h)).json())
    p = next(p for p in (await client.get(f"{API}/refs", headers=h)).json()["people"] if p["id"] == s.id)
    assert p["deleted"] is True and p["name"] == s.name  # vẫn hiện tên trong lịch sử
    focal = next(x for x in (await client.get(f"{API}/focal", headers=h)).json() if x["id"] == f["id"])
    assert focal["status"] == "da_thu_hoi"  # mã đầu mối đã thu hồi
    assert (await client.get(f"{API}/auth/me", headers=hf)).status_code == 401
    assert (await login(client, s.username, "Mat-khau-1")).status_code == 401
    assert (await client.patch(f"{API}/staff/{s.id}", json={"name": "x"}, headers=h)).status_code == 404
    # Không tự xóa chính mình
    k, hk = await person(db, client, "khtc", "Phòng Kế hoạch - Tài chính")
    assert (await client.delete(f"{API}/staff/{k.id}", headers=hk)).status_code == 400
