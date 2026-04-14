from typing import Dict, Any
from pathlib import Path
import logging
from datetime import datetime

from .base import BaseHandler

logger = logging.getLogger(__name__)

class SingleNfoHandler(BaseHandler):
    """单集NFO处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理单集NFO生成"""
        filename = params.get('filename', 'movie.nfo')

        logger.info(f"开始生成NFO文件: {filename}")

        # 创建临时文件
        temp_path = self._get_temp_path(temp_dir, filename)
        temp_path.parent.mkdir(parents=True, exist_ok=True)

        # 生成NFO内容
        nfo_content = self._generate_nfo(meta)

        # 保存文件
        temp_path.write_text(nfo_content, encoding='utf-8')

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ NFO文件生成完成: {filename}")

    def _generate_nfo(self, meta: Dict[str, Any]) -> str:
        """生成NFO文件内容"""
        lines = []

        # 基本信息
        lines.append('<?xml version="1.0" encoding="UTF-8"?>')
        lines.append('<movie>')

        # BVID字段
        if meta.get('bvid'):
            lines.append(f'  <bvid>{self._escape_xml(meta["bvid"])}</bvid>')

        # 标题
        if meta.get('title'):
            lines.append(f'  <title>{self._escape_xml(meta["title"])}</title>')

        # 描述
        if meta.get('desc'):
            lines.append(f'  <plot>{self._escape_xml(meta["desc"])}</plot>')

        # UP主
        if meta.get('owner', {}).get('name'):
            lines.append(f'  <studio>{self._escape_xml(meta["owner"]["name"])}</studio>')

        # 发布日期
        if meta.get('pubdate'):
            pubdate = datetime.fromtimestamp(meta['pubdate'])
            lines.append(f'  <premiered>{pubdate.strftime("%Y-%m-%d")}</premiered>')

        # 时长
        if meta.get('duration'):
            duration = meta['duration']
            if duration > 0:
                minutes = int(duration // 60)
                seconds = int(duration % 60)
                runtime_str = f"{minutes}:{seconds:02d}"
                lines.append(f'  <runtime>{runtime_str}</runtime>')

        # 封面
        if meta.get('pic'):
            lines.append(f'  <thumb>{self._escape_xml(meta["pic"])}</thumb>')

        # 统计信息
        if meta.get('stat'):
            stat = meta['stat']
            lines.append('  <statistics>')
            if stat.get('view'):
                lines.append(f'    <play>{stat["view"]}</play>')
            if stat.get('like'):
                lines.append(f'    <like>{stat["like"]}</like>')
            if stat.get('coin'):
                lines.append(f'    <coin>{stat["coin"]}</coin>')
            if stat.get('favorite'):
                lines.append(f'    <favorite>{stat["favorite"]}</favorite>')
            if stat.get('share'):
                lines.append(f'    <share>{stat["share"]}</share>')
            if stat.get('danmaku'):
                lines.append(f'    <danmaku>{stat["danmaku"]}</danmaku>')
            if stat.get('reply'):
                lines.append(f'    <reply>{stat["reply"]}</reply>')
            lines.append('  </statistics>')
        
        # 评分（基于互动率计算）
        if meta.get('stat'):
            rating = self._calculate_rating(meta['stat'])
            if rating > 0:
                lines.append(f'  <rating>{rating:.1f}</rating>')
        
        # 视频标签（使用真实的视频标签）
        if meta.get('tags') and len(meta['tags']) > 0:
            tags = meta['tags']
            # 只取前3个标签
            tags_list = tags[:3] if len(tags) > 3 else tags
            if tags_list:
                lines.append('  <tags>')
                for tag in tags_list:
                    lines.append(f'    <tag>{self._escape_xml(str(tag))}</tag>')
                lines.append('  </tags>')

        lines.append('</movie>')

        return '\n'.join(lines)
    
    def _escape_xml(self, text: str) -> str:
        """转义XML特殊字符"""
        if not text:
            return ''
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')
        text = text.replace('"', '&quot;')
        text = text.replace("'", '&apos;')
        return text
    
    def _calculate_rating(self, stats: Dict[str, Any]) -> float:
        """计算B站视频评分（基于互动率）"""
        try:
            play = stats.get('view', 0) or 0
            if play == 0:
                return 0.0
            
            like = stats.get('like', 0) or 0
            coin = stats.get('coin', 0) or 0
            favorite = stats.get('favorite', 0) or 0
            
            # 计算互动得分
            interaction_score = (like * 0.4 + coin * 0.3 + favorite * 0.3)
            
            # 计算互动率
            interaction_rate = interaction_score / play
            
            # 互动率转换评分（10分制，最高不超过10分）
            rating = min(interaction_rate * 500, 10)
            
            return round(rating, 1)
        except Exception as e:
            logger.warning(f"计算评分失败: {e}")
            return 0.0


class AlbumNfoHandler(BaseHandler):
    """合集NFO处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理合集NFO生成"""
        filename = params.get('filename', 'tvshow.nfo')

        logger.info(f"开始生成合集NFO文件: {filename}")

        # 创建临时文件
        temp_path = self._get_temp_path(temp_dir, filename)
        temp_path.parent.mkdir(parents=True, exist_ok=True)

        # 生成NFO内容
        nfo_content = self._generate_album_nfo(meta)

        # 保存文件
        temp_path.write_text(nfo_content, encoding='utf-8')

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ 合集NFO文件生成完成: {filename}")

    def _generate_album_nfo(self, meta: Dict[str, Any]) -> str:
        """生成合集NFO文件内容"""
        lines = []

        lines.append('<?xml version="1.0" encoding="UTF-8"?>')
        lines.append('<tvshow>')

        # 标题
        if meta.get('title'):
            lines.append(f'  <title>{self._escape_xml(meta["title"])}</title>')

        # 描述
        if meta.get('desc'):
            lines.append(f'  <plot>{self._escape_xml(meta["desc"])}</plot>')

        # UP主
        if meta.get('owner', {}).get('name'):
            lines.append(f'  <studio>{self._escape_xml(meta["owner"]["name"])}</studio>')

        lines.append('</tvshow>')

        return '\n'.join(lines)

    def _escape_xml(self, text: str) -> str:
        """转义XML特殊字符"""
        if not text:
            return ''
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')
        text = text.replace('"', '&quot;')
        text = text.replace("'", '&apos;')
        return text
