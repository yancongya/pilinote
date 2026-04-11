# PiliNote UI/UX 设计系统

## 设计理念

PiliNote 采用 **Soft UI Evolution** 设计风格，这是改进的 Neumorphism 设计，提供更好的对比度、现代感和可访问性。

### 核心原则

1. **现代美学**: 结合 flat design 和 neumorphism 的优点，提供柔和的深度感
2. **可访问性优先**: 所有交互元素符合 WCAG AA 标准（对比度 ≥ 4.5:1）
3. **流畅交互**: 150-300ms 的微交互动画，提供自然的反馈
4. **响应式设计**: 从 375px 移动端到 1440px+ 桌面端的全设备适配
5. **性能优化**: 使用 transform 和 opacity 实现高性能动画

## 设计系统

### 配色方案

#### 主色调
```
Primary:    #2563EB (专业蓝)
Secondary:  #3B82F6 (明亮蓝)
Accent:     #F97316 (橙色 CTA)
```

#### 中性色
```
Background:  #F8FAFC (优雅浅灰)
Surface:     #FFFFFF (白色)
Text:        #1E293B (深灰黑)
Text Muted:  #64748B (中灰)
Border:      #E2E8F0 (浅灰边框)
```

#### 语义色
```
Error:       #DC2626 (错误红)
Error BG:    #FEE2E2 (错误背景)
Success:     #16A34A (成功绿)
Success BG:  #DCFFE4 (成功背景)
Warning:     #D97706 (警告黄)
```

### 字体系统

#### 字体家族
```
Primary: Inter (Google Fonts)
  - Weights: 300, 400, 500, 600, 700
  - Usage: 所有界面文字
```

#### 字体层级
```
Heading 1:  32px / 700 / 1.2
Heading 2:  24px / 700 / 1.3
Heading 3:  20px / 600 / 1.4
Body:       16px / 400 / 1.6
Caption:    14px / 500 / 1.5
Small:      13px / 500 / 1.6
```

#### 行高规范
```
Heading:  1.2 - 1.4
Body:     1.5 - 1.6
Caption:  1.5
```

### 间距系统

采用 4px 基础单位，构建一致的间距节奏：

```
xs:   4px   (0.25rem)
sm:   8px   (0.5rem)
md:   12px  (0.75rem)
lg:   16px  (1rem)
xl:   24px  (1.5rem)
2xl:  32px  (2rem)
3xl:  48px  (3rem)
4xl:  64px  (4rem)
```

### 圆角系统

```
sm:   6px   (小元素)
md:   8px   (按钮)
lg:   12px  (卡片)
xl:   16px  (大卡片)
2xl:  20px  (模态框)
full: 9999px (圆形)
```

### 阴影系统

#### Soft UI Evolution 阴影

```
shadow-xs:  0 1px 2px rgba(0, 0, 0, 0.04)
shadow-sm:  0 2px 4px rgba(0, 0, 0, 0.06)
shadow-md:  0 4px 12px rgba(37, 99, 235, 0.15), 0 2px 4px rgba(0, 0, 0, 0.08)
shadow-lg:  0 8px 20px rgba(37, 99, 235, 0.25), 0 4px 8px rgba(0, 0, 0, 0.08)
shadow-xl:  0 20px 60px rgba(0, 0, 0, 0.25)
```

#### 焦点阴影
```
focus-ring: 0 0 0 4px rgba(37, 99, 235, 0.1), 0 4px 12px rgba(37, 99, 235, 0.15)
```

### 动画系统

#### 时长规范
```
fast:  150ms (微交互)
base:  200ms (标准过渡)
slow:  300ms (复杂动画)
slower: 400ms (页面切换)
```

#### 缓动函数
```
ease-out:  cubic-bezier(0.4, 0, 0.2, 1)  (进入)
ease-in:   cubic-bezier(0, 0, 0.2, 1)  (退出)
spring:    cubic-bezier(0.4, 0, 0.2, 1)  (弹性)
```

#### 动画类型
```
opacity:   透明度变化（推荐）
transform: 位移/缩放/旋转（推荐）
all:       所有属性过渡（谨慎使用）
```

## 组件设计规范

### 按钮

#### 主要按钮（Primary Button）
- **背景**: 线性渐变 #2563EB → #3B82F6
- **尺寸**: 高度 48px
- **圆角**: 12px
- **文字**: 白色, 16px, 700
- **阴影**: shadow-md
- **悬停**: 向上位移 2px, shadow-lg
- **按下**: scale(0.98), shadow-md
- **焦点**: 3px 蓝色外边框
- **禁用**: 灰度背景, 无阴影

#### 次要按钮（Secondary Button）
- **背景**: 白色或透明
- **边框**: 2px solid #E2E8F0
- **文字**: #64748B, 14px, 600
- **悬停**: 边框色加深, 背景色变化

### 输入框

#### 标准输入框
- **高度**: 48px
- **内边距**: 16px 垂直, 48px 水平（含图标）
- **圆角**: 12px
- **边框**: 2px solid #E2E8F0
- **文字**: #1E293B, 15px, 500
- **占位符**: #94A3B8
- **悬停**: 边框色 #CBD5E1, shadow-sm
- **焦点**: 边框 #2563EB, focus-ring, 向上位移 1px
- **禁用**: 背景 #F8FAFC, 边框 #E2E8F0, 透明度 0.6

### Tab 切换

#### Tab 按钮
- **高度**: 48px 最小
- **内边距**: 14px 20px
- **圆角**: 12px
- **文字**: #64748B, 14px, 600
- **背景**: 透明
- **悬停**: 文字 #2563EB, 背景 rgba(255, 255, 255, 0.8), 向上位移 1px
- **激活**: 白色背景, 文字 #2563EB, shadow-md, 向上位移 2px

### 卡片

#### 标准卡片
- **圆角**: 16px
- **背景**: 白色
- **边框**: 1px solid #E2E8F0
- **阴影**: shadow-md
- **内边距**: 24px
- **悬停**: 阴影增强, 向上位移 2px

### 模态框

#### 标准模态框
- **圆角**: 16px
- **背景**: 白色
- **阴影**: shadow-xl
- **最大宽度**: 400px (移动端), 600px (桌面端)
- **内边距**: 24px
- **遮罩**: rgba(0, 0, 0, 0.5), backdrop-filter blur(4px)

## 响应式断点

```
Mobile:    < 640px  (小屏手机)
Tablet:    640px - 1024px  (平板)
Desktop:   > 1024px  (桌面端)
Large:     > 1440px  (大屏)
```

### 移动端优先
- 从 375px 小屏开始设计
- 逐步适配到更大屏幕
- 触摸目标 ≥ 44×44px
- 横向滚动必须避免

### 桌面端增强
- 最大宽度控制（max-w-6xl / 7xl）
- 充分利用横向空间
- 鼠标悬停效果
- 键盘导航完整支持

## 可访问性规范

### 对比度要求
- **普通文字**: ≥ 4.5:1 (AA)
- **大号文字**: ≥ 3:1 (AA)
- **组件边框**: ≥ 3:1

### 焦点状态
- 所有交互元素必须有可见焦点
- 焦点样式: 2-3px 外边框
- 焦点顺序符合视觉顺序
- 支持键盘导航

### 屏幕阅读器
- 所有图标有 aria-label
- 表单元素有关联 label
- 状态变化有 aria-live 通知
- 语义化 HTML 结构

### 减少运动
- 支持 prefers-reduced-motion
- 可选择禁用动画
- 保持功能完整性

## 性能优化

### CSS 动画
- 只使用 transform 和 opacity
- 避免触发 layout 重排
- 使用 will-change 优化已知动画
- 动画时长 ≤ 400ms

### 图片优化
- 使用 WebP/AVIF 格式
- 响应式图片（srcset）
- 懒加载非关键图片
- 预留空间防止布局偏移

### 字体加载
- 使用 font-display: swap
- 预加载关键字体
- 避免隐形文字（FOIT）

### 代码分割
- 路由级别代码分割
- 懒加载非关键组件
- 动态导入大型库

## 设计 Token

### 颜色 Token
```css
--color-primary: #2563EB;
--color-primary-light: #3B82F6;
--color-background: #F8FAFC;
--color-surface: #FFFFFF;
--color-text: #1E293B;
--color-text-muted: #64748B;
--color-border: #E2E8F0;
--color-error: #DC2626;
--color-success: #16A34A;
```

### 间距 Token
```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 16px;
--space-xl: 24px;
--space-2xl: 32px;
--space-3xl: 48px;
```

### 圆角 Token
```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 20px;
```

### 阴影 Token
```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 12px rgba(37, 99, 235, 0.15), 0 2px 4px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 20px rgba(37, 99, 235, 0.25), 0 4px 8px rgba(0, 0, 0, 0.08);
```

### 动画 Token
```css
--duration-fast: 150ms;
--duration-base: 200ms;
--duration-slow: 300ms;
--easing-out: cubic-bezier(0.4, 0, 0.2, 1);
--easing-in: cubic-bezier(0, 0, 0.2, 1);
```

## 设计资源

### 设计工具
- **Figma**: 可用设计 Token 和组件库
- **Sketch**: 可用设计 Token
- **Adobe XD**: 可用设计 Token

### 字体资源
- **Google Fonts**: https://fonts.google.com/share?selection?family=Inter:wght@300;400;500;600;700
- **NPM**: `@fontsource/inter`

### 图标库
- **Lucide React**: https://lucide.dev/
- **Heroicons**: https://heroicons.com/

## 实施检查清单

### 设计一致性
- [ ] 使用设计 Token（不硬编码颜色/间距）
- [ ] 统一的圆角大小
- [ ] 一致的阴影层次
- [ ] 统一的动画时长和缓动

### 可访问性
- [ ] 对比度 ≥ 4.5:1
- [ ] 所有交互元素有焦点状态
- [ ] 键盘导航完整支持
- [ ] 屏幕阅读器标签正确
- [ ] 支持减少运动偏好

### 响应式
- [ ] 375px 小屏测试通过
- [ ] 768px 平板测试通过
- [ ] 1024px 桌面测试通过
- [ ] 1440px 大屏测试通过
- [ ] 横向模式测试通过

### 性能
- [ ] 动画使用 transform/opacity
- [ ] 无不必要的重排
- [ ] 图片懒加载
- [ ] 代码分割优化
- [ ] 字体加载优化

### 用户体验
- [ ] 清晰的视觉层次
- [ ] 直观的交互反馈
- [ ] 合理的动画时长
- [ ] 流畅的过渡效果
- [ ] 错误提示清晰明确

## 更新日志

### 2026-03-30
- ✅ 创建 Soft UI Evolution 设计系统
- ✅ 定义配色方案、字体系统、间距系统
- ✅ 建立组件设计规范
- ✅ 实现登录页面 UI/UX 优化
- ✅ 添加可访问性支持
- ✅ 完善响应式设计

## 参考资料

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design 3](https://m3.material.io/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Soft UI Evolution](https://www.figma.com/community/file/1159615734354037418)