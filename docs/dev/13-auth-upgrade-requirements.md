# 认证系统升级需求

## 背景

通过对比BiliTools和PiliNote的登录功能实现，发现PiliNote当前缺少一些关键功能，需要升级以达到BiliTools的完整功能水平。

## 当前实现情况

### ✅ 已实现（与BiliTools一致）

1. **HeadersManager全局管理**
   - ✅ 全局HEADERS单例模式
   - ✅ 自动管理cookie刷新
   - ✅ 设备指纹管理（buvid3, buvid4, bili_ticket, _uuid）

2. **扫码登录**
   - ✅ 二维码生成
   - ✅ 轮询状态查询
   - ✅ 自动提取refresh_token

3. **短信登录**
   - ✅ Geetest验证码集成
   - ✅ 短信发送
   - ✅ 验证码登录

4. **SESSDATA登录**
   - ✅ 手动输入cookie
   - ✅ 自动提取用户信息

### ❌ 缺失功能（需要升级）

## 升级需求

### 优先级 1：核心功能（必需）

#### 1.1 refresh_token自动刷新机制

**问题描述**：
- 当前Cookie过期后无法自动续期
- 缺少使用refresh_token刷新cookie的功能
- 用户需要重新登录

**BiliTools实现**：
```rust
pub async fn refresh_cookie(refresh_csrf: String) -> TauriResult<isize> {
    let refresh_token_resp = client
        .post("https://passport.bilibili.com/x/passport-login/web/cookie/refresh")
        .query(&[
            ("csrf", bili_csrf),
            ("refresh_csrf", &refresh_csrf),
            ("refresh_token", refresh_token),
            ("source", "main_web"),
        ])
        .send()
        .await?;
}
```

**需求**：
- [ ] 实现refresh_token刷新接口
- [ ] 自动检测cookie是否过期
- [ ] 过期时自动调用刷新接口
- [ ] 更新新的refresh_token和cookies
- [ ] 刷新失败时提示用户重新登录

**API端点**：
```
POST /api/auth/refresh-cookie
```

**相关文件**：
- `apps/api/src/services/bilibili.py` - 添加refresh_cookie方法
- `apps/api/src/routers/auth.py` - 添加refresh-cookie路由

---

#### 1.2 Cookie持久化

**问题描述**：
- Cookie当前使用内存存储
- 应用重启后Cookie丢失
- 用户需要重新登录

**BiliTools实现**：
```rust
// 存储到SQLite数据库
cookies::insert(cookie).await?;
cookies::load().await?
```

**需求**：
- [ ] 实现Cookie数据库持久化
- [ ] 应用启动时自动加载Cookie
- [ ] Cookie更新时同步保存到数据库
- [ ] 支持Cookie加密存储（可选）

**数据库设计**：
```sql
CREATE TABLE cookies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    domain TEXT,
    path TEXT,
    expires_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

**相关文件**：
- `apps/api/src/database.py` - 添加Cookie表
- `apps/api/src/services/cookie_manager.py` - 添加持久化方法
- `apps/api/src/models/cookie.py` - 新建Cookie模型

---

#### 1.3 退出登录功能

**问题描述**：
- 没有退出登录功能
- 无法通知B站账号已登出
- Cookie清理不完整

**BiliTools实现**：
```rust
pub async fn exit() -> TauriResult<isize> {
    let response = client
        .post("https://passport.bilibili.com/login/exit/v2")
        .query(&[("biliCSRF", bili_csrf)])
        .send()
        .await?;
    // 清理本地cookie
}
```

**需求**：
- [ ] 实现退出登录接口
- [ ] 通知B站账号登出
- [ ] 清理本地Cookie
- [ ] 更新前端登录状态

**API端点**：
```
POST /api/auth/logout
```

**相关文件**：
- `apps/api/src/services/bilibili.py` - 添加logout方法
- `apps/api/src/routers/auth.py` - 添加logout路由
- `apps/web/src/services/api.ts` - 添加logout方法
- `apps/web/src/stores/auth.ts` - 添加logout状态管理

---

### 优先级 2：增强功能（重要）

#### 2.1 多账号管理

**问题描述**：
- 只支持单个账号
- 没有账号切换功能
- Cookie存储不区分账号

**BiliTools实现**：
- ✅ 支持多个B站账号切换
- ✅ 每个账号独立的cookie存储
- ✅ 账号切换无需重新登录

**需求**：
- [ ] 实现多账号数据模型
- [ ] 添加账号切换功能
- [ ] 每个账号独立的Cookie存储
- [ ] 显示当前登录账号信息
- [ ] 账号列表管理

**数据库设计**：
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mid INTEGER UNIQUE NOT NULL,
    username TEXT NOT NULL,
    avatar TEXT,
    is_active INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

**API端点**：
```
GET  /api/auth/accounts       - 获取账号列表
POST /api/auth/accounts/switch - 切换账号
DEL  /api/auth/accounts/:id   - 删除账号
```

**相关文件**：
- `apps/api/src/models/user.py` - 更新User模型
- `apps/api/src/services/bilibili.py` - 添加账号管理方法
- `apps/api/src/routers/auth.py` - 添加账号管理路由
- `apps/web/src/pages/HomePage.tsx` - 添加账号切换UI

---

#### 2.2 登录状态检测

**问题描述**：
- 没有登录状态检测
- Cookie失效用户无感知
- 没有账号信息显示

**BiliTools实现**：
- ✅ 定期检测登录状态
- ✅ Cookie失效自动提示重新登录
- ✅ 显示当前登录账号信息

**需求**：
- [ ] 实现登录状态检测接口
- [ ] 定时检查Cookie有效性
- [ ] Cookie失效时通知用户
- [ ] 显示当前登录用户信息
- [ ] 前端实时状态更新

**API端点**：
```
GET /api/auth/status - 获取登录状态
```

**相关文件**：
- `apps/api/src/services/bilibili.py` - 添加check_login_status方法
- `apps/api/src/routers/auth.py` - 添加status路由
- `apps/web/src/stores/auth.ts` - 添加状态管理

---

#### 2.3 定时刷新任务

**问题描述**：
- Cookie没有自动刷新
- 用户需要手动重新登录
- 体验不友好

**BiliTools实现**：
- ✅ 后台定时任务检查Cookie
- ✅ 过期前自动刷新
- ✅ 无需用户干预

**需求**：
- [ ] 实现后台定时任务
- [ ] 定期检查Cookie有效期
- [ ] 过期前自动调用刷新
- [ ] 刷新失败时通知用户
- [ ] 任务可配置（间隔、启用/禁用）

**配置项**：
```python
# config.py
AUTO_REFRESH_COOKIE = True
COOKIE_REFRESH_INTERVAL = 3600  # 1小时
COOKIE_REFRESH_BEFORE_EXPIRY = 86400  # 提前1天刷新
```

**相关文件**：
- `apps/api/src/config.py` - 添加配置项
- `apps/api/main.py` - 添加定时任务启动
- `apps/api/src/services/headers_manager.py` - 添加自动刷新逻辑

---

### 优先级 3：优化功能（可选）

#### 3.1 Headers同步机制

**问题描述**：
- Headers更新后没有通知机制
- 前端无法实时获取最新的headers
- 没有事件系统

**BiliTools实现**：
```rust
pub async fn refresh(&self) -> Result<()> {
    // 刷新headers后通知前端
    let headers: HeadersData = serde_json::from_value(serde_json::to_value(&*map)?)?;
    drop(map);
    let app = get_app_handle();
    headers.emit(app)?;
}
```

**需求**：
- [ ] 实现WebSocket或SSE事件通知
- [ ] Headers更新时通知前端
- [ ] 前端订阅Headers更新事件
- [ ] 实时更新请求headers

**技术方案**：
- 使用WebSocket实现实时通知
- 或使用Server-Sent Events (SSE)

**相关文件**：
- `apps/api/main.py` - 添加WebSocket支持
- `apps/api/src/services/headers_manager.py` - 添加事件通知
- `apps/web/src/services/api.ts` - 添加WebSocket客户端

---

#### 3.2 登录日志

**问题描述**：
- 没有登录操作记录
- 无法追溯登录历史
- 难以排查问题

**需求**：
- [ ] 记录所有登录操作
- [ ] 记录登出操作
- [ ] 记录Cookie刷新操作
- [ ] 记录失败操作和错误信息
- [ ] 提供日志查询接口

**数据库设计**：
```sql
CREATE TABLE auth_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT NOT NULL,  -- login, logout, refresh, error
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    status TEXT,  -- success, failed
    error_message TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

**相关文件**：
- `apps/api/src/models/auth_log.py` - 新建日志模型
- `apps/api/src/services/bilibili.py` - 添加日志记录
- `apps/api/src/routers/auth.py` - 添加日志查询路由

---

## 实施计划

### 阶段1：核心功能（1-2天）
1. ✅ 实现refresh_token自动刷新
2. ✅ 添加Cookie持久化
3. ✅ 实现退出登录功能

### 阶段2：增强功能（2-3天）
4. ✅ 实现多账号管理
5. ✅ 添加登录状态检测
6. ✅ 实现定时刷新任务

### 阶段3：优化功能（1-2天）
7. ✅ 添加Headers同步机制
8. ✅ 实现登录日志
9. ✅ 前端UI适配

### 阶段4：测试和文档（1天）
10. ✅ 单元测试
11. ✅ 集成测试
12. ✅ 更新用户文档

## 验收标准

### 功能验收
- [ ] Cookie过期后能自动刷新
- [ ] 应用重启后Cookie保持登录状态
- [ ] 能正常退出登录
- [ ] 支持多个账号切换
- [ ] 登录状态实时检测
- [ ] 定时任务正常运行

### 性能验收
- [ ] Cookie刷新响应时间 < 2s
- [ ] Cookie持久化不影响登录速度
- [ ] 定时任务不占用过多资源

### 安全验收
- [ ] Cookie加密存储
- [ ] refresh_token安全传输
- [ ] 退出登录清理完整
- [ ] 登录日志记录完整

## 风险和注意事项

### 技术风险
1. **refresh_token失效**：refresh_token也可能过期，需要提示用户重新登录
2. **并发问题**：多个请求同时刷新cookie可能导致冲突
3. **数据库性能**：频繁的cookie读写可能影响性能

### 解决方案
1. 实现重试机制和降级策略
2. 使用锁机制保证原子性
3. 使用缓存减少数据库访问

### 注意事项
1. 向后兼容：不影响现有登录方式
2. 用户体验：升级过程对用户透明
3. 错误处理：所有异常都要有友好的提示

## 参考文档

- [BiliTools登录实现](../../reference/BiliTools/src-tauri/src/services/login.rs)
- [B站API文档](https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/login/login_action.md)
- [现有认证方案](01-auth-solution.md)

## 更新日志

### 2026-03-30
- 创建升级需求文档
- 详细对比BiliTools和PiliNote功能差异
- 制定分阶段实施计划
- 定义验收标准和风险控制