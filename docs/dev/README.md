# PiliNote 开发文档

## 文档索引

### 技术方案
- [00-tech-stack.md](00-tech-stack.md) - 技术栈方案
- [01-auth-solution.md](01-auth-solution.md) - 用户认证方案
- [02-api-list.md](02-api-list.md) - B站API列表
- [03-download-engine.md](03-download-engine.md) - 下载引擎方案
- [04-file-organization.md](04-file-organization.md) - 文件组织方案
- [05-deployment.md](05-deployment.md) - 部署方案
- [06-project-structure.md](06-project-structure.md) - 项目结构
- [07-development-roadmap.md](07-development-roadmap.md) - 开发路线图
- [08-reference-projects.md](08-reference-projects.md) - 参考项目索引

## 架构图
- [pilinote_architecture.drawio](pilinote_architecture.drawio) - 系统架构设计

## 参考项目
详见 [08-reference-projects.md](08-reference-projects.md)

## 开发原则
1. **避免重复造轮子** - 优先使用成熟方案
2. **参考现有项目** - 从reference/目录索引实现
3. **模块化设计** - 保持高内聚低耦合
4. **渐进式开发** - 按路线图逐步实现

## 快速开始
1. 查阅 [00-tech-stack.md](00-tech-stack.md) 了解技术栈
2. 查看 [07-development-roadmap.md](07-development-roadmap.md) 了解开发计划
3. 参考 [08-reference-projects.md](08-reference-projects.md) 查找具体实现
4. 查看 [05-deployment.md](05-deployment.md) 了解环境配置和启动方法

**重要提示**: 启动API服务器时必须使用虚拟环境，详见[部署方案](05-deployment.md)。