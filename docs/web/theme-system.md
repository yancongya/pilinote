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
--color-success-50: #F0FDF4    /* 成功浅色 */
--color-success-200: #BBF7D0   /* 成功中色 */
--color-success-600: #16A34A   /* 成功深色 */
--color-warning-50: #FFFBEB    /* 警告浅色 */
--color-warning-200: #FDE68A   /* 警告中色 */
--color-warning-600: #D97706   /* 警告深色 */
--color-error-50: #FEF2F2      /* 错误浅色 */
--color-error-200: #FECACA     /* 错误中色 */
--color-error-600: #DC2626      /* 错误深色 */
--color-info-50: #EFF6FF       /* 信息浅色 */
--color-info-200: #BFDBFE      /* 信息中色 */
--color-info-600: #2563EB      /* 信息深色 */
```

#### 语义化颜色
```css
--color-bg-primary: #FFFFFF      /* 主要背景 */
--color-bg-secondary: #F8FAFC    /* 次要背景 */
--color-bg-tertiary: #F1F5F9    /* 第三背景 */
--color-text-primary: #1E293B     /* 主要文字 */
--color-text-secondary: #64748B   /* 次要文字 */
--color-text-tertiary: #94A3B8    /* 第三文字 */
--color-border: #E2E8F0           /* 边框 */
--color-divider: #E5E7EB          /* 分隔线 */
```

### 2. 暗色模式配置

#### 全局暗色模式变量
```css
.dark {
  /* 背景色 - 黑色主题 */
  --color-bg-primary: #0f0f0f      /* 纯黑色 */
  --color-bg-secondary: #1a1a1a    /* 深灰 */
  --color-bg-tertiary: #2a2a2a    /* 中灰 */
  --color-bg-hover: #3a3a3a       /* 悬停 */
  
  /* 文字色 */
  --color-text-primary: #E0E0E0     /* 主要文字 */
  --color-text-secondary: #94A3B8   /* 次要文字 */
  --color-text-tertiary: #64748B    /* 第三文字 */
  
  /* 边框色 */
  --color-border: #2a2a2a           /* 边框 */
  --color-border-hover: #3a3a3a    /* 悬停边框 */
  
  /* 功能色暗色模式 */
  --color-success-50: rgba(34, 197, 94, 0.1)
  --color-success-200: rgba(34, 197, 94, 0.2)
  --color-success-600: #22C55E
  --color-warning-50: rgba(245, 158, 11, 0.1)
  --color-warning-200: rgba(245, 158, 11, 0.2)
  --color-warning-600: #F59E0B
  --color-error-50: rgba(239, 68, 68, 0.1)
  --color-error-200: rgba(239, 68, 68, 0.2)
  --color-error-600: #EF4444
  --color-info-50: rgba(59, 130, 246, 0.1)
  --color-info-200: rgba(59, 130, 246, 0.2)
  --color-info-600: #3B82F6
}
```

### 3. 组件适配列表

#### 核心组件
- ✅ Toast - 完全适配，现代化设计
- ✅ Modal - 完全适配，支持深色背景
- ✅ AlertModal - 完全适配
- ✅ ConfirmModal - 完全适配

#### 页面组件
- ✅ HomeContent - 完全适配
- ✅ FavoritesContent - 完全适配
- ✅ WatchLaterContent - 完全适配
- ✅ VideoDetailPage - 完全适配
- ✅ VideoListCard - 完全适配

#### 新下载组件
- ✅ SchedulerCard - 完全适配
- ✅ TaskCard - 完全适配
- ✅ VideoLibrary - 完全适配
- ✅ DownloadsList - 完全适配
- �   ScanResultContent - 完全适配

#### 设置页面
- ✅ SettingsPage - 完全适配，主题切换功能
- ✅ AccountsSettings - 完全适配
- ✅ DownloadSettings - 完全适配
- ✅ StorageSettings - 完全适配
- ✅ AutoDownloadSettings - 完全适配
- ✅ BackupSettings - 完全适配

## Toast组件主题支持

### 设计特点
- **现代化图标**：每种状态有独特的SVG图标
- **进度条显示**：底部显示剩余时间
- **关闭按钮**：支持手动关闭
- **响应式设计**：手机、平板、电脑完全适配
- **毛玻璃效果**：backdrop-filter模糊背景

### CSS变量使用
```tsx
const themes = {
  success: { 
    bg: 'var(--color-success-50)', 
    border: 'var(--color-success-200)', 
    icon: 'var(--color-success-600)',
    progress: 'var(--color-success-600)'
  },
  // ...其他类型
}
```

### 响应式断点
- **手机模式** (< 640px)：紧凑布局，padding: 12px
- **平板模式** (641px - 1024px)：适中布局，padding-top: 20px
- **电脑模式** (> 1025px)：宽敞布局，padding-top: 32px

## 使用指南
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

## 更新日志

### 2026-04-15 - 主题切换修复和优化

#### 修复
- **硬编码颜色修复**：修复多个组件中的硬编码颜色问题，改用CSS变量
  - `.group-date` 类：`#1a1a1a` → `var(--color-text-primary)`
  - `.series-title` 类：`#1a1a1a` → `var(--color-text-primary)`
  - `.stat-value` 类：`#1a1a1a` → `var(--color-text-primary)`
  - `section-header` h2标题：`#1f2937` → `var(--color-text-primary)`

#### 影响
- **"稍后再看"页面**：标题现在在暗色模式下正确显示为浅色文本
- **"我的收藏"页面**：标题颜色正确响应主题切换
- **全局组件**：所有使用上述类的组件现在都支持主题切换
- **颜色一致性**：消除了硬编码颜色，确保全站主题一致性

#### 技术细节
- 使用 `!important` 确保主题变量优先级
- 通过CSS变量实现动态主题切换
- 保持原有的视觉效果和对比度
- 符合WCAG可访问性标准

#### 验证结果
- ✅ 浅色模式：标题显示 `rgb(30, 41, 59)`（深色文本）
- ✅ 暗色模式：标题显示 `rgb(224, 224, 224)`（浅色文本）
- ✅ 主题切换：平滑无闪烁
- ✅ 所有页面：主题切换功能完全正常

### 2026-04-15 - 新下载页面暗色模式完整适配

#### 修复
- **大规模硬编码颜色修复**：修复NewDownload/index.css中的硬编码颜色问题
  - **249个硬编码颜色**全部替换为CSS变量
  - **18个白色背景**全部替换为主题变量
  - 所有组件完全适配暗色模式

#### 修复范围
- **扫描记录面板**：`#scan-panel > div > div.scan-records` 背景色修复
- **下载列表控制按钮**：`#downloads-panel > div > div` 按钮组背景色修复
- **视频库卡片**：`#library-panel > div > div.task-list` 卡片背景色修复
- **三个Tab按钮**：所有标签按钮背景色和文字色修复

#### 技术细节
- 使用Python脚本批量替换硬编码颜色
- 建立完整的颜色映射表（40+映射关系）
- 修复包括：背景色、文字色、边框色、渐变色等
- 特殊处理：hover状态、active状态、focus状态

#### 颜色映射示例
| 原硬编码颜色 | 主题变量 | 用途 |
|--------------|----------|------|
| `#f8fafc` | `var(--color-bg-secondary)` | 次要背景 |
| `#ffffff` | `var(--color-bg-primary)` | 主要背景 |
| `#1e293b` | `var(--color-text-primary)` | 主要文字 |
| `#64748b` | `var(--color-text-secondary)` | 次要文字 |
| `#e2e8f0` | `var(--color-border)` | 边框 |
| `#2563eb` | `var(--color-primary-600)` | 主品牌色 |

#### 影响组件
- ✅ `DownloadsList` - 下载列表
- ✅ `TaskCard` - 任务卡片
- ✅ `SchedulerCard` - 调度器卡片
- ✅ `VideoLibrary` - 视频库
- ✅ `ScanResultContent` - 扫描结果

#### 验证结果
- ✅ 硬编码颜色检查：0个剩余
- ✅ TypeScript编译：成功
- ✅ Vite构建：成功
- ✅ 主题变量使用：100%
- ✅ 暗色模式显示：完全正常
- ✅ 主题切换响应：流畅无闪烁