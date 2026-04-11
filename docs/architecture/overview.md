# 架构概览

## 技术栈

### 前端
- React 18 + TypeScript
- Vite 构建
- Zustand 状态管理
- Tailwind CSS

### 后端
- FastAPI
- SQLAlchemy
- Aria2c 下载引擎
- WebSocket 实时推送

## 系统架构

TODO: 添加架构图

## 数据流

```
用户操作 → React 组件 → API 请求 → FastAPI → Bilibili API
                                    ↓
                              Aria2c 下载器
                                    ↓
                              文件系统
```

---

[返回上级](../README.md)