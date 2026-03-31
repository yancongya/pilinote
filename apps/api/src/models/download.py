from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, Enum
from src.database import Base

class Download(Base):

    """下载任务数据模型"""

    __tablename__ = "downloads"

    id = Column(String, primary_key=True)  # 下载任务ID (UUID)

    bvid = Column(String(20), nullable=False, index=True)  # B站视频ID

    title = Column(String(500))  # 视频标题

    

    # 任务状态

    status = Column(

        Enum("pending", "queued", "downloading", "paused", "processing", "completed", "failed", "cancelled", name="download_status"),

        default="pending",

        index=True

    )

    progress = Column(Float, default=0.0)  # 下载进度 0.0 - 100.0

    

    # 进度追踪

    downloaded_bytes = Column(Integer, default=0)  # 已下载字节数

    total_bytes = Column(Integer, default=0)  # 总字节数

    download_speed = Column(Float, default=0.0)  # 下载速度 (KB/s)

    eta = Column(Float, default=0.0)  # 预计剩余时间 (秒)

    

    # B站特定字段

    cid = Column(Integer)  # 视频CID

    aid = Column(Integer)  # 视频AID

    quality = Column(Integer, default=64)  # 视频质量 (16=360P, 32=480P, 64=720P, 80=1080P, 112=1080P+, 116=4K)

    output_format = Column(String(10), default="mp4")  # 输出格式

    audio_bitrate = Column(Integer, default=192)  # 音频码率

    codec = Column(String(10), default="avc")  # 视频编码

    

    # 元数据

    thumbnail_url = Column(String(500))  # 视频封面URL

    duration = Column(Integer)  # 视频时长 (秒)

    uploader = Column(String(100))  # UP主名称

    uploader_mid = Column(Integer)  # UP主 MID

    

    # 文件管理

    

    file_path = Column(String(500))  # 文件保存路径

    

    file_size = Column(Integer, default=0)  # 文件大小

    

    temp_file_path = Column(String(500))  # 临时文件路径（下载完成前使用）

    

    # 错误处理

    error_message = Column(Text)  # 错误信息

    retry_count = Column(Integer, default=0)  # 重试次数

    

    # 用户关联

    sessdata = Column(Text)  # 用户SESSDATA (用于认证)

    

    # 时间戳

    created_at = Column(DateTime, default=datetime.utcnow, index=True)  # 创建时间

    started_at = Column(DateTime)  # 开始下载时间

    completed_at = Column(DateTime)  # 完成时间

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # 更新时间

    

    def __repr__(self):

        return f"<Download(id={self.id}, bvid={self.bvid}, title={self.title}, status={self.status}, progress={self.progress}% )>"