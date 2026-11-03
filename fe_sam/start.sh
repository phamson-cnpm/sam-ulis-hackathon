
#!/usr/bin/env bash
set -euo pipefail

# ==============================================================
#  FRONTEND SAM (fe_sam) — build React rồi serve bằng nginx trong container
#  Chạy trong thư mục fe_sam/:   bash start.sh
#
#  PHẢI chạy SAU be_sam/start.sh.
#
#  Script này CHỈ đụng tới container/image tên sam-frontend.
#  Không xoá volume, không prune, không đụng container khác trên máy.
# ==============================================================

CONTAINER_NAME="sam-frontend"
IMAGE_NAME="sam-frontend-img"
NETWORK_NAME="sam_network"

BACKEND_CONTAINER="sam-backend"

HOST_PORT=8531
CONTAINER_PORT=80

# Để trống (khuyến nghị): giao diện gọi /api cùng địa chỉ trang, nginx.conf chuyển tiếp về backend.
# Giá trị này nhúng vào code lúc BUILD, đổi thì phải build lại.
REACT_APP_API_BASE_URL=""

echo "🚀 Bắt đầu build và chạy frontend SAM..."

echo "==== KIỂM TRA FILE CẦN THIẾT ===="
[ -f "package.json" ]      || { echo "❌ Không thấy package.json — chạy script TRONG thư mục fe_sam/"; exit 1; }
[ -f "package-lock.json" ] || { echo "❌ Không thấy package-lock.json (npm ci cần file này)"; exit 1; }
[ -f "Dockerfile" ]        || { echo "❌ Không thấy Dockerfile"; exit 1; }
[ -s "Dockerfile" ]        || { echo "❌ Dockerfile rỗng (0 byte) — chưa dán nội dung vào"; exit 1; }
[ -f "nginx.conf" ]        || { echo "❌ Không thấy nginx.conf"; exit 1; }
[ -s "nginx.conf" ]        || { echo "❌ nginx.conf rỗng (0 byte) — chưa dán nội dung vào"; exit 1; }

echo "==== KIỂM TRA BACKEND ===="
# nginx.conf trỏ proxy_pass tới http://sam-backend:8000 bằng TÊN CONTAINER.
# Backend chưa chạy thì nginx không phân giải được tên -> container tắt ngay.
if sudo docker ps --format '{{.Names}}' | grep -qx "$BACKEND_CONTAINER"; then
  sudo docker network connect "$NETWORK_NAME" "$BACKEND_CONTAINER" 2>/dev/null || true
  echo "✅ Thấy $BACKEND_CONTAINER"
else
  echo "❌ Chưa thấy container backend: $BACKEND_CONTAINER"
  echo "   Chạy be_sam/start.sh trước."
  exit 1
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

echo "==== BUILD IMAGE FRONTEND ===="
sudo docker build \
  --build-arg REACT_APP_API_BASE_URL="$REACT_APP_API_BASE_URL" \
  -t "$IMAGE_NAME" \
  .

echo "==== THAY CONTAINER FRONTEND CŨ ===="
sudo docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

echo "==== CHẠY CONTAINER FRONTEND ===="
# Bind 127.0.0.1: chỉ nginx trên máy chủ (gắn tên miền, HTTPS) mới ra được Internet.
# Muốn thử thẳng http://IP:8531 thì đổi thành:  -p "${HOST_PORT}:${CONTAINER_PORT}"
sudo docker run -d \
  --name "$CONTAINER_NAME" \
  --network "$NETWORK_NAME" \
  --restart unless-stopped \
  -p "127.0.0.1:${HOST_PORT}:${CONTAINER_PORT}" \
  "$IMAGE_NAME"

echo "==== ĐỢI FRONTEND KHỞI ĐỘNG ===="
for _ in {1..15}; do
  if curl -fsS "http://127.0.0.1:${HOST_PORT}/healthz" >/dev/null 2>&1; then
    echo "✅ Frontend đã chạy thành công"
    echo "   Nội bộ: http://127.0.0.1:${HOST_PORT}"

    NEW_IMAGE_ID=$(sudo docker image inspect -f '{{.Id}}' "$IMAGE_NAME")
    if [ -n "$OLD_IMAGE_ID" ] && [ "$OLD_IMAGE_ID" != "$NEW_IMAGE_ID" ]; then
      echo "🧹 Xoá image frontend cũ..."
      sudo docker image rm "$OLD_IMAGE_ID" >/dev/null 2>&1 || true
    fi
    exit 0
  fi
  sleep 2
done

echo "❌ Frontend chưa khởi động thành công"
echo "==== LOGS ===="
sudo docker logs "$CONTAINER_NAME" --tail=100
exit 1
