# AI 内容版本管理设计

## 需求概述

为字幕和笔记提供类似 git 的版本管理功能，支持版本切换、删除、显示 diff、修改和查看原文。

## 核心设计

### 1. 存储位置

```
downloads/{video_id}/ai-versions/
├── subtitle/
│   ├── v_20260420_143022_abc123.srt.gz
│   ├── v_20260420_144530_def456.srt.gz
│   └── versions.json
└── note/
    ├── v_20260420_143022_abc123.md.gz
    ├── v_20260420_144530_def456.md.gz
    └── versions.json
```

- 每个视频目录下创建 `.ai-versions/` 子目录
- 字幕和笔记分别独立管理
- 版本文件使用 gzip 压缩节省空间

### 2. 版本触发

- **自动触发**：每次 AI 生成新内容后自动保存为新版本
- **手动触发**：用户点击"保存为新版本"按钮

### 3. 版本元数据（基础版）

```json
{
  "versions": [
    {
      "hash": "abc123def",
      "timestamp": 1716195022000,
      "filename": "v_20260420_143022_abc123.srt.gz"
    }
  ],
  "current": "abc123def"
}
```

### 4. 版本文件命名

```
v_{timestamp}_{short_hash}.{ext}.gz
```

- timestamp: 14位时间戳 (YYYYMMDDHHMMSS)
- short_hash: 内容hash前8位
- ext: srt 或 md

### 5. Diff 计算

- 实时计算：使用 Python `difflib` 生成 unified diff
- 按需返回：前端请求时计算，不预存储

## API 设计

### 获取版本列表

```
GET /api/local/versions/{video_id}?type=subtitle
```

Response:
```json
{
  "success": true,
  "data": {
    "versions": [
      {
        "hash": "abc123def",
        "timestamp": 1716195022000,
        "filename": "v_20260420_143022_abc123.srt.gz"
      }
    ],
    "current": "abc123def"
  }
}
```

### 获取版本内容

```
GET /api/local/versions/{video_id}/{hash}?type=subtitle
```

### 获取 Diff

```
GET /api/local/versions/{video_id}/diff?type=subtitle&from=abc123&to=def456
```

Response:
```json
{
  "success": true,
  "data": {
    "diff": "--- v_20260420_143022_abc123.srt\n+++ v_20260420_144530_def456.srt\n@@ -1,3 +1,3 @@\n..."
  }
}
```

### 切换版本

```
POST /api/local/versions/{video_id}/switch
Body: { "type": "subtitle", "hash": "def456" }
```

### 删除版本

```
DELETE /api/local/versions/{video_id}/{hash}?type=subtitle
```

### 保存新版本

```
POST /api/local/versions/{video_id}
Body: { "type": "subtitle", "content": "...", "source": "ai|manual" }
```

## 前端交互

### 版本列表 UI

- 侧边栏显示版本历史列表
- 每个版本显示：时间戳 + hash前8位
- 当前版本高亮显示
- 支持点击切换版本

### 操作按钮

- **查看原文**：读取该版本原始内容
- **显示差异**：与当前版本对比显示 diff
- **删除**：删除指定版本
- **保存**：手动保存当前编辑为新版本

## 实现计划

1. 后端：创建版本管理服务 `VersionManager`
2. 后端：新增版本管理 API 路由
3. 前端：添加版本列表组件
4. 前端：集成版本操作到字幕/笔记Tab