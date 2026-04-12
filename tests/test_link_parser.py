"""
链接解析后端单元测试

测试 bilibili_utils.py 中的 LinkParser
支持 12 种链接格式
"""

import pytest
import sys
import os

# 添加项目路径
apps_api_path = os.path.join(os.path.dirname(__file__), 'apps', 'api', 'src')
sys.path.insert(0, apps_api_path)

# 移除 src 前缀，因为 utils 已经在 src 目录下了
from utils.bilibili_utils import LinkParser, MediaType, BilibiliIDConverter


class TestLinkParser:
    """测试链接解析器"""
    
    def setup_method(self):
        self.parser = LinkParser()
    
    # ==================== 视频 ID 测试 ====================
    
    def test_parse_bv_id(self):
        """测试 BV 号解析"""
        result = self.parser.parse_id('BV1xx411c7mD')
        assert result['type'] == MediaType.VIDEO
        assert result['id'] == 'BV1xx411c7mD'
    
    def test_parse_av_id(self):
        """测试 AV 号解析"""
        result = self.parser.parse_id('av12345678')
        assert result['type'] == MediaType.VIDEO
        assert result['id'] == 'av12345678'
    
    def test_parse_bv_id_uppercase(self):
        """测试 BV 号大小写"""
        result = self.parser.parse_id('BV1XX411C7MD')
        assert result['type'] == MediaType.VIDEO
    
    # ==================== 番剧 ID 测试 ====================
    
    def test_parse_ep_id(self):
        """测试 EP 号解析"""
        result = self.parser.parse_id('ep123456')
        assert result['type'] == MediaType.BANGUMI
    
    def test_parse_ss_id(self):
        """测试 SS 号解析"""
        result = self.parser.parse_id('ss123456')
        assert result['type'] == MediaType.BANGUMI
    
    def test_parse_md_id(self):
        """测试 MD 号解析"""
        result = self.parser.parse_id('md123456')
        assert result['type'] == MediaType.BANGUMI
    
    # ==================== 音乐 ID 测试 ====================
    
    def test_parse_au_id(self):
        """测试音乐号解析"""
        result = self.parser.parse_id('au123456')
        assert result['type'] == MediaType.MUSIC
    
    def test_parse_am_id(self):
        """测试歌单号解析"""
        result = self.parser.parse_id('am123456')
        assert result['type'] == MediaType.MUSIC_LIST
    
    # ==================== 图文 ID 测试 ====================
    
    def test_parse_cv_id(self):
        """测试图文号解析"""
        result = self.parser.parse_id('cv123456')
        assert result['type'] == MediaType.OPUS
    
    def test_parse_rl_id(self):
        """测试图文合集解析"""
        result = self.parser.parse_id('rl123456')
        assert result['type'] == MediaType.OPUS_LIST
    
    # ==================== URL 格式测试 ====================
    
    def test_parse_bv_url(self):
        """测试 BV 视频 URL"""
        result = self.parser.parse_id('https://www.bilibili.com/video/BV1xx411c7mD')
        assert result['type'] == MediaType.VIDEO
    
    def test_parse_av_url(self):
        """测试 AV 视频 URL"""
        result = self.parser.parse_id('https://www.bilibili.com/video/av12345678')
        assert result['type'] == MediaType.VIDEO
    
    def test_parse_short_url(self):
        """测试短链接"""
        result = self.parser.parse_id('https://b23.tv/abc123')
        assert result['type'] == MediaType.VIDEO
    
    # ==================== 用户空间测试 ====================
    
    def test_parse_user_favorite(self):
        """测试用户收藏夹"""
        result = self.parser.parse_id('https://space.bilibili.com/12345678/favlist?fid=9876543')
        assert result['type'] == MediaType.FAVORITE
    
    def test_parse_user_video(self):
        """测试用户视频页"""
        result = self.parser.parse_id('https://space.bilibili.com/12345678/video')
        assert result['type'] == MediaType.USER_VIDEO
    
    # ==================== 错误输入测试 ====================
    
    def test_invalid_url(self):
        """测试无效链接"""
        with pytest.raises(ValueError):
            self.parser.parse_id('invalid-url')
    
    def test_empty_input(self):
        """测试空输入"""
        with pytest.raises(ValueError):
            self.parser.parse_id('')
    
    def test_non_bilibili_url(self):
        """测试非B站链接"""
        with pytest.raises(ValueError):
            self.parser.parse_id('https://youtube.com/video/123')


class TestBilibiliIDConverter:
    """测试 BV/AV 转换器"""
    
    def setup_method(self):
        self.converter = BilibiliIDConverter()
    
    def test_is_bvid(self):
        """测试是否是有效的 BV 号"""
        assert self.converter.is_bvid('BV1xx411c7mD') == True
        assert self.converter.is_bvid('bv123456789') == False
        assert self.converter.is_bvid('AV12345678') == False
    
    def test_av_to_bv(self):
        """测试 AV 转 BV"""
        # example: AV170001 -> BV1xx411c7mD
        bv = self.converter.av2bv(170001)
        assert bv.startswith('BV1')
    
    def test_bv_to_av(self):
        """测试 BV 转 AV"""
        # example: BV1xx411c7mD -> AV170001
        av = self.converter.bv2av('BV1xx411c7mD')
        assert av > 0
    
    def test_roundtrip(self):
        """测试往返转换"""
        original_av = 170001
        bv = self.converter.av2bv(original_av)
        av_back = self.converter.bv2av(bv)
        assert av_back == original_av


if __name__ == '__main__':
    pytest.main([__file__, '-v'])