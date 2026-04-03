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

    aid = Column(Integer, nullable=True)  # 视频AID（用于系列视频）

    # 新增字段：视频类型和来源
    media_type = Column(String(20), nullable=True, index=True)  # MediaType
    source_type = Column(String(20), nullable=True)  # 来源类型：favorite/watchlater/direct
    source_id = Column(String(50), nullable=True)  # 来源ID：收藏夹ID等

    # 关联任务ID
    task_id = Column(String(50), nullable=True, index=True)  # 关联到tasks表

    quality = Column(Integer, default=64)  # 视频质量 (16=360P, 32=480P, 64=720P, 80=1080P, 112=1080P+, 116=4K)

    output_format = Column(String(10), default="mp4")  # 输出格式

    audio_bitrate = Column(Integer, default=192)  # 音频码率

    codec = Column(String(10), default="avc")  # 视频编码

    

    # 元数据

    thumbnail_url = Column(String(500))  # 视频封面URL

    duration = Column(Integer)  # 视频时长 (秒)

    uploader = Column(String(100))  # UP主名称

    uploader_mid = Column(Integer)  # UP主 MID

    # 元数据设置

    enable_nfo = Column(Integer, default=1)  # 启用NFO元数据文件 (0=false, 1=true)

    enable_subtitle = Column(Integer, default=1)  # 下载字幕 (0=false, 1=true)

    enable_cover = Column(Integer, default=1)  # 下载封面图片 (0=false, 1=true)

    enable_avatar = Column(Integer, default=1)  # 下载UP主头像 (0=false, 1=true)

    block_pcdn = Column(Integer, default=1)  # 阻止PCDN (0=false, 1=true)

    

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