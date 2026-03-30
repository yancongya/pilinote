"""
Setting数据模型

用于存储系统设置，支持分类管理和持久化。
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from src.database import Base


class Setting(Base):
    """设置模型"""
    
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True, comment="设置键名")
    value = Column(Text, nullable=False, comment="设置值")
    type = Column(String(20), nullable=False, comment="值类型: string, integer, boolean, json")
    category = Column(String(50), nullable=True, index=True, comment="设置分类: download, storage, general")
    description = Column(Text, nullable=True, comment="设置描述")
    default_value = Column(Text, nullable=True, comment="默认值")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    def to_dict(self):
        """转换为字典"""
        return {
            "id": self.id,
            "key": self.key,
            "value": self.value,
            "type": self.type,
            "category": self.category,
            "description": self.description,
            "default_value": self.default_value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    def get_parsed_value(self):
        """获取解析后的值"""
        if self.type == "integer":
            return int(self.value)
        elif self.type == "boolean":
            return self.value.lower() in ("true", "1", "yes")
        elif self.type == "json":
            import json
            return json.loads(self.value)
        else:  # string
            return self.value
    
    def __repr__(self):
        return f"<Setting(key={self.key}, value={self.value}, category={self.category})>"