# HTML解析方法 - 绕过B站API限制

## 背景

B站于2026年3月底加强了API反爬虫机制，导致`/x/web-interface/view`等核心接口频繁返回`412 Precondition Failed`错误。为了解决这个问题，我们开发了HTML解析方法，通过解析B站视频页面的HTML内容来获取完整的视频信息。

## 问题分析

### API限制症状
```
Client error '412 Precondition Failed' for url 
'https://api.bilibili.com/x/web-interface/view?bvid=BV1xx411c7mh'
```

### 常规解决方案失效
1. **添加Referer头**: 效果有限，仍然返回412
2. **完善User-Agent**: 无法绕过限制
3. **添加Cookie**: 仍然被限制
4. **使用不同User-Agent**: 多种UA都失败

### 根本原因
B站API加强了反爬虫机制，可能包括：
- IP地址限制
- 请求频率限制
- 浏览器指纹检测
- 动态验证机制

## HTML解析方案

### 核心原理
B站视频页面在前端渲染时会将完整的视频数据嵌入到HTML中的`__INITIAL_STATE__`变量里，我们可以通过解析这个变量来获取完整的视频信息。

### 技术优势
- ✅ **绕过API限制**: 不直接调用API接口
- ✅ **数据完整性**: 包含所有需要的字段
- ✅ **稳定性高**: 前端页面相对稳定
- ✅ **获取成本低**: 单次HTTP请求即可获取完整数据
- ✅ **兼容性好**: 适用于各种视频类型

## 实现细节

### 数据提取流程

#### 1. 获取视频页面
```python
async def get_video_page(bvid: str) -> str:
    url = f"https://www.bilibili.com/video/{bvid}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": f"https://www.bilibili.com/video/{bvid}",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.text
```

#### 2. 提取INITIAL_STATE数据
```python
def extract_initial_state(html: str) -> Optional[Dict]:
    """从HTML中提取__INITIAL_STATE__数据"""
    patterns = [
        r'__INITIAL_STATE__\s*=\s*({.*?});',                    # 标准格式
        r'window\.__INITIAL_STATE__\s*=\s*({.*?});',             # window对象
        r'<script>__INITIAL_STATE__\s*=\s*({.*?});</script>'      # script标签内
    ]
    
    for pattern in patterns:
        match = re.search(pattern, html, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                continue
    
    return None
```

#### 3. 解析视频数据
```python
def parse_video_data(state_data: Dict) -> Optional[Dict]:
    """从INITIAL_STATE中解析视频数据"""
    if 'videoData' not in state_data:
        return None
    
    video_data = state_data['videoData']
    
    return {
        'bvid': video_data.get('bvid'),
        'aid': video_data.get('aid'),
        'title': video_data.get('title'),
        'desc': video_data.get('desc'),
        'pic': video_data.get('pic'),
        'duration': video_data.get('duration'),
        'pubdate': video_data.get('pubdate'),
        'owner': video_data.get('owner'),
        'stat': video_data.get('stat', {}),
        'pages': video_data.get('pages', []),
        'upData': state_data.get('upData', {}),
        'staffData': state_data.get('staffData', {})
    }
```

#### 4. 提取统计信息
```python
def extract_stats(video_data: Dict) -> Dict[str, int]:
    """提取7项统计信息"""
    stat = video_data.get('stat', {})
    
    return {
        'play': stat.get('view', 0),
        'danmaku': stat.get('danmaku', 0),
        'reply': stat.get('reply', 0),
        'like': stat.get('like', 0),
        'coin': stat.get('coin', 0),
        'favorite': stat.get('favorite', 0),
        'share': stat.get('share', 0)
    }
```

### 完整实现示例

```python
async def get_video_info_via_html(bvid: str) -> Dict[str, Any]:
    """通过HTML解析获取视频信息"""
    try:
        # 1. 获取视频页面
        html = await get_video_page(bvid)
        
        # 2. 提取INITIAL_STATE
        state_data = extract_initial_state(html)
        if not state_data:
            return {
                "success": False,
                "message": "无法从页面中提取视频数据"
            }
        
        # 3. 解析视频数据
        video_data = parse_video_data(state_data)
        if not video_data:
            return {
                "success": False,
                "message": "视频数据格式异常"
            }
        
        # 4. 构建返回结果
        stat = extract_stats(video_data)
        owner = video_data.get('owner', {})
        
        return {
            "success": True,
            "data": {
                "bvid": video_data.get('bvid'),
                "aid": video_data.get('aid'),
                "title": video_data.get('title'),
                "desc": video_data.get('desc'),
                "pic": video_data.get('pic'),
                "duration": video_data.get('duration'),
                "pubdate": video_data.get('pubdate'),
                "cid": video_data.get('pages', [{}])[0].get('cid', 0),
                "owner": {
                    "mid": owner.get('mid', 0),
                    "name": owner.get('name', ''),
                    "face": owner.get('face', '')
                },
                "stat": stat,
                "pages": video_data.get('pages', [])
            }
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"HTML解析失败: {str(e)}"
        }
```

## 数据结构详解

### INITIAL_STATE结构
```javascript
__INITIAL_STATE__ = {
  // 视频数据
  videoData: {
    aid: 725206720,
    bvid: "BV1PS4y1m79X",
    title: "视频标题",
    desc: "视频描述",
    pic: "https://i0.hdslb.com/bfs/archive/...",
    duration: 418,
    pubdate: 1648349780,
    
    // 统计信息（7项薯片数据）
    stat: {
      aid: 725206720,
      view: 165939,      // 播放量
      danmaku: 229,      // 弹幕数
      reply: 338,        // 评论数
      favorite: 6362,    // 收藏数
      coin: 1440,        // 投币数
      share: 1363,       // 转发数
      now_rank: 0,
      his_rank: 0,
      like: 4358,        // 点赞数
      dislike: 0
    },
    
    // 分P信息
    pages: [
      {
        cid: 559932215,
        page: 1,
        part: "分P标题",
        duration: 418
      }
    ],
    
    // UP主信息
    owner: {
      mid: 123456,
      name: "UP主名称",
      face: "https://i2.hdslb.com/bfs/face/..."
    }
  },
  
  // UP主详情
  upData: {
    mid: 123456,
    name: "UP主名称",
    sex: "男",
    face: "https://i2.hdslb.com/bfs/face/...",
    sign: "签名",
    level: 6,
    official: {
      role: 1,
      title: "知名UP主",
      desc: "认证信息"
    }
  },
  
  // 分区信息
  tags: [
    { tag_id: 123, tag_name: "标签1" },
    { tag_id: 456, tag_name: "标签2" }
  ]
}
```

## 集成到现有系统

### 替换API调用
```python
# 原来的API调用方法
async def get_video_info_old(bvid: str):
    response = await client.get(
        "https://api.bilibili.com/x/web-interface/view",
        params={"bvid": bvid},
        headers=headers
    )
    # 可能返回412错误

# 新的HTML解析方法
async def get_video_info_new(bvid: str):
    return await get_video_info_via_html(bvid)
    # 绕过API限制，成功率更高
```

### 在MediaDataProcessor中的应用
```python
class MediaDataProcessor:
    async def _process_video(self, bvid: str, sessdata: Optional[str]) -> Dict[str, Any]:
        """处理视频类型 - 使用HTML解析方法"""
        try:
            # 使用HTML解析方法获取视频信息
            result = await get_video_info_via_html(bvid)
            
            if result['success']:
                video_data = result['data']
                
                # 构建MediaStats
                stat = MediaStats(**video_data['stat'])
                
                # 构建MediaUpper
                owner = video_data['owner']
                upper = MediaUpper(
                    name=owner['name'],
                    mid=owner['mid'],
                    avatar=owner['face']
                )
                
                # 构建MediaNfo
                nfo = MediaNfo(
                    showtitle=video_data['title'],
                    intro=video_data['desc'],
                    url=f"https://www.bilibili.com/video/{bvid}",
                    stat=stat,
                    thumbs=[MediaThumbnail(id="cover", url=video_data['pic'])],
                    premiered=video_data['pubdate'],
                    upper=upper
                )
                
                # 构建MediaItem列表
                items = []
                for i, page in enumerate(video_data['pages']):
                    items.append(MediaItem(
                        title=page['part'],
                        cover=video_data['pic'],
                        desc=video_data['desc'],
                        duration=page['duration'],
                        pubtime=video_data['pubdate'],
                        is_target=(i == 0),
                        type=MediaType.VIDEO,
                        url=f"https://www.bilibili.com/video/{bvid}",
                        aid=video_data['aid'],
                        bvid=bvid,
                        cid=page['cid'],
                        index=i,
                        stat=stat
                    ))
                
                return {
                    "success": True,
                    "data": MediaInfo(
                        type=MediaType.VIDEO,
                        id=bvid,
                        pn=len(items) > 1,
                        nfo=nfo,
                        list=items
                    )
                }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"获取视频信息失败: {str(e)}"
            }
```

## 性能优化

### 缓存策略
```python
from functools import lru_cache
import hashlib

# 缓存视频信息，避免重复请求
@lru_cache(maxsize=100)
def get_video_info_cache_key(bvid: str) -> str:
    """生成缓存键"""
    return hashlib.md5(bvid.encode()).hexdigest()

async def get_video_info_with_cache(bvid: str, ttl: int = 3600) -> Dict[str, Any]:
    """带缓存的视频信息获取"""
    cache_key = get_video_info_cache_key(bvid)
    
    # 检查缓存
    cached_data = redis_client.get(cache_key)
    if cached_data:
        return json.loads(cached_data)
    
    # 获取新数据
    result = await get_video_info_via_html(bvid)
    
    # 存入缓存
    if result['success']:
        redis_client.setex(cache_key, ttl, json.dumps(result))
    
    return result
```

### 并发处理
```python
async def get_multiple_videos_info(bvids: List[str]) -> Dict[str, Dict]:
    """批量获取视频信息"""
    tasks = [get_video_info_via_html(bvid) for bvid in bvids]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    return {
        bvid: result if isinstance(result, dict) else {"success": False, "message": str(result)}
        for bvid, result in zip(bvids, results)
    }
```

## 测试验证

### 功能测试
```python
async def test_html_parsing():
    """测试HTML解析功能"""
    test_cases = [
        "BV1PS4y1m79X",  # 普通视频
        "BV1xx411c7mD",  # 老视频
        "BV1TDQoBTEZX",  # 新视频
    ]
    
    for bvid in test_cases:
        result = await get_video_info_via_html(bvid)
        print(f"BV: {bvid}")
        print(f"  成功: {result['success']}")
        if result['success']:
            video_data = result['data']
            print(f"  标题: {video_data['title']}")
            print(f"  统计: {video_data['stat']}")
        else:
            print(f"  错误: {result['message']}")
```

### 性能测试
```python
async def test_performance():
    """性能测试"""
    import time
    
    start_time = time.time()
    result = await get_video_info_via_html("BV1PS4y1m79X")
    end_time = time.time()
    
    print(f"耗时: {end_time - start_time:.2f}秒")
    print(f"结果: {result['success']}")
```

## 错误处理

### 常见错误
```python
async def robust_get_video_info(bvid: str) -> Dict[str, Any]:
    """健壮的视频信息获取"""
    try:
        # 1. 尝试HTML解析方法
        result = await get_video_info_via_html(bvid)
        if result['success']:
            return result
        
        # 2. HTML解析失败，尝试API方法
        api_result = await get_video_info_via_api(bvid)
        if api_result['success']:
            return api_result
        
        # 3. 两种方法都失败
        return {
            "success": False,
            "message": f"获取视频信息失败: HTML解析({result.get('message')}) 和 API({api_result.get('message')}) 都失败"
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"系统错误: {str(e)}"
        }
```

## 最佳实践

### 1. 请求头设置
```python
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": f"https://www.bilibili.com/video/{bvid}",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive"
}
```

### 2. 超时控制
```python
async def get_video_info_with_timeout(bvid: str, timeout: int = 30) -> Dict[str, Any]:
    """带超时控制的视频信息获取"""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            # ... 实现代码
            pass
    except httpx.TimeoutException:
        return {
            "success": False,
            "message": f"请求超时（{timeout}秒）"
        }
```

### 3. 重试机制
```python
async def get_video_info_with_retry(bvid: str, max_retries: int = 3) -> Dict[str, Any]:
    """带重试的视频信息获取"""
    for attempt in range(max_retries):
        result = await get_video_info_via_html(bvid)
        
        if result['success']:
            return result
        
        if attempt < max_retries - 1:
            await asyncio.sleep(2 ** attempt)  # 指数退避
        else:
            return result
```

## 总结

HTML解析方法成功解决了B站API反爬虫限制的问题，具有以下优势：

1. **绕过限制**: 不直接调用受限的API接口
2. **数据完整**: 获取完整的7项统计信息
3. **稳定性高**: 前端页面相对稳定
4. **易于维护**: 代码简洁，逻辑清晰
5. **兼容性好**: 适用于各种视频类型

通过将HTML解析方法集成到`MediaDataProcessor`中，我们成功恢复了所有视频相关功能，包括视频解析、统计信息获取等。

## 参考资料
- B站前端源码分析
- JavaScript数据提取技术
- HTTP客户端最佳实践
- 反爬虫绕过技术