# 项目结构

## 目录结构
```
pilinote/
├── apps/                    # 应用目录
│   ├── api/                # 后端API服务
│   │   ├── src/
│   │   │   ├── config.py          # 配置管理
│   │   │   ├── database.py        # 数据库连接
│   │   │   ├── main.py            # FastAPI主应用
│   │   │   ├── models/            # 数据模型（Model层）
│   │   │   │   ├── user.py        # 用户模型
│   │   │   │   ├── video.py       # 视频模型
│   │   │   │   ├── download.py    # 下载任务模型
│   │   │   │   └── settings.py    # 设置模型
│   │   │   ├── schemas/           # Pydantic模式
│   │   │   │   ├── login.py       # 登录模式
│   │   │   │   ├── video.py       # 视频模式
│   │   │   │   ├── download.py    # 下载模式
│   │   │   │   └── settings.py    # 设置模式
│   │   │   ├── routers/           # API路由（Controller层）
│   │   │   │   ├── auth.py        # 认证路由
│   │   │   │   ├── video.py       # 视频路由
│   │   │   │   ├── favorites.py   # 收藏夹路由
│   │   │   │   ├── watchlater.py  # 稍后再看路由
│   │   │   │   ├── download.py    # 下载路由
│   │   │   │   └── settings.py    # 设置路由
│   │   │   ├── controllers/       # 业务控制器（Controller层）
│   │   │   │   ├── auth_controller.py      # 认证控制器
│   │   │   │   ├── video_controller.py     # 视频控制器
│   │   │   │   ├── download_controller.py  # 下载控制器
│   │   │   │   └── settings_controller.py  # 设置控制器
│   │   │   ├── services/          # 服务层（Service层）
│   │   │   │   ├── authenticate/  # 认证服务
│   │   │   │   │   ├── bilibili_login.py  # B站登录
│   │   │   │   │   ├── qrcode.py          # 二维码
│   │   │   │   │   └── password.py       # 密码登录
│   │   │   │   ├── bilibili/      # B站API服务
│   │   │   │   │   ├── api.py            # B站API封装
│   │   │   │   │   ├── video.py         # 视频API
│   │   │   │   │   ├── favorites.py     # 收藏夹API
│   │   │   │   │   └── watchlater.py    # 稍后再看API
│   │   │   │   ├── download/     # 下载服务
│   │   │   │   │   ├── yt_dlp.py        # yt-dlp封装
│   │   │   │   │   ├── queue.py         # 任务队列
│   │   │   │   │   └── progress.py      # 进度管理
│   │   │   │   └── storage/      # 存储服务
│   │   │   │       ├── file_manager.py  # 文件管理
│   │   │   │       └── metadata.py     # 元数据处理
│   │   │   └── utils/             # 工具函数
│   │   │       ├── crypto.py      # 加密工具
│   │   │       ├── validator.py    # 数据验证
│   │   │       └── logger.py      # 日志工具
│   │   ├── requirements.txt       # Python依赖
│   │   ├── .env                   # 环境变量
│   │   ├── .env.example           # 环境变量示例
│   │   ├── pyproject.toml         # 项目配置
│   │   └── venv/                  # 虚拟环境
│   └── web/                # 前端Web应用（View层）
│       ├── src/
│       │   ├── main.tsx           # React入口
│       │   ├── App.tsx            # 主应用组件
│       │   ├── index.css          # 全局样式
│       │   ├── pages/             # 页面组件
│       │   │   ├── LoginPage.tsx  # 登录页面
│       │   │   ├── HomePage.tsx   # 主页面
│       │   │   ├── VideoDetailPage.tsx  # 视频详情页
│       │   │   └── SettingsPage.tsx     # 设置页面
│       │   ├── components/        # UI组件
│       │   │   ├── auth/         # 认证相关组件
│       │   │   ├── video/        # 视频相关组件
│       │   │   ├── download/     # 下载相关组件
│       │   │   └── settings/     # 设置相关组件
│       │   ├── services/          # API服务
│       │   │   └── api.ts         # API调用封装
│       │   ├── stores/            # 状态管理
│       │   │   ├── auth.ts        # 认证状态
│       │   │   └── settings.ts   # 设置状态
│       │   ├── hooks/             # 自定义Hooks
│       │   │   ├── useAuth.ts     # 认证Hook
│       │   │   └── useSettings.ts # 设置Hook
│       │   ├── types/             # TypeScript类型
│       │   │   ├── api.ts         # API类型
│       │   │   └── models.ts      # 数据模型类型
│       │   └── utils/             # 工具函数
│       │       ├── format.ts      # 格式化工具
│       │       └── validator.ts   # 验证工具
│       ├── index.html             # HTML入口
│       ├── package.json           # Node.js依赖
│       ├── package-lock.json      # 依赖锁定
│       ├── tsconfig.json          # TypeScript配置
│       └── vite.config.ts         # Vite配置
├── docs/                    # 文档
│   └── dev/                 # 开发文档
│       ├── 00-tech-stack.md           # 技术栈方案
│       ├── 01-auth-solution.md        # 认证方案
│       ├── 02-api-list.md             # API列表
│       ├── 03-download-engine.md      # 下载引擎方案
│       ├── 04-file-organization.md    # 文件组织方案
│       ├── 05-deployment.md           # 部署方案
│       ├── 06-project-structure.md    # 项目结构
│       ├── 07-development-roadmap.md  # 开发路线图
│       ├── 08-reference-projects.md   # 参考项目索引
│       ├── pilinote_architecture.drawio  # 系统架构图
│       └── README.md                   # 文档索引
├── reference/              # 参考项目
│   ├── pilipala/                  # Flutter B站客户端
│   ├── hermes/                    # 自托管视频下载器
│   ├── vidbee/                    # Electron视频下载器
│   ├── bilitool/                  # B站工具库（MVC架构参考）
│   ├── bilibili-downloader/       # B站下载器
│   └── bilibili-favlist-auto-downloader/  # 收藏夹自动下载
├── CHANGELOG.md            # 开发日志
├── AGENTS.md               # Agent配置
└── .gitignore              # Git忽略规则

```

## 架构设计（MVC模式）

基于bilitool的MVC架构设计，PiliNote采用三层架构：

### Model层（数据层）
- **数据库模型**: 定义数据表结构
- **Pydantic模式**: 数据验证和序列化
- **配置管理**: 应用配置和环境变量

### View层（表现层）
- **Web界面**: React组件和页面
- **移动端界面**: 响应式设计
- **状态管理**: Zustand状态管理

### Controller层（控制层）
- **路由处理**: API端点定义
- **业务控制器**: 业务逻辑编排
- **请求验证**: 参数验证和错误处理

### Service层（服务层）
- **B站API服务**: 封装B站API调用
- **下载服务**: yt-dlp封装和任务管理
- **存储服务**: 文件管理和元数据处理
- **认证服务**: 用户认证和授权

### Utility层（工具层）
- **加密工具**: 密码加密和数据安全
- **格式化工具**: 数据格式转换
- **验证工具**: 数据验证和清洗
- **日志工具**: 日志记录和错误追踪

## 模块划分

### 认证模块（已实现）
- **功能**: 用户登录、认证管理
- **组件**:
  - 扫码登录（推荐）
  - SESSDATA登录（快速开发）
  - 密码登录（需要验证码）
  - 用户信息获取
- **API端点**:
  - `GET /api/auth/qrcode` - 获取登录二维码
  - `GET /api/auth/qrcode/status/{qrcode_key}` - 查询二维码状态
  - `POST /api/auth/sessdata` - SESSDATA登录
  - `POST /api/auth/password` - 密码登录
  - `GET /api/auth/user-info` - 获取用户信息
  - `GET /api/auth/proxy/avatar` - 头像代理

### 视频源模块（已实现）
- **功能**: 收藏夹、稍后再看、视频详情
- **组件**:
  - 收藏夹列表和详情
  - 稍后再看列表
  - 视频详情展示
- **API端点**:
  - `GET /api/favorites/folders` - 获取收藏夹列表
  - `GET /api/favorites/folders/{folder_id}` - 获取收藏夹详情
  - `GET /api/watchlater/list` - 获取稍后再看列表
  - `GET /api/video/{video_id}` - 获取视频详情

### 下载模块（已实现80%）
- **功能**: 任务队列、进度管理、文件下载、课程支持
- **组件**:
  - yt-dlp下载引擎 ✅
  - 异步下载服务 ✅
  - 任务队列管理 ✅
  - 进度追踪 ✅
  - App风格UI界面 ✅
  - 系列视频分组 ✅
  - 课程下载支持 ✅
  - 链接智能解析 ✅
  - 断点续传（计划中）
- **API端点**:
  - POST /api/download/start - 创建下载任务 ✅
  - POST /api/download/parse - 解析下载链接 ✅
  - GET /api/download/list - 获取下载列表 ✅
  - DELETE /api/download/{id} - 删除下载任务 ✅
  - POST /api/download/{id}/cancel - 取消下载 ✅
  - POST /api/download/{id}/retry - 重试下载 ✅
  - GET /api/download/progress/{id} - 获取下载进度（计划中）

### 文件模块（待实现）
- **功能**: 文件组织、元数据管理、字幕弹幕
- **组件**:
  - 文件管理器
  - 元数据编辑器
  - 字幕/弹幕下载
- **API端点**:
  - `GET /api/files/list` - 获取文件列表
  - `POST /api/files/metadata` - 保存元数据
  - `GET /api/files/subtitle/{video_id}` - 获取字幕
  - `GET /api/files/danmaku/{video_id}` - 获取弹幕

### 用户模块（待实现）
- **功能**: 账号管理、设置管理
- **组件**:
  - 多账号管理
  - 用户设置
  - 偏好配置
- **API端点**:
  - `GET /api/user/profile` - 获取用户资料
  - `GET /api/user/settings` - 获取用户设置
  - `PUT /api/user/settings` - 更新用户设置
  - `GET /api/user/accounts` - 获取账号列表
  - `POST /api/user/accounts` - 添加账号
  - `DELETE /api/user/accounts/{id}` - 删除账号

## 后端API结构

### 认证路由 (`/api/auth`)
```python
from src.routers.auth import router as auth_router
app.include_router(auth_router)
```

### 视频源路由
```python
from src.routers.favorites import router as favorites_router
from src.routers.watchlater import router as watchlater_router
from src.routers.video import router as video_router

app.include_router(favorites_router)
app.include_router(watchlater_router)
app.include_router(video_router)
```

### 下载路由
```python
from src.routers.download import router as download_router
app.include_router(download_router)
```

### 数据库模型

#### User模型（已实现）
```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    mid = Column(BigInteger, unique=True, nullable=False)  # B站用户ID
    username = Column(String(100), nullable=False)
    avatar = Column(String(500))
    level = Column(Integer, default=0)
    vip_status = Column(Boolean, default=False)
    sessdata = Column(String(500))  # B站会话令牌
    bili_jct = Column(String(100))   # CSRF token
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

#### Download模型（已实现）
```python
class Download(Base):
    __tablename__ = "downloads"
    
    id = Column(String, primary_key=True)  # 下载任务ID (UUID)
    bvid = Column(String(20), nullable=False, index=True)  # B站视频ID
    title = Column(String(500))  # 视频标题
    
    # 任务状态
    status = Column(
        Enum("pending", "queued", "downloading", "processing", "completed", "failed", "cancelled", 
             name="download_status"),
        default="pending",
        index=True
    )
    progress = Column(Float, default=0.0)  # 下载进度 0.0 - 100.0
    
    # 进度追踪
    downloaded_bytes = Column(Integer, default=0)  # 已下载字节数
    total_bytes = Column(Integer, default=0)  # 总字节数
    download_speed = Column(Float, default=0.0)  # 下载速度 (KB/s)
    eta = Column(Float, default=0.0)  # 预计剩余时间 (秒)
    
    # B站特定字段
    cid = Column(Integer)  # 视频CID
    aid = Column(Integer)  # 视频AID
    quality = Column(Integer, default=64)  # 视频质量
    output_format = Column(String(10), default="mp4")  # 输出格式
    
    # 元数据
    thumbnail_url = Column(String(500))  # 视频封面URL
    duration = Column(Integer)  # 视频时长 (秒)
    uploader = Column(String(100))  # UP主名称
    uploader_mid = Column(Integer)  # UP主 MID
    
    # 文件管理
    file_path = Column(String(500))  # 文件保存路径
    file_size = Column(Integer, default=0)  # 文件大小
    
    # 错误处理
    error_message = Column(Text)  # 错误信息
    retry_count = Column(Integer, default=0)  # 重试次数
    
    # 用户关联
    sessdata = Column(Text)  # 用户SESSDATA (用于认证)
    
    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

#### Settings模型（待实现）
```python
class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    
    # 下载设置
    download_quality = Column(Integer, default=64)  # 64=1080P
    download_format = Column(String(10), default='mp4')
    download_danmaku = Column(Boolean, default=False)
    download_subtitle = Column(Boolean, default=True)
    audio_only = Column(Boolean, default=False)
    max_concurrent = Column(Integer, default=3)
    download_path = Column(String(1000))
    
    # 网络设置
    proxy = Column(String(500))
    timeout = Column(Integer, default=30)
    retry_times = Column(Integer, default=3)
    
    # 通用设置
    theme = Column(String(10), default='light')
    language = Column(String(10), default='zh')
    auto_refresh = Column(Boolean, default=True)
    notification = Column(Boolean, default=True)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = relationship("User", back_populates="settings")
```

## 前端结构

### 页面组件
- `LoginPage` - 登录页面
- `HomePage` - 主页面（包含所有tab页面）
- `VideoDetailPage` - 视频详情页面
- `SettingsPage` - 设置页面（待实现）

### 子组件
#### 认证组件
- `QrcodeLogin` - 扫码登录
- `SessdataLogin` - SESSDATA登录
- `PasswordLogin` - 密码登录

#### 视频组件
- `VideoCard` - 视频卡片
- `VideoThumbnail` - 视频缩略图
- `VideoProgressBar` - 视频进度条

#### 下载组件
- `DownloadItem` - 下载项目
- `DownloadProgressBar` - 下载进度条
- `DownloadControl` - 下载控制按钮

#### 设置组件
- `SettingsNav` - 设置导航
- `DownloadSettings` - 下载设置
- `AccountSettings` - 账号设置
- `NetworkSettings` - 网络设置
- `GeneralSettings` - 通用设置

### 服务层
- `api.ts` - API调用封装
  - 统一错误处理
  - 请求/响应拦截
  - 类型定义

### 状态管理
- `auth.ts` - 认证状态
- `settings.ts` - 设置状态（待实现）

### Hooks
- `useAuth` - 认证相关Hook
- `useSettings` - 设置相关Hook（待实现）

### 类型定义
- `api.ts` - API接口类型
- `models.ts` - 数据模型类型

## 技术栈

### 后端技术栈
- **语言**: Python 3.11+
- **Web框架**: FastAPI 0.104+
- **ORM**: SQLAlchemy 2.0+
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **异步下载**: asyncio (已实现)
- **任务队列**: Celery 5.3+ + Redis 7.0+ (计划中)
- **数据验证**: Pydantic v2
- **HTTP客户端**: httpx
- **下载引擎**: yt-dlp (已集成)

### 前端技术栈
- **框架**: React 19+
- **构建工具**: Vite 5.0+
- **语言**: TypeScript 5.0+
- **样式**: 原生CSS + Tailwind CSS (待集成)
- **状态管理**: Zustand
- **路由**: React Router v6
- **动画**: @formkit/auto-animate

### 桌面端技术栈（待实现）
- **框架**: Electron 28+
- **构建工具**: electron-builder
- **支持平台**: Windows, macOS, Linux

## 配置管理

### 后端配置（apps/api/）
```python
# config.py
class Settings(BaseSettings):
    app_name: str = "PiliNote"
    app_version: str = "0.1.0"
    debug: bool = True
    
    # B站API配置
    bilibili_api_base: str = "https://api.bilibili.com"
    bilibili_passport_base: str = "https://passport.bilibili.com"
    
    # 数据库配置
    database_url: str = "sqlite:///./pilinote.db"
    
    # 服务器配置
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        env_file = ".env"
```

### 环境变量（.env.example）
```bash
# 应用配置
APP_NAME=PiliNote
APP_VERSION=0.1.0
DEBUG=True

# B站API
BILIBILI_API_BASE=https://api.bilibili.com
BILIBILI_PASSPORT_BASE=https://passport.bilibili.com

# 数据库
DATABASE_URL=sqlite:///./pilinote.db
# DATABASE_URL=postgresql://user:password@localhost/pilinote

# 服务器
HOST=0.0.0.0
PORT=8000
```

### 前端配置（apps/web/）
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  }
})

// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## 数据流转

### 认证流程
1. 用户选择登录方式
2. 前端调用相应API
3. 后端通过BilibiliService处理
4. 返回认证信息
5. 前端保存到Zustand store
6. localStorage持久化

### 视频源流程
1. 用户选择视频源（收藏夹/稍后再看）
2. 前端调用API获取列表
3. 后端通过BilibiliService获取数据
4. 格式化返回视频信息
5. 前端显示视频列表
6. 图片通过代理API解决403问题

### 下载流程（已实现70%）
1. 用户添加视频到下载队列 ✅
2. 创建Download任务记录 ✅
3. 使用yt-dlp开始异步下载 ✅
4. 实时更新进度 ✅
5. 下载完成后保存文件 ✅
6. 保存元数据（计划中）
7. 自动下载字幕弹幕（计划中）

## 参考实现

### 架构参考
- **bilitool**（reference/bilitool/）: MVC架构设计
- **Hermes**（reference/hermes/）: 前后端分离架构
- **Vidbee**（reference/vidbee/）: Electron桌面端

### 功能参考
- **PiliPala**（reference/pilipala/）: B站API实现和认证流程
- **bilibili-downloader**（reference/bilibili-downloader/）: yt-dlp下载实现
- **bilibili-favlist-auto-downloader**: 收藏夹下载逻辑

## 开发环境

### 后端开发服务器
```bash
cd apps/api
source venv/bin/activate
python main.py
# 访问: http://localhost:8000
# API文档: http://localhost:8000/docs
```

### 前端开发服务器
```bash
cd apps/web
npm run dev
# 访问: http://localhost:5173
```

### 数据库
- **开发**: SQLite文件数据库
- **生产**: PostgreSQL数据库

## 部署说明

### Docker部署（待实现）
```bash
# 使用Docker Compose一键部署
docker-compose up -d
```

### 配置文件位置
- **后端配置**: `apps/api/.env`
- **前端配置**: `apps/web/.env`
- **数据库**: `apps/api/pilinote.db`

## 扩展性设计

### 插件系统（待实现）
- 支持自定义下载器插件
- 支持自定义文件处理器
- 支持自定义元数据模板

### 多账号支持（待实现）
- 支持多个B站账号
- 账号切换和管理
- 不同账号独立配置

### API开放（待实现）
- 提供RESTful API
- 支持第三方集成
- API密钥管理