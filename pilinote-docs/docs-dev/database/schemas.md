# API Schema

## 请求模型

### LoginRequest

```python
class LoginRequest(BaseModel):
    sessdata: Optional[str] = None
    qrcode_key: Optional[str] = None
```

### TaskCreate

```python
class TaskCreate(BaseModel):
    media_type: str
    media_id: str
    title: Optional[str] = None
    quality: int = Field(default=80, ge=16, le=116)
```

### SettingsUpdate

```python
class SettingsUpdate(BaseModel):
    download_path: Optional[str] = None
    temp_path: Optional[str] = None
    max_concurrent: Optional[int] = None
```

## 响应模型

### UserResponse

```python
class UserResponse(BaseModel):
    id: int
    mid: int
    username: str
    avatar: str
    is_active: bool

### TaskResponse

```python
class TaskResponse(BaseModel):
    id: str
    media_type: str
    media_id: str
    title: str
    status: str
    progress: float
    stage: str
    created_at: int
```

**关键文件**：
- `apps/api/src/schemas/*.py`

---

[返回上级](./README.md)