---
name: doc-code-workflow
version: 1.0.0
description: 文档和代码审查的完整工作流 - 从需求分析到代码审查的闭环流程
---

# 文档代码工作流 Skill

## 概述

本 Skill 集成了代码审查、文档更新的完整工作流，结合了：
- doc-workflow: 文档工作流参考
- project-documentation-workflow: 项目文档生成
- requesting-code-review: 代码审查

## 工作流流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  DOC-CODE WORKFLOW                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                          │
│  Phase 1: 需求分析                                        │
│     ├─ 确认任务目标                                       │
│     ├─ 分析现有文档状态                                  │
│     └─ 生成任务列表                                      │
│                                                          │
│  Phase 2: 实现/更新                                      │
│     ├─ 代码实现或文档更新                                │
│     ├─ 记录变更                                        │
│     └─ 本地测试                                        │
│                                                          │
│  Phase 3: 代码审查                                      │
│     ├─ 获取 git SHA                                     │
│     ├─ 分析变更内容                                     │
│     ├─ 检查问题                                        │
│     └─ 反馈                                            │
│                                                          │
│  Phase 4: 修复                                          │
│     ├─ 立即修复 Critical                                │
│     ├─ 修复 Important                                   │
│     └─ 记录 Minor                                      │
│                                                          │
│  Phase 5: 提交                                          │
│     ├─ 添加并提交                                       │
│     └─ 更新日志                                         │
│                                                          │
└───────────────────────────────────────────────────────────
```

---

## 调用方式

### 1. 新建文档
```
"新建 X 模块文档"
"添加 Y 功能说明"
```
→ 进入文档工作流

### 2. 代码审查
```
"审查最近代码"
"检查代码问题"
```
→ 进入代码审查

### 3. 完整工作流
```
"完成 X 功能并审查"
```
→ 执行完整流程

---

## 工作流详情

### Phase 1: 需求分析

```
1. 分析项目结构
   - 检查目录 (apps/web/src, apps/api/src)
   - 检查现有文档
   
2. 确认任务目标
   - 与用户确认需求
   - 确定范围

3. 生成任务列表
   - 列出需要创建/更新的文件
   - 评估工作量
```

### Phase 2: 实现/更新

```
1. 执行变更
   - 创建/修改文件
   - 确保代码正确

2. 记录变更
   - git status 检查
   - 记录变更内容

3. 本地验证
   - 检查语法
   - 确保文件存在
```

### Phase 3: 代码审查

```
1. 获取 git SHA
   BASE_SHA=$(git rev-parse HEAD~1)
   HEAD_SHA=$(git rev-parse HEAD)

2. 分析变更
   - 统计文件数量
   - 检查新增/修改

3. 检查问题
   - 代码规范
   - 安全性
   - 性能
   - 文档完整性

4. 给出反馈
   - Strengths: 优点
   - Issues: 问题列表 (Critical/Important/Minor)
   - Assessment: 评估
```

### Phase 4: 修复

```
1. Critical - 立即修复
   - 安全漏洞
   - 崩溃问题
   
2. Important - 继续前修复
   - 重要功能缺失
   - 性能问题
   
3. Minor - 记录稍后修复
   - 代码风格
   - 注释优化
```

### Phase 5: 提交

```
1. 提交变更
   git add <files>
   git commit -m "message"

2. 更新日志 (可选)
   - docs/dev/dev-log.md
   - CHANGELOG.md
```

---

## 常用命令

### 获取 Git 信息
```bash
# 最近提交
git log --oneline -5

# SHA
BASE_SHA=$(git rev-parse HEAD~1)
HEAD_SHA=$(git rev-parse HEAD)

# 统计变更
git diff --stat BASE_SHA HEAD_SHA
```

### 检查文档目录
```bash
# 文档数量统计
for dir in docs/*/; do
  count=$(ls "$dir"*.md 2>/dev/null | wc -l)
  echo "$dir: $count 个"
done
```

### 检查代码问题
```bash
# TypeScript 检查
cd apps/web && npx tsc --noEmit

# Python 语法
python -m py_compile apps/api/src/**/*.py
```

---

## 输出格式

### 代码审查报告

```
### 已完成工作
| Commit | 描述 | 文件数 |
|--------|------|--------|
| xxx | 新增功能 | N |

### Strengths ✅
1. ...

### Issues
| 严重度 | 问题 | 说明 |
|--------|------|------|
| Critical | ... | ... |
| Important | ... | ... |
| Minor | ... | ... |

### Assessment
- ✅ Ready to proceed
- ⚠️ Need fixes

### 建议
1. ...
```

---

## 关联 Skills

- doc-workflow (参考) - 旧文档工作流
- project-documentation-workflow (参考) - 项目文档生成
- requesting-code-review (参考) - 代码审查

---

## 使用示例

### 示例 1: 新建文档
```
用户: 添加下载模块文档
助手: 
1. 分析现有文档
2. 创建 docs/download/ 模块
3. 代码审查
4. 提交
```

### 示例 2: 完整工作流
```
用户: 完成账号设置功能并审查
助手:
1. Phase 1: 需求分析
2. Phase 2: 创建 accounts.md
3. Phase 3: 代码审查
4. Phase 4: 修复
5. Phase 5: 提交
```

---

## 关键文件

- 项目文档: `.agents/skills/doc-code-workflow/SKILL.md`
- 参考文档: `docs/` 目录
- 开发日志: `docs/dev/dev-log.md`

---

[返回上级](../ README.md)