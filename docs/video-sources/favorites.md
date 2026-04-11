# 收藏夹

---
关联文档:
  - ../auth/login-flow.md    # 需要登录验证
  - ../auth/cookies.md      # Cookie 管理
  - ../auth/multi-account.md  # 登录状态验证 isAuthenticated
  - ../database/models.md   # User 模型
  - ../api/endpoints.md    # API 端点
涉及文件:
  - apps/api/src/routers/favorites.py
  - apps/api/src/services/bilibili.py
  - apps/api/src/services/media_data_transformer.py
  - apps/api/src/services/headers_manager.py
  - apps/web/src/components/MainLayout.tsx  # isAuthenticated 登录检查
  - apps/web/src/pages/components/FavoritesContent.tsx
依赖服务:
  - BilibiliService
  - HeadersManager
  - MediaDataTransformer
---

## 登录状态验证

**前端检查**（已修复）：
```typescript
// apps/web/src/components/MainLayout.tsx
{isAuthenticated ? (
  <FavoritesContent />
) : (
  <LoginPrompt message="登录后可以查看和管理您的收藏夹" />
)}
```

之前使用 `user?.sessdata` 检查，现改为 `isAuthenticated`。

## 数据获取

### 1. 获取收藏夹列表

```
GET /api/favorites/folders
```

**后端流程**：
```
1. 前端调用 getFolders()
2. 后端 /api/favorites/folders
3. BilibiliService.get_folder_list()
4. 返回收藏夹列表
```

**关键文件**：
- 前端: `apps/web/src/services/api.ts` - `getFolders()`
- 后端: `apps/api/src/routers/favorites.py` - `/api/favorites/folders`

### 2. 获取收藏夹详情

```
GET /api/favorites/folders/{folder_id}?pn=1&ps=20&keyword=&order=mtime
```

**参数**：
- `pn`: 页码
- `ps`: 每页数量
- `keyword`: 搜索关键词
- `order`: 排序方式 (mtime/cweight/view)

**后端流程**：
```
1. 前端调用 getFolderDetail(folderId, page)
2. 后端路由调用 BilibiliService.get_folder_detail()
3. MediaDataTransformer.transform_favorite_list()
4. 返回视频列表
```

**关键文件**：
- 前端: `apps/web/src/pages/components/FavoritesContent.tsx`
- 后端: `apps/api/src/services/media_data_transformer.py` - 数据转换

---

[返回上级](./README.md)