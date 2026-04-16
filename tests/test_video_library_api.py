"""
VideoLibrary API 集成测试

测试视频库API端点：
- POST /api/video-library/check-batch - 批量检查视频
- GET /api/video-library/refresh - 刷新视频库
- GET /api/video-library/status - 获取视频库状态
"""

import pytest
import sys
import os

# 添加项目路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
apps_api_path = os.path.join(project_root, 'apps', 'api', 'src')
sys.path.insert(0, apps_api_path)

from fastapi.testclient import TestClient
from main import app


class TestVideoLibraryAPI:
    """测试视频库API端点"""

    def setup_method(self):
        """每个测试方法前的设置"""
        self.client = TestClient(app)

    def test_check_videos_in_library_api(self):
        """测试批量检查视频API"""
        response = self.client.post(
            "/api/video-library/check-batch",
            json={"bvids": ["BV1xx411c7mD", "BV1yy411c7mD"]}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "downloaded" in data["data"]
        assert "not_downloaded" in data["data"]

    def test_check_videos_in_library_api_empty_list(self):
        """测试批量检查视频API - 空列表"""
        response = self.client.post(
            "/api/video-library/check-batch",
            json={"bvids": []}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["data"]["downloaded"] == []
        assert data["data"]["not_downloaded"] == []

    def test_check_videos_in_library_api_invalid_format(self):
        """测试批量检查视频API - 无效格式"""
        response = self.client.post(
            "/api/video-library/check-batch",
            json={"bvids": "not_a_list"}
        )

        assert response.status_code == 422  # Validation error

    def test_refresh_library_api(self):
        """测试刷新视频库API"""
        response = self.client.get("/api/video-library/refresh")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data

    def test_get_library_status_api(self):
        """测试获取视频库状态API"""
        response = self.client.get("/api/video-library/status")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "data" in data
        assert "total_folders" in data["data"]
        assert "total_videos" in data["data"]
        assert "total_size_mb" in data["data"]
        assert "last_scan_time" in data["data"]

    def test_check_videos_in_library_api_large_list(self):
        """测试批量检查视频API - 大列表"""
        # 生成100个测试BVID
        bvids = [f"BV1{i:010d}411c7mD" for i in range(100)]

        response = self.client.post(
            "/api/video-library/check-batch",
            json={"bvids": bvids}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert len(data["data"]["downloaded"]) + len(data["data"]["not_downloaded"]) == len(bvids)