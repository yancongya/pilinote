# PiliNote · 把 B 站视频变为本地知识库

> 你收藏的不是视频，是“未来要学”的自己。  
> PiliNote 负责把“未来”尽快拉到“本地硬盘”。

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2-red?style=flat-square)](https://www.sqlalchemy.org/)
[![VitePress](https://img.shields.io/badge/VitePress-1.6-5C73E7?style=flat-square&logo=vuedotjs)](https://vitepress.dev/)
[![GSAP](https://img.shields.io/badge/GSAP-3.13-88CE02?style=flat-square)](https://gsap.com/)

---

## 这个项目是干嘛的

PiliNote 是一个围绕 B 站内容的本地知识化工具链：

1. 手动或者cron从收藏夹 / 稍后再看 / 历史 / 链接解析拿到视频源  
2. 自动下载视频、字幕、NFO、截图等 sidecar 产物
3. 生成可回跳时间戳的 AI 笔记  
4. 让“看过”变成“能复习、能检索、能长期保存”的本地知识资产

一句话总结：**把“刷过”变成“学会”，把“收藏夹”变成“可复习知识库”**。

---

## 风格与定位

- **产品风格**：本地优先（Local First）+ 专业 SaaS + 轻科技感  
- **交互风格**：强调可追踪流程（队列、状态、产物）和复盘效率  
- **技术风格**：前后端分离 + 本地优先的数据落地链路

不搞“玄学 AI 一键起飞”，只搞“文件落地可验证、链路可调可复现”。

---

## 核心能力

1. **AI 笔记回跳**  
   章节、关键点、问题与结论结构化沉淀，时间戳可点击回到视频片段。  

2. **收藏夹杀手**  
   收藏夹 / 稍后再看 / 历史 / 订阅文件夹统一入队下载到本地，堆积内容变可执行清单。  

3. **自动下载落盘**  
   队列并发、失败重试、分 P 处理，视频与字幕/NFO/截图同级归档。  

4. **本地媒体库**  
   已下载资产集中管理，支持离线检索、复盘与迁移。  

5. **模型与策略可配置**  
   Prompt、模型、下载策略、自动化节奏都可调，适配不同使用场景。  

6. **纯本地化知识处理**  
   核心资产落地本地目录，不依赖平台状态，链接失效不影响复习。  

7. **FTP / NAS 备份**  
   本地资产可同步到 NAS/FTP，支持长期归档与多设备访问。

---

## 技术栈

- 前端：React 19 + TypeScript + Vite + Zustand  
- 后端：FastAPI + SQLAlchemy + Pydantic  
- 文档站：VitePress（独立目录：`pilinote-docs/`）  

---

## 快速开始（开发模式）

### 1) 环境要求

- Node.js 20+（建议 22/24）
- pnpm 10+
- Python 3.10+（建议用 venv）

### 2) 启动前后端

```bash
# 前端（http://localhost:5173）
./start-web.command

# 后端（http://localhost:8000）
./start-api.command
```

### 3) 启动文档站（可选）

```bash
# 文档预览（http://localhost:5174）
./start-docs.command
```

---

## 二次开发指南（给准备“魔改”的你）

### 目录结构（核心）

```text
apps/
  web/       # 前端应用
  api/       # 后端服务
pilinote-docs/  # VitePress 文档站独立模块
```

### 常用命令

```bash
# 前端
cd apps/web && pnpm dev

# 后端
cd apps/api
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 启动 VitePress 文档站（落地页在这里）
./start-docs.command
```

### 建议开发顺序

1. 先跑通后端接口（源数据、下载、笔记）  
2. 再接前端状态流（列表、详情、回跳）  
3. 最后做功能串联与性能回归（避免在边缘环节提前消耗精力）

---

## 注意事项（踩坑预警版）

1. **登录态有效期**  
   涉及 B 站接口时，Cookie 过期会导致数据/下载失败。先查认证状态再查业务逻辑。  

2. **路径配置跨平台差异**  
   macOS / Windows 的路径分隔、权限和默认目录不同，建议统一做绝对路径。  

3. **下载与 AI 处理是两段链路**  
   下载成功不代表 AI 一定成功，AI 失败要单独看模型配置和日志。  

4. **仓库分层**  
   文档站目前在 `pilinote-docs/`（独立模块），主应用与文档可分开维护与发布。

---

## 参考项目

- **BiliTools**：B 站工具链设计与工程实践参考  
  [https://github.com/btjawa/BiliTools](https://github.com/btjawa/BiliTools)

- **PiliPala**：B 站桌面/客户端侧交互与功能思路参考  
  [https://github.com/guozhigq/pilipala](https://github.com/guozhigq/pilipala)

- **bili-sync**：媒体同步与本地化处理链路参考  
  [https://github.com/amtoaer/bili-sync](https://github.com/amtoaer/bili-sync)

---

## 相关目录

- 文档站源码：`pilinote-docs/`

---

## 最后一句

收藏可以冲动，复习要冷静。  
PiliNote 的目标，是让你的硬盘比你的收藏夹更懂你。

---

## Star 趋势

[![Star History Chart](https://api.star-history.com/svg?repos=yancongya/pilinote&type=Date)](https://www.star-history.com/#yancongya/pilinote&Date)
