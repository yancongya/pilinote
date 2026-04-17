# Phase 2: 核心生成 - 执行计划

## 目标
完成视频转写、笔记生成服务

## Wave 2: 转写和生成服务

### 02-01: 实现转写服务

**任务 ID**: 02-01
**描述**: 实现视频转写服务（优先 B站字幕 + Whisper 备选）
**依赖**: 01-01 (AiNote 模型)

#### 技术方案

采用混合策略：
1. 优先使用已下载的 B站字幕文件
2. 无字幕时使用 Whisper API 转写
3. 直接管道处理，不存储临时文件

#### 原子任务

**02-01-T01**: 创建转写服务基础类
- 文件: `apps/api/src/services/ai/transcriber.py`
- 内容:
  - `TranscriberService` 基类
  - `transcribe_video(video_path: str, video_id: str) -> str` 方法
  - 错误处理和日志

**02-01-T02**: 实现 B站字幕提取器
- 文件: `apps/api/src/services/ai/transcriber.py`
- 内容:
  - `BiliSubtitleTranscriber` 类
  - 读取 `data/downloads/{bvid}/` 下的字幕文件
  - 解析 .srt/.json 格式返回纯文本

**02-01-T03**: 实现 Whisper 转写器
- 文件: `apps/api/src/services/ai/transcriber.py`
- 内容:
  - `WhisperTranscriber` 类
  - 使用 OpenAI Whisper API
  - 支持音频提取和转写
  - 需要配置 OPENAI_API_KEY

**02-01-T04**: 创建转写服务工厂
- 文件: `apps/api/src/services/ai/transcriber.py`
- 内容:
  - `TranscriberFactory` 根据配置选择转写器
  - 自动降级策略：字幕 > Whisper > 失败

**02-01-T05**: 注册服务到 AI 模块
- 文件: `apps/api/src/services/ai/__init__.py`
- 内容: 导出 TranscriberService

---

### 02-02: 实现 AI 分析服务

**任务 ID**: 02-02
**描述**: 实现 AI 分析服务（串联转写→LLM→生成）
**依赖**: 01-03, 01-04, 02-01

#### 原子任务

**02-02-T01**: 创建 AI 分析服务类
- 文件: `apps/api/src/services/ai/note_service.py`
- 内容:
  - `AiNoteService` 主类
  - `analyze_video(video_id: str, style: str, formats: list)` 方法
  - 任务状态管理

**02-02-T02**: 实现视频文件路径解析
- 文件: `apps/api/src/services/ai/note_service.py`
- 内容:
  - 从 downloads 表获取视频文件路径
  - 验证文件存在
  - 提取视频元数据（标题、时长等）

**02-02-T03**: 实现转写流程
- 文件: `apps/api/src/services/ai/note_service.py`
- 内容:
  - 调用 TranscriberService 转写
  - 存储转写结果到 transcript 字段
  - 处理转写失败情况

**02-02-T04**: 实现笔记生成流程
- 文件: `apps/api/src/services/ai/note_service.py`
- 内容:
  - 调用 PromptBuilder 构建 prompt
  - 调用 LLMClientFactory 创建客户端
  - 发送请求获取 Markdown
  - 解析和验证响应

**02-02-T05**: 实现状态更新和持久化
- 文件: `apps/api/src/services/ai/note_service.py`
- 内容:
  - 更新 AiNote 记录状态
  - 保存生成的 Markdown
  - 记录错误信息

**02-02-T06**: 注册服务
- 文件: `apps/api/src/services/ai/__init__.py`
- 内容: 导出 AiNoteService

---

### 02-03: 创建 note 路由

**任务 ID**: 02-03
**描述**: 创建 note 路由（触发/状态/结果接口）
**依赖**: 02-02

#### 原子任务

**02-03-T01**: 创建 note 路由文件
- 文件: `apps/api/src/routers/note.py`
- 内容:
  - FastAPI router 定义
  - 前缀: `/api/note`

**02-03-T02**: 实现触发分析接口
- 文件: `apps/api/src/routers/note.py`
- 内容:
  - `POST /analyze`
  - 请求体: `video_id`, `style`, `formats`, `model_provider`, `model_name`
  - 返回: `note_id`, `status`

**02-03-T03**: 实现状态查询接口
- 文件: `apps/api/src/routers/note.py`
- 内容:
  - `GET /status/{note_id}`
  - 返回: `status`, `progress`, `message`

**02-03-T04**: 实现获取结果接口
- 文件: `apps/api/src/routers/note.py`
- 内容:
  - `GET /{note_id}`
  - 返回: `markdown`, `summary`, `style`, `formats`

**02-03-T05**: 注册路由到主应用
- 文件: `apps/api/main.py` 或 `apps/api/src/__init__.py`
- 内容: 导入并注册 note router

---

## 任务依赖图

```
Wave 2: 核心生成
├── 02-01: 转写服务
│   ├── 02-01-T01: 基础类
│   ├── 02-01-T02: B站字幕提取
│   ├── 02-01-T03: Whisper转写
│   ├── 02-01-T04: 转写工厂
│   └── 02-01-T05: 注册服务
│
├── 02-02: AI分析服务 (依赖 02-01)
│   ├── 02-02-T01: 服务类
│   ├── 02-02-T02: 路径解析
│   ├── 02-02-T03: 转写流程
│   ├── 02-02-T04: 笔记生成
│   ├── 02-02-T05: 状态更新
│   └── 02-02-T06: 注册服务
│
└── 02-03: 路由 (依赖 02-02)
    ├── 02-03-T01: 路由文件
    ├── 02-03-T02: 触发接口
    ├── 02-03-T03: 状态接口
    ├── 02-03-T04: 结果接口
    └── 02-03-T05: 注册路由
```

## 执行顺序

1. **Wave 2 整体** - 按顺序执行：
   - 先完成 02-01（转写服务）
   - 再完成 02-02（分析服务，依赖转写）
   - 最后完成 02-03（路由，依赖分析服务）

## 验证标准

- 本地视频文件可成功转写
- AI 分析可生成 Markdown 笔记
- API 接口可正常调用并返回结果