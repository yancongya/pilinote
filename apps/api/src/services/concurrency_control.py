"""
全局并发控制服务 - 统一管理系统并发资源
"""
import asyncio
import logging
from typing import Dict, Optional, Set, Tuple
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logger.warning("psutil not available, resource monitoring features will be limited")


class ResourceType(Enum):
    """资源类型"""
    VIDEO_DOWNLOAD = "video_download"
    PAGE_DOWNLOAD = "page_download"
    API_REQUEST = "api_request"
    MEDIA_PROCESSING = "media_processing"


@dataclass
class ResourceLimits:
    """资源限制配置"""
    max_concurrent: int  # 最大并发数
    cpu_threshold: float = 0.8  # CPU使用率阈值
    memory_threshold: float = 0.8  # 内存使用率阈值
    disk_io_threshold: float = 0.8  # 磁盘IO阈值


class ConcurrencyControlService:
    """
    全局并发控制服务
    
    功能：
    - 统一管理系统的并发资源
    - 基于系统资源动态调整并发数
    - 提供优先级资源分配
    - 监控并发状态
    """
    
    _instance: Optional['ConcurrencyControlService'] = None
    _lock = asyncio.Lock()
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        
        # 资源类型对应的信号量
        self.semaphores: Dict[ResourceType, asyncio.Semaphore] = {}
        
        # 当前活跃的任务ID
        self.active_tasks: Dict[ResourceType, Set[str]] = {}
        
        # 资源限制配置
        self.limits: Dict[ResourceType, ResourceLimits] = {
            ResourceType.VIDEO_DOWNLOAD: ResourceLimits(max_concurrent=3),
            ResourceType.PAGE_DOWNLOAD: ResourceLimits(max_concurrent=3),
            ResourceType.API_REQUEST: ResourceLimits(max_concurrent=10),
            ResourceType.MEDIA_PROCESSING: ResourceLimits(max_concurrent=2),
        }
        
        # 动态调整配置
        self.dynamic_adjustment_enabled = True
        self.resource_check_interval = 5  # 资源检查间隔（秒）
        self._monitor_task: Optional[asyncio.Task] = None
        self._running = False
        
        # 统计信息
        self.stats: Dict[ResourceType, Dict] = {
            rt: {
                'total_requests': 0,
                'successful_requests': 0,
                'failed_requests': 0,
                'rejected_requests': 0,
                'avg_wait_time': 0.0,
                'last_updated': None
            }
            for rt in ResourceType
        }
        
        # 初始化信号量
        self._initialize_semaphores()
        
        logger.info("✓ ConcurrencyControlService initialized")
    
    def _initialize_semaphores(self):
        """初始化所有信号量"""
        for resource_type, limit in self.limits.items():
            self.semaphores[resource_type] = asyncio.Semaphore(limit.max_concurrent)
            self.active_tasks[resource_type] = set()
            logger.info(f"✓ Initialized semaphore for {resource_type.value}: max={limit.max_concurrent}")
    
    async def start(self):
        """启动并发控制服务"""
        if self._running:
            return
        
        self._running = True
        self._monitor_task = asyncio.create_task(self._monitor_resources())
        logger.info("✓ ConcurrencyControlService started")
    
    async def stop(self):
        """停止并发控制服务"""
        if not self._running:
            return
        
        self._running = False
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        
        logger.info("✓ ConcurrencyControlService stopped")
    
    async def _monitor_resources(self):
        """监控系统资源并动态调整并发数"""
        while self._running:
            try:
                if not self.dynamic_adjustment_enabled:
                    await asyncio.sleep(self.resource_check_interval)
                    continue
                
                # 获取系统资源使用情况
                if PSUTIL_AVAILABLE:
                    cpu_usage = psutil.cpu_percent(interval=0.1)
                    memory_usage = psutil.virtual_memory().percent / 100
                    disk_io = self._get_disk_io_usage()
                else:
                    # psutil不可用时使用默认值
                    cpu_usage = 0.0
                    memory_usage = 0.0
                    disk_io = 0.0
                    logger.debug("psutil not available, using default resource values")
                
                # 记录资源使用情况
                logger.debug(f"Resource usage: CPU={cpu_usage:.1f}%, Memory={memory_usage:.1f}%, DiskIO={disk_io:.1f}%")
                
                # 根据资源使用情况调整并发数
                await self._adjust_concurrency(cpu_usage, memory_usage, disk_io)
                
                await asyncio.sleep(self.resource_check_interval)
                
            except Exception as e:
                logger.error(f"Error monitoring resources: {e}")
                await asyncio.sleep(self.resource_check_interval)
    
    def _get_disk_io_usage(self) -> float:
        """获取磁盘IO使用率"""
        if not PSUTIL_AVAILABLE:
            return 0.0
            
        try:
            disk_io = psutil.disk_io_counters()
            if disk_io:
                # 简单的IO使用率估算
                read_bytes = disk_io.read_bytes
                write_bytes = disk_io.write_bytes
                # 这里可以更精确地计算IO使用率
                return min((read_bytes + write_bytes) / (1024 * 1024 * 10) * 100, 100)
            return 0.0
        except Exception as e:
            logger.warning(f"Failed to get disk IO usage: {e}")
            return 0.0
    
    async def _adjust_concurrency(self, cpu_usage: float, memory_usage: float, disk_io: float):
        """根据资源使用情况动态调整并发数"""
        for resource_type, limit in self.limits.items():
            current_limit = self.semaphores[resource_type]._value
            
            # 检查资源是否过载
            cpu_overload = cpu_usage > limit.cpu_threshold
            memory_overload = memory_usage > limit.memory_threshold
            disk_overload = disk_io > limit.disk_io_threshold
            
            if cpu_overload or memory_overload or disk_overload:
                # 资源过载，降低并发数
                new_limit = max(1, current_limit - 1)
                if new_limit < current_limit:
                    await self._update_semaphore_limit(resource_type, new_limit)
                    logger.info(f"⚠️ Reduced {resource_type.value} concurrency: {current_limit} -> {new_limit} (CPU={cpu_usage:.1f}%, Memory={memory_usage:.1f}%, DiskIO={disk_io:.1f}%)")
            else:
                # 资源充足，可以恢复并发数
                if current_limit < limit.max_concurrent:
                    new_limit = min(limit.max_concurrent, current_limit + 1)
                    if new_limit > current_limit:
                        await self._update_semaphore_limit(resource_type, new_limit)
                        logger.info(f"✓ Increased {resource_type.value} concurrency: {current_limit} -> {new_limit}")
    
    async def _update_semaphore_limit(self, resource_type: ResourceType, new_limit: int):
        """更新信号量限制"""
        old_semaphore = self.semaphores[resource_type]
        old_limit = old_semaphore._value + len(self.active_tasks[resource_type])
        
        # 创建新的信号量
        new_semaphore = asyncio.Semaphore(new_limit)
        
        # 转移活跃任务到新信号量
        active_count = len(self.active_tasks[resource_type])
        if active_count > 0:
            for _ in range(active_count):
                await new_semaphore.acquire()
        
        # 替换信号量
        self.semaphores[resource_type] = new_semaphore
        
        logger.debug(f"Updated {resource_type.value} semaphore: {old_limit} -> {new_limit}")
    
    async def acquire(
        self,
        resource_type: ResourceType,
        task_id: str,
        timeout: Optional[float] = None
    ) -> bool:
        """
        获取资源
        
        Args:
            resource_type: 资源类型
            task_id: 任务ID
            timeout: 超时时间（秒），None表示无限等待
            
        Returns:
            是否成功获取资源
        """
        start_time = datetime.now()
        
        try:
            # 等待获取信号量
            semaphore = self.semaphores[resource_type]
            
            if timeout:
                try:
                    await asyncio.wait_for(semaphore.acquire(), timeout=timeout)
                except asyncio.TimeoutError:
                    logger.warning(f"⏰ Task {task_id} timeout waiting for {resource_type.value} resource")
                    self.stats[resource_type]['rejected_requests'] += 1
                    return False
            else:
                await semaphore.acquire()
            
            # 记录活跃任务
            self.active_tasks[resource_type].add(task_id)
            
            # 更新统计信息
            wait_time = (datetime.now() - start_time).total_seconds()
            stats = self.stats[resource_type]
            stats['total_requests'] += 1
            stats['successful_requests'] += 1
            
            # 更新平均等待时间
            total_successful = stats['successful_requests']
            stats['avg_wait_time'] = (
                (stats['avg_wait_time'] * (total_successful - 1) + wait_time) / total_successful
            )
            stats['last_updated'] = datetime.now().isoformat()
            
            logger.debug(f"✓ Task {task_id} acquired {resource_type.value} resource (wait={wait_time:.2f}s)")
            return True
            
        except asyncio.CancelledError:
            logger.warning(f"Task {task_id} cancelled while waiting for {resource_type.value}")
            self.stats[resource_type]['rejected_requests'] += 1
            raise
        except Exception as e:
            logger.error(f"Error acquiring {resource_type.value} for task {task_id}: {e}")
            self.stats[resource_type]['failed_requests'] += 1
            return False
    
    async def release(self, resource_type: ResourceType, task_id: str):
        """
        释放资源
        
        Args:
            resource_type: 资源类型
            task_id: 任务ID
        """
        try:
            # 从活跃任务中移除
            if task_id in self.active_tasks[resource_type]:
                self.active_tasks[resource_type].remove(task_id)
            
            # 释放信号量
            semaphore = self.semaphores[resource_type]
            semaphore.release()
            
            logger.debug(f"✓ Task {task_id} released {resource_type.value} resource")
            
        except Exception as e:
            logger.error(f"Error releasing {resource_type.value} for task {task_id}: {e}")
    
    def get_active_count(self, resource_type: ResourceType) -> int:
        """获取当前活跃任务数"""
        return len(self.active_tasks[resource_type])
    
    def get_available_count(self, resource_type: ResourceType) -> int:
        """获取可用资源数"""
        semaphore = self.semaphores[resource_type]
        return semaphore._value
    
    def get_stats(self, resource_type: Optional[ResourceType] = None) -> Dict:
        """获取统计信息"""
        if resource_type:
            return {
                'resource_type': resource_type.value,
                'active_tasks': len(self.active_tasks[resource_type]),
                'available_slots': self.semaphores[resource_type]._value,
                'stats': self.stats[resource_type].copy()
            }
        else:
            return {
                rt.value: {
                    'active_tasks': len(self.active_tasks[rt]),
                    'available_slots': self.semaphores[rt]._value,
                    'stats': self.stats[rt].copy()
                }
                for rt in ResourceType
            }
    
    def set_max_concurrent(self, resource_type: ResourceType, max_concurrent: int):
        """设置最大并发数"""
        if 1 <= max_concurrent <= 10:  # 限制最大并发数为10
            self.limits[resource_type].max_concurrent = max_concurrent
            logger.info(f"✓ Set max concurrent for {resource_type.value}: {max_concurrent}")
        else:
            logger.warning(f"⚠️ Invalid max concurrent value: {max_concurrent} (must be 1-10)")
    
    def set_dynamic_adjustment(self, enabled: bool):
        """启用/禁用动态调整"""
        self.dynamic_adjustment_enabled = enabled
        logger.info(f"✓ Dynamic adjustment {'enabled' if enabled else 'disabled'}")
    
    def get_resource_usage(self) -> Dict:
        """获取系统资源使用情况"""
        try:
            if PSUTIL_AVAILABLE:
                cpu_usage = psutil.cpu_percent(interval=0.1)
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                
                return {
                    'cpu': {
                        'usage_percent': cpu_usage,
                        'core_count': psutil.cpu_count()
                    },
                    'memory': {
                        'total_gb': memory.total / (1024**3),
                        'available_gb': memory.available / (1024**3),
                        'usage_percent': memory.percent,
                        'used_gb': memory.used / (1024**3)
                    },
                    'disk': {
                        'total_gb': disk.total / (1024**3),
                        'free_gb': disk.free / (1024**3),
                        'usage_percent': disk.percent,
                        'used_gb': disk.used / (1024**3)
                    },
                    'timestamp': datetime.now().isoformat()
                }
            else:
                # psutil不可用时返回基本信息
                return {
                    'cpu': {
                        'usage_percent': 0.0,
                        'core_count': 0,
                        'note': 'psutil not available'
                    },
                    'memory': {
                        'total_gb': 0.0,
                        'available_gb': 0.0,
                        'usage_percent': 0.0,
                        'used_gb': 0.0,
                        'note': 'psutil not available'
                    },
                    'disk': {
                        'total_gb': 0.0,
                        'free_gb': 0.0,
                        'usage_percent': 0.0,
                        'used_gb': 0.0,
                        'note': 'psutil not available'
                    },
                    'timestamp': datetime.now().isoformat()
                }
        except Exception as e:
            logger.error(f"Error getting resource usage: {e}")
            return {}


# 全局并发控制服务实例
concurrency_control = ConcurrencyControlService()