# MainLayout 主布局组件

## 概述

主布局组件，负责应用的整体布局结构，包括顶部导航栏、侧边栏、内容区域和主题切换功能。

## 文件位置

`apps/web/src/components/MainLayout.tsx`

## 主要功能

### 1. 布局管理

- **顶部导航栏**：应用标题、WiFi图标、暗色模式切换按钮
- **侧边栏**：桌面端自动显示左侧固定侧边栏，支持拖拽调整宽度和收缩
- **内容区域**：主要业务内容显示
- **底部导航**：移动端自动显示底部导航栏
- **拖拽手柄**：侧边栏右侧拖拽区域，用于调整宽度
- **折叠按钮**：侧边栏底部的折叠按钮，用于收缩/展开侧边栏

### 2. 自动响应式切换

#### 自动切换机制

**切换逻辑**：系统根据屏幕宽度自动切换布局模式，无需手动操作

- **移动端（< 768px）**：自动显示底部导航栏，隐藏侧边栏
- **桌面端（≥ 768px）**：自动显示左侧固定侧边栏，隐藏底部导航

#### 实现方式

```typescript
// 自动检测移动端状态
const [isMobile, setIsMobile] = useState(false)

useEffect(() => {
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768)
  }
  
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  return () => window.removeEventListener('resize', checkMobile)
}, [])
```

#### 自动切换特性

- **实时响应**：窗口大小变化时立即切换布局
- **无缝过渡**：布局切换使用平滑动画，用户体验流畅
- **智能适配**：根据设备类型自动选择最佳导航方式
- **无需配置**：系统自动处理所有切换逻辑

### 3. 侧边栏拖拽调整宽度

#### 拖拽调整功能

**拖拽手柄位置**：侧边栏右侧边缘

**视觉反馈**：
- 鼠标悬停：显示拖拽手柄和提示
- 拖拽时：手柄高亮，光标变为调整图标
- 拖拽范围：180px - 400px

**功能特性**：
- 点击拖拽手柄并左右拖动可调整侧边栏宽度
- 支持实时预览宽度变化
- 自动收缩：当宽度小于200px时自动进入收缩状态
- 宽度限制：最小180px，最大400px

#### 实现方式

```typescript
const [sidebarWidth, setSidebarWidth] = useState(240)
const [isDragging, setIsDragging] = useState(false)
const dragRef = useRef<HTMLDivElement>(null)

// 拖拽调整侧边栏宽度
useEffect(() => {
  const dragHandle = dragRef.current
  if (!dragHandle) return

  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    const newWidth = e.clientX
    const minWidth = 180
    const maxWidth = 400
    
    if (newWidth >= minWidth && newWidth <= maxWidth) {
      setSidebarWidth(newWidth)
      setSidebarCollapsed(newWidth < 200)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  dragHandle.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)

  return () => {
    dragHandle.removeEventListener('mousedown', handleMouseDown)
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }
}, [isDragging])
```

#### 拖拽效果

**宽度调整**：
- 默认宽度：240px
- 最小宽度：180px
- 最大宽度：400px
- 实时预览：拖拽过程中即时显示效果

**自动收缩**：
- 宽度 < 200px：自动进入收缩状态
- 宽度 ≥ 200px：自动进入展开状态
- 平滑过渡：宽度变化使用动画过渡

### 4. 侧边栏收缩功能

#### 侧边栏收缩功能

**折叠按钮位置**：侧边栏底部（在导航菜单下方）

**图标**：
- 展开状态：左箭头图标（`ArrowLeftToLine`）
- 收缩状态：右箭头图标（`ArrowRightToLine`）

**功能特性**：
- 点击折叠按钮可切换展开/收缩状态
- 拖拽侧边栏宽度小于200px时自动收缩
- 拖拽侧边栏宽度大于等于200px时自动展开
- 收缩状态下只显示图标，隐藏文字标签
- 展开宽度：可拖拽调整（180px-400px），收缩宽度：70px

#### 两种触发方式

**方式一：点击折叠按钮**
- 折叠按钮位于侧边栏底部
- 点击按钮切换展开/收缩状态
- 展开时显示左箭头，收缩时显示右箭头
- 按钮宽度与侧边栏宽度一致

**方式二：拖拽调整宽度**
- 拖拽侧边栏右侧边界
- 当宽度 < 200px时自动收缩
- 当宽度 ≥ 200px时自动展开
- 支持任意宽度调整（180px-400px）

#### 收缩效果

**展开状态**：
- 显示完整图标和文字标签
- 宽度：可拖拽调整（默认240px）
- 图标和文字间距：12px
- 文字标签正常显示
- 底部折叠按钮显示左箭头

**收缩状态**：
- 仅显示图标，隐藏文字标签
- 宽度：固定70px
- 图标居中显示
- 底部折叠按钮显示右箭头
- 支持拖拽边界调整宽度

### 4. 移动端菜单

#### 移动端菜单功能

**菜单按钮位置**：顶部导航栏左侧（仅移动端显示）

**图标**：
- 菜单关闭：菜单图标（`Menu`）
- 菜单打开：关闭图标（`X`）

**功能特性**：
- 点击打开/关闭移动端侧边栏
- 侧边栏从左侧滑出，带动画效果
- 半透明遮罩背景，点击遮罩关闭菜单
- 选择菜单项后自动关闭菜单
- 切换导航模式时自动关闭菜单

#### 实现方式

```typescript
const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

const toggleMobileMenu = () => {
  setMobileMenuOpen(!mobileMenuOpen)
}

// 侧边栏点击事件
onClick={() => {
  handleTabChange(item.path)
  setMobileMenuOpen(false) // 选择菜单项后关闭
}}
```

#### 移动端侧边栏样式

**侧边栏**：
- 固定定位，从左侧滑出
- 宽度280px，高度100%
- 背景色使用主题变量
- 带平滑过渡动画
- z-index: 1001，确保在最上层

**遮罩层**：
- 固定定位，覆盖全屏
- 半透明黑色背景（rgba(0, 0, 0, 0.5)）
- z-index: 1000，在侧边栏下方
- 点击关闭侧边栏
- 带淡入动画效果

### 4. 主题切换

#### 主题切换功能

**切换按钮位置**：顶部导航栏WiFi图标左侧

**图标**：
- 亮色模式：月亮图标（`Moon`）
- 暗色模式：太阳图标（`Sun`）

**功能特性**：
- 点击切换亮色/暗色模式
- localStorage持久化用户偏好
- 自动检测系统主题设置
- 页面刷新后保持选择

#### 实现方式

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

// 初始化时检查localStorage和系统偏好
useEffect(() => {
  const savedMode = localStorage.getItem('darkMode')
  if (savedMode === 'true') {
    setDarkMode(true)
    document.documentElement.classList.add('dark')
  } else if (savedMode === 'false') {
    setDarkMode(false)
    document.documentElement.classList.remove('dark')
  } else {
    // 检测系统偏好
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setDarkMode(prefersDark)
    if (prefersDark) {
      document.documentElement.classList.add('dark')
    }
  }
}, [])
```

### 5. 认证状态管理

- 检查用户登录状态
- 显示登录提示界面
- 管理用户会话

### 6. 路由管理

- 使用 React Router 管理页面路由
- 支持嵌套路由
- 404 页面处理

## 布局结构

### 桌面端布局

```
┌─────────────────────────────────────────────┐
│  标题            🌙 暗色模式    📶 WiFi     │ ← 顶部导航
├──────────┬──────────────────────────────────────┤
│          │                                      │
│  侧边栏  │          内容区域                 │
│          │                                      │
│  ┌────┐  │  ┌──────────────────────────────┐ │
│  │🏠  │  │  │                              │ │
│  │⭐  │  │  │                              │ │
│  │📁  │  │  │                              │
│  │⚙️  │  │  │                              │
│  └────┘  │  │                              │
│          │  └──────────────────────────────┘ │
└──────────┴──────────────────────────────────────┘
```

### 移动端布局

```
┌─────────────────────────────────────────────┐
│  标题            🌙 暗色模式              │ ← 顶部导航
├─────────────────────────────────────────────┤
│                                           │
│              内容区域                       │
│                                           │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │                                      │  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
├─────────────────────────────────────────────┤
│  🏠首页    ⭐收藏    📁稍后再看    ⚙️设置   │ ← 底部导航
└─────────────────────────────────────────────┘
```

## 组件结构

```tsx
function MainLayout() {
  const { isAuthenticated, user } = useAuthStore()
  const [darkMode, setDarkMode] = useState(false)
  const [navMode, setNavMode] = useState<'sidebar' | 'bottom'>('sidebar')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  return (
    <div className="app">
      {/* 顶部导航栏 */}
      <Header 
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        navMode={navMode}
        onToggleNavMode={toggleNavMode}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={toggleMobileMenu}
      />
      
      {/* 主体内容 */}
      <main className="app-main">
        {/* 移动端侧边栏遮罩 */}
        {mobileMenuOpen && (
          <MobileSidebarOverlay onClick={() => setMobileMenuOpen(false)} />
        )}
        
        {/* 侧边栏（支持桌面端和移动端） */}
        <Sidebar 
          mobileOpen={mobileMenuOpen}
          mode={navMode}
        />
        
        {/* 内容区域 */}
        <Content />
        
        {/* 底部导航（根据模式显示/隐藏） */}
        <BottomNav visible={navMode === 'bottom'} />
      </main>
    </div>
  )
}
```

## 主题系统

### CSS 变量使用

组件使用 CSS 变量系统，确保在亮色和暗色模式下都有良好的显示效果：

```tsx
// 使用 CSS 变量定义样式
<div className="dark:text-white dark:bg-gray-900">
  内容
</div>
```

### 暗色模式配色

- 主背景：`#0f0f0f` （纯黑色）
- 次要背景：`#1a1a1a` （深灰）
- 第三级背景：`#2a2a2a` （中灰）
- 主要文字：`#E0E0E0` （浅灰白）
- 次要文字：`#94A3B8` （中灰）
- 边框颜色：`#2a2a2a` （中灰）

## 登录提示

### 登录提示组件

当用户未登录时显示登录提示界面：

```tsx
function LoginPrompt({ message }: { message: string }) {
  const navigate = useNavigate()
  
  return (
    <section className="content-section" style={{ textAlign: 'center', padding: '80px 20px' }}>
      <LogIn 
        className="empty-state-icon" 
        style={{ 
          width: '64px', 
          height: '64px', 
          color: 'var(--color-text-tertiary)', 
          marginBottom: '20px' 
        }} 
      />
      <h3 
        className="dark:text-color-text-primary" 
        style={{ 
          fontSize: '20px', 
          fontWeight: '600', 
          color: 'var(--color-text-primary)', 
          marginBottom: '12px' 
        }}
      >
        请先登录
      </h3>
      <p 
        className="dark:text-color-text-secondary" 
        style={{ 
          fontSize: '16px', 
          color: 'var(--color-text-secondary)', 
          marginBottom: '24px' 
        }}
      >
        {message}
      </p>
      <button
        onClick={() => navigate('/login')}
        className="dark:bg-primary-700 dark:hover:bg-primary-800"
        style={{
          padding: '12px 24px',
          background: 'var(--color-primary-600)',
          color: 'var(--color-white)',
          border: 'none',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: '500',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        去登录
      </button>
    </section>
  )
}
```

## 响应式设计

### 自动响应式断点

| 断点 | 屏幕宽度 | 导航方式 | 侧边栏状态 |
|------|----------|----------|------------|
| 移动端 | < 768px | 底部导航 | 隐藏 |
| 桌面端 | ≥ 768px | 左侧侧边栏 | 显示，支持拖拽调整 |

### 自动切换行为

**移动端（< 768px）**：
- 自动显示底部导航栏
- 隐藏侧边栏
- 保留移动端菜单按钮（用于特殊场景）
- 侧边栏可通过菜单按钮从左侧滑出

**桌面端（≥ 768px）**：
- 自动显示左侧固定侧边栏
- 隐藏底部导航栏
- 侧边栏支持拖拽调整宽度
- 侧边栏支持收缩/展开

### 拖拽调整功能

**拖拽手柄**：
- 位置：侧边栏右侧边缘
- 视觉：3px宽的可拖拽区域
- 悬停效果：高亮显示，光标变为调整图标

**拖拽操作**：
1. 将鼠标移动到侧边栏右侧边缘
2. 看到光标变为调整图标（col-resize）
3. 按住鼠标左键并左右拖动
4. 释放鼠标完成调整

**拖拽限制**：
- 最小宽度：180px
- 最大宽度：400px
- 自动收缩阈值：200px
- 实时预览效果

### 收缩操作

**方式一：点击折叠按钮**
1. 找到侧边栏底部的折叠按钮
2. 点击按钮切换展开/收缩状态
3. 观察侧边栏宽度变化和图标变化

**方式二：拖拽调整宽度**
1. 拖拽侧边栏右侧边界
2. 将宽度拖到 < 200px 自动收缩
3. 将宽度拖到 ≥ 200px 自动展开
4. 支持任意宽度调整

### 布局切换实现

```tsx
// 侧边栏响应式显示
const Sidebar = styled.aside<{ $mobileOpen?: boolean; $mode?: 'sidebar' | 'bottom' }>`
  display: none;
  width: 240px;
  
  /* 根据导航模式控制桌面端显示 */
  ${(props) => props.$mode === 'bottom' && css`
    @media (min-width: 768px) {
      display: none;
    }
  `}
  
  ${(props) => props.$mode === 'sidebar' && css`
    @media (min-width: 768px) {
      display: block;
    }
  `}
  
  /* 移动端侧边栏 */
  @media (max-width: 767px) {
    position: fixed;
    top: 0;
    left: 0;
    width: 280px;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    z-index: 1001;
    
    ${(props) => props.$mobileOpen && css`
      transform: translateX(0);
    `}
  }
`;

// 底部导航响应式显示
const BottomNav = styled.nav<{ $visible?: boolean }>`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  
  /* 根据可见性控制 */
  ${(props) => !props.$visible && css`
    display: none;
  `}
  
  /* 桌面端根据导航模式显示 */
  @media (min-width: 768px) {
    ${(props) => props.$visible && css`
      display: flex;
    `}
  }
`;

// 移动端菜单按钮
const MobileMenuToggle = styled.button`
  @media (min-width: 768px) {
    display: none;  /* 桌面端隐藏 */
  }
`;
```

## 性能优化

### CSS 变量使用

- 所有颜色使用 CSS 变量，减少重复代码
- 暗色模式切换无需重新加载样式
- 使用 `backdrop-filter` 提升视觉效果

### 状态管理

- 使用 Zustand 管理全局状态
- 主题切换响应迅速
- 避免不必要的重新渲染

## 关联文档

- [主题系统设计](../web/theme-system.md) - 完整的主题系统设计文档
- [设计令牌系统](../web/theme-system.md#设计令牌系统) - CSS 变量系统说明
- [侧边栏组件](../components/sidebar.md) - 侧边栏导航组件

## 更新日志

### 2026-04-15 - 优化侧边栏折叠按钮位置

#### 优化
- **折叠按钮位置调整**：将折叠按钮从顶部导航栏移至侧边栏底部
- **侧边栏内部按钮**：折叠按钮现在位于侧边栏底部，宽度与侧边栏一致
- **简化顶部导航**：移除顶部导航栏的折叠按钮，界面更简洁
- **改善用户体验**：折叠按钮更靠近侧边栏，操作更直观

#### 功能保持
- **拖拽调整功能**：保持拖拽调整侧边栏宽度功能不变
- **自动收缩机制**：保持宽度阈值自动收缩功能不变
- **双重触发方式**：保持点击折叠按钮和拖拽调整两种方式

#### 技术实现
- 使用flexbox布局将折叠按钮固定在侧边栏底部
- 折叠按钮添加顶部边框与导航菜单分隔
- 图标根据收缩状态动态切换（左箭头/右箭头）
- 样式组件：SidebarCollapseButton替代SidebarCollapseToggle

#### 新增
- **自动响应式切换**：基于屏幕尺寸自动切换侧边栏/底部导航，无需手动操作
- **拖拽调整宽度**：支持拖拽侧边栏右侧边界调整宽度（180px-400px）
- **智能收缩机制**：拖拽宽度小于200px时自动收缩，大于等于200px时自动展开
- **拖拽手柄**：侧边栏右侧添加拖拽区域，支持鼠标悬停高亮和调整光标

#### 优化
- **移除手动位置切换**：删除位置切换按钮，改为系统自动适配
- **简化UI布局**：减少手动控制元素，界面更加简洁
- **优化移动端体验**：移动端始终显示底部导航，操作更加直观
- **增强桌面端体验**：桌面端侧边栏支持拖拽调整，满足个性化需求

#### 技术亮点
- **实时响应**：使用useEffect监听窗口尺寸变化，实时切换布局
- **拖拽实现**：通过鼠标事件监听实现流畅的拖拽调整功能
- **智能阈值**：200px宽度阈值自动触发收缩/展开状态
- **平滑过渡**：所有状态变化使用CSS动画，用户体验流畅
- **宽度限制**：最小180px、最大400px，确保布局稳定性

#### 用户体验提升
- **零学习成本**：自动适配，无需用户了解切换逻辑
- **个性化定制**：支持拖拽调整侧边栏宽度，满足不同需求
- **智能感知**：系统能够根据屏幕尺寸和用户操作智能调整
- **操作便捷**：拖拽和点击两种方式，满足不同使用习惯

### 2026-04-15 - 导航模式和移动端菜单增强

#### 新增
- **导航模式切换**：支持侧边栏/底部导航模式切换，桌面端和移动端都可用
- **移动端菜单按钮**：在移动端添加汉堡菜单按钮，用于打开侧边栏
- **移动端侧边栏**：移动端侧边栏从左侧滑出，带动画效果和遮罩层
- **导航模式切换按钮**：在顶部导航栏添加导航模式切换按钮

#### 更新
- **响应式布局优化**：根据导航模式和设备类型动态调整布局
- **移动端交互优化**：选择菜单项后自动关闭侧边栏，切换导航模式时自动关闭菜单
- **样式组件增强**：使用styled-components实现响应式布局和动画效果

#### 技术亮点
- **模式状态管理**：使用React状态管理导航模式和移动端菜单状态
- **平滑动画**：侧边栏滑出/收起使用CSS transition实现平滑动画
- **遮罩层交互**：半透明遮罩层，点击即可关闭侧边栏
- **响应式断点**：768px断点区分移动端和桌面端行为

### 2026-04-15 - 暗色模式全面实现

#### 新增
- **主题切换功能**：在顶部导航栏WiFi图标左侧添加暗色模式切换按钮
- **CSS变量系统**：所有样式使用CSS变量，自动适配亮色/暗色模式
- **持久化存储**：使用localStorage保存用户主题偏好
- **系统偏好检测**：自动检测系统主题设置

#### 更新
- **所有组件适配暗色模式**：核心组件、页面组件、设置组件全面支持暗色模式
- **统一设计令牌**：建立完整的CSS变量系统和品牌色系统
- **响应式设计优化**：暗色模式下保持响应式布局

#### 技术亮点
- **无缝切换**：主题切换平滑，无闪烁
- **自动适配**：所有组件自动使用CSS变量
- **统一主题**：全站统一的黑色主题（非深蓝色）
- **可访问性**：颜色对比度符合WCAG标准

---

[返回上级](./README.md)