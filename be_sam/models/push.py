from sqlalchemy import Column, DateTime, String, Text

from core.clock import now
from core.database import TABLE_OPTS, Base
from models.common import id_col


class PushSubscription(Base):
    """Đăng ký nhận thông báo đẩy (Web Push) của một người trên một thiết bị: bật ở nút chuông, tắt là xóa dòng.
    user_id: id cán bộ hoặc id tài khoản hệ thống (giống notifications.user_id)."""

    __tablename__ = "push_subscriptions"
    __table_args__ = TABLE_OPTS

    id = id_col()
    user_id = Column(String(36), nullable=False, index=True)
    endpoint = Column(Text, nullable=False)
    endpoint_hash = Column(String(64), nullable=False, unique=True)  # sha256 của endpoint, để tra và không trùng
    p256dh = Column(String(255), nullable=False)
    auth = Column(String(255), nullable=False)
    user_agent = Column(String(255), nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=now)
    last_error = Column(Text, nullable=True)
