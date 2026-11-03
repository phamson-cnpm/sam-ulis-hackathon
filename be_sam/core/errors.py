
"""Lỗi nghiệp vụ trả về giao diện: {"message": "...", "status_code": ..., "reason": ...}.

message giữ đúng câu tiếng Việt mà fe_sam đang hiện, để thông báo trên giao diện không đổi.
"""
from typing import Optional


class ApiError(Exception):
    def __init__(self, message: str, status_code: int = 400, reason: Optional[str] = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.reason = reason


def bad(message: str, reason: Optional[str] = None) -> ApiError:
    return ApiError(message, 400, reason)


def not_found(message: str) -> ApiError:
    return ApiError(message, 404, "not_found")


def forbidden(message: str = "Tài khoản không có quyền thao tác này", reason: str = "forbidden") -> ApiError:
    return ApiError(message, 403, reason)


def unauthorized(message: str = "Phiên đăng nhập đã hết hạn, đăng nhập lại", reason: str = "unauthorized") -> ApiError:
    return ApiError(message, 401, reason)
