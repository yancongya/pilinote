# 稍后再看

---
关联文档:
  - ../auth/login-flow.md    # 需要登录验证
  - ../auth/cookies.md      # Cookie 管理
  - ../database/models.md   # User 模型
  - ../api/endpoints.md    # API 端点
涉及文件:
  - apps/api/src/routers/watchlater.py
  - apps/api/src/services/bilibili.py
  - apps/api/src/services/media_data_transformer.py
  - apps/api/src/services/headers_manager.py
依赖服务:
  - BilibiliService
  - HeadersManager
  - MediaDataTransformer
---

## 数据获取

### API

```
GET /api/watchlater/list?pn=1&ps=20
```

或者使用 media API：

```
GET /api/media/watchlater
```

**参数**：
- `pn`: 页码
- `ps`: 每页数量

### 后端流程

```
1. 前端调用 getWatchLaterList(pn, ps)
2. 后端 /api/watchlater/list
3. BilibiliService.get_watch_later()
4. MediaDataTransformer.transform_watchlater_list()
5. 返回视频列表
```

**关键文件**：
- 前端: `apps/web/src/services/api.ts` - `getWatchLaterMedia()` (使用 `/api/media/watchlater`)
- 后端: `apps/api/src/routers/watchlater.py` - `/api/watchlater/list`
- 后端: `apps/api/src/routers/media.py` - `/api/media/watchlater`
- 数据转换: `apps/api/src/services/media_data_transformer.py`

---

[返回上级](./README.md)