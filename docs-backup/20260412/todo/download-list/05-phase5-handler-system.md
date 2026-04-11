# 阶段5：处理器系统

## 概述

本阶段的目标是实现子任务处理器系统，参考BiliTools的架构设计，将文件处理逻辑（视频下载、字幕下载、弹幕下载、NFO生成等）分离到独立的处理器中，解决当前DownloadService职责过重、代码复杂的问题。

## 核心问题

### 当前问题

1. **DownloadService职责过重**
   - 同时负责任务管理、文件处理、数据库操作
   - NFO生成、封面下载、头像下载、字幕下载都在一个类中
   - 代码复杂，难以测试和维护

2. **缺少处理器概念**
   - 没有将不同的文件处理逻辑分离
   - 难以扩展新的处理类型
   - 代码复用性差

3. **文件处理逻辑混乱**
   - 视频下载、字幕下载、NFO生成混杂在一起
   - 临时文件管理混乱
   - 错误处理不统一

## 解决方案

### 1. SubTaskHandler - 子任务处理器基类

**文件**: `apps/api/src/services/queue/handlers/base.py`

```python
from abc import ABC, abstractmethod
from typing import Dict, Any
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class BaseHandler(ABC):
    """子任务处理器基类"""

    def __init__(self):
        self.name = self.__class__.__name__

    @abstractmethod
    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理子任务"""
        pass

    def _get_temp_path(self, temp_dir: Path, filename: str) -> Path:
        """获取临时文件路径"""
        return temp_dir / filename

    def _get_output_path(self, output_dir: Path, filename: str) -> Path:
        """获取输出文件路径"""
        return output_dir / filename

    async def _download_file(self, url: str, output_path: Path):
        """下载文件"""
        import aiohttp
        import asyncio

        logger.info(f"下载文件: {url} -> {output_path}")

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    content = await response.read()
                    output_path.parent.mkdir(parents=True, exist_ok=True)
                    with open(output_path, 'wb') as f:
                        f.write(content)
                    logger.info(f"✓ 文件下载完成: {output_path}")
                else:
                    raise Exception(f"下载失败: HTTP {response.status}")

    def _move_to_output(self, temp_path: Path, output_path: Path):
        """移动文件到输出目录"""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        import shutil
        shutil.move(str(temp_path), str(output_path))
        logger.info(f"✓ 文件已移动: {output_path}")
```

### 2. VideoHandler - 视频处理器

**文件**: `apps/api/src/services/queue/handlers/video.py`

```python
from typing import Dict, Any
from pathlib import Path
import logging

from .base import BaseHandler
from services.download_engine import DownloadEngine

logger = logging.getLogger(__name__)

class VideoHandler(BaseHandler):
    """视频处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理视频下载"""
        url = params['url']
        filename = params['filename']

        logger.info(f"开始下载视频: {filename}")

        # 获取临时路径
        temp_path = self._get_temp_path(temp_dir, filename)

        # 使用下载引擎下载
        engine = DownloadEngine()
        await engine.download(
            url=url,
            output_path=temp_path,
            quality=meta.get('quality', 80),
            codec=meta.get('codec', 'avc')
        )

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ 视频下载完成: {filename}")


class AudioHandler(BaseHandler):
    """音频处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理音频下载"""
        url = params['url']
        filename = params['filename']

        logger.info(f"开始下载音频: {filename}")

        # 获取临时路径
        temp_path = self._get_temp_path(temp_dir, filename)

        # 使用下载引擎下载
        engine = DownloadEngine()
        await engine.download_audio(
            url=url,
            output_path=temp_path,
            bitrate=meta.get('audio_bitrate', 192)
        )

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ 音频下载完成: {filename}")


class AudioVideoMergeHandler(BaseHandler):
    """音视频合并处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理音视频合并"""
        video_filename = params.get('video_filename')
        audio_filename = params.get('audio_filename')
        output_filename = params.get('output_filename')

        logger.info(f"开始合并音视频: {video_filename} + {audio_filename} -> {output_filename}")

        # 获取路径
        video_path = self._get_temp_path(temp_dir, video_filename)
        audio_path = self._get_temp_path(temp_dir, audio_filename)
        output_path = self._get_output_path(output_dir, output_filename)

        # 使用FFmpeg合并
        await self._merge_audio_video(video_path, audio_path, output_path)

        logger.info(f"✓ 音视频合并完成: {output_filename}")

    async def _merge_audio_video(self, video_path: Path, audio_path: Path, output_path: Path):
        """合并音视频"""
        import asyncio
        import subprocess

        output_path.parent.mkdir(parents=True, exist_ok=True)

        cmd = [
            'ffmpeg',
            '-i', str(video_path),
            '-i', str(audio_path),
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-y',
            str(output_path)
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            error_msg = stderr.decode('utf-8')
            logger.error(f"FFmpeg合并失败: {error_msg}")
            raise Exception(f"音视频合并失败: {error_msg}")
```

### 3. SubtitleHandler - 字幕处理器

**文件**: `apps/api/src/services/queue/handlers/subtitle.py`

```python
from typing import Dict, Any
from pathlib import Path
import logging
import json

from .base import BaseHandler

logger = logging.getLogger(__name__)

class SubtitleHandler(BaseHandler):
    """字幕处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理字幕下载"""
        url = params['url']
        lang = params.get('lang', 'zh')
        filename = params['filename']

        logger.info(f"开始下载字幕: {filename} ({lang})")

        # 获取临时路径
        temp_path = self._get_temp_path(temp_dir, filename)

        # 下载字幕
        content = await self._download_subtitle(url)

        # 转换为SRT格式
        srt_content = self._convert_to_srt(content)

        # 保存文件
        temp_path.parent.mkdir(parents=True, exist_ok=True)
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(srt_content)

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ 字幕下载完成: {filename}")

    async def _download_subtitle(self, url: str) -> dict:
        """下载字幕"""
        import aiohttp

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    return await response.json()
                else:
                    raise Exception(f"下载字幕失败: HTTP {response.status}")

    def _convert_to_srt(self, subtitle_data: dict) -> str:
        """转换为SRT格式"""
        lines = []

        # B站字幕格式
        if 'body' in subtitle_data:
            body = subtitle_data['body']
            for i, item in enumerate(body, 1):
                # 时间戳格式转换
                start = self._convert_timestamp(item['from'])
                end = self._convert_timestamp(item['to'])

                # 内容
                content = item['content']

                lines.append(f"{i}")
                lines.append(f"{start} --> {end}")
                lines.append(content)
                lines.append("")

        return '\n'.join(lines)

    def _convert_timestamp(self, timestamp: float) -> str:
        """转换时间戳为SRT格式"""
        hours = int(timestamp // 3600)
        minutes = int((timestamp % 3600) // 60)
        seconds = int(timestamp % 60)
        milliseconds = int((timestamp % 1) * 1000)

        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"
```

### 4. DanmakuHandler - 弹幕处理器

**文件**: `apps/api/src/services/queue/handlers/danmaku.py`

```python
from typing import Dict, Any
from pathlib import Path
import logging
import xml.etree.ElementTree as ET

from .base import BaseHandler

logger = logging.getLogger(__name__)

class DanmakuHandler(BaseHandler):
    """弹幕处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理弹幕下载"""
        url = params['url']
        filename = params['filename']

        logger.info(f"开始下载弹幕: {filename}")

        # 获取临时路径
        temp_path = self._get_temp_path(temp_dir, filename)

        # 下载弹幕
        danmaku_list = await self._download_danmaku(url)

        # 转换为XML格式
        xml_content = self._convert_to_xml(danmaku_list)

        # 保存文件
        temp_path.parent.mkdir(parents=True, exist_ok=True)
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(xml_content)

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ 弹幕下载完成: {filename}")

    async def _download_danmaku(self, url: str) -> list:
        """下载弹幕"""
        import aiohttp

        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('data', [])
                else:
                    raise Exception(f"下载弹幕失败: HTTP {response.status}")

    def _convert_to_xml(self, danmaku_list: list) -> str:
        """转换为XML格式"""
        root = ET.Element('i')

        for danmaku in danmaku_list:
            d = ET.SubElement(root, 'd')
            d.set('p', danmaku.get('p', ''))
            d.text = danmaku.get('text', '')

        return ET.tostring(root, encoding='unicode')
```

### 5. ThumbHandler - 封面处理器

**文件**: `apps/api/src/services/queue/handlers/thumb.py`

```python
from typing import Dict, Any
from pathlib import Path
import logging

from .base import BaseHandler

logger = logging.getLogger(__name__)

class ThumbHandler(BaseHandler):
    """封面处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理封面下载"""
        url = params['url']
        filename = params['filename']

        logger.info(f"开始下载封面: {filename}")

        # 获取临时路径
        temp_path = self._get_temp_path(temp_dir, filename)

        # 下载封面
        await self._download_file(url, temp_path)

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ 封面下载完成: {filename}")


class UploaderAvatarHandler(BaseHandler):
    """UP主头像处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理UP主头像下载"""
        url = params.get('url', '')
        uploader = meta.get('uploader', 'unknown')
        filename = params.get('filename', f"{uploader}_avatar.jpg")

        if not url:
            logger.warning("UP主头像URL为空，跳过下载")
            return

        logger.info(f"开始下载UP主头像: {filename}")

        # 获取临时路径
        temp_path = self._get_temp_path(temp_dir, filename)

        # 下载头像
        await self._download_file(url, temp_path)

        # 移动到输出目录
        output_path = self._get_output_path(output_dir, filename)
        self._move_to_output(temp_path, output_path)

        logger.info(f"✓ UP主头像下载完成: {filename}")
```

### 6. NfoHandler - NFO处理器

**文件**: `apps/api/src/services/queue/handlers/nfo.py`

```python
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
        filename = params['filename']

        logger.info(f"开始生成NFO文件: {filename}")

        # 获取临时路径
        temp_path = self._get_temp_path(temp_dir, filename)

        # 生成NFO内容
        nfo_content = self._generate_nfo(meta)

        # 保存文件
        temp_path.parent.mkdir(parents=True, exist_ok=True)
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(nfo_content)

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

        # 标题
        if meta.get('title'):
            lines.append(f'  <title>{self._escape_xml(meta["title"])}</title>')

        # 描述
        if meta.get('desc'):
            lines.append(f'  <plot>{self._escape_xml(meta["desc"])}</plot>')

        # UP主
        if meta.get('uploader'):
            lines.append(f'  <studio>{self._escape_xml(meta["uploader"])}</studio>')

        # 发布日期
        if meta.get('pubdate'):
            pubdate = datetime.fromtimestamp(meta['pubdate'])
            lines.append(f'  <premiered>{pubdate.strftime("%Y-%m-%d")}</premiered>')

        # 时长
        if meta.get('duration'):
            lines.append(f'  <runtime>{meta["duration"]}</runtime>')

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

        # 标签
        if meta.get('keywords'):
            keywords = meta['keywords']
            if isinstance(keywords, str):
                keywords = [keywords]
            for keyword in keywords:
                lines.append(f'  <tag>{self._escape_xml(keyword)}</tag>')

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


class AlbumNfoHandler(BaseHandler):
    """合集NFO处理器"""

    async def handle(self, params: Dict[str, Any], temp_dir: Path, output_dir: Path, meta: Dict[str, Any]):
        """处理合集NFO生成"""
        filename = params.get('filename', 'tvshow.nfo')

        logger.info(f"开始生成合集NFO文件: {filename}")

        # 获取临时路径
        temp_path = self._get_temp_path(temp_dir, filename)

        # 生成NFO内容
        nfo_content = self._generate_album_nfo(meta)

        # 保存文件
        temp_path.parent.mkdir(parents=True, exist_ok=True)
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(nfo_content)

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
        if meta.get('uploader'):
            lines.append(f'  <studio>{self._escape_xml(meta["uploader"])}</studio>')

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
```

### 7. SubTaskHandlerRegistry - 处理器注册表

**文件**: `apps/api/src/services/queue/handlers/__init__.py`

```python
from typing import Dict, Type, Optional
from schemas.task import SubTaskType
from .base import BaseHandler
from .video import VideoHandler, AudioHandler, AudioVideoMergeHandler
from .subtitle import SubtitleHandler
from .danmaku import DanmakuHandler
from .thumb import ThumbHandler, UploaderAvatarHandler
from .nfo import SingleNfoHandler, AlbumNfoHandler

class SubTaskHandlerRegistry:
    """子任务处理器注册表"""

    _handlers: Dict[SubTaskType, Type[BaseHandler]] = {}

    @classmethod
    def register(cls, task_type: SubTaskType):
        """注册处理器"""
        def decorator(handler_class: Type[BaseHandler]):
            cls._handlers[task_type] = handler_class
            return handler_class
        return decorator

    @classmethod
    def get_handler(cls, task_type: SubTaskType) -> Optional[BaseHandler]:
        """获取处理器实例"""
        handler_class = cls._handlers.get(task_type)
        if handler_class:
            return handler_class()
        return None

    @classmethod
    def list_handlers(cls) -> Dict[SubTaskType, str]:
        """列出所有已注册的处理器"""
        return {
            task_type: handler_class.__name__
            for task_type, handler_class in cls._handlers.items()
        }

# 注册所有处理器
SubTaskHandlerRegistry.register(SubTaskType.VIDEO)(VideoHandler)
SubTaskHandlerRegistry.register(SubTaskType.AUDIO)(AudioHandler)
SubTaskHandlerRegistry.register(SubTaskType.AUDIO_VIDEO)(AudioVideoMergeHandler)
SubTaskHandlerRegistry.register(SubTaskType.SUBTITLES)(SubtitleHandler)
SubTaskHandlerRegistry.register(SubTaskType.DANMAKU)(DanmakuHandler)
SubTaskHandlerRegistry.register(SubTaskType.THUMB)(ThumbHandler)
SubTaskHandlerRegistry.register(SubTaskType.SINGLE_NFO)(SingleNfoHandler)
SubTaskHandlerRegistry.register(SubTaskType.ALBUM_NFO)(AlbumNfoHandler)

# 向后兼容的别名
SubTaskHandler = SubTaskHandlerRegistry
```

## 实施步骤

### 步骤1：创建处理器目录

```bash
mkdir -p apps/api/src/services/queue/handlers
```

### 步骤2：创建处理器文件

```bash
touch apps/api/src/services/queue/handlers/__init__.py
touch apps/api/src/services/queue/handlers/base.py
touch apps/api/src/services/queue/handlers/video.py
touch apps/api/src/services/queue/handlers/subtitle.py
touch apps/api/src/services/queue/handlers/danmaku.py
touch apps/api/src/services/queue/handlers/thumb.py
touch apps/api/src/services/queue/handlers/nfo.py
```

### 步骤3：更新Scheduler使用处理器

编辑 `apps/api/src/services/queue/scheduler.py`，使用新的处理器系统。

### 步骤4：测试处理器

```bash
# 测试视频处理器
curl -X POST http://localhost:8000/api/queue/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "media_type": "video",
    "media_id": "BV1xx411c7mD",
    "title": "测试视频"
  }'

# 创建调度器并启动
curl -X POST http://localhost:8000/api/queue/schedulers \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试处理器",
    "folder": "/Users/tanyancong/工作/开发/pilinote/downloads/test"
  }'

curl -X POST http://localhost:8000/api/queue/schedulers/{scheduler_id}/start
```

## 注意事项

1. **处理器职责单一**
   - 每个处理器只处理一种类型的文件
   - 避免职责混乱
   - 便于测试和维护

2. **错误处理**
   - 每个处理器都有独立的错误处理
   - 记录详细的日志
   - 不影响其他处理器

3. **临时文件管理**
   - 每个处理器使用临时目录
   - 处理完成后移动到输出目录
   - 避免文件冲突

4. **扩展性**
   - 使用注册表模式
   - 易于添加新的处理器
   - 支持动态注册

5. **向后兼容**
   - 保留原有的DownloadService
   - 逐步迁移到新系统
   - 不影响现有功能

6. **性能优化**
   - 使用异步IO
   - 避免阻塞操作
   - 支持并发处理

## 下一步

完成本阶段后，进入**阶段6：API端点统一**，统一视频详情接口，完善API设计。