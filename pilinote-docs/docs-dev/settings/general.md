# 通用设置

通用设置模块管理系统通用配置，包括主题、语言、自动下载全局开关和剪贴板监控功能。

## 配置项

| 键 | 说明 | 默认值 | 可选值 |
|----|------|-------|--------|
| theme | 主题设置 | auto | auto, light, dark |
| language | 语言设置 | zh-CN | zh-CN, en-US |
| auto_download | 自动下载全局开关 | false | true, false |
| clipboard_monitor | 剪贴板监控 | false | true, false |

---

## 数据流

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                          前端 (General Settings)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  主题设置  │  │  语言设置  │  │  自动下载  │  │ 剪贴板   │         │
│  │  (切换)   │  │  (切换)   │  │  (开关)   │  │  (监听)   │         │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘         │
│        │             │             │             │               │
│        └─────────────┴─────┬──────┴─────────────┘               │
│                      ┌─────▼─────┐                              │
│                      │ SettingsStore │                             │
│                      └─────┬─────┘                              │
└──────────────────────────│──────────────────────────────────────────
                    ┌──────▼──────┐
                    │ GET/PUT /api/settings
                    └──────┬──────┘
                          │
┌─────────────────────────▼──────────────────────────────────────────────┐
│                      后端 (FastAPI)                                  │
│                                                                    │
│  ┌──────────────┐  ┌────────────────────────────────┐               │
│  │settings.py │  │ SettingsService                  │               │
│  │/api/settings│  │  get_settings()                 │               │
│  └────────────┘  │  update_settings()              │               │
│                   └────────────┬───────────────────┘               │
│                               │                                  │
│                    ┌──────────▼──────────┐                      │
│                    │   Setting 模型   │                      │
│                    │   settings 表  │                      │
│                    └───────────────┘                          │
└───────────────────────────────────────────────────────────────
```

---

## 前端实现

### 主题切换 (MainLayout.tsx)

主题切换通过 CSS 类名实现，存储在 localStorage 中：

```typescript
// 主题状态管理
const [theme, setTheme] = useState('auto')

// 应用主题
useEffect(() => {
  const root = document.documentElement
  
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    // auto: 跟随系统
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
}, [theme])

// 监听系统主题变化
useEffect(() => {
  if (theme !== 'auto') return
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e: MediaQueryListEvent) => {
    document.documentElement.classList.toggle('dark', e.matches)
  }
  
  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}, [theme])
```

### 剪贴板监控

剪贴板监控在 MainLayout 中实现：

```typescript
// 剪贴板监控
const [clipboardMonitor, setClipboardMonitor] = useState(false)
const [lastClipboard, setLastClipboard] = useState('')

useEffect(() => {
  if (!clipboardMonitor) return
  
  const checkClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text && text !== lastClipboard) {
        setLastClipboard(text)
        
        // 识别 Bilibili 链接
        const bilibiliPatterns = [
          /bilibili\.com\/video\/(BV[\w]+)/,
          /b23\.tv\/([\w]+)/
        ]
        
        for (const pattern of bilibiliPatterns) {
          const match = text.match(pattern)
          if (match) {
            // 触发事件或自动添加任务
            onLinkDetected?.(match[1])
            break
          }
        }
      }
    } catch (e) {
      // 剪贴板访问被拒绝
    }
  }
  
  const interval = setInterval(checkClipboard, 1000)
  return () => clearInterval(interval)
}, [clipboardMonitor, lastClipboard])
```

### 支持的链接格式

| 格式 | 示例 | 提取 ID |
|------|------|--------|
| 视频 BV 号 | `https://www.bilibili.com/video/BV1xx411c7mD` | BV1xx411c7mD |
| 短链接 | `https://b23.tv/xxxxxx` | xxxxxx |
| AV 号 | `https://www.bilibili.com/av12345678` | 12345678 |

---

## 后端实现

### Schema 定义 (schemas/settings.py)

```python
class GeneralSettings(BaseModel):
    """通用设置"""
    theme: str = Field(default="auto")  # auto/light/dark
    language: str = Field(default="zh-CN")  # zh-CN/en-US
    auto_download: bool = Field(default=False)  # 自动下载全局开关
    clipboard_monitor: bool = Field(default=False)  # 剪贴板监控
```

### 获取设置 (services/settings_service.py)

```python
def get_settings(self) -> Settings:
    """获取所有设置"""
    # 提取 general 设置
    general_settings = GeneralSettings(
        theme=self._get_setting_value(all_settings, 'general.theme', 'auto'),
        language=self._get_setting_value(all_settings, 'general.language', 'zh-CN'),
        auto_download=self._get_setting_value(all_settings, 'general.auto_download', False),
        clipboard_monitor=self._get_setting_value(all_settings, 'general.clipboard_monitor', False)
    )
```

---

## 主题系统

### 主题模式

| 值 | 说明 | 实现方式 |
|----|------|--------|
| auto | 跟随系统主题 | `prefers-color-scheme` |
| light | 浅色模��� | 移除 dark 类 |
| dark | 深色模式 | 添加 dark 类 |

### CSS 变量

主题通过 CSS 变量实现：

```css
/* 亮色主题 */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f8fafc;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --border-color: #e2e8f0;
}

/* 深色主题 */
:root.dark {
  --bg-primary: #1e293b;
  --bg-secondary: #0f172a;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --border-color: #334155;
}
```

---

## 交互流程

### 主题切换流程

```
1. 用户点击主题切换按钮
   ↓
2. 打开主题选择菜单（auto/light/dark）
   ↓
3. 用户选择主题
   ↓
4. 更新本地状态 setTheme()
   ↓
5. 应用 CSS 类名到 document.documentElement
   ↓
6. 保存到 localStorage（持久化）
   ↓
7. 同时调用 updateSettings API（同步到后端）
```

### 剪贴板监控流程

```
1. 用户开启剪贴板监控开关
   ↓
2. 启动 setInterval 定时器（每秒检查）
   ↓
3. 读取剪贴板内容
   ↓
4. 正则匹配 Bilibili 链接
   ↓
5. 提取视频 ID
   ↓
6. 触发添加任务或显示提示
   ↓
7. 用户关闭时清除定时器
```

---

## API 详情

### 获取设置

```
GET /api/settings
```

响应：
```json
{
    "download": { ... },
    "storage": { ... },
    "general": {
        "theme": "auto",
        "language": "zh-CN",
        "auto_download": false,
        "clipboard_monitor": false
    },
    "auto_download": { ... }
}
```

### 更新设置

```
PUT /api/settings
Content-Type: application/json

Body: {
    "general": {
        "theme": "dark",
        "language": "zh-CN",
        "auto_download": true,
        "clipboard_monitor": true
    }
}
```

### 错误响应

```json
{
    "detail": "Failed to update settings: ..."
}
```

---

## 关键文件

### 前端

| 文件 | 说明 |
|------|------|
| `apps/web/src/components/MainLayout.tsx` | 主题切换、剪贴板监控 |
| `apps/web/src/pages/settings/AccountsSettings.tsx` | 通用设置页面 |
| `apps/web/src/stores/settings.ts` | 状态管理 |
| `apps/web/src/index.css` | 主题 CSS 变量 |

### 后端

| 文件 | 说明 |
|------|------|
| `apps/api/src/routers/settings.py` | API 路由 |
| `apps/api/src/services/settings_service.py` | 设置服务 |
| `apps/api/src/schemas/settings.py` | 数据模型 |

---

## 关联文档

- [storage.md](storage.md) - 存储设置
- [download.md](download.md) - 下载设置
- [auto-download.md](auto-download.md) - 自动下载设置
- [backup.md](backup.md) - 备份设置
- [API 端点](../api/endpoints.md) - 完整 API 列表

---

[返回上级](./README.md)