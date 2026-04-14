# 评论数据提取功能文档

## 概述

PiliNote 支持从B站提取视频评论数据并保存到NFO文件中，让用户可以离线查看视频的置顶评论和热门评论。这个功能扩展了NFO元数据系统，为视频文件提供更丰富的社交媒体信息。

## 功能特性

### 核心功能

- **置顶评论提取**：自动获取B站官方置顶的评论
- **热门评论提取**：提取点赞数最高的3条热门评论
- **NFO文件存储**：将评论数据保存到NFO文件中，支持离线查看
- **批量更新**：支持批量更新多个视频的评论数据
- **API集成**：通过B站评论API获取实时数据

### 数据结构

#### 评论类型

| 类型 | 说明 | 来源 |
|------|------|------|
| `top` | 置顶评论 | B站官方置顶 |
| `hot` | 热门评论 | 按点赞数排序的前3条 |

#### 评论字段

```python
{
    "type": "top",        # 评论类型
    "author": "用户名",    # 评论作者
    "content": "评论内容", # 评论正文
    "like": 1000,          # 点赞数
    "reply": 50,           # 回复数
    "time": 1672531200     # 发布时间戳
}
```

## 技术实现

### 1. B站评论API集成

#### API端点

```
GET https://api.bilibili.com/x/v2/reply/main
```

#### 请求参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `type` | 1 | 视频评论类型 |
| `oid` | 视频AID | 视频的AVID |
| `mode` | 3 | 3=热门排序，2=时间排序 |
| `pagination_str` | `{"offset":""}` | 分页参数 |

#### 响应处理

```python
async def get_video_comments(self, aid: int, sessdata: str = "") -> Dict:
    """获取视频评论数据"""
    try:
        url = f"{self.api_base}/x/v2/reply/main"
        params = {
            "type": 1,
            "oid": aid,
            "mode": 3,
            "pagination_str": "{\"offset\":\"\"}"
        }
        
        headers = await self.headers_manager.get_headers()
        if sessdata:
            headers["Cookie"] = f"SESSDATA={sessdata}"
        
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers, params=params)
            
            # 处理Brotli压缩
            content = response.content
            if response.headers.get('content-encoding') == 'br':
                import brotli
                content = brotli.decompress(content)
            
            content_text = content.decode('utf-8', errors='ignore')
            data = json.loads(content_text)
            
            if data.get("code") == 0:
                replies_data = data.get("data", {})
                replies = replies_data.get("replies", [])
                
                # 提取置顶评论
                top_comment = None
                if replies and replies[0].get("is_top", False):
                    top_comment = replies[0]
                
                # 提取热门评论（排除置顶）
                hot_comments = [
                    r for r in replies 
                    if not r.get("is_top", False)
                ]
                hot_comments = sorted(hot_comments, key=lambda x: x.get("like", 0), reverse=True)[:3]
                
                # 格式化评论数据
                comments = []
                
                if top_comment:
                    comments.append({
                        "type": "top",
                        "author": top_comment.get("member", {}).get("name", "Unknown"),
                        "content": top_comment.get("content", {}).get("message", ""),
                        "like": top_comment.get("like", 0),
                        "reply": top_comment.get("rcount", 0),
                        "time": top_comment.get("ctime", 0)
                    })
                
                for comment in hot_comments:
                    comments.append({
                        "type": "hot",
                        "author": comment.get("member", {}).get("name", "Unknown"),
                        "content": comment.get("content", {}).get("message", ""),
                        "like": comment.get("like", 0),
                        "reply": comment.get("rcount", 0),
                        "time": comment.get("ctime", 0)
                    })
                
                return {
                    "success": True,
                    "data": {
                        "total": replies_data.get("page", {}).get("count", 0),
                        "top_comment": comments[0] if comments and comments[0]["type"] == "top" else None,
                        "hot_comments": [c for c in comments if c["type"] == "hot"],
                        "comments": comments
                    }
                }
            else:
                return {
                    "success": False,
                    "message": f"API返回错误: {data.get('message', '未知错误')}"
                }
                
    except Exception as e:
        return {
            "success": False,
            "message": f"获取评论异常: {str(e)}"
        }
```

### 2. NFO文件存储

#### XML结构

```xml
<?xml version="1.0" encoding="utf-8"?>
<movie>
  <title>视频标题</title>
  <plot>视频简介</plot>
  <premiered>2024-01-01</premiered>
  <studio>UP主名称</studio>
  
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
</movie>
```

#### 生成逻辑

**文件**：`apps/api/src/services/queue/handlers/nfo.py`

```python
def _generate_nfo_content(self, meta: Dict, video_data: Dict) -> str:
    """生成NFO文件内容"""
    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '<movie>'
    ]
    
    # 基本信息
    title = meta.get('title', '')
    if title:
        lines.append(f'  <title>{self._escape_xml(title)}</title>')
    
    # 简介和元数据
    # ... 其他字段处理 ...
    
    # 评论数据
    if meta.get('comments') and len(meta['comments']) > 0:
        lines.append('  <comments>')
        for comment in meta['comments']:
            lines.append(f'    <comment type="{comment.get("type", "unknown")}" like="{comment.get("like", 0)}" reply="{comment.get("reply", 0)}" author="{comment.get("author", "")}" time="{comment.get("time", 0)}">')
            lines.append(f'      <content>{self._escape_xml(comment.get("content", ""))}</content>')
            lines.append('    </comment>')
        lines.append('  </comments>')
    
    lines.append('</movie>')
    return '\n'.join(lines)

def _escape_xml(self, text: str) -> str:
    """转义XML特殊字符"""
    if not text:
        return ""
    return (text
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
        .replace('"', '&quot;')
        .replace("'", '&apos;'))
```

### 3. NFO文件解析

**文件**：`apps/api/src/services/local_library_service.py`

```python
def _parse_nfo_file(self, nfo_path: str) -> Dict:
    """解析NFO文件"""
    try:
        tree = ET.parse(nfo_path)
        root = tree.getroot()
        
        nfo_data = {
            "title": root.findtext("title", ""),
            "plot": root.findtext("plot", ""),
            "premiered": root.findtext("premiered", ""),
            "studio": root.findtext("studio", ""),
            # ... 其他字段 ...
        }
        
        # 解析评论数据
        comments_elem = root.find('comments')
        if comments_elem is not None:
            comments = []
            for comment_elem in comments_elem.findall('comment'):
                comment = {
                    "type": comment_elem.get('type', 'unknown'),
                    "author": comment_elem.get('author', ''),
                    "like": int(comment_elem.get('like', 0)),
                    "reply": int(comment_elem.get('reply', 0)),
                    "time": int(comment_elem.get('time', 0)),
                    "content": comment_elem.findtext('content', '')
                }
                comments.append(comment)
            
            nfo_data["comments"] = comments
        
        return nfo_data
        
    except Exception as e:
        logger.error(f"解析NFO文件失败: {e}")
        return {}
```

### 4. NFO更新服务集成

**文件**：`apps/api/src/services/nfo_update_service.py`

```python
async def _build_meta_from_video_info(self, bvid: str, video_info: Dict) -> Dict:
    """从视频信息构建元数据，包含评论数据"""
    meta = {
        "title": video_info.get("title", ""),
        "plot": video_info.get("desc", ""),
        "premiered": video_info.get("pub_date", ""),
        "studio": video_info.get("uploader", ""),
        "aid": video_info.get("aid", 0)
    }
    
    # 处理统计数据
    stat = video_info.get("stat", {})
    if stat:
        meta["statistics"] = {
            "play": stat.get("view", 0),
            "like": stat.get("like", 0),
            "coin": stat.get("coin", 0),
            "favorite": stat.get("favorite", 0),
            "share": stat.get("share", 0),
            "danmaku": stat.get("danmaku", 0),
            "reply": stat.get("reply", 0)
        }
        
        # 计算评分
        meta["rating"] = self._calculate_rating(meta["statistics"])
    
    # 获取评论数据
    if video_info.get("aid"):
        comments_result = await self.bilibili_service.get_video_comments(
            video_info["aid"], 
            ""
        )
        
        if comments_result.get("success"):
            meta["comments"] = comments_result["data"]["comments"]
    
    return meta
```

## 前端集成

### 组件实现

**文件**：`apps/web/src/components/NewDownload/VideoLibrary.tsx`

```typescript
interface Comment {
  type: 'top' | 'hot';
  author: string;
  content: string;
  like: number;
  reply: number;
  time: number;
}

interface FolderMetadata {
  title: string;
  plot: string;
  studio: string;
  premiered: string;
  comments?: Comment[];
  // ... 其他字段
}

// 评论显示组件
const CommentSection: React.FC<{ comments: Comment[] }> = ({ comments }) => {
  if (!comments || comments.length === 0) return null;
  
  return (
    <div className="comments-section">
      <h4 className="comments-title">热门评论</h4>
      {comments.map((comment, index) => (
        <div key={index} className={`comment-item comment-${comment.type}`}>
          <div className="comment-header">
            <span className="comment-author">{comment.author}</span>
            {comment.type === 'top' && (
              <span className="comment-badge badge-top">置顶</span>
            )}
          </div>
          <p className="comment-content">{comment.content}</p>
          <div className="comment-stats">
            <span className="stat-item">
              <span className="stat-icon">👍</span>
              {comment.like}
            </span>
            <span className="stat-item">
              <span className="stat-icon">💬</span>
              {comment.reply}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### 样式设计

```css
.comments-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.comments-title {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;
  font-weight: 500;
}

.comment-item {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 6px;
  border-left: 2px solid transparent;
}

.comment-top {
  border-left-color: #FB7299;
  background: rgba(251, 114, 153, 0.1);
}

.comment-hot {
  border-left-color: #FF9800;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.comment-author {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 500;
}

.comment-badge {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 500;
}

.badge-top {
  background: #FB7299;
  color: white;
}

.comment-content {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.4;
  margin-bottom: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.comment-stats {
  display: flex;
  gap: 12px;
}

.stat-item {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
  display: flex;
  align-items: center;
  gap: 3px;
}

.stat-icon {
  font-size: 10px;
}
```

## 测试

### 单元测试

**文件**：`apps/api/test_comments_api.py`

```python
import asyncio
import sys
import os

# 添加src到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.services.bilibili import BilibiliService

async def test_comments_api():
    """测试评论API和NFO更新"""
    
    # 创建BilibiliService实例
    bilibili_service = BilibiliService()
    
    # 测试视频BV号
    test_bvid = "BV1EyygBuEpn"
    
    print(f"开始测试评论API和NFO更新，视频BV号: {test_bvid}")
    
    try:
        # 步骤1: 获取视频信息
        print("步骤1: 获取视频信息...")
        video_result = await bilibili_service.get_video_info(test_bvid, "")
        
        if not video_result.get("success"):
            print(f"❌ 获取视频信息失败")
            return
        
        video_data = video_result.get("data", {})
        print(f"✅ 视频信息获取成功！")
        print(f"   标题: {video_data.get('title', '')}")
        print(f"   AID: {video_data.get('aid', '无')}")
        
        # 步骤2: 获取评论数据
        print("\n步骤2: 获取评论数据...")
        if video_data.get("aid"):
            comments_result = await bilibili_service.get_video_comments(
                video_data["aid"], 
                ""
            )
            
            if comments_result.get("success"):
                comments_data = comments_result.get("data", {})
                comments = comments_data.get("comments", [])
                
                print(f"✅ 评论API调用成功！")
                print(f"   总评论数: {comments_data.get('total', 0)}")
                print(f"   置顶评论: {'有' if comments_data.get('top_comment') else '无'}")
                print(f"   热门评论数: {len(comments_data.get('hot_comments', []))}")
                
                # 显示评论详情
                print(f"\n📝 评论详情:")
                for i, comment in enumerate(comments[:5]):
                    comment_type = comment.get('type', 'unknown')
                    author = comment.get('author', 'Unknown')
                    content = comment.get('content', '')
                    like_count = comment.get('like', 0)
                    reply_count = comment.get('reply', 0)
                    
                    print(f"\n   {i+1}. [{comment_type}] {author}")
                    print(f"      点赞: {like_count} | 回复: {reply_count}")
                    print(f"      内容: {content[:80]}...")
            else:
                print(f"❌ 评论API调用失败")
        
        # 步骤3: 测试NFO更新
        print("\n步骤3: 测试NFO更新...")
        from src.services.nfo_update_service import NFOUpdateService
        
        nfo_update_service = NFOUpdateService()
        
        # 查找对应的NFO文件
        nfo_path = f"/Users/tanyancong/工作/开发/pilinote/downloads/Blender教程：用几何节点制作极致逼真的程序化毛发/Blender教程：用几何节点制作极致逼真的程序化毛发.nfo"
        
        if os.path.exists(nfo_path):
            print(f"   找到NFO文件: {nfo_path}")
            
            update_result = await nfo_update_service.update_single_nfo(nfo_path)
            
            if update_result.get("success"):
                print(f"✅ NFO更新成功！")
                print(f"   备份文件: {update_result.get('backup_path', '无')}")
                
                # 读取更新后的NFO文件，检查评论数据
                print(f"\n步骤4: 检查更新后的NFO文件...")
                from xml.etree import ElementTree as ET
                
                tree = ET.parse(nfo_path)
                root = tree.getroot()
                
                comments_elem = root.find('comments')
                if comments_elem is not None:
                    comment_count = len(comments_elem.findall('comment'))
                    print(f"✅ 评论数据已保存到NFO文件！")
                    print(f"   评论数量: {comment_count}")
                    
                    # 显示评论内容
                    for i, comment_elem in enumerate(comments_elem.findall('comment')[:3]):
                        author = comment_elem.get('author', 'Unknown')
                        content_elem = comment_elem.find('content')
                        content = content_elem.text if content_elem is not None else ''
                        
                        print(f"\n   {i+1}. {author}")
                        print(f"      内容: {content[:60]}...")
                else:
                    print(f"❌ NFO文件中没有评论数据")
            else:
                print(f"❌ NFO更新失败")
        else:
            print(f"❌ NFO文件不存在: {nfo_path}")
    
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        bilibili_service.close()

if __name__ == "__main__":
    asyncio.run(test_comments_api())
```

### 运行测试

```bash
cd /Users/tanyancong/工作/开发/pilinote/apps/api
python3 test_comments_api.py
```

### 预期输出

```
开始测试评论API和NFO更新，视频BV号: BV1EyygBuEpn
步骤1: 获取视频信息...
✅ 视频信息获取成功！
   标题: Blender教程：用几何节点制作极致逼真的程序化毛发
   AID: 115569248503531

步骤2: 获取评论数据...
✅ 评论API调用成功！
   总评论数: 123
   置顶评论: 有
   热门评论数: 3

📝 评论详情:

   1. [top] 置顶用户
      点赞: 5000 | 回复: 100
      内容: 这是非常好的教程，感谢分享...

   2. [hot] 热门用户1
      点赞: 3000 | 回复: 50
      内容: 节点逻辑很清晰，学到了很多...

步骤3: 测试NFO更新...
   找到NFO文件: /Users/tanyancong/工作/开发/pilinote/downloads/Blender教程：用几何节点制作极致逼真的程序化毛发/Blender教程：用几何节点制作极致逼真的程序化毛发.nfo
✅ NFO更新成功！
   备份文件: /Users/tanyancong/工作/开发/pilinote/downloads/Blender教程：用几何节点制作极致逼真的程序化毛发/Blender教程：用几何节点制作极致逼真的程序化毛发.nfo.bak

步骤4: 检查更新后的NFO文件...
✅ 评论数据已保存到NFO文件！
   评论数量: 4

   1. 置顶用户
      内容: 这是非常好的教程，感谢分享...

   2. 热门用户1
      内容: 节点逻辑很清晰，学到了很多...
```

## 性能优化

### 1. 缓存策略

```python
class CommentCache:
    def __init__(self, ttl: int = 3600):
        self.cache: Dict[str, Dict] = {}
        self.ttl: int = ttl
    
    async def get(self, aid: int) -> Optional[Dict]:
        key = str(aid)
        if key in self.cache:
            if time.time() - self.cache[key]["timestamp"] < self.ttl:
                return self.cache[key]["data"]
        return None
    
    async def set(self, aid: int, data: Dict):
        key = str(aid)
        self.cache[key] = {
            "data": data,
            "timestamp": time.time()
        }
```

### 2. 批量处理

```python
async def batch_get_comments(self, aids: List[int]) -> Dict[int, Dict]:
    """批量获取多个视频的评论"""
    tasks = [
        self.get_video_comments(aid, "") 
        for aid in aids
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    return {
        aids[i]: results[i] 
        for i in range(len(aids))
    }
```

### 3. 增量更新

```python
async def update_comments_if_needed(self, aid: int, last_update: int) -> bool:
    """检查是否需要更新评论数据"""
    # 如果上次更新时间超过24小时，则重新获取
    if time.time() - last_update > 86400:
        return True
    return False
```

## 错误处理

### 1. API限流处理

```python
async def get_video_comments_with_retry(self, aid: int, max_retries: int = 3) -> Dict:
    """带重试机制的评论获取"""
    for attempt in range(max_retries):
        result = await self.get_video_comments(aid, "")
        
        if result.get("success"):
            return result
        
        # 检查是否为限流错误
        if "429" in str(result.get("message", "")):
            wait_time = 2 ** attempt  # 指数退避
            await asyncio.sleep(wait_time)
            continue
        
        return result
    
    return {"success": False, "message": "达到最大重试次数"}
```

### 2. 数据验证

```python
def validate_comment_data(self, comment: Dict) -> bool:
    """验证评论数据完整性"""
    required_fields = ['type', 'author', 'content', 'like', 'reply', 'time']
    
    for field in required_fields:
        if field not in comment:
            return False
    
    # 验证数据类型
    if not isinstance(comment['like'], int):
        return False
    if not isinstance(comment['reply'], int):
        return False
    if not isinstance(comment['time'], int):
        return False
    
    return True
```

## 安全考虑

### 1. 数据脱敏

```python
def sanitize_comment_content(self, content: str) -> str:
    """清理评论内容中的敏感信息"""
    # 移除HTML标签
    content = re.sub(r'<[^>]+>', '', content)
    
    # 移除URL
    content = re.sub(r'https?://\S+', '', content)
    
    # 移除手机号
    content = re.sub(r'\d{11}', '[手机号已隐藏]', content)
    
    return content.strip()
```

### 2. 内容过滤

```python
def filter_inappropriate_content(self, content: str) -> bool:
    """过滤不当内容"""
    # 敏感词列表
    sensitive_words = ['广告', '诈骗', '违法']
    
    for word in sensitive_words:
        if word in content:
            return False
    
    return True
```

## 使用示例

### 基本使用

```python
from src.services.bilibili import BilibiliService

async def main():
    bilibili = BilibiliService()
    
    # 获取视频信息
    video_info = await bilibili.get_video_info("BV1EyygBuEpn", "")
    
    if video_info.get("success"):
        aid = video_info["data"]["aid"]
        
        # 获取评论
        comments = await bilibili.get_video_comments(aid, "")
        
        if comments.get("success"):
            comment_data = comments["data"]["comments"]
            print(f"找到 {len(comment_data)} 条评论")
    
    bilibili.close()

asyncio.run(main())
```

### NFO文件操作

```python
from src.services.nfo_update_service import NFOUpdateService

async def main():
    nfo_service = NFOUpdateService()
    
    # 更新单个NFO文件
    result = await nfo_service.update_single_nfo("/path/to/video.nfo")
    
    if result.get("success"):
        print("NFO更新成功")
        print(f"评论数量: {len(result.get('changes', {}).get('comments', []))}")

asyncio.run(main())
```

## 相关文档

- [API端点文档](../api/endpoints.md)
- [本地视频库API](../api/library-api.md)
- [NFO文件格式](../metadata/nfo-format.md)
- [后端架构](../architecture/backend-architecture.md)
- [下载服务](./download-service.md)

---

**文档版本**: 1.0.0
**最后更新**: 2026-04-15
**维护者**: PiliNote Team