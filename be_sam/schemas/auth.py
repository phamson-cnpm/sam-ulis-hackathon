from typing import Literal, Optional

from pydantic import Field

from schemas.common import CamelModel

Role = Literal["khtc", "canbo", "ktv", "lanhdao_qtnl", "daumoi"]


class LoginRequest(CamelModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class PasswordRequest(CamelModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=1, max_length=128)


class UserOut(CamelModel):
    """Người đang thao tác, cùng dạng đối tượng user của fe_sam."""

    id: str
    name: str
    unit: str = ""
    position: str = ""
    phone: str = ""
    email: str = ""
    role: Role
    staff_code: Optional[str] = None
    group: Optional[str] = None
    username: Optional[str] = None
    focal_unit: Optional[str] = None


class SessionOut(CamelModel):
    """account_kind staff: cán bộ đăng nhập bằng tài khoản cá nhân; account: tài khoản hệ thống admin (Phòng KHTC).
    must_change_password: phải đổi mật khẩu ban đầu trước khi làm việc."""

    account_kind: Literal["staff", "account"]
    user: UserOut
    must_change_password: bool = False


class TokenOut(SessionOut):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
