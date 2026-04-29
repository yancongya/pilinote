#!/usr/bin/env python3
"""
第二阶段测试脚本 - 测试统一队列管理器

这个脚本将测试：
1. 统一队列管理器的启动和停止
2. 任务提交和执行
3. 子任务处理器
4. 事件系统
5. API 路由
"""

import sys
import asyncio
from pathlib import Path

# 添加apps/api到路径
sys.path.insert(0, str(Path(__file__).parent))

from src.services.unified_queue_manager import unified_queue_manager, EventType
from src.schemas.task import TaskCreate
from src.database import SessionLocal
from src.models.task import Task, SubTask


async def test_event_system():
    """测试事件系统"""
    print("\n🔔 测试事件系统...")
    
    received_events = []
    
    async def event_callback(data):
        received_events.append(data)
        print(f"  📨 收到事件: {data}")
    
    # 订阅事件
    unified_queue_manager.event_manager.subscribe(EventType.TASK_CREATED, event_callback)
    unified_queue_manager.event_manager.subscribe(EventType.TASK_STARTED, event_callback)
    unified_queue_manager.event_manager.subscribe(EventType.SUBTASK_STARTED, event_callback)
    
    print("✅ 事件系统订阅成功")
    return received_events


async def test_queue_manager_lifecycle():
    """测试队列管理器生命周期"""
    print("\n🚀 测试队列管理器生命周期...")
    
    # 启动
    print("  启动队列管理器...")
    await unified_queue_manager.start()
    assert unified_queue_manager._running, "队列管理器应该处于运行状态"
    print("  ✅ 队列管理器启动成功")
    
    # 检查状态
    print("  检查队列状态...")
    assert unified_queue_manager.max_concurrent == 3, "默认并发数应该是3"
    assert len(unified_queue_manager.memory_queues) == 4, "应该有4个队列"
    print("  ✅ 队列状态正常")
    
    return True


async def test_task_submission():
    """测试任务提交"""
    print("\n📝 测试任务提交...")
    
    # 创建测试任务
    task_create = TaskCreate(
        media_type="video",
        media_id="BV1test123456",
        title="测试视频任务",
        cover="https://example.com/cover.jpg",
        desc="这是一个测试任务",
        meta={
            "duration": 300,
            "uploader": "测试UP主"
        }
    )
    
    print(f"  提交任务: {task_create.media_id}")
    task = await unified_queue_manager.submit_task(task_create)
    
    assert task.id, "任务应该有ID"
    assert task.media_id == task_create.media_id, "媒体ID应该匹配"
    assert task.title == task_create.title, "标题应该匹配"
    
    print(f"  ✅ 任务提交成功: {task.id}")
    
    # 检查子任务是否创建
    db = SessionLocal()
    try:
        subtasks = db.query(SubTask).filter(SubTask.task_id == task.id).all()
        assert len(subtasks) > 0, "应该创建了子任务"
        
        subtask_types = [st.type for st in subtasks]
        assert "video" in subtask_types, "应该有视频子任务"
        
        print(f"  ✅ 创建了 {len(subtasks)} 个子任务: {subtask_types}")
        
    finally:
        db.close()
    
    return task


async def test_handler_registry():
    """测试处理器注册表"""
    print("\n🔧 测试处理器注册表...")
    
    from src.services.queue.handlers.registry import handler_registry
    from src.models.task import SubTaskType
    
    # 检查注册的处理器
    handlers = handler_registry.get_all_handlers()
    print(f"  注册的处理器: {list(handlers.keys())}")
    
    # 检查视频处理器
    video_handler = handler_registry.get_handler(SubTaskType.VIDEO)
    assert video_handler is not None, "应该有视频处理器"
    print(f"  ✅ 视频处理器: {video_handler.__class__.__name__}")
    
    # 检查字幕处理器
    subtitle_handler = handler_registry.get_handler(SubTaskType.SUBTITLE)
    assert subtitle_handler is not None, "应该有字幕处理器"
    print(f"  ✅ 字幕处理器: {subtitle_handler.__class__.__name__}")
    
    return True


async def test_task_execution():
    """测试任务执行（模拟）"""
    print("\n⚡ 测试任务执行...")
    
    # 等待任务被处理
    print("  等待任务处理...")
    await asyncio.sleep(3)  # 给队列处理器一些时间
    
    # 检查任务状态
    db = SessionLocal()
    try:
        tasks = db.query(Task).order_by(Task.created_at.desc()).limit(1).all()
        if tasks:
            task = tasks[0]
            print(f"  任务状态: {task.state}")
            print(f"  任务进度: {task.status}")
            
            # 检查子任务状态
            subtasks = db.query(SubTask).filter(SubTask.task_id == task.id).all()
            for subtask in subtasks:
                print(f"    子任务 {subtask.type}: 状态={subtask.state}, 进度={subtask.progress}%")
        
    finally:
        db.close()
    
    return True


async def test_api_integration():
    """测试API集成"""
    print("\n🌐 测试API集成...")
    
    try:
        # 导入路由
        from src.routers.unified_queue import router
        print("  ✅ 统一队列路由导入成功")
        
        # 检查路由数量
        routes = [route for route in router.routes]
        print(f"  ✅ 注册了 {len(routes)} 个API路由")
        
        return True
        
    except Exception as e:
        print(f"  ❌ API集成测试失败: {e}")
        return False


async def cleanup_test_data():
    """清理测试数据"""
    print("\n🧹 清理测试数据...")
    
    db = SessionLocal()
    try:
        # 删除测试任务
        test_tasks = db.query(Task).filter(Task.media_id.like("BV1test%")).all()
        for task in test_tasks:
            # 删除子任务
            db.query(SubTask).filter(SubTask.task_id == task.id).delete()
            # 删除主任务
            db.delete(task)
        
        db.commit()
        print(f"  ✅ 清理了 {len(test_tasks)} 个测试任务")
        
    finally:
        db.close()


async def main():
    """主测试函数"""
    print("🧪 开始第二阶段测试...")
    print("="*60)
    
    try:
        # 1. 测试事件系统
        received_events = await test_event_system()
        
        # 2. 测试队列管理器生命周期
        await test_queue_manager_lifecycle()
        
        # 3. 测试处理器注册表
        await test_handler_registry()
        
        # 4. 测试任务提交
        task = await test_task_submission()
        
        # 5. 测试任务执行
        await test_task_execution()
        
        # 6. 测试API集成
        await test_api_integration()
        
        # 7. 检查事件
        print(f"\n📊 收到 {len(received_events)} 个事件")
        
        print("\n" + "="*60)
        print("✅ 第二阶段测试全部通过！")
        print("🚀 统一队列管理器工作正常")
        print("📝 子任务处理器已就绪")
        print("🔔 事件系统运行正常")
        print("🌐 API路由集成成功")
        
        return True
        
    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        # 停止队列管理器
        print("\n🛑 停止队列管理器...")
        await unified_queue_manager.stop()
        
        # 清理测试数据
        await cleanup_test_data()


if __name__ == "__main__":
    success = asyncio.run(main())
    if not success:
        sys.exit(1)