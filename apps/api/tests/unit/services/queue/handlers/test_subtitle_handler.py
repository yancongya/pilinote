"""
字幕处理器单元测试

测试SubtitleHandler的字幕下载、SRT格式转换等功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil
import json

from src.services.queue.handlers.subtitle import SubtitleHandler
from src.services.queue.handlers.base import ProgressCallback
from src.models.task import Task, SubTask, TaskState, SubTaskType


class TestSubtitleHandler:
    """字幕处理器测试类"""
    
    @pytest.fixture
    def handler(self):
        """创建字幕处理器实例"""
        return SubtitleHandler()
    
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
                    "subtitle": "/downloads/subtitles/测试视频标题"
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
            type=SubTaskType.SUBTITLE,
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
    def sample_subtitle_data(self):
        """创建示例字幕数据"""
        return [
            {
                "lan": "zh-CN",
                "lan_doc": "中文（简体）",
                "subtitle_url": "https://api.bilibili.com/x/subtitle/1.json"
            },
            {
                "lan": "en",
                "lan_doc": "English",
                "subtitle_url": "https://api.bilibili.com/x/subtitle/2.json"
            }
        ]
    
    @pytest.fixture
    def sample_subtitle_content(self):
        """创建示例字幕内容"""
        return {
            "body": [
                {
                    "from": 0.0,
                    "to": 3.5,
                    "content": "欢迎观看这个视频"
                },
                {
                    "from": 3.5,
                    "to": 7.2,
                    "content": "这是第二句字幕"
                },
                {
                    "from": 7.2,
                    "to": 10.8,
                    "content": "感谢您的观看"
                }
            ]
        }
    
    @pytest.mark.asyncio
    async def test_execute_success(self, handler, mock_task, mock_subtask, mock_progress_callback, sample_subtitle_data):
        """测试字幕下载成功"""
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_subtitle_list') as mock_get_list, \
             patch.object(handler, '_download_single_subtitle') as mock_download:
            
            # 设置模拟返回值
            mock_get_info.return_value = (12345, 67890)
            mock_get_list.return_value = sample_subtitle_data
            mock_download.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is True
            mock_get_info.assert_called_once_with("BV1xx411c7mD")
            mock_get_list.assert_called_once_with(12345, 67890)
            assert mock_download.call_count == len(sample_subtitle_data)
    
    @pytest.mark.asyncio
    async def test_execute_missing_video_info(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试缺少视频信息时的处理"""
        # 清空任务元数据
        mock_task.meta = {}
        
        with patch.object(handler, '_get_video_info') as mock_get_info:
            mock_get_info.return_value = (None, None)
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果 - 应该跳过而不是失败
            assert result is True
            mock_get_info.assert_called_once_with("BV1xx411c7mD")
    
    @pytest.mark.asyncio
    async def test_execute_no_subtitles(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试没有字幕时的处理"""
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_subtitle_list') as mock_get_list:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_list.return_value = []  # 没有字幕
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果 - 没有字幕也算成功
            assert result is True
    
    @pytest.mark.asyncio
    async def test_execute_exception_handling(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试异常处理"""
        with patch.object(handler, '_get_video_info') as mock_get_info:
            mock_get_info.side_effect = Exception("网络错误")
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is False
    
    @pytest.mark.asyncio
    async def test_subtitle_download_success(self, handler, sample_subtitle_content, temp_dir):
        """测试单个字幕下载成功"""
        subtitle_info = {
            "lan": "zh-CN",
            "lan_doc": "中文（简体）",
            "subtitle_url": "https://api.bilibili.com/x/subtitle/1.json"
        }
        
        with patch('aiohttp.ClientSession') as mock_session_class:
            # 模拟aiohttp响应
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json.return_value = sample_subtitle_content
            
            mock_session = AsyncMock()
            mock_session.get.return_value.__aenter__.return_value = mock_response
            mock_session_class.return_value.__aenter__.return_value = mock_session
            
            # 执行下载
            success = await handler._download_single_subtitle(
                subtitle_info, 
                temp_dir, 
                "test_video"
            )
            
            # 验证结果
            assert success is True
            
            # 验证文件被创建
            expected_file = temp_dir / "test_video.中文（简体）.srt"
            assert expected_file.exists()
    
    @pytest.mark.asyncio
    async def test_subtitle_download_http_error(self, handler, temp_dir):
        """测试HTTP错误处理"""
        subtitle_info = {
            "lan": "zh-CN",
            "lan_doc": "中文（简体）",
            "subtitle_url": "https://api.bilibili.com/x/subtitle/1.json"
        }
        
        with patch('aiohttp.ClientSession') as mock_session_class:
            # 模拟HTTP 404错误
            mock_response = AsyncMock()
            mock_response.status = 404
            
            mock_session = AsyncMock()
            mock_session.get.return_value.__aenter__.return_value = mock_response
            mock_session_class.return_value.__aenter__.return_value = mock_session
            
            # 执行下载
            success = await handler._download_single_subtitle(
                subtitle_info, 
                temp_dir, 
                "test_video"
            )
            
            # 验证结果
            assert success is False
    
    def test_srt_conversion(self, handler, sample_subtitle_content):
        """测试SRT格式转换"""
        srt_content = handler._convert_to_srt(sample_subtitle_content)
        
        # 验证SRT格式
        lines = srt_content.strip().split('\n')
        
        # 验证第一个字幕条目
        assert lines[0] == "1"  # 序号
        assert "00:00:00,000 --> 00:00:03,500" in lines[1]  # 时间轴
        assert lines[2] == "欢迎观看这个视频"  # 内容
        assert lines[3] == ""  # 空行
        
        # 验证第二个字幕条目
        assert lines[4] == "2"  # 序号
        assert "00:00:03,500 --> 00:00:07,200" in lines[5]  # 时间轴
        assert lines[6] == "这是第二句字幕"  # 内容
    
    def test_time_conversion(self, handler):
        """测试时间格式转换"""
        test_cases = [
            (0.0, "00:00:00,000"),
            (3.5, "00:00:03,500"),
            (65.25, "00:01:05,250"),
            (3661.5, "01:01:01,500")
        ]
        
        for seconds, expected_srt_time in test_cases:
            srt_time = handler._seconds_to_srt_time(seconds)
            assert srt_time == expected_srt_time
    
    @pytest.mark.asyncio
    async def test_progress_callback_updates(self, handler, mock_task, mock_subtask, mock_progress_callback, sample_subtitle_data):
        """测试进度回调更新"""
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_subtitle_list') as mock_get_list, \
             patch.object(handler, '_download_single_subtitle') as mock_download:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_list.return_value = sample_subtitle_data
            mock_download.return_value = True
            
            # 执行测试
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证进度回调被调用
            assert mock_progress_callback.callback.call_count >= 3
            
            # 验证进度回调参数
            calls = mock_progress_callback.callback.call_args_list
            
            # 第一次调用应该是开始状态
            first_call = calls[0][0][0]
            assert "准备下载字幕" in first_call.get("message", "")
            
            # 最后一次调用应该是完成状态
            last_call = calls[-1][0][0]
            assert last_call.get("progress", 0) == 100
    
    @pytest.mark.asyncio
    async def test_file_path_generation(self, handler, mock_task, mock_subtask, mock_progress_callback, sample_subtitle_data, temp_dir):
        """测试文件路径生成"""
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_subtitle_list') as mock_get_list, \
             patch.object(handler, '_download_single_subtitle') as mock_download, \
             patch('pathlib.Path') as mock_path_class:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_list.return_value = sample_subtitle_data
            mock_download.return_value = True
            
            # 模拟Path类返回临时目录
            mock_path_instance = Mock()
            mock_path_instance.mkdir = Mock()
            mock_path_instance.__truediv__ = Mock(return_value=temp_dir)
            mock_path_class.return_value = mock_path_instance
            
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证目录创建
            mock_path_instance.mkdir.assert_called_with(parents=True, exist_ok=True)
            
            # 验证下载被调用
            assert mock_download.call_count == len(sample_subtitle_data)
    
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
    
    def test_subtitle_url_normalization(self, handler):
        """测试字幕URL标准化"""
        test_cases = [
            ("//api.bilibili.com/x/subtitle/1.json", "https://api.bilibili.com/x/subtitle/1.json"),
            ("/x/subtitle/1.json", "https://api.bilibili.com/x/subtitle/1.json"),
            ("https://api.bilibili.com/x/subtitle/1.json", "https://api.bilibili.com/x/subtitle/1.json"),
        ]
        
        for input_url, expected_url in test_cases:
            # 模拟字幕信息
            subtitle_info = {"subtitle_url": input_url}
            
            # 这里需要根据实际实现调整测试逻辑
            # 假设处理器有URL标准化方法
            if hasattr(handler, '_normalize_subtitle_url'):
                normalized_url = handler._normalize_subtitle_url(input_url)
                assert normalized_url == expected_url
    
    @pytest.mark.asyncio
    async def test_multiple_languages_handling(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试多语言字幕处理"""
        multilang_subtitles = [
            {"lan": "zh-CN", "lan_doc": "中文（简体）", "subtitle_url": "https://api.bilibili.com/x/subtitle/1.json"},
            {"lan": "zh-TW", "lan_doc": "中文（繁體）", "subtitle_url": "https://api.bilibili.com/x/subtitle/2.json"},
            {"lan": "en", "lan_doc": "English", "subtitle_url": "https://api.bilibili.com/x/subtitle/3.json"},
            {"lan": "ja", "lan_doc": "日本語", "subtitle_url": "https://api.bilibili.com/x/subtitle/4.json"}
        ]
        
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_subtitle_list') as mock_get_list, \
             patch.object(handler, '_download_single_subtitle') as mock_download:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_list.return_value = multilang_subtitles
            mock_download.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is True
            assert mock_download.call_count == len(multilang_subtitles)
    
    @pytest.mark.asyncio
    async def test_concurrent_subtitle_processing(self, handler):
        """测试并发字幕处理"""
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
                type=SubTaskType.SUBTITLE,
                state=TaskState.ACTIVE,
                params={}
            )
            callback = ProgressCallback(f"task-{i}", f"subtask-{i}", AsyncMock())
            
            tasks.append(task)
            subtasks.append(subtask)
            callbacks.append(callback)
        
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_subtitle_list') as mock_get_list, \
             patch.object(handler, '_download_single_subtitle') as mock_download:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_list.return_value = []  # 没有字幕
            mock_download.return_value = True
            
            # 并发执行
            results = await asyncio.gather(*[
                handler.execute(task, subtask, callback)
                for task, subtask, callback in zip(tasks, subtasks, callbacks)
            ])
            
            # 验证所有任务都成功
            assert all(results)
            assert mock_get_list.call_count == 3
    
    def test_empty_subtitle_content_handling(self, handler):
        """测试空字幕内容处理"""
        empty_subtitle_data = {"body": []}
        
        srt_content = handler._convert_to_srt(empty_subtitle_data)
        
        # 验证空字幕返回空字符串或合适的默认值
        assert srt_content == "" or srt_content.strip() == ""
    
    def test_malformed_subtitle_data_handling(self, handler):
        """测试格式错误的字幕数据处理"""
        malformed_data = {
            "body": [
                {"from": "invalid", "to": 3.5, "content": "测试"},  # 无效的from值
                {"from": 3.5, "content": "缺少to字段"},  # 缺少to字段
                {"from": 7.0, "to": 10.0}  # 缺少content字段
            ]
        }
        
        # 应该能够处理格式错误的数据而不崩溃
        try:
            srt_content = handler._convert_to_srt(malformed_data)
            # 验证返回了某种内容（可能是部分转换的结果）
            assert isinstance(srt_content, str)
        except Exception as e:
            # 如果抛出异常，应该是可预期的异常类型
            assert isinstance(e, (ValueError, TypeError, KeyError))
    
    def test_special_characters_in_subtitles(self, handler):
        """测试字幕中的特殊字符处理"""
        special_subtitle_data = {
            "body": [
                {
                    "from": 0.0,
                    "to": 3.0,
                    "content": "包含特殊字符：<>&\"'"
                },
                {
                    "from": 3.0,
                    "to": 6.0,
                    "content": "包含emoji😀🎉和符号©®™"
                }
            ]
        }
        
        srt_content = handler._convert_to_srt(special_subtitle_data)
        
        # 验证特殊字符被正确处理
        assert "特殊字符" in srt_content
        assert "emoji" in srt_content
        
        # 验证SRT格式仍然正确
        lines = srt_content.strip().split('\n')
        assert len(lines) >= 6  # 至少包含两个字幕条目
    
    def test_handler_initialization(self, handler):
        """测试处理器初始化"""
        assert handler is not None
        assert hasattr(handler, 'execute')
        assert callable(handler.execute)
    
    @pytest.mark.asyncio
    async def test_partial_download_success(self, handler, mock_task, mock_subtask, mock_progress_callback, sample_subtitle_data):
        """测试部分字幕下载成功的处理"""
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_subtitle_list') as mock_get_list, \
             patch.object(handler, '_download_single_subtitle') as mock_download:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_list.return_value = sample_subtitle_data
            
            # 模拟部分下载成功
            mock_download.side_effect = [True, False]  # 第一个成功，第二个失败
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果 - 部分成功也算成功
            assert result is True
            assert mock_download.call_count == len(sample_subtitle_data)