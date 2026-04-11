# 多账号管理

## 功能

- 多个 Bilibili 账号登录和切换
- 每个账号的 Cookie 独立存储

## API

### 获取账号列表

```
GET /api/auth/accounts
```

### 切换账号

```
POST /api/auth/accounts/switch
Body: { "account_id": 1 }
```

### 刷新账号

```
POST /api/auth/accounts/refresh
Body: { "account_id": 1 }
```

### 删除账号

```
DELETE /api/auth/accounts/{account_id}
```

## 刷新服务

### 启动自动刷新

```
POST /api/auth/accounts/refresh/start
```

### 停止自动刷新

```
POST /api/auth/accounts/refresh/stop
```

**关键文件**：
- `apps/api/src/routers/auth.py` - 账号管理路由
- `apps/api/src/services/account_refresh_service.py` - 刷新服务

---

[返回上级](./README.md)