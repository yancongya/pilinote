# 备份设置

> **注意**: 目前仅支持 FTP 备份，WebDAV 尚未实现。

## 支持方式

- FTP（含 TLS 加密）

## FTP 配置

| 参数 | 说明 | 示例 |
|------|------|------|
| host | FTP 服务器地址 | ftp.example.com:21 |
| username | 用户名 | user |
| password | 密码 | password |
| remote_path | 远程存储路径 | /pilinote |
| use_tls | 使用 TLS 加密（FTPS） | false |

## API

### 测试连接

```
POST /api/settings/ftp/test
Body: {
    "host": "ftp.example.com",
    "username": "user",
    "password": "password",
    "use_tls": false
}
```

响应：
```json
{ "success": true, "message": "连接成功" }
```

### 备份下载目录

```
POST /api/settings/backup/download
Body: { "host": "...", "username": "...", "password": "...", "remote_path": "...", "use_tls": false }
```

返回 Server-Sent Events 流式进度

### 备份数据库

```
POST /api/settings/backup/database
Body: { "host": "...", "username": "...", "password": "...", "remote_path": "...", "use_tls": false }
```

返回 Server-Sent Events 流式进度

---

## 关键文件

- 后端: `apps/api/src/services/backup_service.py`
- 后端: `apps/api/src/utils/ftp_adapter.py`
- API: `apps/api/src/routers/settings.py` (路由: `/api/settings/backup/*`)

---

[返回上级](./README.md)