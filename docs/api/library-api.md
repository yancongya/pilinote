# 本地视频库 API 文档

## 概述

本地视频库 API 提供了扫描、管理和同步本地下载视频文件的接口，支持动态读取下载目录、解析NFO元数据、导入新文件和清理丢失记录等功能。

### 认证方式

大部分本地视频库 API 不需要用户认证，因为它们操作的是本地文件系统。但为了安全考虑，图片代理端点限制了文件类型。

### 基础 URL

```
http://localhost:8000
```

### 通用响应格式

所有 API 端点都返回统一的响应格式：

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

**错误响应**：
```json
{
  "detail": "错误信息"
}
```

---

## 核心功能

### 1. 动态文件扫描

实时扫描下载目录，识别视频文件和文件夹，与数据库记录进行匹配。

**特性**：
- 按一级文件夹组织视频
- 支持多种视频格式（mp4, flv, mkv, webm, avi, mov, wmv, m4v）
- 自动解析NFO文件获取元数据
- 查找封面和头像图片
- 文件大小和修改时间统计

### 2. 智能文件匹配

将扫描到的文件与数据库记录进行多维度匹配：

1. **完全路径匹配**：文件路径完全一致
2. **文件名匹配**：文件名相同
3. **标题匹配**：视频标题相似
4. **BVID匹配**：从文件名提取BVID进行匹配

### 3. 元数据管理

- **NFO解析**：解析XML格式的NFO文件，提取标题、简介、统计信息等
- **封面管理**：统一使用 `cover.jpg` 作为封面文件名，支持从NFO或本地封面文件读取
- **头像管理**：支持读取 `avatar.jpg/png` 作为UP主头像
- **统计信息**：显示播放量、点赞数、投币数等B站统计数据
- **评论数据**：提取和存储B站视频评论数据，包括置顶评论和热门评论

### 4. 数据同步

- **自动导入**：将新发现的文件自动导入到数据库
- **清理丢失**：删除数据库中文件不存在的记录
- **完整同步**：一次性完成扫描、导入和清理

### 5. 评论数据提取

- **置顶评论**：提取B站视频的置顶评论
- **热门评论**：提取点赞数最高的3条热门评论
- **NFO存储**：将评论数据保存到NFO文件中，支持离线查看
- **API集成**：通过B站评论API获取实时评论数据

### 6. 本地播放支持

- **播放映射查询**：根据 `bvid` 返回本地可播放文件列表
- **本地视频代理**：通过 API 代理本地视频文件，供前端 `<video>` 播放
- **多P支持**：返回带 `cid` 的文件映射，供详情页选择当前分P
- **兜底扫描**：当数据库没有下载记录时，可回退到本地视频库扫描结果

---

## 端点列表

### 1. 获取视频库统计信息

**端点**：`GET /api/library/statistics`

**描述**：获取本地视频库的统计信息，包括文件数量、总大小、数据库记录等

#### 请求示例

```bash
curl -X GET "http://localhost:8000/api/library/statistics"
```

#### 响应示例

**成功响应**（200 OK）：
```json
{
  "success": true,
  "data": {
    "exists": true,
    "path": "/Users/tanyancong/工作/开发/pilinote/downloads",
    "file_count": 112,
    "total_size": 5368709120,
    "total_size_mb": 5120.0,
    "total_size_gb": 5.0,
    "video_files_by_type": {
      ".mp4": 100,
      ".flv": 10,
      ".mkv": 2
    },
    "database_stats": {
      "total_downloads": 120,
      "completed_downloads": 110
    }
  }
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `exists` | bool | 下载目录是否存在 |
| `path` | string | 下载目录路径 |
| `file_count` | int | 视频文件总数 |
| `total_size` | int | 总大小（字节） |
| `total_size_mb` | float | 总大小（MB） |
| `total_size_gb` | float | 总大小（GB） |
| `video_files_by_type` | object | 按文件类型统计 |
| `database_stats` | object | 数据库统计信息 |

#### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 500 | 服务器内部错误 |

#### 后端实现

**文件**：`apps/api/src/routers/library.py`

```python
@router.get("/statistics")
async def get_library_statistics(db: Session = Depends(get_db)):
    """获取本地视频库统计信息"""
    try:
        service = LocalLibraryService(db)
        stats = service.get_library_statistics()
        
        return {
            "success": True,
            "data": stats
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取视频库统计信息失败: {str(e)}"
        )
```

---

### 2. 扫描视频库

**端点**：`POST /api/library/scan`

**描述**：扫描本地视频库并同步状态，返回新文件、已存在文件和文件丢失的记录

#### 请求示例

```bash
curl -X POST "http://localhost:8000/api/library/scan"
```

#### 响应示例

**成功响应**（200 OK）：
```json
{
  "success": true,
  "data": {
    "total_files": 112,
    "folder_count": 45,
    "new_files_count": 2,
    "existing_files_count": 108,
    "missing_count": 2,
    "total_size": 5368709120,
    "total_size_mb": 5120.0,
    "total_size_gb": 5.0,
    "folders": [
      {"name": "【Blender教程】", "title": "Blender教程系列", "path": "/Users/tanyancong/工作/开发/pilinote/downloads/【Blender教程】", "file_count": 10, "size": 1073741824, "metadata_size": 1048576, "total_size": 1074790400, "size_mb": 1024.0, "size_gb": 1.0, "cover": "cover.jpg", "cover_path": "/Users/tanyancong/工作/开发/pilinote/downloads/【Blender教程】/cover.jpg", "avatar": "avatar.jpg", "avatar_path": "/Users/tanyancong/工作/开发/pilinote/downloads/【Blender教程】/avatar.jpg", "studio": "UP主名称", "nfo_data": {"title": "Blender教程系列", "plot": "详细的Blender教程", "studio": "UP主名称", "premiered": "2024-01-01", "statistics": {"play": 10000, "like": 500, "coin": 200}}, "created_time": 1704067200}
    ],
    "folder_videos": {
      "【Blender教程】": {
        "files": [
          {
            "path": "/Users/tanyancong/工作/开发/pilinote/downloads/【Blender教程】/01_基础操作.mp4",
            "title": "01_基础操作",
            "size": 107374182,
            "size_mb": 102.4,
            "modified_time": 1704067200,
            "modified_date": "2024-01-01 00:00:00"
          }
        ],
        "total_size": 1073741824,
        "metadata_size": 1048576
      }
    },
    "new_files": [
      {
        "path": "/Users/tanyancong/工作/开发/pilinote/downloads/new_video.mp4",
        "title": "新视频",
        "size": 104857600,
        "size_mb": 100.0,
        "modified_time": 1704067200,
        "modified_date": "2024-01-01 00:00:00"
      }
    ],
    "missing_files": [
      {
        "id": "task-123",
        "bvid": "BV1xx411c7mD",
        "title": "已删除的视频",
        "file_path": "/Users/tanyancong/工作/开发/pilinote/downloads/已删除的视频.mp4",
        "file_size": 104857600,
        "status": "completed"
      }
    ],
    "errors": []
  },
  "message": "扫描完成：发现 112 个文件，其中 2 个新文件，2 个文件丢失"
}
```

#### 响应字段说明

**顶级字段**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `total_files` | int | 扫描到的文件总数 |
| `folder_count` | int | 文件夹数量 |
| `new_files_count` | int | 新发现的文件数量 |
| `existing_files_count` | int | 已存在的文件数量 |
| `missing_count` | int | 文件丢失的记录数量 |
| `total_size` | int | 所有文件总大小（字节） |
| `folders` | array | 文件夹列表 |

**文件夹信息**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 文件夹名称 |
| `title` | string | 文件夹标题（从NFO获取） |
| `path` | string | 文件夹路径 |
| `file_count` | int | 文件夹内视频数量 |
| `size` | int | 视频文件总大小 |
| `metadata_size` | int | 元数据文件总大小 |
| `total_size` | int | 总大小（视频+元数据） |
| `cover` | string | 封面文件名（统一为 cover.jpg） |
| `cover_path` | string | 封面文件路径 |
| `avatar` | string | 头像文件名 |
| `avatar_path` | string | 头像文件路径 |
| `studio` | string | UP主名称 |
| `nfo_data` | object | NFO文件解析的数据 |
| `created_time` | float | 文件夹创建时间戳 |

#### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 500 | 服务器内部错误 |

#### 后端实现

**文件**：`apps/api/src/routers/library.py`

```python
@router.post("/scan")
async def scan_library(db: Session = Depends(get_db)):
    """扫描本地视频库并同步状态"""
    try:
        service = LocalLibraryService(db)
        result = service.scan_library()
        
        return {
            "success": True,
            "data": result.to_dict(),
            "message": f"扫描完成：发现 {result.total_files} 个文件，其中 {len(result.new_files)} 个新文件，{len(result.missing_files)} 个文件丢失"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"扫描视频库失败: {str(e)}"
        )
```

---

### 3. 获取本地视频文件

**端点**：`GET /api/library/video`

**描述**：代理返回本地视频文件，供前端播放器直接播放。

#### 请求参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file_path` | string | 是 | 本地视频文件绝对路径 |

#### 请求示例

```bash
curl -X GET "http://localhost:8000/api/library/video?file_path=/Users/tanyancong/工作/开发/pilinote/downloads/demo.mp4"
```

#### 响应说明

- 成功时直接返回视频文件流
- 支持格式：`.mp4`、`.m4v`、`.webm`、`.mkv`、`.flv`、`.avi`、`.mov`、`.wmv`
- 不支持的文件扩展名会返回 `400`

#### 使用场景

- 视频详情页点击封面后原地切换到本地 `<video>` 播放器
- 本地文件不直接暴露给前端，而是通过 API 代理访问

---

### 4. 获取本地播放映射

**端点**：`GET /api/video-library/playback/{bvid}`

**描述**：根据视频 `bvid` 返回本地可播放文件列表，用于视频详情页判断封面是否可播放，以及多 P 视频如何精确匹配当前分P。

#### 请求示例

```bash
curl -X GET "http://localhost:8000/api/video-library/playback/BV1xx411c7mD"
```

#### 响应示例

```json
{
  "success": true,
  "data": {
    "bvid": "BV1xx411c7mD",
    "has_local_video": true,
    "entries": [
      {
        "cid": 123456789,
        "path": "/Users/tanyancong/工作/开发/pilinote/downloads/demo/P1.mp4",
        "exists": true,
        "title": "P1 标题"
      }
    ],
    "folder_path": "/Users/tanyancong/工作/开发/pilinote/downloads/demo"
  }
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `bvid` | string | 视频 BVID |
| `has_local_video` | bool | 是否存在本地可播放文件 |
| `entries` | array | 可播放文件列表 |
| `entries[].cid` | int/null | 分P的 CID，单文件兜底扫描时可能为空 |
| `entries[].path` | string | 本地视频文件绝对路径 |
| `entries[].exists` | bool | 文件是否存在 |
| `entries[].title` | string | 文件标题 |
| `folder_path` | string/null | 匹配到的视频文件夹路径 |

#### 匹配策略

1. 优先读取 `downloads` 表中 `status=completed` 的记录
2. 如果数据库里没有有效 `file_path`，回退到本地视频库扫描结果
3. 多 P 视频优先依赖 `cid -> file_path` 映射
4. 单文件视频允许返回无 `cid` 的兜底条目

---

### 3. 导入新文件

**端点**：`POST /api/library/import`

**描述**：将新发现的视频文件导入到数据库

#### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `import_all` | bool | 否 | false | 是否导入所有新文件 |

#### 请求体

```json
{
  "file_paths": [
    "/path/to/video1.mp4",
    "/path/to/video2.mp4"
  ]
}
```

#### 请求示例

```bash
# 导入所有新文件
curl -X POST "http://localhost:8000/api/library/import?import_all=true"

# 导入指定文件
curl -X POST "http://localhost:8000/api/library/import" \
  -H "Content-Type: application/json" \
  -d '{
    "file_paths": [
      "/Users/tanyancong/工作/开发/pilinote/downloads/new_video.mp4"
    ]
  }'
```

#### 响应示例

**成功响应**（200 OK）：
```json
{
  "success": true,
  "message": "成功导入 2 个视频文件",
  "imported_count": 2,
  "imported_files": [
    "/Users/tanyancong/工作/开发/pilinote/downloads/new_video1.mp4",
    "/Users/tanyancong/工作/开发/pilinote/downloads/new_video2.mp4"
  ]
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | bool | 是否成功 |
| `message` | string | 结果消息 |
| `imported_count` | int | 成功导入的文件数量 |
| `imported_files` | array | 导入的文件路径列表 |

#### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |

#### 后端实现

**文件**：`apps/api/src/routers/library.py`

```python
@router.post("/import")
async def import_new_files(
    import_all: bool = Query(False, description="是否导入所有新文件"),
    file_paths: Optional[List[str]] = Body(None, description="要导入的文件路径列表"),
    db: Session = Depends(get_db)
):
    """导入新发现的视频文件到数据库"""
    try:
        service = LocalLibraryService(db)
        
        # 先扫描获取新文件
        scan_result = service.scan_library()
        
        if not scan_result.new_files:
            return {
                "success": True,
                "message": "没有新文件需要导入",
                "imported_count": 0,
                "imported_files": []
            }
        
        # 确定要导入的文件
        files_to_import = scan_result.new_files
        
        if not import_all and file_paths:
            # 只导入指定的文件
            files_to_import = [f for f in scan_result.new_files if f.path in file_paths]
        
        if not files_to_import:
            return {
                "success": True,
                "message": "没有选择要导入的文件",
                "imported_count": 0,
                "imported_files": []
            }
        
        # 执行导入
        imported_count, imported_paths = service.import_new_files(files_to_import)
        
        return {
            "success": True,
            "message": f"成功导入 {imported_count} 个视频文件",
            "imported_count": imported_count,
            "imported_files": imported_paths
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"导入文件失败: {str(e)}"
        )
```

---

### 4. 清理丢失文件

**端点**：`POST /api/library/cleanup`

**描述**：清理文件丢失的下载记录

#### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `auto_cleanup` | bool | 否 | false | 是否自动清理所有文件丢失的记录 |

#### 请求体

```json
{
  "download_ids": [
    "task-123",
    "task-456"
  ]
}
```

#### 请求示例

```bash
# 自动清理所有丢失记录
curl -X POST "http://localhost:8000/api/library/cleanup?auto_cleanup=true"

# 清理指定记录
curl -X POST "http://localhost:8000/api/library/cleanup" \
  -H "Content-Type: application/json" \
  -d '{
    "download_ids": ["task-123", "task-456"]
  }'
```

#### 响应示例

**成功响应**（200 OK）：
```json
{
  "success": true,
  "message": "成功清理 2 个文件丢失的记录",
  "cleaned_count": 2
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | bool | 是否成功 |
| `message` | string | 结果消息 |
| `cleaned_count` | int | 清理的记录数量 |

#### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |

#### 后端实现

**文件**：`apps/api/src/routers/library.py`

```python
@router.post("/cleanup")
async def cleanup_missing_files(
    auto_cleanup: bool = Query(False, description="是否自动清理所有文件丢失的记录"),
    download_ids: Optional[List[str]] = Body(None, description="要清理的下载记录ID列表"),
    db: Session = Depends(get_db)
):
    """清理文件丢失的下载记录"""
    try:
        service = LocalLibraryService(db)
        
        if auto_cleanup:
            # 清理所有文件丢失的记录
            scan_result = service.scan_library()
            ids_to_cleanup = [d.id for d in scan_result.missing_files]
        else:
            # 清理指定的记录
            ids_to_cleanup = download_ids or []
        
        if not ids_to_cleanup:
            return {
                "success": True,
                "message": "没有需要清理的记录",
                "cleaned_count": 0
            }
        
        # 执行清理
        cleaned_count = service.cleanup_missing_files(ids_to_cleanup)
        
        return {
            "success": True,
            "message": f"成功清理 {cleaned_count} 个文件丢失的记录",
            "cleaned_count": cleaned_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"清理记录失败: {str(e)}"
        )
```

---

### 5. 完整同步

**端点**：`POST /api/library/sync`

**描述**：完整同步本地视频库，包括扫描、导入新文件和清理丢失记录

#### 查询参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `auto_import` | bool | 否 | false | 是否自动导入新文件 |
| `auto_cleanup` | bool | 否 | false | 是否自动清理文件丢失的记录 |

#### 请求示例

```bash
# 只扫描，不导入和清理
curl -X POST "http://localhost:8000/api/library/sync"

# 自动导入新文件
curl -X POST "http://localhost:8000/api/library/sync?auto_import=true"

# 自动导入和清理
curl -X POST "http://localhost:8000/api/library/sync?auto_import=true&auto_cleanup=true"
```

#### 响应示例

**成功响应**（200 OK）：
```json
{
  "success": true,
  "message": "同步完成：扫描 112 个文件",
  "data": {
    "scan_result": {
      "total_files": 112,
      "folder_count": 45,
      "new_files_count": 2,
      "existing_files_count": 108,
      "missing_count": 2
    },
    "imported_count": 2,
    "cleaned_count": 2,
    "auto_import": true,
    "auto_cleanup": true
  }
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | bool | 是否成功 |
| `message` | string | 结果消息 |
| `data.scan_result` | object | 扫描结果 |
| `data.imported_count` | int | 导入的文件数量 |
| `data.cleaned_count` | int | 清理的记录数量 |
| `data.auto_import` | bool | 是否自动导入 |
| `data.auto_cleanup` | bool | 是否自动清理 |

#### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 500 | 服务器内部错误 |

#### 后端实现

**文件**：`apps/api/src/routers/library.py`

```python
@router.post("/sync")
async def sync_library(
    auto_import: bool = Query(False, description="是否自动导入新文件"),
    auto_cleanup: bool = Query(False, description="是否自动清理文件丢失的记录"),
    db: Session = Depends(get_db)
):
    """完整同步本地视频库（扫描 + 导入 + 清理）"""
    try:
        service = LocalLibraryService(db)
        
        # 1. 扫描视频库
        scan_result = service.scan_library()
        
        imported_count = 0
        cleaned_count = 0
        
        # 2. 自动导入新文件
        if auto_import and scan_result.new_files:
            imported_count, _ = service.import_new_files(scan_result.new_files)
        
        # 3. 自动清理文件丢失的记录
        if auto_cleanup and scan_result.missing_files:
            missing_ids = [d.id for d in scan_result.missing_files]
            cleaned_count = service.cleanup_missing_files(missing_ids)
        
        return {
            "success": True,
            "message": f"同步完成：扫描 {scan_result.total_files} 个文件",
            "data": {
                "scan_result": scan_result.to_dict(),
                "imported_count": imported_count,
                "cleaned_count": cleaned_count,
                "auto_import": auto_import,
                "auto_cleanup": auto_cleanup
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"同步视频库失败: {str(e)}"
        )
```

---

### 6. 获取本地图片

**端点**：`GET /api/library/image`

**描述**：获取本地图片文件（封面、头像等），通过API代理避免浏览器的file://协议限制

#### 查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file_path` | string | 是 | 本地图片文件的绝对路径 |

#### 请求示例

```bash
# 获取封面图片
curl -X GET "http://localhost:8000/api/library/image?file_path=/Users/tanyancong/工作/开发/pilinote/downloads/video/cover.jpg" --output cover.jpg
```

#### 响应示例

**成功响应**（200 OK）：
返回图片文件的二进制数据，Content-Type为图片类型。

#### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 不支持的文件类型 |
| 404 | 文件不存在 |
| 500 | 服务器内部错误 |

#### 后端实现

**文件**：`apps/api/src/routers/library.py`

```python
@router.get("/image")
async def get_local_image(file_path: str = Query(..., description="本地图片文件路径")):
    """获取本地图片文件"""
    try:
        # 安全检查：确保路径是合法的
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404,
                detail=f"文件不存在: {file_path}"
            )
        
        # 检查文件类型
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型: {file_ext}"
            )
        
        # 返回文件
        return FileResponse(
            file_path,
            media_type=f"image/{file_ext[1:]}"  # 去掉点号
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取图片失败: {str(e)}"
        )
```

---

### 7. 更新单个NFO文件

**端点**：`POST /api/library/nfo/update`

**描述**：更新单个NFO文件的元数据，从B站API获取最新的统计数据并更新到NFO文件中

#### 请求体

```json
{
  "nfo_path": "/path/to/video.nfo"
}
```

#### 请求示例

```bash
curl -X POST "http://localhost:8000/api/library/nfo/update" \
  -H "Content-Type: application/json" \
  -d '{
    "nfo_path": "/Users/tanyancong/工作/开发/pilinote/downloads/video.nfo"
  }'
```

#### 响应示例

**成功响应**（200 OK）：
```json
{
  "success": true,
  "data": {
    "nfo_path": "/Users/tanyancong/工作/开发/pilinote/downloads/video.nfo",
    "updated": true,
    "changes": {
      "statistics": {
        "play": 10000,
        "like": 500,
        "coin": 200,
        "favorite": 100,
        "share": 50,
        "danmaku": 100,
        "reply": 80
      },
      "rating": 8.5,
      "tags": ["弹幕:100", "评论:80", "分享:50"]
    }
  },
  "message": "NFO文件更新成功"
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | bool | 是否成功 |
| `data.nfo_path` | string | NFO文件路径 |
| `data.updated` | bool | 是否有更新 |
| `data.changes` | object | 更新的内容 |
| `message` | string | 结果消息 |

#### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误 |
| 404 | NFO文件不存在 |
| 500 | 服务器内部错误 |

#### 后端实现

**文件**：`apps/api/src/routers/library.py`

```python
@router.post("/nfo/update")
async def update_nfo_file(
    nfo_path: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    更新单个NFO文件的元数据
    
    Args:
        nfo_path: NFO文件路径
        
    Returns:
        更新结果
    """
    try:
        from src.services.nfo_update_service import NFOUpdateService
        
        nfo_service = NFOUpdateService()
        result = await nfo_service.update_single_nfo(nfo_path)
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"更新NFO文件失败: {str(e)}"
        )
```

---

### 8. 批量更新NFO文件

**端点**：`POST /api/library/nfo/batch-update`

**描述**：批量更新指定目录下的 NFO 文件，从 B 站 API 获取最新统计数据并更新回本地 NFO。当前同时支持视频 NFO 与图文 NFO。

#### 请求体

```json
{
  "directory": "/path/to/downloads",
  "limit": 10
}
```

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `directory` | string | 是 | - | 要扫描的目录路径 |
| `limit` | int | 否 | 10 | 最大更新数量 |

#### 请求示例

```bash
# 更新下载目录下的NFO文件（最多10个）
curl -X POST "http://localhost:8000/api/library/nfo/batch-update" \
  -H "Content-Type: application/json" \
  -d '{
    "directory": "/Users/tanyancong/工作/开发/pilinote/downloads",
    "limit": 10
  }'
```

#### 响应示例

**成功响应**（200 OK）：
```json
{
  "success": true,
  "data": {
    "total": 10,
    "success_count": 8,
    "failed_count": 2,
    "results": [
      {
        "nfo_path": "/Users/tanyancong/工作/开发/pilinote/downloads/video1.nfo",
        "success": true,
        "updated": true,
        "changes": {
          "statistics": {
            "play": 10000,
            "like": 500,
            "coin": 200,
            "favorite": 100,
            "share": 50,
            "danmaku": 100,
            "reply": 80
          },
          "rating": 8.5,
          "tags": ["弹幕:100", "评论:80", "分享:50"]
        }
      },
      {
        "nfo_path": "/Users/tanyancong/工作/开发/pilinote/downloads/video2.nfo",
        "success": false,
        "error": "BVID解析失败"
      }
    ]
  },
  "message": "批量更新完成：成功8个，失败2个"
}
```

#### 响应字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | bool | 是否成功 |
| `data.total` | int | 总尝试数 |
| `data.success_count` | int | 成功数 |
| `data.failed_count` | int | 失败数 |
| `data.results` | array | 每个NFO文件的更新结果 |
| `message` | string | 结果消息 |

#### 错误码

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误 |
| 404 | 目录不存在 |
| 500 | 服务器内部错误 |

#### 后端实现

**文件**：`apps/api/src/routers/library.py`

```python
@router.post("/nfo/batch-update")
async def batch_update_nfo_files(
    directory: str = Body(..., embed=True),
    limit: int = Body(10, embed=True),
    db: Session = Depends(get_db)
):
    """
    批量更新目录下的NFO文件
    
    Args:
        directory: 目录路径
        limit: 最大更新数量（默认10）
        
    Returns:
        批量更新结果
    """
    try:
        from src.services.nfo_update_service import NFOUpdateService
        
        nfo_service = NFOUpdateService()
        result = await nfo_service.batch_update_nfos(directory, limit)
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"批量更新NFO文件失败: {str(e)}"
        )
```

#### 使用场景

1. **批量更新统计数据**：定期批量更新所有视频的播放量、点赞数等统计数据
2. **同步最新数据**：从B站API获取最新的互动数据，保持NFO文件的时效性
3. **数据补全**：为缺少统计数据的老视频补全NFO信息
4. **评论数据更新**：同步最新的评论数据到NFO文件中
5. **图文元数据刷新**：当 NFO 中存在 `opus_id` 时，会调用图文详情接口刷新标题、作者、点赞/评论/分享等统计信息

---

## 视频库状态管理功能

### 功能概述

PiliNote 支持视频库状态管理，用于判断视频是否已下载到本地视频库，避免重复下载。

### 批量检查视频是否已下载

**端点**：`POST /api/video-library/check-batch`

**描述**：批量检查指定BVID列表中的视频是否已在视频库中

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bvids` | array | 是 | BVID列表 |

**请求示例**：

```bash
curl -X POST "http://localhost:8000/api/video-library/check-batch" \
  -H "Content-Type: application/json" \
  -d '{
    "bvids": ["BV1xx411c7mD", "BV1yy411c7mE"]
  }'
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "downloaded": ["BV1xx411c7mD"],
    "not_downloaded": ["BV1yy411c7mE"],
    "total": 2
  }
}
```

**响应字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `downloaded` | array | 已下载的视频BVID列表 |
| `not_downloaded` | array | 未下载的视频BVID列表 |
| `total` | int | 总视频数量 |

**错误响应**：

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误 |
| 500 | 服务器内部错误 |

### 刷新视频库缓存

**端点**：`GET /api/video-library/refresh`

**描述**：刷新视频库缓存，同步最新的文件状态

**请求示例**：

```bash
curl -X GET "http://localhost:8000/api/video-library/refresh"
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "refreshed_at": 1713264000,
    "video_count": 112,
    "folder_count": 45
  }
}
```

**响应字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `refreshed_at` | int | 刷新时间戳 |
| `video_count` | int | 视频数量 |
| `folder_count` | int | 文件夹数量 |

**错误响应**：

| HTTP 状态码 | 说明 |
|-------------|------|
| 500 | 服务器内部错误 |

### 获取视频库状态

**端点**：`GET /api/video-library/status`

**描述**：获取视频库的当前状态信息

**请求示例**：

```bash
curl -X GET "http://localhost:8000/api/video-library/status"
```

**响应示例**：

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "cache_valid": true,
    "last_refresh": 1713264000,
    "cache_ttl": 600,
    "total_videos": 112
  }
}
```

**响应字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `enabled` | bool | 视频库是否启用 |
| `cache_valid` | bool | 缓存是否有效 |
| `last_refresh` | int | 最后刷新时间戳 |
| `cache_ttl` | int | 缓存过期时间（秒） |
| `total_videos` | int | 视频总数 |

**错误响应**：

| HTTP 状态码 | 说明 |
|-------------|------|
| 500 | 服务器内部错误 |

### 使用场景

#### 1. 避免重复下载

在用户添加视频到下载队列前，检查视频是否已下载：

```typescript
const response = await fetch('/api/video-library/check-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bvids: [videoBvid] })
});

const result = await response.json();

if (result.data.downloaded.includes(videoBvid)) {
  // 视频已下载，显示确认对话框
  showReDownloadDialog(video);
} else {
  // 直接添加到下载队列
  addToDownloadQueue(video);
}
```

#### 2. 批量检查收藏夹视频

在批量添加收藏夹视频时，自动过滤已下载的视频：

```typescript
const bvids = videos.map(v => v.bvid);
const response = await fetch('/api/video-library/check-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bvids })
});

const result = await response.json();
const videosToDownload = videos.filter(v => 
  !result.data.downloaded.includes(v.bvid)
);

console.log(`跳过 ${result.data.downloaded.length} 个已下载视频`);
console.log(`添加 ${videosToDownload.length} 个新视频`);
```

#### 3. 下载完成后自动刷新

下载任务完成后自动刷新视频库缓存：

```typescript
// 监听WebSocket下载完成事件
ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'download_complete') {
    // 延迟5秒后刷新视频库
    setTimeout(async () => {
      await fetch('/api/video-library/refresh');
    }, 5000);
  }
});
```

### 后端实现

#### 视频库服务

**文件**：`apps/api/src/services/video_library_service.py`

```python
class VideoLibraryService:
    """视频库状态管理服务"""
    
    def __init__(self, db: Session):
        self.db = db
        self.local_library = local_library_service
    
    async def check_videos_in_library(self, bvids: List[str]) -> Dict[str, List[str]]:
        """
        批量检查视频是否在视频库中
        
        Args:
            bvids: 视频BVID列表
            
        Returns:
            {
                "downloaded": ["BV1xx", "BV1yy"],  # 已下载的视频
                "not_downloaded": ["BV1zz"]      # 未下载的视频
            }
        """
        # 获取视频库数据
        library_data = self.local_library.get_library_data()
        downloaded_bvids = set()
        
        # 遍历所有文件夹和视频
        for folder in library_data.get('folders', []):
            for video in folder.get('videos', []):
                bvid = video.get('bvid')
                if bvid:
                    downloaded_bvids.add(bvid)
        
        # 分类检查结果
        downloaded = []
        not_downloaded = []
        
        for bvid in bvids:
            if bvid in downloaded_bvids:
                downloaded.append(bvid)
            else:
                not_downloaded.append(bvid)
        
        return {
            "downloaded": downloaded,
            "not_downloaded": not_downloaded
        }
    
    async def refresh_library(self) -> Dict[str, Any]:
        """
        刷新视频库缓存
        
        Returns:
            刷新结果
        """
        # 扫描视频库
        scan_result = self.local_library.scan_library()
        
        return {
            "refreshed_at": int(time.time()),
            "video_count": scan_result.total_files,
            "folder_count": scan_result.folder_count
        }
    
    async def get_library_status(self) -> Dict[str, Any]:
        """
        获取视频库状态
        
        Returns:
            视频库状态信息
        """
        library_data = self.local_library.get_library_data()
        
        return {
            "enabled": True,
            "cache_valid": True,
            "last_refresh": int(time.time()),
            "cache_ttl": 600,
            "total_videos": library_data.get('total_files', 0)
        }
```

#### API路由

**文件**：`apps/api/src/routers/video_library.py`

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session
from src.database import get_db
from src.services.video_library_service import VideoLibraryService

router = APIRouter(prefix="/api/video-library", tags=["video-library"])

class CheckBatchRequest(BaseModel):
    """批量检查请求"""
    bvids: List[str]

@router.post("/check-batch")
async def check_batch_videos(
    request: CheckBatchRequest,
    db: Session = Depends(get_db)
):
    """批量检查视频是否在视频库中"""
    try:
        service = VideoLibraryService(db)
        result = await service.check_videos_in_library(request.bvids)
        
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"检查视频失败: {str(e)}"
        )

@router.get("/refresh")
async def refresh_library(db: Session = Depends(get_db)):
    """刷新视频库缓存"""
    try:
        service = VideoLibraryService(db)
        result = await service.refresh_library()
        
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"刷新视频库失败: {str(e)}"
        )

@router.get("/status")
async def get_library_status(db: Session = Depends(get_db)):
    """获取视频库状态"""
    try:
        service = VideoLibraryService(db)
        result = await service.get_library_status()
        
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"获取视频库状态失败: {str(e)}"
        )
```

### 相关文档

- [视频库（组件/页面）](../components/video-library.md)
- [视频库设置](../settings/video-library.md)
- [视频库状态管理系统设计](../superpowers/specs/2026-04-16-video-library-status-management-design.md)

---

## 评论数据提取功能

### 功能概述

PiliNote 支持从B站提取视频评论数据并保存到NFO文件中，包括：

- **置顶评论**：B站官方置顶的评论
- **热门评论**：点赞数最高的3条评论
- **评论元数据**：作者、点赞数、回复数、发布时间等

### B站评论API

**端点**：`https://api.bilibili.com/x/v2/reply/main`

**请求参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | int | 是 | 1=视频评论 |
| `oid` | int | 是 | 视频AID |
| `mode` | int | 否 | 3=热门排序，2=时间排序 |
| `pagination_str` | string | 否 | 分页参数 |

**响应示例**：

```json
{
  "code": 0,
  "data": {
    "replies": [
      {
        "rpid": 123456,
        "oid": 115569248503531,
        "type": 1,
        "mid": 456789,
        "root": 0,
        "parent": 0,
        "dialog": 0,
        "count": 0,
        "rcount": 5,
        "state": 0,
        "fansgrade": 0,
        "attr": 0,
        "ctime": 1672531200,
        "rpid_str": "123456",
        "root_str": "0",
        "parent_str": "0",
        "like": 1000,
        "action": 0,
        "member": {
          "mid": "456789",
          "uname": "用户名",
          "sex": "未知",
          "sign": "个性签名",
          "avatar": "头像URL",
          "rank": 10000,
          "level": 6,
          "jointime": 1500000000,
          "moral": 0,
          "silence": 0,
          "email_status": 0,
          "coin": 0,
          "birthday": 0,
          "fans": 10000,
          "friend": 0,
          "attention": 0,
          "vip": {
            "type": 1,
            "status": 1,
            "due_date": 1704067200,
            "vip_pay_type": 0,
            "theme_type": 0,
            "label": {
              "path": "",
              "text": "年度大会员",
              "label_theme": "annual_vip",
              "text_color": "#FFFFFF",
              "bg_style": 1,
              "bg_color": "#FB7299",
              "border_color": ""
            },
            "avatar_subscript": 1,
            "nickname_color": "#FB7299",
            "role": 3,
            "avatar_subscript_url": "https://i0.hdslb.com/bfs/face/d1c6ac2b4f5b8a8e8e8e8e8e8e8e8e8e8e8e8e8.png"
          },
          "pendant": {
            "pid": 0,
            "name": "",
            "image": "",
            "expire": 0,
            "image_enhance": "",
            "image_enhance_frame": ""
          },
          "nameplate": {
            "nid": 0,
            "name": "",
            "image": "",
            "image_small": "",
            "level": "",
            "condition": ""
          },
          "official": {
            "role": 0,
            "title": "",
            "desc": "",
            "type": 0
          },
          "digital_spec": {
            "img_url": ""
          },
          "contract": {
            "is_display": false,
            "contract_url": ""
          },
          "avatar_size": 0,
          "senior_member": {
            "status": 0
          },
          "level_exp": {
            "current": 28800,
            "next": 28800,
            "total": 28800
          },
          "honor": {
            "mid": 0,
            "color": "",
            "tags": [],
            "honor": []
          }
        },
        "content": {
          "message": "评论内容",
          "plat": 1,
          "device": "",
          "members": [],
          "emote": {},
          "jump_url": {},
          "picture": {},
          "reply_control": {
            "location": "回复区"
          },
          "at_name_to_mid": {},
          "at_relations": {}
        },
        "replies": [],
        "assist": 0,
        "folder": {
          "has_folded": false,
          "is_folded": false,
          "rule": "folding_rule_1"
        },
        "up_action": {
          "like": false,
          "reply": false
        },
        "show_follow": false,
        "current_user": {
          "mid": 0,
          "following": false,
          "liked": false,
          "liked_time": 0
        },
        "invisible": false,
        "reply_text": "回复内容预览",
        "sub_reply_entry_text": "",
        "label": {
          "rcount": 0,
          "text": ""
        },
        "config": {
          "is_dust": false
        },
        "dialog": 0,
        "is_hot": true,
        "is_top": false,
        "like_icon": {
          "animation_url": ""
        },
        "ip_info": {
          "text": "IP属地：北京"
        },
        "card_label": {
          "text": ""
        },
        "note_text": "笔记文本"
      }
    ],
    "page": {
      "num": 1,
      "size": 20,
      "count": 100
    },
    "control": {
      "input_disable": false,
      "input_text": "发送评论",
      "upload_text": "上传图片",
      "oss_config": {}
    }
  }
}
```

### NFO评论数据结构

**XML格式**：

```xml
<?xml version="1.0" encoding="utf-8"?>
<movie>
  <title>视频标题</title>
  <plot>视频简介</plot>
  
  <!-- 评论数据 -->
  <comments>
    <comment type="top" like="5000" reply="100" author="置顶用户" time="1672531200">
      <content>这是置顶评论的内容</content>
    </comment>
    
    <comment type="hot" like="3000" reply="50" author="热门用户1" time="1672531300">
      <content>这是第一条热门评论的内容</content>
    </comment>
    
    <comment type="hot" like="2000" reply="30" author="热门用户2" time="1672531400">
      <content>这是第二条热门评论的内容</content>
    </comment>
    
    <comment type="hot" like="1000" reply="20" author="热门用户3" time="1672531500">
      <content>这是第三条热门评论的内容</content>
    </comment>
  </comments>
</movie>
```

**字段说明**：

| 属性 | 类型 | 说明 |
|------|------|------|
| `type` | string | 评论类型：`top`=置顶评论，`hot`=热门评论 |
| `like` | int | 点赞数 |
| `reply` | int | 回复数 |
| `author` | string | 评论作者 |
| `time` | int | 发布时间戳 |

### 后端实现

#### B站服务扩展

**文件**：`apps/api/src/services/bilibili.py`

```python
async def get_video_comments(self, aid: int, sessdata: str = "") -> Dict:
    """
    获取视频评论数据
    
    Args:
        aid: 视频AID
        sessdata: B站SESSDATA
        
    Returns:
        包含评论数据的字典
    """
    try:
        url = f"{self.api_base}/x/v2/reply/main"
        params = {
            "type": 1,  # 视频评论
            "oid": aid,
            "mode": 3,  # 热门排序
            "pagination_str": "{\"offset\":\"\"}"
        }
        
        headers = await self.headers_manager.get_headers()
        if sessdata:
            headers["Cookie"] = f"SESSDATA={sessdata}"
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers, params=params)
            
            # 处理Brotli压缩
            content = response.content
            if response.headers.get('content-encoding') == 'br':
                import brotli
                content = brotli.decompress(content)
            
            content_text = content.decode('utf-8', errors='ignore')
            data = json.loads(content_text)
            
            if data.get("code") == 0:
                replies_data = data.get("data", {})
                replies = replies_data.get("replies", [])
                
                # 提取置顶评论
                top_comment = None
                if replies and replies[0].get("is_top", False):
                    top_comment = replies[0]
                
                # 提取热门评论（排除置顶）
                hot_comments = [
                    r for r in replies 
                    if not r.get("is_top", False)
                ]
                hot_comments = sorted(hot_comments, key=lambda x: x.get("like", 0), reverse=True)[:3]
                
                # 格式化评论数据
                comments = []
                
                if top_comment:
                    comments.append({
                        "type": "top",
                        "author": top_comment.get("member", {}).get("uname", ""),
                        "content": top_comment.get("content", {}).get("message", ""),
                        "like": top_comment.get("like", 0),
                        "reply": top_comment.get("rcount", 0),
                        "time": top_comment.get("ctime", 0)
                    })
                
                for comment in hot_comments:
                    comments.append({
                        "type": "hot",
                        "author": comment.get("member", {}).get("uname", ""),
                        "content": comment.get("content", {}).get("message", ""),
                        "like": comment.get("like", 0),
                        "reply": comment.get("rcount", 0),
                        "time": comment.get("ctime", 0)
                    })
                
                return {
                    "success": True,
                    "data": {
                        "total": replies_data.get("page", {}).get("count", 0),
                        "top_comment": comments[0] if comments and comments[0]["type"] == "top" else None,
                        "hot_comments": [c for c in comments if c["type"] == "hot"],
                        "comments": comments
                    }
                }
            else:
                return {
                    "success": False,
                    "message": f"API返回错误: {data.get('message', '未知错误')}"
                }
                
    except Exception as e:
        return {
            "success": False,
            "message": f"获取评论异常: {str(e)}"
        }
```

#### NFO更新服务扩展

**文件**：`apps/api/src/services/nfo_update_service.py`

```python
async def _build_meta_from_video_info(self, bvid: str, video_info: Dict) -> Dict:
    """从视频信息构建元数据"""
    # ... 现有代码 ...
    
    # 获取评论数据
    if video_info.get("aid"):
        comments_result = await self.bilibili_service.get_video_comments(
            video_info["aid"], 
            ""
        )
        
        if comments_result.get("success"):
            meta["comments"] = comments_result["data"]["comments"]
    
    return meta
```

#### NFO生成扩展

**文件**：`apps/api/src/services/queue/handlers/nfo.py`

```python
def _generate_nfo_content(self, meta: Dict, video_data: Dict) -> str:
    """生成NFO文件内容"""
    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<movie>'
    ]
    
    # 基本信息
    # ... 现有代码 ...
    
    # 评论数据
    if meta.get('comments') and len(meta['comments']) > 0:
        lines.append('  <comments>')
        for comment in meta['comments']:
            lines.append(f'    <comment type="{comment.get("type", "unknown")}" like="{comment.get("like", 0)}" reply="{comment.get("reply", 0)}" author="{comment.get("author", "")}" time="{comment.get("time", 0)}">')
            lines.append(f'      <content>{self._escape_xml(comment.get("content", ""))}</content>')
            lines.append('    </comment>')
        lines.append('  </comments>')
    
    lines.append('</movie>')
    return '\n'.join(lines)

def _escape_xml(self, text: str) -> str:
    """转义XML特殊字符"""
    if not text:
        return ""
    return (text
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
        .replace("'", '&apos;'))
```

#### NFO解析扩展

**文件**：`apps/api/src/services/local_library_service.py`

```python
def _parse_nfo_file(self, nfo_path: str) -> Dict:
    """解析NFO文件"""
    try:
        tree = ET.parse(nfo_path)
        root = tree.getroot()
        
        nfo_data = {
            "title": root.findtext("title", ""),
            "plot": root.findtext("plot", ""),
            # ... 现有字段 ...
        }
        
        # 解析评论数据
        comments_elem = root.find('comments')
        if comments_elem is not None:
            comments = []
            for comment_elem in comments_elem.findall('comment'):
                comment = {
                    "type": comment_elem.get('type', 'unknown'),
                    "author": comment_elem.get('author', ''),
                    "like": int(comment_elem.get('like', 0)),
                    "reply": int(comment_elem.get('reply', 0)),
                    "time": int(comment_elem.get('time', 0)),
                    "content": comment_elem.findtext('content', '')
                }
                comments.append(comment)
            
            nfo_data["comments"] = comments
        
        return nfo_data
        
    except Exception as e:
        logger.error(f"解析NFO文件失败: {e}")
        return {}
```

### 测试脚本

**文件**：`apps/api/test_comments_api.py`

```python
import asyncio
import sys
import os

# 添加src到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.services.bilibili import BilibiliService

async def test_comments_api():
    """测试评论API"""
    
    # 创建BilibiliService实例
    bilibili_service = BilibiliService()
    
    # 测试视频BV号
    test_bvid = "BV1EyygBuEpn"
    
    print(f"开始测试评论API，视频BV号: {test_bvid}")
    
    try:
        # 获取视频信息
        print("步骤1: 获取视频信息...")
        video_result = await bilibili_service.get_video_info(test_bvid, "")
        
        if not video_result.get("success"):
            print(f"❌ 获取视频信息失败")
            return
        
        video_data = video_result.get("data", {})
        print(f"✅ 视频信息获取成功！AID: {video_data.get('aid', '无')}")
        
        # 获取评论数据
        print("\n步骤2: 获取评论数据...")
        if video_data.get("aid"):
            comments_result = await bilibili_service.get_video_comments(
                video_data["aid"], 
                ""
            )
            
            if comments_result.get("success"):
                comments_data = comments_result.get("data", {})
                print(f"✅ 评论API调用成功！")
                print(f"   总评论数: {comments_data.get('total', 0)}")
                print(f"   置顶评论: {'有' if comments_data.get('top_comment') else '无'}")
                print(f"   热门评论数: {len(comments_data.get('hot_comments', []))}")
            else:
                print(f"❌ 评论API调用失败")
        
        # 测试NFO更新
        print("\n步骤3: 测试NFO更新...")
        # ... NFO更新测试代码 ...
        
    except Exception as e:
        print(f"❌ 测试异常: {e}")
    
    finally:
        bilibili_service.close()

if __name__ == "__main__":
    asyncio.run(test_comments_api())
```

### 前端集成

**文件**：`apps/web/src/components/NewDownload/VideoLibrary.tsx`

**评论显示功能**：

```typescript
interface Comment {
  type: 'top' | 'hot';
  author: string;
  content: string;
  like: number;
  reply: number;
  time: number;
}

interface FolderMetadata {
  // ... 现有字段 ...
  comments?: Comment[];
}

// 显示评论信息
const renderComments = (comments: Comment[]) => {
  if (!comments || comments.length === 0) return null;
  
  return (
    <div className="comments-section">
      <h4>热门评论</h4>
      {comments.map((comment, index) => (
        <div key={index} className={`comment-item comment-${comment.type}`}>
          <div className="comment-header">
            <span className="comment-author">{comment.author}</span>
            <span className="comment-type">
              {comment.type === 'top' ? '置顶' : '热门'}
            </span>
          </div>
          <p className="comment-content">{comment.content}</p>
          <div className="comment-stats">
            <span>👍 {comment.like}</span>
            <span>💬 {comment.reply}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### 性能优化

1. **缓存评论数据**：减少重复API调用
2. **批量获取**：一次请求获取多个视频的评论
3. **增量更新**：只更新变化的数据
4. **异步处理**：后台更新，不阻塞主流程

### 注意事项

1. **API限制**：B站评论API有调用频率限制
2. **数据量控制**：只获取置顶和热门评论，避免数据过多
3. **隐私保护**：不存储用户敏感信息
4. **错误处理**：API失败时使用默认值
5. **编码处理**：正确处理中文和特殊字符

---

## 数据模型

### VideoFile（视频文件信息）

```python
class VideoFile:
    def __init__(self, path: str, size: int, modified_time: float, title: str):
        self.path = str          # 完整文件路径
        self.size = int          # 文件大小（字节）
        self.modified_time = float  # 修改时间戳
        self.title = str         # 从文件名提取的标题
```

### FolderMetadata（文件夹元数据）

```python
{
    "name": str,              # 文件夹名称
    "title": str,             # 文件夹标题（从NFO获取）
    "path": str,              # 文件夹路径
    "file_count": int,        # 文件夹内视频数量
    "size": int,              # 视频文件总大小
    "metadata_size": int,     # 元数据文件总大小
    "total_size": int,        # 总大小（视频+元数据）
    "cover": str,             # 封面文件名（统一为 cover.jpg）
    "cover_path": str,        # 封面文件路径
    "avatar": str,            # 头像文件名（avatar.jpg 或 avatar.png）
    "avatar_path": str,       # 头像文件路径
    "studio": str,            # UP主名称
    "nfo_data": object,       # NFO文件解析的数据
    "created_time": float     # 文件夹创建时间戳
}
```

**文件命名规范**：
- **封面**：统一命名为 `cover.jpg`
- **头像**：优先使用 `avatar.jpg`，如果不存在则查找 `avatar.png`
- **NFO文件**：使用文件夹名称，如 `{文件夹名}.nfo`

### LibraryScanResult（扫描结果）

```python
class LibraryScanResult:
    total_files: int                      # 扫描到的文件总数
    folder_count: int                     # 文件夹数量
    all_files: List[VideoFile]            # 所有发现的文件
    new_files: List[VideoFile]            # 新发现的文件
    existing_files: List[Tuple[Download, VideoFile]]  # 已存在的文件
    missing_files: List[Download]         # 数据库中记录但文件不存在的记录
    total_size: int                       # 所有文件总大小
    errors: List[str]                     # 扫描过程中的错误
    folders: List[Dict]                   # 文件夹统计信息
    folder_videos: Dict[str, Dict]        # 按文件夹组织的视频数据
```

---

## 前端集成

### 媒体库组件

**文件**：`apps/web/src/components/NewDownload/VideoLibrary.tsx`

**功能**：
- 动态扫描和刷新媒体库
- 按文件夹显示视频与图文目录
- 支持展开/折叠多视频文件夹
- 显示封面、头像、元数据
- 响应式布局设计
- 根据 `bvid` / `opus_id` 自动跳转视频或图文详情页
- 图文目录大小按“文档/图片 + 元数据”展示

**使用示例**：

```typescript
// 扫描媒体库
const scanLibrary = async () => {
  const response = await fetch('http://localhost:8000/api/library/scan', {
    method: 'POST'
  })
  const result = await response.json()
  if (result.success) {
    setScanResult(result.data)
  }
}

// 获取本地图片URL（通过API代理）
const getLocalImageUrl = (filePath: string): string => {
  return `http://localhost:8000/api/library/image?file_path=${encodeURIComponent(filePath)}`
}

// 刷新媒体库
const handleRefreshLibrary = async () => {
  const result = await scanLibrary()
  alert(`媒体库刷新完成！\n目录: ${result.folder_count}\n视频文件: ${result.total_files}`)
}
```

### 下载列表集成

**文件**：`apps/web/src/components/NewDownload/DownloadsList.tsx`

**功能**：
- 提供媒体库刷新菜单
- 支持自动导入和同步
- 显示媒体库统计信息

**使用示例**：

```typescript
// 刷新本地媒体库
const handleRefreshLibrary = async () => {
  const response = await fetch(
    'http://localhost:8000/api/library/sync?auto_import=true&auto_cleanup=false',
    { method: 'POST' }
  )
  const result = await response.json()
  alert(`媒体库刷新完成！\n扫描文件: ${result.data.scan_result.total_files}\n新文件: ${result.data.imported_count}`)
}

// 获取媒体库统计信息
const fetchLibraryStats = async () => {
  const response = await fetch('http://localhost:8000/api/library/statistics')
  const result = await response.json()
  setLibraryStats(result.data)
}
```

---

## 下载完成流程

### 完整流程

```
1. 开始下载
   ↓
2. 下载到临时目录
   ↓
3. 下载完成
   ↓
4. 移动文件到最终目录
   ↓
5. 生成NFO文件（如果启用）
   ↓
6. 下载封面图（如果启用）
   ↓
7. 下载UP主头像（如果启用）
   ↓
8. 更新数据库状态为completed
   ↓
9. 视频库可以扫描到该文件
```

### 相关代码

**文件**：`apps/api/src/services/download_service.py`

```python
async def _process_completed_download(
    self,
    download_id: str,
    temp_dir: Path,
    final_dir: Path,
    storage_settings
):
    """处理已完成的下载 - 移动文件并清理"""
    
    # 1. 移动临时目录中的所有内容到最终目录
    for item in temp_dir.iterdir():
        shutil.move(str(item), str(dest))
    
    # 2. 查找视频文件
    video_files = [f for f in final_dir.rglob('*') if f.is_file() and f.suffix in ['.mp4', '.flv', '.mkv', '.webm']]
    
    if video_files:
        video_file = video_files[0]
        video_dir = video_file.parent
        
        # 3. 更新数据库
        download.file_path = str(video_file)
        download.file_size = video_file.stat().st_size
        download.temp_file_path = None
        
        # 4. 生成NFO文件
        if download.enable_nfo:
            self._generate_nfo_file(video_file, download, description, video_stats)
        
        # 5. 下载封面图（如果启用）
        if download.enable_cover and download.thumbnail_url:
            # 封面统一命名为 cover.jpg
            await self._download_thumbnail(download, video_dir)
        
        # 6. 下载UP主头像
        if download.enable_avatar and download.uploader_mid:
            await self._download_avatar(download, video_dir)
```

---

## 性能优化

### 1. 按需扫描

- 用户主动点击刷新按钮时才扫描
- 避免后台频繁扫描影响性能

### 2. 缓存扫描结果

- 扫描结果存储在前端状态中
- 用户切换标签页时不重新扫描

### 3. 文件匹配优化

- 多维度匹配，提高准确率
- 快速路径匹配（完全路径、文件名）

### 4. 图片代理优化

- 只在需要显示图片时才请求
- 使用CDN缓存（如果有）

---

## 安全考虑

1. **文件路径限制**：图片代理端点限制文件类型，防止非法访问
2. **路径安全检查**：确保文件路径在合法范围内
3. **数据验证**：使用 Pydantic 进行数据验证
4. **错误处理**：统一错误处理，避免敏感信息泄露
5. **权限控制**：本地文件访问限制在下载目录内

---

## 相关文档

- [下载系统（总览）](../download/README.md)
- [下载服务（组件）](../components/download-service.md)
- [NFO文件格式](../metadata/nfo-format.md)
- [本地视频库（组件/页面）](../components/video-library.md)
- [API 端点索引](./endpoints.md)

---

[返回上级](./README.md)
