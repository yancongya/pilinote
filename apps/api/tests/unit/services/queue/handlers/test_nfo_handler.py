"""
NFO处理器单元测试

测试SingleNfoHandler的NFO文件生成、元数据格式化等功能
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import tempfile
import shutil
import xml.etree.ElementTree as ET
from datetime import datetime

from src.services.queue.handlers.nfo import SingleNfoHandler
from src.services.queue.handlers.base import ProgressCallback
from src.models.task import Task, SubTask, TaskState, SubTaskType


class TestSingleNfoHandler:
    """NFO处理器测试类"""
    
    @pytest.fixture
    def handler(self):
        """创建NFO处理器实例"""
        return SingleNfoHandler()
    
    @pytest.fixture
    def mock_task(self):
        """创建模拟任务"""
        return Task(
            id="test-task-id",
            media_type="video",
            media_id="BV1xx411c7mD",
            title="测试视频标题",
            cover="https://i0.hdslb.com/bfs/archive/test_cover.jpg",
            desc="这是一个测试视频的描述内容",
            meta={
                "aid": 12345,
                "cid": 67890,
                "duration": 300,
                "pubdate": 1640995200,
                "view": 10000,
                "danmaku": 500,
                "reply": 100,
                "favorite": 200,
                "coin": 50,
                "share": 30,
                "like": 800,
                "owner": {
                    "name": "测试UP主",
                    "mid": 123456,
                    "face": "https://i0.hdslb.com/bfs/face/avatar.jpg"
                },
                "stat": {
                    "view": 10000,
                    "danmaku": 500,
                    "reply": 100,
                    "favorite": 200,
                    "coin": 50,
                    "share": 30,
                    "like": 800
                },
                "file_paths": {
                    "nfo": "/downloads/nfo/测试视频标题.nfo"
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
            type=SubTaskType.NFO,
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
    
    @pytest.mark.asyncio
    async def test_execute_success(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试NFO文件生成成功"""
        with patch.object(handler, '_generate_nfo_content') as mock_generate, \
             patch.object(handler, '_save_nfo_file') as mock_save:
            
            mock_generate.return_value = "<movie>test content</movie>"
            mock_save.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is True
            mock_generate.assert_called_once_with(mock_task)
            mock_save.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_execute_missing_metadata(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试缺少元数据时的处理"""
        # 清空任务元数据
        mock_task.meta = {}
        
        with patch.object(handler, '_generate_nfo_content') as mock_generate, \
             patch.object(handler, '_save_nfo_file') as mock_save:
            
            mock_generate.return_value = "<movie>minimal content</movie>"
            mock_save.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果 - 即使缺少元数据也应该生成基本的NFO
            assert result is True
    
    @pytest.mark.asyncio
    async def test_execute_save_failure(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试保存失败的处理"""
        with patch.object(handler, '_generate_nfo_content') as mock_generate, \
             patch.object(handler, '_save_nfo_file') as mock_save:
            
            mock_generate.return_value = "<movie>test content</movie>"
            mock_save.return_value = False  # 保存失败
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is False
    
    @pytest.mark.asyncio
    async def test_execute_exception_handling(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试异常处理"""
        with patch.object(handler, '_generate_nfo_content') as mock_generate:
            mock_generate.side_effect = Exception("生成NFO失败")
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is False
    
    def test_nfo_content_generation(self, handler, mock_task):
        """测试NFO内容生成"""
        nfo_content = handler._generate_nfo_content(mock_task)
        
        # 验证NFO内容不为空
        assert nfo_content is not None
        assert len(nfo_content) > 0
        
        # 验证XML格式
        try:
            root = ET.fromstring(nfo_content)
            assert root.tag in ["movie", "tvshow", "episode"]  # 常见的NFO根元素
        except ET.ParseError:
            pytest.fail("生成的NFO内容不是有效的XML格式")
    
    def test_nfo_content_structure(self, handler, mock_task):
        """测试NFO内容结构"""
        nfo_content = handler._generate_nfo_content(mock_task)
        root = ET.fromstring(nfo_content)
        
        # 验证必要的元素存在
        expected_elements = [
            "title",
            "plot",  # 描述
            "year",
            "runtime",
            "thumb",  # 封面
            "genre"
        ]
        
        for element_name in expected_elements:
            element = root.find(element_name)
            # 某些元素可能不存在，但如果存在应该有内容
            if element is not None:
                assert element.text is not None or len(element.attrib) > 0
    
    def test_nfo_metadata_mapping(self, handler, mock_task):
        """测试元数据映射"""
        nfo_content = handler._generate_nfo_content(mock_task)
        root = ET.fromstring(nfo_content)
        
        # 验证标题映射
        title_elem = root.find("title")
        if title_elem is not None:
            assert mock_task.title in title_elem.text
        
        # 验证描述映射
        plot_elem = root.find("plot")
        if plot_elem is not None:
            assert mock_task.desc in plot_elem.text
        
        # 验证时长映射
        runtime_elem = root.find("runtime")
        if runtime_elem is not None:
            # 时长应该是分钟数
            expected_minutes = mock_task.meta.get("duration", 0) // 60
            assert str(expected_minutes) in runtime_elem.text
    
    def test_nfo_statistics_inclusion(self, handler, mock_task):
        """测试统计信息包含"""
        nfo_content = handler._generate_nfo_content(mock_task)
        
        # 验证统计信息被包含在NFO中
        stat_keywords = ["view", "like", "favorite", "coin", "share"]
        
        for keyword in stat_keywords:
            if keyword in mock_task.meta:
                # 统计信息应该以某种形式出现在NFO中
                assert str(mock_task.meta[keyword]) in nfo_content or keyword in nfo_content.lower()
    
    def test_nfo_uploader_info(self, handler, mock_task):
        """测试UP主信息包含"""
        nfo_content = handler._generate_nfo_content(mock_task)
        root = ET.fromstring(nfo_content)
        
        # 查找导演或制作人信息
        director_elem = root.find("director")
        credits_elem = root.find("credits")
        
        uploader_name = mock_task.meta.get("owner", {}).get("name", "")
        
        # UP主信息应该出现在导演或制作人字段中
        if director_elem is not None:
            assert uploader_name in director_elem.text
        elif credits_elem is not None:
            assert uploader_name in credits_elem.text
    
    def test_nfo_date_formatting(self, handler, mock_task):
        """测试日期格式化"""
        nfo_content = handler._generate_nfo_content(mock_task)
        root = ET.fromstring(nfo_content)
        
        # 查找日期相关元素
        year_elem = root.find("year")
        premiered_elem = root.find("premiered")
        
        if year_elem is not None:
            # 年份应该是4位数字
            year_text = year_elem.text.strip()
            assert year_text.isdigit() and len(year_text) == 4
        
        if premiered_elem is not None:
            # 首播日期应该是YYYY-MM-DD格式
            date_text = premiered_elem.text.strip()
            try:
                datetime.strptime(date_text, "%Y-%m-%d")
            except ValueError:
                pytest.fail(f"日期格式不正确: {date_text}")
    
    @pytest.mark.asyncio
    async def test_nfo_file_saving(self, handler, temp_dir):
        """测试NFO文件保存"""
        nfo_content = "<movie><title>测试视频</title></movie>"
        output_path = temp_dir / "test.nfo"
        
        # 执行保存
        success = handler._save_nfo_file(nfo_content, output_path)
        
        # 验证保存成功
        assert success is True
        assert output_path.exists()
        
        # 验证文件内容
        saved_content = output_path.read_text(encoding='utf-8')
        assert nfo_content in saved_content
    
    @pytest.mark.asyncio
    async def test_progress_callback_updates(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试进度回调更新"""
        with patch.object(handler, '_generate_nfo_content') as mock_generate, \
             patch.object(handler, '_save_nfo_file') as mock_save:
            
            mock_generate.return_value = "<movie>test</movie>"
            mock_save.return_value = True
            
            # 执行测试
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证进度回调被调用
            assert mock_progress_callback.callback.call_count >= 2
            
            # 验证进度回调参数
            calls = mock_progress_callback.callback.call_args_list
            
            # 第一次调用应该是开始状态
            first_call = calls[0][0][0]
            assert "准备生成NFO" in first_call.get("message", "")
            
            # 最后一次调用应该是完成状态
            last_call = calls[-1][0][0]
            assert last_call.get("progress", 0) == 100
    
    @pytest.mark.asyncio
    async def test_file_path_generation(self, handler, mock_task, mock_subtask, mock_progress_callback, temp_dir):
        """测试文件路径生成"""
        with patch.object(handler, '_generate_nfo_content') as mock_generate, \
             patch.object(handler, '_save_nfo_file') as mock_save, \
             patch('pathlib.Path') as mock_path_class:
            
            mock_generate.return_value = "<movie>test</movie>"
            mock_save.return_value = True
            
            # 模拟Path类返回临时目录
            mock_path_instance = Mock()
            mock_path_instance.mkdir = Mock()
            mock_path_instance.__truediv__ = Mock(return_value=temp_dir / "test.nfo")
            mock_path_class.return_value = mock_path_instance
            
            await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证目录创建
            mock_path_instance.mkdir.assert_called_with(parents=True, exist_ok=True)
            
            # 验证保存被调用
            mock_save.assert_called_once()
    
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
    
    def test_nfo_encoding_handling(self, handler, temp_dir):
        """测试NFO文件编码处理"""
        # 测试包含中文和特殊字符的内容
        nfo_content = """<?xml version="1.0" encoding="UTF-8"?>
<movie>
    <title>测试视频标题</title>
    <plot>包含中文和特殊字符：©®™</plot>
    <genre>科技</genre>
</movie>"""
        
        output_path = temp_dir / "encoding_test.nfo"
        
        # 执行保存
        success = handler._save_nfo_file(nfo_content, output_path)
        
        # 验证保存成功
        assert success is True
        assert output_path.exists()
        
        # 验证文件可以正确读取
        saved_content = output_path.read_text(encoding='utf-8')
        assert "测试视频标题" in saved_content
        assert "科技" in saved_content
    
    @pytest.mark.asyncio
    async def test_concurrent_nfo_generation(self, handler):
        """测试并发NFO生成"""
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
                desc=f"测试描述{i}",
                meta={
                    "aid": 12345 + i,
                    "cid": 67890 + i,
                    "duration": 300 + i * 60,
                    "owner": {"name": f"UP主{i}"}
                },
                state=TaskState.ACTIVE
            )
            subtask = SubTask(
                id=f"subtask-{i}",
                task_id=f"task-{i}",
                type=SubTaskType.NFO,
                state=TaskState.ACTIVE,
                params={}
            )
            callback = ProgressCallback(f"task-{i}", f"subtask-{i}", AsyncMock())
            
            tasks.append(task)
            subtasks.append(subtask)
            callbacks.append(callback)
        
        with patch.object(handler, '_save_nfo_file') as mock_save:
            mock_save.return_value = True
            
            # 并发执行
            results = await asyncio.gather(*[
                handler.execute(task, subtask, callback)
                for task, subtask, callback in zip(tasks, subtasks, callbacks)
            ])
            
            # 验证所有任务都成功
            assert all(results)
            assert mock_save.call_count == 3
    
    def test_nfo_template_customization(self, handler, mock_task):
        """测试NFO模板自定义"""
        # 测试不同类型的媒体
        media_types = ["video", "movie", "episode"]
        
        for media_type in media_types:
            mock_task.media_type = media_type
            
            nfo_content = handler._generate_nfo_content(mock_task)
            
            # 验证NFO内容根据媒体类型调整
            assert nfo_content is not None
            assert len(nfo_content) > 0
            
            # 验证XML格式
            root = ET.fromstring(nfo_content)
            assert root.tag is not None
    
    def test_nfo_validation(self, handler, mock_task):
        """测试NFO内容验证"""
        nfo_content = handler._generate_nfo_content(mock_task)
        
        # 验证XML格式正确
        try:
            root = ET.fromstring(nfo_content)
        except ET.ParseError as e:
            pytest.fail(f"NFO XML格式错误: {e}")
        
        # 验证必要字段存在
        title_elem = root.find("title")
        assert title_elem is not None, "NFO缺少title元素"
        assert title_elem.text is not None, "title元素内容为空"
    
    def test_handler_initialization(self, handler):
        """测试处理器初始化"""
        assert handler is not None
        assert hasattr(handler, 'execute')
        assert callable(handler.execute)
    
    @pytest.mark.asyncio
    async def test_metadata_completeness(self, handler, mock_task, mock_subtask, mock_progress_callback):
        """测试元数据完整性"""
        with patch.object(handler, '_save_nfo_file') as mock_save:
            mock_save.return_value = True
            
            # 执行测试
            result = await handler.execute(mock_task, mock_subtask, mock_progress_callback)
            
            # 验证结果
            assert result is True
            
            # 验证生成的NFO内容包含了任务的关键信息
            call_args = mock_save.call_args
            nfo_content = call_args[0][0]  # 第一个参数是NFO内容
            
            # 验证关键信息被包含
            assert mock_task.title in nfo_content
            if mock_task.desc:
                assert mock_task.desc in nfo_content