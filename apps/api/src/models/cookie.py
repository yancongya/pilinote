"""
Cookie数据模型

用于持久化存储用户的cookie，支持多账号管理。
"""
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from src.database import Base


class Cookie(Base):
    """Cookie模型"""
    
    __tablename__ = "cookies"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True, index=True, comment="用户ID，多账号支持")
    name = Column(String(100), nullable=False, index=True, comment="Cookie名称")
    value = Column(String(2000), nullable=False, comment="Cookie值")
    domain = Column(String(200), nullable=True, comment="Cookie域名")
    path = Column(String(200), nullable=True, comment="Cookie路径")
    expires_at = Column(Integer, nullable=True, comment="过期时间戳")
    created_at = Column(Integer, server_default=func.strftime('%s', 'now'), comment="创建时间")
    updated_at = Column(Integer, server_default=func.strftime('%s', 'now'), onupdate=func.strftime('%s', 'now'), comment="更新时间")
    
    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "value": self.value,
            "domain": self.domain,
            "path": self.path,
            "expires_at": self.expires_at,
            "created_at": self.created_at,
            "updated_at": self.updated_at
        }
    
    def __repr__(self):
        return f"<Cookie(id={self.id}, name={self.name}, user_id={self.user_id})>"