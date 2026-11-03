# SAM – Quản lý tài sản thông minh (Smart Asset Management)

Bản mẫu dự thi ULIS Hackathon 2026, đề tài do Phòng Kế hoạch - Tài chính đề xuất. SAM bổ sung vào phần mềm quản lý tài sản
hiện có của Trường: phiếu báo hỏng trực tuyến, chi phí sửa chữa, thay thế theo từng mã tài sản và hệ thống đèn cảnh báo
vòng đời. Bản mẫu chạy độc lập, không kết nối phần mềm quản lý tài sản đang vận hành.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `be_sam/` | Máy chủ: Python 3.12, FastAPI, SQLAlchemy 2 (bất đồng bộ), Alembic, MySQL hoặc MariaDB; thông báo đẩy bằng pywebpush |
| `fe_sam/` | Giao diện: React 19, Tailwind CSS, Recharts; service worker và manifest cho thông báo đẩy |

Chi tiết từng phần, danh sách API và cách chạy kiểm thử ở `be_sam/README.md` và `fe_sam/README.md`.

## Chạy nhanh

Cần Python 3.12, Node.js 22 và một máy chủ MySQL hoặc MariaDB.

```bash
# Máy chủ: http://localhost:8000/docs
cd be_sam
python -m venv venv && source venv/bin/activate     # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env                                 # điền kết nối cơ sở dữ liệu, mật khẩu tài khoản quản trị
python run.py                                        # lần đầu tự tạo cơ sở dữ liệu, bảng, tài khoản quản trị, ngưỡng mặc định

# Giao diện: http://localhost:3000
cd fe_sam
npm ci
npm start                                            # hoặc npm run build để triển khai
```

Có `Dockerfile` cho cả hai phần (`be_sam/start.sh`, `fe_sam/start.sh`, `fe_sam/nginx.conf`).

## Kiểm thử

```bash
cd be_sam && pytest -q          # 51 kiểm thử máy chủ (cần MySQL hoặc MariaDB, xem be_sam/README.md)
cd fe_sam && npm test           # 29 kiểm thử giao diện
```

## Dữ liệu

Kho mã nguồn không chứa dữ liệu thật của Trường, không chứa tệp `.env`, khóa bí mật (`be_sam/data/`) hay tệp đính kèm
(`be_sam/uploads/`). Dữ liệu trong `fe_sam/src/utils/__fixtures__/` và `be_sam/tests/fixtures/` là dữ liệu mẫu chỉ dùng
cho kiểm thử.
