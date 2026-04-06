# bili-sync 参考文档集

本目录包含 bili-sync 项目的参考文档，用于分析和借鉴其优秀设计。

## 📚 文档列表

### 1. 项目概述
- **文件**: `bili-sync-overview.md`
- **内容**: 项目简介、技术栈、项目结构、部署方式、适用场景、项目优势

### 2. 架构设计
- **文件**: `bili-sync-architecture.md`
- **内容**: 核心概念、数据库设计、与媒体服务器的映射、程序执行流程、核心模块架构、并发模型、限流与风控、配置系统

### 3. 核心功能分析
- **文件**: `bili-sync-core-features.md`
- **内容**: 
  - 认证与凭据管理
  - 视频源管理（收藏夹、稍后再看、合集、UP 主）
  - 智能下载系统（质量选择、CDN 排序、分块下载）
  - 文件命名系统
  - 媒体服务器集成
  - 并发控制与限流
  - 错误处理与重试
  - Web UI 管理
  - 数据库管理
  - 定时任务

### 4. 技术要点总结
- **文件**: `bili-sync-tech-highlights.md`
- **内容**: 
  - Rust 生态系统应用（Tokio、Axum、Sea-ORM、Reqwest）
  - 并发与同步（多级并发、漏桶算法、并发数据结构）
  - 网络与 I/O（流式下载、分块下载）
  - 加密与安全（RSA、TLS）
  - 模板引擎（Handlebars）
  - 日志与追踪（Tracing）
  - 时间处理（Chrono）
  - 任务调度（Tokio Cron Scheduler）
  - 错误处理（Thiserror、Anyhow）
  - 性能优化技巧

### 5. 工作流深度解析
- **文件**: `bili-sync-workflow-deep-dive.md`
- **内容**: 
  - 整体架构
  - 工作流执行流程（三步走）
  - 收藏夹视频获取机制
  - 视频添加到下载列表
  - Tokio Cron Scheduler 任务调度
  - 定时任务 vs 手动触发
  - 关键代码示例
  - 与 PiliNote 的对比与借鉴

## 🎯 核心概念

### 三层结构
```
Video Source（视频源）
    ↓
Video（视频）
    ↓
Page（分页）
```

### 工作流程
1. **扫描视频源**：获取新视频列表 → 写入数据库
2. **填充视频详情**：获取标签、分页信息 → 创建 Page 记录
3. **下载未处理的视频**：筛选待下载视频 → 并发下载

### 状态管理
使用位掩码记录下载状态：
- STATUS_COVER: 封面
- STATUS_VIDEO: 视频
- STATUS_NFO: NFO
- STATUS_DANMAKU: 弹幕
- STATUS_COMPLETED: 全部完成

## 📖 使用指南

### 快速开始
1. 阅读 `bili-sync-overview.md` 了解项目概况
2. 阅读 `bili-sync-workflow-deep-dive.md` 了解工作流程
3. 根据需要深入阅读其他文档

### 深入学习
1. **架构设计**: 阅读 `bili-sync-architecture.md` 理解整体架构
2. **核心功能**: 阅读 `bili-sync-core-features.md` 了解功能实现
3. **技术细节**: 阅读 `bili-sync-tech-highlights.md` 学习技术要点

### 借鉴参考
1. 查看各个文档中的"与 PiliNote 的对比与借鉴"章节
2. 参考关键代码示例
3. 结合 PiliNote 的实际情况进行调整

## 🔗 相关资源

- **GitHub**: https://github.com/amtoaer/bili-sync
- **文档**: https://bili-sync.amto.cc/
- **版本**: v2.11.0
- **许可证**: MIT

## 📝 更新日志

- **2024-04-06**: 初始版本，包含 5 个核心文档