# PiliNote 开发日志

## 项目初始化 (2026-03-26)

### 阶段 0: 项目规划
- [x] 需求分析和路线图设计
- [x] 架构图绘制 (pilinote_architecture.drawio)
- [x] 参考项目调研和克隆
- [x] 技术方案文档编写
- [x] 开发文档结构搭建

### 完成工作
1. 创建系统架构设计图，包含5个Phase：
   - Phase 1: 用户认证
   - Phase 2: 视频源获取
   - Phase 3: 下载管理
   - Phase 4: 文件组织
   - Phase 5: 部署方案

2. 参考项目克隆到 `reference/` 目录：
   - PiliPala (Flutter B站客户端)
   - Hermes (自托管视频下载器)
   - VidBee (Electron视频下载器)
   - bilibili-downloader (B站下载器)
   - bilibili-favlist-auto-downloader (收藏夹自动下载)

3. 创建开发文档 `docs/dev/`：
   - 技术栈方案
   - 认证方案
   - API列表
   - 下载引擎
   - 文件组织
   - 部署方案
   - 项目结构
   - 开发路线图
   - 参考项目索引

### 下一阶段计划
- [ ] Phase 1: 核心功能搭建
  - 搭建FastAPI后端框架
  - 搭建React前端框架
  - 实现SESSDATA认证
  - 集成yt-dlp基础下载

---

## 待记录...