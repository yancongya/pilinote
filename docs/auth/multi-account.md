# 多账号管理

---
关联文档:
  - login-flow.md       # 登录流程
  - cookies.md         # Cookie 管理
  - database/models.md  # User 模型
涉及文件:
  - apps/api/src/routers/auth.py
  - apps/api/src/services/account_refresh_service.py
  - apps/web/src/stores/auth.ts
  - apps/web/src/pages/settings/AccountsSettings.tsx
依赖服务:
  - BilibiliService
  - HeadersManager
  - AccountRefreshService
---

## 功能

- 多个 Bilibili 账号登录和切换
- 每个账号的 Cookie 独立存储
- 登录状态 / 游客状态切换

---

## 登录/游客状态切换

### 前端状态管理

```typescript
// apps/web/src/stores/auth.ts

interface AuthState {
  user: User | null;           // 当前用户
  isAuthenticated: boolean;   // 是否已登录
  isLoading: boolean;         // 加载状态
}
```

### 状态流转

```
┌────────────────────────────────────────────────────────────┐
│                    状态转换图                          │
├────────────────────────────────────────────────────────────┤
│                                                      │
│   未登录(游客) ←────────────────────────────────┐    │
│       │                                          │    │
│       │ fetchUser() 返回 is_logged_in: false      │    │
│       ↓                                          │    │
│   登录中 ──→ 登录成功 ──→ 已登录                 │    │
│       │                    │                    │    │
│       │                    │ logout()         │    │
│       ↓                    ↓                  │    │
│   登录失败 ───────────────────────────────────→ 游客 │
│                                                      │
└────────────────────────────────────────────────────────────┘
```

### API 状态验证

```
GET /api/auth/status
    ↓
返回: { is_logged_in: true/false, user: {...} }
```

- `is_logged_in: true` → 已登录，显示用户信息
- `is_logged_in: false` → 游客，调用 logout() 清除本地状态

---

## 多账号管理

### 账号列表获取

```
GET /api/auth/accounts

响应: {
  "success": true,
  "data": {
    "accounts": [
      {
        "id": 1,
        "mid": 123456,
        "username": "用户名",
        "avatar": "头像URL",
        "is_active": true,
        "created_at": "2024-01-01T00:00:00",
        "last_refresh_time": "2024-01-01T00:00:00"
      }
    ],
    "total": 1
  }
}
```

### 切换账号

```
POST /api/auth/accounts/switch?account_id=1
```

**实际路径**: query 参数，非 body

流程:
1. 查找目标账号 (User)
2. **所有账号 is_active 设为 false**
3. 目标账号 is_active 设为 true
4. 清除当前 Cookie
5. 加载目标账号 Cookie 到内存
6. 刷新 HeadersManager
7. 返回新账号信息

### 删除账号

```
DELETE /api/auth/accounts/{account_id}
```

流程:
1. 查找目标账号
2. 如果是活跃账号，清除 Cookie
3. 删除 User 记录
4. 删除该账号的所有 Cookie 记录

### 刷新账号

**支持两种参数格式**：

1. **查询参数**（推荐）：
```
POST /api/auth/accounts/refresh?account_id=1
```

2. **路径参数**（兼容）：
```
POST /api/auth/accounts/1/refresh
```

> 说明：后端同时支持查询参数和路径参数两种格式，前端可以根据需要选择使用哪种方式。

---

## 前端账号管理界面

### 账号设置页面

**文件**: `apps/web/src/pages/settings/AccountsSettings.tsx`

### 功能

- 显示已登录账号列表
- 显示当前账号标记
- 切换账号按钮
- 刷新账号按钮
- 删除账号按钮
- 查看验证数据（Cookies、WBI）
- 游客模式切换
- 添加新账号

### 界面结构

```
已登录账号
├── [头像] 用户名 (当前)    切换  刷新  查看  删除
├── [头像] 用户名           切换  刷新  查看  删除

其他
└── [头像] 游客模式 ← 点击切换到未登录状态

添加新账号 [+]
退出登录 [垃圾桶]
```

---

## 刷新服务

### 启动自动刷新

```
POST /api/auth/accounts/refresh/start?interval=3600

参数: interval 刷新间隔(秒)，默认 3600
```

### 停止自动刷新

```
POST /api/auth/accounts/refresh/stop
```

### 获取刷新状态

```
GET /api/auth/accounts/refresh/status
```

---

## 数据库存储

```
┌──────────────┐       ┌──────────────┐
│    users    │       │   cookies   │
├──────────────┤       ├──────────────┤
│ id (PK)     │──┐    │ id (PK)    │
│ mid         │  │    │ user_id    │
│ username    │  └───<│ name      │
│ avatar      │       │ value     │
│ sessdata    │       │ domain    │
│ bili_jct   │       │ path      │
│ is_active  │       │ expires   │
│ last_      │       └──────────────┘
│ refresh_   │
│ time      │
└──────────────┘
```

- `is_active`: 标记当前活跃账号（只能有一个为 true）
- `last_refresh_time`: 上次刷新时间，用于自动刷新判断

---

[返回上级](./README.md)