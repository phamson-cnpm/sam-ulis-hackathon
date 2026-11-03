
import os
import sys

# Chạy được từ bất kỳ thư mục nào: đưa thư mục be_sam vào sys.path và làm thư mục làm việc
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

import uvicorn  # noqa: E402

from config import settings  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        proxy_headers=False,  # main.py tự đọc X-Forwarded-For theo FORWARDED_ALLOW_IPS trong .env
    )
