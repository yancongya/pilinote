# NFO 文件格式文档

## 概述

NFO（Information）文件是PiliNote项目用于存储视频元数据的标准格式，采用XML结构，支持丰富的视频信息和B站统计数据。NFO文件与视频文件存储在同一目录中，便于媒体库软件读取和管理。

## 文件位置

### 命名规范

- **文件名**：使用文件夹名称命名
- **格式**：`{文件夹名}.nfo`
- **示例**：`【Blender教程】.nfo`

### 存储位置

```
/downloads/
├── 【Blender教程】/
│   ├── 01_基础操作.mp4
│   ├── 02_进阶技巧.mp4
│   ├── 【Blender教程】.nfo          ← NFO文件
│   ├── cover.jpg                    ← 封面图片
│   └── avatar.jpg                   ← UP主头像
└── 【其他视频】/
    ├── video.mp4
    ├── 【其他视频】.nfo              ← NFO文件
    └── cover.jpg
```

## 文件结构

### 完整示例

```xml
<?xml version="1.0" encoding="utf-8"?>
<movie>
  <!-- 基本信息 -->
  <title>视频标题</title>
  <originaltitle>原始标题</originaltitle>
  <sorttitle>排序标题</sorttitle>
  <plot>视频简介</plot>
  <outline>简要描述</outline>
  <tagline>标语</tagline>
  
  <!-- 发布信息 -->
  <premiered>2024-01-01</premiered>
  <year>2024</year>
  <studio>UP主名称</studio>
  <director>UP主名称</director>
  <credits>制作团队</credits>
  
  <!-- 时长信息 -->
  <runtime>3600</runtime>  <!-- 秒数 -->
  
  <!-- 媒体信息 -->
  <thumb>https://example.com/cover.jpg</thumb>
  <fanart>https://example.com/fanart.jpg</fanart>
  
  <!-- B站统计数据 -->
  <bilibili_stat>
    <play>100000</play>        <!-- 播放量 -->
    <like>5000</like>          <!-- 点赞数 -->
    <coin>2000</coin>          <!-- 投币数 -->
    <favorite>1000</favorite>  <!-- 收藏数 -->
    <share>500</share>         <!-- 分享数 -->
    <danmaku>3000</danmaku>    <!-- 弹幕数 -->
    <reply>800</reply>         <!-- 评论数 -->
  </bilibili_stat>
  
  <!-- 评分 -->
  <rating>8.5</rating>
  <votes>10000</votes>
  
  <!-- 标签 -->
  <tag>Blender教程</tag>
  <tag>3D建模</tag>
  <tag>节点编程</tag>
  
  <!-- 评论数据 -->
  <comments>
    <comment type="top" like="5000" reply="100" author="置顶用户" time="1672531200">
      <content>这是置顶评论的内容</content>
    </comment>
    
    <comment type="hot" like="3000" reply="50" author="热门用户1" time="1672531300">
      <content>这是第一条热门评论的内容</content>
    </comment>
    
    <comment type="hot" like="2000" reply="30" author="热门用户2" time="1672531400">
      <content>这是第二条热门评论的内容</content>
    </comment>
    
    <comment type="hot" like="1000" reply="20" author="热门用户3" time="1672531500">
      <content>这是第三条热门评论的内容</content>
    </comment>
  </comments>
  
  <!-- 自定义字段 -->
  <custom_fields>
    <field name="bvid">BV1xx411c7mD</field>
    <field name="aid">123456789</field>
    <field name="uploader_mid">987654321</field>
  </custom_fields>
</movie>
```

## 字段说明

### 基本信息字段

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `title` | string | 是 | 视频标题 | "Blender教程：基础操作" |
| `originaltitle` | string | 否 | 原始标题（用于多语言） | "Blender Basics" |
| `sorttitle` | string | 否 | 排序标题 | "Blender_01_Basics" |
| `plot` | string | 否 | 视频简介（详细描述） | "这是一个关于Blender基础操作的详细教程..." |
| `outline` | string | 否 | 简要描述 | "Blender基础教程" |
| `tagline` | string | 否 | 标语 | "从零开始学习Blender" |

### 发布信息字段

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `premiered` | string | 否 | 发布日期（YYYY-MM-DD） | "2024-01-01" |
| `year` | int | 否 | 发布年份 | 2024 |
| `studio` | string | 否 | UP主名称/制作方 | "UP主名称" |
| `director` | string | 否 | 导演/UP主 | "UP主名称" |
| `credits` | string | 否 | 制作团队/感谢名单 | "特别感谢..." |

### 时长信息字段

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `runtime` | int | 否 | 视频时长（秒数） | 3600 |
| `runtime_str` | string | 否 | 时长字符串 | "1:00:00" |

### 媒体信息字段

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `thumb` | string | 否 | 封面图片URL | "https://example.com/cover.jpg" |
| `fanart` | string | 否 | 背景图URL | "https://example.com/fanart.jpg" |
| `poster` | string | 否 | 海报URL | "https://example.com/poster.jpg" |

### B站统计字段

#### bilibili_stat 结构

| 子字段 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `play` | int | 播放量 | 100000 |
| `like` | int | 点赞数 | 5000 |
| `coin` | int | 投币数 | 2000 |
| `favorite` | int | 收藏数 | 1000 |
| `share` | int | 分享数 | 500 |
| `danmaku` | int | 弹幕数 | 3000 |
| `reply` | int | 评论数 | 800 |

### 评分字段

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `rating` | float | 否 | 评分（5分制） | 4.2 |
| `votes` | int | 否 | 评分人数 | 10000 |

### 标签字段

| 字段 | 类型 | 必填 | 说明 | 示例 |
|------|------|------|------|------|
| `tag` | string | 否 | 标签（可多个） | "Blender教程" |
| `genre` | string | 否 | 类型/流派 | "教育" |

### 评论数据字段

#### comments 结构

| 属性 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `type` | string | 评论类型：`top`=置顶，`hot`=热门 | "top" |
| `like` | int | 点赞数 | 5000 |
| `reply` | int | 回复数 | 100 |
| `author` | string | 评论作者 | "置顶用户" |
| `time` | int | 发布时间戳（秒） | 1672531200 |

#### comment 内容

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `content` | string | 评论内容（XML转义后） | "这是评论的内容..." |

#### 评论示例

```xml
<comments>
  <!-- 置顶评论 -->
  <comment type="top" like="5000" reply="100" author="置顶用户" time="1672531200">
    <content>这是置顶评论的内容，可能包含HTML特殊字符需要转义</content>
  </comment>
  
  <!-- 热门评论 -->
  <comment type="hot" like="3000" reply="50" author="热门用户1" time="1672531300">
    <content>这是第一条热门评论的内容</content>
  </comment>
  
  <comment type="hot" like="2000" reply="30" author="热门用户2" time="1672531400">
    <content>这是第二条热门评论的内容</content>
  </comment>
  
  <comment type="hot" like="1000" reply="20" author="热门用户3" time="1672531500">
    <content>这是第三条热门评论的内容</content>
  </comment>
</comments>
```

### 自定义字段

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `custom_fields` | container | 自定义字段容器 | - |
| `field` | element | 自定义字段 | - |

#### field 属性

| 属性 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `name` | string | 字段名称 | "bvid" |

#### field 内容

| 内容 | 类型 | 说明 | 示例 |
|------|------|------|------|
| 文本 | string | 字段值 | "BV1xx411c7mD" |

#### 自定义字段示例

```xml
<custom_fields>
  <field name="bvid">BV1xx411c7mD</field>
  <field name="aid">123456789</field>
  <field name="uploader_mid">987654321</field>
  <field name="uploader_mid_hash">a1b2c3d4</field>
  <field name="cid">456789</field>
  <field name="page">1</field>
  <field name="duration">3600</field>
  <field name="pubdate">1672531200</field>
</custom_fields>
```

## 数据类型

### 字符串类型

- **编码**：UTF-8
- **转义**：XML特殊字符需要转义
  - `&` → `&amp;`
  - `<` → `&lt;`
  - `>` → `&gt;`
  - `"` → `&quot;`
  - `'` → `&apos;`

### 数字类型

- **整数**：直接使用数字字符串
- **浮点数**：使用小数点，如 `8.5`
- **时间戳**：Unix时间戳（秒数）

### 日期类型

- **格式**：YYYY-MM-DD
- **示例**：2024-01-01

### 布尔类型

- **表示**：字符串 `"true"` 或 `"false"`
- **默认值**：`"false"`

## 生成规则

### 基本信息生成

```python
def generate_basic_info(video_data: Dict) -> List[str]:
    """生成基本信息字段"""
    lines = []
    
    # 标题（必填）
    title = video_data.get('title', '')
    if title:
        lines.append(f'  <title>{escape_xml(title)}</title>')
    
    # 简介和描述
    plot = video_data.get('desc', '')
    if plot:
        lines.append(f'  <plot>{escape_xml(plot)}</plot>')
    
    # 发布信息
    pub_date = video_data.get('pub_date', '')
    if pub_date:
        lines.append(f'  <premiered>{pub_date}</premiered>')
        year = pub_date[:4] if len(pub_date) >= 4 else ''
        if year:
            lines.append(f'  <year>{year}</year>')
    
    # UP主信息
    uploader = video_data.get('uploader', '')
    if uploader:
        lines.append(f'  <studio>{escape_xml(uploader)}</studio>')
        lines.append(f'  <director>{escape_xml(uploader)}</director>')
    
    # 时长
    duration = video_data.get('duration', 0)
    if duration:
        lines.append(f'  <runtime>{duration}</runtime>')
    
    return lines
```

### 统计数据生成

```python
def generate_statistics(stat_data: Dict) -> List[str]:
    """生成B站统计数据"""
    if not stat_data:
        return []
    
    lines = ['  <bilibili_stat>']
    
    # 统计字段映射
    stat_fields = {
        'play': 'view',      # 播放量
        'like': 'like',      # 点赞数
        'coin': 'coin',      # 投币数
        'favorite': 'favorite',  # 收藏数
        'share': 'share',    # 分享数
        'danmaku': 'danmaku',    # 弹幕数
        'reply': 'reply'     # 评论数
    }
    
    for nfo_field, api_field in stat_fields.items():
        value = stat_data.get(api_field, 0)
        lines.append(f'    <{nfo_field}>{value}</{nfo_field}>')
    
    lines.append('  </bilibili_stat>')
    return lines
```

### 评论数据生成

```python
def generate_comments(comments: List[Dict]) -> List[str]:
    """生成评论数据"""
    if not comments:
        return []
    
    lines = ['  <comments>']
    
    for comment in comments:
        comment_type = comment.get('type', 'unknown')
        author = escape_xml(comment.get('author', ''))
        content = escape_xml(comment.get('content', ''))
        like = comment.get('like', 0)
        reply = comment.get('reply', 0)
        time = comment.get('time', 0)
        
        lines.append(f'    <comment type="{comment_type}" like="{like}" reply="{reply}" author="{author}" time="{time}">')
        lines.append(f'      <content>{content}</content>')
        lines.append('    </comment>')
    
    lines.append('  </comments>')
    return lines
```

## 解析规则

### 基本信息解析

```python
def parse_basic_info(root: Element) -> Dict:
    """解析基本信息"""
    return {
        'title': root.findtext('title', ''),
        'plot': root.findtext('plot', ''),
        'premiered': root.findtext('premiered', ''),
        'year': root.findtext('year', ''),
        'studio': root.findtext('studio', ''),
        'director': root.findtext('director', ''),
        'runtime': root.findtext('runtime', '')
    }
```

### 统计数据解析

```python
def parse_statistics(root: Element) -> Dict:
    """解析B站统计数据"""
    bilibili_stat = root.find('bilibili_stat')
    if bilibili_stat is None:
        return {}
    
    return {
        'play': int(bilibili_stat.findtext('play', 0)),
        'like': int(bilibili_stat.findtext('like', 0)),
        'coin': int(bilibili_stat.findtext('coin', 0)),
        'favorite': int(bilibili_stat.findtext('favorite', 0)),
        'share': int(bilibili_stat.findtext('share', 0)),
        'danmaku': int(bilibili_stat.findtext('danmaku', 0)),
        'reply': int(bilibili_stat.findtext('reply', 0))
    }
```

### 评论数据解析

```python
def parse_comments(root: Element) -> List[Dict]:
    """解析评论数据"""
    comments_elem = root.find('comments')
    if comments_elem is None:
        return []
    
    comments = []
    for comment_elem in comments_elem.findall('comment'):
        comment = {
            'type': comment_elem.get('type', 'unknown'),
            'author': comment_elem.get('author', ''),
            'like': int(comment_elem.get('like', 0)),
            'reply': int(comment_elem.get('reply', 0)),
            'time': int(comment_elem.get('time', 0)),
            'content': comment_elem.findtext('content', '')
        }
        comments.append(comment)
    
    return comments
```

## 兼容性

### Kodi / MediaPortal

PiliNote的NFO格式基于Kodi的movie.nfo格式，与以下媒体库软件兼容：

- **Kodi**：完全兼容
- **MediaPortal**：基本兼容
- **Emby**：部分兼容（需要插件）
- **Jellyfin**：部分兼容（需要插件）
- **Plex**：需要额外配置

### 扩展字段

以下字段为PiliNote扩展，可能在其他软件中不显示：

- `bilibili_stat`：B站统计数据
- `comments`：评论数据
- `custom_fields`：自定义字段

## 最佳实践

### 1. 数据完整性

- **必填字段**：`title` 应该始终存在
- **数据验证**：数字字段应该包含有效数字
- **格式统一**：日期格式统一为 YYYY-MM-DD

### 2. 性能优化

- **文件大小**：NFO文件应该小于100KB
- **内容长度**：`plot` 字段不超过2000字符
- **评论数量**：评论总数不超过10条

### 3. 国际化

- **编码**：始终使用UTF-8编码
- **转义**：正确处理XML特殊字符
- **字符集**：支持中文、日文、韩文等多语言

### 4. 版本控制

- **备份**：更新NFO文件前创建备份
- **版本号**：使用 `nfo_version` 字段标识格式版本
- **向后兼容**：新版本应该兼容旧格式

## 错误处理

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| XML解析失败 | 格式错误或编码问题 | 检查XML语法和编码 |
| 字段缺失 | 数据源不完整 | 提供默认值 |
| 类型错误 | 字段类型不匹配 | 进行类型转换 |
| 编码问题 | 非UTF-8编码 | 转换为UTF-8 |

### 错误恢复

```python
def safe_parse_nfo(nfo_path: str) -> Dict:
    """安全解析NFO文件，包含错误处理"""
    try:
        tree = ET.parse(nfo_path)
        root = tree.getroot()
        
        # 验证根节点
        if root.tag != 'movie':
            raise ValueError(f"Invalid root element: {root.tag}")
        
        # 解析数据
        data = {
            'title': root.findtext('title', ''),
            'plot': root.findtext('plot', ''),
            # ... 其他字段
        }
        
        return data
        
    except ET.ParseError as e:
        logger.error(f"XML解析错误: {e}")
        return {}
    except Exception as e:
        logger.error(f"NFO解析错误: {e}")
        return {}
```

## 更新日志

### v1.1 (2026-04-15)

- 新增评论数据结构
- 新增 `bilibili_stat` 统计字段
- 新增 `custom_fields` 自定义字段支持
- 改进XML转义处理
- 增强错误处理机制

### v1.0 (2024-01-01)

- 初始版本
- 基本Kodi NFO格式支持
- B站元数据字段

## 相关文档

- [评论数据提取](../download/comment-extraction.md)
- [本地视频库API](../api/library-api.md)
- [下载服务](../download/download-service.md)
- [API端点](../api/endpoints.md)

---

**文档版本**: 1.1
**最后更新**: 2026-04-15
**维护者**: PiliNote Team
