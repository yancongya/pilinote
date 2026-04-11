# API Contracts for Card Data

- Endpoints
  - GET /api/watchlater/list -> CardData[] + pagination
  - GET /api/favorites/folders -> CardData from folders
- Response shape (CardData)
  - id, bvid, title, cover, duration, pubtime, view, danmaku, comment, like, coin, favorite, share, uploader
- Error handling
  - 4xx/5xx with message field
- Versioning
  - CardData v1 stable, deprecations announced clearly
