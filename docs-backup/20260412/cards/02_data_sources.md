# 数据源与字段映射

本节描述 Watch Later 与 收藏页视频卡片的数据源、字段映射和数据转换规则。

- 数据源 A：Watch Later API
  - 入口：/api/watchlater/list
  - 关键字段（来自 Bilibili API 的 list 中一个 video 的字段）：
    - id, title, bvid, pic (cover), duration, pubtime, add_at, progress, owner(mid, name, face), cnt_info(play, danmaku, reply, like, coin, collect, share)
  - 注意点：部分字段可能为 0 或缺失，需要后端做兜底。

- 数据源 B：Favorites API
  - 入口：/api/favorites/folders /folders/{folder_id} /collected
  - 关键字段：folder_id, title, media_count, cover, intro, list 中的 medias（同样包含基本媒体信息与统计）
  - 常见映射：视频信息映射到 card 的字段集，保留 uploader 信息。

- 字段对齐规则
  - 统一字段集合：id, bvid, title, cover, duration, pubtime, view, danmaku, comment, like, coin, favorite, share, uploader(mid, name, face)
  - meta 数据：pubtime 与 add_time 需要统一为 ISO8601 字符串格式或时间戳，前端统一处理格式。
  - 对缺失字段的处理：设为 null 或 0，根据字段语义确定默认值。

- 注意事项
  - 某些字段如 view/danmaku/reply 可能来自不同接口，需在后端做统一归一化。
  - 数据源中的字段名可能随原始 API 变动，需在后端封装层实现一个适配层以减少前端变动。
