# 阶段5：测试和清理

## 5.1 功能测试

### 单元测试
```python
# tests/test_queue_manager.py
class TestQueueManager:
    async def test_submit_task(self):
        """测试任务提交"""
        
    async def test_task_execution(self):
        """测试任务执行"""
        
    async def test_error_handling(self):
        """测试错误处理"""

# tests/test_handlers.py
class TestHandlers:
    async def test_video_handler(self):
        """测试视频下载"""
        
    async def test_subtitle_handler(self):
        """测试字幕下载"""
```

### 集成测试
```python
# tests/test_integration.py
class TestDownloadIntegration:
    async def test_complete_download_flow(self):
        """测试完整下载流程"""
        # 1. 提交任务
        # 2. 验证队列流转
        # 3. 验证文件生成
        # 4. 验证 WebSocket 事件
```

### 前端测试
```typescript
// tests/queue.test.ts
describe('Queue Store', () => {
  test('should submit task correctly', () => {
    // 测试任务提交
  })
  
  test('should handle WebSocket messages', () => {
    // 测试 WebSocket 消息处理
  })
})
```

## 5.2 性能测试

### 并发下载测试
```python
async def test_concurrent_downloads():
    """测试并发下载性能"""
    tasks = []
    for i in range(10):
        task = await queue_manager.submit_task(create_test_task())
        tasks.append(task)
    
    # 验证并发控制
    assert len(queue_manager.running_tasks) <= 3
```

### 内存使用测试
```python
async def test_memory_usage():
    """测试大文件下载的内存使用"""
    # 监控内存使用情况
    # 验证没有内存泄漏
```

## 5.3 代码清理

### 移除旧代码
```bash
# 删除旧文件
rm apps/api/src/models/download.py
rm apps/api/src/routers/download.py.backup
rm apps/api/src/services/download_manager.py
rm apps/web/src/stores/download.ts
rm apps/web/src/stores/newQueue.ts

# 清理旧组件
rm -rf apps/web/src/components/Download/
```

### 更新依赖
```bash
# 后端
cd apps/api
pip uninstall unused-packages
pip freeze > requirements.txt

# 前端
cd apps/web
pnpm remove unused-packages
pnpm install
```

### 文档更新
```markdown
# 更新 README.md
- 新的下载系统架构说明
- API 文档更新
- 使用指南更新

# 更新 AGENTS.md
- 新的代码结构说明
- 开发指南更新
```

## 5.4 数据库清理

### 清理旧表
```sql
-- 备份旧数据
CREATE TABLE downloads_backup AS SELECT * FROM downloads;

-- 删除旧表
DROP TABLE downloads;

-- 清理无用索引
DROP INDEX IF EXISTS idx_downloads_status;
```

### 优化新表
```sql
-- 添加必要索引
CREATE INDEX idx_tasks_state ON tasks(state);
CREATE INDEX idx_tasks_scheduler_id ON tasks(scheduler_id);
CREATE INDEX idx_subtasks_task_id ON subtasks(task_id);
```

## 5.5 部署验证

### 开发环境验证
```bash
# 启动后端
cd apps/api
source venv/bin/activate
uvicorn src.main:app --reload

# 启动前端
cd apps/web
pnpm dev

# 验证功能
curl -X POST http://localhost:8000/api/queue/tasks \
  -H "Content-Type: application/json" \
  -d '{"media_type": "video", "media_id": "BV1xx411c7mD"}'
```

### 生产环境准备
```bash
# 数据库迁移
alembic upgrade head

# 重启服务
systemctl restart pilinote-api
systemctl restart pilinote-web
```

## 5.6 监控和日志

### 添加监控指标
```python
# 下载成功率
download_success_rate = Counter('download_success_total')
download_failure_rate = Counter('download_failure_total')

# 队列长度
queue_length = Gauge('queue_length', ['queue_type'])

# 下载速度
download_speed = Histogram('download_speed_bytes_per_second')
```

### 日志配置
```python
# 配置结构化日志
logging.config.dictConfig({
    'version': 1,
    'formatters': {
        'detailed': {
            'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        }
    },
    'handlers': {
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'download.log',
            'formatter': 'detailed'
        }
    },
    'loggers': {
        'src.services.queue': {
            'level': 'INFO',
            'handlers': ['file']
        }
    }
})
```

## 5.7 回滚计划

### 数据回滚
```sql
-- 如果需要回滚到旧系统
CREATE TABLE downloads AS SELECT * FROM downloads_backup;
```

### 代码回滚
```bash
# 使用 git 回滚到重构前的提交
git checkout <pre-refactor-commit>
```

### 服务回滚
```bash
# 回滚到旧版本
docker rollback pilinote-api
docker rollback pilinote-web
```