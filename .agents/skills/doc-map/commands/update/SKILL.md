---
name: doc-map:update
description: 代码变更后根据变更分析需要更新的文档目录
triggers: [doc-map update, 更新文档Map]
tools: [Bash, Glob, Read, Grep]
---

# doc-map update

代码变更后分析和更新文档Map。

## 流程

1. 分析变更内容
   - git diff --name-only 查看改动的文件
   - 结合上下文记忆（当前对话中的变更）
   - 读取 .planning/phases/*/PLAN.md 获取计划

2. 结合现有Map检查
   - 加载 docs/.doc-map.json
   - 对比变更涉及的目录/文件
   - 确定需要更新的文档

3. 列出需要更新的内容
   - 需要更新的目录
   - 需要更新的文档

4. 等待用户确认后更新文档

5. 文档更新完成后，再次执行 generate 更新Map

## 输出

需要更新的目录/文档列表 + 用户确认后执行更新