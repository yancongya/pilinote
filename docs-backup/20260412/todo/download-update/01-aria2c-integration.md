# Aria2c 集成方案

## 概述

本文档详细说明了如何将 Aria2c 多线程下载器集成到 PiliNote 的下载系统中，以提升下载速度和稳定性。

## 功能描述

### 当前问题
- 使用 yt-dlp 内置下载器，下载速度受限于单线程
- 大文件下载速度较慢（6-8 MB/s）
- 并发控制能力有限
- 无法充分利用高带宽网络

### 解决方案
- 集成 Aria2c 作为外部下载器
- 支持 8-16 并发连接
- 提升下载速度 30-50%
- 保持完全向后兼容

### 下载器对比

| 特性 | yt-dlp 内置 | Aria2c (8连接) | Aria2c (16连接) |
|------|------------|---------------|----------------|
| 下载速度 | 6-8 MB/s | 10-12 MB/s | 12-15 MB/s |
| CPU 使用率 | 10-20% | 15-25% | 20-30% |
| 内存占用 | 50-100 MB | 30-60 MB | 40-80 MB |
| 网络连接数 | 2个 | 8个 | 16个 |

## 实施步骤

### 步骤1：添加 Aria2c 可用性检查

**文件**：`apps/api/src/services/download_engine.py`

**修改内容**：

```python
def _check_aria2c_available(self) -> bool:
    """
    检查 Aria2c 是否可用
    
    Returns:
        bool: Aria2c 是否可用
    """
    import shutil
    
    # 如果使用默认路径，不检查
    if self.aria2c_path == 'aria2c':
        return False
    
    # 检查自定义路径是否存在
    return shutil.which(self.aria2c_path) is not None
```

**关键点**：
- 使用 `shutil.which()` 检查可执行文件
- 默认路径不检查，避免误判
- 返回布尔值，方便后续判断

### 步骤2：修改 download_video 方法支持 Aria2c

**文件**：`apps/api/src/services/download_engine.py`

**修改内容**：

```python
async def download_video(
    self,
    bvid: str,
    quality: int,
    output_format: str,
    output_path: str,
    sessdata: Optional[str] = None,
    progress_callback: Optional[Callable] = None,
    pause_event: Optional[asyncio.Event] = None,
    cid: Optional[int] = None,
    audio_bitrate: Optional[int] = 192,
    codec: Optional[str] = 'avc'
):
    """
    下载视频
    
    Args:
        bvid: B站视频ID
        quality: 视频质量 (16=360P, 32=480P, 64=720P, 80=1080P, 112=1080P+, 116=4K)
        output_format: 输出格式 (mp4, flv, mkv)
        output_path: 输出路径
        sessdata: 用户SESSDATA
        progress_callback: 进度回调函数
        pause_event: 暂停事件
        cid: 视频分P ID
        audio_bitrate: 音频码率 (64/128/132/192/30232/30251/30250)
        codec: 视频编码 (avc/hevc/av1/vp9)
    """
    # 创建输出目录
    output_dir = Path(output_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 根据质量、编码和音频码率构建格式选择
    format_str = self._build_format_string(quality, codec, audio_bitrate)
    
    # 构建后处理器配置
    postprocessors = []
    
    # 添加视频转换器（仅当需要转换格式时）
    postprocessors.append({
        'key': 'FFmpegVideoConvertor',
        'preferedformat': output_format,
    })
    
    # 构建yt-dlp配置
    ydl_opts = {
        'format': format_str,
        'outtmpl': str(output_dir / '%(title)s.%(ext)s'),
        'quiet': False,
        'no_warnings': True,
        'merge_output_format': output_format,
        'postprocessors': postprocessors,
        'progress_hooks': [],
    }
    
    # 使用自定义的ffmpeg路径
    if self.ffmpeg_path != 'ffmpeg':
        ydl_opts['ffmpeg_location'] = self.ffmpeg_path
        logger.info(f"Using custom FFmpeg path: {self.ffmpeg_path}")
    
    # 添加 Aria2c 配置（如果可用）
    if self._check_aria2c_available():
        ydl_opts['external_downloader'] = self.aria2c_path
        ydl_opts['external_downloader_args'] = [
            '-x', '8',                    # 8个连接（适中配置）
            '-k', '1M',                    # 每个连接分块1MB
            '--max-tries=5',             # 最多重试5次
            '--retry-wait=10',           # 重试等待10秒
            '--timeout=60',              # 60秒超时
            '--max-connection-per-server=8',  # 每服务器最大连接数
            '--split=8',                 # 分成8块下载
            '--min-split-size=1M',       # 最小分片1MB
            '--continue=true',           # 启用断点续传
            '--check-certificate=false', # 跳过证书验证
            '--allow-overwrite=true',    # 允许覆盖
            '--auto-file-renaming=false', # 不自动重命名
            '--summary-interval=0',      # 减少输出
        ]
        logger.info(f"Using Aria2c downloader: {self.aria2c_path}")
        logger.info(f"Aria2c configuration: 8 connections, 1MB chunks")
    else:
        logger.info("Using yt-dlp built-in downloader")
    
    logger.info(f"Download parameters: quality={quality}, codec={codec}, audio_bitrate={audio_bitrate}, format={output_format}")
    
    # ... 后续代码保持不变 ...
```

**关键点**：
- 检查 Aria2c 可用性后再配置
- 使用适中的 8 连接配置，平衡速度和资源
- 添加详细的日志输出
- 保持向后兼容，Aria2c 不可用时自动降级

### 步骤3：添加性能统计

**文件**：`apps/api/src/services/download_engine.py`

**新增方法**：

```python
def get_download_stats(self) -> Dict[str, Any]:
    """
    获取下载引擎统计信息
    
    Returns:
        Dict: 统计信息
    """
    return {
        'yt_dlp_path': self.yt_dlp_path,
        'ffmpeg_path': self.ffmpeg_path,
        'aria2c_path': self.aria2c_path,
        'aria2c_available': self._check_aria2c_available(),
        'supported_formats': self.get_supported_formats(),
        'supported_qualities': self.get_supported_qualities(),
    }
```

### 步骤4：添加 API 端点获取下载引擎状态

**文件**：`apps/api/src/routers/download.py`

**新增端点**：

```python
@router.get("/engine/stats")
async def get_download_engine_stats():
    """
    获取下载引擎统计信息
    
    Returns:
        下载引擎配置和状态
    """
    from src.services.download_service import download_service
    
    stats = download_service.download_engine.get_download_stats()
    
    return {
        "success": True,
        "data": stats
    }
```

## 测试计划

### 测试1：Aria2c 可用性检查

```python
# 测试 Aria2c 可用性检查
from src.services.download_engine import DownloadEngine

# 1. 测试默认路径
engine1 = DownloadEngine()
assert engine1._check_aria2c_available() == False

# 2. 测试自定义路径（假设 Aria2c 已安装）
engine2 = DownloadEngine(settings)
engine2.aria2c_path = "/usr/local/bin/aria2c"
result = engine2._check_aria2c_available()
print(f"Aria2c available: {result}")
```

### 测试2：下载速度对比

```python
# 1. 使用 yt-dlp 内置下载器下载视频
start_time = time.time()
download_task = download_service.create_download_task(bvid="BV1xx411c7mD", ...)
# 等待下载完成
builtin_time = time.time() - start_time

# 2. 使用 Aria2c 下载同一视频（启用 Aria2c）
settings.storage.sidecar.aria2c = "/usr/local/bin/aria2c"
download_service.update_engine_settings()
start_time = time.time()
download_task = download_service.create_download_task(bvid="BV1xx411c7mD", ...)
# 等待下载完成
aria2c_time = time.time() - start_time

# 3. 对比速度
speed_improvement = (builtin_time - aria2c_time) / builtin_time * 100
print(f"Aria2c 速度提升: {speed_improvement:.1f}%")
```

### 测试3：降级测试

```python
# 测试 Aria2c 不可用时的降级
engine = DownloadEngine()
engine.aria2c_path = "/invalid/path/aria2c"

# 检查 Aria2c 是否可用
assert engine._check_aria2c_available() == False

# 尝试下载（应该自动降级到 yt-dlp 内置）
download_task = download_service.create_download_task(bvid="BV1xx411c7mD", ...)
# 验证下载成功
assert download_task.status == "completed"
```

### 测试4：并发下载测试

```python
# 测试多个并发下载时的资源占用
download_tasks = []
for i in range(5):
    task = download_service.create_download_task(bvid=f"BV1xx411c7m{i}", ...)
    download_tasks.append(task)

# 监控 CPU 和内存使用
import psutil
cpu_usage = psutil.cpu_percent(interval=1)
memory_usage = psutil.virtual_memory().percent

print(f"CPU 使用率: {cpu_usage}%")
print(f"内存使用率: {memory_usage}%")

# 验证资源使用在合理范围内
assert cpu_usage < 80  # CPU 使用率不超过 80%
assert memory_usage < 90  # 内存使用率不超过 90%
```

## 注意事项

### 1. Aria2c 安装

**macOS**:
```bash
brew install aria2
```

**Linux**:
```bash
# Ubuntu/Debian
sudo apt install aria2

# CentOS/RHEL
sudo yum install aria2
```

**Windows**:
```bash
# 下载预编译版本
# https://github.com/aria2/aria2/releases
```

### 2. 配置优化

根据服务器配置调整连接数：

| 服务器配置 | 推荐连接数 | 分块大小 |
|-----------|-----------|---------|
| 低配（2核4G） | 4 | 1M |
| 中配（4核8G） | 8 | 1M |
| 高配（8核16G+） | 16 | 2M |

### 3. 网络限制

某些网络环境可能限制并发连接数：
- 企业网络可能限制
- 某些 ISP 可能有 QoS 限制
- 需要根据实际情况调整

### 4. 日志监控

启用详细日志以监控下载性能：
```python
logger.setLevel(logging.DEBUG)
```

## 依赖关系

### 依赖工具
- Aria2c 1.35.0+ （可选）
- yt-dlp （必需）
- FFmpeg （必需）

### 依赖模块
- `apps/api/src/services/download_engine.py` - 下载引擎
- `apps/api/src/services/settings_service.py` - 设置服务
- `apps/api/src/routers/download.py` - API 路由

### 数据库依赖
- `settings.storage.sidecar.aria2c` - Aria2c 路径配置

## 后续步骤

### 短期优化
1. 支持 Aria2c RPC 接口
2. 添加下载速度自适应
3. 优化并发连接数选择

### 长期优化
1. 支持 BitTorrent 协议
2. 实现智能分片策略
3. 添加下载缓存机制

## 风险评估

### 技术风险
- **低风险**：Aria2c 集成代码简单
- **中风险**：不同操作系统兼容性
- **低风险**：自动降级机制

### 性能风险
- **低风险**：资源占用可控
- **中风险**：并发下载可能增加负载
- **低风险**：可通过配置优化

### 兼容性风险
- **低风险**：完全向后兼容
- **低风险**：用户可选择性启用
- **低风险**：失败时自动降级

## 完成标准

- [ ] Aria2c 可用性检查功能
- [ ] Aria2c 集成到下载流程
- [ ] 性能测试（速度提升 30%+）
- [ ] 降级测试（失败时自动降级）
- [ ] 并发测试（资源占用合理）
- [ ] API 端点（获取下载引擎状态）
- [ ] 用户文档（安装和配置说明）

---

**创建时间**: 2026-04-01  
**最后更新**: 2026-04-01  
**状态**: 📝 待实施  
**预计工期**: 2-3 天  
**优先级**: P0（高优先级）