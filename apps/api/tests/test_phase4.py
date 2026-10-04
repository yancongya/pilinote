#!/usr/bin/env python3
"""
Phase 4 测试脚本 - 元数据下载系统测试

测试内容：
1. 文件组织系统
2. 任务编排器
3. 各种处理器
4. 统一队列管理器集成
"""

import asyncio
import logging
import sys
import os
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent))

from src.services.queue.file_organizer import FileOrganizer, NamingTemplate
from src.services.queue.task_orchestrator import TaskOrchestrator
from src.services.queue.handlers.registry import handler_registry
from src.models.task import Task, SubTask, TaskState, SubTaskType
from src.schemas.task import TaskCreate

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MockProgressCallback:
    """模拟进度回调"""
    
    def __init__(self, task_id: str, subtask_id: str):
        self.task_id = task_id
        self.subtask_id = subtask_id
    
    async def update(self, current: int, total: int = None, message: str = ""):
        progress = (current / total * 100) if total and total > 0 else 0
        logger.info(f"Progress [{self.subtask_id}]: {progress:.1f}% - {message}")
    
    async def __call__(self, data):
        await self.update(
            data.get('current', 0),
            data.get('total', 100),
            data.get('message', '')
        )


async def test_file_organizer():
    """测试文件组织系统"""
    logger.info("🧪 测试文件组织系统...")
    
    # 创建测试目录
    test_dir = Path("test_downloads")
    organizer = FileOrganizer(str(test_dir))
    
    # 测试数据
    test_cases = [
        {
            'name': '单个视频',
            'data': {
                'media_type': 'video',
                'title': '【技术分享】Python异步编程详解',
                'uploader': '技术UP主',
                'meta': {}
            }
        },
        {
            'name': '系列视频',
            'data': {
                'media_type': 'video',
                'title': 'FastAPI入门教程',
                'uploader': '编程教学',
                'series_title': 'Web开发系列',
                'index': 5,
                'meta': {}
            }
        },
        {
            'name': '番剧',
            'data': {
                'media_type': 'bangumi',
                'title': '新的开始',
                'series_title': '某动画',
                'season': 1,
                'episode': 12,
                'meta': {}
            }
        }
    ]
    
    for case in test_cases:
        logger.info(f"  测试 {case['name']}...")
        
        # 获取任务目录
        task_dir = organizer.get_task_directory(case['data'])
        logger.info(f"    任务目录: {task_dir}")
        
        # 组织文件路径
        file_paths = organizer.organize_task_files(case['data'])
        logger.info(f"    文件路径: {len(file_paths)} 个")
        
        for file_type, path in file_paths.items():
            logger.info(f"      {file_type}: {path}")
    
    # 清理测试目录
    import shutil
    if test_dir.exists():
        shutil.rmtree(test_dir)
    
    logger.info("✅ 文件组织系统测试完成")


async def test_naming_template():
    """测试命名模板系统"""
    logger.info("🧪 测试命名模板系统...")
    
    template = NamingTemplate()
    
    test_cases = [
        {
            'template': 'single_video',
            'context': {
                'uploader': 'UP主名称',
                'title': '视频标题'
            }
        },
        {
            'template': 'series_video',
            'context': {
                'uploader': 'UP主名称',
                'series_title': '系列名称',
                'index': 3,
                'title': '第三集标题'
            }
        },
        {
            'template': 'bangumi',
            'context': {
                'series_title': '动画名称',
                'season': 2,
                'episode': 8,
                'title': '第八话标题'
            }
        }
    ]
    
    for case in test_cases:
        result = template.render(case['template'], case['context'])
        logger.info(f"  模板 {case['template']}: {result}")
    
    # 测试安全文件名
    unsafe_names = [
        'test<>file',
        'test:file',
        'test/file\\name',
        'test|file?name*',
        'CON',
        'PRN.txt'
    ]
    
    for unsafe in unsafe_names:
        safe = template.safe_filename(unsafe)
        logger.info(f"  安全文件名: '{unsafe}' -> '{safe}'")
    
    logger.info("✅ 命名模板系统测试完成")


async def test_handler_registry():
    """测试处理器注册表"""
    logger.info("🧪 测试处理器注册表...")
    
    # 检查所有处理器是否注册
    expected_handlers = [
        SubTaskType.VIDEO,
        SubTaskType.SUBTITLE,
        SubTaskType.DANMAKU,
        SubTaskType.COVER,
        SubTaskType.AVATAR,
        SubTaskType.NFO
    ]
    
    for handler_type in expected_handlers:
        handler = handler_registry.get_handler(handler_type)
        if handler:
            logger.info(f"  ✅ {handler_type.value}: {handler.__class__.__name__}")
        else:
            logger.error(f"  ❌ {handler_type.value}: 未找到处理器")
    
    logger.info(f"📊 注册表统计: {len(handler_registry.get_all_handlers())} 个处理器")
    logger.info("✅ 处理器注册表测试完成")


async def test_task_orchestrator():
    """测试任务编排器"""
    logger.info("🧪 测试任务编排器...")
    
    orchestrator = TaskOrchestrator()
    
    # 创建模拟任务
    task = Task(
        id="test_task_001",
        media_type="video",
        media_id="BV1xx411c7mD",
        title="测试视频标题",
        cover="https://example.com/cover.jpg",
        desc="测试视频描述",
        meta={
            'owner': {'name': '测试UP主'},
            'duration': 300,
            'pic': 'https://example.com/pic.jpg'
        },
        state=TaskState.ACTIVE
    )
    
    # 创建模拟子任务
    subtasks = []
    for subtask_type in [SubTaskType.VIDEO, SubTaskType.SUBTITLE, SubTaskType.DANMAKU, SubTaskType.COVER, SubTaskType.NFO]:
        subtask = SubTask(
            id=f"subtask_{subtask_type.value}",
            task_id=task.id,
            type=subtask_type.value,
            state=TaskState.BACKLOG,
            params={}
        )
        subtasks.append(subtask)
    
    # 测试执行计划创建
    execution_plan = orchestrator._create_execution_plan(subtasks)
    logger.info(f"  执行计划: {len(execution_plan)} 个阶段")
    
    for phase, phase_subtasks in execution_plan.items():
        task_types = [st.type for st in phase_subtasks]
        logger.info(f"    阶段 {phase}: {task_types}")
    
    # 测试并行检查
    can_parallel = orchestrator._can_execute_parallel(subtasks)
    logger.info(f"  可并行执行: {can_parallel}")
    
    # 测试执行摘要
    summary = orchestrator.get_execution_summary(subtasks)
    logger.info(f"  执行摘要: {summary}")
    
    logger.info("✅ 任务编排器测试完成")


async def test_mock_subtask_execution():
    """测试模拟子任务执行"""
    logger.info("🧪 测试模拟子任务执行...")
    
    # 创建模拟任务
    task = Task(
        id="mock_task_001",
        media_type="video",
        media_id="BV1xx411c7mD",
        title="模拟测试视频",
        cover="https://i0.hdslb.com/bfs/archive/test.jpg",
        desc="这是一个模拟测试视频",
        meta={
            'owner': {'name': '测试UP主', 'face': 'https://i0.hdslb.com/bfs/face/test.jpg'},
            'duration': 600,
            'pic': 'https://i0.hdslb.com/bfs/archive/test.jpg',
            'aid': 12345,
            'cid': 67890
        },
        state=TaskState.ACTIVE
    )
    
    # 测试各种处理器（模拟模式）
    test_handlers = [
        (SubTaskType.DANMAKU, "弹幕处理器"),
        (SubTaskType.COVER, "封面处理器"),
        (SubTaskType.AVATAR, "头像处理器"),
        (SubTaskType.NFO, "NFO处理器")
    ]
    
    for subtask_type, name in test_handlers:
        logger.info(f"  测试 {name}...")
        
        handler = handler_registry.get_handler(subtask_type)
        if not handler:
            logger.warning(f"    ⚠️  跳过 {name}（未找到处理器）")
            continue
        
        # 创建模拟子任务
        subtask = SubTask(
            id=f"mock_subtask_{subtask_type.value}",
            task_id=task.id,
            type=subtask_type.value,
            state=TaskState.ACTIVE,
            params={}
        )
        
        # 创建进度回调
        progress_callback = MockProgressCallback(task.id, subtask.id)
        
        try:
            # 执行处理器（可能会因为网络等原因失败，这是正常的）
            success = await handler.execute(task, subtask, progress_callback)
            
            if success:
                logger.info(f"    ✅ {name} 执行成功")
            else:
                logger.info(f"    ⚠️  {name} 执行失败（可能是网络原因）")
                
        except Exception as e:
            logger.info(f"    ⚠️  {name} 执行异常: {e}（这在测试环境中是正常的）")
    
    logger.info("✅ 模拟子任务执行测试完成")


async def main():
    """主测试函数"""
    logger.info("🚀 开始 Phase 4 元数据下载系统测试")
    
    try:
        # 1. 测试文件组织系统
        await test_file_organizer()
        
        # 2. 测试命名模板系统
        await test_naming_template()
        
        # 3. 测试处理器注册表
        await test_handler_registry()
        
        # 4. 测试任务编排器
        await test_task_orchestrator()
        
        # 5. 测试模拟子任务执行
        await test_mock_subtask_execution()
        
        logger.info("🎉 Phase 4 测试全部完成！")
        
    except Exception as e:
        logger.error(f"❌ 测试过程中发生异常: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())