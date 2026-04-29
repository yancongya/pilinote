#!/usr/bin/env python3
"""
数据迁移验证脚本
运行此脚本验证第一阶段迁移是否成功
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent / "apps" / "api"))

from src.database import SessionLocal
from src.models.task import Task, TaskState
from src.models.download import Download  # 迁移前的模型

def verify_phase1_migration():
    """验证第一阶段数据迁移"""
    print("🔍 开始验证第一阶段数据迁移...")
    
    with SessionLocal() as db:
        try:
            # 1. 检查表是否存在
            print("📋 检查表结构...")
            task_count = db.query(Task).count()
            print(f"✅ Tasks 表: {task_count} 条记录")
            
            # 2. 检查数据完整性
            print("🔍 检查数据完整性...")
            
            # 检查必要字段
            tasks_without_media_id = db.query(Task).filter(Task.media_id.is_(None)).count()
            if tasks_without_media_id > 0:
                print(f"❌ 发现 {tasks_without_media_id} 个任务缺少 media_id")
                return False
            
            tasks_without_title = db.query(Task).filter(Task.title.is_(None)).count()
            if tasks_without_title > 0:
                print(f"❌ 发现 {tasks_without_title} 个任务缺少 title")
                return False
            
            print("✅ 所有任务都有必要字段")
            
            # 3. 检查状态分布
            print("📊 任务状态分布:")
            for state in TaskState:
                count = db.query(Task).filter(Task.state == state.value).count()
                print(f"   {state.name}: {count}")
            
            # 4. 检查 JSON 字段
            print("🔍 检查 JSON 字段...")
            tasks_with_meta = db.query(Task).filter(Task.meta != {}).count()
            print(f"✅ {tasks_with_meta} 个任务有元数据")
            
            tasks_with_status = db.query(Task).filter(Task.status != {}).count()
            print(f"✅ {tasks_with_status} 个任务有状态信息")
            
            # 5. 检查时间戳
            print("🕐 检查时间戳格式...")
            import time
            current_time = int(time.time())
            
            invalid_timestamps = db.query(Task).filter(
                (Task.created_at > current_time) | (Task.created_at < 1000000000)
            ).count()
            
            if invalid_timestamps > 0:
                print(f"❌ 发现 {invalid_timestamps} 个无效时间戳")
                return False
            
            print("✅ 时间戳格式正确")
            
            print("\n🎉 第一阶段数据迁移验证通过！")
            print(f"📈 成功迁移 {task_count} 个下载任务")
            
            return True
            
        except Exception as e:
            print(f"❌ 验证过程中出错: {e}")
            return False

def show_migration_summary():
    """显示迁移摘要"""
    print("\n" + "="*50)
    print("📋 第一阶段迁移摘要")
    print("="*50)
    
    with SessionLocal() as db:
        # 任务统计
        total_tasks = db.query(Task).count()
        print(f"📊 总任务数: {total_tasks}")
        
        # 媒体类型分布
        print("\n📺 媒体类型分布:")
        media_types = db.query(Task.media_type, db.func.count(Task.id)).group_by(Task.media_type).all()
        for media_type, count in media_types:
            print(f"   {media_type}: {count}")
        
        # 状态分布
        print("\n📈 状态分布:")
        for state in TaskState:
            count = db.query(Task).filter(Task.state == state.value).count()
            if count > 0:
                print(f"   {state.name}: {count}")
        
        # 调度器关联
        scheduled_tasks = db.query(Task).filter(Task.scheduler_id.isnot(None)).count()
        print(f"\n🔗 关联调度器的任务: {scheduled_tasks}")

if __name__ == "__main__":
    success = verify_phase1_migration()
    if success:
        show_migration_summary()
        print("\n✅ 可以继续进行第二阶段重构")
    else:
        print("\n❌ 请修复数据问题后再继续")
        sys.exit(1)