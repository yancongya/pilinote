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
│   │   │   ├── models/            # 数据模型
│   │   │   │   └── user.py        # 用户模型
│   │   │   ├── schemas/           # Pydantic模式
│   │   │   │   └── login.py       # 登录模式
│   │   │   ├── routers/           # API路由
│   │   │   │   └── auth.py        # 认证路由
│   │   │   ├── services/          # 业务逻辑
│   │   │   │   └── bilibili.py    # B站API服务
│   │   │   └── utils/             # 工具函数
│   │   │       └── crypto.py      # 加密工具
│   │   ├── requirements.txt       # Python依赖
│   │   ├── .env                   # 环境变量
│   │   ├── .env.example           # 环境变量示例
│   │   ├── pyproject.toml         # 项目配置
│   │   └── venv/                  # 虚拟环境
│   └── web/                # 前端Web应用
│       ├── src/
│       │   ├── main.tsx           # React入口
│       │   ├── App.tsx            # 主应用组件
│       │   ├── index.css          # 全局样式
│       │   ├── pages/             # 页面组件
│       │   │   ├── LoginPage.tsx  # 登录页面
│       │   │   └── HomePage.tsx   # 主页面
│       │   ├── services/          # API服务
│       │   │   └── api.ts         # API调用封装
│       │   └── stores/            # 状态管理
│       │       └── auth.ts        # 认证状态
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
│   ├── bilibili-downloader/       # B站下载器
│   └── bilibili-favlist-auto-downloader/  # 收藏夹自动下载
├── CHANGELOG.md            # 开发日志
├── AGENTS.md               # Agent配置
└── .gitignore              # Git忽略规则

```

## 模块划分
- **认证模块**: 扫码登录、SESSDATA登录、密码登录、用户信息管理
- **视频源模块**: 收藏夹、稍后再看、链接解析 (待实现)
- **下载模块**: 任务队列、进度管理 (待实现)
- **文件模块**: 文件组织、元数据管理 (待实现)
- **用户模块**: 账号管理、设置 (待实现)

## 后端API结构

### 认证API (`/api/auth`)
- `GET /api/auth/qrcode` - 获取登录二维码
- `GET /api/auth/qrcode/status/{qrcode_key}` - 查询二维码状态
- `POST /api/auth/sessdata` - SESSDATA登录
- `POST /api/auth/password` - 密码登录
- `GET /api/auth/user-info` - 获取用户信息

### 数据库模型
- `User` - 用户信息表
  - `mid` (主键) - B站用户ID
  - `username` - 用户名
  - `avatar` - 头像URL
  - `level` - 用户等级
  - `vip_status` - VIP状态
  - `sessdata` - B站会话令牌
  - `created_at` - 创建时间
  - `updated_at` - 更新时间

## 前端结构

### 页面组件
- `LoginPage` - 登录页面
  - 扫码登录
  - SESSDATA登录
  - 密码登录
- `HomePage` - 主页面
  - 收藏夹页面
  - 稍后再看页面
  - 下载管理页面

### 服务层
- `api.ts` - API调用封装
  - 统一错误处理
  - 响应格式化
  - 请求拦截

### 状态管理
- `auth.ts` - 认证状态
  - 用户信息
  - 登录状态
  - 持久化存储

## 架构图
- `docs/dev/pilinote_architecture.drawio` - 系统架构设计图

## 参考实现
- `reference/pilipala/lib/http/login.dart` - 登录实现
- `reference/hermes/packages/hermes-api/` - 后端API结构
- `reference/vidbee/apps/api/` - API服务结构

## 开发环境
- **后端开发服务器**: `http://localhost:8000`
- **前端开发服务器**: `http://localhost:5173`
- **数据库**: SQLite (开发) / PostgreSQL (生产)