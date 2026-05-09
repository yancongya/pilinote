"""
视频处理器单元测试

测试VideoHandler的下载逻辑、质量选择、进度回调等功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil

from src.services.queue.handlers.video import VideoHandler
from src.services.queue.handlers.base import ProgressCallback
from src.models.task import Task, SubTask, TaskState, SubTaskType


class TestVideoHandler:
    """视频处理器测试类"""
    
    @pytest.fixture
    def handler(self):
        """创建视频处理器实例"""
        return VideoHandler()
    
    @pytest.fixture
    def mock_task(self):
        """创建模拟任务"""
        return Task(
            id="test-task-id",
            media_type="video",
            media_id="BV1xx411c7mD",
            title="测试视频标题",
            cover="https://example.com/cover.jpg",
            desc="测试视频描述",
            meta={
                "aid": 12345,
                "cid": 67890,
                "duration": 300,
                "owner": {"name": "测试UP主"},
                "file_paths": {
                    "video": "/downloads/videos/测试视频标题.mp4"
                }
            },
            state=TaskState.ACTIVE
        )
    
    @pytest.fixture
    def mock_subtask(self):
        """创建模拟子任务"""
        return SubTask(
            id="test-subtask-id",
            task_id="test-task-id",
            type=SubTaskType.VIDEO,
            state=TaskState.ACTIVE,
            params={"quality": 80}
        )
    
    @pytest.fixture
    def mock_progress_callback(self):
        """创建模拟进度回调"""
        callback_func = AsyncMock()
        return ProgressCallback("test-task-id", "test-subtask-id", callback_func)
    
    @pytest.fixture
    def temp_dir(self):
        """创建临时目录"""
        temp_dir = tempfile.mkdtemp()
        yield Path(temp_dir)
        shutil.rmtree(temp_dir)
    
    @pytest.mark.asyncio
    async def test_execute_success(self, handler, mock_task, mock_subtask, mock_progress_callback, tmp_path):
        """测试视频下载成功"""
        with patch.object(handler.download_engine, 'download_video') as mock_download:
            mock_download.return_value = True

            output_path = tmp_path / "测试视频标题.mp4"
            output_path.write_bytes(b"x" * 1024)

            with patch.object(handler, "_get_output_path", return_value=output_path):
                # 执行测试
                result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)

                # 验证结果
                assert result is True
                mock_download.assert_called_once()

                # 验证子任务输出路径被设置
                assert mock_subtask.output_path is not None
                assert mock_subtask.file_size == 1024
    
    @pytest.mark.asyncio
    async def test_execute_download_failure(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试下载失败的处理"""
        with patch.object(handler.download_engine, 'download_video') as mock_download:
            mock_download.return_value = False  # 下载失败
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is False
    
    @pytest.mark.asyncio
    async def test_execute_exception_handling(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试异常处理"""
        with patch.object(handler.download_engine, 'download_video') as mock_download:
            mock_download.side_effect = Exception("网络错误")
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is False
    
    @pytest.mark.asyncio
    async def test_quality_parameter_passing(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试质量参数传递"""
        with patch.object(handler.download_engine, 'download_video') as mock_download:
            mock_download.return_value = True
            
            # 测试不同质量参数
            test_qualities = [64, 80, 116]
            
            for quality in test_qualities:
                mock_subtask.params = {"quality": quality}
                
                await handler.execute(mock_task, mock_subtask, mock_progress_callback)
                
                # 验证质量参数被正确传递
                call_args = mock_download.call_args
                assert call_args[1]["quality"] == quality  # kwargs中的quality参数
    
    @pytest.mark.asyncio
    async def test_progress_callback_updates(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试进度回调更新"""
        with patch.object(handler.download_engine, 'download_video') as mock_download:
            # 模拟下载过程中的进度回调
            async def mock_download_with_progress(*args, **kwargs):
                progress_callback = kwargs.get('progress_callback')
                if progress_callback:
                    progress_callback(
                        "test-download-id",
                        50.0,
                        512 * 1024,
                        1024 * 1024,
                        1024 * 1024,
                        30.0,
                    )
                return True
            
            mock_download.side_effect = mock_download_with_progress
            
            # 执行测试
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证进度回调被调用
            assert mock_progress_callback.callback.call_count >= 3  # 至少3次进度更新
            
            # 验证进度回调参数
            calls = mock_progress_callback.callback.call_args_list
            
            # 第一次调用应该是开始状态
            first_call = calls[0][0][0]
            assert "准备下载" in first_call.get("message", "")
            
            # 最后一次调用应该是完成状态
            last_call = calls[-1][0][0]
            assert last_call.get("progress", 0) == 100
    
    @pytest.mark.asyncio
    async def test_file_path_generation(self, handler, mock_task, mock_subtask, mock_progress_callback, temp_dir):
        """测试文件路径生成"""
        with patch.object(handler.download_engine, 'download_video') as mock_download, \
             patch('pathlib.Path') as mock_path_class:
            
            mock_download.return_value = True
            
            # 模拟Path类返回临时目录
            mock_path_instance = Mock()
            mock_path_instance.mkdir = Mock()
            mock_path_instance.__truediv__ = Mock(return_value=temp_dir / "test.mp4")
            mock_path_class.return_value = mock_path_instance
            
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证下载被调用
            mock_download.assert_called_once()
            
            # 验证输出路径参数
            call_args = mock_download.call_args
            output_path = call_args[1]["output_path"]
            assert output_path is not None
    
    def test_safe_filename_generation(self, handler):
        """测试安全文件名生成"""
        test_cases = [
            ("正常文件名", "正常文件名"),
            ("包含/特殊\\字符:的*文件名", "包含_特殊_字符_的_文件名"),
            ("很长的文件名" * 20, "很长的文件名" * 20),  # 测试长度限制
            ("", ""),  # 空文件名
            ("   ", "   "),  # 只有空格
        ]
        
        for input_name, expected_pattern in test_cases:
            safe_name = handler._safe_filename(input_name)
            
            # 验证不包含危险字符
            dangerous_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
            for char in dangerous_chars:
                assert char not in safe_name
            
            # 验证长度限制
            assert len(safe_name) <= 200
    
    @pytest.mark.asyncio
    async def test_default_quality_parameter(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试默认质量参数"""
        # 清空质量参数
        mock_subtask.params = {}
        
        with patch.object(handler.download_engine, 'download_video') as mock_download:
            mock_download.return_value = True
            
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证使用默认质量80
            call_args = mock_download.call_args
            assert call_args[1]["quality"] == 80
    
    @pytest.mark.asyncio
    async def test_concurrent_download_handling(self, handler):
        """测试并发下载处理"""
        # 创建多个模拟任务
        tasks = []
        subtasks = []
        callbacks = []
        
        for i in range(3):
            task = Task(
                id=f"task-{i}",
                media_type="video",
                media_id=f"BV{i}xx411c7mD",
                title=f"测试视频{i}",
                meta={"aid": 12345 + i, "cid": 67890 + i},
                state=TaskState.ACTIVE
            )
            subtask = SubTask(
                id=f"subtask-{i}",
                task_id=f"task-{i}",
                type=SubTaskType.VIDEO,
                state=TaskState.ACTIVE,
                params={"quality": 80}
            )
            callback = ProgressCallback(f"task-{i}", f"subtask-{i}", AsyncMock())
            
            tasks.append(task)
            subtasks.append(subtask)
            callbacks.append(callback)
        
        with patch.object(handler.download_engine, 'download_video') as mock_download:
            mock_download.return_value = True
            
            # 并发执行
            results = await asyncio.gather(*[
                handler.execute(task, subtask, callback)
                for task, subtask, callback in zip(tasks, subtasks, callbacks)
            ])
            
            # 验证所有任务都成功
            assert all(results)
            assert mock_download.call_count == 3
    
    def test_handler_initialization(self, handler):
        """测试处理器初始化"""
        assert handler is not None
        assert hasattr(handler, 'execute')
        assert callable(handler.execute)
        assert hasattr(handler, 'download_engine')
    
    @pytest.mark.asyncio
    async def test_prepare_method(self, handler, mock_task, mock_subtask):
        """测试准备方法"""
        result = await handler.prepare(mock_task, mock_subtask)
        
        # 验证返回的数据结构
        assert isinstance(result, dict)
        assert result["media_id"] == mock_task.media_id
        assert result["title"] == mock_task.title
        assert result["quality"] == mock_subtask.params.get("quality", 80)
    
    @pytest.mark.asyncio
    async def test_media_id_parameter_passing(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试媒体ID参数传递"""
        with patch.object(handler.download_engine, 'download_video') as mock_download:
            mock_download.return_value = True
            
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证媒体ID被正确传递
            call_args = mock_download.call_args
            assert call_args[1]["bvid"] == mock_task.media_id
    
    @pytest.mark.asyncio
    async def test_output_path_setting(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试输出路径设置"""
        with patch.object(handler.download_engine, 'download_video') as mock_download:
            mock_download.return_value = True
            
            # 执行前子任务没有输出路径
            assert mock_subtask.output_path is None
            
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 执行后子任务应该有输出路径
            assert mock_subtask.output_path is not None
            assert "downloads/videos" in mock_subtask.output_path
            assert ".mp4" in mock_subtask.output_path
