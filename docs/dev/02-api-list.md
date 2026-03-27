# B站API列表

## 认证相关
- 获取二维码: `/x/passport-login/web/qrcode/generate`
- 轮询登录状态: `/x/passport-login/web/qrcode/poll`
- 获取加密key: `/x/passport-login/web/key`
- 密码登录: `/x/passport-login/web/login`
- 获取用户信息: `/x/web-interface/nav`

## 收藏夹相关
- 获取收藏夹列表: `/x/v3/fav/folder/created/list`
  - 参数: pn, ps, up_mid
  - 返回: 收藏夹列表（id, title, cover, media_count等）
- 获取收藏夹详情: `/x/v3/fav/resource/list`
  - 参数: media_id, pn, ps, keyword, order, type, tid, platform
  - 排序: view（播放量）, mtime（收藏时间）, pubtime（发布时间）
  - 返回: 视频列表（bvid, title, cover, duration, view, danmaku等）

## 稍后再看
- 获取列表: `/x/v2/history/toview`
- 添加到稍后: `/x/v2/history/toview/add`
- 删除: `/x/v2/history/toview/del`
- 清空: `/x/v2/history/toview/clear`

## 视频信息
- 视频详情: `/x/web-interface/view`
  - 参数: bvid 或 aid
  - 返回: 完整视频信息（标题、封面、UP主、统计数据、分P信息等）
- 视频播放地址: `/x/player/wbi/playurl`
- 字幕列表: `/x/player/wbi/v2`
- 弹幕: `/x/v1/dm/list.so`

## 已实现的后端API

### 认证模块 (`/api/auth`)
- `GET /api/auth/qrcode` - 获取登录二维码
- `GET /api/auth/qrcode/status/{qrcode_key}` - 查询二维码登录状态
- `POST /api/auth/sessdata` - SESSDATA登录
- `POST /api/auth/password` - 密码登录
- `POST /api/auth/sms/send` - 发送手机验证码
- `POST /api/auth/sms/login` - 手机验证码登录
- `GET /api/auth/user-info` - 获取用户信息
- `GET /api/auth/proxy/avatar` - 图片代理（解决防盗链）

### 收藏夹模块 (`/api/favorites`)
- `GET /api/favorites/folders` - 获取收藏夹列表
  - 参数: sessdata, up_mid, page, page_size
- `GET /api/favorites/folders/{folder_id}` - 获取收藏夹详情（视频列表）
  - 参数: sessdata, page, page_size, keyword, order, type, tid

### 视频模块 (`/api/video`)
- `GET /api/video/{video_id}` - 获取视频详情
  - 参数: video_id (bvid或aid), sessdata (可选)
  - 返回: 完整视频信息包括分P、分辨率、统计等

## API响应格式
所有后端API都遵循统一的响应格式：
```json
{
  "success": true|false,
  "message": "错误信息（如果失败）",
  "data": {
    // 实际数据
  }
}
```

## 图片代理
为了解决B站图片防盗链问题，使用专门的代理端点：
```
GET /api/auth/proxy/avatar?url={encodeURIComponent(original_url)}
```

## 注意事项
1. **认证信息**: 大部分B站API需要用户SESSDATA才能获取完整信息
2. **防盗链**: 所有B站图片都需要通过代理或添加Referer头来访问
3. **请求频率**: 避免过于频繁的请求，可能触发限流
4. **参数编码**: 所有字符串参数都需要正确编码（特别是SESSDATA）

## 参考实现
- `reference/pilipala/lib/http/api.dart`
- `reference/pilipala/lib/http/user.dart`
- `reference/bilibili-favlist-auto-downloader/down_fav.py`
- bilibili-API-collect (https://github.com/SocialSisterYi/bilibili-API-collect)

## 测试工具
```bash
# 测试收藏夹列表
curl "http://localhost:8000/api/favorites/folders?sessdata=YOUR_SESSDATA&up_mid=YOUR_MID"

# 测试视频详情
curl "http://localhost:8000/api/video/BV1xx411c7mD"
