# 项目结构

## 目录结构
```
pilinote/
├── backend/              # 后端服务
│   ├── app/
│   │   ├── api/         # API路由
│   │   ├── models/      # 数据模型
│   │   ├── services/    # 业务逻辑
│   │   ├── tasks/       # Celery任务
│   │   └── utils/       # 工具函数
│   ├── tests/           # 测试
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/            # 前端应用
│   ├── src/
│   │   ├── components/  # 组件
│   │   ├── pages/       # 页面
│   │   ├── hooks/       # Hooks
│   │   ├── services/    # API服务
│   │   └── stores/      # 状态管理
│   ├── Dockerfile
│   └── package.json
├── desktop/             # 桌面端
│   ├── main.js
│   ├── preload.js
│   └── package.json
├── docker-compose.yml   # Docker编排
├── docs/                # 文档
│   └── dev/            # 开发文档
└── reference/           # 参考项目

```

## 模块划分
- **认证模块**: 登录、Token管理
- **视频源模块**: 收藏夹、稍后再看、链接解析
- **下载模块**: 任务队列、进度管理
- **文件模块**: 文件组织、元数据管理
- **用户模块**: 账号管理、设置

## 参考实现
- `reference/hermes/packages/`
- `reference/vidbee/apps/`