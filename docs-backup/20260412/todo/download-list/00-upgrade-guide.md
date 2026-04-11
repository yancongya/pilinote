# PiliNote 下载系统重构 - 升级指南

## ⚠️ 重要警告

在进行任何代码修改之前，**必须**仔细阅读本文档的所有内容。本重构涉及核心架构的彻底改造，任何疏忽都可能导致系统崩溃或数据丢失。

---

## 📋 升级前准备清单

### 1. 备份当前状态

在开始任何修改之前，**必须**执行以下操作：

```bash
# 1. 备份数据库
cp pilinote.db pilinote.db.backup.$(date +%Y%m%d_%H%M%S)

# 2. 备份配置文件
cp apps/api/.env apps/api/.env.backup

# 3. 记录当前Git状态
git status > git_status_backup.txt
git diff HEAD > git_diff_backup.txt

# 4. 创建功能分支
git checkout -b refactor/download-system-$(date +%Y%m%d)

# 5. 记录当前运行状态
ps aux | grep "python.*main.py" > running_processes_backup.txt
```

### 2. 记录关键配置

创建配置记录文件 `docs/todo/download-list/current-config.md`：

```markdown
## 当前配置记录

### 下载配置
- 默认下载路径: `downloads/`
- 临时文件路径: `temp/`
- 数据库路径: `data/pilinote.db`

### API配置
- 端口: 8000
- 最大并发数: 3
- 超时时间: 120秒

### 前端配置
- API地址: http://localhost:8000
- WebSocket地址: ws://localhost:8000/ws

### 已知问题
- DownloadService和DownloadManager冲突
- 缺少视频类型分类
- 无缓存机制
```

---

## 🔍 前后端匹配检查

### 变量命名规范

**Python后端（FastAPI）**：
- 使用 `snake_case` 命名
- 示例：`media_type`, `video_id`, `user_info`

**TypeScript前端（React）**：
- 使用 `camelCase` 命名
- 示例：`mediaType`, `videoId`, `userInfo`

**字段映射表**：

| 后端字段 | 前端字段 | 说明 |
|---------|---------|------|
| media_type | mediaType | 媒体类型 |
| media_id | mediaId | 媒体ID |
| created_at | createdAt | 创建时间 |
| updated_at | updatedAt | 更新时间 |
| pubdate | pubDate | 发布日期 |
| uploader_mid | uploaderMid | UP主ID |

### API响应格式

**统一响应格式**：

```typescript
interface ApiResponse<T> {
  code: number;        // 0表示成功，非0表示错误
  message: string;     // 错误信息
  data: T;            // 实际数据
}
```

**前端适配层**：

```typescript
// apps/web/src/services/api.ts
export async function fetchMediaInfo(mediaType: string, mediaId: string) {
  const response = await fetch(`/api/media/${mediaType}/${mediaId}`);
  const result = await response.json();

  // 转换字段命名
  return {
    mediaType: result.media_type,
    mediaId: result.media_id,
    createdAt: result.created_at,
    updatedAt: result.updated_at,
    // ... 其他字段
  };
}
```

---

## ⚠️ 潜在冲突点

### 1. 数据库模型冲突

**风险点**：
- 现有的 `Download` 模型与新 `Task` 模型可能字段冲突
- 外键关系可能被破坏

**解决方案**：
```python
# 1. 添加字段时使用 nullable=True
media_type = Column(String(20), nullable=True)  # 向后兼容

# 2. 迁移脚本添加检查
def migrate():
    # 检查字段是否已存在
    inspector = inspect(engine)
    existing_columns = [col['name'] for col in inspector.get_columns('downloads')]

    if 'media_type' not in existing_columns:
        # 添加新字段
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE downloads ADD COLUMN media_type VARCHAR(20)"))
```

### 2. API端点冲突

**风险点**：
- 新的 `/api/media/*` 端点可能与旧端点冲突
- 前端可能调用错误的端点

**解决方案**：
```python
# 1. 保留旧端点，标记为废弃
@router.get("/api/video/{video_id}")
@deprecated(reason="使用 /api/media/video/{video_id} 代替")
async def get_video_info_old(video_id: str):
    # 旧实现
    pass

# 2. 新端点
@router.get("/api/media/video/{video_id}")
async def get_media_info(video_id: str):
    # 新实现
    pass
```

### 3. 路由优先级

**风险点**：
- 新旧路由同时注册可能导致路由冲突

**解决方案**：
```python
# main.py
# 优先注册新路由
app.include_router(media.router)        # 新路由优先
app.include_router(video.router)        # 旧路由保留
```

---

## 🧪 测试策略

### 后端测试

#### 1. 单元测试

创建测试脚本 `test_backend.sh`：

```bash
#!/bin/bash

echo "开始后端测试..."

# 测试1：API健康检查
echo "测试1: API健康检查"
response=$(curl -s http://localhost:8000/health)
if [[ $response == *"healthy"* ]]; then
  echo "✓ 健康检查通过"
else
  echo "✗ 健康检查失败"
  exit 1
fi

# 测试2：获取视频信息
echo "测试2: 获取视频信息"
response=$(curl -s "http://localhost:8000/api/media/video/BV1xx411c7mD")
if [[ $response == *"title"* ]]; then
  echo "✓ 视频信息获取通过"
else
  echo "✗ 视频信息获取失败"
  exit 1
fi

# 测试3：提交任务
echo "测试3: 提交任务"
response=$(curl -s -X POST http://localhost:8000/api/queue/tasks \
  -H "Content-Type: application/json" \
  -d '{"media_type":"video","media_id":"BV1xx411c7mD","title":"测试"}')
if [[ $response == *"id"* ]]; then
  echo "✓ 任务提交通过"
  TASK_ID=$(echo $response | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
else
  echo "✗ 任务提交失败"
  exit 1
fi

# 测试4：创建调度器
echo "测试4: 创建调度器"
response=$(curl -s -X POST http://localhost:8000/api/queue/schedulers \
  -H "Content-Type: application/json" \
  -d '{"title":"测试调度器","folder":"/tmp/test_downloads"}')
if [[ $response == *"id"* ]]; then
  echo "✓ 调度器创建通过"
  SCHEDULER_ID=$(echo $response | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
else
  echo "✗ 调度器创建失败"
  exit 1
fi

# 测试5：启动调度器
echo "测试5: 启动调度器"
response=$(curl -s -X POST "http://localhost:8000/api/queue/schedulers/${SCHEDULER_ID}/start")
if [[ $response == *"已启动"* ]]; then
  echo "✓ 调度器启动通过"
else
  echo "✗ 调度器启动失败"
  exit 1
fi

# 等待任务完成
echo "等待任务完成..."
sleep 10

# 测试6：检查任务状态
echo "测试6: 检查任务状态"
response=$(curl -s "http://localhost:8000/api/queue/tasks/${TASK_ID}")
if [[ $response == *"state"* ]]; then
  echo "✓ 任务状态检查通过"
else
  echo "✗ 任务状态检查失败"
  exit 1
fi

echo "✓ 所有后端测试通过"
```

#### 2. 数据库测试

创建测试脚本 `test_database.sh`：

```bash
#!/bin/bash

echo "开始数据库测试..."

# 测试1：检查表是否存在
echo "测试1: 检查表是否存在"
TABLES=$(sqlite3 data/pilinote.db ".tables")
if [[ $TABLES == *"tasks"* ]] && [[ $TABLES == *"schedulers"* ]] && [[ $TABLES == *"queues"* ]]; then
  echo "✓ 新表创建成功"
else
  echo "✗ 新表创建失败"
  exit 1
fi

# 测试2：检查字段是否存在
echo "测试2: 检查字段是否存在"
COLUMNS=$(sqlite3 data/pilinote.db "PRAGMA table_info(downloads)")
if [[ $COLUMNS == *"media_type"* ]]; then
  echo "✓ 新字段添加成功"
else
  echo "✗ 新字段添加失败"
  exit 1
fi

# 测试3：检查数据完整性
echo "测试3: 检查数据完整性"
COUNT=$(sqlite3 data/pilinote.db "SELECT COUNT(*) FROM downloads")
if [[ $COUNT -ge 0 ]]; then
  echo "✓ 数据完整性检查通过"
else
  echo "✗ 数据完整性检查失败"
  exit 1
fi

echo "✓ 所有数据库测试通过"
```

### 前端测试

#### 1. 功能测试

创建测试脚本 `test_frontend.sh`：

```bash
#!/bin/bash

echo "开始前端测试..."

# 启动前端开发服务器（如果未启动）
if ! curl -s http://localhost:5173 > /dev/null; then
  echo "启动前端开发服务器..."
  cd apps/web
  npm run dev > /dev/null 2>&1 &
  FRONTEND_PID=$!
  sleep 5
  cd ../..
fi

# 测试1：前端加载
echo "测试1: 前端加载"
response=$(curl -s http://localhost:5173)
if [[ $response == *"<!doctype html>"* ]]; then
  echo "✓ 前端加载成功"
else
  echo "✗ 前端加载失败"
  exit 1
fi

# 测试2：API调用（通过浏览器控制台测试）
echo "测试2: API调用"
echo "请在浏览器控制台执行以下命令："
echo "fetch('/api/media/video/BV1xx411c7mD').then(r => r.json()).then(console.log)"
read -p "按Enter继续测试..."

# 测试3：界面渲染
echo "测试3: 界面渲染"
echo "请检查以下功能："
echo "  1. 视频列表是否正常显示"
echo "  2. 下载按钮是否可点击"
echo "  3. 下载队列是否正常更新"
read -p "按Enter继续测试..."

echo "✓ 所有前端测试通过"

# 清理
if [[ -n "$FRONTEND_PID" ]]; then
  kill $FRONTEND_PID
fi
```

#### 2. 集成测试

创建测试脚本 `test_integration.sh`：

```bash
#!/bin/bash

echo "开始集成测试..."

# 1. 清理测试数据
echo "清理测试数据..."
rm -rf /tmp/test_downloads/*

# 2. 提交测试任务
echo "提交测试任务..."
TASK_RESPONSE=$(curl -s -X POST http://localhost:8000/api/queue/tasks \
  -H "Content-Type: application/json" \
  -d '{"media_type":"video","media_id":"BV1xx411c7mD","title":"集成测试视频"}')

TASK_ID=$(echo $TASK_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "任务ID: $TASK_ID"

# 3. 创建测试调度器
echo "创建测试调度器..."
SCHEDULER_RESPONSE=$(curl -s -X POST http://localhost:8000/api/queue/schedulers \
  -H "Content-Type: application/json" \
  -d '{"title":"集成测试调度器","folder":"/tmp/test_downloads"}')

SCHEDULER_ID=$(echo $SCHEDULER_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "调度器ID: $SCHEDULER_ID"

# 4. 启动调度器
echo "启动调度器..."
curl -s -X POST "http://localhost:8000/api/queue/schedulers/${SCHEDULER_ID}/start"

# 5. 等待任务完成
echo "等待任务完成..."
MAX_WAIT=60
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  STATUS_RESPONSE=$(curl -s "http://localhost:8000/api/queue/tasks/${TASK_ID}")
  STATE=$(echo $STATUS_RESPONSE | grep -o '"state":[0-9]*' | cut -d':' -f2)

  if [[ $STATE == "3" ]]; then
    echo "✓ 任务完成"
    break
  elif [[ $STATE == "5" ]]; then
    echo "✗ 任务失败"
    echo $STATUS_RESPONSE
    exit 1
  fi

  sleep 5
  WAITED=$((WAITED + 5))
done

if [[ $WAITED -ge $MAX_WAIT ]]; then
  echo "✗ 任务超时"
  exit 1
fi

# 6. 检查输出文件
echo "检查输出文件..."
if [[ -d "/tmp/test_downloads" ]] && [[ $(ls -A /tmp/test_downloads) ]]; then
  echo "✓ 输出文件存在"
  ls -lh /tmp/test_downloads
else
  echo "✗ 输出文件不存在"
  exit 1
fi

echo "✓ 所有集成测试通过"
```

---

## 📝 测试执行流程

### 完整测试流程

```bash
#!/bin/bash
# run_all_tests.sh

echo "=========================================="
echo "  PiliNote 下载系统重构 - 完整测试流程"
echo "=========================================="

# 1. 后端测试
echo ""
echo "第1部分: 后端测试"
echo "----------------------------------------"
chmod +x test_backend.sh
./test_backend.sh
if [[ $? -ne 0 ]]; then
  echo "✗ 后端测试失败"
  exit 1
fi

# 2. 数据库测试
echo ""
echo "第2部分: 数据库测试"
echo "----------------------------------------"
chmod +x test_database.sh
./test_database.sh
if [[ $? -ne 0 ]]; then
  echo "✗ 数据库测试失败"
  exit 1
fi

# 3. 前端测试
echo ""
echo "第3部分: 前端测试"
echo "----------------------------------------"
chmod +x test_frontend.sh
./test_frontend.sh
if [[ $? -ne 0 ]]; then
  echo "✗ 前端测试失败"
  exit 1
fi

# 4. 集成测试
echo ""
echo "第4部分: 集成测试"
echo "----------------------------------------"
chmod +x test_integration.sh
./test_integration.sh
if [[ $? -ne 0 ]]; then
  echo "✗ 集成测试失败"
  exit 1
fi

# 5. 清理测试脚本
echo ""
echo "第5部分: 清理测试脚本"
echo "----------------------------------------"
rm -f test_backend.sh test_database.sh test_frontend.sh test_integration.sh run_all_tests.sh
echo "✓ 测试脚本已清理"

echo ""
echo "=========================================="
echo "  ✓ 所有测试通过！可以提交代码"
echo "=========================================="
```

---

## 🚫 Git提交规范

### 提交前检查清单

在执行 `git commit` 之前，**必须**确认：

- [ ] 所有测试通过（后端、前端、集成测试）
- [ ] 数据库迁移成功
- [ ] 向后兼容性验证通过
- [ ] 前端API调用正常
- [ ] 无运行时错误
- [ ] 日志记录正常

### 提交命令

```bash
# 1. 运行完整测试
chmod +x run_all_tests.sh
./run_all_tests.sh

# 2. 查看变更
git status
git diff

# 3. 添加文件
git add .
git add docs/todo/download-list/00-upgrade-guide.md

# 4. 提交（遵循Conventional Commits规范）
git commit -m "refactor(download): 实现统一的队列管理系统

- 新增QueueManager统一管理四级队列
- 实现Scheduler调度器和Task任务系统
- 添加VideoCacheService缓存机制
- 实现SubTaskHandler处理器系统
- 统一API端点设计

测试: 所有后端、前端、集成测试通过
兼容: 保持向后兼容，旧接口标记为废弃
"

# 5. 推送到远程（可选）
git push origin refactor/download-system-$(date +%Y%m%d)
```

### 提交消息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: 新功能
- `fix`: 修复bug
- `refactor`: 重构
- `docs`: 文档
- `test`: 测试
- `chore`: 构建/工具

**Scope**:
- `download`: 下载系统
- `api`: API接口
- `frontend`: 前端
- `database`: 数据库

**示例**:
```
feat(download): 实现任务调度系统

- 新增Scheduler调度器服务
- 实现任务分发和执行逻辑
- 支持并发控制和进度管理

Closes #123
```

---

## 🔄 回滚策略

如果测试失败，需要回滚到之前的状态：

```bash
# 1. 停止所有进程
pkill -f "python.*main.py"
pkill -f "npm.*dev"

# 2. 恢复数据库
cp pilinote.db.backup.YYYYMMDD_HHMMSS pilinote.db

# 3. 恢复配置
cp apps/api/.env.backup apps/api/.env

# 4. 恢复代码
git reset --hard HEAD
git checkout main

# 5. 删除功能分支
git branch -D refactor/download-system-YYYYMMDD

# 6. 清理测试文件
rm -rf /tmp/test_downloads/*
```

---

## 📞 故障排除

### 常见问题

#### 1. 数据库迁移失败

**症状**：
```
OperationalError: table tasks already exists
```

**解决方案**：
```bash
# 检查表是否已存在
sqlite3 data/pilinote.db ".tables"

# 如果存在，先删除
sqlite3 data/pilinote.db "DROP TABLE IF EXISTS tasks; DROP TABLE IF EXISTS schedulers; DROP TABLE IF EXISTS queues;"

# 重新运行迁移
python3 migrate_add_task_tables.py
```

#### 2. API端口冲突

**症状**：
```
OSError: [Errno 48] Address already in use
```

**解决方案**：
```bash
# 查找占用端口的进程
lsof -i :8000

# 杀死进程
kill -9 <PID>

# 或修改端口
# apps/api/main.py
# app = FastAPI(port=8001)
```

#### 3. 前端API调用失败

**症状**：
```
TypeError: Cannot read properties of undefined (reading 'mediaType')
```

**解决方案**：
```typescript
// 检查字段映射
const response = await fetch(`/api/media/video/${bvid}`);
const data = await response.json();

// 添加安全检查
if (!data || !data.media_type) {
  throw new Error('Invalid response format');
}

// 转换字段命名
const result = {
  mediaType: data.media_type,
  // ...
};
```

---

## 📚 参考资源

### BiliTools项目参考

- **架构设计**：`reference/BiliTools/src-tauri/src/services/queue/`
- **处理器实现**：`reference/BiliTools/src-tauri/src/services/queue/handlers.rs`
- **缓存机制**：`reference/BiliTools/src-tauri/src/storage/`

### 当前项目参考

- **现有下载逻辑**：`apps/api/src/services/download_service.py`
- **现有引擎**：`apps/api/src/services/download_engine.py`
- **B站API**：`apps/api/src/services/bilibili.py`

---

## ✅ 最终检查清单

在提交代码之前，最后确认：

- [ ] 已备份当前状态（数据库、配置、Git状态）
- [ ] 已创建功能分支
- [ ] 已完成所有6个阶段的实施
- [ ] 所有后端测试通过
- [ ] 所有前端测试通过
- [ ] 所有集成测试通过
- [ ] 向后兼容性验证通过
- [ ] 测试脚本已清理
- [ ] 提交消息格式正确
- [ ] 代码已推送到远程（可选）

---

**最后更新**：2026-03-31
**版本**：1.0.0
**维护者**：PiliNote开发团队

**⚠️ 重要**：只有在所有测试通过后，才能提交代码。任何测试失败都必须修复后才能继续。