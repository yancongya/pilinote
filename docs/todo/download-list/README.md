# PiliNote 下载系统重构文档

## 概述

本文档集包含了PiliNote下载系统从混乱架构到BiliTools架构的完整重构指南。重构的目标是解决当前系统中视频类型管理混乱、下载管理职责不清、缺少缓存机制等核心问题。

## 重构目标

1. **统一视频类型管理** - 清晰区分单集、系列、集合等不同类型
2. **统一队列管理系统** - 解决双管理器冲突问题
3. **实现任务调度系统** - 支持复杂的下载流程
4. **实现缓存机制** - 提高性能，减少API调用
5. **分离处理器逻辑** - 提高代码可维护性
6. **统一API接口** - 提供清晰易用的接口

## 文档结构

```
docs/todo/download-list/
├── README.md                    # 本文档
├── 01-phase1-data-model-refactoring.md    # 阶段1：数据模型重构
├── 02-phase2-queue-management-system.md  # 阶段2：队列管理系统
├── 03-phase3-task-system-refactoring.md  # 阶段3：任务系统重构
├── 04-phase4-cache-system.md             # 阶段4：缓存系统
├── 05-phase5-handler-system.md           # 阶段5：处理器系统
└── 06-phase6-api-unification.md          # 阶段6：API端点统一
```

## 阶段概览

### 阶段1：数据模型重构

**目标**：创建支持任务、调度器、队列管理的数据表结构

**主要内容**：
- 新增tasks表 - 任务管理
- 新增schedulers表 - 调度器管理
- 新增queues表 - 队列管理
- 修改Download模型 - 添加media_type和source字段
- 统一数据结构Schema

**预计时间**：2-3天

**依赖**：无

**输出**：
- `apps/api/src/models/task.py`
- `apps/api/src/models/scheduler.py`
- `apps/api/src/models/queue.py`
- `apps/api/src/schemas/task.py`
- `apps/api/src/schemas/scheduler.py`
- `apps/api/src/schemas/queue.py`
- `apps/api/migrate_add_task_tables.py`

### 阶段2：队列管理系统

**目标**：实现统一的队列管理器

**主要内容**：
- QueueManager - 统一的队列管理器（单例模式）
- 四级队列（backlog/pending/doing/complete）
- 任务提交和调度器创建
- 队列API端点

**预计时间**：2-3天

**依赖**：阶段1

**输出**：
- `apps/api/src/services/queue/manager.py`
- `apps/api/src/routers/queue.py`
- 更新 `apps/api/main.py`

### 阶段3：任务系统重构

**目标**：实现Scheduler和Task的具体执行逻辑

**主要内容**：
- SchedulerService - 调度器服务
- TaskService - 任务服务
- 子任务创建和管理
- 任务调度和执行

**预计时间**：3-4天

**依赖**：阶段1、阶段2

**输出**：
- `apps/api/src/services/queue/scheduler.py`
- `apps/api/src/services/queue/task.py`
- 更新 `apps/api/src/routers/queue.py`

### 阶段4：缓存系统

**目标**：实现视频数据缓存服务

**主要内容**：
- VideoCacheService - 视频缓存服务
- SQLite+内存双缓存
- TTL管理
- 缓存失效和清理

**预计时间**：2-3天

**依赖**：阶段1

**输出**：
- `apps/api/src/services/cache/video_cache.py`
- `apps/api/src/routers/cache.py`
- 更新 `apps/api/services/bilibili.py`
- 更新 `apps/api/main.py`

### 阶段5：处理器系统

**目标**：实现子任务处理器系统

**主要内容**：
- BaseHandler - 处理器基类
- VideoHandler - 视频处理器
- SubtitleHandler - 字幕处理器
- DanmakuHandler - 弹幕处理器
- ThumbHandler - 封面处理器
- NfoHandler - NFO处理器
- 处理器注册表

**预计时间**：3-4天

**依赖**：阶段1、阶段3

**输出**：
- `apps/api/src/services/queue/handlers/base.py`
- `apps/api/src/services/queue/handlers/video.py`
- `apps/api/src/services/queue/handlers/subtitle.py`
- `apps/api/src/services/queue/handlers/danmaku.py`
- `apps/api/src/services/queue/handlers/thumb.py`
- `apps/api/src/services/queue/handlers/nfo.py`
- `apps/api/src/services/queue/handlers/__init__.py`

### 阶段6：API端点统一

**目标**：统一API端点设计

**主要内容**：
- 统一的媒体信息接口
- 统一的Schema定义
- 更新主应用路由
- API文档

**预计时间**：2-3天

**依赖**：阶段4

**输出**：
- `apps/api/src/routers/media.py`
- `apps/api/src/schemas/media.py`
- 更新 `apps/api/main.py`
- `apps/api/README.md`

## 总体时间规划

| 阶段 | 预计时间 | 累计时间 |
|------|---------|---------|
| 阶段1：数据模型重构 | 2-3天 | 2-3天 |
| 阶段2：队列管理系统 | 2-3天 | 4-6天 |
| 阶段3：任务系统重构 | 3-4天 | 7-10天 |
| 阶段4：缓存系统 | 2-3天 | 9-13天 |
| 阶段5：处理器系统 | 3-4天 | 12-17天 |
| 阶段6：API端点统一 | 2-3天 | 14-20天 |

**总计**：14-20天（约3-4周）

## 架构对比

### 重构前架构

```
API Layer
    ↓
DownloadService <----> DownloadManager  ❌ 双管理器冲突
    ↓
DownloadEngine
    ↓
File System
```

### 重构后架构

```
API Layer
    ↓
QueueManager (统一队列管理)
    ↓
Scheduler (调度器)
    ↓
Task (任务)
    ↓
SubTask (子任务)
    ↓
Handlers (处理器)  ✅ 职责分离
    ↓
File System

↔ CacheService (缓存服务)  ✅ 性能优化
```

## 核心改进

### 1. 视频类型管理

**改进前**：
- ❌ Download模型没有type字段
- ❌ 无法区分视频来源
- ❌ 无法按类型筛选

**改进后**：
- ✅ 明确的MediaType枚举
- ✅ 添加source_type和source_id
- ✅ 支持按类型管理

### 2. 队列管理

**改进前**：
- ❌ 双管理器冲突
- ❌ 状态不同步
- ❌ 资源浪费

**改进后**：
- ✅ 统一的QueueManager
- ✅ 四级队列管理
- ✅ 状态同步

### 3. 任务执行

**改进前**：
- ❌ DownloadService职责过重
- ❌ 没有子任务概念
- ❌ 流程不清晰

**改进后**：
- ✅ Manager→Scheduler→Task→SubTask
- ✅ 职责清晰
- ✅ 流程明确

### 4. 缓存机制

**改进前**：
- ❌ 只有Headers缓存
- ❌ 所有数据实时获取
- ❌ 容易触发限流

**改进后**：
- ✅ SQLite+内存双缓存
- ✅ 灵活的TTL配置
- ✅ 自动清理过期缓存

### 5. 处理器系统

**改进前**：
- ❌ 文件处理逻辑混杂
- ❌ 难以扩展
- ❌ 代码复用差

**改进后**：
- ✅ 独立的处理器
- ✅ 易于扩展
- ✅ 代码复用

### 6. API设计

**改进前**：
- ❌ 端点重复
- ❌ 数据格式不一致
- ❌ 前端困惑

**改进后**：
- ✅ 统一的媒体接口
- ✅ 统一的数据格式
- ✅ 清晰的API文档

## 实施建议

### 渐进式迁移

1. **保留现有代码** - 创建新模块，逐步迁移
2. **双轨运行** - 新旧系统并存，逐步切换
3. **数据迁移** - 编写脚本迁移现有数据
4. **前端适配** - 更新前端API调用

### 测试策略

1. **单元测试** - 每个模块独立测试
2. **集成测试** - 测试完整下载流程
3. **性能测试** - 对比新旧系统性能
4. **兼容性测试** - 确保前端无缝切换

### 风险控制

1. **不破坏现有功能** - 先实现新系统，再逐步迁移
2. **数据一致性** - 确保数据库迁移正确
3. **错误处理** - 完善异常处理和重试机制
4. **日志记录** - 详细记录任务执行过程

## 参考项目

本重构方案参考了以下项目：

- **BiliTools** - 核心架构参考
  - 队列管理系统
  - 任务调度系统
  - 处理器系统
  - 缓存机制

- **hermes** - 部署方案参考
  - Docker部署
  - WebSocket通信
  - 任务队列

## 注意事项

1. **向后兼容** - 保留旧接口，标记为废弃
2. **数据迁移** - 编写迁移脚本，确保数据完整性
3. **性能优化** - 使用异步IO，避免阻塞
4. **错误处理** - 完善异常处理，记录详细日志
5. **文档完善** - 提供完整的API文档和使用说明

## 成功标准

完成所有阶段后，系统应该：

1. ✅ 支持多种视频类型（单集、系列、集合等）
2. ✅ 统一的队列管理，无状态冲突
3. ✅ 清晰的任务执行流程
4. ✅ 完善的缓存机制，性能提升
5. ✅ 模块化的处理器系统
6. ✅ 统一的API接口，易于使用
7. ✅ 完整的文档和示例
8. ✅ 向后兼容，不影响现有功能

## 后续优化

完成核心重构后，可以考虑：

1. **性能优化** - 优化关键路径性能
2. **监控告警** - 添加系统监控和告警
3. **分布式部署** - 支持多实例部署
4. **插件系统** - 支持自定义处理器
5. **AI功能** - 集成AI推荐和分类

## 联系方式

如有问题，请联系开发团队。

---

**最后更新**：2026-03-31
**版本**：1.0.0
**状态**：规划中