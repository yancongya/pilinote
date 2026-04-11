# 任务系统

## 任务定义

### Task 模型

```python
class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(String(36), primary_key=True)
    media_type = Column(String(20))    # media_type
    media_id = Column(String(50))     # 视频 ID
    title = Column(String(500))        # 标题
    quality = Column(Integer)         # 清晰度
    status = Column(String(20))       # 状态
    progress = Column(Float)         # 进度 0-1
    stage = Column(String(20))       # 下载阶段
    error_message = Column(Text)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    completed_at = Column(DateTime)
```

## 执行流程

```
1. 调度器检查队列
2. 选择待处理任务
3. 下载引擎执行
4. 文件处理器处理
5. 更新任务状态
```

**关键文件**：
- `apps/api/src/services/queue/task.py` - 任务定义
- `apps/api/src/services/queue/manager.py` - 队列管理

---

[返回上级](./README.md)