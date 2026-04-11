# 备份设置

## 支持方式

- FTP
- WebDAV

## FTP 配置

```json
{
    "ftp_host": "ftp.example.com",
    "ftp_port": 21,
    "ftp_user": "user",
    "ftp_password": "password",
    "ftp_remote_path": "/downloads"
}
```

## WebDAV 配置

```json
{
    "webdav_url": "https://dav.example.com",
    "webdav_user": "user",
    "webdav_password": "password"
}
```

## API

### 测试连接

```
POST /api/settings/backup/test
Body: { "type": "ftp" | "webdav", "config": {...} }
```

**关键文件**：
- 后端: `apps/api/src/services/backup_service.py`
- 后端: `apps/api/src/utils/ftp_adapter.py`

---

[返回上级](./README.md)