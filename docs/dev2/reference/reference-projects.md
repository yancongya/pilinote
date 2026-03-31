# 参考项目索引

## PiliPala (Flutter B站客户端)
**路径**: `reference/pilipala/`

**参考价值**:
- B站API完整实现
- 认证流程（扫码、密码、SESSDATA）
- 收藏夹、稍后再看API
- Cookie管理机制

**关键文件**:
- `lib/http/login.dart` - 登录实现
- `lib/http/user.dart` - 用户API
- `lib/http/api.dart` - API定义
- `lib/utils/login.dart` - 登录工具

## Hermes (自托管视频下载器)
**路径**: `reference/hermes/`

**参考价值**:
- 前后端分离架构
- FastAPI + React技术栈
- Celery任务队列
- Docker部署方案
- WebSocket实时通信

**关键文件**:
- `packages/hermes-api/` - 后端实现
- `packages/hermes-app/` - 前端实现
- `docker-compose.yml` - 部署配置
- `Caddyfile` - 反向代理

## VidBee (Electron视频下载器)
**路径**: `reference/vidbee/`

**参考价值**:
- Electron桌面应用
- React前端
- 多平台打包
- UI/UX设计

**关键文件**:
- `apps/desktop/` - 桌面端
- `apps/api/` - API服务
- `apps/web/` - Web前端

## bilibili-downloader (B站下载器)
**路径**: `reference/bilibili-downloader/`

**参考价值**:
- PyQt5 GUI实现
- B站视频下载
- SESSDATA认证
- FFmpeg视频处理

**关键文件**:
- `src/main_app.py` - 主程序
- `requirements.txt` - 依赖

## bilibili-favlist-auto-downloader
**路径**: `reference/bilibili-favlist-auto-downloader/`

**参考价值**:
- 收藏夹自动下载
- B站API调用
- 自动化脚本

## 使用建议
1. 认证功能 → 参考PiliPala
2. 架构设计 → 参考Hermes
3. 桌面端 → 参考VidBee
4. 下载实现 → 参考bilibili-downloader