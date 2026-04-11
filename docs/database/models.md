# 数据模型

## 核心模型

### User

```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    mid = Column(Integer, unique=True)
    username = Column(String(100))
    avatar = Column(String(500))
    sessdata = Column(Text)
    bili_jct = Column(Text)
    dedeuserid = Column(Integer)
    is_active = Column(Boolean)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    last_refresh_time = Column(DateTime)
```

### Task

```python
class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(String(36), primary_key=True
    media_type = Column(String(20))
    media_id = Column(String(50))
    title = Column(String(500))
    quality = Column(Integer)
    status = Column(String(20))
    progress = Column(Float)
    stage = Column(String(20))
    created_at = Column(DateTime)
```

### Scheduler

```python
class Scheduler(Base):
    __tablename__ = "schedulers"
    
    id = Column(String(36), primary_key=True)
    name = Column(String(100))
    media_type = Column(String(20))
    media_id = Column(String(50))
    schedule_type = Column(String(20))
    interval_minutes = Column(Integer)
    status = Column(String(20))
    created_at = Column(DateTime)
```

### Setting

```python
class Setting(Base):
    __tablename__ = "settings"
    
    key = Column(String(100), primary_key=True)
    value = Column(Text)
    updated_at = Column(DateTime)
```

**关键文件**：
- `apps/api/src/models/*.py`

---

[返回上级](./README.md)