# AI笔记格式功能后端实现设计

> **For agentic workers:** 需根据此spec创建实现计划 (writing-plans skill)

**Goal:** 实现AI笔记的目录(toc)、原片跳转(link)、截图(screenshot)、AI总结(summary)后端实际功能

**Architecture:** 
- 在笔记生成完成后增加后处理阶段
- link: 解析 `*Content-[mm:ss]` 标记，替换为可点击时间戳链接
- screenshot: 使用FFmpeg截取视频帧，替换 `*Screenshot-[mm:ss]` 标记为图片URL
- toc/summary: 已在Prompt中实现，只需验证输出包含对应内容

**Tech Stack:** FFmpeg (截图), Pydantic, Python

---

## 设计详情

### 1. link - 原片跳转功能

**工作流程:**
1. LLM生成笔记后，扫描 `*Content-[mm:ss]` 时间戳标记
2. 将标记替换为Markdown时间戳链接格式
3. 最终输出可直接点击跳转

**标记格式:** `*Content-[mm:ss]` → `[mm:ss](?t=seconds)`

**实现位置:** `apps/api/src/services/ai/note_service.py` 后处理方法

---

### 2. screenshot - 截图功能

**工作流程:**
1. 分析笔记中 `*Screenshot-[mm:ss]` 标记
2. 使用FFmpeg从视频中截取对应时间帧
3. 保存截图到静态目录
4. 替换标记为Markdown图片链接

**截图生成:** `ffmpeg -i video.mp4 -ss 00:01:30 -vframes 1 screenshot.jpg`

**输出目录:** `static/screenshots/`

**标记格式:** `*Screenshot-[mm:ss]` → `![](static/screenshots/xxx.jpg)`

---

### 3. toc - 目录功能

**状态:** Prompt模板已实现，验证输出包含 ## 标题即可

---

### 4. summary - AI总结功能

**状态:** Prompt模板已实现，验证输出末尾包含 `## AI 总结` 即可

---

## 代码位置索引

| 文件 | 说明 |
|------|------|
| `apps/api/src/services/ai/note_service.py` | 主要修改：后处理逻辑 |
| `apps/api/src/llm/prompts/formats.py` | 已有模板定义 |
| `apps/api/src/models/ai_note.py` | 需新增字段存储截图路径 |
| `apps/api/src/routers/note.py` | 导出API调整 |

---

## 测试用例

1. **link测试:** 笔记包含 `*Content-[01:23]`，处理后变为 `[01:23](?t=83)`
2. **screenshot测试:** 笔记包含 `*Screenshot-[00:30]`，处理后图片显示正常
3. **toc测试:** 笔记包含 ## 级标题目录
4. **summary测试:** 笔记末尾包含 ## AI 总结