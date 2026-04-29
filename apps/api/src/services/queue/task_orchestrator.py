"""
任务编排器 - 智能管理子任务的执行顺序和依赖关系

功能：
1. 子任务依赖管理
2. 智能执行顺序
3. 并行执行优化
4. 错误恢复策略
"""

import asyncio
import logging
from typing import Dict, List, Set, Optional, Any
from enum import Enum
from dataclasses import dataclass

from src.models.task import Task, SubTask, TaskState, SubTaskType
from .handlers.registry import handler_registry
from .handlers.base import ProgressCallback
from .file_organizer import file_organizer

logger = logging.getLogger(__name__)


class ExecutionPriority(int, Enum):
    """执行优先级"""
    CRITICAL = 0    # 关键任务（视频下载）
    HIGH = 1        # 高优先级（字幕）
    NORMAL = 2      # 普通优先级（弹幕、封面）
    LOW = 3         # 低优先级（NFO、头像）


class DependencyType(str, Enum):
    """依赖类型"""
    HARD = "hard"   # 硬依赖：必须等待前置任务完成
    SOFT = "soft"   # 软依赖：可以并行，但有顺序偏好


@dataclass
class SubTaskInfo:
    """子任务信息"""
    subtask: SubTask
    priority: ExecutionPriority
    dependencies: List[SubTaskType]
    dependency_type: DependencyType
    can_parallel: bool = True
    timeout: Optional[int] = None


class TaskOrchestrator:
    """任务编排器"""
    
    def __init__(self):
        # 子任务配置
        self.subtask_configs = {
            SubTaskType.VIDEO: SubTaskInfo(
                subtask=None,
                priority=ExecutionPriority.CRITICAL,
                dependencies=[],
                dependency_type=DependencyType.HARD,
                can_parallel=False,  # 视频下载不能并行
                timeout=3600  # 1小时超时
            ),
            SubTaskType.SUBTITLE: SubTaskInfo(
                subtask=None,
                priority=ExecutionPriority.HIGH,
                dependencies=[SubTaskType.VIDEO],  # 需要视频信息
                dependency_type=DependencyType.SOFT,
                can_parallel=True,
                timeout=300  # 5分钟超时
            ),
            SubTaskType.DANMAKU: SubTaskInfo(
                subtask=None,
                priority=ExecutionPriority.NORMAL,
                dependencies=[],
                dependency_type=DependencyType.SOFT,
                can_parallel=True,
                timeout=300
            ),
            SubTaskType.COVER: SubTaskInfo(
                subtask=None,
                priority=ExecutionPriority.NORMAL,
                dependencies=[],
                dependency_type=DependencyType.SOFT,
                can_parallel=True,
                timeout=120
            ),
            SubTaskType.AVATAR: SubTaskInfo(
                subtask=None,
                priority=ExecutionPriority.LOW,
                dependencies=[],
                dependency_type=DependencyType.SOFT,
                can_parallel=True,
                timeout=120
            ),
            SubTaskType.NFO: SubTaskInfo(
                subtask=None,
                priority=ExecutionPriority.LOW,
                dependencies=[SubTaskType.VIDEO],  # 需要视频元数据
                dependency_type=DependencyType.SOFT,
                can_parallel=True,
                timeout=60
            )
        }
    
    async def execute_task(self, task: Task, subtasks: List[SubTask], progress_callback) -> bool:
        """执行完整任务（智能编排所有子任务）"""
        try:
            logger.info(f"🎯 开始智能编排任务: {task.title}")
            
            # 1. 准备阶段 - 组织文件路径
            await self._prepare_task_files(task)
            
            # 2. 分析子任务依赖关系
            execution_plan = self._create_execution_plan(subtasks)
            
            # 3. 按阶段执行子任务
            success = await self._execute_by_phases(task, execution_plan, progress_callback)
            
            if success:
                logger.info(f"✅ 任务编排完成: {task.title}")
            else:
                logger.error(f"❌ 任务编排失败: {task.title}")
            
            return success
            
        except Exception as e:
            logger.error(f"❌ 任务编排异常: {e}")
            return False
    
    async def _prepare_task_files(self, task: Task):
        """准备任务文件路径"""
        try:
            # 构建任务数据
            task_data = {
                'media_type': task.media_type,
                'title': task.title,
                'uploader': task.meta.get('owner', {}).get('name', 'Unknown'),
                'meta': task.meta
            }
            
            # 组织文件路径
            file_paths = file_organizer.organize_task_files(task_data)
            
            # 更新任务元数据
            if not task.meta:
                task.meta = {}
            task.meta['file_paths'] = {str(k): str(v) for k, v in file_paths.items()}
            
            logger.info(f"📁 文件路径准备完成: {len(file_paths)} 个文件")
            
        except Exception as e:
            logger.error(f"文件路径准备失败: {e}")
            raise
    
    def _create_execution_plan(self, subtasks: List[SubTask]) -> Dict[int, List[SubTask]]:
        """创建执行计划 - 按阶段分组子任务"""
        execution_phases = {}
        
        # 按优先级和依赖关系分组
        for subtask in subtasks:
            subtask_type = SubTaskType(subtask.type)
            config = self.subtask_configs.get(subtask_type)
            
            if not config:
                logger.warning(f"未知子任务类型: {subtask.type}")
                continue
            
            phase = config.priority.value
            
            if phase not in execution_phases:
                execution_phases[phase] = []
            
            execution_phases[phase].append(subtask)
        
        # 按阶段排序
        sorted_phases = {}
        for phase in sorted(execution_phases.keys()):
            sorted_phases[phase] = execution_phases[phase]
        
        logger.info(f"📋 执行计划: {len(sorted_phases)} 个阶段")
        for phase, tasks in sorted_phases.items():
            task_types = [t.type for t in tasks]
            logger.info(f"  阶段 {phase}: {task_types}")
        
        return sorted_phases
    
    async def _execute_by_phases(self, task: Task, execution_plan: Dict[int, List[SubTask]], progress_callback) -> bool:
        """按阶段执行子任务"""
        total_phases = len(execution_plan)
        completed_phases = 0
        
        for phase, subtasks in execution_plan.items():
            logger.info(f"🚀 执行阶段 {phase}: {[st.type for st in subtasks]}")
            
            # 检查是否可以并行执行
            can_parallel = self._can_execute_parallel(subtasks)
            
            if can_parallel and len(subtasks) > 1:
                # 并行执行
                success = await self._execute_parallel(task, subtasks, progress_callback)
            else:
                # 串行执行
                success = await self._execute_sequential(task, subtasks, progress_callback)
            
            if not success:
                # 检查是否是关键阶段失败
                if phase == ExecutionPriority.CRITICAL.value:
                    logger.error(f"❌ 关键阶段失败，任务终止: 阶段 {phase}")
                    return False
                else:
                    logger.warning(f"⚠️  非关键阶段失败，继续执行: 阶段 {phase}")
            
            completed_phases += 1
            
            # 更新总体进度
            overall_progress = int((completed_phases / total_phases) * 100)
            await progress_callback({
                'progress': overall_progress,
                'stage': f'阶段 {phase + 1}/{total_phases}',
                'message': f'已完成 {completed_phases}/{total_phases} 个阶段'
            })
        
        return True
    
    def _can_execute_parallel(self, subtasks: List[SubTask]) -> bool:
        """检查子任务是否可以并行执行"""
        for subtask in subtasks:
            subtask_type = SubTaskType(subtask.type)
            config = self.subtask_configs.get(subtask_type)
            
            if config and not config.can_parallel:
                return False
        
        return True
    
    async def _execute_parallel(self, task: Task, subtasks: List[SubTask], progress_callback) -> bool:
        """并行执行子任务"""
        logger.info(f"⚡ 并行执行 {len(subtasks)} 个子任务")
        
        # 创建并行任务
        parallel_tasks = []
        for subtask in subtasks:
            task_coroutine = self._execute_single_subtask(task, subtask, progress_callback)
            parallel_tasks.append(task_coroutine)
        
        # 等待所有任务完成
        results = await asyncio.gather(*parallel_tasks, return_exceptions=True)
        
        # 统计结果
        success_count = 0
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"❌ 子任务异常 {subtasks[i].type}: {result}")
            elif result:
                success_count += 1
                logger.info(f"✅ 子任务成功 {subtasks[i].type}")
            else:
                logger.error(f"❌ 子任务失败 {subtasks[i].type}")
        
        logger.info(f"📊 并行执行结果: {success_count}/{len(subtasks)} 成功")
        return success_count > 0
    
    async def _execute_sequential(self, task: Task, subtasks: List[SubTask], progress_callback) -> bool:
        """串行执行子任务"""
        logger.info(f"🔄 串行执行 {len(subtasks)} 个子任务")
        
        success_count = 0
        
        for i, subtask in enumerate(subtasks):
            logger.info(f"🔧 执行子任务 {i+1}/{len(subtasks)}: {subtask.type}")
            
            success = await self._execute_single_subtask(task, subtask, progress_callback)
            
            if success:
                success_count += 1
                logger.info(f"✅ 子任务成功: {subtask.type}")
            else:
                logger.error(f"❌ 子任务失败: {subtask.type}")
                
                # 检查是否是关键子任务
                subtask_type = SubTaskType(subtask.type)
                config = self.subtask_configs.get(subtask_type)
                
                if config and config.priority == ExecutionPriority.CRITICAL:
                    logger.error(f"❌ 关键子任务失败，停止执行: {subtask.type}")
                    return False
        
        logger.info(f"📊 串行执行结果: {success_count}/{len(subtasks)} 成功")
        return success_count > 0
    
    async def _execute_single_subtask(self, task: Task, subtask: SubTask, progress_callback) -> bool:
        """执行单个子任务"""
        try:
            # 获取处理器
            subtask_type = SubTaskType(subtask.type)
            handler = handler_registry.get_handler(subtask_type)
            
            if not handler:
                logger.warning(f"⚠️  未找到处理器: {subtask.type}，跳过")
                return True  # 跳过不算失败
            
            # 更新子任务状态
            await self._update_subtask_state(subtask, TaskState.ACTIVE)
            
            # 创建进度回调
            async def subtask_progress_callback(progress_data):
                await progress_callback({
                    'subtask_id': subtask.id,
                    'subtask_type': subtask.type,
                    **progress_data
                })
            
            subtask_progress = ProgressCallback(
                task.id,
                subtask.id,
                subtask_progress_callback
            )
            
            # 设置超时
            config = self.subtask_configs.get(subtask_type)
            timeout = config.timeout if config else 300
            
            # 执行子任务（带超时）
            success = await asyncio.wait_for(
                handler.execute(task, subtask, subtask_progress),
                timeout=timeout
            )
            
            # 更新状态
            final_state = TaskState.COMPLETED if success else TaskState.FAILED
            await self._update_subtask_state(subtask, final_state)
            
            return success
            
        except asyncio.TimeoutError:
            logger.error(f"❌ 子任务超时: {subtask.type}")
            await self._update_subtask_state(subtask, TaskState.FAILED)
            return False
            
        except Exception as e:
            logger.error(f"❌ 子任务执行异常 {subtask.type}: {e}")
            await self._update_subtask_state(subtask, TaskState.FAILED)
            return False
    
    async def _update_subtask_state(self, subtask: SubTask, new_state: TaskState):
        """更新子任务状态"""
        try:
            from src.database import SessionLocal
            from datetime import datetime
            
            db = SessionLocal()
            try:
                db_subtask = db.query(SubTask).filter(SubTask.id == subtask.id).first()
                if db_subtask:
                    db_subtask.state = new_state
                    db_subtask.updated_at = int(datetime.now().timestamp())
                    db.commit()
                    
                    # 同步内存对象
                    subtask.state = new_state
                    
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"更新子任务状态失败: {e}")
    
    def get_execution_summary(self, subtasks: List[SubTask]) -> Dict[str, Any]:
        """获取执行摘要"""
        total = len(subtasks)
        completed = len([st for st in subtasks if st.state == TaskState.COMPLETED])
        failed = len([st for st in subtasks if st.state == TaskState.FAILED])
        active = len([st for st in subtasks if st.state == TaskState.ACTIVE])
        
        return {
            'total': total,
            'completed': completed,
            'failed': failed,
            'active': active,
            'success_rate': (completed / total * 100) if total > 0 else 0
        }


# 全局任务编排器实例
task_orchestrator = TaskOrchestrator()