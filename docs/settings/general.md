# 通用设置

## 配置项

| 键 | 说明 | 默认值 | 可选值 |
|----|------|-------|--------|
| theme | 主题设置 | auto | auto, light, dark |
| language | 语言设置 | zh-CN | zh-CN, en-US |
| auto_download | 自动下载全局开关 | false | true, false |
| clipboard_monitor | 剪贴板监控 | false | true, false |

## 详细说明

### 主题设置
- **auto**: 跟随系统主题
- **light**: 浅色模式
- **dark**: 深色模式

### 语言设置
- **zh-CN**: 简体中文
- **en-US**: English

### 自动下载
- 全局开关，控制是否启用自动下载功能
- 具体配置见 [auto-download.md](auto-download.md)

### 剪贴板监控
- 监听剪贴板内容，自动识别 Bilibili 链接
- 支持的视频链接格式：
  - `https://www.bilibili.com/video/BV1xx411c7mD`
  - `https://b23.tv/xxxxxx`

## API

### 获取设置

```
GET /api/settings
```

### 更新设置

```
PUT /api/settings
Body: {
    "general": {
        "theme": "auto",
        "language": "zh-CN",
        "auto_download": false,
        "clipboard_monitor": false
    }
}
```

---

## 关键文件

- 前端: `apps/web/src/pages/settings/AccountsSettings.tsx`
- 后端: `apps/api/src/schemas/settings.py` (GeneralSettings)
- 前端组件: `apps/web/src/components/MainLayout.tsx` (主题切换)

---

[返回上级](./README.md)