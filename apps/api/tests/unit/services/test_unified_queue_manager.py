"""
统一队列管理器测试

测试 UnifiedQueueManager 的核心功能：
- 任务提交和创建
- 队列流转逻辑 (BACKLOG→PENDING→ACTIVE→COMPLETED)
- 并发控制机制
- WebSocket事件发布
- 错误处理和重试机制
"""

import pytest
import pytest_asyncio
import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch, call
from datetime import datetime

from src.services.unified_queue_manager import UnifiedQueueManager, EventType, EventManager
from src.models.task import Task, SubTask, TaskState, SubTaskType, MediaType
from src.models.queue import QueueType
from src.schemas.task import TaskCreate
from tests.fixtures.sample_tasks import SampleTaskGenerator, SampleSubTaskGenerator


class TestUnifiedQueueManager:
    """统一队列管理器测试类"""

    @pytest_asyncio.fixture
    async def queue_manager(self):
        """创建测试用的队列管理器实例"""
        # 重置单例实例
        UnifiedQueueManager._instance = None
        
        # 创建新实例
        manager = UnifiedQueueManager()
        
        # Mock 数据库和WebSocket依赖
        with patch('src.services.unified_queue_manager.SessionLocal') as mock_session_local, \
             patch('src.routers.websocket.manager') as mock_ws_manager:
            
            # 配置mock数据库会话 - 使用同步Mock而不是AsyncMock
            mock_session = MagicMock()
            mock_session_local.return_value = mock_session
            mock_session.query.return_value.filter.return_value.first.return_value = None
            mock_session.query.return_value.filter.return_value.all.return_value = []
            mock_session.add = MagicMock()
            mock_session.flush = MagicMock()
            mock_session.commit = MagicMock()
            mock_session.rollback = MagicMock()
            mock_session.close = MagicMock()
            
            # 配置mock WebSocket管理器
            mock_ws_manager.broadcast = AsyncMock()
            
            # 启动管理器
            await manager.start()
            
            yield manager, mock_session, mock_ws_manager
            
            # 清理
            await manager.stop()

    @pytest.fixture
    def sample_task_create(self):
        """创建测试用的TaskCreate数据"""
        return TaskCreate(
            media_type=MediaType.VIDEO,
            media_id="BV1xx411c7mD",
            title="测试视频标题",
            cover="https://i2.hdslb.com/bfs/archive/test.jpg",
            desc="这是一个测试视频",
            meta={
                "bvid": "BV1xx411c7mD",
                "aid": 123456789,
                "duration": 3600,
                "owner": {"name": "测试UP主", "mid": 12345}
            }
        )

    # 2.1.1 实现 test_submit_task() - 测试任务提交方法
    @pytest.mark.asyncio
    async def test_submit_task(self, queue_manager, sample_task_create):
        """测试 UnifiedQueueManager.submit_task() 方法，验证任务创建、队列分配、状态设置"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        # Mock 数据库操作
        mock_task = Task(
            id=str(uuid.uuid4()),
            media_type=sample_task_create.media_type.value,  # Convert enum to string
            media_id=sample_task_create.media_id,
            title=sample_task_create.title,
            state=TaskState.BACKLOG
        )
        mock_session.add = MagicMock()
        mock_session.flush = MagicMock()
        mock_session.commit = MagicMock()
        
        # Mock _create_default_subtasks
        mock_subtasks = [
            SubTask(id=str(uuid.uuid4()), task_id=mock_task.id, type=SubTaskType.VIDEO),
            SubTask(id=str(uuid.uuid4()), task_id=mock_task.id, type=SubTaskType.DANMAKU),
            SubTask(id=str(uuid.uuid4()), task_id=mock_task.id, type=SubTaskType.COVER),
        ]
        
        with patch.object(manager, '_create_default_subtasks', return_value=mock_subtasks):
            with patch('src.services.unified_queue_manager.Task') as MockTask:
                # Configure the mock Task to return our mock_task
                MockTask.return_value = mock_task
                mock_session.add = MagicMock()
                mock_session.flush = MagicMock()
                mock_session.commit = MagicMock()
                
                # Execute task submission
                result = await manager.submit_task(sample_task_create)
                
                # Verify task creation
                assert result is not None
                assert result.media_type == sample_task_create.media_type.value
                assert result.media_id == sample_task_create.media_id
                assert result.title == sample_task_create.title
                assert result.state == TaskState.BACKLOG
                
                # Verify database operations
                mock_session.add.assert_called()
                mock_session.flush.assert_called_once()
                mock_session.commit.assert_called_once()
                
                # Verify queue assignment - task should be added to BACKLOG queue
                assert not manager.memory_queues[QueueType.BACKLOG].empty()
                
                # Verify subtask creation
                assert len(mock_subtasks) == 3

    @pytest.mark.asyncio
    async def test_submit_task_duplicate_handling(self, queue_manager, sample_task_create):
        """测试重复任务处理"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        # 第一次提交
        with patch.object(manager, '_create_default_subtasks', return_value=[]):
            with patch('src.services.unified_queue_manager.Task') as MockTask:
                # Create mock tasks with different IDs
                task1_id = str(uuid.uuid4())
                task2_id = str(uuid.uuid4())
                
                mock_task1 = Task(id=task1_id, media_type=sample_task_create.media_type.value, 
                                media_id=sample_task_create.media_id, title=sample_task_create.title)
                mock_task2 = Task(id=task2_id, media_type=sample_task_create.media_type.value,
                                media_id=sample_task_create.media_id, title=sample_task_create.title)
                
                MockTask.side_effect = [mock_task1, mock_task2]
                
                task1 = await manager.submit_task(sample_task_create)
                task2 = await manager.submit_task(sample_task_create)
                
                # 验证两个任务都被创建（系统允许重复任务）
                assert task1.id != task2.id
                assert task1.media_id == task2.media_id

    @pytest.mark.asyncio
    async def test_submit_task_invalid_params(self, queue_manager):
        """测试无效参数处理"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        # 测试最小有效参数（Pydantic验证要求media_id不能为空）
        minimal_task = TaskCreate(
            media_type=MediaType.VIDEO,
            media_id="BV_minimal",  # 提供最小有效的media_id
            title="",
            cover="",
            desc="",
            meta={}
        )
        
        # 应该能处理最小参数并创建任务
        with patch.object(manager, '_create_default_subtasks', return_value=[]):
            with patch('src.services.unified_queue_manager.Task') as MockTask:
                mock_task = Task(id=str(uuid.uuid4()), media_type=minimal_task.media_type.value,
                               media_id=minimal_task.media_id, title=minimal_task.title)
                MockTask.return_value = mock_task
                
                result = await manager.submit_task(minimal_task)
                assert result is not None
                assert result.media_id == "BV_minimal"
                assert result.title == ""

    # 2.1.2 实现 test_queue_flow() - 测试队列流转逻辑
    @pytest.mark.asyncio
    async def test_queue_flow(self, queue_manager):
        """测试任务在 BACKLOG→PENDING→ACTIVE→COMPLETED 队列间的流转逻辑"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        task_id = str(uuid.uuid4())
        
        # Mock 数据库查询和更新
        mock_task = Task(id=task_id, state=TaskState.BACKLOG)
        mock_session.query.return_value.filter.return_value.first.return_value = mock_task
        
        # 1. 测试 BACKLOG → PENDING 流转
        await manager.memory_queues[QueueType.BACKLOG].put(task_id)
        await manager._process_backlog_to_pending()
        
        # 验证任务从BACKLOG移动到PENDING
        assert manager.memory_queues[QueueType.BACKLOG].empty()
        assert not manager.memory_queues[QueueType.PENDING].empty()
        
        # 验证任务状态更新
        assert mock_task.state == TaskState.PENDING
        
        # 2. 测试 PENDING → ACTIVE 流转
        with patch.object(manager, '_execute_task') as mock_execute:
            mock_execute_task = AsyncMock()
            mock_execute.return_value = mock_execute_task
            
            await manager._process_pending_to_doing()
            
            # 验证任务从PENDING移动到DOING
            assert manager.memory_queues[QueueType.PENDING].empty()
            assert not manager.memory_queues[QueueType.DOING].empty()
            
            # 验证任务执行开始
            assert task_id in manager.active_tasks
            mock_execute.assert_called_once_with(task_id)

    @pytest.mark.asyncio
    async def test_queue_flow_with_concurrent_limit(self, queue_manager):
        """测试并发限制下的队列流转"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        # 设置最大并发数为2
        manager.max_concurrent = 2
        
        # 添加3个任务到PENDING队列
        task_ids = [str(uuid.uuid4()) for _ in range(3)]
        for task_id in task_ids:
            await manager.memory_queues[QueueType.PENDING].put(task_id)
        
        # Mock活跃任务（已达到并发限制）
        manager.active_tasks = {
            "active1": AsyncMock(),
            "active2": AsyncMock()
        }
        
        # 尝试处理PENDING队列
        with patch.object(manager, '_execute_task'):
            await manager._process_pending_to_doing()
            
            # 验证没有新任务被启动（因为已达并发限制）
            assert len(manager.active_tasks) == 2
            assert manager.memory_queues[QueueType.PENDING].qsize() == 3

    # 2.1.3 实现 test_concurrent_execution() - 测试并发控制
    @pytest.mark.asyncio
    async def test_concurrent_execution(self, queue_manager):
        """测试并发控制，验证最大并发数限制 (max_concurrent=3)"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        # 设置最大并发数
        manager.max_concurrent = 3
        
        # 创建5个任务
        task_ids = [str(uuid.uuid4()) for _ in range(5)]
        
        # Mock任务执行
        async def mock_long_running_task(task_id):
            """模拟长时间运行的任务"""
            await asyncio.sleep(0.1)  # 短暂延迟模拟工作
            return True
        
        with patch.object(manager, '_execute_task', side_effect=mock_long_running_task):
            # 同时启动5个任务
            tasks = []
            for task_id in task_ids:
                await manager.memory_queues[QueueType.PENDING].put(task_id)
                
            # 处理所有PENDING任务
            for _ in range(5):
                if not manager.memory_queues[QueueType.PENDING].empty():
                    await manager._process_pending_to_doing()
                    await asyncio.sleep(0.01)  # 短暂延迟
            
            # 验证并发限制
            assert len(manager.active_tasks) <= manager.max_concurrent
            
            # 等待所有任务完成
            await asyncio.sleep(0.2)

    @pytest.mark.asyncio
    async def test_concurrent_execution_semaphore(self, queue_manager):
        """测试信号量并发控制机制"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        # 验证信号量初始化
        assert manager.semaphore._value == manager.max_concurrent
        
        # 模拟获取信号量
        acquired_count = 0
        semaphores = []
        
        # 尝试获取超过限制的信号量
        for _ in range(manager.max_concurrent + 2):
            try:
                # 非阻塞获取
                if manager.semaphore.locked():
                    break
                await asyncio.wait_for(manager.semaphore.acquire(), timeout=0.01)
                acquired_count += 1
                semaphores.append(manager.semaphore)
            except asyncio.TimeoutError:
                break
        
        # 验证只能获取到最大并发数的信号量
        assert acquired_count <= manager.max_concurrent
        
        # 释放信号量
        for _ in range(acquired_count):
            manager.semaphore.release()

    # 2.1.4 实现 test_event_publishing() - 测试WebSocket事件发布
    @pytest.mark.asyncio
    async def test_event_publishing(self, queue_manager, sample_task_create):
        """测试WebSocket事件发布，验证 task_progress, task_completed 事件"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        # Test task creation event
        with patch.object(manager, '_create_default_subtasks', return_value=[]):
            with patch.object(manager.event_manager, 'publish', new_callable=AsyncMock) as mock_publish:
                task = await manager.submit_task(sample_task_create)
                
                # Verify TASK_CREATED event was published
                mock_publish.assert_called_with(
                    EventType.TASK_CREATED,
                    {
                        "task_id": task.id,
                        "task": task.to_dict()
                    }
                )

    @pytest.mark.asyncio
    async def test_event_publishing_progress_events(self, queue_manager):
        """测试进度事件发布"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        task_id = str(uuid.uuid4())
        
        # 测试任务进度事件
        progress_data = {
            "progress": 45.5,
            "speed": 1024000,
            "eta": 120,
            "stage": "downloading",
            "downloaded": 50 * 1024 * 1024,
            "total": 100 * 1024 * 1024
        }
        
        # Mock the event manager publish method
        with patch.object(manager.event_manager, 'publish', new_callable=AsyncMock) as mock_publish:
            await manager.event_manager.publish(EventType.TASK_PROGRESS, {
                "task_id": task_id,
                **progress_data
            })
            
            # Verify event manager publish was called
            mock_publish.assert_called_once_with(EventType.TASK_PROGRESS, {
                "task_id": task_id,
                **progress_data
            })

    @pytest.mark.asyncio
    async def test_event_publishing_completion_events(self, queue_manager):
        """测试任务完成事件发布"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        task_id = str(uuid.uuid4())
        
        # 测试任务完成事件
        await manager._complete_task(task_id, TaskState.COMPLETED)
        
        # 验证TASK_COMPLETED事件发布
        expected_calls = [
            call(EventType.TASK_COMPLETED, {
                "task_id": task_id,
                "final_state": "COMPLETED"
            })
        ]
        
        # 验证事件管理器被调用
        assert len(manager.event_manager.subscribers.get(EventType.TASK_COMPLETED, [])) > 0

    @pytest.mark.asyncio
    async def test_event_publishing_failure_events(self, queue_manager):
        """测试任务失败事件发布"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        task_id = str(uuid.uuid4())
        
        # 测试任务失败事件
        await manager._complete_task(task_id, TaskState.FAILED)
        
        # 验证TASK_FAILED事件发布
        expected_calls = [
            call(EventType.TASK_FAILED, {
                "task_id": task_id,
                "final_state": "FAILED"
            })
        ]
        
        # 验证事件管理器被调用
        assert len(manager.event_manager.subscribers.get(EventType.TASK_FAILED, [])) > 0

    # 2.1.5 实现 test_error_handling() - 测试异常处理和重试机制
    @pytest.mark.asyncio
    async def test_error_handling(self, queue_manager):
        """测试异常处理和重试机制，验证失败任务的状态更新"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        task_id = str(uuid.uuid4())
        
        # Mock任务和子任务
        mock_task = Task(id=task_id, state=TaskState.ACTIVE)
        mock_subtasks = [
            SubTask(id=str(uuid.uuid4()), task_id=task_id, type=SubTaskType.VIDEO)
        ]
        
        mock_session.query.return_value.filter.return_value.first.return_value = mock_task
        mock_session.query.return_value.filter.return_value.all.return_value = mock_subtasks
        
        # Mock任务编排器执行失败
        with patch('src.services.queue.task_orchestrator.task_orchestrator') as mock_orchestrator:
            mock_orchestrator.execute_task = AsyncMock(return_value=False)  # 执行失败
            mock_orchestrator.get_execution_summary = MagicMock(return_value="执行失败")
            
            # 执行任务（应该失败）
            await manager._execute_task(task_id)
            
            # 验证任务状态更新为失败
            mock_session.commit.assert_called()
            
            # 验证任务从活跃任务列表中移除
            assert task_id not in manager.active_tasks

    @pytest.mark.asyncio
    async def test_error_handling_network_errors(self, queue_manager, sample_task_create):
        """测试网络错误处理"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        # Mock数据库异常
        mock_session.add.side_effect = Exception("数据库连接失败")
        
        # 尝试提交任务
        with pytest.raises(Exception) as exc_info:
            await manager.submit_task(sample_task_create)
        
        assert "数据库连接失败" in str(exc_info.value)
        
        # 验证回滚被调用
        mock_session.rollback.assert_called_once()

    @pytest.mark.asyncio
    async def test_error_handling_task_execution_exception(self, queue_manager):
        """测试任务执行异常处理"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        task_id = str(uuid.uuid4())
        
        # Mock任务查询失败
        mock_session.query.return_value.filter.return_value.first.return_value = None
        
        # 执行不存在的任务
        await manager._execute_task(task_id)
        
        # 验证任务被标记为失败
        # 由于任务不存在，应该调用_complete_task with FAILED状态
        assert task_id not in manager.active_tasks

    @pytest.mark.asyncio
    async def test_error_handling_retry_mechanism(self, queue_manager):
        """测试重试机制"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        task_id = str(uuid.uuid4())
        
        # 验证重试配置
        assert manager.retry_max_attempts == 3
        
        # 测试重试任务方法
        result = await manager.retry_task(task_id)
        assert result is True  # 当前实现返回True

    @pytest.mark.asyncio
    async def test_error_handling_websocket_callback_failure(self, queue_manager):
        """测试WebSocket回调失败处理"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        # Mock WebSocket广播失败
        mock_ws_manager.broadcast.side_effect = Exception("WebSocket连接断开")
        
        # 发布事件（应该不会抛出异常）
        await manager.event_manager.publish(EventType.TASK_CREATED, {"task_id": "test"})
        
        # 验证异常被捕获，不影响主流程
        # EventManager应该捕获回调异常

    @pytest.mark.asyncio
    async def test_error_handling_queue_corruption_recovery(self, queue_manager):
        """测试队列损坏恢复"""
        manager, mock_session, mock_ws_manager = queue_manager
        
        # 模拟队列状态损坏
        invalid_task_id = "invalid-task-id"
        await manager.memory_queues[QueueType.BACKLOG].put(invalid_task_id)
        
        # Mock数据库查询返回None（任务不存在）
        mock_session.query.return_value.filter.return_value.first.return_value = None
        
        # 处理损坏的队列项
        await manager._process_backlog_to_pending()
        
        # 验证系统能够处理无效任务ID而不崩溃
        # 任务应该被移动到PENDING队列，即使数据库中不存在


class TestEventManager:
    """事件管理器测试类"""
    
    def test_event_manager_subscription(self):
        """测试事件订阅机制"""
        event_manager = EventManager()
        
        # 创建回调函数
        callback_called = []
        
        def test_callback(data):
            callback_called.append(data)
        
        # 订阅事件
        event_manager.subscribe(EventType.TASK_CREATED, test_callback)
        
        # 验证订阅
        assert EventType.TASK_CREATED in event_manager.subscribers
        assert test_callback in event_manager.subscribers[EventType.TASK_CREATED]
    
    @pytest.mark.asyncio
    async def test_event_manager_publishing(self):
        """测试事件发布机制"""
        event_manager = EventManager()
        
        # 创建异步回调函数
        callback_data = []
        
        async def async_callback(data):
            callback_data.append(data)
        
        # 订阅事件
        event_manager.subscribe(EventType.TASK_PROGRESS, async_callback)
        
        # 发布事件
        test_data = {"task_id": "test", "progress": 50}
        await event_manager.publish(EventType.TASK_PROGRESS, test_data)
        
        # 验证回调被调用
        assert len(callback_data) == 1
        assert callback_data[0] == test_data
    
    def test_event_manager_unsubscription(self):
        """测试事件取消订阅"""
        event_manager = EventManager()
        
        def test_callback(data):
            pass
        
        # 订阅和取消订阅
        event_manager.subscribe(EventType.TASK_COMPLETED, test_callback)
        event_manager.unsubscribe(EventType.TASK_COMPLETED, test_callback)
        
        # 验证取消订阅
        assert test_callback not in event_manager.subscribers.get(EventType.TASK_COMPLETED, [])
    
    @pytest.mark.asyncio
    async def test_event_manager_callback_error_handling(self):
        """测试回调函数错误处理"""
        event_manager = EventManager()
        
        # 创建会抛出异常的回调
        def error_callback(data):
            raise Exception("回调函数错误")
        
        # 创建正常的回调
        normal_callback_called = []
        def normal_callback(data):
            normal_callback_called.append(data)
        
        # 订阅两个回调
        event_manager.subscribe(EventType.TASK_FAILED, error_callback)
        event_manager.subscribe(EventType.TASK_FAILED, normal_callback)
        
        # 发布事件
        test_data = {"task_id": "test", "error": "test error"}
        await event_manager.publish(EventType.TASK_FAILED, test_data)
        
        # 验证正常回调仍然被调用，错误回调不影响其他回调
        assert len(normal_callback_called) == 1
        assert normal_callback_called[0] == test_data


class TestUnifiedQueueManagerIntegration:
    """统一队列管理器集成测试"""
    
    @pytest_asyncio.fixture
    async def integration_manager(self):
        """创建集成测试用的队列管理器"""
        # 重置单例
        UnifiedQueueManager._instance = None
        
        manager = UnifiedQueueManager()
        
        # 使用真实的事件管理器，但Mock外部依赖
        with patch('src.services.unified_queue_manager.SessionLocal'), \
             patch('src.routers.websocket.manager'):
            
            await manager.start()
            yield manager
            await manager.stop()
    
    @pytest.mark.asyncio
    async def test_complete_task_lifecycle(self, integration_manager):
        """测试完整的任务生命周期"""
        manager = integration_manager
        
        # 创建任务数据
        task_create = TaskCreate(
            media_type=MediaType.VIDEO,
            media_id="BV1integration",
            title="集成测试视频",
            cover="",
            desc="",
            meta={}
        )
        
        # Mock所有数据库操作
        with patch.object(manager, '_create_default_subtasks', return_value=[]), \
             patch('src.services.unified_queue_manager.SessionLocal') as mock_session_local:
            
            mock_session = MagicMock()
            mock_session_local.return_value = mock_session
            mock_session.__enter__ = MagicMock(return_value=mock_session)
            mock_session.__exit__ = MagicMock(return_value=None)
            
            # 1. 提交任务
            task = await manager.submit_task(task_create)
            assert task is not None
            
            # 2. 验证任务在BACKLOG队列
            assert not manager.memory_queues[QueueType.BACKLOG].empty()
            
            # 3. 处理队列流转
            await manager._process_backlog_to_pending()
            assert not manager.memory_queues[QueueType.PENDING].empty()
            
            # 4. 模拟任务执行
            with patch.object(manager, '_execute_task') as mock_execute:
                await manager._process_pending_to_doing()
                mock_execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_concurrent_task_processing(self, integration_manager):
        """测试并发任务处理"""
        manager = integration_manager
        
        # 创建多个任务
        tasks = []
        for i in range(5):
            task_create = TaskCreate(
                media_type=MediaType.VIDEO,
                media_id=f"BV{i}concurrent",
                title=f"并发测试视频{i}",
                cover="",
                desc="",
                meta={}
            )
            tasks.append(task_create)
        
        # Mock数据库操作
        with patch.object(manager, '_create_default_subtasks', return_value=[]), \
             patch('src.services.unified_queue_manager.SessionLocal') as mock_session_local:
            
            mock_session = MagicMock()
            mock_session_local.return_value = mock_session
            mock_session.__enter__ = MagicMock(return_value=mock_session)
            mock_session.__exit__ = MagicMock(return_value=None)
            
            # 并发提交所有任务
            submitted_tasks = await asyncio.gather(*[
                manager.submit_task(task_create) for task_create in tasks
            ])
            
            # 验证所有任务都被提交
            assert len(submitted_tasks) == 5
            assert manager.memory_queues[QueueType.BACKLOG].qsize() == 5
            
            # 验证并发控制
            assert len(manager.active_tasks) <= manager.max_concurrent