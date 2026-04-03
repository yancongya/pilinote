# PiliNote 下载功能重构方案

## 项目背景

基于 BiliTools（Rust + Tauri + Vue）的下载管理架构，重构 PiliNote（Python + FastAPI + React）的下载功能。

## 推荐方案

**新Tab渐进式重构**：在主导航栏添加"新下载"Tab，完全独立实现，测试通过后替换旧"下载管理"Tab。

## 文档结构

```
download-redo/
├── README.md                      # 本文档
├── analysis/                      # 分析文档
│   ├── bilitools-analysis.md     # BiliTools整体架构分析
│   ├── bilitools-download-management.md  # BiliTools下载管理深度分析
│   └── pilinote-current-analysis.md      # PiliNote当前实现分析
├── spec/                          # 技术规范
│   └── refactoring-spec.md       # 完整重构规范（含数据模型、API、组件等）
└── plan/                          # 实施方案
    └── new-tab-implementation.md # 新Tab实施方案（最终方案）
```

## 快速开始

### 阅读顺序
1. **第一步**：阅读 `analysis/pilinote-current-analysis.md`，了解当前实现
2. **第二步**：阅读 `analysis/bilitools-download-management.md`，了解目标架构
3. **第三步**：阅读 `spec/refactoring-spec.md`，了解技术细节
4. **第四步**：按 `plan/new-tab-implementation.md` 实施

### 核心概念

#### BiliTools架构特点
- **四级队列**：backlog → pending → doing → complete
- **分层模型**：Task / Scheduler / SubTask
- **事件驱动**：WebSocket实时通信
- **并发控制**：信号量机制

#### 重构方案特点
- **渐进式**：新旧系统并存，可对比测试
- **零风险**：完全独立的新代码，不影响现有功能
- **可回滚**：随时删除新Tab即可恢复

## 实施步骤概览

| 阶段 | 内容 | 时间 |
|------|------|------|
| 1 | 创建状态管理 `stores/newQueue.ts` | 1小时 |
| 2 | 创建新组件 `components/NewDownload/` | 3小时 |
| 3 | 修改 `HomePage.tsx` 添加新Tab | 30分钟 |
| 4 | 功能测试 | 1小时 |
| 5 | 清理旧代码（可选） | 30分钟 |

## 关键决策

### 选择新Tab方案的原因
1. **最小影响**：完全独立，不影响现有功能
2. **可对比测试**：新旧系统同时存在
3. **渐进式迁移**：测试通过后再清理旧代码
4. **随时回滚**：删除新Tab即可

## 文件说明

### analysis/ - 分析文档
| 文件 | 内容 |
|------|------|
| `bilitools-analysis.md` | BiliTools项目整体架构、技术栈、参考价值 |
| `biltitools-download-management.md` | BiliTools下载任务生命周期、队列系统、状态机 |
| `pilinote-current-analysis.md` | PiliNote当前实现的问题和改进空间 |

### spec/ - 技术规范
| 文件 | 内容 |
|------|------|
| `refactoring-spec.md` | 完整的技术规范（数据模型、API、组件、实施计划） |

### plan/ - 实施方案
| 文件 | 内容 |
|------|------|
| `new-tab-implementation.md` | 新Tab实施方案（代码示例、实施步骤、测试计划） |

## 更新记录
- 2026-04-02: 初始创建，整理完成
