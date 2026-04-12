# BilibiliService 服务

## 概述

Bilibili API 封装服务，处理所有与 Bilibili 后端的交互。

## 文件位置

`apps/api/src/services/bilibili.py`

## 主要功能

### 认证相关

| 方法 | 说明 |
|------|------|
| `init()` | 初始化服务（获取 cookie、设置 headers） |
| `check_and_refresh_cookies()` | 检查并刷新 Cookie |
| `get_qrcode()` | 获取登录二维码 |
| `query_qrcode_status()` | 查询二维码状态 |
| `login_by_sessdata()` | SESSDATA 登录 |
| `sign_params()` | 参数签名 |
| `encrypt_password()` | RSA 加密密码 |

### 媒体数据获取

| 方法 | 说明 |
|------|------|
| `get_video_info()` | 获取视频信息 |
| `get_video_pages()` | 获取视频分P列表 |
| `get_folder_list()` | 获取收藏夹列表 |
| `get_folder_detail()` | 获取收藏夹详情 |
| `get_watch_later()` | 获取稍后再看 |
| `get_user_info()` | 获取用户信息 |

### API URL 生成

`get_video_info_url()` 方法支持生成正确的 API URL：

| 类型 | 参数 | API URL |
|------|------|---------|
| VIDEO | BV号 | `/x/web-interface/view?bvid=` |
| VIDEO | AV号 | `/x/web-interface/view?aid=` |
| BANGUMI | ep/ss/md | `/pgc/view/web/season?ep_id=` |
| OPUS | cv | `/x/article/viewinfo?cv=` |
| MUSIC | au | `/audio/music-service-c/info?sid=` |

### 搜索与发现

| 方法 | 说明 |
|------|------|
| `search_by_type()` | 按类型搜索 |
| `get_popular()` | 获取热门视频 |
| `get_ranking()` | 获取排行榜 |

## 使用方式

```python
from src.services.bilibili import BilibiliService

# 创建服务
service = BilibiliService()

# 初始化（必须）
await service.init()

# 获取视频信息
video_info = await service.get_video_info("BV1xx411c7mD")

# 获取分P列表
pages = await service.get_video_pages(170001)
```

## 核心方法

### get_video_info

```python
async def get_video_info(self, id_string: str) -> Dict:
    """
    获取视频信息
    
    Args:
        id_string: BV号 或 AV号
        
    Returns:
        {
            "bvid": "BV1xx411c7mD",
            "aid": 170001,
            "title": "视频标题",
            "pic": "封面URL",
            "desc": "简介",
            "duration": 300,
            "owner": {"mid": 123456, "name": "UP主", "face": "头像URL"},
            "stat": {"view": 10000, "like": 500, "coin": 100, "favorite": 200}
        }
    """
```

### get_video_pages

```python
async def get_video_pages(self, aid: int) -> List[Dict]:
    """
    获取视频分P列表
    
    Returns:
    [
        {
            "page": 1,
            "cid": 123456,
            "part": "P1: 标题",
            "duration": 300
        }
    ]
    """
```

## 关联服务

- [HeadersManager](headers-manager.md) - 请求头管理
- [CookieManager](cookie-manager.md) - Cookie 管理
- [MediaProcessor](media-processor.md) - 媒体处理

---

[返回上级](./README.md)