
FROM node:22-alpine AS build

WORKDIR /app

# .npmrc bật legacy-peer-deps (react-scripts 5 chưa khai báo hỗ trợ React 19)
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

# Biến REACT_APP_* được NHÚNG VÀO CODE lúc build. Truyền lúc docker run là vô nghĩa.
# Để trống: giao diện gọi /api/v1 cùng địa chỉ trang, nginx.conf chuyển tiếp về container sam-backend.
ARG REACT_APP_API_BASE_URL=""
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

RUN npm run build

# ---------- Serve ----------
FROM nginx:1.27-alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
