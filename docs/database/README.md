# 数据库设计

本目录包含数据库设计相关文档。

## 文档索引

### 1. 数据模型
**文件**: [models.md](models.md)

内容：
- User 模型（用户认证）
- Download 模型（下载任务）
- Scheduler 模型（定时任务）
- Setting 模型（系统设置）
- Cookie 模型（Cookie 存储）

### 2. API Schema
**文件**: [schemas.md](schemas.md)

内容：
- 请求模型
- 响应模型

---

## 数据库表

| 表名 | 说明 | 关联 |
|------|------|------|
| users | 用户信息 | 1:N cookies, downloads, schedulers |
| cookies | Cookie 存储 | N:1 users |
| downloads | 下载任务 | N:1 users |
| schedulers | 定时任务 | N:1 users |
| settings | 系统设置 | 独立表 |

---

## 设置存储机制

settings 表使用 key-value 模式存储配置：

```sql
-- 示例查询
SELECT key, value, type, category FROM settings;
```

| key | value | type | category |
|-----|-------|------|----------|
| download.video.default_quality | 64 | integer | download |
| storage.download_path | ./downloads | string | storage |
| general.theme | auto | string | general |

---

## 初始化流程

```
1. 应用启动
   ↓
2. create_missing_tables() 检查表
   ↓
3. 创建缺失的表
   ↓
4. settings 表创建后 → init_default_settings()
   ↓
5. 插入默认配置
```

---

## 常见问题排查

### 设置保存失败

1. 检查数据库文件权限
2. 检查后端日志
3. 确认 API 返回正确

### 设置刷新恢复默认值

详见 [models.md](models.md) - 设置存储机制

---

[返回上级](../README.md)