# BiliTools配套文件下载机制分析

## 概述

本文档详细分析了BiliTools项目中如何下载各类配套文件（封面、缩略图、NFO、字幕、弹幕、头像等），为PiliNote实现类似功能提供参考。

## 核心文件位置

- **主要逻辑**: `reference/BiliTools/src/services/queue.ts`
- **媒体处理**: `reference/BiliTools/src/services/media/extras.ts`
- **媒体数据**: `reference/BiliTools/src/services/media/data.ts`

## 配套文件下载Handler函数

### 1. 封面/缩略图下载 (`handleThumbs`)

**位置**: `src/services/queue.ts` 第171行

**实现代码**:
```typescript
async function handleThumbs(task: Types.Task) {
  const { select, nfo } = task;
  const alias: Record<string, string> = { pic: 'cover', cover: 'pic' };
  return nfo?.thumbs
    .filter(
      (v) => select.thumb.includes(v.id) || select.thumb.includes(alias[v.id]),
    )
    .map((v) => ({
      id: (v.id.includes('-')
        ? i18n.global.t(`popup.thumb.${v.id.split('-')[0]}`, {
            num: v.id.split('-')[1],
          })
        : i18n.global.t('popup.thumb.' + v.id)
      ).replace(/[/\\:*?"<>|]/g, '_'),
      url: v.url.replace('http:', 'https:'),
    }));
}
```

**功能说明**:
- 从`nfo.thumbs`数组中获取所有缩略图URL
- 支持多种缩略图类型（cover、poster等）
- 根据用户选择过滤要下载的缩略图
- 将URL中的`http:`替换为`https:`
- 使用文件ID作为文件名，特殊字符替换为下划线
- 支持序号缩略图（如`thumb-1`, `thumb-2`）

**数据来源**: 
- `nfo.thumbs` - 从B站API获取的缩略图数组
- 每个缩略图包含：`id`, `url`

**输出格式**:
```typescript
{
  id: "cover" | "poster" | "thumb-1" | "thumb-2",
  url: "https://..."
}
```

---

### 2. NFO元数据文件生成 (`handleNfo`)

**位置**: `src/services/queue.ts` 第189行

**实现代码**:
```typescript
async function handleNfo(task: Types.Task, subtask: Types.SubTask) {
  const { item, nfo } = task;
  return await extras.getNfo(
    item,
    nfo,
    subtask.type === 'albumNfo' ? 'album' : 'nfo',
  );
}
```

**底层实现** (`extras.getNfo`):
```typescript
export async function getNfo(
  item: Types.MediaItem,
  nfo: Types.MediaNfo,
  type: 'album' | 'nfo',
) {
  const mode =
    type === 'album'
      ? 'album'
      : item.type === 'video'
        ? 'movie'
        : item.type === 'bangumi' || item.type === 'lesson'
          ? 'episodedetails'
          : 'movie';
  const doc = document.implementation.createDocument('', mode, null);
  const root = doc.documentElement;
  const add = (k: string, v?: string | number | null, node: Node = root) => {
    const el = doc.createElement(k);
    el.textContent = String(v);
    node.appendChild(el);
    return el;
  };
  const addAttr = (
    el: Element,
    attrs: Record<string, string | number | boolean>,
  ) => {
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v));
    }
  };
  if (mode === 'album') {
    add('title', nfo.showtitle);
  } else if (mode === 'movie') {
    add('title', item.title);
    add('originaltitle', nfo.showtitle);
  } else {
    add('title', item.title);
  }
  const summary = await getAISummary(item);
  if (summary !== -1) {
    add(
      'plot',
      new TextDecoder().decode(summary) + '\n' + mode === 'album'
        ? (nfo.intro ?? item.desc)
        : item.desc,
    );
  }
  if (mode === 'album') {
    const el = add('thumb', 'poster.jpg');
    addAttr(el, { preview: 'poster.jpg' });
  } else
    nfo.thumbs.forEach((v) => {
      const el = add('thumb', v.url);
      addAttr(el, { preview: v.url });
    });
  add('runtime', Math.round(item.duration / 60));
  add('premiered', timestamp(item.pubtime, 'Asia/Shanghai').split('\u0020')[0]);
  if (nfo.upper?.name) {
    add('director', nfo.upper.name);
  }
  new Set(nfo.tags ?? []).forEach((v) => {
    add('genre', v);
    add('tag', v);
  });
  nfo.credits?.actors?.forEach((v, i) => {
    const node = add('actor', '');
    add('name', v.name, node);
    add('role', v.role, node);
    add('order', i + 1, node);
  });
  nfo.credits?.staff?.forEach((v) => {
    add(v.role ?? 'credits', v.name);
  });
  (['aid', 'sid', 'fid', 'cid', 'bvid', 'epid', 'ssid'] as const).forEach(
    (v) => {
      if (item[v]) add('bili:' + v, item[v]);
    },
  );
  const xml = new XMLSerializer().serializeToString(doc);
  return new TextEncoder().encode(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + xml,
  );
}
```

**功能说明**:
- 支持两种模式：`album`（合集）和`nfo`（单个视频/番剧/课程）
- 自动获取AI摘要（如果有）
- 包含完整的视频元数据：
  - 基本信息：标题、描述、标签、封面、UP主、时长
  - 演职员信息：演员、角色、职员
  - B站自定义数据：aid、cid、bvid、epid等
- 生成符合Kodi/Jellyfin标准的XML格式
- 支持番剧和课程的特殊格式

**数据来源**:
- `item.title` - 视频标题
- `nfo` - 从B站API获取的元数据对象
- `getAISummary()` - AI摘要API

**输出格式**: Uint8Array (XML内容)

---

### 3. 字幕下载 (`handleSubtitle`)

**位置**: `src/services/queue.ts` 第198行

**实现代码**:
```typescript
async function handleSubtitle(task: Types.Task, subtask: Types.SubTask) {
  const { select, item } = task;
  const result = await extras.getSubtitle(item, {
    name: select.misc.subtitles,
  });
  if (result === -1) {
    AppLog(
      i18n.global.t('error.skipTask', [
        task.id,
        i18n.global.t('taskType.' + subtask.type),
      ]),
      'info',
    );
    return new Uint8Array(0);
  } else return result;
}
```

**底层实现** (`extras.getSubtitle`):
```typescript
export async function getSubtitle(
  item: Types.MediaItem,
): Promise<Resps.Subtitle[]>;
export async function getSubtitle(
  item: Types.MediaItem,
  options: { name: false | string },
): Promise<Uint8Array<ArrayBuffer> | -1>;
export async function getSubtitle(
  item: Types.MediaItem,
  options?: { name?: false | string },
) {
  if (!item.aid || !item.cid) throw new AppError('No aid or cid found');
  const playerInfo = await getPlayerInfo(item.aid, item.cid);
  const subtitles = playerInfo.subtitle?.subtitles;
  if (!options?.name) return subtitles;
  const _url = subtitles.find((v) => v.lan === options.name)?.subtitle_url;
  if (!_url) return -1;
  const subtitle = (await tryFetch(
    _url.startsWith('//') ? 'https:' + _url : _url,
    { ignoreErr: true },
  )) as Resps.SubtitleInfo;
  // Only works when input < 24 hour
  const getTime = (s: number) =>
    new Date(s * 1000).toISOString().slice(11, 23).replace('.', ',');
  return new TextEncoder().encode(
    subtitle.body
      .map(
        (l, i) =>
          `${i + 1}\n${getTime(l.from)} --> ${getTime(l.to)}\n${l.content}`,
      )
      .join('\n\n'),
  );
}
```

**功能说明**:
- 通过B站播放器API获取字幕列表
- 支持选择特定语言字幕
- 将B站字幕格式（JSON）转换为标准SRT格式
- SRT格式包含：序号、时间戳、字幕内容
- 支持降级处理（如果没有指定语言则返回字幕列表）
- 只适用于24小时内的视频（B站限制）

**数据来源**:
- B站播放器API: `https://api.bilibili.com/x/player/wbi/v2`
- 参数：`aid`, `cid`
- 返回：字幕列表（语言、URL）

**输出格式**: 
- 不指定语言时：`Subtitle[]` (字幕列表)
- 指定语言时：`Uint8Array` (SRT格式) 或 `-1` (失败)

---

### 4. 弹幕下载 (`handleDanmaku`)

**位置**: `src/services/queue.ts` 第154行

**实现代码**:
```typescript
async function handleDanmaku(task: Types.Task, subtask: Types.SubTask) {
  const { select, item } = task;
  const type = subtask.type === 'liveDanmaku' ? false : select.danmaku.history;
  return await extras.getDanmaku(
    (content, chunk) =>
      handleEvent({
        type: 'progress',
        task: task.id,
        subtask: subtask.id,
        content,
        chunk,
      }),
    item,
    type,
  );
}
```

**底层实现** (`extras.getDanmaku`):
```typescript
export async function getDanmaku(
  cb: (content: number, chunk: number) => void,
  item: Types.MediaItem,
  date?: false | string,
) {
  if (!item.aid || !item.cid) throw new AppError('No aid or cid or oid found');
  const doc = document.implementation.createDocument('', 'i', null);
  const oid = item.cid;
  if (date) {
    const params = { type: 1, oid, date };
    const buffer = await tryFetch(
      'https://api.bilibili.com/x/v2/dm/web/history/seg.so',
      { type: 'binary', params },
    );
    DanmakuEventToXML(new Uint8Array(buffer), doc);
    const xml = new XMLSerializer().serializeToString(doc);
    return new TextEncoder().encode(
      '<?xml version="1:0" encoding="UTF-8"?>\n' + xml,
    );
  }
  const content = Math.ceil((item.duration ?? 0) / 360);
  cb(content + 1, 1);
  for (let i = 1; i <= content; i++) {
    cb(content + 1, i);
    const params = {
      type: 1,
      oid,
      pid: item.aid,
      segment_index: i,
    };
    const buffer = await tryFetch(
      'https://api.bilibili.com/x/v2/dm/wbi/web/seg.so',
      {
        type: 'binary',
        auth: 'wbi',
        params,
      },
    );
    DanmakuEventToXML(new Uint8Array(buffer), doc);
    await new Promise((resolve) =>
      setTimeout(resolve, getRandomInRange(100, 500)),
    );
  }
  const xml = new XMLSerializer().serializeToString(doc);
  return new TextEncoder().encode(
    '<?xml version="1:0" encoding="UTF-8"?>\n' + xml,
  );
}
```

**功能说明**:
- 支持两种弹幕模式：
  - **历史弹幕**: 使用历史弹幕API获取
  - **实时弹幕**: 实时下载最新弹幕
- 分段下载弹幕数据（每6分钟一段，共content段）
- 使用`DanmakuEventToXML`将弹幕事件转换为XML格式
- 实时进度回调（total, current）
- 防止请求过快（100-500ms延迟）
- 生成标准的XML弹幕格式

**数据来源**:
- 历史弹幕API: `https://api.bilibili.com/x/v2/dm/web/history/seg.so`
  - 参数：`type=1`, `oid`(cid), `date`(日期)
- 实时弹幕API: `https://api.bilibili.com/x/v2/dm/wbi/web/seg.so`
  - 参数：`type=1`, `oid`(cid), `pid`(aid), `segment_index`(段号)

**输出格式**: Uint8Array (XML格式)

---

### 5. PCDN链接过滤 (`urlFilter`)

**位置**: `src/services/queue.ts` 第16行

**实现代码**:
```typescript
function urlFilter(urls: string[]) {
  const mirror: URL[] = [];
  const upos: URL[] = [];
  const bcache: URL[] = [];
  const others: URL[] = [];
  for (const v of urls) {
    const url = new URL(v);
    const search = url.searchParams;
    const host = url.hostname.slice();
    const os = (search.get('os') || '').slice();
    if (host.includes('mirror') && os.endsWith('bv')) {
      mirror.push(url);
    } else if (os === 'upos') {
      upos.push(url);
    } else if (host.startsWith('cn') && os === 'bcache') {
      bcache.push(url);
    } else others.push(url);
  }
  if (mirror.length) {
    return (mirror.length < 2 ? [...mirror, ...upos] : mirror).map((v) =>
      v.toString(),
    );
  }
  if (upos.length || bcache.length) {
    const mirrorList = [
      'upos-sz-mirrorali.bilivideo.com',
      'upos-sz-mirrorcos.bilivideo.com',
    ];
    return (upos.length ? upos : bcache).map((v, i) => {
      v.hostname = mirrorList[i] ?? v.hostname;
      return v.toString();
    });
  }
  return others.map((v) => => v.toString());
}
```

**功能说明**:
- 识别CDN类型并分类：
  - **mirror**: 镜像CDN（高质量）
  - **upos**: B站自建CDN（中等质量）
  - **bcache**: 缓存CDN（低质量）
  - **others**: 其他CDN
- 过滤规则（按优先级）：
  1. 如果有mirror CDN，优先使用（或配合upos）
  2. 如果没有mirror，使用upos或bcache
  3. 重构主机名为高质量镜像节点
- 确保下载高质量链接，避免PCDN节点

**过滤策略**:
- **优先级**: mirror > upos > bcache > others
- **质量保证**: 通过镜像节点确保高质量
- **网络优化**: 使用就近的CDN节点

**输入**: 字符串数组（视频/音频链接列表）

**输出**: 过滤后的高质量链接数组

---

### 6. AI摘要生成 (`handleAISummary`)

**位置**: `src/services/queue.ts` 第215行

**实现代码**:
```typescript
async function handleAISummary(task: Types.Task, subtask: Types.SubTask) {
  const { item } = task;
  const result = await extras.getAISummary(item);
  if (result === -1) {
    AppLog(
      i18n.global.t('error.skipTask', [
        task.id,
        i18n.global.t('taskType.' + subtask.type),
      ]),
      'info',
    );
    return new Uint8Array(0);
  } else return result;
}
```

**底层实现** (`extras.getAISummary`):
```typescript
export async function getAISummary(
  item: Types.MediaItem,
): Promise<Uint8Array<ArrayBuffer> | -1>;
export async function getAISummary(
  item: Types.MediaItem,
  options: { check: true },
): Promise<boolean>;
export async function getAISummary(
  item: Types.MediaItem,
  options?: { check?: boolean },
) {
  if (!item.aid || !item.cid) throw 'No aid or cid found';
  const params = { aid: item.aid, cid: item.cid };
  const response = await tryFetch(
    'https://api.bilibili.com/x/web-interface/view/conclusion/get',
    { auth: 'wbi', params },
  );
  const body = response as Resps.AISummaryInfo;
  const result = body.data.model_result;
  if (options?.check) return Boolean(result.result_type);
  if (!result.result_type) return -1;
  let text = `# ${item.title} - ${item.bvid}\n\n${result.summary}\n\n`;
  if (result.result_type === 2) {
    result.outline.forEach((section) => {
      text += `## ${section.title} - [${duration(section.timestamp)}](https://www.bilibili.com/video/${item.bvid}?t=${section.timestamp})\n\n`;
      section.part_outline.forEach((part) => {
        text += `- ${part.content} - [${duration(part.timestamp)}](https://www.bilibili.com/video/${item.bvid}?t=${part.timestamp})\n\n`;
    });
  }
  return new TextEncoder().encode(text);
}
```

**功能说明**:
- 调用B站AI摘要API生成视频摘要
- 支持两种摘要类型：
  - **type=1**: 普通摘要（段落式）
  - **type=2**: 结构化大纲（带时间戳）
- 自动生成Markdown格式文本
- 包含视频标题、BVID、摘要内容
- 支持降级检查（先检查是否有AI摘要）

**数据来源**:
- B站AI摘要API: `https://api.bilibili.com/x/web-interface/view/conclusion/get`
- 参数：`aid`, `cid`

**输出格式**:
- 检查模式：`boolean`（是否有AI摘要）
- 下载模式：`Uint8Array` (Markdown文本) 或 `-1`（失败）

---

### 7. UP主头像下载 (`getUserInfo`)

**位置**: `src/services/media/extras.ts` 第7行

**实现代码**:
```typescript
export async function getUserInfo(id?: number | string) {
  const mid = id ?? useUserStore().mid;
  const info = (
    (await tryFetch('https://api.bilibili.com/x/space/wbi/acc/info', {
      auth: 'wbi',
      params: { mid },
    })) as UserInfo
  ).data;
  return {
    name: info.name,
    mid: info.mid,
    avatar: info.face,
  };
}
```

**功能说明**:
- 通过B站空间API获取用户信息
- 包含：用户名、MID、头像URL
- 支持指定用户ID或使用当前登录用户
- 使用WBI签名确保请求安全
- 可用于下载UP主头像

**数据来源**:
- B站空间API: `https://api.bilibili.com/x/space/wbi/acc/info`
- 参数：`mid`（用户MID）

**输出格式**:
```typescript
{
  name: string,
  mid: number,
  avatar: string,
}
```

---

### 8. 图文内容处理 (`handleOpusContent`, `handleOpusImages`)

**位置**: `src/services/queue.ts` 第230、237行

**实现代码**:
```typescript
async function handleOpusContent(task: Types.Task) {
  const { item } = task;
  const opid = task.item.opid;
  if (!opid) return new Uint8Array(0);
  return await opus.getOpusMarkdown(item.title, opid);
}

async function handleOpusImages(task: Types.Task) {
  const opid = task.item.opid;
  if (!opid) return [];
  return await opus.getOpusImages(opid);
}
```

**功能说明**:
- **handleOpusContent**: 下载B站专栏/图文内容的Markdown文本
- **handleOpusImages**: 下载B站专栏/图文内容的图片
- 支持opus ID识别专栏内容
- 用于图文、专栏等非视频内容的处理

---

## 任务调度机制

### 任务类型定义

BiliTools通过`TaskType`枚举定义了所有配套下载任务类型：

```typescript
enum TaskType {
  Video = 'video',              // 视频下载
  Audio = 'audio',              // 音频下载
  VideoAudio = 'audioVideo',    // 音视频合并
  VideoDash = 'videoDash',      // DASH视频
  VideoFlv = 'videoFlv',        // FLV视频
  Nfo = 'nfo',                 // NFO文件生成
  AlbumNfo = 'albumNfo',       // 合集NFO文件生成
  Thumb = 'thumb',             // 缩略图下载
  Danmaku = 'danmaku',         // 弹幕下载
  LiveDanmaku = 'liveDanmaku', // 直播弹幕
  Subtitle = 'subtitle',       // 字幕下载
  AISummary = 'aiSummary',     // AI摘要生成
  OpusContent = 'opusContent', // 图文Markdown文本
  OpusImages = 'opusImages',   // 图文图片
}
```

### 任务执行流程

1. **准备阶段** (`prepareTask`): 
   - 获取视频信息、播放URL等
   - 根据用户选择创建subtasks

2. **下载阶段** (`handleMedia`):
   - 下载视频和音频
   - 应用PCDN过滤

3. **配套文件阶段**:
   - 按顺序执行每个subtask
   - 调用对应的handler函数
   - 保存配套文件

4. **完成处理**:
   - 文件组织
   - 生成NFO
   - 清理临时文件

## 关键设计特点

### 1. 模块化设计
- 每种资源下载都有独立的handler函数
- 清晰的职责划分
- 易于维护和扩展

### 2. 降级处理
- 每个功能都有降级方案
- 字幕没有指定语言返回列表
- AI摘要不可用时返回空文件
- 确保流程不中断

### 3. 质量优先
- PCDN过滤确保下载高质量链接
- 优先使用mirror CDN
- 避免低质量缓存节点
- 重构主机名为高质量镜像节点

### 4. 用户选择
- 所有配套下载都可以通过设置开关控制
- 支持选择性下载特定资源
- 灵活的配置选项

### 5. 实时进度
- 支持进度回调
- 显示下载/生成进度
- 总进度和当前进度分别显示
- 提供更好的用户体验

### 6. 错误处理
- 每个handler都有完善的错误处理
- 详细的日志记录
- AppLog统一日志系统
- 便于问题排查

### 7. 性能优化
- 分段下载（弹幕每6分钟一段）
- 防止请求过快（100-500ms延迟）
- 并发控制
- 缓存策略

## 数据流图

```
用户选择 → prepareTask → 创建subtasks → 
├─ handleMedia (视频/音频下载)
├─ handleThumbs (缩略图下载)
├─ handleNfo (NFO生成)
├─ handleDanmaku (弹幕下载)
├─ handleSubtitle (字幕下载)
├─ handleAISummary (AI摘要)
├─ handleOpusContent (图文Markdown)
└─ handleOpusImages (图文图片)
```

## API依赖

### B站API列表

| API | 用途 | 认证 |
|-----|------|------|
| `api.bilibili.com/x/player/wbi/v2` | 获取播放器信息 | WBI |
| `api.bilibili.com/x/v2/dm/wbi/web/seg.so` | 获取弹幕数据 | WBI |
| `api.bilibili.com/x/v2/dm/web/history/seg.so` | 获取历史弹幕 | WBI |
| `api.bilibili.com/x/web-interface/view/conclusion/get` | 获取AI摘要 | WBI |
| `api.bilibili.com/x/space/wbi/acc/info` | 获取UP主信息 | WBI |
| `api.bilibili.com/x/space/wbi/acc/info` | 获取UP主信息 | WBI |

## 文件命名规则

### 缩略图
- 普通缩略图：使用`id`作为文件名（如`cover.jpg`, `poster.jpg`）
- 序号缩略图：使用`id`替换序号（如`thumb-1.jpg`, `thumb-2.jpg`）
- 特殊字符：`/\\:*?"<>|` 替换为下划线

### NFO文件
- 使用视频文件名作为文件名
- 扩展名：`.nfo`
- 编码：UTF-8

### 字幕文件
- 使用视频文件名作为文件名
- 扩展名：`.srt`
- 编码：UTF-8

### 弹幕文件
- 使用视频文件名作为文件名
- 扩展名：`.xml`
- 编码：UTF-8

## 实现建议

### 1. 按优先级实现
根据todo列表和功能重要性，建议按以下顺序实现：

1. **图像下载功能**（封面、UP主头像）
2. **字幕下载功能**
3. **弹幕下载功能（XML格式）**
4. **音轨提取功能**
5. **PCDN阻止功能**

### 2. 核心函数参考

参考BiliTools的核心函数，实现类似的handler函数：

```python
# Python实现参考
async def _download_thumbnail(self, download: Download, output_dir: Path):
    """下载封面图"""
    if not download.thumbnail_url:
        return
    
    # 下载封面
    thumbnail_path = output_dir / f"{video_filename}.jpg"
    await self._download_image(download.thumbnail_url, thumbnail_path)

async def _download_avatar(self, download: Download, output_dir: Path):
    """下载UP主头像"""
    if not download.uploader_mid or not download.uploader:
        return
    
    # 获取UP主头像URL
    avatar_url = await self._get_user_avatar(download.uploader_mid)
    if avatar_url:
        avatar_path = output_dir / "avatar.jpg"
        await self._download_image(avatar_url, avatar_path)

async def _download_subtitle(self, download: Download, output_dir: Path):
    """下载字幕"""
    # 获取字幕列表
    subtitles = await self._get_subtitles(download.aid, download.cid)
    
    # 下载选中的字幕
    for subtitle in subtitles:
        subtitle_path = output_dir / f"{video_filename}.{subtitle['lan']}.srt"
        await self._download_subtitle_file(subtitle['url'], subtitle_path)

async def _download_danmaku(self, download: Download, output_dir: Path):
    """下载弹幕"""
    # 分段下载弹幕
    segments = math.ceil(download.duration / 360)
    for i in range(1, segments + 1):
        danmaku_data = await self._get_danmaku_segment(download.aid, download.cid, i)
        # 解析并保存弹幕
```

### 3. PCDN过滤实现

```python
def url_filter(urls: List[str]) -> List[str]:
    """
    过滤PCDN链接，优先使用高质量CDN
    """
    mirror = []
    upos = []
    bcache = []
    others = []
    
    for url in urls:
        parsed = urllib.parse(url)
        host = parsed.hostname
        params = urllib.parse_qs(parsed.query)
        
        os = params.get('os', '')[0] if 'os' in params else ''
        
        if 'mirror' in host and os.endswith('bv'):
            mirror.append(url)
        elif os == 'upos':
            upos.append(url)
        elif host.startswith('cn') and os == 'bcache':
            bcache.append(url)
        else:
            others.append(url)
    
    # 优先使用mirror CDN
    if mirror:
        return mirror[:2] + upos if upos else mirror
    
    # 其次使用upos或bcache
    if upos or bcache:
        sources = upos if upos else bcache
        # 重构主机名为高质量镜像节点
        return [url.replace(parsed.hostname, f"upos-sz-mirror{'ali' if i < len(sources) else 'cos'}.bilivideo.com") 
                for i, url in enumerate(sources)]
    
    return others
```

### 4. 集成到下载流程

在`_process_completed_download`中添加配套文件处理：

```python
# 在视频下载完成后
if video_files:
    video_file = video_files[0]
    output_dir = video_file.parent
    
    # 根据设置下载配套文件
    if download.enable_cover and download.thumbnail_url:
        await self._download_thumbnail(download, output_dir)
    
    if download.enable_avatar and download.uploader_mid:
        await self._download_avatar(download, output_dir)
    
    if download.enable_subtitle:
        await self._download_subtitle(download, output_dir)
    
    if download.enable_danmaku:
        await self._download_danmaku(download, output_dir)
```

## 总结

BiliTools的配套文件下载机制具有以下优点：

1. **完整的功能覆盖**: 涵盖所有常见配套文件类型
2. **优秀的用户体验**: 实时进度、降级处理、错误提示
3. **质量保证**: PCDN过滤确保下载质量
4. **灵活性**: 用户可以自由选择需要下载的配套文件
5. **可维护性**: 模块化设计，易于扩展和维护

PiliNote可以参考这个设计，实现类似的配套文件下载功能。