
#!/usr/bin/env bash
set -euo pipefail

# ==============================================================
#  BACKEND SAM (be_sam) — build và chạy FastAPI trong Docker
#  Chạy trong thư mục be_sam/:   bash start.sh
#
#  Script này CHỈ đụng tới container/image tên sam-backend.
#  Không xoá volume, không prune, không đụng container khác trên máy.
# ==============================================================

CONTAINER_NAME="sam-backend"
IMAGE_NAME="sam-backend-img"
NETWORK_NAME="sam_network"

HOST_PORT=8530
CONTAINER_PORT=8000

# Nằm NGOÀI container để build lại, xoá container không mất:
#   uploads/  bản quét biên bản, dự toán đã ký
#   data/     khoá JWT và khoá mã hoá mã xác nhận (MẤT LÀ KHÔNG XEM LẠI ĐƯỢC MÃ ĐÃ CẤP)
UPLOADS_HOST_DIR="$(pwd)/uploads"
DATA_HOST_DIR="$(pwd)/data"

echo "🚀 Bắt đầu build và chạy backend SAM..."

echo "==== KIỂM TRA FILE CẦN THIẾT ===="
[ -f "main.py" ]          || { echo "❌ Không thấy main.py — chạy script TRONG thư mục be_sam/"; exit 1; }
[ -f "requirements.txt" ] || { echo "❌ Không thấy requirements.txt"; exit 1; }
[ -f "Dockerfile" ]       || { echo "❌ Không thấy Dockerfile"; exit 1; }
[ -s "Dockerfile" ]       || { echo "❌ Dockerfile rỗng (0 byte) — chưa dán nội dung vào"; exit 1; }
[ -f ".env" ]             || { echo "❌ Không thấy .env — chép .env.example thành .env rồi điền"; exit 1; }

echo "==== KIỂM TRA CẤU HÌNH DỄ SAI ===="
grep -Eq '^APP_ENV="?production"?' .env \
  || echo "⚠️  APP_ENV chưa phải \"production\""

grep -Eqi '^DEBUG="?false"?' .env \
  || echo "⚠️  DEBUG chưa đặt false — lỗi máy chủ có thể lộ chi tiết"

# MySQL nằm trên máy chủ (ngoài container): phải gọi qua host.docker.internal
grep -Eq '^MYSQL_HOST="?host\.docker\.internal"?' .env \
  || echo "⚠️  MYSQL_HOST nên là \"host.docker.internal\" (MySQL nằm ngoài container)"

# Mật khẩu 4 tài khoản chỉ dùng ở lần chạy đầu; để trống thì tài khoản đó chưa được tạo
for key in ADMIN_PASSWORD CANBO_PASSWORD QTNL_PASSWORD FOCAL_PASSWORD; do
  if grep -Eq "^${key}=\"?\"?\s*$" .env || ! grep -q "^${key}=" .env; then
    echo "⚠️  ${key} trống — tài khoản này chưa được tạo (đã có rồi thì bỏ qua)"
  fi
done

# Sau nginx trong Docker: phải tin dải mạng Docker thì mới lấy đúng địa chỉ máy người dùng
if grep -q '^FORWARDED_ALLOW_IPS=' .env && ! grep -Eq '^FORWARDED_ALLOW_IPS=.*172\.' .env; then
  echo "⚠️  FORWARDED_ALLOW_IPS chưa có dải mạng Docker (ví dụ \"127.0.0.1,172.16.0.0/12\")"
  echo "    Thiếu thì mọi người dùng chung một địa chỉ: nhập sai 8 lần là khoá cả tài khoản dùng chung."
fi

echo "==== KIỂM TRA THƯ MỤC uploads/, data/ ===="
mkdir -p "$UPLOADS_HOST_DIR" "$DATA_HOST_DIR"
chmod 775 "$UPLOADS_HOST_DIR"
chmod 700 "$DATA_HOST_DIR"
[ -w "$UPLOADS_HOST_DIR" ] || { echo "❌ Không ghi được vào $UPLOADS_HOST_DIR"; ls -ld "$UPLOADS_HOST_DIR"; exit 1; }
[ -w "$DATA_HOST_DIR" ]    || { echo "❌ Không ghi được vào $DATA_HOST_DIR"; ls -ld "$DATA_HOST_DIR"; exit 1; }
if [ -f "$DATA_HOST_DIR/code_secret.key" ]; then
  echo "✅ Đã có khoá trong data/ (dùng tiếp)"
else
  echo "ℹ️  Chưa có khoá trong data/: backend tự tạo ở lần chạy này. SAO LƯU thư mục data/ sau khi chạy xong."
fi

echo "==== KIỂM TRA PORT ===="
if ss -tln 2>/dev/null | grep -q ":${HOST_PORT} "; then
  if sudo docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
    echo "ℹ️  Port ${HOST_PORT} đang do $CONTAINER_NAME giữ, sẽ thay bằng bản mới"
  else
    echo "❌ Port ${HOST_PORT} đang bị chương trình khác chiếm"
    echo "   Đổi HOST_PORT ở đầu file này sang số khác."
    exit 1
  fi
fi

echo "==== TẠO NETWORK NẾU CHƯA CÓ ===="
sudo docker network inspect "$NETWORK_NAME" >/dev/null 2>&1 \
  || sudo docker network create "$NETWORK_NAME"

OLD_IMAGE_ID=$(sudo docker image inspect -f '{{.Id}}' "$IMAGE_NAME" 2>/dev/null || true)

echo "==== BUILD IMAGE BACKEND ===="
sudo docker build -t "$IMAGE_NAME" .

echo "==== THAY CONTAINER BACKEND CŨ ===="
# Chỉ xoá đúng container tên sam-backend. Dữ liệu nằm ở MySQL (ngoài),
# uploads/ và data/ (trên máy chủ), nên xoá container không mất gì.
sudo docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo "==== CHẠY CONTAINER BACKEND ===="
# --env-file KHÔNG dùng: nó không hiểu dấu nháy trong .env.
# Gắn .env vào /app/.env để pydantic-settings tự đọc, xử lý dấu nháy đúng.
#
# --add-host: MySQL nằm ngoài container, .env đặt MYSQL_HOST="host.docker.internal".
# Thiếu cờ này thì tên đó không phân giải được.
sudo docker run -d \
  --name "$CONTAINER_NAME" \
  --network "$NETWORK_NAME" \
  --restart unless-stopped \
  --add-host=host.docker.internal:host-gateway \
  -v "$(pwd)/.env:/app/.env:ro" \
  -v "${UPLOADS_HOST_DIR}:/app/uploads" \
  -v "${DATA_HOST_DIR}:/app/data" \
  -p "127.0.0.1:${HOST_PORT}:${CONTAINER_PORT}" \
  "$IMAGE_NAME"

echo "==== ĐỢI BACKEND KHỞI ĐỘNG ===="
for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${HOST_PORT}/health" >/dev/null 2>&1; then
    echo "✅ Backend đã chạy thành công"
    echo "   Health: http://127.0.0.1:${HOST_PORT}/health"
    echo "   Docs  : http://127.0.0.1:${HOST_PORT}/docs"

    NEW_IMAGE_ID=$(sudo docker image inspect -f '{{.Id}}' "$IMAGE_NAME")
    if [ -n "$OLD_IMAGE_ID" ] && [ "$OLD_IMAGE_ID" != "$NEW_IMAGE_ID" ]; then
      echo "🧹 Xoá image backend cũ..."
      sudo docker image rm "$OLD_IMAGE_ID" >/dev/null 2>&1 || true
    fi
    exit 0
  fi
  sleep 2
done

echo "❌ Backend chưa khởi động thành công"
echo "==== LOGS ===="
LOGS=$(sudo docker logs "$CONTAINER_NAME" --tail=100 2>&1 || true)
echo "$LOGS"
if echo "$LOGS" | grep -q "Can't connect to MySQL"; then
  echo "👉 Container không tới được MySQL trên máy chủ. Kiểm tra:"
  echo "   - MySQL nghe ở địa chỉ Docker tới được: bind-address = 0.0.0.0 (hoặc 172.17.0.1) trong cấu hình MySQL"
  echo "   - Tường lửa cho mạng Docker vào cổng 3306"
fi
if echo "$LOGS" | grep -q "Access denied for user"; then
  echo "👉 Sai tài khoản MySQL, hoặc tài khoản chưa cho kết nối từ mạng Docker:"
  echo "   CREATE USER 'sam'@'172.%' IDENTIFIED BY '...'; GRANT ALL PRIVILEGES ON sam.* TO 'sam'@'172.%';"
fi
exit 1
