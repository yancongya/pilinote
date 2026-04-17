# NFO文件格式

## 概述

NFO（Info）文件是PiliNote系统用于存储视频元数据的XML格式文件。它包含了从B站API获取的视频信息，如标题、简介、UP主、发布时间、统计数据等。NFO文件与视频文件一起存储，方便本地播放器（如Kodi、Emby、Plex等）读取和显示视频信息。

## 文件位置

- **单视频**：与视频文件同目录，命名为 `{文件夹名}.nfo`
- **视频系列**：在系列文件夹中，命名为 `{系列名}.nfo`

## 文件命名规范

- 使用文件夹名称作为NFO文件名
- 例如：`【Blender教程】.nfo`
- 统一使用UTF-8编码

## XML结构

### 基本结构

```xml
<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <bvid>BV1xx411c7mD</bvid>
  <title>视频标题</title>
  <plot>视频简介</plot>
  <studio>UP主名称</studio>
  <premiered>2024-01-01</premiered>
  <thumb>https://example.com/cover.jpg</thumb>
  <runtime>12:34</runtime>
  <rating>8.5</rating>
  <statistics>
    <play>10000</play>
    <like>500</like>
    <coin>200</coin>
    <favorite>100</favorite>
    <share>50</share>
    <danmaku>100</danmaku>
    <reply>80</reply>
  </statistics>
  <tags>
    <tag>弹幕:100</tag>
    <tag>评论:80</tag>
    <tag>分享:50</tag>
  </tags>
</movie>
```

## 字段说明

### 基本信息字段

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `bvid` | string | 是 | B站视频ID | `BV1xx411c7mD` |
| `title` | string | 是 | 视频标题 | `【Blender教程】基础操作` |
| `plot` | string | 否 | 视频简介 | `这是Blender的基础操作教程...` |
| `studio` | string | 否 | UP主名称 | `UP主名` |
| `premiered` | string | 否 | 发布日期 | `2024-01-01` |
| `thumb` | string | 否 | 封面图片URL | `https://i0.hdslb.com/...` |

### 统计数据字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `statistics/play` | int | 播放量 | `10000` |
| `statistics/like` | int | 点赞数 | `500` |
| `statistics/coin` | int | 投币数 | `200` |
| `statistics/favorite` | int | 收藏数 | `100` |
| `statistics/share` | int | 分享数 | `50` |
| `statistics/danmaku` | int | 弹幕数 | `100` |
| `statistics/reply` | int | 评论数 | `80` |

### 扩展字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `runtime` | string | 视频时长 | `12:34` |
| `rating` | float | 评分（基于互动率） | `8.5` |
| `tags/tag` | string | 标签（从统计数据生成） | `弹幕:100` |

## 字段详细说明

### bvid

**说明**：B站视频的唯一标识符，用于从B站API获取最新数据。

**来源**：从视频URL或下载任务的`media_id`字段获取。

**重要性**：必需字段，用于NFO更新和后续API调用。

### title

**说明**：视频的标题。

**来源**：从B站API的`videoData.title`字段获取。

**编码**：XML转义处理，支持中文、特殊字符等。

### plot

**说明**：视频的简介或描述信息。

**来源**：从B站API的`videoData.desc`字段获取。

**处理**：
- 截取前500字符（避免过长）
- XML转义处理
- 移除HTML标签

### studio

**说明**：UP主的名称。

**来源**：从B站API的`videoData.owner.name`字段获取。

**用途**：显示视频的创作者信息。

### premiered

**说明**：视频的发布日期。

**来源**：从B站API的`videoData.pubdate`字段获取。

**格式**：`YYYY-MM-DD`格式。

**处理**：将时间戳转换为日期字符串。

### thumb

**说明**：视频封面图片的URL。

**来源**：从B站API的`videoData.pic`字段获取。

**处理**：保存为本地文件`cover.jpg`，同时保留原始URL。

### runtime

**说明**：视频的时长。

**来源**：从B站API的`videoData.pages[0].duration`字段获取。

**格式**：`MM:SS`格式，如果超过60分钟则为`HH:MM:SS`。

**计算方式**：
```python
minutes = int(duration // 60)
seconds = int(duration % 60)
runtime = f"{minutes}:{seconds:02d}"
```

### rating

**说明**：基于互动率计算的评分（5分制）。

**计算公式**：
```python
interaction_score = (like * 0.4 + coin * 0.4 + favorite * 0.3 + share * 0.6 + danmaku * 0.4 + reply * 0.4)
interaction_rate = interaction_score / play
smoothed_rate = log(1 + interaction_rate * 1000) / log(1001)
base_rating = smoothed_rate * 5
rating = clamp_bayes(base_rating, play, 5000, 2.0, 0, 5)
```

**说明**：
- 播放量`play`作为基数
- 点赞`like`、投币`coin`、收藏`favorite`、分享`share`、弹幕`danmaku`、评论`reply`共同参与计算
- 先将互动率做对数平滑，再映射到5分制
- 最终评分限制在0-5分

**示例**：
- 播放量：10000
- 点赞：500 → 得分 = 500 * 0.4 = 200
- 投币：200 → 得分 = 200 * 0.3 = 60
- 收藏：100 → 得分 = 100 * 0.3 = 30
- 互动总分 = 290
- 互动率 = 290 / 10000 = 0.029
- 评分被限制在 5.0 以内

### statistics

**说明**：B站统计数据，包含播放量、点赞数等。

**子字段**：
- `play`：播放量
- `like`：点赞数
- `coin`：投币数
- `favorite`：收藏数
- `share`：分享数
- `danmaku`：弹幕数
- `reply`：评论数

**来源**：从B站API的`videoData.stat`字段获取。

### tags

**说明**：从统计数据生成的标签。

**生成规则**：
- 弹幕数 > 0：生成`弹幕:{danmaku_count}`标签
- 评论数 > 0：生成`评论:{reply_count}`标签
- 分享数 > 0：生成`分享:{share_count}`标签

**用途**：前端显示标签，帮助用户快速了解视频热度。

## NFO文件示例

### 完整示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <bvid>BV1xx411c7mD</bvid>
  <title>【Blender教程】基础操作 - 零基础入门</title>
  <plot>这是Blender的基础操作教程，适合零基础的初学者学习。教程涵盖了Blender的界面介绍、基本操作、对象管理等核心内容。</plot>
  <studio>Blender学习频道</studio>
  <premiered>2024-01-01</premiered>
  <thumb>https://i0.hdslb.com/bfs/archive/1234567890abcdef.jpg</thumb>
  <runtime>12:34</runtime>
  <rating>8.5</rating>
  <statistics>
    <play>10000</play>
    <like>500</like>
    <coin>200</coin>
    <favorite>100</favorite>
    <share>50</share>
    <danmaku>100</danmaku>
    <reply>80</reply>
  </statistics>
  <tags>
    <tag>弹幕:100</tag>
    <tag>评论:80</tag>
    <tag>分享:50</tag>
  </tags>
</movie>
```

### 简化示例（老版本兼容）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <title>老视频标题</title>
  <plot>老视频简介</plot>
  <studio>UP主名称</studio>
  <statistics>
    <play>5000</play>
  </statistics>
</movie>
```

## NFO文件生成

### 生成时机

1. **下载完成时**：视频下载完成后自动生成NFO文件
2. **批量更新时**：通过API批量更新NFO文件的统计数据
3. **手动更新时**：通过API手动更新单个NFO文件

### 生成流程

```
1. 获取视频元数据（从B站API）
   ↓
2. 提取基本信息（标题、简介、UP主等）
   ↓
3. 提取统计数据（播放量、点赞数等）
   ↓
4. 计算扩展字段（评分、标签、时长）
   ↓
5. 构建XML结构
   ↓
6. XML转义处理
   ↓
7. 写入NFO文件
```

### 相关代码

**文件**：`apps/api/src/services/queue/handlers/nfo.py`

```python
class SingleNfoHandler(BaseHandler):
    """单个视频NFO处理器"""
    
    async def generate_nfo(self, meta: Dict[str, Any], file_path: Path):
        """生成NFO文件"""
        lines = []
        lines.append('<?xml version="1.0" encoding="UTF-8"?>')
        lines.append('<movie>')
        
        # BVID字段
        if meta.get('bvid'):
            lines.append(f'  <bvid>{self._escape_xml(meta["bvid"])}</bvid>')
        
        # 标题
        if meta.get('title'):
            lines.append(f'  <title>{self._escape_xml(meta["title"])}</title>')
        
        # 简介截取前500字符
        if meta.get('desc'):
            desc = meta['desc'][:500] if len(meta['desc']) > 500 else meta['desc']
            lines.append(f'  <plot>{self._escape_xml(desc)}</plot>')
        
        # UP主
        if meta.get('uploader'):
            lines.append(f'  <studio>{self._escape_xml(meta["uploader"])}</studio>')
        
        # 发布日期
        if meta.get('pubdate'):
            pub_date_str = datetime.fromtimestamp(meta['pubdate']).strftime('%Y-%m-%d')
            lines.append(f'  <premiered>{pub_date_str}</premiered>')
        
        # 统计数据
        if meta.get('stat'):
            stat = meta['stat']
            lines.append('  <statistics>')
            if stat.get('view'):
                lines.append(f'    <play>{stat["view"]}</play>')
            if stat.get('like'):
                lines.append(f'    <like>{stat["like"]}</like>')
            if stat.get('coin'):
                lines.append(f'    <coin>{stat["coin"]}</coin>')
            if stat.get('favorite'):
                lines.append(f'    <favorite>{stat["favorite"]}</favorite>')
            if stat.get('share'):
                lines.append(f'    <share>{stat["share"]}</share>')
            if stat.get('danmaku'):
                lines.append(f'    <danmaku>{stat["danmaku"]}</danmaku>')
            if stat.get('reply'):
                lines.append(f'    <reply>{stat["reply"]}</reply>')
            lines.append('  </statistics>')
        
        # 评分（基于互动率计算）
        if meta.get('stat'):
            rating = self._calculate_rating(meta['stat'])
            if rating > 0:
                lines.append(f'  <rating>{rating:.1f}</rating>')
        
        # 视频标签（从统计数据中提取）
        if meta.get('stat'):
            tags = []
            stat = meta['stat']
            if stat.get('danmaku'):
                tags.append(f"弹幕:{stat['danmaku']}")
            if stat.get('reply'):
                tags.append(f"评论:{stat['reply']}")
            if stat.get('share'):
                tags.append(f"分享:{stat['share']}")
            
            if tags:
                lines.append('  <tags>')
                for tag in tags:
                    lines.append(f'    <tag>{tag}</tag>')
                lines.append('  </tags>')
        
        lines.append('</movie>')
        
        # 写入文件
        content = '\n'.join(lines)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _escape_xml(self, text: str) -> str:
        """转义XML特殊字符"""
        if not text:
            return ''
        text = text.replace('&', '&amp;')
        text = text.replace('<', '&lt;')
        text = text.replace('>', '&gt;')
        text = text.replace('"', '&quot;')
        text = text.replace("'", '&apos;')
        return text
    
    def _calculate_rating(self, stats: Dict[str, Any]) -> float:
        """计算B站视频评分（基于互动率）"""
        try:
            play = stats.get('view', 0) or 0
            if play == 0:
                return 0.0
            
            like = stats.get('like', 0) or 0
            coin = stats.get('coin', 0) or 0
            favorite = stats.get('favorite', 0) or 0
            share = stats.get('share', 0) or 0
            danmaku = stats.get('danmaku', 0) or 0
            reply = stats.get('reply', 0) or 0

            # 计算互动得分
            interaction_score = (
                like * 0.4 +
                coin * 0.4 +
                favorite * 0.3 +
                share * 0.6 +
                danmaku * 0.4 +
                reply * 0.4
            )

            # 计算互动率
            interaction_rate = interaction_score / play

            # 对数平滑并映射到5分制
            import math
            smoothed_rate = math.log(1 + interaction_rate * 1000) / math.log(1001)
            base_rating = smoothed_rate * 5
            m = 5000
            C = 2.0
            rating = (play / (play + m)) * base_rating + (m / (play + m)) * C
            rating = min(max(rating, 0), 5)

            return round(rating, 1)
        except Exception as e:
            logger.warning(f"计算评分失败: {e}")
            return 0.0
```

## NFO文件解析

### 解析流程

```
1. 读取NFO文件
   ↓
2. 解析XML结构
   ↓
3. 提取各个字段的值
   ↓
4. 类型转换（字符串转数字、日期等）
   ↓
5. 返回结构化数据
```

### 相关代码

**文件**：`apps/api/src/services/local_library_service.py`

```python
def _parse_nfo_file(self, nfo_path: Path) -> Optional[Dict[str, Any]]:
    """解析NFO文件并提取元数据"""
    try:
        import xml.etree.ElementTree as ET
        
        tree = ET.parse(nfo_path)
        root = tree.getroot()
        
        metadata = {}
        
        # 提取BVID
        bvid_elem = root.find('bvid')
        if bvid_elem is not None and bvid_elem.text:
            metadata['bvid'] = bvid_elem.text
        
        # 提取基本信息
        title_elem = root.find('title')
        if title_elem is not None and title_elem.text:
            metadata['title'] = title_elem.text
        
        # 提取统计数据
        stats_elem = root.find('statistics')
        if stats_elem is not None:
            stats = {}
            play_elem = stats_elem.find('play')
            if play_elem is not None and play_elem.text:
                try:
                    stats['play'] = int(play_elem.text)
                except ValueError:
                    pass
            # ... 其他统计数据
            
            if stats:
                metadata['statistics'] = stats
        
        # 提取评分
        rating_elem = root.find('rating')
        if rating_elem is not None and rating_elem.text:
            try:
                metadata['rating'] = float(rating_elem.text)
            except ValueError:
                pass
        
        # 提取标签
        tags_elem = root.find('tags')
        if tags_elem is not None:
            tags = []
            for tag_elem in tags_elem.findall('tag'):
                if tag_elem.text and tag_elem.text.strip():
                    tags.append(tag_elem.text.strip())
            if tags:
                metadata['tags'] = tags
        
        return metadata if metadata else None
        
    except Exception as e:
        logger.error(f"解析NFO文件失败: {e}")
        return None
```

## NFO文件更新

### 更新方式

1. **单个更新**：通过API更新单个NFO文件
2. **批量更新**：通过API批量更新目录下的NFO文件

### 更新内容

- 更新统计数据（播放量、点赞数等）
- 重新计算评分
- 重新生成标签
- 保留基本信息不变

### 相关API

- `POST /api/library/nfo/update` - 更新单个NFO文件
- `POST /api/library/nfo/batch-update` - 批量更新NFO文件

## NFO文件的应用

### 1. 本地播放器集成

NFO文件可以被本地播放器（如Kodi、Emby、Plex）识别，自动显示视频的元数据信息。

### 2. 视频库管理

PiliNote的前端视频库组件读取NFO文件，显示视频的详细信息、统计数据等。

### 3. 数据同步

NFO文件作为本地缓存，减少对B站API的依赖，提高响应速度。

### 4. 离线浏览

即使在离线状态下，也可以通过NFO文件查看视频的基本信息。

## 最佳实践

### 1. 文件命名

- 使用文件夹名称作为NFO文件名
- 避免使用特殊字符
- 统一使用UTF-8编码

### 2. 字段完整性

- 确保BVID字段存在（用于后续更新）
- 尽量包含完整的统计数据
- 定期更新统计数据以保持时效性

### 3. 数据验证

- 解析NFO文件时进行类型转换
- 处理缺失字段的情况
- 验证数据的有效性

### 4. 性能优化

- 批量更新时限制数量（如每次最多20个）
- 缓存NFO文件的解析结果
- 避免频繁更新

## 常见问题

### Q1: NFO文件损坏怎么办？

**A**：可以通过API重新生成NFO文件，或者手动编辑修复。

### Q2: 如何批量更新所有NFO文件？

**A**：使用`POST /api/library/nfo/batch-update` API，设置合适的limit参数。

### Q3: NFO文件包含哪些必需字段？

**A**：只有`title`字段是必需的，但建议包含`bvid`字段以便后续更新。

### Q4: 评分是如何计算的？

**A**：评分基于互动率计算，考虑点赞、投币、收藏等因素，详见评分计算公式。

### Q5: 标签是如何生成的？

**A**：标签从统计数据生成，包括弹幕数、评论数、分享数等。

## 相关文档

- [NFO处理器实现](./handlers.md)
- [下载服务实现](./download-service.md)
- [本地视频库API](../api/library-api.md)
- [视频库前端实现](../web/video-library.md)

---

[返回上级](./README.md)
