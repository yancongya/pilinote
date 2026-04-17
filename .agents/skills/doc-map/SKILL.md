---
name: doc-map
description: 文档Map管理系统 - 生成和管理docs/索引，检查文档链路完整性，根据代码变更评估并更新文档
version: 1.0.0
triggers: [doc-map, 生成文档Map, 更新文档Map, 检阅]
tools: [Bash, Glob, Read, Write, Grep]
---

# 文档Map管理系统

模块化的文档管理工作流，提供生成、更新、检阅三个独立命令。

## 调用方式

### 主入口
```
doc-map generate      # 生成Map索引
doc-map update         # 代码变更后更新Map
检阅 XXX              # 检阅文档链路
```

### 触发场景
- 用户说"生成文档Map" → doc-map:generate
- 用户说"更新文档Map" → doc-map:update
- 用户说"检阅 XXX" → doc-map:review

---

## 模块结构

```
doc-map/
├── commands/
│   ├── generate/      # 生成Map索引
│   ├── update/       # 代码变更后更新
│   └── review/       # 检阅链路方案
```

---

## 命令详解

### doc-map:generate
- 触发: `doc-map generate` / `生成文档Map`
- 功能: 扫描docs/目录，生成.doc-map.json索引
- 输出: docs/.doc-map.json

### doc-map:update
- 触发: `doc-map update` / `更新文档Map`
- 功能: 分析代码变更，确定需要更新的文档
- 流程: 变更分析 → 确定目录 → 用户确认 → 更新文档 → 更新Map

### doc-map:review
- 触发: `检阅 XXX`
- 功能: 检查文档链路完整性，评估是否需要优化
- 评估: 内容深度、组织结构、引用关系

---

## 数据文件

docs/.doc-map.json - 文档索引文件，包含：
- directories: 各目录结构、描述、文档列表、依赖
- availableSkills: 项目内和全局可用skills

---

## 注意事项

1. **Map更新时机**: 手动触发，不自动更新
2. **输出格式**: 简单扼要，不生成报告
3. **Skill调用**: 在用户确认后才调用辅助skills
4. **版本控制**: .doc-map.json 可加入git