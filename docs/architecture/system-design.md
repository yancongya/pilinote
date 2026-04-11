# 系统设计

## 认证系统

### 流程
1. 用户扫码登录 → 获取 Cookies
2. 存储至数据库
3. 请求时加载到 HeadersManager

详见 [认证功能](../features/authentication/)

## 下载系统

### 组件
- **QueueManager**: 队列管理
- **Task**: 任务调度
- **DownloadEngine**: Aria2c 集成
- **Handlers**: 文件处理器

详见 [下载功能](../features/download/)

## 数据存储

- **SQLite**: 主要数据库
- **文件系统**: 视频文件存储

---

[返回上级](../README.md)