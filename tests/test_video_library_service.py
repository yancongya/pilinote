"""
VideoLibraryService 单元测试

测试视频库服务的核心功能：
- 批量检查视频是否在库中
- 刷新视频库
- 获取视频库状态
"""

import pytest
import sys
import os

# 添加项目路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
apps_api_path = os.path.join(project_root, 'apps', 'api', 'src')
sys.path.insert(0, apps_api_path)

from src.services.video_library_service import VideoLibraryService
from src.database import SessionLocal


@pytest.mark.asyncio
class TestVideoLibraryService:
    """测试视频库服务"""

    def setup_method(self):
        """每个测试方法前的设置"""
        self.db = SessionLocal()
        self.service = VideoLibraryService(self.db)

    def teardown_method(self):
        """每个测试方法后的清理"""
        self.db.close()

    def test_check_videos_in_library(self):
        """测试批量检查视频是否在视频库中"""
        # 准备测试数据
        bvids = ["BV1xx411c7mD", "BV1yy411c7mD", "BV1zz411c7mD"]

        # 调用方法
        result = self.service.check_videos_in_library(bvids)

        # 验证返回值结构
        assert "downloaded" in result
        assert "not_downloaded" in result
        assert isinstance(result["downloaded"], list)
        assert isinstance(result["not_downloaded"], list)

        # 验证所有视频都被处理
        assert len(result["downloaded"]) + len(result["not_downloaded"]) == len(bvids)

        # 验证返回的bvid在输入列表中
        all_returned_bvids = result["downloaded"] + result["not_downloaded"]
        for bvid in bvids:
            assert bvid in all_returned_bvids

    def test_check_videos_in_library_empty_list(self):
        """测试空列表的批量检查"""
        result = self.service.check_videos_in_library([])

        assert result["downloaded"] == []
        assert result["not_downloaded"] == []
        assert len(result["downloaded"]) + len(result["not_downloaded"]) == 0

    def test_refresh_library(self):
        """测试刷新视频库"""
        result = self.service.refresh_library()

        # 验证返回值包含必要的字段
        assert isinstance(result, dict)
        # 根据实际实现，scan_library可能返回不同的字段
        # 这里我们只验证它返回了一个字典

    def test_get_library_status(self):
        """测试获取视频库状态"""
        status = self.service.get_library_status()

        # 验证返回值结构
        assert isinstance(status, dict)
        assert "total_folders" in status
        assert "total_videos" in status
        assert "total_size_mb" in status
        assert "last_scan_time" in status

        # 验证字段类型
        assert isinstance(status["total_folders"], int)
        assert isinstance(status["total_videos"], int)
        assert isinstance(status["total_size_mb"], (int, float))
        assert isinstance(status["last_scan_time"], (int, float))

        # 验证数值合理性
        assert status["total_folders"] >= 0
        assert status["total_videos"] >= 0
        assert status["total_size_mb"] >= 0
        assert status["last_scan_time"] >= 0