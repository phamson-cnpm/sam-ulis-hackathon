
# be_sam – Backend SAM (Quản lý tài sản thông minh)

FastAPI + SQLAlchemy 2.0 async + MySQL/MariaDB. Giao diện là **fe_sam**.
Không có dữ liệu giả lập: cơ sở dữ liệu bắt đầu trống. Tài sản, nhóm tài sản, dữ liệu cán bộ do Phòng KHTC nhập (Excel hoặc
nhập tay); danh mục báo hỏng, tình huống, công việc sửa chữa do Phòng QTNL soạn.

## Chạy

```bash
cd be_sam
python -m venv venv && source venv/bin/activate      # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env                                  # điền MySQL và mật khẩu tài khoản quản trị hệ thống
python run.py                                         # http://localhost:8000/docs
```

Mỗi lần khởi động backend tự:
1. tạo cơ sở dữ liệu `MYSQL_DB` (utf8mb4) nếu chưa có;
2. chạy `alembic upgrade head`: tạo bảng (lần đầu) hoặc nâng cấp cấu trúc bảng lên bản mới nhất, không mất dữ liệu;
3. tạo tài khoản quản trị hệ thống của Phòng KHTC (`ADMIN_USERNAME`, `ADMIN_PASSWORD` trong `.env`) nếu chưa có; tài khoản
   cá nhân của từng cán bộ do Phòng KHTC cấp trên phần mềm (trang **Tài khoản, mã xác nhận**);
4. tạo ngưỡng cảnh báo mặc định theo mục 5.3 đề tài nếu chưa có: 20%, 30%, 3 lần, 2 lần, 12 tháng, 40%.

Nâng cấp từ bản 28/10 (migration `0003`): ba tài khoản dùng chung `canbo`, `qtnl`, `daumoi` bị khóa (giữ dòng để tra lịch
sử); nhóm "lãnh đạo đơn vị" chuyển về cán bộ, giảng viên; cán bộ đang giữ mã đầu mối có vai trò cán bộ đầu mối; phiếu,
thông báo ghi theo id mã đầu mối được chuyển sang id cán bộ. Sau khi nâng cấp, Phòng KHTC vào **Tài khoản, mã xác nhận** →
**Cấp tài khoản hàng loạt** rồi in danh sách tên đăng nhập, mật khẩu ban đầu gửi riêng từng cán bộ.

Sau đó Phòng KHTC đăng nhập, trang **Tài sản** → **Nhập Excel**: file danh mục nhóm tài sản (`DM_NHOM_TSCD.xlsx`) rồi file
danh sách tài sản (`Du_lieu_tai_san_moi_23_10_2026.xlsx`: 2.161 tài sản, 18 đơn vị, sổ sách đến 31/12/2025).

## Cấu trúc bảng (Alembic)

Các bản cấu trúc bảng nằm ở `alembic/versions/`: `0001` (30 bảng, ngày 27/10), `0002` (bổ sung ngày 28/10: chốt thanh
lý, gộp phiếu trùng, tổng tiền hóa đơn). Backend tự chạy `alembic upgrade head` khi khởi động; chạy tay cũng được:

```bash
alembic upgrade head        # lên bản mới nhất
alembic current             # đang ở bản nào
alembic history             # các bản đã có
alembic downgrade -1        # lùi một bản
# Docker: sudo docker exec sam-backend alembic current
```

Đổi cấu trúc bảng: sửa `models/`, chạy `alembic revision --autogenerate -m "nội dung"`, đọc lại file sinh ra trong
`alembic/versions/` rồi `alembic upgrade head`. Cơ sở dữ liệu tạo trước khi dùng Alembic (file SQL gửi ngày 27/10, 28/10)
thì backend tự ghi nhận đang ở bản `0001` hoặc `0002` rồi nâng cấp tiếp, dữ liệu giữ nguyên.

**Giữ thư mục `data/`** (khóa JWT, khóa mã hóa mã xác nhận) khi chuyển máy, hoặc đặt `JWT_SECRET`, `CODE_SECRET`
trong `.env`. Mất `CODE_SECRET` là không xem lại được các mã xác nhận đã cấp, phải cấp mã mới.
Tệp bản quét lưu ở `UPLOAD_DIR` (mặc định `uploads/`), cần sao lưu cùng cơ sở dữ liệu.

**Chạy trên máy chủ bằng Docker** (như các dự án trước): `bash start.sh` trong thư mục `be_sam/`, chạy TRƯỚC
`fe_sam/start.sh`. Script build image `sam-backend-img`, chạy container `sam-backend` trong mạng `sam_network`, cổng
`127.0.0.1:8530` (đổi `HOST_PORT` ở đầu file nếu trùng), tự khởi động lại khi máy chủ bật lại.
- `.env` gắn vào container lúc chạy (không nằm trong image). MySQL nằm trên máy chủ: `MYSQL_HOST="host.docker.internal"`;
  MySQL phải nghe ở địa chỉ Docker tới được (`bind-address = 0.0.0.0` hoặc `172.17.0.1`) và tài khoản MySQL cho kết nối từ
  mạng Docker (`'sam'@'172.%'`). Script báo gợi ý khi container không tới được MySQL.
- `uploads/` (bản quét) và `data/` (khóa) nằm trên máy chủ cạnh `start.sh`, gắn vào container: build lại, xóa container
  không mất. Sao lưu hai thư mục này cùng cơ sở dữ liệu.
- Một tiến trình (bộ đếm tạm khóa khi nhập sai nằm trong bộ nhớ của tiến trình). `FORWARDED_ALLOW_IPS` mặc định
  `127.0.0.1,172.16.0.0/12`: tin nginx cùng máy và các mạng Docker để lấy đúng địa chỉ máy người dùng; nginx trên máy chủ
  nên ghi đè `X-Forwarded-For $remote_addr` để người dùng không giả được địa chỉ.

Không dùng Docker thì chạy `python run.py` (đặt `HOST="127.0.0.1"`) và để máy chủ web chuyển tiếp `/api/` về
`127.0.0.1:8000`. Frontend khác địa chỉ với backend thì thêm địa chỉ trang vào `CORS_ORIGINS`. Giới hạn tải tệp:
`MAX_UPLOAD_SIZE_MB` (bản quét), 20 MB (file Excel). Đã chạy thử trên MySQL 8.0 và MariaDB 10.11.

## Cấu trúc

```
be_sam/
├── main.py  config.py  run.py  requirements.txt  .env.example  pytest.ini  Dockerfile  .dockerignore  start.sh
├── core/        database.py · migrate.py (alembic upgrade head khi khởi động) · security.py (bcrypt, JWT, mã xác nhận) · deps.py
│                errors.py (lỗi tiếng Việt) · clock.py (giờ Việt Nam)
├── models/      account · org · staff · catalog · asset · report · estimate · recall · log
├── schemas/     đăng nhập (dữ liệu khác trả dạng camelCase giống fe_sam, xem services/serialize.py)
├── services/    auth · catalog · people (cán bộ, mã đầu mối) · asset · light (tính đèn) · case (báo hỏng → dự toán)
│                recall (thu hồi, bàn giao) · misc (biểu mẫu, thông báo, nhật ký, số việc chờ) · import (Excel) · file · code
├── api/v1/      auth · misc · catalog · assets · cases · recalls · people
├── alembic/     env.py · versions/ (0001 bảng ngày 27/10, 0002 bổ sung ngày 28/10); alembic.ini ở thư mục gốc
└── tests/       pytest trên cơ sở dữ liệu riêng *_test; fixtures/light_cases.json (4.147 ca đèn sinh từ lights.js)
```

## Tài khoản, đăng nhập (mục VII đề tài, bản 30/10/2026)

Mỗi cán bộ, giảng viên một **tài khoản cá nhân** do Phòng KHTC cấp từ dữ liệu cán bộ (tên đăng nhập là mã số cán bộ, mật
khẩu ban đầu ngẫu nhiên, đổi ở lần đăng nhập đầu). Không còn tài khoản dùng chung, không chọn tên. Vai trò tính lại ở mỗi lần
gọi: `khtc` (cán bộ nhóm quản trị hoặc tài khoản quản trị hệ thống), `ktv`, `lanhdao_qtnl` (theo dữ liệu cán bộ), `daumoi`
(đang giữ mã đầu mối còn hiệu lực), còn lại `canbo`.

| Đường dẫn | Việc |
|---|---|
| `POST /auth/login {username, password}` | Access Token trong JSON (`accessToken`, `expiresIn` = 15 phút) + Refresh Token trong cookie `sam_refresh` (HttpOnly, Secure, SameSite=Strict, Path=`/api/v1/auth`) |
| `POST /auth/refresh-token` | trình duyệt tự gửi cookie; phiên còn hiệu lực thì trả Access Token mới (mở lại web, Access Token hết hạn). Không còn hiệu lực: 401 và xóa cookie |
| `POST /auth/logout` | hủy phiên của cửa sổ đang dùng (theo Access Token, kể cả đã quá hạn); cookie chỉ xóa khi thuộc đúng phiên đó |
| `POST /auth/logout-all` | đăng xuất mọi thiết bị của chính mình, thôi gửi thông báo đẩy tới các máy đó |
| `POST /auth/password {currentPassword, newPassword}` | đổi mật khẩu (bắt buộc lần đầu: trước khi đổi, mọi API khác trả 403 `password_change_required`); các thiết bị khác bị đăng xuất |
| `GET /auth/me` | phiên hiện tại |

- Máy chủ chỉ lưu bản băm SHA-256 của Refresh Token (bảng `auth_sessions`). Refresh Token chưa đặt hạn
  (`REFRESH_TOKEN_DAYS=0`); Phòng KHTC khóa tài khoản, đặt lại mật khẩu thì mọi phiên của người đó bị hủy, Access Token đang
  dùng cũng hết hiệu lực ngay (mỗi lần gọi đều kiểm tra phiên).
- **Mã xác nhận cá nhân** (cán bộ đầu mối, kỹ thuật viên, lãnh đạo Phòng QTNL) gửi ở header `X-Confirm-Code` khi thao tác có
  giá trị xác nhận: kỹ thuật viên gửi dự toán (kèm đề nghị ngoại lệ), sửa và gửi lại, nhập, sửa chi phí thực tế, ghi ý kiến
  kỹ thuật; lãnh đạo xác nhận, trả lại dự toán, xác nhận, trả lại hư hỏng toàn phần, quyết định đề xuất (vẫn nhận `leaderCode`
  trong body); đầu mối, kỹ thuật viên gửi đề xuất. Thiếu mã: 428 `code_required` (giao diện hỏi mã rồi gửi lại); sai mã: 400
  `bad_code` / `bad_leader_code`.
- Sai mật khẩu hoặc sai mã quá 8 lần trong 15 phút thì máy đó tạm khóa (429).
- Phòng KHTC: `POST /staff/{id}/account` (cấp hoặc đặt lại mật khẩu, trả mật khẩu ban đầu một lần),
  `POST /staff/accounts/issue-all {unit?}`, `POST /staff/{id}/active {active}`, `POST /staff/{id}/logout-all`,
  `DELETE /staff/{id}/account` (xóa tên đăng nhập, mật khẩu; giữ dữ liệu cán bộ, lịch sử; không tự xóa chính mình),
  `DELETE /staff/{id}` (xóa cán bộ khỏi danh sách kèm tài khoản, thu hồi mã đầu mối nếu có; chưa có lịch sử thì xóa hẳn,
  đã có lịch sử thì ẩn, giữ tên trong lịch sử),
  `POST /staff/{id}/code` (đổi mã của kỹ thuật viên, lãnh đạo Phòng QTNL); mã đầu mối: `POST /focal/reissue {unit, staffId}`.

Lỗi trả về: `{"message": "...", "status_code": 400, "reason": "..."}`; `message` là câu tiếng Việt để hiện cho người dùng.

## API (tiền tố `/api/v1`, xem đủ ở `/docs`)

| Nhóm | Đường dẫn chính | Vai trò |
|---|---|---|
| Chung | `GET /meta`, `GET /me/counts`, `GET /refs`, `GET /notifications`, `POST /notifications/read-all`, `POST /export-logs` | mọi người |
| Danh mục | `GET /catalog/units`, `/asset-groups`, `/fault-lists`, `/situations`, `/repair-jobs`; thêm, sửa, bỏ | đọc: mọi người; sửa: Phòng QTNL |
| Tài sản | `GET /assets`, `/assets/{id}`, `/assets/{id}/history`, `GET /assets/search`, `POST /assets/{id}/preview-light` | QTNL, KHTC (tìm: mọi người, bỏ chi phí với cán bộ, đầu mối) |
| Chờ thanh lý | `POST /assets/{id}/disposal-decision` (`thanh_ly` hoặc `loai_khoi_danh_sach`, kèm căn cứ) | Phòng KHTC |
| Phiếu báo hỏng | `POST /reports/batch`, `GET /reports/mine`, `GET /reports`, `POST /reports/{id}/accept`, `GET /reports/{id}/case` | báo: cán bộ, đầu mối, QTNL; xử lý: kỹ thuật viên |
| Gộp phiếu trùng | `GET /reports/{id}/merge-candidates`, `POST /reports/{id}/merge {mainId}`, `POST /reports/{id}/unmerge` | kỹ thuật viên |
| Biên bản kiểm tra | `POST /inspections`, `/inspections/{id}/scan`, `/inspections/{id}/total-loss` | kỹ thuật viên; xác nhận: lãnh đạo QTNL |
| Thiết bị tạm, kho thiếu | `POST /temp-transfers`, `/temp-transfers/{id}/return`, `POST /no-spares` (chỉ phiếu khẩn cấp) | kỹ thuật viên |
| Dự toán | `GET/POST /estimates`, `/estimates/{id}/resubmit`, `/confirm`, `/return`, `/signed`, `/reject`, `/actual`, `/actual/correct` | kỹ thuật viên; xác nhận, trả lại: lãnh đạo QTNL |
| Ngoại lệ | `GET /exceptions`, `POST /exceptions/{id}/decide` | mở khóa: Phòng KHTC |
| Ngưỡng | `GET/PUT /thresholds`, `POST /thresholds/preview`, `GET /thresholds/logs` | đặt: Phòng KHTC |
| Thu hồi về kho | `GET /recalls`, `/recalls/pending`, `POST /recalls`, `/recalls/{id}/decide`, `/handover`, `/complete`, `/attach` | đề nghị, biên bản: kỹ thuật viên; xác nhận, nhập điều chuyển: KHTC |
| Bàn giao | `GET/POST /handovers` | lập: Phòng KHTC |
| Cán bộ, mã | `GET/POST /staff`, `PATCH/DELETE /staff/{id}`, `GET /focal`, `/focal/logs`, `POST /focal/reissue`, `/focal/{id}/revoke` | Phòng KHTC |
| Tài khoản | `POST /staff/{id}/account`, `/staff/accounts/issue-all`, `/staff/{id}/active`, `/staff/{id}/logout-all`, `/staff/{id}/code`; `DELETE /staff/{id}/account` | Phòng KHTC |
| Đầu mối | `GET /focal/assets` (toàn trường, chỉ các cột: màu đèn, mã, tên, phòng ban, vị trí, nguyên giá, Đề xuất), `POST /focal/log` | cán bộ đầu mối |
| Đề xuất xử lý tài sản | `GET /proposals`, `GET /proposals/{id}`, `POST /proposals` (mã), `/proposals/{id}/decide` (`duyet`, `ky_thuat` + `techId`, `khong_duyet` + `reason` bắt buộc; mã), `/proposals/{id}/tech` (mã), `/proposals/khtc` (`tiep_nhan`, `khong_duyet` + lý do) | gửi: đầu mối (tài sản đơn vị mình), kỹ thuật viên; quyết định: lãnh đạo QTNL; tiếp nhận: KHTC |
| Thông báo đẩy | `GET /push/config`, `POST /push/subscribe`, `/push/unsubscribe`, `/push/status` | mọi người (nút chuông) |
| Biểu mẫu | `GET /forms/case/{reportId}` (cán bộ, đầu mối: chỉ phiếu của mình), `/forms/handover/{id}`, `/forms/asset/{id}` | |
| Tệp, nhập Excel | `POST /files`, `GET /files/{id}`, `POST /import` | tệp: QTNL, KHTC; nhập: KHTC |

## Nhập Excel (`POST /import`, Phòng KHTC)

Tự nhận loại file theo dòng tiêu đề (trong 30 dòng đầu):
- **Danh sách tài sản** (BẢNG TÍNH KHẤU HAO TÀI SẢN của phần mềm quản lý tài sản): Mã tài sản, Tên tài sản, Ngày sử dụng,
  Vị trí, Phòng ban, Nguyên giá, Số tháng khấu hao, Giá trị hao mòn lũy kế, Giá trị còn lại, Nguồn vốn. Mã nhóm lấy từ đầu
  mã tài sản. Dòng “Tổng cộng” bỏ qua. Ngày chốt số liệu sổ sách lấy từ dòng “01/01/2025 - 31/12/2025”.
- **Danh mục nhóm tài sản**: Mã nhóm, Tên nhóm.
- **Danh sách cán bộ**: Mã số hiệu CBCCVC, Họ tên, Đơn vị, Chức vụ hiện tại (Số điện thoại, Email nếu có).

Nhập lại là cập nhật theo mã (mã tem, mã nhóm, mã cán bộ): đã có thì cập nhật, chưa có thì thêm, không xóa. Tài sản mới:
mốc tính thời gian nằm kho là ngày đưa vào sử dụng. Đơn vị mới tự thêm. Kết quả trả số dòng thêm, cập nhật, không đổi, bỏ qua
kèm lý do. Đã thử với file thật `Du_lieu_tai_san_moi_23_10_2026.xlsx` (2.161 tài sản, 18 đơn vị) và `DM_NHOM_TSCD.xlsx` (31 nhóm).

## Kiểm tra

```bash
TEST_MYSQL_USER=... TEST_MYSQL_PASSWORD=... python -m pytest -q      # 51 test
```

Dùng cơ sở dữ liệu `sam_test` (xóa rồi tạo lại bằng `alembic upgrade head` mỗi lần chạy, tên bắt buộc kết thúc bằng
`_test`). Gồm: cấu trúc bảng sau Alembic khớp models; tài khoản cá nhân (Access Token + cookie Refresh Token, mở lại web
tự làm mới phiên, đăng xuất, đổi mật khẩu lần đầu, đặt lại mật khẩu, khóa tài khoản, cấp hàng loạt), vai trò theo dữ liệu
cán bộ và mã đầu mối, mã xác nhận cho thao tác quan trọng (428, sai mã), chặn dò mật khẩu, mã;
cột Đề xuất và luồng duyệt (đầu mối gửi danh sách, lãnh đạo giao kỹ thuật xem xét, không duyệt bắt buộc lý do, Phòng KHTC
tiếp nhận), không đồng ý mở khóa ngoại lệ bắt buộc lý do, thông báo đẩy (bật, tắt, gửi, tự xóa đăng ký hết hiệu lực); cấp số phiếu không trùng; đèn khớp bản JavaScript trên 4.147 ca (kể cả giữ đỏ nhiều năm); báo hỏng
nhiều tài sản; dự toán,
lãnh đạo xác nhận bằng mã, trả lại, gửi lại, ký đủ, chi phí thực tế; khóa phiếu và mở khóa ngoại lệ; thiết bị tạm chỉ khi
khẩn cấp; hư hỏng toàn phần; thu hồi về kho 5 bước; bàn giao; danh mục; dữ liệu cán bộ; mã đầu mối cấp, đổi, thu hồi;
phân quyền; ngưỡng; nhập Excel; số việc chờ; giữ đỏ sang năm mới, Phòng KHTC chốt thanh lý, loại khỏi danh sách; gộp
phiếu trùng; hóa đơn gộp; sửa chi phí thực tế. Đã chạy cả bộ trên MySQL 8.0 (`TEST_MYSQL_PORT`) và MariaDB 10.11.

## Các quy tắc theo đề tài (bổ sung ngày 28/10)

- **Danh sách chờ thanh lý (mục 5.3):** tài sản Đỏ 1.1, Đỏ 1.2 giữ đèn đỏ khi sang năm tài chính mới (máy chủ tính đèn đến
  hết 31/12 năm trước, đỏ thì giữ, ghi "Giữ từ năm ..."). Phòng KHTC quyết định trên trang tài sản: "Đã thanh lý" (thôi tính
  đèn, vẫn lưu lịch sử, không báo hỏng được nữa) hoặc "Loại khỏi danh sách" (đèn tính lại bình thường). Tài sản đang đỏ do
  chi phí sửa chữa của chính năm nay thì chưa loại được, chỉ chốt thanh lý hoặc sửa theo quy trình ngoại lệ.
- **Gộp phiếu trùng (mục 5.3):** kỹ thuật viên gộp phiếu trùng cùng một sự cố vào phiếu chính (cùng mã tài sản; phiếu chưa
  có mã thì cùng vị trí), khi phiếu chưa có biên bản, dự toán, thiết bị tạm. Chỉ phiếu chính lập biên bản, dự toán nên chỉ
  tính một lần sửa; phiếu trùng theo trạng thái phiếu chính, người báo được thông báo. Phiếu trùng khẩn cấp thì phiếu chính
  thành khẩn cấp. Bỏ gộp được khi phiếu chính chưa xong.
- **Sửa chi phí thực tế (mục IV, 5.5):** kỹ thuật viên sửa khi nhập nhầm; lịch sử phiếu ghi người sửa, thời gian, số cũ,
  số mới, lý do; đèn tự tính lại.
- **Hóa đơn gộp (mục 5.5):** nhập thêm tổng tiền hóa đơn; các phiếu cùng số hóa đơn (không phân biệt hoa thường, khoảng
  trắng) không được có tổng chi phí thực tế vượt tổng hóa đơn. Phòng KHTC thấy các hóa đơn chưa chia khớp ở trang Đối chiếu.
- **Số ngày chờ (mục 5.4):** giao diện hiện số ngày phiếu dự toán, đề nghị ngoại lệ, biên bản hư hỏng toàn phần đã chờ ở
  trạng thái hiện tại; đề nghị ngoại lệ có tình huống khẩn cấp xếp lên đầu.

## Bổ sung ngày 30/10/2026

- **Không duyệt phải có lý do:** đề xuất xử lý tài sản (lãnh đạo Phòng QTNL, Phòng KHTC), đề nghị ngoại lệ (Phòng KHTC không
  đồng ý mở khóa: lý do ở `conclusion`); lý do gửi kèm thông báo cho người lập.
- **Cột Đề xuất (mục 5.6):** `GET /assets` trả thêm `proposal` (đề xuất gần nhất) và `suggestion` (gợi ý theo màu đèn: Đỏ →
  thanh lý, Cam → kiểm tra kỹ thuật, bảo hành, Vàng 3.1 → điều chuyển, Vàng 3.3 → thay thế). Đề xuất không làm đổi màu đèn;
  mỗi tài sản một đề xuất đang xử lý; lãnh đạo không tự duyệt đề xuất mình lập.
- **Cán bộ đầu mối (mục 5.8):** xem tài sản toàn trường nhưng máy chủ chỉ trả 7 trường; `GET /assets/{id}`, tìm tài sản của
  cán bộ, đầu mối không có giá trị còn lại, hao mòn, nguồn vốn (cán bộ không có cả nguyên giá). Nhật ký thêm `tai_pdf`.
- **Thông báo đẩy (mục 5.9):** `services/push_service.py` gửi bằng `pywebpush` sau khi request lưu xong (chạy nền), khóa VAPID
  tự sinh lưu ở `app_settings` nếu `.env` để trống; thiết bị trả 404/410 thì tự xóa đăng ký. Thông báo có `link` (màn hình mở
  khi bấm). Nội dung không có số điện thoại, chi phí.

## Chưa làm

- **Ngưỡng chi phí thực tế vượt dự toán phải ký bổ sung (mục 5.4):** đề tài chưa ghi mức ngưỡng và cách ký bổ sung; phần
  mềm đang hiện số tiền vượt khi nhập chi phí thực tế. Làm khi Phòng KHTC chốt.
- **Ứng dụng AI (mục VI):** đề tài ghi là đề xuất cho bản thử nghiệm; chưa làm ở bản này.
- **Kiểm kê trên SAM (cột Số lượng kiểm kê 0/1, Hoàn thành kiểm kê bằng mã):** đề tài ghi là phát triển sau; hiện file Excel,
  PDF tải về có cột Kiểm kê (0), Ghi chú để điền tay.
