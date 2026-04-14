"""
并发控制服务测试
"""
import asyncio
import pytest
import logging
from datetime import datetime

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

from src.services.concurrency_control import (
    concurrency_control,
    ConcurrencyControlService,
    ResourceType,
    PSUTIL_AVAILABLE as SERVICE_PSUTIL_AVAILABLE
)

logger = logging.getLogger(__name__)


class TestConcurrencyControlService:
    """并发控制服务测试"""
    
    @pytest.mark.asyncio
    async def test_service_initialization(self):
        """测试服务初始化"""
        service = ConcurrencyControlService()
        
        # 检查信号量是否正确初始化
        assert ResourceType.VIDEO_DOWNLOAD in service.semaphores
        assert ResourceType.PAGE_DOWNLOAD in service.semaphores
        assert ResourceType.API_REQUEST in service.semaphores
        assert ResourceType.MEDIA_PROCESSING in service.semaphores
        
        # 检查活跃任务集合是否正确初始化
        assert ResourceType.VIDEO_DOWNLOAD in service.active_tasks
        assert ResourceType.PAGE_DOWNLOAD in service.active_tasks
        
        logger.info("✓ Service initialization test passed")
    
    @pytest.mark.asyncio
    async def test_acquire_and_release(self):
        """测试获取和释放资源"""
        service = ConcurrencyControlService()
        task_id = "test_task_001"
        
        # 获取资源
        acquired = await service.acquire(ResourceType.VIDEO_DOWNLOAD, task_id)
        assert acquired is True
        assert task_id in service.active_tasks[ResourceType.VIDEO_DOWNLOAD]
        
        # 检查活跃任务数
        assert service.get_active_count(ResourceType.VIDEO_DOWNLOAD) == 1
        
        # 释放资源
        await service.release(ResourceType.VIDEO_DOWNLOAD, task_id)
        assert task_id not in service.active_tasks[ResourceType.VIDEO_DOWNLOAD]
        
        # 检查活跃任务数
        assert service.get_active_count(ResourceType.VIDEO_DOWNLOAD) == 0
        
        logger.info("✓ Acquire and release test passed")
    
    @pytest.mark.asyncio
    async def test_concurrent_acquisition(self):
        """测试并发获取资源"""
        service = ConcurrencyControlService()
        
        # 重置统计信息
        service.stats[ResourceType.VIDEO_DOWNLOAD]['total_requests'] = 0
        service.stats[ResourceType.VIDEO_DOWNLOAD]['successful_requests'] = 0
        
        # 创建多个并发任务
        task_ids = [f"test_task_{i:03d}" for i in range(5)]
        tasks = []
        
        async def acquire_and_release(task_id):
            acquired = await service.acquire(ResourceType.VIDEO_DOWNLOAD, task_id, timeout=5)
            if acquired:
                await asyncio.sleep(0.1)  # 模拟工作
                await service.release(ResourceType.VIDEO_DOWNLOAD, task_id)
            return acquired
        
        # 并发执行
        tasks = [acquire_and_release(task_id) for task_id in task_ids]
        results = await asyncio.gather(*tasks)
        
        # 检查结果
        assert all(results)
        
        # 检查统计信息
        stats = service.get_stats(ResourceType.VIDEO_DOWNLOAD)
        assert stats['stats']['successful_requests'] == 5
        
        logger.info("✓ Concurrent acquisition test passed")
    
    @pytest.mark.asyncio
    async def test_timeout_on_acquire(self):
        """测试获取资源超时"""
        service = ConcurrencyControlService()
        
        # 获取所有可用资源
        task_ids = [f"test_task_{i:03d}" for i in range(3)]
        for task_id in task_ids:
            await service.acquire(ResourceType.VIDEO_DOWNLOAD, task_id)
        
        # 尝试获取资源（应该超时）
        new_task_id = "test_task_timeout"
        acquired = await service.acquire(ResourceType.VIDEO_DOWNLOAD, new_task_id, timeout=1)
        
        # 应该返回False（超时）
        assert acquired is False
        
        # 清理资源
        for task_id in task_ids:
            await service.release(ResourceType.VIDEO_DOWNLOAD, task_id)
        
        logger.info("✓ Timeout on acquire test passed")
    
    @pytest.mark.asyncio
    @pytest.mark.skipif(not SERVICE_PSUTIL_AVAILABLE, reason="psutil not available")
    async def test_dynamic_adjustment(self):
        """测试动态调整并发数"""
        service = ConcurrencyControlService()
        
        # 启动服务
        await service.start()
        
        try:
            # 获取初始并发数
            initial_limit = service.semaphores[ResourceType.VIDEO_DOWNLOAD]._value
            
            # 设置新的最大并发数
            service.set_max_concurrent(ResourceType.VIDEO_DOWNLOAD, 5)
            assert service.limits[ResourceType.VIDEO_DOWNLOAD].max_concurrent == 5
            
            # 等待一段时间让动态调整生效
            await asyncio.sleep(2)
            
            # 检查并发数是否增加
            new_limit = service.semaphores[ResourceType.VIDEO_DOWNLOAD]._value
            assert new_limit >= initial_limit
            
            logger.info("✓ Dynamic adjustment test passed")
        finally:
            await service.stop()
    
    @pytest.mark.asyncio
    async def test_stats_tracking(self):
        """测试统计信息跟踪"""
        service = ConcurrencyControlService()
        task_id = "test_task_stats"
        
        # 获取初始统计信息
        initial_stats = service.get_stats(ResourceType.VIDEO_DOWNLOAD)
        initial_requests = initial_stats['stats']['total_requests']
        
        # 执行一些操作
        await service.acquire(ResourceType.VIDEO_DOWNLOAD, task_id)
        await asyncio.sleep(0.1)
        await service.release(ResourceType.VIDEO_DOWNLOAD, task_id)
        
        # 检查统计信息是否更新
        final_stats = service.get_stats(ResourceType.VIDEO_DOWNLOAD)
        assert final_stats['stats']['total_requests'] > initial_requests
        assert final_stats['stats']['successful_requests'] > 0
        
        logger.info("✓ Stats tracking test passed")
    
    @pytest.mark.asyncio
    async def test_resource_usage_monitoring(self):
        """测试资源使用监控"""
        service = ConcurrencyControlService()
        
        # 启动服务
        await service.start()
        
        try:
            # 获取资源使用情况
            usage = service.get_resource_usage()
            
            # 检查是否包含必要的字段
            assert 'cpu' in usage
            assert 'memory' in usage
            assert 'disk' in usage
            assert 'timestamp' in usage
            
            # 检查CPU信息
            assert 'usage_percent' in usage['cpu']
            assert 'core_count' in usage['cpu']
            
            # 检查内存信息
            assert 'total_gb' in usage['memory']
            assert 'available_gb' in usage['memory']
            assert 'usage_percent' in usage['memory']
            
            # 如果psutil不可用，检查note字段
            if not SERVICE_PSUTIL_AVAILABLE:
                assert 'note' in usage['cpu']
                assert 'psutil not available' in usage['cpu']['note']
            
            logger.info("✓ Resource usage monitoring test passed")
        finally:
            await service.stop()
    
    @pytest.mark.asyncio
    async def test_multiple_resource_types(self):
        """测试多种资源类型的并发控制"""
        service = ConcurrencyControlService()
        
        # 为不同资源类型创建任务
        video_task = "video_task_001"
        page_task = "page_task_001"
        api_task = "api_task_001"
        
        # 获取不同类型的资源
        await service.acquire(ResourceType.VIDEO_DOWNLOAD, video_task)
        await service.acquire(ResourceType.PAGE_DOWNLOAD, page_task)
        await service.acquire(ResourceType.API_REQUEST, api_task)
        
        # 检查活跃任务
        assert service.get_active_count(ResourceType.VIDEO_DOWNLOAD) == 1
        assert service.get_active_count(ResourceType.PAGE_DOWNLOAD) == 1
        assert service.get_active_count(ResourceType.API_REQUEST) == 1
        
        # 释放资源
        await service.release(ResourceType.VIDEO_DOWNLOAD, video_task)
        await service.release(ResourceType.PAGE_DOWNLOAD, page_task)
        await service.release(ResourceType.API_REQUEST, api_task)
        
        # 检查活跃任务是否清空
        assert service.get_active_count(ResourceType.VIDEO_DOWNLOAD) == 0
        assert service.get_active_count(ResourceType.PAGE_DOWNLOAD) == 0
        assert service.get_active_count(ResourceType.API_REQUEST) == 0
        
        logger.info("✓ Multiple resource types test passed")
    
    @pytest.mark.asyncio
    async def test_set_max_concurrent_validation(self):
        """测试设置最大并发数的验证"""
        service = ConcurrencyControlService()
        
        # 测试有效值
        service.set_max_concurrent(ResourceType.VIDEO_DOWNLOAD, 1)
        assert service.limits[ResourceType.VIDEO_DOWNLOAD].max_concurrent == 1
        
        service.set_max_concurrent(ResourceType.VIDEO_DOWNLOAD, 10)
        assert service.limits[ResourceType.VIDEO_DOWNLOAD].max_concurrent == 10
        
        # 测试无效值（应该被拒绝）
        service.set_max_concurrent(ResourceType.VIDEO_DOWNLOAD, 0)
        assert service.limits[ResourceType.VIDEO_DOWNLOAD].max_concurrent == 10  # 不应该改变
        
        service.set_max_concurrent(ResourceType.VIDEO_DOWNLOAD, 15)
        assert service.limits[ResourceType.VIDEO_DOWNLOAD].max_concurrent == 10  # 不应该改变
        
        logger.info("✓ Set max concurrent validation test passed")
    
    @pytest.mark.asyncio
    async def test_dynamic_adjustment_toggle(self):
        """测试动态调整开关"""
        service = ConcurrencyControlService()
        
        # 测试启用
        service.set_dynamic_adjustment(True)
        assert service.dynamic_adjustment_enabled is True
        
        # 测试禁用
        service.set_dynamic_adjustment(False)
        assert service.dynamic_adjustment_enabled is False
        
        logger.info("✓ Dynamic adjustment toggle test passed")


class TestConcurrencyControlIntegration:
    """并发控制集成测试"""
    
    @pytest.mark.asyncio
    async def test_global_service_instance(self):
        """测试全局服务实例"""
        # 获取全局实例
        global_service = concurrency_control
        
        # 检查是否为单例
        assert isinstance(global_service, ConcurrencyControlService)
        
        # 测试基本功能
        task_id = "integration_test_001"
        acquired = await global_service.acquire(ResourceType.VIDEO_DOWNLOAD, task_id)
        assert acquired is True
        
        await global_service.release(ResourceType.VIDEO_DOWNLOAD, task_id)
        
        logger.info("✓ Global service instance test passed")
    
    @pytest.mark.asyncio
    async def test_service_lifecycle(self):
        """测试服务生命周期"""
        service = ConcurrencyControlService()
        
        # 测试启动
        await service.start()
        assert service._running is True
        
        # 测试停止
        await service.stop()
        assert service._running is False
        
        logger.info("✓ Service lifecycle test passed")


# 运行测试的主函数
async def run_tests():
    """运行所有测试"""
    logger.info("Starting concurrency control tests...")
    
    # 创建测试实例
    test_class = TestConcurrencyControlService()
    
    # 运行测试
    try:
        await test_class.test_service_initialization()
        await test_class.test_acquire_and_release()
        await test_class.test_concurrent_acquisition()
        await test_class.test_timeout_on_acquire()
        await test_class.test_dynamic_adjustment()
        await test_class.test_stats_tracking()
        await test_class.test_resource_usage_monitoring()
        await test_class.test_multiple_resource_types()
        await test_class.test_set_max_concurrent_validation()
        await test_class.test_dynamic_adjustment_toggle()
        
        logger.info("✓ All tests passed!")
    except Exception as e:
        logger.error(f"✗ Test failed: {e}")
        raise


if __name__ == "__main__":
    # 设置日志
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # 运行测试
    asyncio.run(run_tests())