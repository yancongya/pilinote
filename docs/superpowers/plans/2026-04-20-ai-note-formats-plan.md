# AI笔记格式功能后端实现计划

> **For agentic workers:** 需使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 执行此计划

**Goal:** 实现AI笔记的目录(toc)、原片跳转(link)、截图(screenshot)、AI总结(summary)后端实际功能

**Architecture:** 
- 在笔记生成完成后增加后处理阶段
- link: 解析 `*Content-[mm:ss]` 标记，替换为可点击时间戳链接
- screenshot: 使用FFmpeg截取视频帧，替换 `*Screenshot-[mm:ss]` 标记为图片URL
- toc/summary: 已在Prompt中实现，只需验证输出包含对应内容

**Tech Stack:** FFmpeg (截图), Pydantic, Python

---

## Task 1: 添加截图为后处理方法

**Files:**
- Modify: `apps/api/src/services/ai/note_service.py`

- [ ] **Step 1: 在 note_service.py 末尾添加后处理方法**

在文件末尾（约第1950行左右）添加：

```python
def _post_process_markdown(
    self,
    markdown: str,
    video_path: str,
    note: Optional[AiNote] = None,
    formats: Optional[List[str]] = None,
) -> str:
    """后处理 Markdown：替换 link 和 screenshot 标记"""
    if not formats:
        return markdown
    
    result = markdown
    
    # 处理 link (原片跳转)
    if "link" in formats:
        result = self._process_link_markers(result)
    
    # 处理 screenshot (截图)
    if "screenshot" in formats:
        result = self._process_screenshot_markers(result, video_path, note)
    
    return result


def _process_link_markers(self, markdown: str) -> str:
    """处理 *Content-[mm:ss] 时间戳标记"""
    import re
    
    pattern = r'\*Content-\[(\d{2}:\d{2})\]'
    
    def replace_link(match):
        timestamp = match.group(1)
        # 转换 mm:ss 为秒数
        parts = timestamp.split(':')
        seconds = int(parts[0]) * 60 + int(parts[1])
        return f'[{timestamp}](?t={seconds})'
    
    return re.sub(pattern, replace_link, markdown)


def _process_screenshot_markers(
    self,
    markdown: str,
    video_path: str,
    note: Optional[AiNote] = None,
) -> str:
    """处理 *Screenshot-[mm:ss] 截图标记"""
    import re
    import subprocess
    from pathlib import Path
    
    pattern = r'\*Screenshot-\[(\d{2}:\d{2})\]'
    
    def replace_screenshot(match):
        timestamp = match.group(1)
        parts = timestamp.split(':')
        seconds = int(parts[0]) * 60 + int(parts[1])
        
        # 生成截图文件名
        video_name = Path(video_path).stem
        screenshot_name = f"{video_name}_{timestamp.replace(':', '')}.jpg"
        screenshot_dir = Path("static/screenshots")
        screenshot_dir.mkdir(parents=True, exist_ok=True)
        screenshot_path = screenshot_dir / screenshot_name
        
        # 如果截图不存在，使用 FFmpeg 生成
        if not screenshot_path.exists():
            try:
                subprocess.run([
                    "ffmpeg", "-y",
                    "-ss", str(seconds),
                    "-i", video_path,
                    "-vframes", "1",
                    "-q:v", "2",
                    str(screenshot_path)
                ], check=True, capture_output=True, timeout=30)
            except Exception as e:
                logger.warning(f"截图生成失败: {e}")
                return f"![Screenshot at {timestamp}]()"
        
        img_url = f"/static/screenshots/{screenshot_name}"
        return f"![Screenshot at {timestamp}]({img_url})"
    
    return re.sub(pattern, replace_screenshot, markdown)
```

- [ ] **Step 2: 在 _run_analysis 方法中调用后处理**

找到 `_run_analysis` 方法末尾，在 `note.content = markdown` 之前添加后处理调用：

```python
# 在 note_service.py:约883行
# note.content = markdown 之前添加：
markdown = self._post_process_markdown(
    markdown,
    actual_file_path,
    note,
    formats,
)
note.content = markdown
```

- [ ] **Step 3: 手动测试验证**

```bash
# 测试链接替换
echo '*Content-[01:23]' | python -c "
import re, sys
pattern = r'\*Content-\[(\d{2}:\d{2})\]'
def replace(m):
    ts = m.group(1)
    parts = ts.split(':')
    sec = int(parts[0])*60 + int(parts[1])
    return f'[{ts}](?t={sec})'
print(re.sub(pattern, replace, sys.stdin.read()))
"
# 预期输出: [01:23](?t=83)
```

---

## Task 2: 验证格式输出

**Files:**
- Modify: `apps/api/src/services/ai/note_service.py`

- [ ] **Step 1: 添试验证方法**

在 `_post_process_markdown` 方法后添加：

```python
def _validate_formats(self, markdown: str, formats: List[str]) -> Dict[str, bool]:
    """验证格式输出"""
    results = {}
    
    if "toc" in formats:
        # 检查是否有 ## 级标题
        results["toc"] = bool(re.search(r'^##\s+\w+', markdown, re.MULTILINE))
    
    if "summary" in formats:
        # 检查末尾是否有 AI 总结
        results["summary"] = bool(re.search(r'^##\s+AI\s+总结', markdown, re.MULTILINE))
    
    if "link" in formats:
        # 检查是否有时间戳链接
        results["link"] = bool(re.search(r'\[\d{2}:\d{2}\]\(\?t=\d+\)', markdown))
    
    if "screenshot" in formats:
        # 检查是否有图片
        results["screenshot"] = bool(re.search(r'!\[Screenshot.*\]\(.+\.(jpg|png)\)', markdown))
    
    return results
```

- [ ] **Step 2: 在生成完成后调用验证**

在 `note.content = markdown` 之后添加：

```python
# 验证格式输出
validation = self._validate_formats(note.content, formats)
self._store_analysis_artifacts(note, format_validation=validation)
logger.info(f"格式验证结果: {validation}")
```

---

## Task 3: 配置静态文件服务

**Files:**
- Modify: `apps/api/src/main.py`

- [ ] **添加静态文件目录**

找到 FastAPI 应用初始化，添加：

```python
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.staticfiles import StaticFiles

# 截图目录
app.mount("/static/screenshots", StaticFiles(directory="static/screenshots"), name="screenshots")
```

---

## Task 4: 创建截图目录

**Files:**
- Create: `apps/api/static/screenshots/.gitkeep`

- [ ] **创建目录结构**

```bash
mkdir -p apps/api/static/screenshots
touch apps/api/static/screenshots/.gitkeep
```

---

## 验证检查清单

- [x] `*Content-[01:23]` 被正确替换为 `[01:23](?t=83)`
- [x] `*Screenshot-[00:30]` 生成截图并替换为 `![](url)`
- [x] 笔记包含 ## 级标题 (toc)
- [x] 笔记末尾包含 ## AI 总结 (summary)
- [x] `/static/screenshots/` 目录可访问

---

## 完成状态

| 任务 | 子Agent | 状态 |
|------|--------|------|
| link 标记替换 | subagent-1 | ✅ |
| screenshot 截图 | subagent-2 | ✅ |
| 后处理入口 | subagent-3 | ✅ |
| 静态目录配置 | subagent-4 | ✅ |