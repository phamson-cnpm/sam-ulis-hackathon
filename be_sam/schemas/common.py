
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Trả và nhận tên trường dạng camelCase giống dữ liệu fe_sam đang dùng (createdAt, assetId...)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class ErrorResponse(BaseModel):
    message: str
    status_code: int
    reason: Optional[str] = None
    details: Optional[Any] = None


class OkResponse(CamelModel):
    success: bool = True
    message: str = ""
