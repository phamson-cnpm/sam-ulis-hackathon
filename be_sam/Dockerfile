
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Ho_Chi_Minh

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Tách riêng để Docker giữ lớp đã cài: sửa code Python không phải cài lại thư viện
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# uploads/ (bản quét) và data/ (khóa JWT, khóa mã hóa mã xác nhận) gắn từ máy chủ lúc chạy (start.sh),
# xóa container hay build lại không mất
RUN mkdir -p /app/uploads /app/data

EXPOSE 8000

# Một tiến trình: bộ đếm tạm khóa khi nhập sai mật khẩu, sai mã nằm trong bộ nhớ của tiến trình.
# KHÔNG dùng `python run.py`: run.py bật reload khi DEBUG=true.
# Địa chỉ máy người dùng sau nginx: main.py đọc X-Forwarded-For theo FORWARDED_ALLOW_IPS trong .env.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--no-proxy-headers"]
