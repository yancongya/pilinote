"""
数据库迁移：添加错误详情字段

为tasks和downloads表添加error_detail字段以支持细粒度错误分类。
"""
import sys
import os

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from src.database import SessionLocal
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate():
    """执行数据库迁移"""
    db = SessionLocal()

    try:
        # 开始事务
        with db.begin():
            logger.info("开始数据库迁移：添加错误详情字段")

            # 检查tasks表是否已有error_detail字段
            result = db.execute(text("PRAGMA table_info(tasks)"))
            columns = [row[1] for row in result.fetchall()]

            if 'error_detail' not in columns:
                logger.info("为tasks表添加error_detail字段")
                db.execute(text(
                    "ALTER TABLE tasks ADD COLUMN error_detail JSON"
                ))
                logger.info("✓ tasks表error_detail字段添加成功")
            else:
                logger.info("tasks表已有error_detail字段，跳过")

            # 检查downloads表是否已有error_detail字段
            result = db.execute(text("PRAGMA table_info(downloads)"))
            columns = [row[1] for row in result.fetchall()]

            if 'error_detail' not in columns:
                logger.info("为downloads表添加error_detail字段")
                db.execute(text(
                    "ALTER TABLE downloads ADD COLUMN error_detail JSON"
                ))
                logger.info("✓ downloads表error_detail字段添加成功")
            else:
                logger.info("downloads表已有error_detail字段，跳过")

            logger.info("✅ 数据库迁移完成")

    except Exception as e:
        logger.error(f"❌ 数据库迁移失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()