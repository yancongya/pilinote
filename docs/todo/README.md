# PiliNote 待实现功能

## 概述

本目录包含PiliNote项目中待实现功能的详细说明文档。这些功能尚未完成或需要进一步规划。

## 文档列表

### 核心功能
- [04-file-organization.md](04-file-organization.md) - 文件组织方案
  - 自动分类文件
  - 字幕/弹幕下载
  - 元数据保存
  - 文件夹组织逻辑

### 规划文档
- [07-development-roadmap.md](07-development-roadmap.md) - 开发路线图
  - Phase 1: 核心功能（Week 1-2）
  - Phase 2: 视频源管理（Week 3）
  - Phase 3: 下载管理（Week 4）
  - Phase 4: 文件组织（Week 5）
  - Phase 5: 部署优化（Week 6）
  - Phase 6: 桌面端（Week 7-8）

### 认证功能
- [11-auth-upgrade-plan.md](11-auth-upgrade-plan.md) - 认证升级计划
  - 扫码登录升级
  - SESSDATA登录增强
  - 密码登录优化
  - Geetest验证集成

- [13-auth-upgrade-requirements.md](13-auth-upgrade-requirements.md) - 认证升级需求
  - 功能需求
  - 技术需求
  - UI/UX需求
  - 安全需求

### 数据管理
- [15-data-management-implementation-plan.md](15-data-management-implementation-plan.md) - 数据管理实现计划
  - 数据库设计
  - 缓存管理
  - 数据迁移
  - 备份恢复

## 开发优先级

### 高优先级
1. **文件组织方案** - 完善下载文件的自动分类和管理
2. **认证升级** - 提升用户体验和安全性
3. **数据管理** - 完善数据持久化和备份功能

### 中优先级
1. **部署优化** - Docker配置和环境优化
2. **桌面端开发** - Electron跨平台应用

### 低优先级
1. **高级功能** - 插件机制、API开放

## 开发流程

1. **需求分析** - 查看对应的待实现文档
2. **技术调研** - 参考reference/目录下的实现
3. **方案设计** - 制定详细的技术方案
4. **开发实现** - 按照方案进行开发
5. **测试验证** - 充分测试功能
6. **文档更新** - 更新相关文档和API说明
7. **代码提交** - 提交代码并更新待实现文档状态

## 注意事项

1. **依赖关系** - 某些功能之间存在依赖关系，需要按顺序实现
2. **兼容性** - 新功能需要与现有功能保持兼容
3. **性能考虑** - 优化性能，避免资源浪费
4. **用户体验** - 重视用户体验，简化操作流程

## 文档维护

- 实现完成后，将文档移动到`docs/dev/`目录
- 更新文档状态为"已完成"
- 更新开发路线图
- 添加实现说明和测试结果

## 相关文档

- [../dev/README.md](../dev/README.md) - 已完成功能文档
- [../../CHANGELOG.md](../../CHANGELOG.md) - 开发日志
- [../../AGENTS.md](../../AGENTS.md) - 项目上下文