
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from api.v1.router import api_v1_router
from config import settings
from core.database import AsyncSessionLocal, init_db
from core.errors import ApiError
from services.seed_service import run_seed

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Tạo cơ sở dữ liệu, các bảng còn thiếu
    await init_db()
    # 2. Tạo tài khoản (mật khẩu trong .env) và ngưỡng mặc định nếu chưa có. Không nạp dữ liệu giả lập.
    async with AsyncSessionLocal() as db:
        await run_seed(db)
    # 3. Thư mục tệp tải lên
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Nén dữ liệu trả về (danh sách tài sản vài nghìn dòng)
app.add_middleware(GZipMiddleware, minimum_size=2000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Sau nginx: lấy địa chỉ máy người dùng từ X-Forwarded-For, chỉ tin các máy chuyển tiếp trong FORWARDED_ALLOW_IPS
# (dùng cho việc tạm khóa khi nhập sai mật khẩu, sai mã). Chạy bằng run.py hay Docker đều đọc từ .env.
app.add_middleware(
    ProxyHeadersMiddleware,
    trusted_hosts=[h.strip() for h in settings.FORWARDED_ALLOW_IPS.split(",") if h.strip()],
)


# Lỗi trả về một dạng thống nhất: {"message", "status_code", "reason", "details"}
@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.message, "status_code": exc.status_code, "reason": exc.reason},
    )


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": str(exc.detail), "status_code": exc.status_code, "reason": None},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "message": "Dữ liệu gửi lên chưa đúng hoặc còn thiếu",
            "status_code": 422,
            "reason": "validation",
            "details": [{"field": ".".join(str(x) for x in e["loc"][1:]), "error": e["msg"]} for e in exc.errors()],
        },
    )


@app.get("/health", tags=["Hệ thống"])
async def health():
    return {"status": "ok"}


app.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)
