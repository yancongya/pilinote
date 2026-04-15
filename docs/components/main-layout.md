# MainLayout 主布局组件

## 概述

主布局组件，负责应用的整体布局结构，包括顶部导航栏、侧边栏、内容区域和主题切换功能。

## 文件位置

`apps/web/src/components/MainLayout.tsx`

## 主要功能

### 1. 布局管理

- **顶部导航栏**：应用标题、WiFi图标、导航模式切换按钮、暗色模式切换按钮
- **侧边栏**：桌面端导航菜单，支持侧边栏/底部导航模式切换
- **内容区域**：主要业务内容显示
- **底部导航**：移动端导航栏，支持侧边栏/底部导航模式切换
- **移动端菜单**：移动端侧边栏菜单，支持从左侧滑出

### 2. 导航模式切换

#### 导航模式切换功能

**切换按钮位置**：顶部导航栏WiFi图标右侧

**图标**：
- 侧边栏模式：下载图标（`Download`）
- 底部导航模式：菜单图标（`Menu`）

**功能特性**：
- 点击切换侧边栏/底部导航模式
- 桌面端和移动端都支持模式切换
- 切换后自动关闭移动端菜单
- 模式状态在组件内管理，不持久化

#### 实现方式

```typescript
const [navMode, setNavMode] = useState<'sidebar' | 'bottom'>('sidebar')

const toggleNavMode = () => {
  setNavMode(prev => prev === 'sidebar' ? 'bottom' : 'sidebar')
  setMobileMenuOpen(false)
}
```

#### 模式说明

**侧边栏模式**：
- 桌面端：显示左侧侧边栏导航
- 移动端：隐藏底部导航，通过菜单按钮打开侧边栏

**底部导航模式**：
- 桌面端：隐藏侧边栏，显示底部导航栏
- 移动端：显示底部导航栏，隐藏侧边栏

### 3. 移动端菜单

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

### 断点设置

| 断点 | 说明 |
|------|------|
| ≤ 767px | 移动端 - 显示菜单按钮，根据导航模式显示侧边栏或底部导航 |
| ≥ 768px | 桌面端 - 根据导航模式显示侧边栏或底部导航 |

### 导航模式响应式行为

**侧边栏模式**：
- 桌面端（≥768px）：显示左侧固定侧边栏
- 移动端（≤767px）：隐藏侧边栏，显示菜单按钮，点击后从左侧滑出侧边栏

**底部导航模式**：
- 桌面端（≥768px）：隐藏侧边栏，显示底部导航栏
- 移动端（≤767px）：显示底部导航栏，隐藏侧边栏

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