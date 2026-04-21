# AI 笔记与字幕内联控制设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 笔记与字幕分析/重生成从弹窗式交互改为页面内常驻控制区，支持后台执行、阶段性 toast 提示和真正取消当前任务。

**Architecture:** 前端在 `NoteTab` 与 `TranscriptTab` 内各自承载配置、启动、停止与结果区，复用统一的 AI 任务控制 UI；后端将笔记流程继续以 `note.meta.control` 为中心管理，字幕流程增加可取消任务运行时与任务 ID，保证任务在安全检查点和长耗时调用边界可被中断。

**Tech Stack:** React + TypeScript + Vite, FastAPI, Python, SSE/轮询状态流, 现有 `AiNoteService` / `subtitle_analyzer` / `apiService` / `aiNoteService`

---

## 背景

当前 AI 相关交互被拆成两种风格：

- AI 笔记在不同入口之间存在弹窗和页面内面板两种体验。
- 字幕分析仍主要依赖弹窗式流程。
- 任务进行中时，前端缺少统一的“开始 / 停止 / 状态提示”模式。
- 任务取消更多是前端停止展示，后端没有统一的可中断运行时。

用户希望把这套交互收敛为一个明确模式：

- `NoteTab` 内常驻显示完整配置：模型、详细程度、风格、高级设置。
- `TranscriptTab` 也采用类似的常驻控制区。
- 点击“重新生成 / 开始分析”后立即进入后台执行。
- 去掉现有弹窗。
- 每执行完一步都给出 toast 提醒。
- 点击停止后，后端要真正中断当前任务并释放资源。

---

## 范围

### 需要完成

- AI 笔记页面内联化：
  - 保留并展示模型、详细程度、风格、高级设置
  - 支持开始、重新生成、停止
  - 保留当前笔记结果和任务状态展示
- 字幕页面内联化：
  - 用页面内常驻区域替换 `SubtitleAnalysisModal`
  - 支持开始分析、停止
  - 保留分析结果、修正建议和应用修正入口
- 统一 toast 行为：
  - 开始时提示
  - 每个阶段完成时提示
  - 取消时提示
  - 成功时提示
  - 失败时提示
- 后端取消：
  - AI 笔记任务继续可取消
  - 字幕任务新增可取消运行时
  - 取消后状态可查询，且后台资源尽量及时释放

### 不做的事

- 不改成新的通用工作流编排系统。
- 不新增复杂的任务队列产品化能力。
- 不把“字幕分析”扩展成与 AI 笔记完全相同的参数集。
- 不做与本需求无关的文案或视觉重构。

---

## 方案选择

### 推荐方案：双页面内联控制 + 统一任务控制抽象

AI 笔记和字幕分析保留各自的业务页面，但把配置、启动、停止和结果展示都放在页面内。前端抽一个共享控制条和 toast 监听逻辑；后端抽一个可取消任务运行时，笔记继续复用 `note.meta.control`，字幕使用独立任务 ID 和取消令牌。

优点：
- 改动集中在两个现有页面，不需要重做路由结构
- 和现有 AI 笔记页 / 字幕页的上下文最贴合
- 能保留现有结果展示与重跑逻辑

### 备选方案 1：合并成单一 AI 处理面板

把字幕与笔记的入口合并到一个统一页面，用模式切换管理不同任务。

优点：
- 长期最统一

缺点：
- 改动面大，容易把现有视频页和 AI 页一起牵动
- 不是本次需求的最小闭环

### 备选方案 2：只做前端内联，后端继续沿用现状

去掉弹窗，把设置放在页面里，但取消仍只做前端停止轮询。

优点：
- 最容易落地

缺点：
- 不满足“后台真正中断并释放资源”的要求

---

## 设计

### 1. AI 笔记页内联控制

`NoteTab` 作为 AI 笔记的主交互页，顶部增加常驻控制区，包含：

- 模型选择
- 详细程度选择
- 笔记风格选择
- 高级设置开关
- `开始 / 重新生成`
- `停止`

页面结构保持“设置区 + 结果区”两段式：

- 设置区始终可见
- 结果区显示当前笔记内容、阶段状态、摘要、生成路径
- 任务进行中时，按钮和状态跟随当前 `note.control_state`

点击 `重新生成` 时：

- 复用当前配置
- 直接触发后台重跑
- 不再打开任何弹窗

视频库或其他入口中的 AI 笔记按钮也不再打开独立弹窗，而是跳转到 `AiNotePanel` 页面并自动落到 `note` 相关区域，让页面内联控制成为唯一主入口。

### 2. 字幕页内联控制

`TranscriptTab` 改为常驻分析区，替换当前 `SubtitleAnalysisModal` 的弹窗入口。字幕页内保留：

- 当前字幕文件与内容预览
- 模型提供商选择
- 开始分析按钮
- 停止按钮
- 分析结果区
- 术语替换、修正应用等现有功能

字幕页的分析设置不强行引入 AI 笔记的全部参数，但交互风格保持一致：

- 配置在页面内常驻展示
- 分析触发后进入后台
- 不再弹窗遮挡当前字幕内容

### 3. 统一 toast 规则

前端增加一个共享的任务 toast 监听机制，按任务 ID 和阶段状态去重，避免轮询重复刷 toast。

建议 toast 触发规则：

- 开始：`已开始分析` / `已开始重新生成`
- 阶段完成：按阶段显示明确短句
  - 笔记：`音频读取完成`、`字幕生成完成`、`Prompt 构建完成`、`AI 分析完成`、`截图处理完成`
  - 字幕：`读取视频信息完成`、`字幕概况完成`、`AI 修正分析完成`
- 成功：`生成完成` / `分析完成`
- 取消：`已取消当前任务`
- 失败：展示后端错误摘要

### 4. 后端任务控制

#### AI 笔记

AI 笔记继续沿用现有记录驱动方式：

- `note.meta.control.state`
- `note.meta.control.current_stage`
- `note.meta.control.resume_from_stage`

取消时：

- 立即把控制状态置为 `cancelled`
- 任务在下一个可检查点抛出终止错误
- ASR 子进程继续沿用现有终止逻辑
- LLM 流式响应在循环中检查取消状态并提前结束

#### 字幕分析

字幕分析需要新增可取消运行时：

- 为一次字幕分析分配 `task_id`
- 后端保存当前任务状态与 cancel token
- SSE / 状态接口通过 `task_id` 返回阶段进度
- `cancel` 接口把 token 置为取消态
- 任务在以下位置检查取消态：
  - NFO 读取前后
  - 字幕概况前后
  - LLM 请求前
  - LLM 流式/同步返回后

取消后：

- 当前任务状态改为 `cancelled`
- 前端停止继续轮询或 SSE 监听
- 后端清理任务引用，避免悬挂

### 5. 弹窗移除

以下弹窗不再作为主入口：

- AI 笔记弹窗
- 字幕分析弹窗

它们的功能迁移到页面内联控制区后，旧组件可以：

- 直接删除，或
- 先保留一版薄封装，直到页面切换完全稳定

推荐直接删除主弹窗入口，避免以后出现两套交互并存。

---

## 前端文件边界

### 需要修改

- `apps/web/src/pages/components/AiNotePanel/NoteTab.tsx`
- `apps/web/src/pages/components/AiNotePanel/TranscriptTab.tsx`
- `apps/web/src/components/ai/AiNoteModal.tsx`
- `apps/web/src/components/ai/SubtitleAnalysisModal.tsx`
- `apps/web/src/components/NewDownload/VideoLibrary.tsx`
- `apps/web/src/components/ai/AiNotePanel.tsx`
- `apps/web/src/services/aiNote.ts`
- `apps/web/src/services/api.ts`

### 建议新增

- `apps/web/src/components/ai/AiTaskControlBar.tsx`
- `apps/web/src/hooks/useAiTaskToast.ts`
- `apps/web/src/hooks/useAiTaskControls.ts`

### 职责划分

- `AiTaskControlBar`：渲染模型 / 参数 / 开始 / 停止 / 状态标签
- `useAiTaskToast`：按阶段变化发 toast 并做去重
- `useAiTaskControls`：封装开始、停止、轮询、重试、状态同步

---

## 后端文件边界

### 需要修改

- `apps/api/src/routers/note.py`
- `apps/api/src/services/ai/note_service.py`
- `apps/api/src/routers/ai_subtitle.py`
- `apps/api/src/services/ai/subtitle_analyzer.py`
- `apps/api/src/llm/openai_client.py`
- `apps/api/src/llm/deepseek_client.py`

### 建议新增

- `apps/api/src/services/ai/task_control.py`
- `apps/api/src/services/ai/subtitle_task_service.py`

### 职责划分

- `task_control.py`：任务注册、取消令牌、状态查询、清理
- `subtitle_task_service.py`：字幕分析任务的启动、阶段推进、取消检查
- `note_service.py`：继续作为 AI 笔记主服务，补齐取消检查与阶段通知
- `openai_client.py` / `deepseek_client.py`：如需要，补充更细粒度的流式中断支持

---

## 错误处理

- 如果模型未配置或未测试成功，前端在开始前阻止提交并提示原因。
- 如果用户重复点击开始，前端直接忽略或提示当前已有任务在运行。
- 如果取消请求失败，前端提示“取消失败”，但仍停止本地轮询并刷新状态。
- 如果任务在取消时已经完成，后端返回最终状态，前端按完成处理。
- 如果任务在执行中遇到异常，保留错误信息和最后一个有效阶段。

---

## 验收标准

- `NoteTab` 页面内可直接配置模型、详细程度、风格和高级设置。
- `TranscriptTab` 页面内可直接发起字幕分析，不再依赖弹窗。
- AI 笔记和字幕分析都能在后台执行，不阻塞页面。
- 每个关键阶段完成后，前端都会出现一次明确 toast。
- 点击停止后，后端任务会进入取消态，并在安全检查点终止。
- 旧弹窗不再作为主要用户入口。
- 刷新页面后，仍能通过状态接口看见当前任务最终状态。

## 验证方式

- 前端：
  - 进入 `NoteTab` 后可以直接修改模型、详细程度、风格和高级设置并启动任务。
  - 进入 `TranscriptTab` 后可以直接启动字幕分析，不再需要打开弹窗。
  - 点击停止后，按钮状态立即变化，toast 提示取消成功或失败。
  - 阶段变化只触发一次 toast，不会因为轮询重复刷屏。
- 后端：
  - 笔记取消后，`note.meta.control.state` 会变成 `cancelled`，后续阶段不再继续写入。
  - 字幕取消后，任务 token 会被清理，后续 SSE / 状态查询不会继续返回活动中的任务引用。
  - 长耗时步骤在检查点能退出，不会卡住后台线程或子进程引用。
- 回归：
  - 旧的弹窗入口不再是主路径。
  - 生成失败、取消、重新生成都能给出明确 toast。
