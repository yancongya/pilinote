# 文件处理器

## 处理器类型

### 1. 视频处理器

**文件**: `handlers/video.py`

处理视频下载。

### 2. 字幕处理器

**文件**: `handlers/subtitle.py`

- SRT 字幕
- ASS 字幕
- 字幕合并

### 3. 弹幕处理器

**文件**: `handlers/danmaku.py`

- XML 弹幕
- ASS 弹幕

### 4. 封面处理器

**文件**: `handlers/thumb.py`

下载视频封面。

### 5. NFO 处理器

**文件**: `handlers/nfo.py`

生成 NFO 元数据文件，包含视频的基本信息、统计数据、评分和标签。

#### SingleNfoHandler

**描述**：处理单个视频的NFO文件生成。

**主要功能**：
- 生成XML格式的NFO文件
- 包含BVID、标题、简介、UP主等基本信息
- 包含播放量、点赞数等统计数据
- 计算并添加评分（基于互动率）
- 生成并添加标签（从统计数据生成）
- 添加视频时长信息

**NFO文件结构**：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<movie>
  <bvid>BV1xx411c7mD</bvid>
  <title>视频标题</title>
  <plot>视频简介</plot>
  <studio>UP主名称</studio>
  <premiered>2024-01-01</premiered>
  <thumb>封面URL</thumb>
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

**核心方法**：

```python
class SingleNfoHandler(BaseHandler):
    async def download(self, task: Task) -> None:
        """生成NFO文件"""
        # 获取元数据
        meta = task.meta
        
        # 构建NFO内容
        lines = []
        lines.append('<?xml version="1.0" encoding="UTF-8"?>')
        lines.append('<movie>')
        
        # BVID字段
        if meta.get('bvid'):
            lines.append(f'  <bvid>{self._escape_xml(meta["bvid"])}</bvid>')
        
        # 基本信息字段
        # ... 添加title, plot, studio, premiered, thumb等
        
        # 统计数据字段
        if meta.get('stat'):
            # ... 添加play, like, coin, favorite, share, danmaku, reply等
        
        # 评分字段（基于互动率计算）
        if meta.get('stat'):
            rating = self._calculate_rating(meta['stat'])
            if rating > 0:
                lines.append(f'  <rating>{rating:.1f}</rating>')
        
        # 标签字段（从统计数据生成）
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
        with open(nfo_path, 'w', encoding='utf-8') as f:
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

**评分计算公式**：
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

#### AlbumNfoHandler

**描述**：处理视频专辑/系列的NFO文件生成。

**主要功能**：
- 生成专辑级别的NFO文件
- 包含专辑的元数据信息
- 管理多视频的引用关系

**详细文档**：详见[NFO文件格式文档](./nfo-format.md)

#### 关键特性

1. **XML转义**：自动转义XML特殊字符，确保文件格式正确
2. **数据验证**：验证数据的有效性，避免生成无效的NFO文件
3. **评分计算**：基于互动率智能计算视频评分
4. **标签生成**：从统计数据自动生成标签
5. **时长格式化**：将秒数转换为`MM:SS`或`HH:MM:SS`格式
6. **UTF-8编码**：支持中文等Unicode字符

## 实现

```python
class BaseHandler:
    async def download(self, task: Task) -> None
    async def post_process(self, task: Task) -> None
```

**关键文件**：
- `apps/api/src/services/queue/handlers/base.py`
- `apps/api/src/services/queue/handlers/*.py`

**相关文档**：
- [NFO文件格式](./nfo-format.md)
- [下载任务处理](./tasks.md)
- [队列调度器](./scheduler.md)

---

[返回上级](./README.md)
