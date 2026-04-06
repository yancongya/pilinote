# PiliNote 自动下载功能升级指南（前后端一体化）

本文档提供按功能模块分阶段的升级步骤，每个阶段都包含后端和前端的完整实现。

## 📋 升级总览

整个升级分为 6 个小目标阶段，每个阶段都包含前后端实现和集成测试：

```
阶段 1: 基础数据存储（后端）         ← 第 1 周
  ↓
阶段 2: 扫描功能实现（后端 + 前端）  ← 第 1-2 周
  ↓
阶段 3: 自动下载功能（后端 + 前端）  ← 第 2-3 周
  ↓
阶段 4: 配置管理实现（后端 + 前端）  ← 第 3-4 周
  ↓
阶段 5: 定时任务集成（后端）         ← 第 4 周
  ↓
阶段 6: 高级功能实现（后端 + 前端）  ← 第 4-5 周
```

---

## 🚀 阶段 1: 基础数据存储（后端）

### 目标
创建数据库模型，为后续功能提供数据存储支持。

### 步骤 1.1: 创建数据库模型

**文件**: `apps/api/src/models/video_source_scan.py`

**操作**:
```python
from sqlalchemy import Column, String, Integer, DateTime, Text, UniqueConstraint
from sqlalchemy.sql import func
from .base import Base

class VideoSourceScan(Base):
    """视频源扫描记录"""
    __tablename__ = "video_source_scans"
    
    id = Column(String(50), primary_key=True)
    source_type = Column(String(20), nullable=False, index=True)
    source_id = Column(String(50), nullable=False, index=True)
    last_scan_time = Column(DateTime, nullable=False, default=func.now())
    last_video_time = Column(DateTime, nullable=True)
    total_videos = Column(Integer, default=0)
    new_videos = Column(Integer, default=0)
    added_to_queue = Column(Integer, default=0)
    status = Column(String(20), default="success")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('source_type', 'source_id', name='uq_source'),
    )
```

**验证**:
```bash
cd apps/api
python -c "from src.models.video_source_scan import VideoSourceScan; from src.database import engine; from src.models.base import Base; Base.metadata.create_all(bind=engine)"

sqlite3 data/pilinote.db ".schema video_source_scans"
```

**预期结果**:
- 表 `video_source_scans` 创建成功
- 包含所有必需的字段和索引

**完成标准**:
- ✅ 数据库表创建成功
- ✅ 可以插入和查询测试数据

---

## 🔍 阶段 2: 扫描功能实现（后端 + 前端）

### 目标
实现视频源扫描功能，并在前端显示扫描记录。

### 步骤 2.1: 后端 - 实现扫描服务

**文件**: `apps/api/src/services/video_source_scanner.py`

**操作**:
```python
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from ..models.video_source_scan import VideoSourceScan
from ..services.bilibili_service import BilibiliService

class VideoSourceScanner:
    """视频源扫描服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def scan_favorite(
        self,
        media_id: str,
        user_id: str,
        sessdata: str
    ) -> dict:
        """扫描收藏夹"""
        # 获取上次扫描时间
        scan_record = self._get_scan_record('favorite', media_id)
        last_scan_time = scan_record.last_scan_time if scan_record else None
        
        # 获取收藏夹视频列表
        service = BilibiliService()
        result = await service.get_favorite_videos(
            sessdata=sessdata,
            media_id=media_id,
            page=1,
            page_size=50
        )
        
        if not result["success"]:
            return {"success": False, "error": "获取收藏夹失败"}
        
        # 筛选新视频
        videos = result["data"]["list"]
        new_videos = []
        
        for video in videos:
            video_time = self._parse_video_time(video)
            if last_scan_time is None or video_time > last_scan_time:
                new_videos.append(video)
        
        # 更新扫描记录
        if scan_record:
            scan_record.last_scan_time = datetime.utcnow()
            scan_record.last_video_time = self._get_latest_video_time(videos)
            scan_record.total_videos = len(videos)
            scan_record.new_videos = len(new_videos)
        else:
            from uuid import uuid4
            scan_record = VideoSourceScan(
                id=str(uuid4()),
                source_type='favorite',
                source_id=media_id,
                last_scan_time=datetime.utcnow(),
                last_video_time=self._get_latest_video_time(videos),
                total_videos=len(videos),
                new_videos=len(new_videos)
            )
            self.db.add(scan_record)
        
        self.db.commit()
        
        return {
            "success": True,
            "total": len(videos),
            "new": len(new_videos),
            "videos": new_videos
        }
    
    def _get_scan_record(self, source_type: str, source_id: str) -> Optional[VideoSourceScan]:
        """获取扫描记录"""
        return self.db.query(VideoSourceScan).filter(
            VideoSourceScan.source_type == source_type,
            VideoSourceScan.source_id == source_id
        ).first()
    
    def _parse_video_time(self, video: dict) -> Optional[datetime]:
        """解析视频时间"""
        fav_time = video.get('fav_time')
        if fav_time:
            return datetime.fromtimestamp(fav_time)
        return None
    
    def _get_latest_video_time(self, videos: List[dict]) -> Optional[datetime]:
        """获取最新视频时间"""
        if not videos:
            return None
        times = [self._parse_video_time(v) for v in videos if self._parse_video_time(v)]
        return max(times) if times else None
```

**验证**:
```python
# 测试扫描服务
import asyncio
from sqlalchemy.orm import Session
from src.database import SessionLocal
from src.services.video_source_scanner import VideoSourceScanner

async def test_scanner():
    db = SessionLocal()
    scanner = VideoSourceScanner(db)
    
    # 测试扫描（替换为实际的 media_id 和 sessdata）
    result = await scanner.scan_favorite(
        media_id="12345678",
        user_id="user_id",
        sessdata="your_sessdata"
    )
    
    print(f"扫描结果: {result}")
    db.close()

asyncio.run(test_scanner())
```

**预期结果**:
- 扫描成功返回视频列表
- 数据库中创建扫描记录

---

### 步骤 2.2: 后端 - 添加扫描记录 API

**文件**: `apps/api/src/routers/auto_download.py`

**操作**:
```python
from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.video_source_scan import VideoSourceScan

router = APIRouter(prefix="/api/auto-download", tags=["Auto Download"])

@router.get("/scan-records")
async def get_scan_records(
    source_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """获取扫描记录"""
    query = db.query(VideoSourceScan)
    
    if source_type:
        query = query.filter(VideoSourceScan.source_type == source_type)
    
    records = query.order_by(VideoSourceScan.last_scan_time.desc()).limit(50).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "source_type": r.source_type,
                "source_id": r.source_id,
                "last_scan_time": r.last_scan_time.isoformat(),
                "total_videos": r.total_videos,
                "new_videos": r.new_videos,
                "added_to_queue": r.added_to_queue,
                "status": r.status
            }
            for r in records
        ]
    }

@router.post("/scan/trigger")
async def trigger_scan(
    source_type: str = Query(...),
    source_id: str = Query("all"),
    db: Session = Depends(get_db)
):
    """手动触发扫描"""
    from ..services.video_source_scanner import VideoSourceScanner
    from ..dependencies.auth import get_current_user
    
    scanner = VideoSourceScanner(db)
    
    try:
        if source_type == 'favorite':
            user, sessdata = get_current_user()
            result = await scanner.scan_favorite(
                media_id=source_id,
                user_id=user.mid,
                sessdata=sessdata
            )
        else:
            return {"success": False, "error": "不支持的视频源类型"}
        
        return {
            "success": True,
            "data": {
                "total": result.get("total", 0),
                "new": result.get("new", 0),
                "added": 0  # 阶段 2 暂不实现自动下载
            }
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}
```

**验证**:
```bash
# 测试获取扫描记录
curl http://localhost:8000/api/auto-download/scan-records

# 测试手动触发扫描
curl -X POST "http://localhost:8000/api/auto-download/scan/trigger?source_type=favorite&source_id=12345678"
```

**预期结果**:
- API 正常返回扫描记录
- 手动触发扫描成功

---

### 步骤 2.3: 前端 - 添加 API 接口

**文件**: `apps/web/src/services/api.ts`

**操作**:
```typescript
// 添加自动下载相关的 API 接口
export const autoDownloadAPI = {
  // 获取扫描记录
  getScanRecords: async (sourceType?: string) => {
    const url = sourceType 
      ? `/api/auto-download/scan-records?source_type=${sourceType}`
      : '/api/auto-download/scan-records';
    const response = await fetch(url);
    return response.json();
  },

  // 手动触发扫描
  triggerScan: async (sourceType: string, sourceId: string = 'all') => {
    const url = `/api/auto-download/scan/trigger?source_type=${sourceType}&source_id=${sourceId}`;
    const response = await fetch(url, { method: 'POST' });
    return response.json();
  }
};

// 扫描记录类型定义
export interface ScanRecord {
  id: string;
  source_type: string;
  source_id: string;
  last_scan_time: string;
  total_videos: number;
  new_videos: number;
  added_to_queue: number;
  status: string;
}
```

**验证**:
```typescript
// 在浏览器控制台测试
import { autoDownloadAPI } from './services/api';

autoDownloadAPI.getScanRecords().then(console.log);
```

**预期结果**:
- API 接口成功添加
- 类型定义正确

---

### 步骤 2.4: 前端 - 创建扫描记录组件

**文件**: `apps/web/src/pages/settings/AutoDownloadSettings.tsx`

**操作**:
```typescript
import React, { useState, useEffect } from 'react';
import { autoDownloadAPI, ScanRecord } from '../../services/api';

export function AutoDownloadSettings() {
  const [scanRecords, setScanRecords] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadScanRecords();
  }, []);

  const loadScanRecords = async () => {
    const result = await autoDownloadAPI.getScanRecords();
    if (result.success) {
      setScanRecords(result.data);
    }
  };

  const handleTriggerScan = async (sourceType: string) => {
    setLoading(true);
    const result = await autoDownloadAPI.triggerScan(sourceType);
    setLoading(false);
    if (result.success) {
      alert(`扫描完成：新增 ${result.data.new} 个视频`);
      loadScanRecords();
    } else {
      alert(`扫描失败：${result.error}`);
    }
  };

  return (
    <div className="auto-download-settings">
      <h2>自动下载设置</h2>

      <div className="section">
        <h3>扫描记录</h3>
        <button onClick={loadScanRecords}>刷新</button>
        <button onClick={() => handleTriggerScan('favorite')}>
          {loading ? '扫描中...' : '立即扫描收藏夹'}
        </button>

        <table>
          <thead>
            <tr>
              <th>视频源</th>
              <th>扫描时间</th>
              <th>总数</th>
              <th>新增</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {scanRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.source_type}:{record.source_id}</td>
                <td>{new Date(record.last_scan_time).toLocaleString()}</td>
                <td>{record.total_videos}</td>
                <td>{record.new_videos}</td>
                <td>{record.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**验证**:
```typescript
// 在 SettingsPage.tsx 中添加 tab
import { AutoDownloadSettings } from './AutoDownloadSettings';

const tabs = [
  // ... 其他 tabs ...
  { id: 'auto-download', label: '自动下载', component: AutoDownloadSettings },
];
```

**预期结果**:
- 页面成功显示
- 扫描记录可以查看
- 手动触发扫描正常

---

### 步骤 2.5: 集成测试

**测试流程**:
1. 启动后端服务
2. 打开前端页面
3. 点击"立即扫描收藏夹"按钮
4. 查看扫描记录列表

**验证标准**:
- ✅ 后端 API 正常响应
- ✅ 前端页面正常显示
- ✅ 扫描记录正确显示
- ✅ 手动触发扫描成功

---

## ⬇️ 阶段 3: 自动下载功能实现（后端 + 前端）

### 目标
实现自动将扫描到的视频添加到下载队列。

### 步骤 3.1: 后端 - 实现自动下载服务

**文件**: `apps/api/src/services/auto_download_service.py`

**操作**:
```python
from typing import List, Dict
from sqlalchemy.orm import Session
from uuid import uuid4
from ..models.task import Task
from ..models.scheduler import TaskState

class AutoDownloadService:
    """自动下载服务"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def add_videos_to_queue(
        self,
        videos: List[dict],
        config: Dict
    ) -> Dict:
        """将视频添加到下载队列"""
        added_count = 0
        skipped_count = 0
        
        for video in videos:
            # 检查是否已存在
            existing = self.db.query(Task).filter(
                Task.media_id == video.get('bvid'),
                Task.media_type == 'video'
            ).first()
            
            if existing:
                skipped_count += 1
                continue
            
            # 创建任务
            task = Task(
                id=str(uuid4()),
                media_type='video',
                media_id=video.get('bvid'),
                title=video.get('title'),
                cover=video.get('cover'),
                meta={
                    'quality': config.get('quality', 64),
                    'codec': config.get('codec', 'avc'),
                    'audio_bitrate': config.get('audio_bitrate', 192),
                    'output_format': config.get('output_format', 'mp4')
                },
                state=TaskState.BACKLOG
            )
            
            self.db.add(task)
            added_count += 1
        
        self.db.commit()
        
        return {
            "success": True,
            "added": added_count,
            "skipped": skipped_count
        }
```

**验证**:
```python
# 测试自动下载服务
import asyncio
from sqlalchemy.orm import Session
from src.database import SessionLocal
from src.services.auto_download_service import AutoDownloadService

async def test_auto_download():
    db = SessionLocal()
    service = AutoDownloadService(db)
    
    test_videos = [
        {
            'bvid': 'BV1xx411c7mD',
            'title': '测试视频',
            'cover': 'https://example.com/cover.jpg'
        }
    ]
    
    result = await service.add_videos_to_queue(
        videos=test_videos,
        config={'quality': 64, 'codec': 'avc'}
    )
    
    print(f"添加结果: {result}")
    db.close()

asyncio.run(test_auto_download())
```

**预期结果**:
- 视频成功添加到 `tasks` 表
- 状态为 `BACKLOG`

---

### 步骤 3.2: 后端 - 更新扫描触发 API

**文件**: `apps/api/src/routers/auto_download.py`

**操作**:
```python
@router.post("/scan/trigger")
async def trigger_scan(
    source_type: str = Query(...),
    source_id: str = Query("all"),
    db: Session = Depends(get_db)
):
    """手动触发扫描"""
    from ..services.video_source_scanner import VideoSourceScanner
    from ..services.auto_download_service import AutoDownloadService
    from ..dependencies.auth import get_current_user
    
    scanner = VideoSourceScanner(db)
    auto_download = AutoDownloadService(db)
    
    try:
        # 扫描视频源
        if source_type == 'favorite':
            user, sessdata = get_current_user()
            result = await scanner.scan_favorite(
                media_id=source_id,
                user_id=user.mid,
                sessdata=sessdata
            )
        else:
            return {"success": False, "error": "不支持的视频源类型"}
        
        # 添加到下载队列
        added_count = 0
        if result.get("success") and result.get("new", 0) > 0:
            add_result = await auto_download.add_videos_to_queue(
                videos=result.get("videos", []),
                config={
                    'quality': 64,
                    'codec': 'avc',
                    'audio_bitrate': 192,
                    'output_format': 'mp4'
                }
            )
            added_count = add_result.get("added", 0)
        
        return {
            "success": True,
            "data": {
                "total": result.get("total", 0),
                "new": result.get("new", 0),
                "added": added_count
            }
        }
    
    except Exception as e:
        return {"success": False, "error": str(e)}
```

**验证**:
```bash
curl -X POST "http://localhost:8000/api/auto-download/scan/trigger?source_type=favorite&source_id=12345678"
```

**预期结果**:
- 扫描成功
- 新视频自动添加到下载队列
- 返回添加的数量

---

### 步骤 3.3: 集成测试

**测试流程**:
1. 手动触发扫描
2. 检查扫描记录
3. 检查下载队列

**验证标准**:
- ✅ 扫描成功
- ✅ 新视频自动添加到队列
- ✅ 扫描记录正确更新

---

## ⚙️ 阶段 4: 配置管理实现（后端 + 前端）

### 目标
实现配置管理功能，支持用户自定义配置。

### 步骤 4.1: 后端 - 创建配置模型

**文件**: `apps/api/src/config/auto_download.py`

**操作**:
```python
from pydantic import BaseSettings, Field
from typing import List, Optional

class AutoDownloadConfig(BaseSettings):
    """自动下载配置"""
    
    enabled: bool = Field(True, description="是否启用自动下载")
    scan_interval_minutes: int = Field(30, description="扫描间隔（分钟）")
    scan_cron: Optional[str] = Field(None, description="Cron 表达式")
    quality: int = Field(64, description="视频质量")
    codec: str = Field('avc', description="编码格式")
    audio_bitrate: int = Field(192, description="音频码率")
    output_format: str = Field('mp4', description="输出格式")
    min_duration: Optional[int] = Field(None, description="最小时长（秒）")
    max_duration: Optional[int] = Field(None, description="最大时长（秒）")
    allowed_uploaders: Optional[List[str]] = Field(None, description="UP主白名单")
    blocked_uploaders: Optional[List[str]] = Field(None, description="UP主黑名单")
    max_retries: int = Field(3, description="最大重试次数")
    retry_interval: int = Field(300, description="重试间隔（秒）")
    
    class Config:
        env_file = ".env"
        case_sensitive = False
```

**验证**:
```python
from src.config.auto_download import AutoDownloadConfig

config = AutoDownloadConfig()
print(f"配置: {config.dict()}")
```

**预期结果**:
- 配置成功加载
- 可以从环境变量读取

---

### 步骤 4.2: 后端 - 添加配置 API

**文件**: `apps/api/src/routers/auto_download.py`

**操作**:
```python
from pydantic import BaseModel
from ..config.auto_download import AutoDownloadConfig

class ConfigUpdate(BaseModel):
    """配置更新模型"""
    enabled: bool = True
    scan_interval_minutes: int = 30
    scan_cron: Optional[str] = None
    quality: int = 64
    codec: str = 'avc'
    audio_bitrate: int = 192
    output_format: str = 'mp4'
    min_duration: Optional[int] = None
    max_duration: Optional[int] = None
    allowed_uploaders: Optional[List[str]] = None
    blocked_uploaders: Optional[List[str]] = None
    max_retries: int = 3
    retry_interval: int = 300

@router.get("/config")
async def get_config():
    """获取自动下载配置"""
    config = AutoDownloadConfig()
    return {"success": True, "data": config.dict()}

@router.post("/config")
async def update_config(config_update: ConfigUpdate):
    """更新自动下载配置"""
    # 简化版：只更新当前配置（阶段 4 暂不实现持久化）
    return {
        "success": True,
        "message": "配置已更新（简化版，未持久化）",
        "data": config_update.dict()
    }
```

**验证**:
```bash
# 测试获取配置
curl http://localhost:8000/api/auto-download/config

# 测试更新配置
curl -X POST http://localhost:8000/api/auto-download/config \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "scan_interval_minutes": 60}'
```

**预期结果**:
- 成功获取配置
- 成功更新配置

---

### 步骤 4.3: 前端 - 添加配置 UI

**文件**: `apps/web/src/pages/settings/AutoDownloadSettings.tsx`

**操作**:
```typescript
// 在现有组件中添加配置部分
import { useState, useEffect } from 'react';

export function AutoDownloadSettings() {
  const [config, setConfig] = useState({
    enabled: true,
    scan_interval_minutes: 30,
    scan_cron: '',
    quality: 64,
    codec: 'avc',
    audio_bitrate: 192,
    output_format: 'mp4',
    max_retries: 3,
    retry_interval: 300
  });
  const [loading, setLoading] = useState(false);

  const handleSaveConfig = async () => {
    setLoading(true);
    const response = await fetch('/api/auto-download/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const result = await response.json();
    setLoading(false);
    if (result.success) {
      alert('配置已保存');
    }
  };

  return (
    <div className="auto-download-settings">
      <h2>自动下载设置</h2>

      {/* 配置区域 */}
      <div className="section">
        <h3>基本设置</h3>
        <label>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          启用自动下载
        </label>

        <div>
          <label>扫描间隔（分钟）:</label>
          <input
            type="number"
            value={config.scan_interval_minutes}
            onChange={(e) => setConfig({ ...config, scan_interval_minutes: parseInt(e.target.value) })}
          />
        </div>

        <div>
          <label>Cron 表达式:</label>
          <input
            type="text"
            value={config.scan_cron}
            onChange={(e) => setConfig({ ...config, scan_cron: e.target.value })}
            placeholder="例如: 0 */30 * * * *"
          />
        </div>
      </div>

      {/* 视频质量设置 */}
      <div className="section">
        <h3>视频质量设置</h3>
        <div>
          <label>视频质量:</label>
          <select
            value={config.quality}
            onChange={(e) => setConfig({ ...config, quality: parseInt(e.target.value) })}
          >
            <option value={16}>高清 (16)</option>
            <option value={32}>超清 (32)</option>
            <option value={64}>蓝光 (64)</option>
            <option value={80}>杜比视界 (80)</option>
            <option value={112}>HDR 杜比视界 (112)</option>
          </select>
        </div>

        <div>
          <label>编码格式:</label>
          <select
            value={config.codec}
            onChange={(e) => setConfig({ ...config, codec: e.target.value })}
          >
            <option value="avc">AVC (H.264)</option>
            <option value="hevc">HEVC (H.265)</option>
            <option value="av01">AV1</option>
          </select>
        </div>
      </div>

      {/* 保存按钮 */}
      <button onClick={handleSaveConfig} disabled={loading}>
        {loading ? '保存中...' : '保存配置'}
      </button>

      {/* 扫描记录区域 */}
      {/* ... 现有的扫描记录代码 ... */}
    </div>
  );
}
```

**验证**:
- 页面显示配置表单
- 配置可以修改
- 点击保存按钮发送请求

**预期结果**:
- 配置页面正常显示
- 配置可以保存

---

### 步骤 4.4: 集成测试

**测试流程**:
1. 修改配置
2. 点击保存
3. 查看返回结果

**验证标准**:
- ✅ 配置成功保存
- ✅ 后端收到配置
- ✅ 前端显示成功提示

---

## ⏰ 阶段 5: 定时任务集成（后端）

### 目标
实现定时任务，自动扫描视频源。

### 步骤 5.1: 后端 - 集成定时任务

**文件**: `apps/api/src/services/scheduler_service.py`

**操作**:
```python
# 在现有的 SchedulerService 类中添加新方法
async def scan_video_sources(self):
    """扫描视频源并自动下载"""
    from .video_source_scanner import VideoSourceScanner
    from .auto_download_service import AutoDownloadService
    
    scanner = VideoSourceScanner(self.db)
    auto_download = AutoDownloadService(self.db)
    
    # 定义要扫描的视频源
    scan_sources = [
        {'type': 'favorite', 'id': 'all'},
        {'type': 'watch_later', 'id': 'all'},
    ]
    
    for source in scan_sources:
        source_type = source['type']
        source_id = source['id']
        
        try:
            # 扫描视频源
            if source_type == 'favorite':
                # 获取当前用户的 sessdata
                from ..dependencies.auth import get_current_user
                user, sessdata = get_current_user()
                
                if source_id == 'all':
                    # 获取所有收藏夹（阶段 5 暂不实现）
                    continue
                else:
                    result = await scanner.scan_favorite(
                        media_id=source_id,
                        user_id=user.mid,
                        sessdata=sessdata
                    )
            
            # 添加到下载队列
            if result.get("success") and result.get("new", 0) > 0:
                add_result = await auto_download.add_videos_to_queue(
                    videos=result.get("videos", []),
                    config={
                        'quality': 64,
                        'codec': 'avc',
                        'audio_bitrate': 192,
                        'output_format': 'mp4'
                    }
                )
                
                logger.info(
                    f"扫描 {source_type}:{source_id} 完成，"
                    f"新增 {result.get('new')} 个视频，"
                    f"添加到队列 {add_result.get('added')} 个"
                )
        
        except Exception as e:
            logger.error(f"扫描 {source_type}:{source_id} 失败: {e}")

# 在 start() 方法中添加定时任务
def start(self):
    # ... 现有的定时任务 ...
    
    # 添加自动下载扫描任务
    self.scheduler.add_job(
        self.scan_video_sources,
        trigger='interval',
        minutes=30,  # 每30分钟扫描一次
        id='auto_download_scan'
    )
    
    self.scheduler.start()
```

**验证**:
```python
# 手动触发一次扫描
import asyncio
from sqlalchemy.orm import Session
from src.database import SessionLocal
from src.services.scheduler_service import SchedulerService

async def test_scheduler():
    db = SessionLocal()
    scheduler = SchedulerService(db)
    
    # 手动触发一次扫描
    await scheduler.scan_video_sources()
    
    db.close()

asyncio.run(test_scheduler())
```

**预期结果**:
- 定时任务正常执行
- 自动扫描视频源
- 新视频自动添加到队列

---

### 步骤 5.2: 集成测试

**测试流程**:
1. 启动服务
2. 等待 30 分钟
3. 检查扫描记录
4. 检查下载队列

**验证标准**:
- ✅ 定时任务自动执行
- ✅ 扫描记录自动创建
- ✅ 新视频自动添加

---

## 🔧 阶段 6: 高级功能实现（后端 + 前端）

### 目标
实现视频筛选规则和重试机制。

### 步骤 6.1: 后端 - 实现视频筛选规则

**文件**: `apps/api/src/services/auto_download_service.py`

**操作**:
```python
# 在 AutoDownloadService 类中添加筛选方法
def _should_download(self, video: dict, config: Dict) -> bool:
    """判断是否应该下载"""
    # 检查视频时长
    duration = video.get('duration', 0)
    
    if config.get('min_duration') and duration < config['min_duration']:
        logger.info(f"视频 {video.get('bvid')} 时长过短: {duration}秒")
        return False
    
    if config.get('max_duration') and duration > config['max_duration']:
        logger.info(f"视频 {video.get('bvid')} 时长过长: {duration}秒")
        return False
    
    # 检查UP主
    allowed_uploaders = config.get('allowed_uploaders')
    if allowed_uploaders:
        uploader = video.get('owner', {}).get('name', '')
        if uploader not in allowed_uploaders:
            logger.info(f"视频 {video.get('bvid')} UP主不在白名单: {uploader}")
            return False
    
    blocked_uploaders = config.get('blocked_uploaders')
    if blocked_uploaders:
        uploader = video.get('owner', {}).get('name', '')
        if uploader in blocked_uploaders:
            logger.info(f"视频 {video.get('bvid')} UP主在黑名单: {uploader}")
            return False
    
    return True

# 修改 add_videos_to_queue 方法
async def add_videos_to_queue(
    self,
    videos: List[dict],
    config: Dict
) -> Dict:
    """将视频添加到下载队列"""
    added_count = 0
    skipped_count = 0
    
    for video in videos:
        # 检查是否已存在
        existing = self.db.query(Task).filter(
            Task.media_id == video.get('bvid'),
            Task.media_type == 'video'
        ).first()
        
        if existing:
            logger.info(f"视频 {video.get('bvid')} 已存在，跳过")
            skipped_count += 1
            continue
        
        # 根据配置筛选视频
        if not self._should_download(video, config):
            logger.info(f"视频 {video.get('bvid')} 不符合下载条件，跳过")
            skipped_count += 1
            continue
        
        # 创建任务
        task = Task(
            id=str(uuid4()),
            media_type='video',
            media_id=video.get('bvid'),
            title=video.get('title'),
            cover=video.get('cover'),
            meta={
                'quality': config.get('quality', 64),
                'codec': config.get('codec', 'avc'),
                'audio_bitrate': config.get('audio_bitrate', 192),
                'output_format': config.get('output_format', 'mp4')
            },
            state=TaskState.BACKLOG
        )
        
        self.db.add(task)
        added_count += 1
    
    self.db.commit()
    
    return {
        "success": True,
        "added": added_count,
        "skipped": skipped_count
    }
```

**验证**:
```python
# 测试视频筛选
test_videos = [
    {
        'bvid': 'BV1xx411c7mD',
        'title': '短视频',
        'duration': 60,
        'owner': {'name': '测试UP主'}
    }
]

config = {
    'min_duration': 300,
    'quality': 64
}

result = await service.add_videos_to_queue(test_videos, config)
# 预期：跳过短视频
```

**预期结果**:
- 视频按时长筛选
- 视频按UP主筛选

---

### 步骤 6.2: 前端 - 添加筛选规则 UI

**文件**: `apps/web/src/pages/settings/AutoDownloadSettings.tsx`

**操作**:
```typescript
// 在配置中添加筛选规则
const [config, setConfig] = useState({
  // ... 现有配置 ...
  min_duration: null as number | null,
  max_duration: null as number | null,
  allowed_uploaders: [] as string[],
  blocked_uploaders: [] as string[],
});

// 添加 UP 主管理逻辑
const addUploader = (type: 'allowed' | 'blocked', name: string) => {
  if (type === 'allowed') {
    setConfig({
      ...config,
      allowed_uploaders: [...config.allowed_uploaders, name]
    });
  } else {
    setConfig({
      ...config,
      blocked_uploaders: [...config.blocked_uploaders, name]
    });
  }
};

const removeUploader = (type: 'allowed' | 'blocked', name: string) => {
  if (type === 'allowed') {
    setConfig({
      ...config,
      allowed_uploaders: config.allowed_uploaders.filter(u => u !== name)
    });
  } else {
    setConfig({
      ...config,
      blocked_uploaders: config.blocked_uploaders.filter(u => u !== name)
    });
  }
};

// 在 UI 中添加筛选规则部分
<div className="section">
  <h3>视频筛选规则</h3>
  <div>
    <label>
      <input
        type="checkbox"
        checked={config.min_duration !== null}
        onChange={(e) => setConfig({
          ...config,
          min_duration: e.target.checked ? 300 : null
        })}
      />
      启用时长筛选
    </label>
    
    {config.min_duration !== null && (
      <>
        <label>最小时长（秒）:</label>
        <input
          type="number"
          value={config.min_duration}
          onChange={(e) => setConfig({
            ...config,
            min_duration: parseInt(e.target.value)
          })}
        />
        
        <label>最大时长（秒）:</label>
        <input
          type="number"
          value={config.max_duration || ''}
          onChange={(e) => setConfig({
            ...config,
            max_duration: e.target.value ? parseInt(e.target.value) : null
          })}
        />
      </>
    )}
  </div>

  <div>
    <label>UP 主白名单:</label>
    <div>
      {config.allowed_uploaders.map((uploader) => (
        <span key={uploader}>
          {uploader} <button onClick={() => removeUploader('allowed', uploader)}>x</button>
        </span>
      ))}
    </div>
    <button onClick={() => {
      const name = prompt('输入 UP 主名称:');
      if (name) addUploader('allowed', name);
    }}>添加 UP 主</button>
  </div>
</div>
```

**验证**:
- 筛选规则页面正常显示
- 可以添加和删除 UP 主
- 配置可以保存

**预期结果**:
- 筛选规则 UI 正常工作
- 配置正确传递给后端

---

### 步骤 6.3: 集成测试

**测试流程**:
1. 配置筛选规则
2. 手动触发扫描
3. 检查哪些视频被跳过

**验证标准**:
- ✅ 筛选规则生效
- 不符合条件的视频被跳过
- 日志记录筛选原因

---

## ✅ 升级检查清单

### 阶段 1 完成标准
- [ ] 数据库表创建成功
- [ ] 可以插入和查询数据

### 阶段 2 完成标准
- [ ] 扫描服务工作正常
- [ ] 扫描记录 API 可用
- [ ] 前端可以查看扫描记录
- [ ] 手动触发扫描成功

### 阶段 3 完成标准
- [ ] 自动下载服务工作正常
- [ ] 视频自动添加到队列
- [ ] 扫描记录更新正确

### 阶段 4 完成标准
- [ ] 配置系统工作正常
- [ ] 配置 API 可用
- [ ] 前端配置页面可用
- [ ] 配置可以保存

### 阶段 5 完成标准
- [ ] 定时任务正常执行
- [ ] 自动扫描工作正常
- [ ] 扫描间隔正确

### 阶段 6 完成标准
- [ ] 视频筛选规则生效
- [ ] 前端筛选规则配置可用
- [ ] 不符合规则的视频被跳过

---

## 📝 升级后验证流程

### 功能验证
```bash
# 1. 启动服务
cd apps/api
uvicorn src.main:app --reload

# 2. 打开前端页面，测试以下功能：
# - 查看扫描记录
# - 手动触发扫描
# - 修改配置
# - 查看筛选规则

# 3. 验证定时任务
# - 等待 30 分钟
# - 检查扫描记录
# - 检查下载队列
```

### 稳定性验证
- 连续运行 24 小时无崩溃
- 定时任务正常执行
- 错误自动恢复

---

## 💡 常见问题

### Q1: 如何调试定时任务？
A: 临时减小扫描间隔到 1 分钟，添加详细日志输出

### Q2: 前端配置不生效？
A: 检查配置是否正确传递到后端，查看后端日志

### Q3: 扫描失败怎么办？
A: 检查 B 站账号登录状态、网络连接、SESSDATA 有效性

---

## 🎓 总结

本升级指南采用**前后端一体化**的方式，每个阶段都包含：

1. **后端实现**: 数据模型、服务、API
2. **前端实现**: UI 组件、API 调用
3. **集成测试**: 端到端验证

**关键要点**：
- ✅ 每个阶段前后端一起完成
- ✅ 每个阶段都可独立验证
- ✅ 保持代码简洁
- ✅ 完善错误处理
- ✅ 添加详细日志

建议按照阶段顺序实施，每个阶段完成后进行充分测试，确保功能正常后再进入下一阶段。

祝升级顺利！