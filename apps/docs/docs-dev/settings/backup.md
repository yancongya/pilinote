# 备份设置

备份设置模块管理系统数据备份功能，包括 FTP 备份下载目录和数据库。

> **注意**: 目前仅支持 FTP 备份，WebDAV 尚未实现。

---

## 数据流

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                    前端 (BackupSettings.tsx)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │
│  │ FTP 配置   │  │ 备份下载  │  │ 备份数据库│                       │
│  │ - 服务器  │  │           │  │           │                       │
│  │ - 凭据   │  │           │  │           │                       │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘                       │
│        │             │             │                             │
│        └─────────────┴─────┬──────┴─────────────┘                             │
│                      ┌─────▼─────┐                                        │
│                      │ API 调用  │                                        │
│                      └─────┬─────┘                                        │
└──────────────────────────│────────────────────────────────────────────────────
                    ┌──────▼──────┐
                    │ /api/settings/ftp/test
                    │ /api/settings/backup/*
                    └──────┬──────┘
                          │
┌─────────────────────────▼────────────────────────────────────────────────────┐
│                      后端 (FastAPI)                              │
│  ┌──────────────────┐  ┌──────────────────────────────────┐            │
│  │ routers/settings │  │ BackupService                  │            │
│  │ /ftp/test       │  │  - backup_download_directory() │            │
│  │ /backup/*      │  │  - backup_database()       │            │
│  └────────┬─────────┘  └──────────────┬───────────┘            │
│           │                           │                       │
│           │            ┌────────────▼───────────┐            │
│           │            │   FTPAdapter        │            │
│           │            │  - connect()        │            │
│           │            │  - upload()        │            │
│           │            │  - list_files()   │            │
│           │            └──────────────────────┘            ��
└──────────────────────────────────────────────────────────
```

---

## 前端实现

### 组件结构 (BackupSettings.tsx)

```
┌─────────────────────────────────────────────────────────────┐
│                   BackupSettings                          │
├─────────────────────────────────────────────────────────────┤
│ 功能模块：                                               │
│ 1. FTP 配置：服务器、用户名、密码、远程路径、TLS           │
│ 2. 测试连接：验证 FTP 配置是否正确                        │
│ 3. 备份下载：备份下载目录到 FTP 服务器                   │
│ 4. 备份数据库：备份数据库到 FTP 服务器                   │
│                                                         │
│ 状态管理：                                               │
│ - testing: 是否正在测试连接                               │
│ - backingUp: 是否正在备份                               │
│ - progress: 备份进度                                   │
└───────────────────────────────────────────────────────────┘
```

### FTP 配置 UI

```typescript
interface FTPConfig {
  host: string      // FTP 服务器地址
  username: string // 用户名
  password: string // 密码
  remote_path: string  // 远程路径
  use_tls: boolean   // 使用 TLS
}

// 测试连接
const testConnection = async (config: FTPConfig) => {
  const response = await fetch('/api/settings/ftp/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  return response.json()
}
```

### 备份流程

```typescript
// 备份下载目录
const backupDownloads = async (config: FTPConfig) => {
  const response = await fetch('/api/settings/backup/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  
  // 使用 EventSource 接收进度
  const eventSource = new EventSource('/api/settings/backup/download')
  eventSource.onmessage = (event) => {
    const progress = JSON.parse(event.data)
    updateProgress(progress)
  }
}

// 备份数据库
const backupDatabase = async (config: FTPConfig) => {
  const response = await fetch('/api/settings/backup/database', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  })
  
  // 使用 EventSource 接收进度
  const eventSource = new EventSource('/api/settings/backup/database')
  eventSource.onmessage = (event) => {
    const progress = JSON.parse(event.data)
    updateProgress(progress)
  }
}
```

---

## 后端实现

### FTP 适配器 (utils/ftp_adapter.py)

```python
import ftplib
from typing import Optional

class FTPAdapter:
    """FTP 适配器"""
    
    def __init__(self, host: str, username: str, password: str, 
                 use_tls: bool = False):
        self.host = host
        self.username = username
        self.password = password
        self.use_tls = use_tls
        self.ftp: Optional[ftplib.FTP] = None
    
    def connect(self) -> bool:
        """连接 FTP 服务器"""
        try:
            if self.use_tls:
                self.ftp = ftplib.FTP_TLS(self.host)
            else:
                self.ftp = ftplib.FTP(self.host)
            
            self.ftp.login(self.username, self.password)
            
            if self.use_tls:
                self.ftp.prot_p()  # 启用加密
            
            return True
        except Exception as e:
            logger.error(f"FTP 连接失败: {e}")
            return False
    
    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """上传文件"""
        if not self.ftp:
            return False
        
        try:
            with open(local_path, 'rb') as f:
                self.ftp.storbinary(f'STOR {remote_path}', f)
            return True
        except Exception as e:
            logger.error(f"FTP 上传失败: {e}")
            return False
    
    def test_connection(self) -> tuple[bool, str]:
        """测试连接"""
        try:
            if self.connect():
                return True, "连接成功"
            return False, "连接失败"
        except Exception as e:
            return False, str(e)
```

### 备份服务 (services/backup_service.py)

```python
class BackupService:
    """备份服务"""
    
    def __init__(self, ftp_config: dict):
        self.ftp_config = ftp_config
        self.adapter = FTPAdapter(
            host=ftp_config.get('host'),
            username=ftp_config.get('username'),
            password=ftp_config.get('password'),
            use_tls=ftp_config.get('use_tls', False)
        )
    
    def backup_download_directory(self, download_path: str):
        """备份下载目录"""
        # 1. 连接 FTP
        success, message = self.adapter.test_connection()
        if not success:
            yield { "error": message }
            return
        
        # 2. 遍历下载目录
        files = []
        for root, dirs, filenames in os.walk(download_path):
            for filename in filenames:
                files.append(os.path.join(root, filename))
        
        total = len(files)
        uploaded = 0
        
        # 3. 上传文件
        for file_path in files:
            try:
                remote_path = os.path.join(
                    self.ftp_config.get('remote_path', '/pilinote'),
                    os.path.basename(file_path)
                )
                
                if self.adapter.upload_file(file_path, remote_path):
                    uploaded += 1
                    
                    yield {
                        "progress": uploaded / total * 100,
                        "current": uploaded,
                        "total": total,
                        "file": os.path.basename(file_path)
                    }
            except Exception as e:
                logger.error(f"上传失败: {file_path}, {e}")
        
        yield { "complete": True, "uploaded": uploaded }
    
    def backup_database(self, database_path: str):
        """备份数据库"""
        # 类似的上传逻辑
        ...
```

---

## 支持方式

### FTP 配置

| 参数 | 说明 | 示例 |
|------|------|------|
| host | FTP 服务器地址（可包含端口） | ftp.example.com:21 |
| username | 用户名 | user |
| password | 密码 | password |
| remote_path | 远程存储路径 | /pilinote |
| use_tls | 使用 TLS 加密（FTPS） | false |

### TLS/FTPS

- **不加密**: 标准 FTP（端口 21）
- **TLS 加密**: FTPS（端口 990 或 21）
- 建议使用 TLS 加密以保证安全

---

## API 详情

### 测试连接

```
POST /api/settings/ftp/test
Content-Type: application/json

Body: {
    "host": "ftp.example.com",
    "username": "user",
    "password": "password",
    "use_tls": false
}
```

响应：
```json
{
    "success": true,
    "message": "连接成功"
}
```

错误响应：
```json
{
    "detail": "FTP 连接测试失败: ..."
}
```

### 备份下载目录

```
POST /api/settings/backup/download
Content-Type: application/json

Body: {
    "host": "ftp.example.com",
    "username": "user",
    "password": "password",
    "remote_path": "/pilinote",
    "use_tls": false
}
```

返回 Server-Sent Events 流式进度：

```
data: {"progress": 10, "current": 1, "total": 10, "file": "video1.mp4"}
data: {"progress": 20, "current": 2, "total": 10, "file": "video2.mp4"}
...
data: {"complete": true, "uploaded": 10}
```

### 备份数据库

```
POST /api/settings/backup/database
Content-Type: application/json

Body: {
    "host": "ftp.example.com",
    "username": "user",
    "password": "password",
    "remote_path": "/pilinote",
    "use_tls": false
}
```

返回 Server-Sent Events 流式进度

---

## 交互流程

### 配置 FTP 流程

```
1. 输入 FTP 服务器地址
   ↓
2. 输入用户名和密码
   ↓
3. 输入远程存储路径（可选，默认 /pilinote）
   ↓
4. 选择是否使用 TLS 加密
   ↓
5. 点击"测试连接"
   ↓
6. 显示测试结果
   ↓
7. 配置保存到设置（存储到数据库）
```

### 备份流程

```
1. 点击"备份下载目录"或"备份数据库"
   ↓
2. 确认备份（显示目标信息）
   ↓
3. 开始备份，显示进度条
   ↓
4. 流式接收进度更新
   ↓
5. 备份完成，显示结果
```

---

## 关键文件

### 前端

| 文件 | 说明 |
|------|------|
| `apps/web/src/pages/settings/BackupSettings.tsx` | 备份设置页面 |

### 后端

| 文件 | 说明 |
|------|------|
| `apps/api/src/routers/settings.py` | API 路由 |
| `apps/api/src/services/backup_service.py` | 备份服务 |
| `apps/api/src/utils/ftp_adapter.py` | FTP 适配器 |

---

## 关联文档

- [storage.md](storage.md) - 存储设置
- [download.md](download.md) - 下载设置
- [general.md](general.md) - 通用设置
- [auto-download.md](auto-download.md) - 自动下载设置
- [API 端点](../api/endpoints.md) - 完整 API 列表

---

[返回上级](./README.md)