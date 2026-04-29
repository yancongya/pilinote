"""
文件组织系统 - 提供智能的文件命名和目录结构管理

功能：
1. 模板化文件命名
2. 安全文件名生成
3. 目录结构管理
4. 文件冲突处理
"""

import re
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class NamingTemplate:
    """文件命名模板系统"""
    
    # 预定义模板
    TEMPLATES = {
        # 单个视频
        'single_video': '{uploader}/{title}',
        
        # 系列视频
        'series_video': '{uploader}/{series_title}/P{index:02d} {title}',
        
        # 番剧
        'bangumi': '{series_title}/S{season:02d}E{episode:02d} {title}',
        
        # 音乐
        'music': '{artist}/{album}/{track:02d} {title}',
        
        # 课程
        'lesson': '{course_title}/{chapter:02d} {title}',
        
        # 默认模板
        'default': '{uploader}/{title}'
    }
    
    def __init__(self):
        self.custom_templates: Dict[str, str] = {}
    
    def add_template(self, name: str, template: str):
        """添加自定义模板"""
        self.custom_templates[name] = template
        logger.info(f"添加自定义模板: {name} -> {template}")
    
    def render(self, template_name: str, context: Dict[str, Any]) -> str:
        """渲染命名模板"""
        # 优先使用自定义模板
        template = self.custom_templates.get(template_name)
        if not template:
            template = self.TEMPLATES.get(template_name, self.TEMPLATES['default'])
        
        try:
            # 清理上下文数据
            clean_context = self._clean_context(context)
            
            # 渲染模板
            rendered = template.format(**clean_context)
            
            # 生成安全文件名
            safe_name = self.safe_filename(rendered)
            
            logger.debug(f"模板渲染: {template_name} -> {safe_name}")
            return safe_name
            
        except KeyError as e:
            logger.warning(f"模板渲染失败，缺少字段 {e}，使用默认模板")
            # 使用默认模板重试
            default_template = self.TEMPLATES['default']
            clean_context = self._clean_context(context)
            rendered = default_template.format(**clean_context)
            return self.safe_filename(rendered)
        
        except Exception as e:
            logger.error(f"模板渲染异常: {e}")
            # 最后的备用方案
            return self.safe_filename(f"{context.get('uploader', 'Unknown')}/{context.get('title', 'Untitled')}")
    
    def _clean_context(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """清理上下文数据，确保所有字段都是字符串且安全"""
        clean = {}
        
        for key, value in context.items():
            if value is None:
                clean[key] = 'Unknown'
            elif isinstance(value, (int, float)):
                clean[key] = value  # 保持数字类型用于格式化
            elif isinstance(value, str):
                # 清理字符串
                clean[key] = self._clean_string(value)
            else:
                clean[key] = str(value)
        
        # 确保必要字段存在
        clean.setdefault('uploader', 'Unknown')
        clean.setdefault('title', 'Untitled')
        clean.setdefault('series_title', clean.get('title', 'Untitled'))
        clean.setdefault('index', 1)
        clean.setdefault('season', 1)
        clean.setdefault('episode', 1)
        clean.setdefault('track', 1)
        clean.setdefault('chapter', 1)
        
        return clean
    
    def _clean_string(self, text: str) -> str:
        """清理字符串，移除特殊字符"""
        if not text:
            return 'Unknown'
        
        # 移除控制字符
        text = ''.join(char for char in text if ord(char) >= 32)
        
        # 限制长度
        if len(text) > 100:
            text = text[:97] + '...'
        
        return text.strip()
    
    def safe_filename(self, filename: str) -> str:
        """生成安全的文件名"""
        if not filename:
            return 'untitled'
        
        # Windows/Linux 非法字符
        illegal_chars = r'<>:"/\\|?*'
        
        # 替换非法字符
        safe_name = filename
        for char in illegal_chars:
            safe_name = safe_name.replace(char, '_')
        
        # 移除连续的下划线
        safe_name = re.sub(r'_+', '_', safe_name)
        
        # 移除开头和结尾的下划线和点
        safe_name = safe_name.strip('_.')
        
        # 处理保留名称（Windows）
        reserved_names = {
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
        }
        
        name_upper = safe_name.upper()
        if name_upper in reserved_names or name_upper.split('.')[0] in reserved_names:
            safe_name = f"_{safe_name}"
        
        # 确保不为空
        if not safe_name:
            safe_name = 'untitled'
        
        return safe_name


class FileOrganizer:
    """文件整理器 - 管理文件的存储位置和命名"""
    
    def __init__(self, base_path: str = "downloads"):
        self.base_path = Path(base_path)
        self.naming_template = NamingTemplate()
        
        # 确保基础目录存在
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def get_task_directory(self, task_data: Dict[str, Any]) -> Path:
        """获取任务的输出目录"""
        # 根据媒体类型选择模板
        media_type = task_data.get('media_type', 'video')
        template_name = self._get_template_name(media_type, task_data)
        
        # 渲染目录路径
        dir_path = self.naming_template.render(template_name, task_data)
        
        # 构建完整路径
        full_path = self.base_path / dir_path
        
        # 创建目录
        full_path.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"任务目录: {full_path}")
        return full_path
    
    def get_file_path(self, task_data: Dict[str, Any], file_type: str, extension: str = "") -> Path:
        """获取文件的完整路径"""
        # 获取任务目录
        task_dir = self.get_task_directory(task_data)
        
        # 生成基础文件名
        base_name = self._generate_base_filename(task_data)
        
        # 添加文件类型后缀
        if file_type and file_type != 'video':
            filename = f"{base_name}.{file_type}"
        else:
            filename = base_name
        
        # 添加扩展名
        if extension and not extension.startswith('.'):
            extension = f".{extension}"
        
        filename += extension
        
        # 处理文件名冲突
        file_path = task_dir / filename
        file_path = self._resolve_conflict(file_path)
        
        return file_path
    
    def _get_template_name(self, media_type: str, task_data: Dict[str, Any]) -> str:
        """根据媒体类型和数据选择合适的模板"""
        # 检查是否是系列视频
        if task_data.get('series_title') and task_data.get('index'):
            return 'series_video'
        
        # 检查是否是番剧
        if media_type == 'bangumi':
            return 'bangumi'
        
        # 检查是否是音乐
        if media_type in ['music', 'music_list']:
            return 'music'
        
        # 检查是否是课程
        if media_type == 'lesson':
            return 'lesson'
        
        # 默认单个视频模板
        return 'single_video'
    
    def _generate_base_filename(self, task_data: Dict[str, Any]) -> str:
        """生成基础文件名（不含扩展名）"""
        title = task_data.get('title', 'Untitled')
        
        # 如果是系列视频，添加序号
        if task_data.get('index'):
            index = task_data['index']
            title = f"P{index:02d} {title}"
        
        # 如果是番剧，使用季集格式
        if task_data.get('season') and task_data.get('episode'):
            season = task_data['season']
            episode = task_data['episode']
            title = f"S{season:02d}E{episode:02d} {title}"
        
        return self.naming_template.safe_filename(title)
    
    def _resolve_conflict(self, file_path: Path) -> Path:
        """解决文件名冲突"""
        if not file_path.exists():
            return file_path
        
        # 生成新的文件名
        base_name = file_path.stem
        extension = file_path.suffix
        parent_dir = file_path.parent
        
        counter = 1
        while True:
            new_name = f"{base_name} ({counter}){extension}"
            new_path = parent_dir / new_name
            
            if not new_path.exists():
                logger.info(f"文件名冲突，重命名为: {new_name}")
                return new_path
            
            counter += 1
            
            # 防止无限循环
            if counter > 1000:
                timestamp = int(datetime.now().timestamp())
                new_name = f"{base_name}_{timestamp}{extension}"
                return parent_dir / new_name
    
    def organize_task_files(self, task_data: Dict[str, Any]) -> Dict[str, Path]:
        """为任务组织所有文件路径"""
        file_paths = {}
        
        # 视频文件
        video_ext = self._get_video_extension(task_data)
        file_paths['video'] = self.get_file_path(task_data, 'video', video_ext)
        
        # 字幕文件
        file_paths['subtitle'] = self.get_file_path(task_data, 'subtitle', 'srt')
        
        # 弹幕文件
        file_paths['danmaku_xml'] = self.get_file_path(task_data, 'danmaku', 'xml')
        file_paths['danmaku_ass'] = self.get_file_path(task_data, 'danmaku', 'ass')
        
        # 封面文件
        file_paths['cover'] = self.get_file_path(task_data, 'cover', 'jpg')
        
        # UP主头像
        file_paths['avatar'] = self.get_file_path(task_data, 'avatar', 'jpg')
        
        # NFO元数据
        file_paths['nfo'] = self.get_file_path(task_data, 'nfo', 'nfo')
        
        return file_paths
    
    def _get_video_extension(self, task_data: Dict[str, Any]) -> str:
        """根据任务数据确定视频扩展名"""
        # 从元数据中获取格式信息
        meta = task_data.get('meta', {})
        
        # 检查是否指定了格式
        format_info = meta.get('format')
        if format_info:
            if 'mp4' in format_info.lower():
                return 'mp4'
            elif 'flv' in format_info.lower():
                return 'flv'
        
        # 默认使用 mp4
        return 'mp4'
    
    def cleanup_empty_directories(self):
        """清理空目录"""
        try:
            for root, dirs, files in self.base_path.walk(top_down=False):
                for dir_name in dirs:
                    dir_path = root / dir_name
                    try:
                        if not any(dir_path.iterdir()):
                            dir_path.rmdir()
                            logger.info(f"清理空目录: {dir_path}")
                    except OSError:
                        pass  # 目录不为空或其他错误
        except Exception as e:
            logger.error(f"清理空目录失败: {e}")


# 全局文件组织器实例
file_organizer = FileOrganizer()