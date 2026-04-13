# API 端点

## 基础信息

- **Base URL**: `http://localhost:8000`
- **WebSocket**: `ws://localhost:8000/ws`

## 认证接口

| 方法 | 路径 | 参数 | 说明 |
|------|------|------|------|
| POST | `/api/auth/init` | - | 初始化指纹系统 |
| POST | `/api/auth/refresh/cookies` | - | 检查并刷新 Cookie |
| GET | `/api/auth/captcha/params` | - | 获取极验验证码参数 |
| POST | `/api/auth/captcha/validate` | - | 验证极验验证码 |
| POST | `/api/auth/sms/send` | - | 发送手机验证码 |
| GET | `/api/auth/qrcode` | - | 获取登录二维码 |
| GET | `/api/auth/qrcode/status/{qrcode_key}` | - | 查询二维码状态 |
| POST | `/api/auth/sessdata` | - | SESSDATA 登录 |
| POST | `/api/auth/password` | - | 密码登录 |
| POST | `/api/auth/sms/login` | - | 手机验证码登录 |
| GET | `/api/auth/user-info` | sessdata | 获取用户信息 |
| GET | `/api/auth/proxy/avatar` | url | 代理获取头像 |
| POST | `/api/auth/refresh-cookie` | - | 刷新 Cookie |
| POST | `/api/auth/logout` | - | 登出 |
| GET | `/api/auth/status` | - | 获取登录状态 |
| GET | `/api/auth/accounts` | - | 获取账号列表 |
| GET | `/api/auth/accounts/{id}/credentials` | - | 获取验证数据 |
| POST | `/api/auth/accounts/switch` | `?account_id=1` | 切换账号 |
| POST | `/api/auth/accounts/refresh` | `?account_id=1` | 刷新账号 |
| DELETE | `/api/auth/accounts/{id}` | - | 删除账号 |
| GET | `/api/auth/accounts/refresh/status` | - | 获取刷新服务状态 |
| POST | `/api/auth/accounts/refresh/start` | `?interval=3600` | 启动刷新服务 |
| POST | `/api/auth/accounts/refresh/stop` | - | 停止刷新服务 |

## 视频接口

### 收藏夹接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/favorites/folders` | 获取收藏夹列表 |
| GET | `/api/favorites/folders/{folder_id}` | 获取收藏夹详情 |
| GET | `/api/favorites/collected` | 获取订阅的收藏夹 |

**收藏夹列表**：`GET /api/favorites/folders`
- 参数：
  - `page`: 页码（默认 1）
  - `page_size`: 每页数量（默认 20，最大 100）

**收藏夹详情**：`GET /api/favorites/folders/{folder_id}`
- 参数：
  - `page`: 页码（默认 1）
  - `page_size`: 每页数量（默认 20，最大 100）
  - `keyword`: 搜索关键词（默认空）
  - `order`: 排序方式（mtime=收藏时间, pubtime=发布时间, view=播放量, cweight=收藏权重）
  - `type`: 类型筛选（0=全部, 2=视频, 21=音频, 12=文章）
  - `tid`: 分区 ID（默认 0）

**订阅收藏夹**：`GET /api/favorites/collected`
- 参数：
  - `sessdata`: 用户 SESSDATA
  - `up_mid`: 用户 mid
  - `page`: 页码（默认 1）
  - `page_size`: 每页数量（默认 20，最大 100）

### 其他视频接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/watchlater` | 获取稍后再看 |
| GET | `/api/video/{id}` | 获取视频详情 |

## 媒体接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/media/{media_type}/{media_id}` | 获取媒体信息（统一接口） |
| GET | `/api/media/favorites/{fid}` | 获取收藏夹媒体信息 |
| GET | `/api/media/watchlater` | 获取稍后再看媒体信息 |

### 媒体类型支持

| 类型 | 参数示例 | 说明 |
|------|----------|------|
| video | `BV1xx411c7mD` | 普通视频 |
| opus | `123456789` | 图文专栏 |
| bangumi | `ep123456` | 番剧 |
| lesson | `https://www.bilibili.com/cheese/play/ss292774372` | 课程（需完整URL） |
| music | `au123456` | 音乐（暂未实现） |

## 下载解析接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/download/parse` | 解析下载URL（支持视频、图文、课程、番剧等） |

### 解析请求示例

```json
// 图文解析
{ "url": "cv123456789" }

// 视频解析
{ "url": "BV1xx411c7mD" }

// 视频URL解析
{ "url": "https://www.bilibili.com/video/BV1xx411c7mD" }

// 课程解析（推荐使用完整URL）
{ "url": "https://www.bilibili.com/cheese/play/ss292774372" }

// 课程解析（支持带参数）
{ "url": "https://www.bilibili.com/cheese/play/ss292774372?csource=common_myclass_purchasedlecture_null" }

// 番剧解析
{ "url": "https://www.bilibili.com/bangumi/play/ss42099" }
```

### 课程链接注意事项

- **推荐使用完整URL**：`https://www.bilibili.com/cheese/play/ss{id}`
- **支持带参数的链接**：系统会自动去除 URL 参数
- **纯ID不推荐**：`ss292774372` 默认识别为番剧，无法区分课程
- **需要购买**：课程为付费内容，需要购买后才能下载
- **需要登录**：必须提供有效的 SESSDATA

## 下载接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/queue` | 获取下载队列 |
| POST | `/api/queue/add` | 添加任务 |
| POST | `/api/queue/{id}/control` | 控制任务 |
| DELETE | `/api/queue/{id}` | 删除任务 |
| GET | `/api/queue/schedulers` | 获取调度器 |
| POST | `/api/queue/schedulers` | 创建调度器 |
| POST | `/api/queue/schedulers/{id}/start` | 启动调度器 |

## 设置接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/settings` | 获取所有设置 |
| PUT | `/api/settings` | 更新设置 |
| POST | `/api/settings/reset` | 重置设置 |
| GET | `/api/settings/list` | 获取设置列表 |
| GET | `/api/settings/export` | 导出设置 |
| POST | `/api/settings/import` | 导入设置 |
| GET | `/api/settings/tool-status` | 获取工具状态 |
| GET | `/api/settings/storage-info` | 获取存储信息 |
| GET | `/api/settings/cache-info` | 获取缓存信息 |
| POST | `/api/settings/clear-cache/{type}` | 清理缓存 |
| POST | `/api/settings/open-cache/{type}` | 打开缓存目录 |
| GET | `/api/settings/database/info` | 获取数据库信息 |
| GET | `/api/settings/database/export` | 导出数据库 |
| POST | `/api/settings/database/import` | 导入数据库 |
| POST | `/api/settings/ftp/test` | 测试FTP连接 |
| POST | `/api/settings/backup/download` | 备份下载目录 |
| POST | `/api/settings/backup/database` | 备份数据库 |
| POST | `/api/settings/cleanup/trigger` | 手动触发清理 |
| GET | `/api/settings/cleanup/status` | 获取清理状态 |

---

## WebSocket 接口

| 路径 | 说明 |
|------|------|
| `/ws` | WebSocket 连接，用于实时下载进度 |

---

[返回上级](./README.md)