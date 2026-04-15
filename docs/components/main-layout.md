# MainLayout 主布局组件

## 概述

主布局组件，负责应用的整体布局结构，包括顶部导航栏、侧边栏、内容区域和主题切换功能。

## 文件位置

`apps/web/src/components/MainLayout.tsx`

## 主要功能

### 1. 布局管理

- **顶部导航栏**：应用标题、WiFi图标、暗色模式切换按钮
- **侧边栏**：桌面端导航菜单
- **内容区域**：主要业务内容显示
- **底部导航**：移动端导航栏

### 2. 主题切换

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

### 3. 认证状态管理

- 检查用户登录状态
- 显示登录提示界面
- 管理用户会话

### 4. 路由管理

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
  
  return (
    <div className="app">
      {/* 顶部导航栏 */}
      <Header 
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      
      {/* 主体内容 */}
      <main className="app-main">
        {/* 桌面端侧边栏 */}
        <Sidebar />
        
        {/* 内容区域 */}
        <Content />
        
        {/* 移动端底部导航 */}
        <BottomNav />
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
| ≤ 768px | 移动端 - 显示底部导航，隐藏侧边栏 |
| ≥ 769px | 桌面端 - 显示侧边栏，隐藏底部导航 |

### 布局切换

```tsx
// 移动端
@media (max-width: 768px) {
  .home-sidebar { display: none; }
  .bottom-nav { display: flex; }
}

// 桌面端
@media (min-width: 769px) {
  .home-sidebar { display: flex; }
  .bottom-nav { display: none; }
}
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