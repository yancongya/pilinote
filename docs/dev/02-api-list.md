# B站API列表

## 认证相关
- 获取二维码: `/x/passport-login/web/qrcode/generate`
- 轮询登录状态: `/x/passport-login/web/qrcode/poll`
- 获取加密key: `/x/passport-login/web/key`
- 密码登录: `/x/passport-login/web/login`

## 收藏夹相关
- 获取收藏夹列表: `/x/v3/fav/folder/created/list`
  - 参数: pn, ps, up_mid
- 获取收藏夹详情: `/x/v3/fav/resource/list`
  - 参数: media_id, pn, ps, keyword, order, type, tid, platform
  - 排序: view, mtime, pubtime

## 稍后再看
- 获取列表: `/x/v2/history/toview`
- 添加到稍后: `/x/v2/history/toview/add`
- 删除: `/x/v2/history/toview/del`
- 清空: `/x/v2/history/toview/clear`

## 视频信息
- 视频详情: `/x/web-interface/view`
- 视频播放地址: `/x/player/wbi/playurl`
- 字幕列表: `/x/player/wbi/v2`
- 弹幕: `/x/v1/dm/list.so`

## 参考实现
- `reference/pilipala/lib/http/api.dart`
- `reference/pilipala/lib/http/user.dart`
- bilibili-API-collect