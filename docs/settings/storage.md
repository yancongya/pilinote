# 存储设置

## 配置项

| 键 | 说明 | 默认值 |
|----|------|-------|
| download_path | 下载保存路径 | ./downloads |
| temp_path | 临时文件路径 | ./temp |
| max_concurrent | 最大并发数 | 3 |

## API

### 获取设置

```
GET /api/settings
```

### 更新设置

```
PUT /api/settings
Body: {
    "download_path": "/path/to/downloads"
}
```

**关键文件**：
- 前端: `apps/web/src/pages/settings/StorageSettings.tsx`
- 后端: `apps/api/src/routers/settings.py`

---

[返回上级](./README.md)