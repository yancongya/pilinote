"""
头像处理器单元测试

测试AvatarHandler的头像下载、用户信息获取等功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil
from PIL import Image
import io

from src.services.queue.handlers.thumb import AvatarHandler
from src.services.queue.handlers.base import ProgressCallback
from src.models.task import Task, SubTask, TaskState, SubTaskType


class TestAvatarHandler:
    """头像处理器测试类"""
    
    @pytest.fixture
    def handler(self):
        """创建头像处理器实例"""
        return AvatarHandler()
    
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
                "owner": {
                    "name": "测试UP主",
                    "mid": 123456,
                    "face": "https://i0.hdslb.com/bfs/face/test_avatar.jpg"
                },
                "file_paths": {
                    "avatar": "/downloads/avatars/测试UP主.jpg"
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
            type=SubTaskType.AVATAR,
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
    def sample_avatar_data(self):
        """创建示例头像数据"""
        # 创建一个简单的测试头像
        img = Image.new('RGB', (64, 64), color='blue')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        return img_bytes.getvalue()
    
    @pytest.mark.asyncio
    async def test_execute_success(self, handler, mock_task, mock_subtask, mock_progress_callback, sample_avatar_data):
        """测试头像下载成功"""
        with patch.object(handler, '_download_avatar') as mock_download:
            mock_download.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is True
            mock_download.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_execute_no_owner_info(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试没有UP主信息时的处理"""
        # 清空UP主信息
        mock_task.meta["owner"] = {}
        
        # 执行测试
        result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
        
        # 验证结果 - 应该跳过而不是失败
        assert result is True
    
    @pytest.mark.asyncio
    async def test_execute_no_avatar_url(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试没有头像URL时的处理"""
        # 清空头像URL
        mock_task.meta["owner"]["face"] = ""
        
        # 执行测试
        result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
        
        # 验证结果 - 应该跳过而不是失败
        assert result is True
    
    @pytest.mark.asyncio
    async def test_execute_download_failure(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试下载失败的处理"""
        with patch.object(handler, '_download_avatar') as mock_download:
            mock_download.return_value = False
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is False
    
    @pytest.mark.asyncio
    async def test_execute_exception_handling(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试异常处理"""
        with patch.object(handler, '_download_avatar') as mock_download:
            mock_download.side_effect = Exception("网络错误")
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is False
    
    @pytest.mark.asyncio
    async def test_avatar_download_success(self, handler, sample_avatar_data, temp_dir):
        """测试头像下载成功"""
        avatar_url = "https://i0.hdslb.com/bfs/face/avatar.jpg"
        output_path = temp_dir / "test_avatar.jpg"
        
        with patch('aiohttp.ClientSession') as mock_session_class:
            # 模拟aiohttp响应
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.read.return_value = sample_avatar_data
            
            mock_session = AsyncMock()
            mock_session.get.return_value.__aenter__.return_value = mock_response
            mock_session_class.return_value.__aenter__.return_value = mock_session
            
            # 执行下载
            success = await handler._download_avatar(avatar_url, output_path)
            
            # 验证结果
            assert success is True
    
    @pytest.mark.asyncio
    async def test_avatar_download_http_error(self, handler, temp_dir):
        """测试HTTP错误处理"""
        avatar_url = "https://i0.hdslb.com/bfs/face/avatar.jpg"
        output_path = temp_dir / "test_avatar.jpg"
        
        with patch('aiohttp.ClientSession') as mock_session_class:
            # 模拟HTTP 404错误
            mock_response = AsyncMock()
            mock_response.status = 404
            
            mock_session = AsyncMock()
            mock_session.get.return_value.__aenter__.return_value = mock_response
            mock_session_class.return_value.__aenter__.return_value = mock_session
            
            # 执行下载
            success = await handler._download_avatar(avatar_url, output_path)
            
            # 验证结果
            assert success is False
    
    @pytest.mark.asyncio
    async def test_progress_callback_updates(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试进度回调更新"""
        with patch.object(handler, '_download_avatar') as mock_download:
            mock_download.return_value = True
            
            # 执行测试
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证进度回调被调用
            assert mock_progress_callback.callback.call_count >= 2
            
            # 验证进度回调参数
            calls = mock_progress_callback.callback.call_args_list
            
            # 第一次调用应该是开始状态
            first_call = calls[0][0][0]
            assert "准备下载头像" in first_call.get("message", "")
            
            # 最后一次调用应该是完成状态
            last_call = calls[-1][0][0]
            assert last_call.get("progress", 0) == 100
    
    @pytest.mark.asyncio
    async def test_file_path_generation(self, handler, mock_task, mock_subtask, mock_progress_callback, temp_dir):
        """测试文件路径生成"""
        with patch.object(handler, '_download_avatar') as mock_download, \
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
            ("正常UP主", "正常UP主"),
            ("包含/特殊\\字符:的*UP主", "包含_特殊_字符_的_UP主"),
            ("很长的UP主名字" * 20, "很长的UP主名字" * 20),  # 测试长度限制
            ("", "unknown_user"),  # 空用户名
            ("   ", "unknown_user"),  # 只有空格
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
    async def test_user_info_extraction(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试用户信息提取"""
        with patch.object(handler, '_download_avatar') as mock_download:
            mock_download.return_value = True
            
            # 执行测试
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证用户信息被正确提取
            mock_download.assert_called_once()
            call_args = mock_download.call_args
            
            # 验证传递的参数包含正确的头像URL
            avatar_url = call_args[0][0]  # 第一个位置参数
            assert "test_avatar.jpg" in avatar_url
    
    @pytest.mark.asyncio
    async def test_avatar_url_normalization(self, handler):
        """测试头像URL标准化"""
        test_cases = [
            ("//i0.hdslb.com/bfs/face/avatar.jpg", "https://i0.hdslb.com/bfs/face/avatar.jpg"),
            ("https://i0.hdslb.com/bfs/face/avatar.jpg", "https://i0.hdslb.com/bfs/face/avatar.jpg"),
            ("http://example.com/avatar.jpg", "http://example.com/avatar.jpg"),
        ]
        
        for input_url, expected_url in test_cases:
            normalized_url = handler._normalize_url(input_url)
            assert normalized_url == expected_url
    
    @pytest.mark.asyncio
    async def test_concurrent_avatar_download(self, handler):
        """测试并发头像下载"""
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
                meta={
                    "aid": 12345 + i,
                    "cid": 67890 + i,
                    "owner": {
                        "name": f"测试UP主{i}",
                        "mid": 123456 + i,
                        "face": f"https://i0.hdslb.com/bfs/face/avatar{i}.jpg"
                    }
                },
                state=TaskState.ACTIVE
            )
            subtask = SubTask(
                id=f"subtask-{i}",
                task_id=f"task-{i}",
                type=SubTaskType.AVATAR,
                state=TaskState.ACTIVE,
                params={}
            )
            callback = ProgressCallback(f"task-{i}", f"subtask-{i}", AsyncMock())
            
            tasks.append(task)
            subtasks.append(subtask)
            callbacks.append(callback)
        
        with patch.object(handler, '_download_avatar') as mock_download:
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
    async def test_avatar_size_validation(self, handler, temp_dir):
        """测试头像大小验证"""
        # 创建不同大小的测试头像
        sizes = [(64, 64), (128, 128), (256, 256)]
        
        for width, height in sizes:
            img = Image.new('RGB', (width, height), color='purple')
            img_path = temp_dir / f"avatar_{width}x{height}.jpg"
            img.save(img_path)
            
            # 验证头像可以被处理
            is_valid = handler._validate_avatar_size(img_path, max_size_mb=5)
            assert is_valid is True
    
    @pytest.mark.asyncio
    async def test_default_avatar_handling(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试默认头像处理"""
        # 设置默认头像URL
        mock_task.meta["owner"]["face"] = "https://static.hdslb.com/images/member/noface.gif"
        
        with patch.object(handler, '_download_avatar') as mock_download:
            mock_download.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果 - 默认头像也应该被下载
            assert result is True
            mock_download.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_user_mid_extraction(self, handler, mock_task):
        """测试用户MID提取"""
        # 测试不同的用户信息格式
        test_cases = [
            ({"mid": 123456, "name": "用户1"}, 123456),
            ({"uid": 789012, "name": "用户2"}, 789012),  # 有些API返回uid
            ({"name": "用户3"}, None),  # 没有ID
            ({}, None)  # 空信息
        ]
        
        for owner_info, expected_mid in test_cases:
            mock_task.meta["owner"] = owner_info
            
            extracted_mid = handler._extract_user_mid(mock_task.meta.get("owner", {}))
            assert extracted_mid == expected_mid
    
    @pytest.mark.asyncio
    async def test_avatar_cache_handling(self, handler, mock_task, mock_subtask, mock_progress_callback, temp_dir):
        """测试头像缓存处理"""
        # 模拟已存在的头像文件
        existing_avatar = temp_dir / "existing_avatar.jpg"
        img = Image.new('RGB', (64, 64), color='red')
        img.save(existing_avatar)
        
        with patch.object(handler, '_download_avatar') as mock_download, \
             patch.object(handler, '_get_output_path') as mock_get_path:
            
            mock_get_path.return_value = existing_avatar
            mock_download.return_value = True
            
            # 如果处理器实现了缓存检查，这里可以测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is True
    
    def test_handler_initialization(self, handler):
        """测试处理器初始化"""
        assert handler is not None
        assert hasattr(handler, 'execute')
        assert callable(handler.execute)
    
    @pytest.mark.asyncio
    async def test_metadata_preservation(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试元数据保存"""
        with patch.object(handler, '_download_avatar') as mock_download:
            mock_download.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is True
            
            # 如果处理器会更新子任务的输出路径或元数据，可以在这里验证
            # assert mock_subtask.output_path is not None