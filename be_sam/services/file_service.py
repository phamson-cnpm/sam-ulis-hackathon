
"""Tệp tải lên: bản quét biên bản kiểm tra, dự toán đã ký, văn bản phê duyệt ngoại lệ, biên bản giao nhận."""
import os
import uuid

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from core import clock
from core.deps import Actor
from core.errors import bad
from models import StoredFile

ALLOWED = {".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}


async def save_upload(db: AsyncSession, actor: Actor, upload: UploadFile) -> dict:
    name = os.path.basename(upload.filename or "tep")
    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED:
        raise bad("Chỉ nhận bản quét PDF, JPG, PNG")
    data = await upload.read()
    if not data:
        raise bad("Tệp rỗng")
    if len(data) > settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024:
        raise bad(f"Tệp lớn hơn {settings.MAX_UPLOAD_SIZE_MB} MB")
    now = clock.now()
    rel = os.path.join(f"{now:%Y}", f"{now:%m}", f"{uuid.uuid4().hex}{ext}")
    path = os.path.join(settings.UPLOAD_DIR, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    sf = StoredFile(original_name=name, stored_path=rel, mime=ALLOWED[ext], size=len(data), uploaded_by=actor.id, uploaded_at=now)
    db.add(sf)
    await db.flush()
    return {"id": sf.id, "name": sf.original_name}


def file_path(sf: StoredFile) -> str:
    return os.path.join(settings.UPLOAD_DIR, sf.stored_path)
