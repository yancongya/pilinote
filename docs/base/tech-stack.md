# 技术栈

## 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | 5 | 类型系统 |
| Vite | 5 | 构建工具 |
| Zustand | 4 | 状态管理 |
| Tailwind CSS | 3 | 样式 |

## 后端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.109+ | Web 框架 |
| SQLAlchemy | 2.0 | ORM |
| Pydantic | 2.0 | 数据校验 |
| Aria2c | - | 下载引擎 |

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