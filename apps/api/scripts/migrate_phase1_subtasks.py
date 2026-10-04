#!/usr/bin/env python3
"""
第一阶段迁移脚本 - 添加 subtasks 表和完善数据结构

这个脚本将：
1. 创建 subtasks 表
2. 为现有的 tasks 创建对应的子任务
3. 验证数据完整性
"""
import sys
from pathlib import Path
from datetime import datetime

# 添加apps/api到路径
sys.path.insert(0, str(Path(__file__).parent))

from src.database import Base, engine, SessionLocal
from src.models.task import Task, SubTask, TaskState, SubTaskType
from sqlalchemy import text


def create_subtasks_table():
    """创建 subtasks 表"""
    print("1. 创建 subtasks 表...")
    
    # 创建表
    Base.metadata.create_all(bind=engine)
    print("✅ subtasks 表创建成功")


def create_subtasks_for_existing_tasks():
    """为现有任务创建子任务"""
    print("\n2. 为现有任务创建子任务...")
    
    db = SessionLocal()
    try:
        # 获取所有现有任务
        tasks = db.query(Task).all()
        print(f"📊 找到 {len(tasks)} 个现有任务")
        
        created_count = 0
        
        for task in tasks:
            # 检查是否已有子任务
            existing_subtasks = db.query(SubTask).filter(SubTask.task_id == task.id).count()
            if existing_subtasks > 0:
                print(f"⏭️  任务 {task.id} 已有子任务，跳过")
                continue
            
            # 创建视频子任务（必须）
            video_subtask = SubTask(
                task_id=task.id,
                type=SubTaskType.VIDEO,
                state=task.state,  # 继承主任务状态
                progress=int(task.status.get('progress', 0)) if task.status else 0,
                params={
                    'quality': task.meta.get('quality', 80),
                    'codec': task.meta.get('codec', 'avc'),
                    'audio_bitrate': task.meta.get('audio_bitrate', 192)
                },
                created_at=task.created_at,
                updated_at=task.updated_at
            )
            db.add(video_subtask)
            
            # 创建其他子任务（默认启用）
            other_subtasks = [
                SubTask(
                    task_id=task.id,
                    type=SubTaskType.SUBTITLE,
                    state=TaskState.BACKLOG,
                    params={},
                    created_at=task.created_at,
                    updated_at=task.updated_at
                ),
                SubTask(
                    task_id=task.id,
                    type=SubTaskType.DANMAKU,
                    state=TaskState.BACKLOG,
                    params={},
                    created_at=task.created_at,
                    updated_at=task.updated_at
                ),
                SubTask(
                    task_id=task.id,
                    type=SubTaskType.COVER,
                    state=TaskState.BACKLOG,
                    params={},
                    created_at=task.created_at,
                    updated_at=task.updated_at
                ),
                SubTask(
                    task_id=task.id,
                    type=SubTaskType.NFO,
                    state=TaskState.BACKLOG,
                    params={},
                    created_at=task.created_at,
                    updated_at=task.updated_at
                )
            ]
            
            for subtask in other_subtasks:
                db.add(subtask)
            
            created_count += 1
            print(f"✅ 为任务 {task.title[:30]}... 创建了 5 个子任务")
        
        db.commit()
        print(f"\n✅ 成功为 {created_count} 个任务创建子任务")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 创建子任务失败: {e}")
        raise
    finally:
        db.close()


def verify_migration():
    """验证迁移结果"""
    print("\n3. 验证迁移结果...")
    
    db = SessionLocal()
    try:
        # 检查表是否存在
        tables = [row[0] for row in db.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]
        if 'subtasks' not in tables:
            raise Exception("subtasks 表未创建成功")
        print("✅ subtasks 表存在")
        
        # 检查数据完整性
        task_count = db.query(Task).count()
        subtask_count = db.query(SubTask).count()
        
        print(f"📊 任务数量: {task_count}")
        print(f"📊 子任务数量: {subtask_count}")
        
        if subtask_count == 0:
            print("⚠️  没有子任务数据")
            return
        
        # 检查每个任务都有子任务
        tasks_without_subtasks = []
        for task in db.query(Task).all():
            subtask_count_for_task = db.query(SubTask).filter(SubTask.task_id == task.id).count()
            if subtask_count_for_task == 0:
                tasks_without_subtasks.append(task.id)
        
        if tasks_without_subtasks:
            print(f"❌ 发现 {len(tasks_without_subtasks)} 个任务没有子任务")
            return False
        
        # 检查子任务类型分布
        print("\n📈 子任务类型分布:")
        for subtask_type in SubTaskType:
            count = db.query(SubTask).filter(SubTask.type == subtask_type.value).count()
            print(f"   {subtask_type.value}: {count}")
        
        # 检查子任务状态分布
        print("\n📈 子任务状态分布:")
        for state in TaskState:
            count = db.query(SubTask).filter(SubTask.state == state.value).count()
            if count > 0:
                print(f"   {state.name}: {count}")
        
        print("\n✅ 数据验证通过")
        return True
        
    except Exception as e:
        print(f"❌ 验证失败: {e}")
        return False
    finally:
        db.close()


def show_migration_summary():
    """显示迁移摘要"""
    print("\n" + "="*60)
    print("📋 第一阶段迁移摘要")
    print("="*60)
    
    db = SessionLocal()
    try:
        # 基本统计
        task_count = db.query(Task).count()
        subtask_count = db.query(SubTask).count()
        
        print(f"📊 总任务数: {task_count}")
        print(f"📊 总子任务数: {subtask_count}")
        
        if task_count > 0:
            print(f"📊 平均每个任务的子任务数: {subtask_count / task_count:.1f}")
        
        # 任务状态分布
        print("\n📈 任务状态分布:")
        for state in TaskState:
            count = db.query(Task).filter(Task.state == state.value).count()
            if count > 0:
                print(f"   {state.name}: {count}")
        
        # 媒体类型分布
        print("\n📺 媒体类型分布:")
        from sqlalchemy import func
        media_types = db.query(Task.media_type, func.count(Task.id)).group_by(Task.media_type).all()
        for media_type, count in media_types:
            print(f"   {media_type}: {count}")
        
        print("\n✅ 第一阶段迁移完成！")
        print("🚀 可以继续进行第二阶段重构")
        
    finally:
        db.close()


def main():
    """主函数"""
    print("🚀 开始第一阶段数据迁移...")
    print("="*60)
    
    try:
        # 1. 创建 subtasks 表
        create_subtasks_table()
        
        # 2. 为现有任务创建子任务
        create_subtasks_for_existing_tasks()
        
        # 3. 验证迁移结果
        success = verify_migration()
        
        if success:
            # 4. 显示摘要
            show_migration_summary()
        else:
            print("❌ 迁移验证失败，请检查数据")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)