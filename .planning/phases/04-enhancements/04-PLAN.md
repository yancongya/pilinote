# Phase 4: 增强功能 - 执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善导出、截图等增强功能

**Architecture:** Phase 4 在 Phase 1-3 基础上添加增强功能：
- 截图功能：FFmpeg 提取视频关键帧，生成截图供 Markdown 使用
- 导出功能：支持 Markdown 文件下载导出
- 风格推荐：根据视频内容自动推荐笔记风格

**Tech Stack:**
- FFmpeg: 视频帧提取
- React: 前端导出组件
- 视频分类算法: 基于标题/标签/描述的简单分类

---

## Wave 4: 增强功能

### 04-01: 实现截图功能（FFmpeg 提取关键帧）

**任务 ID**: 04-01
**描述**: 实现截图功能，FFmpeg 提取关键帧
**依赖**: 02-02 (AI Analysis Service)

#### 技术方案

使用 FFmpeg 从视频中提取关键帧：
1. 每 N 秒提取一帧或按场景变化提取
2. 生成缩略图供 Markdown 引用
3. 在 `formats` 包含 `screenshot` 时自动触发

#### 原子任务

**04-01-T01**: 创建截图服务类
- 文件: `apps/api/src/services/ai/screenshot.py`
- 内容:
  - `ScreenshotService` 类
  - `extract_frames(video_path: str, output_dir: str, count: int = 9) -> List[str]` 方法
  - 使用 FFmpeg `-vf "select=gt(scene,0.3)"` 场景检测或 `-ss` 时间间隔提取

```python
import subprocess
import os
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class ScreenshotService:
    """视频截图服务"""

    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        self.ffmpeg_path = ffmpeg_path

    def extract_frames(
        self,
        video_path: str,
        output_dir: str,
        count: int = 9,
        interval: Optional[int] = None,
    ) -> List[str]:
        """
        从视频提取关键帧

        Args:
            video_path: 视频文件路径
            output_dir: 输出目录
            count: 提取帧数量
            interval: 固定间隔（秒），不设置则自动检测场景变化

        Returns:
            生成的截图文件路径列表
        """
        os.makedirs(output_dir, exist_ok=True)

        if interval:
            return self._extract_by_interval(video_path, output_dir, interval, count)
        else:
            return self._extract_by_scenes(video_path, output_dir, count)

    def _extract_by_interval(self, video_path: str, output_dir: str, interval: int, count: int) -> List[str]:
        """按固定时间间隔提取"""
        # 获取视频时长
        duration = self._get_duration(video_path)
        if not duration:
            return []

        # 计算时间点
        timestamps = []
        for i in range(count):
            ts = (duration / count) * i + interval
            if ts < duration:
                timestamps.append(ts)

        output_files = []
        for i, ts in enumerate(timestamps):
            output_path = os.path.join(output_dir, f"screenshot_{i:03d}.jpg")
            self._extract_single_frame(video_path, output_path, ts)
            if os.path.exists(output_path):
                output_files.append(output_path)

        return output_files

    def _extract_by_scenes(self, video_path: str, output_dir: str, count: int) -> List[str]:
        """按场景变化自动提取"""
        # 使用 FFmpeg scene detection
        cmd = [
            self.ffmpeg_path,
            "-i", video_path,
            "-vf", f"select=gt(scene\,0.3),scale=320:-1",
            "-frames:v", str(count),
            "-q:v", "2",
            os.path.join(output_dir, "screenshot_%03d.jpg"),
        ]

        try:
            subprocess.run(cmd, check=True, capture_output=True, logger=logger.info(f"Extracting frames: {cmd}"))
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg extraction failed: {e}")
            # Fallback to interval method
            return self._extract_by_interval(video_path, output_dir, 30, count)

        # 收集生成的文件
        files = sorted(glob.glob(os.path.join(output_dir, "screenshot_*.jpg")))
        return files[:count]

    def _extract_single_frame(self, video_path: str, output_path: str, timestamp: float):
        """提取单帧"""
        cmd = [
            self.ffmpeg_path,
            "-ss", str(timestamp),
            "-i", video_path,
            "-vframes", "1",
            "-q:v", "2",
            "-y", output_path,
        ]
        subprocess.run(cmd, check=True, capture_output=True)

    def _get_duration(self, video_path: str) -> Optional[float]:
        """获取视频时长（秒）"""
        cmd = [
            self.ffmpeg_path,
            "-i", video_path,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            for line in result.stderr.split("\n"):
                if "Duration:" in line:
                    # 解析 Duration: 00:05:30.00
                    dur = line.split("Duration:")[1].split(",")[0].strip()
                    h, m, s = dur.split(":")
                    return float(h) * 3600 + float(m) * 60 + float(s)
        except Exception as e:
            logger.error(f"Failed to get duration: {e}")
        return None
```

- [ ] **Step 2: Run test to verify implementation works**

Run sample video extraction:
```bash
cd apps/api
source venv/bin/activate
python -c "
from src.services.ai.screenshot import ScreenshotService
import os
svc = ScreenshotService()
# Test with a downloaded video
video_path = 'data/downloads/BV1xxx/filename.mp4'
if os.path.exists(video_path):
    files = svc.extract_frames(video_path, 'data/downloads/BV1xxx/screenshots', 9)
    print(f'Extracted {len(files)} frames')
else:
    print('No test video found, skipping')
"
```

- [ ] **Step 3: 集成到 AiNoteService**

- 文件: `apps/api/src/services/ai/note_service.py`
- 修改 `_generate_note` 方法，当 `formats` 包含 `screenshot` 时：
  1. 调用 ScreenshotService 提取帧
  2. 将截图路径传给 prompt builder 或存储到 note

```python
def _generate_note(
    self,
    title: str,
    transcript: str,
    style: str,
    formats: List[str],
    model_provider: str,
    model_name: str,
    video_path: Optional[str] = None,
    extras: Optional[str] = None,
) -> str:
    """调用 LLM 生成笔记"""
    screenshot_files = []

    # 如果需要截图，先提取
    if "screenshot" in formats and video_path:
        from src.services.ai.screenshot import ScreenshotService

        output_dir = os.path.dirname(video_path)
        screenshot_dir = os.path.join(output_dir, "screenshots")
        svc = ScreenshotService(self.ffmpeg_path)
        screenshot_files = svc.extract_frames(video_path, screenshot_dir, count=9)

    # 构建 prompt（传入截图信息）
    prompt = PromptBuilder.build(
        video_title=title,
        segment_text=transcript[:8000],
        formats=formats,
        style=style,
        extras=extras,
        screenshot_files=screenshot_files,
    )
    # ... rest of method
```

- [ ] **Step 4: 更新路由支持截图参数**

- 文件: `apps/api/src/routers/note.py`
- 添加可选参数 `include_screenshots: bool`

```python
@router.post("/analyze")
async def analyze_video(
    request: AnalyzeRequest,
    include_screenshots: bool = Query(False, description="是否包含截图"),
):
    # ... existing code
    if include_screenshots:
        request.formats = request.formats or []
        if "screenshot" not in request.formats:
            request.formats.append("screenshot")
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/ai/screenshot.py apps/api/src/services/ai/note_service.py apps/api/src/routers/note.py
git commit -m "feat: add screenshot extraction with FFmpeg"
```

---

### 04-02: 实现 Markdown 导出

**任务 ID**: 04-02
**描述**: 实现 Markdown 导出功能
**依赖**: 03-03 (Markdown 渲染，前端已有)

#### 原子任务

**04-02-T01**: 后端添加导出 API
- 文件: `apps/api/src/routers/note.py`
- 内容: 添加导出接口

```python
from fastapi.responses import FileResponse
import tempfile

@router.get("/export/{note_id}")
async def export_note(note_id: str):
    """导出笔记为 Markdown 文件"""
    service = AiNoteService()
    note = service.get_note(note_id)

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    if not note.content:
        raise HTTPException(status_code=400, detail="Note content is empty")

    # 创建临时文件
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8") as f:
        f.write(note.content)
        temp_path = f.name

    # 生成文件名
    filename = f"ai_note_{note_id[:8]}.md"

    return FileResponse(
        temp_path,
        media_type="text/markdown",
        filename=filename,
    )
```

- [ ] **Step 2: 前端添加导出按钮**

- 文件: `apps/web/src/components/ai/MarkdownViewer.tsx` 或 `AiNotePanel.tsx`
- 内容: 添加导出按钮

```typescript
const handleExport = async () => {
  if (!note?.id) return;

  try {
    const response = await fetch(`/api/note/export/${note.id}`);
    const blob = await response.blob();

    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-note-${note.id.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('导出失败:', err);
  }
};

// 在 UI 中添加按钮
<button onClick={handleExport} className="...">
  导出 Markdown
</button>
```

- [ ] **Step 3: 添加复制到剪贴板功能**

- 文件: `apps/web/src/components/ai/MarkdownViewer.tsx`
- 内容: 添加复制按钮

```typescript
const handleCopy = async () => {
  if (!note?.content) return;

  try {
    await navigator.clipboard.writeText(note.content);
    // 可以添加 toast 提示
  } catch (err) {
    console.error('复制失败:', err);
  }
};
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routers/note.py apps/web/src/components/ai/
git commit -m "feat: add markdown export and copy"
```

---

### 04-03: 视频类型自动识别推荐风格

**任务 ID**: 04-03
**描述**: 视频类型自动识别并推荐风格
**依赖**: 01-04 (Prompt Manager - 风格模板已定义)

#### 技术方案

基于视频的标题、标签、描述进行简单分类：
1. 教程类 → 推荐 `tutorial` 或 `academic`
2. 生活类 → 推荐 `life_journal` 或 `xiaohongshu`
3. 商业类 → 推荐 `business` 或 `meeting_minutes`
4. 任务向 → 推荐 `task_oriented`
5. 默认 → `detailed`

#### 原子任务

**04-03-T01**: 创建视频分类器服务
- 文件: `apps/api/src/services/ai/video_classifier.py`
- 内容:

```python
import re
from typing import Dict, List, Optional


# 关键词映射
CATEGORY_KEYWORDS = {
    "tutorial": [
        "教程", "教学", "怎么", "如何", "学习", "入门", "基础", "技巧",
        "教你", "手把手", "教学", "课程", "培训", "零基础",
    ],
    "academic": [
        "研究", "分析", "原理", "机制", "科学", "理论", "论文",
        "探讨", "论述", "观点", "报告", "数据",
    ],
    "life_journal": [
        "生活", "日常", "今天", "分享", "感悟", "心情", "日记",
        "周末", "休息", "放松", "打卡",
    ],
    "xiaohongshu": [
        "好物", "分享", "推荐", "必看", "宝藏", "神器", "必备",
        "好用到哭", "绝绝子", "YYDS", "私藏",
    ],
    "business": [
        "商业", "营销", "增长", "流量", "变现", "赚钱", "创业",
        "融资", "项目", "合作", "品牌",
    ],
    "task_oriented": [
        "任务", "待办", "计划", "目标", "清单", "高效", "整理",
        "整理", "汇总", "总结",
    ],
    "meeting_minutes": [
        "会议", "纪要", "总结会", "周会", "例会", "汇报",
    ],
}


class VideoClassifier:
    """视频类型分类器"""

    @staticmethod
    def classify(title: str, tags: str = "", description: str = "") -> Dict[str, any]:
        """
        分类视频并推荐风格

        Args:
            title: 视频标题
            tags: 视频标签（逗号分隔）
            description: 视频简介

        Returns:
            Dict: {
                "category": str,
                "confidence": float,
                "recommended_style": str,
                "reason": str,
            }
        """
        text = f"{title} {tags} {description}".lower()

        scores = {}
        for category, keywords in CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw.lower() in text)
            if score > 0:
                scores[category] = score

        if not scores:
            return {
                "category": "general",
                "confidence": 0.0,
                "recommended_style": "detailed",
                "reason": "未能识别特定类型，使用默认风格",
            }

        # 取最高分
        top_category = max(scores.items(), key=lambda x: x[1])
        category, score = top_category

        # 风格映射
        style_map = {
            "tutorial": "tutorial",
            "academic": "academic",
            "life_journal": "life_journal",
            "xiaohongshu": "xiaohongshu",
            "business": "business",
            "task_oriented": "task_oriented",
            "meeting_minutes": "meeting_minutes",
        }

        recommended_style = style_map.get(category, "detailed")

        return {
            "category": category,
            "confidence": min(score / 3, 1.0),  # 归一化
            "recommended_style": recommended_style,
            "reason": f"检测到关键词: {category}",
        }

    @staticmethod
    def get_recommended_style(title: str, tags: str = "", description: str = "") -> str:
        """直接获取推荐风格"""
        result = VideoClassifier.classify(title, tags, description)
        return result["recommended_style"]
```

- [ ] **Step 2: 在 note 路由中添加自动风格推荐**

- 文件: `apps/api/src/routers/note.py`
- 添加推荐接口

```python
from src.services.ai.video_classifier import VideoClassifier

@router.get("/recommend-style")
async def recommend_style(
    title: str = Query(..., description="视频标题"),
    tags: str = Query("", description="视频标签"),
    description: str = Query("", description="视频简介"),
):
    """根据视频信息推荐笔记风格"""
    result = VideoClassifier.classify(title, tags, description)
    return result
```

- [ ] **Step 3: 前端集成自动推荐**

- 文件: `apps/web/src/components/ai/StyleSelector.tsx` 或 `AiNotePanel.tsx`
- 内容: 添加"智能推荐"按钮

```typescript
const [recommendedStyle, setRecommendedStyle] = useState<string | null>(null);

const handleAutoRecommend = async () => {
  if (!videoTitle) return;

  try {
    const response = await fetch(
      `/api/note/recommend-style?title=${encodeURIComponent(videoTitle)}`
    );
    const data = await response.json();

    if (data.recommended_style) {
      setRecommendedStyle(data.recommended_style);
      setStyle(data.recommended_style);
    }
  } catch (err) {
    console.error('推荐失败:', err);
  }
};

// 添加按钮
<button onClick={handleAutoRecommend}>
  智能推荐风格
</button>

{recommendedStyle && (
  <span className="text-xs text-green-400">
    推荐: {recommendedStyle}
  </span>
)}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/ai/video_classifier.py apps/api/src/routers/note.py apps/web/src/components/ai/
git commit -m "feat: add video type auto-classification and style recommendation"
```

---

## 任务���赖���

```
Wave 4: 增强功能
├── 04-01: 截图功能 (依赖 02-02)
│   ├── 04-01-T01: ScreenshotService
│   ├── 04-01-T02: 测试验证
│   ├── 04-01-T03: 集成 AiNoteService
│   ├── 04-01-T04: 路由支持
│   └── 04-01-T05: Commit
│
├── 04-02: Markdown 导出 (依赖 03-03)
│   ├── 04-02-T01: 后端导出 API
│   ├── 04-02-T02: 前端导出按钮
│   ├── 04-02-T03: 复制功能
│   └── 04-02-T04: Commit
│
└── 04-03: 风格推荐 (依赖 01-04)
    ├── 04-03-T01: VideoClassifier
    │   ├── 04-03-T02: 推荐接口
    │   ├── 04-03-T03: 前端集成
    │   └── 04-03-T04: Commit
```

## 执行顺序

1. **04-01** - 截图功能（需要 FFmpeg 依赖）
2. **04-02** - 导出功能（独立于截图，可并行）
3. **04-03** - 风格推荐（独立于前两项，可并行）

## 验证标准

- [ ] 04-01: 视频可成功提取关键帧到指定目录
- [ ] 04-02: Markdown 文件可正常导出下载
- [ ] 04-03: 视频类型可自动识别并推荐风格

## 注意

- FFmpeg 路径从配置读取，确保工具可用
- 截图功能仅当 `formats` 包含 `screenshot` 时触发
- 风格推荐为辅助功能，用户仍可手动选择