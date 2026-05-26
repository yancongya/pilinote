# PiliNote vs BiliNote AI笔记功能对比文档

> 生成日期: 2026-04-20
> 分析范围: AI笔记生成相关功能

---

## 一、功能对比总览

| 序号 | 功能模块 | PiliNote (当前) | BiliNote (参考) | 优先级 |
|:---:|---------|:--------------:|:--------------:|:------:|
| 1 | 原生字幕获取 | ❌ 不支持 | ✅ 优先平台字幕 | P0 |
| 2 | 字幕缓存 | 仅ASR结果 | 完整3层缓存 | P1 |
| 3 | 版本管理 | previous_analysis | 无 | P1 |
| 4 | 增量重新生成 | reanalyze_incremental | 无 | P1 |
| 5 | 思维导图 | 基础大纲解析 | 完整markmap | P2 |
| 6 | 截图功能 | ❌ | ✅ | P2 |
| 7 | 链接跳转 | ❌ | ✅ | P2 |
| 8 | 进度控制 | 暂停/恢复/取消 | 无 | P1 |
| 9 | 断点续跑 | resume_from_stage | 无 | P1 |
| 10 | 视频理解 | ❌ | ✅ | P2 |

---

## 二、详细对比

### 2.1 原生字幕获取

#### PiliNote (当前)
- 直接使用本地ASR转写
- 不调用B站原生字幕API
- 代码位置: `apps/api/src/services/ai/note_service.py`

```python
# 当前流程
AUDIO.FETCH → SUBTITLE.GENERATE(ASR) → NFO.READ → LLM.ANALYZE
```

#### BiliNote (参考)
- 优先获取平台字幕，无字幕才走ASR
- 代码位置: `reference/BiliNote/backend/app/services/note.py`

```python
# BiliNote流程 (第136-170行)
1. 尝试读取转写缓存
2. 尝试获取平台字幕 download_subtitles()
3. 缓存字幕结果
4. 无字幕时下载音频 → ASR转写
```

**差异说明**: BiliNote优先调用 `downloader.download_subtitles(video_url)` 获取平台原生字幕，只有在没有原生字幕时才进行ASR转写。这是用户体验的关键差异，原生字幕质量通常高于ASR。

---

### 2.2 字幕缓存机制

#### PiliNote (当前)
- 通过 `analysis_artifacts` 在 `meta` 字段中缓存
- 缓存内容: `transcript`, `t0_text`, `prompt` 等
- 代码位置: `note_service.py:318-334`

```python
def _store_analysis_artifacts(self, note: AiNote, **updates: Any) -> None:
    meta = note.meta if isinstance(note.meta, dict) else {}
    artifacts = meta.get("analysis_artifacts")
    artifacts = artifacts if isinstance(artifacts, dict) else {}
    artifacts.update(...)
```

#### BiliNote (参考)
- 独立缓存文件 (第133-135行)
- `note_results/{task_id}_transcript.json` - 转写缓存
- `note_results/{task_id}_audio.json` - 音频缓存
- `note_results/{task_id}_markdown.md` - 笔记缓存

**差异说明**: BiliNote使用独立文件缓存，结构更清晰；PiliNote使用数据库JSON字段。

---

### 2.3 版本管理与重新生成

#### PiliNote (当前)
- 支持增量重新生成
- 字段: `previous_analysis`, `analysis_count`
- 方法: `reanalyze_incremental(note_id)`

```python
# note_service.py:554-582
def reanalyze_incremental(self, note_id: str) -> Dict[str, Any]:
    note.previous_analysis = note.content[:5000] if note.content else ""
    note.analysis_count = (note.analysis_count or 0) + 1
    # 基于上一次摘要继续生成
    previous_summary = f"\n\n## 上一次分析的总结摘要\n{note.previous_analysis}..."
```

#### BiliNote (参考)
- 无版本管理
- 重新生成会覆盖，无历史记录

**差异说明**: PiliNote在版本管理方面优于BiliNote。

---

### 2.4 思维导图生成

#### PiliNote (当前)
- 已有 `mindmap_json` 数据库字段
- 前端 `MindMapViewer.tsx` 仅简单解析 `#` 标题

```tsx
// apps/web/src/components/ai/MindMapViewer.tsx
const lines = markdown.split('\n')
  .filter(line => line.startsWith('#'))
  .map(line => line.replace(/^#+\s*/, ''))
  .join('\n');
```

- 需要安装 `markmap` 依赖才能完整渲染

#### BiliNote (参考)
- 前端有完整 `MarkmapComponent`
- 支持交互式思维导图

**差异说明**: 两者都需要依赖 `markmap` 库，PiliNote后端已支持存储，前端需完善。

---

### 2.5 截图功能

#### PiliNote (当前)
- ❌ 不支持

#### BiliNote (参考)
- 支持 `screenshot` 格式选项
- 使用FFmpeg生成视频截图
- 代码位置: `note.py:639-673`

```python
def _insert_screenshots(self, markdown: str, video_path: Path) -> str:
    # 解析 *Screenshot-[mm:ss] 标记
    # 调用 generate_screenshot() 生成截图
    markdown = markdown.replace(marker, f"![]({img_url})", 1)
```

---

### 2.6 链接跳转

#### PiliNote (当前)
- ❌ 不支持

#### BiliNote (参考)
- 支持 `link` 格式选项
- 使用 `*Content-[mm:ss]` 标记时间戳
- 代码位置: `prompt_builder.py:97-101`

```python
def get_link_format():
    return '''
    10. **原片跳转**: 为每个主要章节添加时间戳，使用格式 `*Content-[mm:ss]`。
    重要：**始终**在章节标题前加上 `*Content` 前缀
    '''
```

---

### 2.7 进度控制

#### PiliNote (当前)
- 支持暂停/恢复/取消
- 方法: `pause_analysis`, `resume_analysis`, `cancel_analysis`
- 支持断点续跑: `resume_from_stage`

```python
# note.py 路由层
@router.post("/pause/{note_id}")
@router.post("/resume/{note_id}")
@router.post("/cancel/{note_id}")
@router.post("/resume-from-stage/{note_id}")
```

#### BiliNote (参考)
- ❌ 不支持
- 仅通过状态文件记录进度

**差异说明**: PiliNote在进度控制方面明显优于BiliNote。

---

### 2.8 笔记风格

#### PiliNote (当前)
- 定义在: `apps/api/src/llm/prompts.py`
- 支持: detailed, minimal, academic, tutorial, task_oriented 等

#### BiliNote (参考)
- 定义在: `reference/BiliNote/backend/app/gpt/prompt_builder.py`
- 更多风格选项 (第10-20行)

```python
note_styles = [
    {'label': '精简', 'value': 'minimal'},
    {'label': '详细', 'value': 'detailed'},
    {'label': '学术', 'value': 'academic'},
    {'label': '教程', 'value': 'tutorial'},
    {'label': '小红书', 'value': 'xiaohongshu'},
    {'label': '生活向', 'value': 'life_journal'},
    {'label': '任务导向', 'value': 'task_oriented'},
    {'label': '商业风格', 'value': 'business'},
    {'label': '会议纪要', 'value': 'meeting_minutes'},
]
```

**差异说明**: BiliNote提供更多风格选项，特别是小红书风格国内用户友好。

---

## 三、功能优先级建议

### P0 - 紧急实现
1. **原生字幕获取** - 最高优先级，直接影响笔记质量

### P1 - 重要实现
2. **截图功能** - 提升笔记丰富度
3. **链接跳转** - 时间戳导航
4. **更多笔记风格** - 满足不同场景

### P2 - 优化完善
5. **完整思维导图** - 安装markmap依赖
6. **视频理解/缩略图网格** - 提升AI理解能力

---

## 四、代码位置索引

### PiliNote 核心文件
| 文件 | 说明 |
|------|------|
| `apps/api/src/services/ai/note_service.py` | 笔记生成核心服务 |
| `apps/api/src/routers/note.py` | 笔记API路由 |
| `apps/api/src/models/ai_note.py` | 数据模型 |
| `apps/api/src/schemas/ai_note.py` | Pydantic schemas |
| `apps/web/src/components/ai/MindMapViewer.tsx` | 思维导图组件 |
| `apps/web/src/components/ai/markdownviewer.tsx` | Markdown查看器 |

### BiliNote 参考文件
| 文件 | 说明 |
|------|------|
| `backend/app/services/note.py` | 笔记生成服务 |
| `backend/app/gpt/prompt_builder.py` | Prompt构建器 |
| `backend/app/transcriber/` | 转写器实现 |
| `BillNote_frontend/src/pages/HomePage/` | 前端页面 |

---

## 五、总结

PiliNote在**进度控制**、**版本管理**、**断点续跑**方面优于BiliNote，但在**原生字幕获取**、**截图功能**、**链接跳转**方面存在差距。

建议优先实现原生字幕获取功能，这是对用户体验影响最大的功能点。
