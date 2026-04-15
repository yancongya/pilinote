# PiliNote UI设计规范

## 📋 目录

1. [设计原则](#设计原则)
2. [颜色系统](#颜色系统)
3. [字体排版](#字体排版)
4. [间距系统](#间距系统)
5. [圆角规范](#圆角规范)
6. [阴影系统](#阴影系统)
7. [按钮组件](#按钮组件)
8. [表单控件](#表单控件)
9. [卡片组件](#卡片组件)
10. [交互反馈](#交互反馈)
11. [响应式设计](#响应式设计)

---

## 设计原则

### 核心原则

1. **一致性优先**：所有组件遵循统一的设计语言
2. **用户友好**：交互直观，反馈清晰，操作便捷
3. **视觉层次**：通过颜色、大小、间距建立清晰的信息层级
4. **无障碍设计**：确保所有用户都能方便使用

### 设计目标

- 🎨 视觉风格统一，专业且现代
- 🚀 交互流畅，性能优秀
- 📱 完美适配各种设备
- ♿ 符合无障碍标准

---

## 颜色系统

### 主色调

```css
--color-primary-400: #8B7FFF;
--color-primary-500: #6E5AFF;
--color-primary-600: #6A5ACD;
--color-primary-700: #5A4B9D;
```

### 功能色

```css
/* 成功色 */
--color-success-50: #F0FDF4;
--color-success-100: #DCFCE7;
--color-success-200: #BBF7D0;
--color-success-400: #4ADE80;
--color-success-500: #22C55E;
--color-success-600: #10B981;

/* 警告色 */
--color-warning-50: #FFFBEB;
--color-warning-100: #FEF3C7;
--color-warning-200: #FDE68A;
--color-warning-400: #FBBF24;
--color-warning-500: #F59E0B;
--color-warning-600: #D97706;

/* 错误色 */
--color-error-50: #FEF2F2;
--color-error-100: #FEE2E2;
--color-error-200: #FECACA;
--color-error-400: #F87171;
--color-error-500: #EF4444;
--color-error-600: #DC2626;

/* 信息色 */
--color-info-50: #EFF6FF;
--color-info-100: #DBEAFE;
--color-info-200: #BFDBFE;
--color-info-400: #60A5FA;
--color-info-500: #3B82F6;
--color-info-600: #2563EB;
```

### 中性色（浅色模式）

```css
/* 背景色 */
--color-bg-primary: #FFFFFF;
--color-bg-secondary: #F8FAFC;
--color-bg-tertiary: #F1F5F9;

/* 文字色 */
--color-text-primary: #1E293B;
--color-text-secondary: #64748B;
--color-text-tertiary: #94A3B8;

/* 边框和分隔线 */
--color-border: #E2E8F0;
--color-divider: #E5E7EB;
```

### 中性色（暗色模式）

```css
/* 背景色 */
--color-bg-primary: #0F0F0F;
--color-bg-secondary: #1A1A1A;
--color-bg-tertiary: #252525;

/* 文字色 */
--color-text-primary: #E0E0E0;
--color-text-secondary: #A0A0A0;
--color-text-tertiary: #6B6B6B;

/* 边框和分隔线 */
--color-border: #333333;
--color-divider: #3A3A3A;
```

### 颜色使用规则

1. **主色调使用**：主要用于主要操作按钮、重要链接、品牌元素
2. **功能色使用**：
   - 成功色：用于成功状态、完成操作
   - 警告色：用于警告提示、需要确认的操作
   - 错误色：用于错误提示、危险操作
   - 信息色：用于信息提示、链接
3. **中性色使用**：用于背景、文字、边框等基础元素

---

## 字体排版

### 字体家族

```css
--font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
  'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
--font-family-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono',
  'Droid Sans Mono', 'Courier New', monospace;
```

### 字体大小

```css
--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-base: 16px;
--font-size-lg: 18px;
--font-size-xl: 20px;
--font-size-2xl: 24px;
--font-size-3xl: 30px;
--font-size-4xl: 36px;
```

### 字重

```css
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

### 行高

```css
--line-height-tight: 1.25;
--line-height-normal: 1.5;
--line-height-relaxed: 1.75;
```

### 排版层级

| 层级 | 字体大小 | 字重 | 行高 | 使用场景 |
|------|----------|------|------|----------|
| H1 | 36px | 700 | 1.25 | 页面主标题 |
| H2 | 30px | 600 | 1.25 | 区块标题 |
| H3 | 24px | 600 | 1.25 | 小节标题 |
| H4 | 20px | 500 | 1.5 | 卡片标题 |
| H5 | 18px | 500 | 1.5 | 副标题 |
| H6 | 16px | 500 | 1.5 | 小标题 |
| Body | 16px | 400 | 1.5 | 正文 |
| Small | 14px | 400 | 1.5 | 辅助文字 |
| Tiny | 12px | 400 | 1.5 | 提示文字 |

---

## 间距系统

### 基础间距单位

```css
--spacing-0: 0;
--spacing-1: 4px;
--spacing-2: 8px;
--spacing-3: 12px;
--spacing-4: 16px;
--spacing-5: 20px;
--spacing-6: 24px;
--spacing-8: 32px;
--spacing-10: 40px;
--spacing-12: 48px;
```

### 间距使用规则

| 间距 | 使用场景 | 示例 |
|------|----------|------|
| 4px | 超小间距 | 图标与文字之间 |
| 8px | 小间距 | 表单字段之间 |
| 12px | 中小间距 | 卡片内部元素 |
| 16px | 标准间距 | 模块之间 |
| 20px | 中等间距 | 按钮与文本 |
| 24px | 大间距 | 主要区块 |
| 32px | 超大间距 | 页面区域 |
| 40px+ | 巨大间距 | 页面级分隔 |

### 间距模式

```css
/* 内边距 */
--padding-xs: 8px 12px;
--padding-sm: 12px 16px;
--padding-md: 16px 20px;
--padding-lg: 20px 24px;
--padding-xl: 24px 32px;

/* 外边距 */
--margin-xs: 4px;
--margin-sm: 8px;
--margin-md: 12px;
--margin-lg: 16px;
--margin-xl: 24px;
```

---

## 圆角规范

```css
--radius-none: 0;
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;
```

### 圆角使用规则

| 圆角大小 | 使用场景 | 示例 |
|----------|----------|------|
| 0px | 无圆角 | 全宽分隔线 |
| 4px | 小圆角 | 标签、徽章 |
| 8px | 中圆角 | 按钮、输入框 |
| 12px | 大圆角 | 卡片、面板 |
| 16px | 超大圆角 | 模态框 |
| 9999px | 完全圆角 | 圆形按钮、头像 |

---

## 阴影系统

```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);
```

### 阴影使用规则

| 阴影 | 使用场景 | 示例 |
|------|----------|------|
| xs | 极轻微阴影 | 悬停效果 |
| sm | 轻微阴影 | 按钮、输入框 |
| md | 中等阴影 | 卡片、面板 |
| lg | 强烈阴影 | 模态框、下拉菜单 |
| xl | 超强阴影 | 悬浮元素 |

---

## 按钮组件

### 按钮类型

#### 1. Primary Button（主要按钮）

```css
.btn-primary {
  background: var(--color-primary-500);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
}

.btn-primary:hover {
  background: var(--color-primary-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

#### 2. Secondary Button（次要按钮）

```css
.btn-secondary {
  background: white;
  color: var(--color-primary-500);
  border: 1px solid var(--color-primary-500);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
}

.btn-secondary:hover {
  background: var(--color-primary-50);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.btn-secondary:active {
  transform: translateY(0);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

#### 3. Ghost Button（幽灵按钮）

```css
.btn-ghost {
  background: transparent;
  color: var(--color-text-primary);
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
}

.btn-ghost:hover {
  background: var(--color-bg-tertiary);
}

.btn-ghost:active {
  background: var(--color-bg-secondary);
}

.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

#### 4. Danger Button（危险按钮）

```css
.btn-danger {
  background: var(--color-error-500);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
}

.btn-danger:hover {
  background: var(--color-error-600);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-danger:active {
  transform: translateY(0);
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

#### 5. Icon Button（图标按钮）

```css
.btn-icon {
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
  padding: 10px;
  border-radius: 8px;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 40px;
}

.btn-icon:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.btn-icon:active {
  background: var(--color-bg-secondary);
}

.btn-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 按钮尺寸

```css
/* Small */
.btn-sm {
  padding: 8px 16px;
  font-size: 14px;
  min-height: 36px;
}

/* Medium */
.btn-md {
  padding: 12px 24px;
  font-size: 16px;
  min-height: 44px;
}

/* Large */
.btn-lg {
  padding: 16px 32px;
  font-size: 18px;
  min-height: 52px;
}
```

### 按钮使用规范

1. **主要按钮**：用于页面最重要的操作，每个页面最多1-2个
2. **次要按钮**：用于次重要的操作
3. **幽灵按钮**：用于不强调的操作或辅助功能
4. **危险按钮**：用于删除、取消等危险操作，需谨慎使用
5. **图标按钮**：用于工具栏、操作菜单等空间有限的场景
6. **最小触摸目标**：所有按钮最小尺寸为40×40px

---

## 表单控件

### 输入框（Input）

```css
.input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 16px;
  color: var(--color-text-primary);
  background: white;
  transition: all 0.2s ease;
  min-height: 44px;
}

.input:hover {
  border-color: var(--color-primary-400);
}

.input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(110, 90, 255, 0.1);
}

.input:disabled {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}

.input.error {
  border-color: var(--color-error-500);
}

.input.error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}
```

### 下拉菜单（Select）

```css
.select {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 16px;
  color: var(--color-text-primary);
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 44px;
}

.select:hover {
  border-color: var(--color-primary-400);
}

.select:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(110, 90, 255, 0.1);
}

.select:disabled {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}
```

### 复选框（Checkbox）

```css
.checkbox {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox:hover {
  border-color: var(--color-primary-500);
}

.checkbox:checked {
  background: var(--color-primary-500);
  border-color: var(--color-primary-500);
}

.checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 单选框（Radio）

```css
.radio {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.radio:hover {
  border-color: var(--color-primary-500);
}

.radio:checked {
  border-color: var(--color-primary-500);
}

.radio:checked::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--color-primary-500);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.radio:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 表单控件使用规范

1. **最小触摸目标**：所有表单控件最小高度为44px
2. **焦点状态**：所有控件必须有清晰的焦点状态
3. **错误状态**：错误状态必须使用红色边框和提示
4. **禁用状态**：禁用状态必须降低透明度并显示禁用光标
5. **一致性**：所有表单控件样式必须统一

---

## 卡片组件

### 基础卡片

```css
.card {
  background: white;
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  padding: 16px;
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

### 可点击卡片

```css
.card-clickable {
  background: white;
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.card-clickable:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  background: var(--color-bg-secondary);
}

.card-clickable:active {
  transform: translateY(0);
}
```

### 选中卡片

```css
.card-selected {
  background: var(--color-info-50);
  border: 2px solid var(--color-primary-500);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  padding: 16px;
}
```

### 卡片使用规范

1. **统一圆角**：所有卡片使用12px圆角
2. **阴影层次**：默认使用轻微阴影，悬停使用中等阴影
3. **内边距**：卡片内部统一使用16px内边距
4. **过渡效果**：所有卡片必须有平滑的过渡效果
5. **可点击提示**：可点击卡片必须有悬停效果和光标提示

---

## 交互反馈

### 悬停状态（Hover）

```css
/* 按钮悬停 */
.button:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

/* 链接悬停 */
.link:hover {
  color: var(--color-primary-600);
  text-decoration: underline;
}

/* 卡片悬停 */
.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

### 点击状态（Active）

```css
.button:active {
  transform: translateY(0);
}

.button:active {
  background: var(--color-primary-600);
}
```

### 焦点状态（Focus）

```css
.input:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px rgba(110, 90, 255, 0.1);
}
```

### 禁用状态（Disabled）

```css
.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input:disabled {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}
```

### 加载状态（Loading）

```css
.button.loading {
  position: relative;
  pointer-events: none;
}

.button.loading::after {
  content: '';
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

### 过渡动画

```css
/* 标准过渡 */
.transition {
  transition: all 0.2s ease;
}

/* 快速过渡 */
.transition-fast {
  transition: all 0.15s ease;
}

/* 慢速过渡 */
.transition-slow {
  transition: all 0.3s ease;
}
```

### 交互反馈规范

1. **所有可交互元素**必须有悬停状态
2. **所有按钮**必须有点击状态
3. **所有表单控件**必须有焦点状态
4. **禁用状态**必须降低透明度并显示禁用光标
5. **加载状态**必须有明确的视觉反馈
6. **过渡动画**时间统一为0.2s，特殊情况除外

---

## 响应式设计

### 断点系统

```css
--breakpoint-xs: 0;
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

### 响应式规则

| 断点 | 设备类型 | 屏幕宽度 | 特性 |
|------|----------|----------|------|
| xs | 超小屏幕 | < 640px | 手机竖屏 |
| sm | 小屏幕 | 640px - 767px | 手机横屏 |
| md | 中等屏幕 | 768px - 1023px | 平板竖屏 |
| lg | 大屏幕 | 1024px - 1279px | 平板横屏/小桌面 |
| xl | 超大屏幕 | 1280px - 1535px | 桌面 |
| 2xl | 超超大屏幕 | ≥ 1536px | 大桌面 |

### 移动端优先

```css
/* 默认样式（移动端） */
.container {
  padding: 16px;
  font-size: 16px;
}

/* 平板及以上 */
@media (min-width: 768px) {
  .container {
    padding: 24px;
    font-size: 18px;
  }
}

/* 桌面及以上 */
@media (min-width: 1024px) {
  .container {
    padding: 32px;
    font-size: 20px;
  }
}
```

### 触摸目标规范

- **最小触摸目标**：44×44px
- **推荐触摸目标**：48×48px
- **按钮内边距**：至少12px

### 响应式设计规范

1. **移动端优先**：默认为移动端样式，逐步增强
2. **触摸友好**：所有可点击元素必须满足最小触摸目标
3. **字体缩放**：字体大小应根据屏幕尺寸适当调整
4. **间距调整**：间距应根据屏幕尺寸适当调整
5. **布局适配**：布局应在不同屏幕尺寸下保持可用性

---

## 实施检查清单

### 颜色系统
- [ ] 所有硬编码颜色已替换为CSS变量
- [ ] 主色调使用统一
- [ ] 功能色使用正确
- [ ] 暗色模式适配完整

### 字体排版
- [ ] 字体大小符合规范
- [ ] 字重使用合理
- [ ] 行高设置正确
- [ ] 排版层级清晰

### 间距系统
- [ ] 间距使用统一规范
- [ ] 内边距外边距设置合理
- [ ] 响应式间距调整正确

### 圆角规范
- [ ] 圆角大小符合规范
- [ ] 统一使用CSS变量

### 阴影系统
- [ ] 阴影层次清晰
- [ ] 悬停效果统一

### 按钮组件
- [ ] 所有按钮使用标准样式
- [ ] 按钮类型使用正确
- [ ] 按钮尺寸符合规范
- [ ] 交互状态完整

### 表单控件
- [ ] 所有表单控件样式统一
- [ ] 焦点状态清晰
- [ ] 错误状态明确
- [ ] 禁用状态明显

### 卡片组件
- [ ] 卡片样式统一
- [ ] 圆角大小一致
- [ ] 阴影层次合理
- [ ] 悬停效果统一

### 交互反馈
- [ ] 所有可交互元素有悬停状态
- [ ] 所有按钮有点击状态
- [ ] 所有表单控件有焦点状态
- [ ] 加载状态明确
- [ ] 过渡动画统一

### 响应式设计
- [ ] 移动端布局合理
- [ ] 触摸目标符合规范
- [ ] 字体大小响应式调整
- [ ] 间距响应式调整
- [ ] 布局在不同设备下可用

---

## 附录

### 工具类参考

```css
/* 文字颜色 */
.text-primary { color: var(--color-text-primary); }
.text-secondary { color: var(--color-text-secondary); }
.text-tertiary { color: var(--color-text-tertiary); }

/* 背景颜色 */
.bg-primary { background: var(--color-bg-primary); }
.bg-secondary { background: var(--color-bg-secondary); }
.bg-tertiary { background: var(--color-bg-tertiary); }

/* 间距 */
.p-4 { padding: 16px; }
.p-6 { padding: 24px; }
.m-4 { margin: 16px; }
.m-6 { margin: 24px; }

/* 圆角 */
.rounded-md { border-radius: 8px; }
.rounded-lg { border-radius: 12px; }

/* 阴影 */
.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow-md { box-shadow: var(--shadow-md); }

/* 文字大小 */
.text-sm { font-size: 14px; }
.text-base { font-size: 16px; }
.text-lg { font-size: 18px; }
```

### 常见问题

**Q: 何时使用主色调vs功能色？**
A: 主色调用于品牌元素和主要操作，功能色用于状态指示和特定操作。

**Q: 按钮最小尺寸是多少？**
A: 所有按钮最小尺寸为40×40px，推荐尺寸为44×44px。

**Q: 如何处理暗色模式？**
A: 使用CSS变量定义颜色，在暗色模式下重新定义变量值。

**Q: 响应式设计的优先级是什么？**
A: 移动端优先，从最小屏幕开始设计，逐步增强到大屏幕。

---

**文档版本**: 1.0.0
**最后更新**: 2026-04-15
**维护者**: PiliNote Team
**适用范围**: PiliNote Web应用

---

## 变更日志

### v1.0.0 (2026-04-15)
- 初始版本
- 定义完整的设计系统规范
- 包含颜色、字体、间距、圆角、阴影
- 定义按钮、表单、卡片组件规范
- 定义交互反馈和响应式设计规范