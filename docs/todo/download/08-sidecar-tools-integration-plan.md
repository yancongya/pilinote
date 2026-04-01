# Sidecar工具集成计划

## 概述

本文档记录了Aria2c和Danmakufactory两个工具的当前状态、集成计划和实施步骤。

## 工具现状

| 工具 | 状态 | 安装位置 | 代码状态 | 实际使用 |
|------|------|----------|----------|----------|
| FFmpeg | ✅ 已安装 | `/opt/homebrew/bin/ffmpeg` | ✅ 已调用 | ✅ 正常使用 |
| Aria2c | ❌ 未安装 | - | ⚠️ 已定义但未调用 | ❌ 未使用 |
| Danmakufactory | ❌ 未安装 | - | ⚠️ 已定义但未调用 | ❌ 未使用 |

## 工具作用

### Aria2c
- **作用**: 多线程下载加速器
- **功能**:
  - 支持多线程下载，提高下载速度
  - 支持断点续传
  - 支持多协议下载（HTTP/HTTPS/BT/FTP等）
  - 可设置下载速度限制
- **使用场景**: 替代yt-dlp自带下载器，提升下载速度

### Danmakufactory
- **作用**: 弹幕处理工具
- **功能**:
  - 从B站获取弹幕数据
  - 将弹幕转换为不同格式（ASS、SRT等）
  - 将弹幕嵌入到视频中（烧录弹幕）
  - 弹幕过滤和处理
- **使用场景**: 为下载的视频添加弹幕功能

## 当前代码状态

### 代码位置
- **文件**: `apps/api/src/services/download_engine.py`
- **初始化**: 第35-46行

```python
# 默认路径
self.yt_dlp_path = "yt-dlp"
self.ffmpeg_path = "ffmpeg"
self.aria2c_path = "aria2c"
self.danmakufactory_path = "danmakufactory"

# 从设置中读取自定义路径
if settings and hasattr(settings, 'storage') and settings.storage.sidecar:
    sidecar = settings.storage.sidecar
    if sidecar:
        self.yt_dlp_path = sidecar.get('yt_dlp', self.yt_dlp_path)
        self.ffmpeg_path = sidecar.get('ffmpeg', self.ffmpeg_path)
        self.aria2c_path = sidecar.get('aria2c', self.aria2c_path)
        self.danmakufactory_path = sidecar.get('danmakufactory', self.danmakufactory_path)
```

### 实际调用
- **FFmpeg**: 在第106-107行使用
- **Aria2c**: 仅存储路径，未实际调用
- **Danmakufactory**: 仅存储路径，未实际调用

## 集成计划

### Phase 1: Aria2c集成（预计1周）

#### 目标
将Aria2c作为下载后端集成到下载流程中，提升下载速度。

#### 实施步骤

1. **安装Aria2c**
   - macOS: `brew install aria2`
   - Linux: `sudo apt install aria2` 或 `sudo yum install aria2`
   - Windows: 下载二进制文件

2. **验证安装**
   ```bash
   aria2c --version
   ```

3. **修改download_engine.py**
   - 在 `download_video` 方法中添加Aria2c下载器配置
   - 添加外部下载器支持：
   ```python
   ydl_opts = {
       # ... 其他配置
       'external_downloader': self.aria2c_path,
       'external_downloader_args': [
           '-x', '16',  # 16个连接
           '-k', '1M',  # 每个连接分块大小
           '--max-tries', '5',
           '--retry-wait', '10'
       ]
   }
   ```

4. **测试**
   - 测试单线程下载速度
   - 测试多线程下载速度
   - 验证断点续传功能

5. **文档更新**
   - 更新用户文档说明Aria2c的作用
   - 添加Aria2c配置说明

### Phase 2: Danmakufactory集成（预计1周）

#### 目标
实现弹幕下载和嵌入功能，为视频添加弹幕支持。

#### 实施步骤

1. **安装Danmakufactory**
   - macOS: `brew install danmaku` 或从源码编译
   - Linux: 从GitHub下载预编译版本
   - Windows: 下载Windows版本

2. **验证安装**
   ```bash
   danmaku factory --version
   ```

3. **创建弹幕下载服务**
   - 新建 `apps/api/src/services/danmaku_service.py`
   - 实现B站弹幕API调用
   - 实现弹幕格式转换（XML→ASS→SRT）

4. **修改download_engine.py**
   - 在 `download_video` 方法中添加弹幕处理
   - 添加弹幕后处理器：
   ```python
   postprocessors.append({
       'key': 'FFmpegEmbedSubtitle',
       'subtitles': self.danmakufactory_path
   })
   ```

5. **前端配置**
   - 在DownloadSettings中添加弹幕开关
   - 添加弹幕格式选择（ASS/SRT/无）

6. **测试**
   - 测试弹幕下载
   - 测试弹幕格式转换
   - 测试弹幕嵌入功能

7. **文档更新**
   - 更新用户文档说明弹幕功能
   - 添加弹幕配置说明

## 配置说明

### 前端配置位置
- **页面**: 设置 → 数据管理 → 自定义执行路径
- **字段**:
  - FFmpeg路径: 默认 `ffmpeg`
  - Aria2c路径: 默认 `aria2c`
  - Danmakufactory路径: 默认 `danmakufactory`

### 配置存储
- **数据库表**: `settings`
- **键格式**: `storage.sidecar.{tool_name}`
- **示例**:
  ```
  storage.sidecar.ffmpeg = "ffmpeg"
  storage.sidecar.aria2c = "aria2c"
  storage.sidecar.danmakufactory = "danmakufactory"
  ```

## 注意事项

### 依赖检查
在启用Aria2c或Danmakufactory之前，需要检查工具是否可用：
```python
import shutil
if not shutil.which(self.aria2c_path):
    logger.warning(f"Aria2c not found at {self.aria2c_path}, using default downloader")
```

### 错误处理
- 工具不存在时降级到默认方案
- 工具执行失败时提供友好错误提示
- 记录详细日志便于调试

### 性能考虑
- Aria2c多线程可能增加服务器负载
- 弹幕处理会增加下载时间
- 提供开关让用户选择是否启用

## 参考资源

### Aria2c
- 官方网站: https://aria2.github.io/
- GitHub: https://github.com/aria2/aria2
- 文档: https://aria2.github.io/manual/en/html/

### Danmakufactory
- GitHub: https://github.com/m13253/danmaku
- 文档: https://m13253.github.io/danmaku/

### B站弹幕API
- 弹幕获取: `https://api.bilibili.com/x/v1/dm/list.so?oid={cid}`
- 弹幕格式: XML (B站标准格式)

## 测试计划

### Aria2c测试
- [ ] 安装Aria2c并验证版本
- [ ] 配置Aria2c路径
- [ ] 测试单文件下载
- [ ] 测试并发下载
- [ ] 测试断点续传
- [ ] 测试速度限制

### Danmakufactory测试
- [ ] 安装Danmakufactory并验证版本
- [ ] 配置Danmakufactory路径
- [ ] 测试弹幕下载
- [ ] 测试弹幕格式转换（XML→ASS）
- [ ] 测试弹幕格式转换（XML→SRT）
- [ ] 测试弹幕嵌入视频
- [ ] 测试弹幕过滤功能

## 实施优先级

1. **Phase 1: Aria2c集成** (优先级: 高)
   - 下载速度是核心体验
   - 实现相对简单
   - 收益明显

2. **Phase 2: Danmakufactory集成** (优先级: 中)
   - 弹幕是增强功能
   - 实现相对复杂
   - 需要额外API调用

## 完成标准

### Aria2c集成完成标准
- ✅ Aria2c可以作为下载后端使用
- ✅ 下载速度提升30%以上
- ✅ 支持断点续传
- ✅ 前端可以配置Aria2c路径
- ✅ 错误处理完善

### Danmakufactory集成完成标准
- ✅ 可以下载B站弹幕
- ✅ 弹幕可以转换为ASS/SRT格式
- ✅ 弹幕可以嵌入到视频中
- ✅ 前端可以配置Danmakufactory路径
- ✅ 前端可以选择是否启用弹幕

## 后续优化

1. **性能优化**
   - 调整Aria2c连接数优化速度/负载平衡
   - 弹幕处理异步化避免阻塞下载

2. **功能增强**
   - 支持弹幕样式自定义
   - 支持弹幕时间轴调整
   - 支持多弹幕源

3. **用户体验**
   - 添加工具检测和自动配置
   - 添加工具状态监控
   - 添加详细的下载日志

---

**创建时间**: 2026-04-01  
**最后更新**: 2026-04-01  
**状态**: 待实施