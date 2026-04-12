# 技术栈

## 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.1.0 | UI 框架 |
| TypeScript | 5.x | 类型系统 |
| Vite | 6.x | 构建工具 |
| Zustand | 5.0.12 | 状态管理 |
| Tailwind CSS | 4.x | 样式 |
| React Router | 7.5.x | 路由 |
| Lucide React | 1.7.x | 图标 |

## 后端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.115.6 | Web 框架 |
| Uvicorn | 0.34.0 | ASGI 服务器 |
| SQLAlchemy | 2.0.36 | ORM |
| Pydantic | 2.10.4 | 数据校验 |
| Httpx | 0.28.x | HTTP 客户端 |
| yt-dlp | 2024.1+ | 下载引擎 |

## 项目结构

```
apps/
├── web/              # React 前端
│   └── src/
│       ├── components/ # UI 组件
│       ├── pages/    # 页面
│       ├── stores/   # 状态管理
│       ├── hooks/    # 自定义 Hooks
│       └── services/ # API 服务
│
└── api/              # FastAPI 后端
    └── src/
        ├── routers/   # API 路由
        ├── services/ # 业务逻辑
        ├── models/   # 数据模型
        └── schemas/  # Pydantic 模型
```

---

[返回上级](./README.md)