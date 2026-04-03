from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

from src.config import settings

# 确保数据库目录存在
db_path = settings.database_url.replace("sqlite:///", "")
if db_path.startswith("./"):
    db_path = os.path.abspath(db_path)
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """创建所有数据库表"""
    from src.models.user import User
    from src.models.cookie import Cookie
    from src.models.download import Download
    from src.models.setting import Setting
    
    # 导入所有模型确保表定义被注册
    Base.metadata.create_all(bind=engine)


def table_exists(table_name: str) -> bool:
    """检查表是否存在"""
    with engine.connect() as conn:
        result = conn.execute(text(
            f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'"
        ))
        return result.fetchone() is not None


def create_missing_tables():
    """创建缺失的数据库表"""
    from src.models.cookie import Cookie
    from src.models.download import Download
    from src.models.setting import Setting
    
    # 创建cookies表
    if not table_exists('cookies'):
        Cookie.__table__.create(bind=engine)
        print("✅ Created 'cookies' table")
    else:
        print("ℹ️  'cookies' table already exists")
    
    # 创建downloads表
    if not table_exists('downloads'):
        Download.__table__.create(bind=engine)
        print("✅ Created 'downloads' table")
    else:
        print("ℹ️  'downloads' table already exists")
    
    # 创建settings表
    if not table_exists('settings'):
        Setting.__table__.create(bind=engine)
        print("✅ Created 'settings' table")
        # 初始化默认设置
        init_default_settings()
    else:
        print("ℹ️  'settings' table already exists")


def init_default_settings():
    """初始化默认设置"""
    import json
    from src.models.setting import Setting
    from datetime import datetime
    
    db = SessionLocal()
    try:
        # 下载设置
        default_settings = [
            {
                'key': 'download.default_quality',
                'value': '80',
                'type': 'integer',
                'category': 'download',
                'description': '默认视频质量',
                'default_value': '80'
            },
            {
                'key': 'download.max_concurrent',
                'value': '3',
                'type': 'integer',
                'category': 'download',
                'description': '最大并发下载数',
                'default_value': '3'
            },
            {
                'key': 'download.speed_limit',
                'value': '0',
                'type': 'integer',
                'category': 'download',
                'description': '速度限制(KB/s), 0表示不限制',
                'default_value': '0'
            },
            {
                'key': 'download.output_format',
                'value': 'mp4',
                'type': 'string',
                'category': 'download',
                'description': '输出格式',
                'default_value': 'mp4'
            },
            # 存储设置
            {
                'key': 'storage.download_path',
                'value': './downloads',
                'type': 'string',
                'category': 'storage',
                'description': '下载路径',
                'default_value': './downloads'
            },
            {
                'key': 'storage.temp_path',
                'value': './temp',
                'type': 'string',
                'category': 'storage',
                'description': '临时文件路径',
                'default_value': './temp'
            },
            {
                'key': 'storage.auto_cleanup',
                'value': 'true',
                'type': 'boolean',
                'category': 'storage',
                'description': '自动清理临时文件',
                'default_value': 'true'
            },
            {
                'key': 'storage.keep_failed',
                'value': 'false',
                'type': 'boolean',
                'category': 'storage',
                'description': '保留失败的任务',
                'default_value': 'false'
            },
            {
                'key': 'storage.sidecar',
                'value': json.dumps({
                    'ffmpeg': 'ffmpeg',
                    'aria2c': 'aria2c'
                }),
                'type': 'object',
                'category': 'storage',
                'description': 'Sidecar工具路径（命令名称或绝对路径）',
                'default_value': json.dumps({
                    'ffmpeg': 'ffmpeg',
                    'aria2c': 'aria2c'
                })
            },
            # 通用设置
            {
                'key': 'general.theme',
                'value': 'auto',
                'type': 'string',
                'category': 'general',
                'description': '主题设置',
                'default_value': 'auto'
            },
            {
                'key': 'general.language',
                'value': 'zh-CN',
                'type': 'string',
                'category': 'general',
                'description': '语言设置',
                'default_value': 'zh-CN'
            },
            {
                'key': 'general.auto_download',
                'value': 'false',
                'type': 'boolean',
                'category': 'general',
                'description': '自动下载',
                'default_value': 'false'
            },
            {
                'key': 'general.clipboard_monitor',
                'value': 'false',
                'type': 'boolean',
                'category': 'general',
                'description': '剪贴板监听',
                'default_value': 'false'
            }
        ]
        
        for setting_data in default_settings:
            # 检查是否已存在
            existing = db.query(Setting).filter(Setting.key == setting_data['key']).first()
            if not existing:
                setting = Setting(**setting_data)
                db.add(setting)
        
        db.commit()
        print("✅ Initialized default settings")
    except Exception as e:
        db.rollback()
        print(f"❌ Error initializing default settings: {e}")
    finally:
        db.close()