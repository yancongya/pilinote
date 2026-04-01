# 下载系统升级计划

## 概述

本目录包含 PiliNote 下载系统的升级计划文档，主要针对以下两个核心优化：

1. **Aria2c 集成** - 使用 Aria2c 多线程下载器提升下载速度
2. **WebSocket 实时进度** - 实现下载进度的实时推送，无需刷新页面

## 文档索引

| 文档 | 说明 | 状态 |
|------|------|------|
| [01-aria2c-integration.md](./01-aria2c-integration.md) | Aria2c 集成方案详细说明 | 📝 待实施 |
| [02-websocket-realtime-progress.md](./02-websocket-realtime-progress.md) | WebSocket 实时进度推送方案 | 📝 待实施 |
| [03-download-upgrade-roadmap.md](./03-download-upgrade-roadmap.md) | 下载系统升级路线图 | 📝 规划中 |

## 升级目标

### 性能目标
- 下载速度提升 30-50%
- 支持 8-16 并发连接
- 更好的断点续传能力

### 用户体验目标
- 实时显示下载进度
- 无需刷新页面
- 更流畅的交互体验

### 技术目标
- 零风险升级（完全向后兼容）
- 可配置性（用户可选择）
- 自动降级（失败时回退）

## 兼容性保证

所有升级都遵循以下原则：

- ✅ **完全向后兼容** - 不影响现有功能
- ✅ **渐进式升级** - 可逐步实施
- ✅ **可选配置** - 用户可随时开关
- ✅ **自动降级** - 失败时不影响使用

## 当前进度

| 阶段 | 功能 | 状态 |
|------|------|------|
| Phase 0 | 当前状态（yt-dlp 内置下载器） | ✅ 已完成 |
| Phase 1 | Aria2c 集成 | 📝 规划中 |
| Phase 2 | WebSocket 实时进度 | 📝 规划中 |
| Phase 3 | 性能测试和优化 | ⏳ 待开始 |

## 相关文档

- [Aria2c 官方文档](https://aria2.github.io/)
- [yt-dlp 文档](https://github.com/yt-dlp/yt-dlp)
- [WebSocket 协议](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)

## 注意事项

1. 所有升级都需要充分测试
2. 需要考虑不同操作系统的兼容性
3. 需要监控升级后的性能指标
4. 准备好回滚方案

---

**创建时间**: 2026-04-01  
**最后更新**: 2026-04-01  
**维护者**: PiliNote 开发团队