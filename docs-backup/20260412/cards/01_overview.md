# 卡片系统概览

- 目标
  - 为 Watch Later 与 收藏页的视频卡片建立统一的数据模型、显示规范和元数据收集流程。
- 当前状况
  - 数据源来自后端接口（watchlater 和 favorites）以及对外 API 的回传字段。
  - 存在字段显示为 0 的情况，可能原因包括数据源缺失、字段映射错误或前端默认占位符。
- 主要设计点
  - 统一的 Card 组件接口（VideoCard），支持可配置字段：id、title、cover、duration、view、danmaku、comment、like、coin、favorite、share、pubtime、uploader 信息等。
  - 不同数据源输出保持一致的字段集合，前端仅渲染已有的字段，缺失字段走默认值或占位符。
  - 元数据收集策略：从后端 API 获取并规范化到统一字段集，减少前端逻辑分支。

后续将完善 02/03/04 文档以覆盖数据源、组件实现、元数据收集的具体实现。
