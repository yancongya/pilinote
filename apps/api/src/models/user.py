from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from src.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    mid = Column(Integer, unique=True, index=True, nullable=False)
    username = Column(String(100), nullable=False)
    avatar = Column(String(500))
    sessdata = Column(Text, nullable=False)
    bili_jct = Column(Text)
    dedeuserid = Column(Text)
    access_token = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)