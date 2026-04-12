---
name: doc-workflow
version: 1.0.0
description: 文档更新和问题排查的规范化流程确保文档关联完整、能快速定位问题、备份文档可追溯
---

# 文档工作流规范 Skill

## 概述

本 Skill 用于指导文档更新和问题排查的规范化流程确保：
1. 文档关联完整，不遗漏
2. 能快速定位问题
3. 备份文档可追溯

---

## 调用方式

用户可以使用以下方式调用：

### 1. 直接提问问题
```
"文档是否完善？" 
"XXX 功能是怎么实现的？"
```
→ 自动进入验证环节

### 2. 使用命令
```
/doc-workflow
```
→ 进入完整流程（分析→确认→检查→确认→提交）

### 3. 指定模式
```
"梳理结构" 
"分析 XXX 功能"
```

---

## 文档结构

### 当前文档 (`docs/`)

```
docs/
├── README.md              # 主索引
├── base/                  # 基础文档
│   ├── tech-stack.md
│   └── reference-projects.md
├── auth/                  # 认证模块
│   ├── login-flow.md
│   ├── cookies.md
│   ├── wbi-sign.md
│   └── multi-account.md
├── video-sources/          # 视频源模块
│   ├── favorites.md
│   └── watchlater.md
├── download/              # 下载系统
│   ├── queue.md
│   ├── tasks.md
│   ├── scheduler.md
│   └── handlers.md
├── settings/              # 设置模块
│   ├── storage.md
│   └── backup.md
├── database/              # 数据库
│   ├── models.md
│   └── schemas.md
├── api/                   # API
│   └── endpoints.md
└── dev/                   # 开发笔记
    ├── dev-log.md
    └── roadmap.md         # 待完善任务
```

### 备份文档 (`docs-backup/20260412/`)

```
docs-backup/20260412/
├── auth_flow/            # 认证流程（旧）
├── dev/                   # 开发文档
├── dev2/                  # 开发文档2
├── download-redo/         # 下载重构分析
├── sync- updata/          # 升级参考
└── todo/                  # 待办事项
```

---

## 核心规范

### 1. 文档关联标记

每个文档头部必须包含元数据：

```markdown
---
关联文档:
  - auth/cookies.md        # Cookie 管理
  - database/models.md    # User 模型
涉及文件:
  - apps/api/src/routers/auth.py
  - apps/api/src/services/cookie_manager.py
依赖服务:
  - BilibiliService
  - HeadersManager
---
```

### 2. 功能模块依赖图

#### 登录模块依赖
```
login-flow.md
    ↓ 依赖
cookies.md → database/models.md (User模型)
    ↓ 依赖
wbi-sign.md
    ↓ 验证
video-sources/favorites.md (验证Cookie有效)
video-sources/watchlater.md (验证Cookie有效)
```

#### 视频源模块依赖
```
video-sources/favorites.md
    ↓ 依赖
database/models.md (User模型) → auth/cookies.md
    ↓ 调用
api/endpoints.md
```

#### 下载模块依赖
```
download/queue.md
    ↓ 依赖
download/tasks.md
    ↓ 依赖
download/handlers.md
    ↓ 存储
database/models.md (Task/Scheduler模型)
```

---

## 工作流程

### 起始：用户询问问题

```
用户提问 → 先从现有文档搜索答案
```

#### 验证环节

```
1. 读取 docs/ 相关目录的 README.md 获取索引
2. 读取相关子文档搜索答案
3. 如果文档已有完整答案 → 直接返回
4. 如果文档不完整 → 标记需要更新 → 进入下一步
```

---

### 步骤1: 询问模式

```
询问用户选择工作模式：

A. 梳理结构 
   - 更新多个关联文档
   - 适合完善某模块的整体认知

B. 单个功能完整分析
   - 深入分析单个功能
   - 适合解决特定问题
```

---

### A. 梳理结构模式

#### 步骤2: 分析需要更新的文档

```
1. 询问用户想梳理哪个功能/模块
2. 分析当前文档状态
3. 列出需要更新的文档及关联
4. 返回给用户确认（不直接修改）

示例返回：
需要更新的文档：
- auth/login-flow.md    ← 主要更新
- auth/cookies.md        ← 关联更新
- auth/multi-account.md  ← 关联更新
- database/models.md    ← 关联更新（User模型）

是否确认？输入 YES 继续
```

#### 步骤3: 查看源码验证

```
用户确认后：
1. 读取相关源码文件
2. 对比当前文档内容
3. 记录差异
```

#### 步骤4: 生成文档差异

```
1. 展示需要修改的内容
2. 再次返回给用户确认

示例：
login-flow.md 更新：
+ 新增 API: /api/auth/captcha/params
- 修正 API 参数格式
```

#### 步骤5: 提交

```
用户再次确认后：
1. 询问是否需要更新 dev/dev-log.md
2. 如果用户确认，更新日志内容
3. 使用 git add + git commit
```

---

### B. 单个功能完整分析

#### 步骤2: 确认功能

```
1. 询问用户想分析哪个功能
2. 确认分析范围
```

#### 步骤3: 完整链路分析

```
1. 前端入口 → API 调用
2. 后端路由 → 服务层 → 数据层
3. 数据库模型
4. 返回响应
```

#### 步骤4: 整理文档

```
1. 生成完整的文档
2. 返回给用户确认
```

#### 步骤5: 提交

```
用户确认后：
1. 使用 git add + git commit
2. 询问是否需要 push
```

---

### C. 问题排查流程

#### 步骤1: 快速定位

```
1. 根据问题现象确定模块
2. 读取 docs/模块名/README.md 索引
3. 查看相关 API endpoints.md
```

#### 步骤2: 深入分析

```
1. 查看源码
2. 检查 models.md 数据模型
3. 检查相关服务实现
```

#### 步骤3: 参考备份（如需）

```
问题无法解决时：
1. docs-backup/20260412/auth_flow/    # 旧认证流程
2. docs-backup/20260412/dev/            # 旧开发文档
3. docs-backup/20260412/todo/           # 待办事项参考
```

#### 步骤4: 解决问题后

```
1. 记录解决方案到 dev/dev-log.md
2. 询问是否需要更新文档
```

---

## 常用引用格式

### 文档内引用
```markdown
详见 [Cookie 管理](../auth/cookies.md)
详见 [User 模型](../database/models.md)
```

### 备份文档引用
```markdown
详见备份 `docs-backup/20260412/auth_flow/`
```

### 文件引用
```markdown
关键文件：`apps/api/src/routers/auth.py`
```

---