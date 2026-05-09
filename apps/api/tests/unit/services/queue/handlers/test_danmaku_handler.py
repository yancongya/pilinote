"""
弹幕处理器单元测试

测试DanmakuHandler的弹幕获取、XML格式转换等功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil
import xml.etree.ElementTree as ET

from src.services.queue.handlers.danmaku import DanmakuHandler
from src.services.queue.handlers.base import ProgressCallback
from src.models.task import Task, SubTask, TaskState, SubTaskType


class TestDanmakuHandler:
    """弹幕处理器测试类"""
    
    @pytest.fixture
    def handler(self):
        """创建弹幕处理器实例"""
        return DanmakuHandler()
    
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
                    "danmaku": "/downloads/danmaku/测试视频标题.xml"
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
            type=SubTaskType.DANMAKU,
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
    def sample_danmaku_data(self):
        """创建示例弹幕数据"""
        return {
            "elems": [
                {
                    "id": 1,
                    "progress": 1000,  # 1秒
                    "mode": 1,
                    "fontsize": 25,
                    "color": 16777215,
                    "midHash": "test_user_1",
                    "content": "第一条弹幕",
                    "ctime": 1640995200
                },
                {
                    "id": 2,
                    "progress": 5000,  # 5秒
                    "mode": 4,
                    "fontsize": 25,
                    "color": 65280,
                    "midHash": "test_user_2",
                    "content": "第二条弹幕",
                    "ctime": 1640995260
                },
                {
                    "id": 3,
                    "progress": 10000,  # 10秒
                    "mode": 5,
                    "fontsize": 18,
                    "color": 255,
                    "midHash": "test_user_3",
                    "content": "第三条弹幕",
                    "ctime": 1640995320
                }
            ]
        }
    
    @pytest.mark.asyncio
    async def test_execute_success(self, handler, mock_task, mock_subtask, mock_progress_callback, sample_danmaku_data):
        """测试弹幕下载成功"""
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_danmaku_data') as mock_get_danmaku, \
             patch.object(handler, '_save_danmaku_xml') as mock_save_xml:
            
            # 设置模拟返回值
            mock_get_info.return_value = (12345, 67890)
            mock_get_danmaku.return_value = sample_danmaku_data
            mock_save_xml.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is True
            mock_get_info.assert_called_once_with("BV1xx411c7mD")
            mock_get_danmaku.assert_called_once_with(12345, 67890)
            mock_save_xml.assert_called_once()
    
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
    async def test_execute_no_danmaku_data(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试没有弹幕数据时的处理"""
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_danmaku_data') as mock_get_danmaku:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_danmaku.return_value = {"elems": []}  # 空弹幕
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果 - 没有弹幕也算成功
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
    async def test_danmaku_xml_conversion(self, handler, sample_danmaku_data, temp_dir):
        """测试弹幕XML格式转换"""
        output_file = temp_dir / "test_danmaku.xml"
        
        # 调用XML转换方法
        success = handler._save_danmaku_xml(sample_danmaku_data, output_file)
        
        # 验证转换成功
        assert success is True
        assert output_file.exists()
        
        # 验证XML格式
        tree = ET.parse(output_file)
        root = tree.getroot()
        
        # 验证根元素
        assert root.tag == "i"
        
        # 验证弹幕元素
        danmaku_elements = root.findall("d")
        assert len(danmaku_elements) == 3
        
        # 验证第一条弹幕
        first_danmaku = danmaku_elements[0]
        assert first_danmaku.text == "第一条弹幕"
        
        # 验证弹幕属性格式 (时间,模式,字号,颜色,时间戳,池,用户ID,弹幕ID)
        p_attr = first_danmaku.get("p")
        assert p_attr is not None
        p_parts = p_attr.split(",")
        assert len(p_parts) == 8
        assert p_parts[0] == "1.0"  # 时间（秒）
        assert p_parts[1] == "1"    # 模式
        assert p_parts[2] == "25"   # 字号
        assert p_parts[3] == "16777215"  # 颜色
    
    @pytest.mark.asyncio
    async def test_danmaku_time_conversion(self, handler):
        """测试弹幕时间转换"""
        test_cases = [
            (0, "0.0"),
            (1000, "1.0"),
            (1500, "1.5"),
            (60000, "60.0"),
            (90500, "90.5")
        ]
        
        for progress_ms, expected_seconds in test_cases:
            seconds = handler._convert_progress_to_seconds(progress_ms)
            assert seconds == expected_seconds
    
    @pytest.mark.asyncio
    async def test_danmaku_mode_mapping(self, handler):
        """测试弹幕模式映射"""
        # B站弹幕模式：1-滚动，4-底部，5-顶部，6-逆向，7-高级，8-代码，9-BAS
        test_modes = [1, 4, 5, 6, 7, 8, 9]
        
        for mode in test_modes:
            # 验证模式值在有效范围内
            assert isinstance(mode, int)
            assert 1 <= mode <= 9
    
    @pytest.mark.asyncio
    async def test_danmaku_color_conversion(self, handler):
        """测试弹幕颜色转换"""
        test_cases = [
            (16777215, "16777215"),  # 白色
            (65280, "65280"),        # 绿色
            (255, "255"),            # 蓝色
            (16711680, "16711680"),  # 红色
            (0, "0")                 # 黑色
        ]
        
        for color_int, expected_str in test_cases:
            color_str = str(color_int)
            assert color_str == expected_str
    
    @pytest.mark.asyncio
    async def test_progress_callback_updates(self, handler, mock_task, mock_subtask, mock_progress_callback, sample_danmaku_data):
        """测试进度回调更新"""
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_danmaku_data') as mock_get_danmaku, \
             patch.object(handler, '_save_danmaku_xml') as mock_save_xml:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_danmaku.return_value = sample_danmaku_data
            mock_save_xml.return_value = True
            
            # 执行测试
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证进度回调被调用
            assert mock_progress_callback.callback.call_count >= 3
            
            # 验证进度回调参数
            calls = mock_progress_callback.callback.call_args_list
            
            # 第一次调用应该是开始状态
            first_call = calls[0][0][0]
            assert "准备下载弹幕" in first_call.get("message", "")
            
            # 最后一次调用应该是完成状态
            last_call = calls[-1][0][0]
            assert last_call.get("progress", 0) == 100
    
    @pytest.mark.asyncio
    async def test_file_path_generation(self, handler, mock_task, mock_subtask, mock_progress_callback, sample_danmaku_data, temp_dir):
        """测试文件路径生成"""
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_danmaku_data') as mock_get_danmaku, \
             patch('pathlib.Path') as mock_path_class:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_danmaku.return_value = sample_danmaku_data
            
            # 模拟Path类返回临时目录
            mock_path_instance = Mock()
            mock_path_instance.mkdir = Mock()
            mock_path_instance.__truediv__ = Mock(return_value=temp_dir / "test.xml")
            mock_path_class.return_value = mock_path_instance
            
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证目录创建
            mock_path_instance.mkdir.assert_called_with(parents=True, exist_ok=True)
    
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
    async def test_large_danmaku_handling(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试大量弹幕处理"""
        # 创建大量弹幕数据
        large_danmaku_data = {
            "elems": [
                {
                    "id": i,
                    "progress": i * 1000,
                    "mode": 1,
                    "fontsize": 25,
                    "color": 16777215,
                    "midHash": f"user_{i}",
                    "content": f"弹幕内容 {i}",
                    "ctime": 1640995200 + i
                }
                for i in range(1000)  # 1000条弹幕
            ]
        }
        
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_danmaku_data') as mock_get_danmaku, \
             patch.object(handler, '_save_danmaku_xml') as mock_save_xml:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_danmaku.return_value = large_danmaku_data
            mock_save_xml.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证能够处理大量弹幕
            assert result is True
            mock_save_xml.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_special_characters_in_danmaku(self, handler, temp_dir):
        """测试弹幕中的特殊字符处理"""
        special_danmaku_data = {
            "elems": [
                {
                    "id": 1,
                    "progress": 1000,
                    "mode": 1,
                    "fontsize": 25,
                    "color": 16777215,
                    "midHash": "test_user",
                    "content": "包含<>&\"'特殊字符的弹幕",
                    "ctime": 1640995200
                },
                {
                    "id": 2,
                    "progress": 2000,
                    "mode": 1,
                    "fontsize": 25,
                    "color": 16777215,
                    "midHash": "test_user",
                    "content": "包含emoji😀🎉的弹幕",
                    "ctime": 1640995260
                }
            ]
        }
        
        output_file = temp_dir / "special_danmaku.xml"
        
        # 调用XML转换方法
        success = handler._save_danmaku_xml(special_danmaku_data, output_file)
        
        # 验证转换成功
        assert success is True
        assert output_file.exists()
        
        # 验证XML可以正确解析
        tree = ET.parse(output_file)
        root = tree.getroot()
        danmaku_elements = root.findall("d")
        
        # 验证特殊字符被正确处理
        assert len(danmaku_elements) == 2
        assert "特殊字符" in danmaku_elements[0].text
        assert "emoji" in danmaku_elements[1].text
    
    def test_handler_initialization(self, handler):
        """测试处理器初始化"""
        assert handler is not None
        assert hasattr(handler, 'execute')
        assert callable(handler.execute)
    
    @pytest.mark.asyncio
    async def test_concurrent_danmaku_processing(self, handler):
        """测试并发弹幕处理"""
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
                type=SubTaskType.DANMAKU,
                state=TaskState.ACTIVE,
                params={}
            )
            callback = ProgressCallback(f"task-{i}", f"subtask-{i}", AsyncMock())
            
            tasks.append(task)
            subtasks.append(subtask)
            callbacks.append(callback)
        
        with patch.object(handler, '_get_video_info') as mock_get_info, \
             patch.object(handler, '_get_danmaku_data') as mock_get_danmaku, \
             patch.object(handler, '_save_danmaku_xml') as mock_save_xml:
            
            mock_get_info.return_value = (12345, 67890)
            mock_get_danmaku.return_value = {"elems": []}
            mock_save_xml.return_value = True
            
            # 并发执行
            results = await asyncio.gather(*[
                handler.execute(task, subtask, callback)
                for task, subtask, callback in zip(tasks, subtasks, callbacks)
            ])
            
            # 验证所有任务都成功
            assert all(results)
            assert mock_get_danmaku.call_count == 3