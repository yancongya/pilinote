# 调度器

## 功能

定时扫描和自动下载。

## 调度器状态

| 状态 | 说明 |
|------|------|
| idle | 空闲 |
| running | 运行中 |
| paused | 暂停 |
| completed | 完成 |
| failed | 失败 |

## API

### 创建调度器

```
POST /api/queue/schedulers
Body: {
    "name": "我的调度器",
    "media_type": "favorite",
    "media_id": "收藏夹ID",
    "schedule_type": "interval",
    "interval_minutes": 60
}
```

### 启动调度器

```
POST /api/queue/schedulers/{id}/start
```

### 停止调度器

```
POST /api/queue/schedulers/{id}/stop
```

### 删除调度器

```
DELETE /api/queue/schedulers/{id}
```

## 实现

**关键文件**：
- `apps/api/src/services/queue/scheduler.py` - 调度器实现
- `apps/api/src/routers/queue.py` - 调度器路由

---

[返回上级](./README.md)