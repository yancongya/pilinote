# 队列系统

## 概述

基于 Aria2c 的任务队列系统。

## 任务状态

| 状态 | 说明 |
|------|------|
| backlog | 待处理 |
| pending | 队列中 |
| active | 下载中 |
| paused | 暂停 |
| completed | 完成 |
| failed | 失败 |
| cancelled | 取消 |

## API

### 获取队列

```
GET /api/queue
```

### 添加任务

```
POST /api/queue/add
Body: {
    "media_type": "video",
    "media_id": "BV1xx411c7mD",
    "title": "视频标题",
    "quality": 80
}
```

### 控制任务

```
POST /api/queue/{task_id}/control
Body: { "action": "start" | "pause" | "resume" }
```

### 删除任务

```
DELETE /api/queue/{task_id}
```

## WebSocket 实时更新

```
ws://localhost:8000/ws
```

**事件类型**：
- `task_created`: 任务创建
- `task_updated`: 任务更新
- `progress`: 进度更新

**关键文件**：
- 前端: `apps/web/src/stores/newQueue.ts` - WebSocket 处理
- 后端: `apps/api/src/routers/websocket.py`

---

[返回上级](./README.md)