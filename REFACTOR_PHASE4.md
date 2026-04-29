# 阶段4：元数据下载系统实现

## 4.1 子任务处理器实现

### VideoHandler - 视频下载
```python
class VideoHandler:
    """视频下载处理器"""
    
    async def execute(self, task: Task, subtask: SubTask) -> bool:
        """执行视频下载"""
        try:
            # 获取视频 URL
            video_info = await self.get_video_info(task.media_id)
            
            # 选择最佳质量
            download_url = self.select_quality(video_info, subtask.params.get('quality', 80))
            
            # 使用 DownloadEngine 下载
            engine = DownloadEngine()
            success = await engine.download_video(
                url=download_url,
                output_path=subtask.output_path,
                progress_callback=self.progress_callback
            )
            
            return success
        except Exception as e:
            await self.handle_error(subtask, e)
            return False
```

### SubtitleHandler - 字幕下载
```python
class SubtitleHandler:
    """字幕下载处理器"""
    
    async def execute(self, task: Task, subtask: SubTask) -> bool:
        """下载并转换字幕"""
        try:
            # 获取字幕列表
            subtitles = await self.get_subtitle_list(task.media_id)
            
            for subtitle in subtitles:
                # 下载字幕文件
                subtitle_content = await self.download_subtitle(subtitle['url'])
                
                # 转换格式（JSON -> SRT/ASS）
                converted = self.convert_subtitle(subtitle_content, subtitle['format'])
                
                # 保存文件
                output_file = f"{subtask.output_path}.{subtitle['lang']}.srt"
                await self.save_file(output_file, converted)
            
            return True
        except Exception as e:
            await self.handle_error(subtask, e)
            return False
```

### DanmakuHandler - 弹幕下载
```python
class DanmakuHandler:
    """弹幕下载处理器"""
    
    async def execute(self, task: Task, subtask: SubTask) -> bool:
        """下载弹幕并转换格式"""
        try:
            # 获取弹幕数据
            danmaku_data = await self.get_danmaku_data(task.media_id)
            
            # 转换为 ASS 格式
            ass_content = self.convert_to_ass(danmaku_data)
            
            # 保存文件
            output_file = f"{subtask.output_path}.danmaku.ass"
            await self.save_file(output_file, ass_content)
            
            return True
        except Exception as e:
            await self.handle_error(subtask, e)
            return False
```

### ThumbHandler - 封面下载
```python
class ThumbHandler:
    """封面下载处理器"""
    
    async def execute(self, task: Task, subtask: SubTask) -> bool:
        """下载封面图片"""
        try:
            # 获取高清封面 URL
            cover_url = task.meta.get('cover') or task.cover
            if not cover_url:
                return True  # 没有封面不算错误
            
            # 下载封面
            cover_data = await self.download_image(cover_url)
            
            # 保存文件
            output_file = f"{subtask.output_path}.jpg"
            await self.save_file(output_file, cover_data)
            
            return True
        except Exception as e:
            await self.handle_error(subtask, e)
            return False
```

### NfoHandler - NFO 元数据
```python
class NfoHandler:
    """NFO 元数据生成器"""
    
    async def execute(self, task: Task, subtask: SubTask) -> bool:
        """生成 NFO 元数据文件"""
        try:
            # 构建 NFO 内容
            nfo_content = self.build_nfo_content(task)
            
            # 保存 NFO 文件
            output_file = f"{subtask.output_path}.nfo"
            await self.save_file(output_file, nfo_content)
            
            return True
        except Exception as e:
            await self.handle_error(subtask, e)
            return False
    
    def build_nfo_content(self, task: Task) -> str:
        """构建 NFO XML 内容"""
        meta = task.meta
        return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<episodedetails>
    <title>{task.title}</title>
    <plot>{task.desc}</plot>
    <thumb>{task.cover}</thumb>
    <aired>{meta.get('pubdate', '')}</aired>
    <studio>哔哩哔哩</studio>
    <director>{meta.get('owner', {}).get('name', '')}</director>
    <runtime>{meta.get('duration', 0)}</runtime>
</episodedetails>"""
```

## 4.2 文件组织系统

### NamingTemplate - 命名模板
```python
class NamingTemplate:
    """文件命名模板系统"""
    
    TEMPLATES = {
        'video': '{uploader}/{title}',
        'series': '{uploader}/{series_title}/P{index:02d} {title}',
        'bangumi': '{series_title}/S{season:02d}E{episode:02d} {title}'
    }
    
    def render(self, template_name: str, context: dict) -> str:
        """渲染命名模板"""
        template = self.TEMPLATES.get(template_name, self.TEMPLATES['video'])
        return self.safe_filename(template.format(**context))
    
    def safe_filename(self, filename: str) -> str:
        """生成安全的文件名"""
        # 移除非法字符
        illegal_chars = '<>:"/\\|?*'
        for char in illegal_chars:
            filename = filename.replace(char, '_')
        return filename
```

### FileOrganizer - 文件整理器
```python
class FileOrganizer:
    """文件整理器"""
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
    
    async def organize_task_files(self, task: Task) -> str:
        """整理任务相关的所有文件"""
        # 确定输出目录
        output_dir = self.get_output_directory(task)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成文件名
        base_name = self.generate_filename(task)
        
        return str(output_dir / base_name)
```

## 4.3 任务编排系统

### TaskOrchestrator - 任务编排器
```python
class TaskOrchestrator:
    """任务编排器 - 管理子任务的执行顺序"""
    
    def __init__(self):
        self.handlers = {
            'video': VideoHandler(),
            'subtitle': SubtitleHandler(),
            'danmaku': DanmakuHandler(),
            'cover': ThumbHandler(),
            'avatar': AvatarHandler(),
            'nfo': NfoHandler()
        }
    
    async def execute_task(self, task: Task) -> bool:
        """执行完整任务（包含所有子任务）"""
        try:
            # 1. 准备阶段 - 获取元数据
            await self.prepare_task(task)
            
            # 2. 创建子任务
            subtasks = await self.create_subtasks(task)
            
            # 3. 执行子任务（视频优先，其他并行）
            video_success = await self.execute_video_subtask(task, subtasks['video'])
            if not video_success:
                return False
            
            # 4. 并行执行其他子任务
            other_tasks = [
                self.execute_subtask(task, subtasks[key])
                for key in ['subtitle', 'danmaku', 'cover', 'nfo']
                if key in subtasks
            ]
            await asyncio.gather(*other_tasks, return_exceptions=True)
            
            return True
        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            return False
```