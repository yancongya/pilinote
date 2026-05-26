# HeadersManager 请求头管理

## 概述

全局请求头管理器，管理所有 HTTP 请求的 headers 和 cookies。

## 文件位置

`apps/api/src/services/headers_manager.py`

## 核心功能

### Cookie 管理

| 方法 | 说明 |
|------|------|
| `update_cookie()` | 更新单个 cookie |
| `update_cookies()` | 批量更新 cookies |
| `get_cookies()` | 获取当前 cookies |
| `check_and_refresh_cookies()` | 检查并刷新 cookie |

### Headers 管理

| 方法 | 说明 |
|------|------|
| `get_headers()` | 获取请求头 |
| `get_client()` | 获取配置好的 HTTP 客户端 |

### 初始化

| 方法 | 说明 |
|------|------|
| `init()` | 初始化 Headers 系统 |

## 内部组件

### 基础 Headers

```python
self.base_headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
    "Referer": "https://www.bilibili.com/",
    "Origin": "https://www.bilibili.com",
    "Accept": "application/json, text/plain, */*",
    # ...
}
```

### 依赖服务

- FingerprintManager：当前仓库未提供独立文档条目（如后续引入指纹/设备伪装模块，建议在 `apps/docs/docs-dev/components/` 补齐并统一命名）
- [CookieManager](cookie-manager.md) - Cookie 存储
- GeetestService：当前仓库未提供独立文档条目（如后续接入极验流程，建议补齐对应文档与入口说明）

## 单例模式

```python
from src.services.headers_manager import get_headers_manager

# 获取单例
headers_manager = get_headers_manager()

# 获取 headers
headers = await headers_manager.get_headers()

# 更新 cookie
await headers_manager.update_cookie("SESSDATA", sessdata)
```

## 关联服务

- [BilibiliService](bilibili-service.md) - Bilibili API 服务
- [CookieManager](cookie-manager.md) - Cookie 管理

---

[返回上级](./README.md)
