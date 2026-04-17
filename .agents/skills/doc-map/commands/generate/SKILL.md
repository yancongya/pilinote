---
name: doc-map:generate
description: 扫描docs/目录生成.doc-map.json索引文件
triggers: [doc-map generate, 生成文档Map]
tools: [Bash, Glob, Read, Write]
---

# doc-map generate

扫描docs/目录结构，生成索引文件。

## 流程

1. 递归遍历 docs/ 下所有子目录
2. 对每个目录读取 README.md 获取description
3. 列出该目录下所有 .md 文件并识别类型
4. 检查项目内 skills (.agents/skills/*/)
5. 检查全局 skills (~/.config/opencode/skills/)
6. 生成 docs/.doc-map.json

## 输出

docs/.doc-map.json - 包含目录结构、文档列表、可用skills