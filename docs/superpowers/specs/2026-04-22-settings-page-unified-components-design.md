# 设置页统一组件设计

## Summary

将设置页重构为一套统一的组件骨架，让所有 tab 和 tab 内部面板组都通过同一套前端基础组件渲染。页面级仍保留现有业务拆分，但视觉层、间距层、状态层和交互层全部收敛到统一的 settings 组件体系中。

本设计建立在现有 Radix UI / shadcn 风格封装之上，复用已经落地的 `Dialog`、`Tabs`、`Toast`、`Panel` 组件，不再让各个设置页自己定义 tab 栏、卡片、确认弹窗和基础布局。

## Goals

- 统一所有设置 tab 的外观与布局骨架。
- 统一 tab 内部面板组、字段组、危险区、状态提示的视觉规范。
- 保留现有业务逻辑和数据流，不把设置页改造成 schema 驱动的低可维护方案。
- 让后续升级设计时只改一套组件，而不是逐页改 className。

## Architecture

### Page Shell

`SettingsPage` 只负责：
- 页面标题和返回按钮
- 统一 tab 导航
- tab 路由/hash 同步
- 全局保存入口
- 当前 tab 的激活态和 dirty 状态汇总

### Tab Shell

每个设置 tab 统一渲染为以下结构：
- 顶部摘要区：标题、说明、状态徽标
- 主内容区：多个 `SettingsSection`
- 底部操作区：保存、重置、危险操作

### Section System

tab 内的所有内容块统一收敛为以下组件：
- `SettingsSection`
- `SettingsSectionHeader`
- `SettingsSectionBody`
- `SettingsSectionFooter`
- `SettingsField`
- `SettingsFieldLabel`
- `SettingsFieldHelp`
- `SettingsFieldError`
- `SettingsActionRow`
- `SettingsDangerZone`
- `SettingsStatusBadge`

这些组件都建立在当前已有的 `Panel` 和 `Tabs` 封装之上，样式继续使用项目现有 CSS 变量和 dark mode 令牌。

## Implementation Changes

### 1. 新增统一 settings 组件层

新增 `apps/web/src/components/settings/`，集中放置可复用组件。组件目标不是“更高级的业务能力”，而是统一外观、间距、层级和状态表达。

建议初始组件集：
- `SettingsPageShell`
- `SettingsTabShell`
- `SettingsSection`
- `SettingsSectionHeader`
- `SettingsSectionBody`
- `SettingsSectionFooter`
- `SettingsField`
- `SettingsFieldLabel`
- `SettingsFieldHelp`
- `SettingsFieldError`
- `SettingsActionRow`
- `SettingsDangerZone`
- `SettingsStatusBadge`

### 2. 将 tab 栏统一接入 Radix Tabs

`SettingsPage` 继续使用当前 hash 驱动的 tab 逻辑，但 tab 视觉交互统一由 `Tabs / TabsList / TabsTrigger` 提供。

要求：
- tab 的 active / hover / focus 由统一组件处理
- 未保存状态在 tab 上以统一 badge 或 dot 表达
- 禁止每个 tab 再自定义自己的 tab bar indicator

### 3. 设置内容统一为 section 结构

各 tab 内部内容不再直接堆 `div` + 局部样式，而是必须按 section 分组：

- 账号页
  - 已登录账号
  - 添加账号
  - 账号详情
  - 危险操作区

- 下载页
  - 下载路径
  - 并发/重试
  - 后处理
  - 高级设置

- 存储页
  - 存储路径
  - 缓存/清理
  - 迁移/导入

- 备份页
  - 自动备份
  - 手动备份
  - 恢复备份

- 定时页
  - 定时任务
  - 执行条件
  - 调度状态

- 视频库页
  - 媒体库连接
  - 扫描状态
  - 目录/分类

- AI 笔记页
  - provider 和模型
  - prompt 模板
  - 样式/格式
  - 运行状态与高级设置

### 4. 页面级状态统一

统一保存、保存中、保存失败、已保存状态的表达方式：
- 顶部全局保存按钮仍保留
- tab 上显示 dirty 状态
- section 头部可以显示局部状态
- 危险操作区必须与普通设置区明显分离

### 5. 兼容现有业务组件

不重写业务逻辑，只调整外壳：
- `SettingsPage`
- `AccountsSettings`
- `DownloadSettings`
- `StorageSettings`
- `BackupSettings`
- `AutoDownloadSettings`
- `VideoLibrarySettings`
- `AiNoteSettings`

这些组件可以继续保留内部 state、请求和数据处理，只是 UI 由统一组件替代散落布局。

## Testing

### Visual and interaction checks

- tab 切换时，active 样式、键盘焦点和 hash 同步正常。
- 各 tab 的 section 间距、标题层级、说明文案和按钮位置一致。
- dirty 状态在 tab 与页面级保存按钮上都可见。
- 危险操作区与普通区视觉分层明确。

### Regression checks

- 账号页的切换、删除、查看凭证、刷新账号不受影响。
- AI 笔记页的 provider 切换、模板编辑、保存与重置不受影响。
- 下载/存储/备份 tab 的保存逻辑保持原样。
- 移动端下 tab 和 section 的滚动行为保持可用。

### Acceptance criteria

- 不同 tab 的布局风格从“各写各的”变成“同一套骨架”。
- 新增一个设置项时，优先复用现有 settings 组件，而不是新增局部样式块。
- 后续全局改版时，主要改 `settings` 组件层即可覆盖大部分 tab。

## Assumptions

- 本次只统一设置页骨架和面板组件，不重做所有表单控件的底层实现。
- 现有 Radix / shadcn 风格封装继续作为基础库使用，不引入第二套 UI 框架。
- 业务逻辑、接口和数据结构保持不变。
- AI 笔记页和账号页会作为第一批迁移样板，之后再按同一模式扩展到其他 tab。

