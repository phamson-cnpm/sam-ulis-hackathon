
# SAM – Quản lý tài sản thông minh (fe_sam)

Giao diện SAM cho Trường Đại học Ngoại ngữ, ĐHQGHN. Chạy với backend **be_sam** (FastAPI + MySQL/MariaDB), dữ liệu thật
trong cơ sở dữ liệu: không còn dữ liệu giả lập.

Create React App (react-scripts 5), JavaScript thuần (.js có JSX), Tailwind CSS v3, lucide-react, recharts. Không dùng
router: trang chính giữ `activeTab` và truyền `onNavigate` xuống từng trang.

## Chạy

```bash
# 1. Backend (xem be_sam/README.md): python run.py  →  http://localhost:8000
# 2. Frontend
cd fe_sam
npm install          # .npmrc đã bật legacy-peer-deps
npm start            # http://localhost:3000, gọi /api qua proxy tới http://localhost:8000 (package.json "proxy")
npm test             # 29 test: hàm tính đèn (cả giữ đỏ sang năm mới), biểu mẫu in, xuất Word, file Excel, bộ lọc nhóm thiết bị, hóa đơn gộp, số ngày chờ (Jest)
npm run build        # bản tĩnh trong build/
```

**Khi dựng máy chủ:** đặt `REACT_APP_API_BASE_URL` trước khi build (xem `.env.example`).
- Cách khuyến nghị: để trống, máy chủ web phục vụ thư mục `build/` và chuyển tiếp `/api/` về backend, cùng một địa chỉ nên không cần CORS. Ví dụ nginx:
  `location /api/ { proxy_pass http://127.0.0.1:8000; client_max_body_size 25m; }`.
- Cách khác: frontend và backend khác địa chỉ. Đặt địa chỉ backend vào biến, và thêm địa chỉ trang vào `CORS_ORIGINS` của be_sam.

**Docker** (như các dự án trước): chạy `be_sam/start.sh` trước, rồi `bash start.sh` trong `fe_sam/`. Script build image
`sam-frontend-img` (React build rồi nginx), chạy container `sam-frontend` trong mạng `sam_network`, cổng `127.0.0.1:8531`
(đổi `HOST_PORT` ở đầu file nếu trùng). `nginx.conf` trong container chuyển tiếp `/api/` về container `sam-backend` bằng
tên (cùng địa chỉ, không cần CORS; nhận tệp tải lên đến 25 MB). nginx trên máy chủ gắn tên miền, HTTPS và chuyển mọi đường
dẫn về `127.0.0.1:8531`, nên ghi đè `proxy_set_header X-Forwarded-For $remote_addr;` để người dùng không giả được địa chỉ
(xem be_sam/README.md).

## Bắt đầu dùng (dữ liệu thật)

1. Đăng nhập **Phòng KHTC** (tài khoản quản trị hệ thống; mật khẩu đặt trong `.env` của be_sam).
2. Trang **Tài sản** → **Nhập Excel**: nhập file danh mục nhóm tài sản (`DM_NHOM_TSCD.xlsx`: Mã nhóm, Tên nhóm), rồi file
   danh sách tài sản xuất từ phần mềm quản lý tài sản (`Du_lieu_tai_san_moi_…xlsx`). Nhập lại file mới là cập nhật theo mã tem,
   không xóa dữ liệu đang có. Thời gian nằm kho (đèn Vàng 3.1) tính từ ngày đưa vào sử dụng.
3. Trang **Tài khoản, mã xác nhận** → tab **Tài khoản cán bộ**: thêm cán bộ hoặc **Nhập Excel** danh sách cán bộ (có mã số
   cán bộ), rồi **Cấp tài khoản hàng loạt** và in danh sách tên đăng nhập, mật khẩu ban đầu gửi riêng từng người. Đặt vai trò
   kỹ thuật viên, lãnh đạo Phòng QTNL, quản trị (Phòng KHTC) ở nút **Sửa**; kỹ thuật viên, lãnh đạo được cấp mã xác nhận khi lưu.
4. Tab **Mã cán bộ đầu mối**: đơn vị chưa có mã hiện “Chưa cấp mã” → **Cấp mã**, chọn cán bộ đầu mối từ dữ liệu cán bộ.
5. Kỹ thuật viên, lãnh đạo Phòng QTNL đăng nhập tài khoản cá nhân → **Danh mục**: soạn nội dung báo hỏng theo nhóm tài sản,
   tình huống đang xảy ra (đánh dấu khẩn cấp), công việc sửa chữa (nhóm tính vào đèn hoặc bảo dưỡng, vật tư).
6. Ngưỡng cảnh báo mặc định theo mục 5.3 đề tài; Phòng KHTC đổi ở trang **Ngưỡng cảnh báo**.

## Giao diện (bố cục theo phần mềm quản lý tài sản đang dùng)

Để người dùng quen mắt, bố cục và cách trang trí theo phần mềm quản lý tài sản hiện có của Nhà trường (không đổi dữ liệu):
- Thanh menu ngang trên cùng (`pages/SamApp.js`): **☰ Bắt đầu ▾** mở toàn bộ chức năng; các chức năng chính xếp ngang có
  biểu tượng, ô số đỏ cho việc đang chờ; bên phải nền xanh lam đậm: ô **Menu** (gõ tên chức năng để mở nhanh), (?) Giải thích
  đèn, chuông, tài khoản.
- **Dải tab** xanh lam đậm: mỗi chức năng, mỗi hồ sơ phiếu (`Phiếu PH-…`), lý lịch tài sản là một tab, bấm × để đóng; chuyển
  tab vẫn giữ nguyên nội dung đang làm (tối đa 8 tab). Trang con đặt tên tab bằng `useTabTitle` (`utils/TabContext.js`).
- Đầu trang kiểu thanh công cụ (tên trang | các nút), nút viền xám; nút **Thêm**, **Báo hỏng** đỏ cam (`variant="create"`).
- Bảng lưới kẻ ô, tiêu đề đứng yên khi cuộn, ô chọn màu đỏ; phân trang **Trang [n] / N**, **1 - 50 trong N bản ghi**.
- **Thẻ tài sản** (trang Tài sản, trang của cán bộ đầu mối): bấm một dòng tô hồng, khung thông tin bên phải
  (`components/AssetPanel.js`: Barcode, trạng thái, nhóm, phòng ban, vị trí...; thẻ Thông tin / Sửa chữa / Đề xuất; nút Lý
  lịch, Báo hỏng, Lập đề xuất); bấm đúp mở lý lịch. Màn hình hẹp thì khung mở thành hộp thoại.
- Hộp thoại tiêu đề nền xanh lam đậm; phông hệ thống (Segoe UI trên Windows). Màn hình đăng nhập giữ thiết kế riêng.

## Tài khoản, đăng nhập (mục VII đề tài, bản 30/10/2026)

Mỗi cán bộ, giảng viên một **tài khoản cá nhân** do Phòng KHTC cấp: đăng nhập bằng tên đăng nhập, mật khẩu; lần đầu phải
đổi mật khẩu ban đầu. **Cán bộ, giảng viên không có mã xác nhận.** Phiên giữ không hạn (không phải đăng nhập lại). Mọi tài
khoản có quyền của cán bộ, giảng viên; Phòng KHTC đặt thêm vai trò:

| Vai trò | Màn hình chính |
|---|---|
| Cán bộ, giảng viên | Báo hỏng (họ tên tự điền theo tài khoản), Phiếu của tôi |
| Cán bộ đầu mối | Tài sản toàn trường (7 cột, lọc theo đơn vị), gửi danh sách đề xuất thanh lý, Đề xuất của đơn vị, Giải thích đèn |
| Kỹ thuật viên Phòng QTNL | Hàng chờ phiếu, Dự toán, Đề xuất xử lý (ghi ý kiến kỹ thuật khi được giao), Tài sản (+ Lập đề xuất) |
| Lãnh đạo Phòng QTNL | Chờ xác nhận: Dự toán, Hư hỏng toàn phần, Đề xuất xử lý tài sản |
| Quản trị (Phòng KHTC) | Tổng quan, Tài sản, Đề xuất xử lý (tiếp nhận), Đề nghị ngoại lệ, Tài khoản, mã xác nhận... |

Cơ chế phiên (`utils/api.js`, `utils/AuthContext.js`):
- Access Token (15 phút) chỉ giữ trong bộ nhớ, **không lưu localStorage**; Refresh Token nằm trong cookie HTTP-Only do máy
  chủ đặt (mã JavaScript không đọc được). Mọi yêu cầu gửi `credentials: 'include'`.
- Mở lại web: gọi `POST /auth/refresh-token`, phiên còn hiệu lực thì vào thẳng trang chủ theo vai trò. Access Token hết hạn
  khi đang làm việc (401 `token_expired`): tự làm mới rồi gửi lại yêu cầu.
- Ô đăng nhập có `autocomplete="username"`, `autocomplete="current-password"`; đổi mật khẩu dùng `autocomplete="new-password"`;
  ô mã xác nhận `autocomplete="off"`.
- Thao tác quan trọng cần **mã xác nhận cá nhân**: máy chủ trả 428 thì hộp `components/ConfirmCodeDialog.js` hỏi mã rồi gửi
  lại (sai mã thì hỏi lại). Menu tài khoản: Đổi mật khẩu, Đăng xuất trên mọi thiết bị, Đăng xuất.
- Khi chạy giao diện và backend khác địa chỉ (ví dụ `npm start` cổng 3000, backend 8000) dùng cùng tên máy `localhost` để
  cookie SameSite=Strict được gửi; triển khai thật đặt cùng tên miền qua nginx (`/api` chuyển về backend).

## Thông báo đẩy về điện thoại (nút chuông, mục 5.9)

- Trong chuông có công tắc **Thông báo về máy này** (`utils/push.js`): bấm để trình duyệt hỏi quyền, đăng ký Web Push với
  khóa VAPID của máy chủ; tắt là hủy đăng ký. Đăng xuất cũng tắt thông báo của tài khoản đó trên máy đó.
- `public/sw.js` nhận thông báo, bấm vào thì mở đúng màn hình (`/?go=<liên kết>`); `public/manifest.json` + biểu tượng để
  "Thêm vào Màn hình chính". iPhone, iPad cần iOS 16.4+ và mở SAM từ biểu tượng ngoài màn hình chính. Trang phải chạy HTTPS.
- Bấm một thông báo trong chuông cũng mở thẳng phiếu, dự toán, đề xuất tương ứng.

## Cột Đề xuất, Giải thích đèn

- Danh sách **Tài sản** có cột cuối **Đề xuất** (cố định bên phải khi cuộn ngang): đề xuất gần nhất, trạng thái, số ngày chờ,
  lý do nếu không duyệt; chưa có thì gợi ý theo màu đèn. Lọc được theo trạng thái đề xuất; xuất Excel có cột Đề xuất.
- `components/Proposals.js`: ô Đề xuất, hộp gửi đề xuất (nhiều tài sản, lý do từng dòng, chọn nhanh lý do, mã xác nhận),
  hộp quyết định của lãnh đạo (Duyệt / Cần kỹ thuật xem xét / Không duyệt bắt buộc lý do), ý kiến kỹ thuật, Phòng KHTC tiếp nhận.
- Trang **Giải thích đèn** (`pages/LightsGuidePage.js`): mỗi đèn một thẻ, điều kiện lấy theo ngưỡng Phòng KHTC đang đặt;
  biểu tượng (?) ở cột đèn mở trang này.

## Cấu trúc

```
fe_sam/
├── Dockerfile, .dockerignore, start.sh, nginx.conf, .npmrc, .env.example
├── tailwind.config.js         # Bảng màu, phông Be Vietnam Pro
├── public/index.html
└── src/
    ├── index.js, index.css    # index.css: biến màu --color-* cho ô đèn, quy tắc in
    ├── App.js                 # AuthProvider + ToastProvider + SamApp
    ├── config/
    │   ├── app.js             # Tên trường; ngày làm việc, năm chi phí, ngày chốt số liệu sổ sách (lấy theo máy chủ)
    │   └── api.js             # API_BASE_URL
    ├── hooks/useApi.js        # Gọi API, tự tải lại khi có thao tác ghi
    ├── utils/
    │   ├── api.js             # Gọi backend: catalogApi, assetsApi, reportsApi, estimatesApi, recallsApi…; refs (tra tên theo id)
    │   ├── AuthContext.js     # Đăng nhập 2 bước, đổi người, đăng xuất khi mã bị thu hồi
    │   ├── ToastContext.js    # Thông báo nhỏ góc dưới
    │   ├── lights.js          # Hàm tính đèn (bản gốc để so khớp bản Python của be_sam), dùng cho biểu mẫu in
    │   ├── forms.js           # Nội dung các biểu mẫu in, điền sẵn từ hồ sơ (theo Mẫu phiếu SAM)
    │   ├── xlsx.js            # Tạo file Excel .xlsx (jszip, nạp khi bấm tải)
    │   ├── exportSheets.js    # Nội dung các file Excel: đầu mối, danh sách tài sản, dự toán, tổng quan
    │   ├── formDocx.js        # Xuất biểu mẫu ra Word .docx (thư viện docx, nạp khi bấm)
    │   ├── FormViewerContext.js # Mở khung Biểu mẫu in từ bất kỳ trang nào
    │   ├── __fixtures__/      # Hồ sơ mẫu cố định chỉ dùng cho test hàm đèn, biểu mẫu
    │   └── format.js, labels.js
    ├── components/            # ui.js (nút, bảng, ô nhập, hộp thoại, FilePick tải bản quét lên máy chủ, FileLink mở bản quét),
    │                          # ImportButton.js (Nhập Excel), GroupFilter.js, Light.js, AssetPicker.js, EstimateEditor.js,
    │                          # StaffPicker.js, PeopleFields.js, FormSheet.js, FormViewer.js, FormButton.js, Toast.js
    └── pages/
        ├── SamApp.js          # Khung trang: menu trái theo vai trò (số việc chờ từ máy chủ), chuông, tài khoản
        ├── LoginPage.js       # Đăng nhập, chọn tên, nhập mã
        ├── ReportPage.js, MyReportsPage.js                 # Cán bộ, đầu mối
        ├── QueuePage.js, CasePage.js, EstimatesPage.js,    # Kỹ thuật viên, lãnh đạo QTNL
        │   ApprovalsPage.js, CatalogPage.js
        ├── DashboardPage.js, AssetsPage.js,                # Phòng KHTC (Phòng QTNL cũng xem Tài sản, Tổng quan)
        │   AssetDetailPage.js, ExceptionsPage.js, ThresholdsPage.js, FocalAccountsPage.js,
        │   HandoversPage.js, ExportLogsPage.js
        └── UnitAssetsPage.js                               # Cán bộ đầu mối đơn vị
```

Quy tắc nghiệp vụ (khóa phiếu dự toán, thiết bị tạm chỉ khi khẩn cấp, thu hồi 5 bước, không tự xác nhận phiếu mình lập,
đầu mối không thấy chi phí…) kiểm tra ở máy chủ; test ở `be_sam/tests`.

## Biểu mẫu in (điền sẵn)

Ở mỗi bước có nút **Xem phiếu / Xem biên bản / Biểu mẫu**, mở khung **Biểu mẫu in**: bên trái là các giấy tờ trong hồ sơ, bên phải là trang A4 đã điền sẵn dữ liệu.
Nút theo vai trò: **Phòng QTNL** có **In** và **Tải Word** (.docx) để in, ký; **Phòng KHTC** có **In**; **cán bộ, đầu mối** chỉ xem phiếu của mình. In hoặc tải Word được **cả hồ sơ**, mỗi biểu mẫu một trang. Mọi lần In, Tải Word ghi nhật ký theo người thao tác (trang **Nhật ký xuất file** của Phòng KHTC).

| Biểu mẫu | Số | Mở từ |
|---|---|---|
| Phiếu báo hỏng tài sản | PH-2026-xxxx | Sau khi gửi phiếu, Phiếu của tôi, hồ sơ phiếu bước 1 |
| Biên bản kiểm tra kỹ thuật | BB-xxxx | Hồ sơ phiếu bước 2, Chờ xác nhận (hư hỏng toàn phần) |
| Phiếu điều chuyển tạm thời | DC-TT-xxxx | Hồ sơ phiếu bước 3 |
| Phiếu dự toán chi phí sửa chữa, thay thế | DT-xxxx | Hồ sơ phiếu bước 4, Dự toán, Chờ xác nhận |
| Phiếu đề nghị ngoại lệ sửa chữa tài sản (không có ô giá mua mới; chi phí đã nằm trong dự toán) | NL-xxxx | Hồ sơ phiếu bước 4, Đề nghị ngoại lệ |
| Lý lịch sửa chữa tài sản | mã tài sản | Chi tiết tài sản |
| Biên bản giao nhận khi thu hồi tài sản hỏng (kỹ thuật viên lập); biên bản cấp phát, điều chuyển chính thức (Phòng KHTC lập, mở rộng) | BG-xxxx | Thu hồi tài sản hỏng; hồ sơ phiếu bước 5; chi tiết tài sản |

Bốn mẫu đầu theo đúng file *Mẫu phiếu SAM*; phiếu đề nghị ngoại lệ và lý lịch sửa chữa chưa có mẫu nên dựng cùng kiểu. Biên bản bàn giao theo mẫu của Nhà trường: quốc hiệu, đại diện bên giao, bên nhận, bảng tài sản, bốn chữ ký (bên nhận, Phòng QTNL, Phòng KHTC, bên giao). Cán bộ, giảng viên chỉ xem được phiếu báo hỏng của mình và phiếu cấp thiết bị tạm.

## Cán bộ đầu mối đơn vị (mục 5.8)

- Đăng nhập bằng tài khoản cá nhân; Phòng KHTC đặt vai trò bằng cách cấp mã đầu mối cho người đó (mỗi đơn vị một người).
- **Tài sản toàn trường** (`pages/UnitAssetsPage.js`): lọc theo đơn vị (mặc định đơn vị mình), màu đèn, vị trí; chỉ các cột
  màu đèn, mã tài sản, tên, phòng ban, vị trí, nguyên giá, Đề xuất. Máy chủ chỉ trả các trường này.
- **Tải Excel (.xlsx)** và **Tải PDF** (mở bản in, chọn Lưu dưới dạng PDF; `utils/printList.js`) danh sách đang lọc, có cột
  Kiểm kê (0, đánh 1 khi thấy), Ghi chú.
- Chọn tài sản của đơn vị mình (nút **Chọn tài sản đèn Đỏ của đơn vị**) → **Gửi danh sách đề xuất thanh lý lên Phòng KHTC**,
  nhập mã xác nhận; gửi xong tải PDF danh sách vừa gửi để lưu hồ sơ. Kết quả duyệt (kể cả lý do không duyệt) hiện ở cột Đề
  xuất và trang **Đề xuất của đơn vị**, kèm thông báo.
- Báo hỏng như mọi cán bộ; mọi lần xem, tải file ghi nhật ký theo tài khoản và mã đơn vị.
- Phát triển sau: kiểm kê trên SAM (cột 0/1, Hoàn thành kiểm kê bằng mã), giới hạn chỉ xem tài sản đơn vị mình.

## Thu hồi tài sản hỏng, thiết bị tạm, kho không có thiết bị thay thế, quyền xem

Hai việc “thu hồi” tách tên: **Thu hồi thiết bị tạm** (tài sản gốc sửa xong) và **Thu hồi tài sản hỏng về kho**.

- **Thu hồi tài sản hỏng về kho (5 bước)**, khi hư hỏng toàn phần đã xác nhận hoặc dự toán không được duyệt; lập ngay sau bước kiểm tra, nếu đã cấp thiết bị tạm thì chạy song song, không chờ: (1) Phòng QTNL đề nghị, chọn phương án dự kiến (chờ thanh lý, tận dụng linh kiện, sửa khi có kinh phí); (2) Phòng KHTC xác nhận hoặc không đồng ý kèm lý do; (3) kỹ thuật viên lập biên bản giao nhận, in, ký, nộp Phòng KHTC; (4) Phòng KHTC nhập điều chuyển chính thức (số văn bản, bản quét có thể đính kèm sau bằng nút **Đính kèm chứng từ**; phiếu chưa có bản quét hiện nhãn **Chưa có bản quét** trong danh sách thu hồi); (5) tài sản về kho, “Hỏng, đã thu hồi về kho, chờ phương án xử lý”, **giữ màu đèn lúc thu hồi, không tính Vàng 3.1**. Trong lúc chờ, tài sản hỏng giữ nguyên vị trí, đơn vị trên sổ; thiết bị tạm vẫn thuộc Kho QTNL và ở lại đơn vị đến khi có thiết bị mới. Theo dõi ở bước 5 của hồ sơ phiếu và menu **Thu hồi tài sản hỏng** (Phòng QTNL có danh sách tài sản đủ căn cứ mà chưa đề nghị).
- **Phòng KHTC chỉ xem** thao tác của Phòng QTNL: Hàng chờ phiếu, Đối chiếu chi phí (dự toán), hồ sơ phiếu gắn nhãn **Chỉ xem**, không có nút của QTNL. Riêng xác nhận thu hồi tài sản hỏng và nhập điều chuyển là việc của Phòng KHTC (làm ở trang Thu hồi tài sản hỏng hoặc bước 5 hồ sơ).
- **Mở rộng (ngoài ba vấn đề chính của đề tài)**: biên bản bàn giao khi cấp phát, điều chuyển chính thức, Phòng KHTC lập ở tab Biên bản giao nhận, bàn giao. Lưu là sổ tài sản cập nhật đơn vị, vị trí, ngày tương tác.
- **Xuất file**: đầu mối Excel (.xlsx) và PDF (chỉ các cột được xem, có cột Kiểm kê, Ghi chú); Phòng QTNL Tải Word phiếu, biên bản để in ký và Tải Excel (.xlsx) danh sách (Tài sản, Dự toán); Phòng KHTC Tải Excel (.xlsx) và In báo cáo (Tổng quan, Tài sản, Đối chiếu chi phí). Mọi lần xuất ghi nhật ký theo tài khoản của người thao tác (đầu mối ghi thêm theo mã đơn vị).
- **Thiết bị tạm chỉ khi khẩn cấp**: bước 3 hồ sơ phiếu (cấp thiết bị tạm, ghi nhận kho không có thiết bị) chỉ mở với phiếu khẩn cấp; phiếu thường hiện "Không áp dụng" (máy chủ từ chối phiếu không khẩn cấp).
- **Kho không có thiết bị thay thế**: ở bước 3 hồ sơ phiếu khẩn cấp, kỹ thuật viên bấm **Kho không có thiết bị**, ghi thiết bị cần cấp tạm (mặc định theo nhóm tài sản) và lý do (chọn nhanh hoặc gõ). Phòng KHTC xem tổng hợp theo loại thiết bị ở cuối trang Tổng quan, làm dữ liệu cho kế hoạch mua sắm thiết bị dự phòng.
- **Chọn nhanh trên phiếu báo hỏng**: danh sách hiện tượng theo nhóm tài sản và danh sách tình huống (Phòng QTNL sửa ở trang **Danh mục**: thêm, bỏ nội dung báo hỏng theo nhóm tài sản; thêm, bỏ tình huống, đánh dấu khẩn cấp (mục khẩn cấp luôn đứng đầu); thêm công việc sửa chữa, chọn nhóm chi phí, ngừng dùng); bấm nhiều mục được, bấm lại để bỏ; không đúng trường hợp thì gõ tay. Tình huống có chấm đỏ tự tích Khẩn cấp.

## Bổ sung theo đề tài (28/10)

- **Danh sách chờ thanh lý (mục 5.3)**: tài sản Đỏ 1.1, Đỏ 1.2 giữ đèn đỏ khi sang năm mới (nhãn "Giữ từ năm ..."). Phòng KHTC
  mở trang tài sản, khung **Tài sản trong danh sách chờ thanh lý**: **Đã thanh lý** (thôi tính đèn, vẫn lưu lịch sử, không
  báo hỏng được nữa) hoặc **Loại khỏi danh sách chờ thanh lý** (đèn tính lại), nhập căn cứ (số, ngày văn bản). Các quyết định
  hiện ở cuối trang tài sản. Tổng quan không tính tài sản đã thanh lý.
- **Gộp phiếu trùng (mục 5.3)**: hồ sơ phiếu chưa có biên bản, dự toán, thiết bị tạm có nút **Gộp phiếu trùng**: chọn phiếu
  chính cùng tài sản (phiếu chưa có mã thì cùng vị trí). Phiếu trùng theo trạng thái phiếu chính, chỉ phiếu chính lập biên
  bản, dự toán nên tính một lần sửa; người báo thấy "Gộp vào PH-..." ở **Phiếu của tôi** và nhận thông báo. **Bỏ gộp** khi phiếu
  chính chưa xong.
- **Sửa chi phí thực tế (mục IV, 5.5)**: dự toán đã có số thực tế có nút **Sửa chi phí thực tế**; lịch sử phiếu ghi người sửa,
  thời gian, số cũ, số mới, lý do; đèn tự tính lại.
- **Hóa đơn gộp (mục 5.5)**: khung nhập chi phí thực tế có ô **Tổng tiền hóa đơn**; gõ số hóa đơn đã dùng cho mã khác thì hiện
  tổng các mã, còn bao nhiêu chưa chia; vượt tổng hóa đơn thì không lưu được. Trang **Đối chiếu chi phí** của Phòng KHTC ghi
  "Hóa đơn gộp n mã" và báo khi tổng các mã chưa khớp tổng hóa đơn.
- **Số ngày chờ (mục 5.4)**: "Đã chờ n ngày" ở trang Dự toán, Chờ xác nhận, Đề nghị ngoại lệ; đề nghị ngoại lệ của phiếu khẩn
  cấp xếp lên đầu, có nhãn Khẩn cấp.
- **Tổng quan (mục VI)**: thêm bảng **Theo nhóm tài sản** và danh sách **Sửa chữa kéo dài (Vàng 3.3)**, có trong file Excel.
- **Chưa làm**: ngưỡng chi phí thực tế vượt dự toán phải ký bổ sung (mục 5.4, chờ Phòng KHTC chốt mức ngưỡng và cách ký;
  hiện chỉ báo số tiền vượt); ứng dụng AI (mục VI, đề xuất cho bản thử nghiệm).

## Dữ liệu cán bộ, mã xác nhận cá nhân

- **Dữ liệu cán bộ** do Phòng KHTC nhập (trang **Tài khoản, mã xác nhận**, tab **Tài khoản cán bộ**): họ tên, mã số cán bộ, đơn vị, chức vụ (chỉ để in biểu mẫu), số điện thoại, vai trò trên SAM, trạng thái tài khoản, mã xác nhận. "Lãnh đạo đơn vị" không phải vai trò của phần mềm. Nhập tay từng người hoặc **Nhập Excel** danh sách cán bộ (Mã số hiệu CBCCVC, Họ tên, Đơn vị, Chức vụ hiện tại). Sửa được nhóm của cán bộ: chuyển vào Phòng QTNL thì được cấp mã cá nhân, chuyển ra thì mã hết hiệu lực.
- **Báo hỏng**: Họ tên người báo tự điền theo tài khoản đang đăng nhập; kỹ thuật viên, lãnh đạo Phòng QTNL lập phiếu thay (nhận báo qua điện thoại) thì chọn người báo từ dữ liệu cán bộ (`StaffPicker`). Số điện thoại tự điền, sửa được.
- **Mã xác nhận cá nhân**: lãnh đạo Phòng QTNL, từng kỹ thuật viên, từng cán bộ đầu mối có mã riêng, khác mật khẩu. Nhập khi thao tác có giá trị xác nhận (gửi dự toán, nhập chi phí thực tế, xác nhận, trả lại, duyệt đề xuất, gửi danh sách đề xuất); ô nhập mã che thành dấu chấm, tắt gợi ý điền sẵn. Nhật ký ghi theo tài khoản.
- **Cán bộ đầu mối** chọn từ dữ liệu cán bộ; đổi người thì cấp mã mới, mã cũ hết hiệu lực.
- **Phòng QTNL xem toàn trường**: menu Phòng QTNL có **Tài sản** (theo màu đèn) và **Tổng quan**.
- **Lọc theo nhóm thiết bị** (trang **Tài sản** của Phòng KHTC, Phòng QTNL; `components/GroupFilter.js`): gõ để tìm nhóm theo mã hoặc tên (gõ không dấu cũng được), chọn một hoặc nhiều nhóm, mỗi nhóm kèm số tài sản khớp các điều kiện lọc khác; nhóm đang lọc hiện thành nhãn, bấm × để bỏ; chỉ liệt kê nhóm đang có tài sản. Tải Excel theo đúng các nhóm đang lọc.
