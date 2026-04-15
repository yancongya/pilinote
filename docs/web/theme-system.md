# 主题系统设计

## 概述

PiliNote 实现了完整的暗色模式支持和统一的设计令牌系统，确保在亮色和暗色主题下都有良好的用户体验。

## 技术架构

### 1. 设计令牌系统

**文件**: `apps/web/src/design-tokens.css`

基于 CSS 变量 的统一设计令牌系统，包含：

#### 品牌色
```css
--color-primary-600: #2563EB  /* 主品牌色 */
--color-primary-700: #1D4ED8
--color-primary-500: #3B82F6
```

#### 辅助色
```css
--color-secondary-500: #64748B  /* 灰色系 */
--color-secondary-200: #E2E8F0
--color-secondary-900: #0F172A
```

#### 功能色
```css
--color-success-500: #22C55E   /* 成功 */
--color-warning-500: #F59E0B   /* 警告 */
--color-error-500: #EF4444     /* 错误 */
--color-info-500: #3B82F6      /* 信息 */
```

#### 语义化颜色
```css
--color-bg-primary: #FFFFFF      /* 主要背景 */
--color-bg-secondary: #F8FAFC    /* 次要背景 */
--color-text-primary: #1E293B     /* 主要文字 */
--color-text-secondary: #64748B   /* 次要文字 */
--color-border: #E2E8F0           /* 边框 */
```

### 2. 暗色模式配置

#### 全局暗色模式变量
```css
.dark {
  --color-bg-primary: #0f0f0f;
  --color-bg-secondary: #1a1a1a;
  --color-bg-tertiary: #2a2a2a;
  --color-text-primary: #E0E0E0;
  --color-text-secondary: #94A3B8;
  --color-border: #2a2a2a;
}
```

#### 阴影系统
```css
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-primary: 0 4px 12px rgba(37, 99, 235, 0.15);
```

### 3. Tailwind 配置

**文件**: `apps/web/tailwind.config.js`

所有颜色配置使用 CSS 变量：

```javascript
colors: {
  primary: {
    600: 'var(--color-primary-600)',
    700: 'var(--color-primary-700)',
    500: 'var(--color-primary-500)',
  },
  // ... 其他颜色
}
```

## 主题切换功能

### 实现位置

**组件**: `apps/web/src/components/MainLayout.tsx`

```typescript
const [darkMode, setDarkMode] = useState(false)

const toggleDarkMode = () => {
  setDarkMode(!darkMode)
  if (!darkMode) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('darkMode', 'true')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('darkMode', 'false')
  }
}
```

### 持久化

- 使用 `localStorage` 保存用户偏好
- 自动检测系统偏好设置
- 页面刷新后保持选择

### 切换按钮

- 位置：顶部导航栏 WiFi 图标左侧
- 图标：太阳/月亮切换
- 样式：带动画的圆形按钮

## 已适配的组件

### 核心组件
- ✅ `MainLayout.tsx` - 主布局和主题切换
- ✅ `Toast.tsx` - 消息提示
- ✅ `Modal.tsx` - 模态框
- ✅ `AlertModal.tsx` - 警告模态框
- ✅ `ConfirmModal.tsx` - 确认模态框

### 页面组件
- ✅ `SettingsPage.tsx` - 设置页面
- ✅ `VideoDetailPage.tsx` - 视频详情页
- ✅ `HomeContent.tsx` - 首页内容
- ✅ `FavoritesContent.tsx` - 收藏夹内容
- ✅ `WatchLaterContent.tsx` - 稍后再看内容
- ✅ `VideoListCard.tsx` - 视频卡片

### 新下载组件
- ✅ `VideoLibrary.tsx` - 视频库
- ✅ `SchedulerCard.tsx` - 调度器卡片
- ✅ `TaskCard.tsx` - 任务卡片
- ✅ `DownloadsList.tsx` - 下载列表
- ✅ `ScanResultContent.tsx` - 扫描结果

### 设置页面组件
- ✅ `AccountsSettings.tsx` - 账号设置
- ✅ `AutoDownloadSettings.tsx` - 自动下载设置
- ✅ `DownloadSettings.tsx` - 下载设置
- ✅ `StorageSettings.tsx` - 存储设置
- ✅ `BackupSettings.tsx` - 备份设置

### 其他组件
- ✅ `VideoListContainer.tsx` - 视频列表容器

## CSS 样式文件

### 1. `design-tokens.css`
- 设计令牌系统定义
- 亮色/暗色模式变量
- 阴影、间距、圆角等设计变量

### 2. `index.css`
- 全局样式
- 暗色模式全局样式
- 登录页面样式
- 主页样式

### 3. `settings-page.css`
- 设置页面专用样式
- 完整的暗色模式支持
- 卡片、表单、按钮等组件样式

## 颜色使用规范

### 使用 CSS 变量
```css
/* 正确 */
.my-component {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
}

/* 错误 - 禁止硬编码 */
.my-component {
  background: #FFFFFF;
  color: #1E293B;
  border: 1px solid #E2E8F0;
}
```

### 使用 Tailwind 类名
```tsx
/* 正确 - 使用 dark: 前缀 */
<div className="bg-white dark:bg-black dark:text-white">
  内容
</div>

/* 正确 - 使用设计令牌 */
<div className="bg-primary-600 dark:bg-primary-700">
  按钮
</div>
```

## 暗色模式设计原则

### 1. 背景色层级
- 主背景：`#0f0f0f` （纯黑色）
- 次要背景：`#1a1a1a` （深灰）
- 第三级背景：`#2a2a2a` （中灰）

### 2. 文字颜色
- 主要文字：`#E0E0E0` （浅灰白）
- 次要文字：`#94A3B8` （中灰）
- 第三级文字：`#64748B` （深灰）

### 3. 边框和分隔线
- 主要边框：`#2a2a2a` （中灰）
- 悬停边框：`#3a3a3a` （浅灰）

### 4. 交互状态
- 激活边框：`#2563EB` （品牌色）
- 悬停背景：`rgba(37, 99, 235, 0.1)` （品牌色透明）

## 响应式设计

暗色模式在所有设备上都支持：
- 📱 移动端（≤768px）
- 💻 平板端（769px - 1024px）
- 🖥️ 桌面端（≥1025px）

## 可访问性

- 颜色对比度符合 WCAG AA 标准
- 支持系统偏好设置检测
- 键盘导航支持
- 屏幕阅读器支持

## 测试清单

### 功能测试
- [ ] 主题切换按钮工作正常
- [ ] localStorage 持久化正确
- [ ] 页面刷新后主题保持
- [ ] 系统偏好设置检测正常

### 视觉测试
- [ ] 所有页面在亮色模式下显示正常
- [ ] 所有页面在暗色模式下显示正常
- [ ] 颜色对比度符合标准
- [ ] 动画和过渡效果流畅

### 组件测试
- [ ] 核心组件适配暗色模式
- [ ] 页面组件适配暗色模式
- [ ] 设置页面所有元素适配暗色模式
- [ ] 表单输入框和按钮样式正确

## 性能优化

- CSS 变量减少样式计算
- 暗色模式切换无闪烁
- 最小化重排和重绘
- 使用 CSS transform 和 opacity 进行动画

## 未来扩展

### 计划功能
- [ ] 自动跟随系统主题
- [ ] 更多主题预设
- [ ] 自定义主题色
- [ ] 动态主题切换动画
- [ ] 高对比度模式

### 扩展点
- 添加新的颜色变量
- 支持更多设备主题
- 集成第三方主题库
- 主题导入/导出功能

## 相关文档

- [前端实现](implementation.md) - 前端架构和组件
- [组件文档](../components/README.md) - 通用组件说明
- [系统架构](../architecture/system.md) - 整体架构

---

**最后更新**: 2026-04-15
**维护者**: PiliNote Team