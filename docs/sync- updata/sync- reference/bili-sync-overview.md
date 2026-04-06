# bili-sync 项目概述

## 项目简介

**bili-sync** 是一款专为 NAS 用户编写的哔哩哔哩同步工具，由 Rust & Tokio 驱动。该项目能够定期扫描视频合集、收藏夹等，获取本地未下载过的内容并保存到本地，维持本地视频库与哔哩哔哩网站的同步。

### 核心特性

- **多视频源支持**：支持收藏夹、视频合集、视频列表、稍后再看、UP 主投稿等多种视频源
- **智能下载**：自动选择最优的视频和音频流，使用 FFmpeg 合并
- **异步并发**：基于 Tokio 与 Reqwest 实现异步并发下载
- **媒体服务器兼容**：文件布局与 Emby、Jellyfin 等媒体服务器兼容
- **Web UI 管理**：提供 Web 界面进行配置和管理
- **自动重试**：下载失败自动重试，失败次数过多自动丢弃
- **风控处理**：检测到风控时自动终止，等待下一轮执行
- **数据库持久化**：使用数据库保存媒体信息，避免重复请求

## 技术栈

### 后端（Rust）

**核心框架与库：**
- **Tokio** (1.49.0) - 异步运行时
- **Axum** (0.8.8) - Web 框架，支持 WebSocket
- **Sea-ORM** (1.1.19) - ORM 框架，使用 SQLite
- **Reqwest** (0.13.1) - HTTP 客户端，支持异步、cookies、http2 等

**数据处理：**
- **Serde** (1.0.228) - 序列化/反序列化
- **Chrono** (0.4.42) - 日期时间处理
- **Regex** (1.12.2) - 正则表达式

**并发与调度：**
- **Tokio-cron-scheduler** (0.15.1) - 定时任务调度
- **Leaky-bucket** (1.1.2) - 漏桶算法（限流）
- **Dashmap** (6.1.0) - 并发哈希表

**加密与安全：**
- **RSA** (0.10.0-rc.9) - RSA 加密
- **Rustls** (0.23.36) - TLS 实现

**其他工具库：**
- **Tracing** (0.1.44) - 日志追踪
- **Clap** (4.5.54) - 命令行参数解析
- **Handlebars** (6.4.0) - 模板引擎
- **UUID** (1.19.0) - UUID 生成

### 前端

- 基于 Web 技术栈构建的管理界面
- 支持实时配置和视频源管理

### 部署

- **Docker** - 提供 Linux/amd64 和 Linux/arm64 镜像
- **多平台二进制** - 提供预编译的可执行文件
- **Docker Compose** - 支持容器化部署

## 项目结构

```
bili-sync/
├── crates/                      # Rust crates 工作区
│   ├── bili_sync/               # 主程序
│   │   ├── src/
│   │   │   ├── adapter/         # 适配器层
│   │   │   ├── api/             # API 路由
│   │   │   ├── bilibili/        # B 站 API 封装
│   │   │   ├── config/          # 配置管理
│   │   │   ├── downloader.rs    # 下载器
│   │   │   ├── workflow.rs      # 工作流
│   │   │   ├── database.rs      # 数据库
│   │   │   └── ...
│   ├── bili_sync_entity/        # 数据库实体
│   └── bili_sync_migration/     # 数据库迁移
├── web/                         # Web 前端
├── docs/                        # 项目文档
├── scripts/                     # 脚本文件
├── Cargo.toml                   # Rust 项目配置
└── Dockerfile                   # Docker 配置
```

## 版本信息

- **当前版本**：v2.11.0
- **Rust Edition**：2024
- **许可证**：MIT
- **仓库地址**：https://github.com/amtoaer/bili-sync

## 部署方式

### 1. 二进制文件
下载对应平台的预编译二进制文件，直接运行（需要 FFmpeg）

### 2. Docker Compose
```yaml
services:
  bili-sync-rs:
    image: amtoaer/bili-sync-rs:latest
    restart: unless-stopped
    ports:
      - 12345:12345
    volumes:
      - ${配置目录}:/app/.config/bili-sync
      - ${视频目录}:/home/user/Videos/
```

## 配置文件位置

数据库文件存储于 `${config_dir}/bili-sync/data.sqlite`

- **Linux**：`/home/{user}/.config`
- **Windows**：`C:\Users\{user}\AppData\Roaming`
- **macOS**：`/Users/{user}/Library/Application Support`
- **Docker**：`/app/.config`

## 参考项目

bili-sync 在实现过程中参考了以下项目：
- [bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect) - B 站第三方接口文档
- [bilibili-api](https://github.com/Nemo2011/bilibili-api) - Python API 参考实现
- [danmu2ass](https://github.com/gwy15/danmu2ass) - 弹幕下载功能来源

## 适用场景

- **NAS 用户**：在 NAS 上自动同步 B 站视频
- **媒体服务器用户**：与 Emby、Jellyfin 等媒体服务器集成
- **视频收藏者**：批量下载和整理 B 站视频
- **UP 主跟踪者**：自动下载关注 UP 主的新视频

## 项目优势

1. **高性能**：基于 Rust 和 Tokio 的异步并发模型
2. **易部署**：提供 Docker 镜像和预编译二进制
3. **易管理**：Web UI 界面，无需命令行操作
4. **智能可靠**：自动重试、风控处理、数据库持久化
5. **媒体友好**：与主流媒体服务器无缝集成