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
GET /api/watchlater?pn=1&ps=20
```

**参数**：
- `pn`: 页码
- `ps`: 每页数量

### 后端流程

```
1. 前端调用 getWatchLaterList(pn, ps)
2. 后端 /api/watchlater
3. BilibiliService.get_watchlater_list()
4. MediaDataTransformer.transform_watchlater_list()
5. 返回视频列表
```

**关键文件**：
- 前端: `apps/web/src/services/api.ts` - `getWatchLaterList()`
- 前端: `apps/web/src/pages/components/WatchLaterContent.tsx`
- 后端: `apps/api/src/routers/watchlater.py`
- 数据转换: `apps/api/src/services/media_data_transformer.py`

---

[返回上级](./README.md)