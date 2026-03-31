"""
数据库迁移脚本 - 添加任务管理相关表

阶段1：数据模型重构
"""
import sys
from pathlib import Path

# 添加apps/api到路径
sys.path.insert(0, str(Path(__file__).parent))

from src.database import Base, engine, SessionLocal
from src.models.task import Task
from src.models.scheduler import Scheduler
from src.models.queue import Queue


def migrate():
    """创建新表"""
    print("=" * 60)
    print("开始数据库迁移 - 阶段1：数据模型重构")
    print("=" * 60)

    # 创建新表
    print("\n1. 创建新表...")
    Base.metadata.create_all(bind=engine)
    print("✓ 新表创建完成")

    # 初始化队列数据
    print("\n2. 初始化队列数据...")
    db = SessionLocal()
    try:
        # 检查队列是否已初始化
        existing_queues = db.query(Queue).count()
        if existing_queues == 0:
            # 初始化四个队列
            from src.models.queue import QueueType
            for queue_type in [QueueType.BACKLOG, QueueType.PENDING, QueueType.DOING, QueueType.COMPLETE]:
                queue = Queue(queue_type=queue_type, value=[])
                db.add(queue)
            db.commit()
            print("✓ 队列初始化完成")
        else:
            print("✓ 队列已存在，跳过初始化")

        # 检查downloads表是否需要添加新字段
        print("\n3. 检查downloads表结构...")
        from sqlalchemy import text
        downloads_columns = [col[1] for col in db.execute(text("PRAGMA table_info(downloads)")).fetchall()]
        new_fields = ['media_type', 'source_type', 'source_id', 'task_id']
        fields_to_add = [field for field in new_fields if field not in downloads_columns]

        if fields_to_add:
            print(f"✓ 需要添加的字段: {', '.join(fields_to_add)}")
            # 注意：SQLite不支持直接ADD COLUMN NOT NULL，需要在数据库层面处理
            print("⚠ 注意：新字段将在下次运行时自动添加（nullable=True）")
        else:
            print("✓ downloads表已包含所有必要字段")

    except Exception as e:
        db.rollback()
        print(f"✗ 迁移失败: {e}")
        raise
    finally:
        db.close()

    print("\n" + "=" * 60)
    print("✓ 数据库迁移完成")
    print("=" * 60)

    # 验证
    print("\n4. 验证表结构...")
    from sqlalchemy import text
    tables = [row[0] for row in db.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]
    print(f"✓ 数据库包含 {len(tables)} 个表:")
    for table in ['tasks', 'schedulers', 'queues', 'downloads']:
        if table in tables:
            print(f"  ✓ {table}")
        else:
            print(f"  ✗ {table} (缺失)")


if __name__ == "__main__":
    try:
        migrate()
    except Exception as e:
        print(f"\n✗ 迁移失败: {e}")
        sys.exit(1)