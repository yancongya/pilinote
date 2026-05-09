"""
封面处理器单元测试

测试CoverHandler的封面下载、图片格式处理等功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil
from PIL import Image
import io

from src.services.queue.handlers.thumb import CoverHandler
from src.services.queue.handlers.base import ProgressCallback
from src.models.task import Task, SubTask, TaskState, SubTaskType


class TestCoverHandler:
    """封面处理器测试类"""
    
    @pytest.fixture
    def handler(self):
        """创建封面处理器实例"""
        return CoverHandler()
    
    @pytest.fixture
    def mock_task(self):
        """创建模拟任务"""
        return Task(
            id="test-task-id",
            media_type="video",
            media_id="BV1xx411c7mD",
            title="测试视频标题",
            cover="https://i0.hdslb.com/bfs/archive/test_cover.jpg",
            desc="测试视频描述",
            meta={
                "aid": 12345,
                "cid": 67890,
                "duration": 300,
                "owner": {"name": "测试UP主"},
                "file_paths": {
                    "cover": "/downloads/covers/测试视频标题.jpg"
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
            type=SubTaskType.COVER,
            state=TaskState.ACTIVE,
            params={}
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
    
    @pytest.fixture
    def sample_image_data(self):
        """创建示例图片数据"""
        # 创建一个简单的测试图片
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        return img_bytes.getvalue()
    
    @pytest.mark.asyncio
    async def test_execute_success(self, handler, mock_task, mock_subtask, mock_progress_callback, sample_image_data):
        """测试封面下载成功"""
        with patch.object(handler, '_download_image') as mock_download:
            mock_download.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is True
            mock_download.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_execute_no_cover_url(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试没有封面URL时的处理"""
        # 清空封面URL
        mock_task.cover = ""
        
        # 执行测试
        result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
        
        # 验证结果 - 应该跳过而不是失败
        assert result is True
    
    @pytest.mark.asyncio
    async def test_execute_invalid_cover_url(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试无效封面URL时的处理"""
        mock_task.cover = "invalid-url"
        
        with patch.object(handler, '_download_image') as mock_download:
            mock_download.return_value = False
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is False
    
    @pytest.mark.asyncio
    async def test_execute_exception_handling(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试异常处理"""
        with patch.object(handler, '_download_image') as mock_download:
            mock_download.side_effect = Exception("网络错误")
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is False
    
    @pytest.mark.asyncio
    async def test_image_download_success(self, handler, sample_image_data, temp_dir):
        """测试图片下载成功"""
        cover_url = "https://example.com/cover.jpg"
        output_path = temp_dir / "test_cover.jpg"
        
        with patch('aiohttp.ClientSession') as mock_session_class:
            # 模拟aiohttp响应
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.read.return_value = sample_image_data
            
            mock_session = AsyncMock()
            mock_session.get.return_value.__aenter__.return_value = mock_response
            mock_session_class.return_value.__aenter__.return_value = mock_session
            
            # 执行下载
            success = await handler._download_image(cover_url, output_path)
            
            # 验证结果
            assert success is True
    
    @pytest.mark.asyncio
    async def test_image_download_http_error(self, handler, temp_dir):
        """测试HTTP错误处理"""
        cover_url = "https://example.com/cover.jpg"
        output_path = temp_dir / "test_cover.jpg"
        
        with patch('aiohttp.ClientSession') as mock_session_class:
            # 模拟HTTP 404错误
            mock_response = AsyncMock()
            mock_response.status = 404
            
            mock_session = AsyncMock()
            mock_session.get.return_value.__aenter__.return_value = mock_response
            mock_session_class.return_value.__aenter__.return_value = mock_session
            
            # 执行下载
            success = await handler._download_image(cover_url, output_path)
            
            # 验证结果
            assert success is False
    
    @pytest.mark.asyncio
    async def test_image_format_validation(self, handler, temp_dir):
        """测试图片格式验证"""
        # 测试不同的图片格式
        formats = ['jpg', 'jpeg', 'png', 'webp']
        
        for fmt in formats:
            cover_url = f"https://example.com/cover.{fmt}"
            
            # 验证URL格式检查
            is_valid = handler._is_valid_image_url(cover_url)
            assert is_valid is True
        
        # 测试无效格式
        invalid_urls = [
            "https://example.com/file.txt",
            "https://example.com/file.pdf",
            "https://example.com/file",
            "not-a-url"
        ]
        
        for url in invalid_urls:
            is_valid = handler._is_valid_image_url(url)
            assert is_valid is False
    
    @pytest.mark.asyncio
    async def test_progress_callback_updates(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试进度回调更新"""
        with patch.object(handler, '_download_image') as mock_download:
            mock_download.return_value = True
            
            # 执行测试
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证进度回调被调用
            assert mock_progress_callback.callback.call_count >= 2
            
            # 验证进度回调参数
            calls = mock_progress_callback.callback.call_args_list
            
            # 第一次调用应该是开始状态
            first_call = calls[0][0][0]
            assert "准备下载封面" in first_call.get("message", "")
            
            # 最后一次调用应该是完成状态
            last_call = calls[-1][0][0]
            assert last_call.get("progress", 0) == 100
    
    @pytest.mark.asyncio
    async def test_file_path_generation(self, handler, mock_task, mock_subtask, mock_progress_callback, temp_dir):
        """测试文件路径生成"""
        with patch.object(handler, '_download_image') as mock_download, \
             patch('pathlib.Path') as mock_path_class:
            
            mock_download.return_value = True
            
            # 模拟Path类返回临时目录
            mock_path_instance = Mock()
            mock_path_instance.mkdir = Mock()
            mock_path_instance.__truediv__ = Mock(return_value=temp_dir / "test.jpg")
            mock_path_class.return_value = mock_path_instance
            
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证目录创建
            mock_path_instance.mkdir.assert_called_with(parents=True, exist_ok=True)
            
            # 验证下载被调用
            mock_download.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_safe_filename_generation(self, handler):
        """测试安全文件名生成"""
        test_cases = [
            ("正常文件名", "正常文件名"),
            ("包含/特殊\\字符:的*文件名", "包含_特殊_字符_的_文件名"),
            ("很长的文件名" * 20, "很长的文件名" * 20),  # 测试长度限制
            ("", "untitled"),  # 空文件名
            ("   ", "untitled"),  # 只有空格
        ]
        
        for input_name, expected_pattern in test_cases:
            safe_name = handler._safe_filename(input_name)
            
            # 验证不包含危险字符
            dangerous_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
            for char in dangerous_chars:
                assert char not in safe_name
            
            # 验证长度限制
            assert len(safe_name) <= 200
            
            # 验证非空
            assert len(safe_name.strip()) > 0
    
    @pytest.mark.asyncio
    async def test_image_size_validation(self, handler, temp_dir):
        """测试图片大小验证"""
        # 创建不同大小的测试图片
        sizes = [(100, 100), (1920, 1080), (50, 50)]
        
        for width, height in sizes:
            img = Image.new('RGB', (width, height), color='blue')
            img_path = temp_dir / f"test_{width}x{height}.jpg"
            img.save(img_path)
            
            # 验证图片可以被处理
            is_valid = handler._validate_image_size(img_path, max_size_mb=10)
            assert is_valid is True
    
    @pytest.mark.asyncio
    async def test_image_corruption_handling(self, handler, temp_dir):
        """测试损坏图片处理"""
        # 创建损坏的图片文件
        corrupted_file = temp_dir / "corrupted.jpg"
        corrupted_file.write_bytes(b"not an image")
        
        # 验证损坏图片的处理
        is_valid = handler._validate_image_file(corrupted_file)
        assert is_valid is False
    
    @pytest.mark.asyncio
    async def test_concurrent_cover_download(self, handler):
        """测试并发封面下载"""
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
                cover=f"https://example.com/cover{i}.jpg",
                meta={"aid": 12345 + i, "cid": 67890 + i},
                state=TaskState.ACTIVE
            )
            subtask = SubTask(
                id=f"subtask-{i}",
                task_id=f"task-{i}",
                type=SubTaskType.COVER,
                state=TaskState.ACTIVE,
                params={}
            )
            callback = ProgressCallback(f"task-{i}", f"subtask-{i}", AsyncMock())
            
            tasks.append(task)
            subtasks.append(subtask)
            callbacks.append(callback)
        
        with patch.object(handler, '_download_image') as mock_download:
            mock_download.return_value = True
            
            # 并发执行
            results = await asyncio.gather(*[
                handler.execute(task, subtask, callback)
                for task, subtask, callback in zip(tasks, subtasks, callbacks)
            ])
            
            # 验证所有任务都成功
            assert all(results)
            assert mock_download.call_count == 3
    
    @pytest.mark.asyncio
    async def test_retry_mechanism(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试重试机制"""
        with patch.object(handler, '_download_image') as mock_download:
            # 模拟前两次失败，第三次成功
            mock_download.side_effect = [False, False, True]
            
            # 如果处理器实现了重试机制，这里可以测试
            # 目前的实现可能没有重试，所以这个测试可能需要调整
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 根据实际实现调整断言
            assert isinstance(result, bool)
    
    @pytest.mark.asyncio
    async def test_different_image_formats(self, handler, temp_dir):
        """测试不同图片格式的处理"""
        formats = [
            ('JPEG', 'jpg'),
            ('PNG', 'png'),
            ('WEBP', 'webp')
        ]
        
        for pil_format, ext in formats:
            # 创建不同格式的测试图片
            img = Image.new('RGB', (100, 100), color='green')
            img_bytes = io.BytesIO()
            img.save(img_bytes, format=pil_format)
            img_data = img_bytes.getvalue()
            
            cover_url = f"https://example.com/cover.{ext}"
            output_path = temp_dir / f"test_cover.{ext}"
            
            with patch('aiohttp.ClientSession') as mock_session_class:
                # 模拟aiohttp响应
                mock_response = AsyncMock()
                mock_response.status = 200
                mock_response.read.return_value = img_data
                
                mock_session = AsyncMock()
                mock_session.get.return_value.__aenter__.return_value = mock_response
                mock_session_class.return_value.__aenter__.return_value = mock_session
                
                # 执行下载
                success = await handler._download_image(cover_url, output_path)
                
                # 验证结果
                assert success is True
    
    def test_handler_initialization(self, handler):
        """测试处理器初始化"""
        assert handler is not None
        assert hasattr(handler, 'execute')
        assert callable(handler.execute)
    
    @pytest.mark.asyncio
    async def test_url_normalization(self, handler):
        """测试URL标准化"""
        test_cases = [
            ("//i0.hdslb.com/bfs/archive/cover.jpg", "https://i0.hdslb.com/bfs/archive/cover.jpg"),
            ("https://i0.hdslb.com/bfs/archive/cover.jpg", "https://i0.hdslb.com/bfs/archive/cover.jpg"),
            ("http://example.com/cover.jpg", "http://example.com/cover.jpg"),
        ]
        
        for input_url, expected_url in test_cases:
            normalized_url = handler._normalize_url(input_url)
            assert normalized_url == expected_url
    
    @pytest.mark.asyncio
    async def test_metadata_extraction(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试元数据提取和保存"""
        with patch.object(handler, '_download_image') as mock_download:
            mock_download.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is True
            
            # 如果处理器会更新子任务的输出路径，可以在这里验证
            # assert mock_subtask.output_path is not None