# 项目结构

```
pilinote/
├── apps/
│   ├── web/                    # React 前端
│   │   ├── src/
│   │   │   ├── components/    # 组件
│   │   │   ├── pages/         # 页面
│   │   │   ├── stores/        # 状态管理
│   │   │   ├── hooks/        # 自定义 Hooks
│   │   │   ├── services/     # API 服务
│   │   │   └── types/        # 类型定义
│   │   └── package.json
│   │
│   └── api/                   # FastAPI 后端
│       ├── src/
│       │   ├── routers/       # API 路由
│       │   ├── services/     # 业务逻辑
│       │   ├── models/       # 数据模型
│       │   ├── schemas/      # Pydantic 模型
│       │   └── utils/         # 工具函数
│       └── requirements.txt
│
├── docs/                       # 项目文档
├── downloads/                  # 下载文件目录
├── temp/                      # 临时文件
└── logs/                      # 日志文件
```

---

[返回上级](../README.md)