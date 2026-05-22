# 稍后再看 API 文档

## 概述

当前后端仅实现“读取稍后再看列表”的能力：服务端会调用 B 站接口拉取列表数据，并在服务端完成本地分页 / 搜索 / 排序（同时支持缓存回退）。

## 认证方式

- 通过 Cookie 传递 `SESSDATA`（以及后端依赖需要的其他 Cookie 字段）
- 未登录或 Cookie 无效时返回 401（由后端鉴权依赖处理）

## 端点

### 获取稍后再看列表

- 方法：`GET`
- 路径：`/api/watch-later/list`

查询参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `pn` | int | 否 | 1 | 页码，从 1 开始 |
| `ps` | int | 否 | 20 | 每页数量，最大 100 |
| `keyword` | string | 否 | `""` | 搜索关键词（匹配标题，大小写不敏感） |
| `order` | string | 否 | `default` | 排序：`default`、`view`、`pubtime`、`add_time` |
| `sort_direction` | string | 否 | `desc` | 排序方向：`desc`、`asc` |

请求示例：

```bash
curl -X GET "http://localhost:8000/api/watch-later/list?pn=1&ps=20" \\
  -H "Cookie: SESSDATA=your_sessdata_here"
```

响应结构：

- 成功时返回 `CardListResponse`：`data.list`（卡片数组）+ `data.total/page/page_size`
- 字段细节以 `apps/api/src/schemas/card.py` 与服务端转换逻辑为准

## 未实现 / 计划中

“添加到稍后再看 / 从稍后再看移除”等写接口当前未在后端实现；如需补齐，建议先在 `docs/api/endpoints.md` 的总表中明确读写能力与鉴权方式，再补路由与前端调用。

