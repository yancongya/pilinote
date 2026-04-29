# 阶段1：数据层统一重构

## 1.1 数据模型统一

### 删除旧模型
- 移除 `apps/api/src/models/download.py`
- 清理相关的数据库迁移

### 扩展 Task 模型
- 添加子任务支持（字幕、弹幕、封面等）
- 完善错误详情字段
- 添加文件组织相关字段

### 新增 SubTask 模型
```python
class SubTask(Base):
    """子任务模型 - 处理字幕、弹幕、封面等"""
    __tablename__ = 'subtasks'
    
    id = Column(String(50), primary_key=True)
    task_id = Column(String(50), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # video, subtitle, danmaku, cover, avatar, nfo
    state = Column(Integer, nullable=False, default=0)
    progress = Column(Integer, default=0)
    
    # 处理参数和输出
    params = Column(JSON, default={})
    output_path = Column(String(500))
    file_size = Column(Integer)
    error_detail = Column(JSON)
    
    created_at = Column(Integer, nullable=False)
    updated_at = Column(Integer, nullable=False)
```

## 1.2 数据库迁移

### 创建迁移脚本
```bash
cd apps/api
alembic revision --autogenerate -m "unified_download_system"
alembic upgrade head
```

### 数据迁移脚本
- 将现有 downloads 表数据迁移到 tasks 表
- 保留重要的历史数据
- 清理无用字段

## 1.3 验证数据完整性
- 检查所有任务状态正确映射
- 验证关联关系完整性
- 测试数据查询性能