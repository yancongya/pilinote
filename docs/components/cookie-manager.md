# CookieManager Cookie 管理

## 概述

Cookie 管理服务，负责存储、更新和刷新 Bilibili 身份验证 Cookie。

## 文件位置

`apps/api/src/services/cookie_manager.py`

## 主要功能

### Cookie 存储

| 方法 | 说明 |
|------|------|
| `save_cookies()` | 保存 cookies |
| `set_cookie()` | 设置单个 cookie |
| `get_cookie()` | 获取单个 cookie |
| `get_cookies()` | 获取所有 cookies |

### Token 管理

| 方法 | 说明 |
|------|------|
| `save_refresh_token()` | 保存 refresh_token |
| `get_refresh_token()` | 获取 refresh_token |
| `set_refresh_token()` | 设置 refresh_token |

### 数据库操作

| 方法 | 说明 |
|------|------|
| `save_to_db()` | 保存到数据库 |
| `load_from_db()` | 从数据库加载 |
| `delete_from_db()` | 从数据库删除 |

## 使用方式

```python
from src.services.cookie_manager import CookieManager

# 创建实例
cm = CookieManager()

# 保存 cookies
cm.save_cookies({
    "SESSDATA": "xxx",
    "bili_jct": "xxx"
})

# 获取 cookies
cookies = cm.get_cookies()
```

## 数据结构

### 存储的 Cookie

```python
{
    "SESSDATA": "xxx",
    "bili_jct": "xxx",
    "DedeUserID": "xxx",
    "DedeUserID__ckMd5": "xxx",
    "sid": "xxx"
}
```

## 关联服务

- [HeadersManager](headers-manager.md) - 请求头管理
- [BilibiliService](bilibili-service.md) - Bilibili API 服务

---

[返回上级](./README.md)