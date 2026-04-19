from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, Enum, JSON
from src.database import Base


class AiNote(Base):
    """AI 笔记数据模型"""

    __tablename__ = "ai_notes"

    id = Column(String, primary_key=True)  # 笔记 ID (UUID)
    task_id = Column(String, nullable=True, index=True)  # 关联的任务 ID
    video_id = Column(String, nullable=True, index=True)  # 关联的视频 ID (downloads.id)

    # 笔记内容
    content = Column(Text)  # 生成的笔记内容 (Markdown)
    summary = Column(Text)  # AI 总结摘要
    mindmap_json = Column(JSON, nullable=True)  # 思维导图数据

    # 配置
    style = Column(String(50), nullable=True)  # 使用的风格
    formats = Column(JSON, nullable=True)  # 启用的格式
    pipeline_mode = Column(String(20), nullable=True, index=True)  # AI 笔记流水线模式

    # 任务状态
    status = Column(
        Enum("pending", "processing", "completed", "failed", name="ai_note_status"),
        default="pending",
        index=True,
    )

    # LLM 配置
    model_provider = Column(String(50), nullable=True)  # LLM 提供商
    model_name = Column(String(100), nullable=True)  # 模型名称

    # 错误信息
    error = Column(Text, nullable=True)  # 错误信息

    # 元数据
    meta = Column(JSON, nullable=True)  # 额外元数据

    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)  # 完成时间

    def __repr__(self):
        return (
            f"<AiNote(id={self.id}, video_id={self.video_id}, "
            f"style={self.style}, pipeline_mode={self.pipeline_mode}, status={self.status})>"
        )
