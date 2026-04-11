# PiliNote 设置系统升级计划

## 概述

本文档详细说明了PiliNote设置系统的升级计划，专注于解决5个未实现功能中的设置相关问题。

## 功能分类

根据功能特性，将5个未实现功能重新分类：

### 设置相关功能（本计划重点）
1. ✅ **sidecar字段未保存** - sidecar字段在API响应中为null
2. ✅ **自定义工具路径未实现** - 工具路径硬编码，未从设置读取
3. ⏳ **自动清理未实现** - 无自动清理临时文件逻辑
4. ⏳ **保留失败任务未实现** - 无保留失败任务逻辑

### 下载流程相关功能（其他计划）
5. ⏳ **下载服务未使用临时路径** - 直接下载到最终目录，无临时文件处理

## 已完成的设置功能

### ✅ 阶段1：修复sidecar字段保存问题

**完成日期**：2026-03-31

**修改文件**：
- `apps/api/src/services/settings_service.py` - 修改了 `get_settings()` 和 `update_settings()` 方法
- `apps/api/src/schemas/settings.py` - 更新了 `StorageSettings` schema
- `apps/api/src/database.py` - 添加了 `init_default_settings()` 方法

**实现内容**：
- 从数据库读取 `storage.sidecar` JSON字符串并解析为字典
- 支持将sidecar字典序列化为JSON字符串存储
- 提供默认值：`{'ffmpeg': 'ffmpeg', 'aria2c': 'aria2c', 'danmakufactory': 'danmakufactory'}`

**测试结果**：
- ✅ sidecar字段可以正确读取和显示
- ✅ sidecar字段可以正确保存和更新
- ✅ 默认值初始化正常

### ✅ 阶段2：实现自定义工具路径

**完成日期**：2026-03-31

**修改文件**：
- `apps/api/src/services/download_engine.py` - 修改了 `__init__()` 方法
- `apps/api/src/services/download_service.py` - 添加了 `_create_download_engine()` 和 `update_engine_settings()` 方法
- `apps/api/src/routers/settings.py` - 添加了更新sidecar后刷新下载引擎的逻辑

**实现内容**：
- DownloadEngine从设置中读取自定义工具路径
- 支持自定义 FFmpeg、Aria2c、Danmakufactory 路径
- 更新设置后自动刷新下载引擎
- 下载时使用自定义的 ffmpeg 路径

**测试结果**：
- ✅ DownloadEngine可以从设置中读取自定义工具路径
- ✅ 自定义路径会在下载时使用
- ✅ update_engine_settings() 方法可以刷新下载引擎设置

## 待实施的设置功能

### ⏳ 阶段3：实现自动清理功能

**功能描述**：
- 下载完成后根据 `storage.auto_cleanup` 设置自动清理临时文件
- 支持定时清理旧的临时文件（超过24小时）

**实施步骤**：

#### 3.1 修改下载流程（依赖阶段3的临时路径下载功能）
```python
# apps/api/src/services/download_service.py

async def _process_completed_download(
    self, 
    download_id: str, 
    temp_dir: Path, 
    final_dir: Path, 
    storage_settings
):
    """处理已完成的下载 - 移动文件并清理"""
    try:
        # ... 文件移动逻辑 ...
        
        # 根据设置清理临时文件
        if storage_settings.auto_cleanup:
            await self._cleanup_temp_dir(temp_dir)
        else:
            # 保留临时目录，但重命名为 .temp 后缀
            backup_dir = temp_dir.parent / (temp_dir.name + '.temp')
            if backup_dir.exists():
                shutil.rmtree(str(backup_dir))
            shutil.move(str(temp_dir), str(backup_dir))
    except Exception as e:
        logger.error(f"Failed to process completed download: {e}")
        raise
```

#### 3.2 创建定时清理任务
```python
# apps/api/src/services/scheduler_service.py

class SchedulerService:
    """定时任务服务"""
    
    def __init__(self):
        self.cleanup_task = None
        self.is_running = False
    
    async def start_cleanup_scheduler(self):
        """启动自动清理定时任务"""
        if self.is_running:
            logger.warning("Cleanup scheduler is already running")
            return
        
        self.is_running = True
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        logger.info("Started cleanup scheduler")
    
    async def _cleanup_loop(self):
        """清理循环"""
        while self.is_running:
            try:
                # 获取设置
                with SessionLocal() as db:
                    settings_service = SettingsService(db)
                    settings = settings_service.get_settings()
                    storage_settings = settings.storage
                
                # 如果启用了自动清理，执行清理
                if storage_settings.auto_cleanup:
                    await self._cleanup_old_temp_files(storage_settings.temp_path)
                
                # 情况1: 每小时检查一次
                await asyncio.sleep(3600)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                # 出错后等待5分钟再重试
                await asyncio.sleep(300)
    
    async def _cleanup_old_temp_files(self, temp_path: str):
        """清理旧的临时文件（超过24小时）"""
        try:
            temp_dir = Path(temp_path)
            if not temp_dir.exists():
                return
            
            now = datetime.now()
            cutoff_time = now - timedelta(hours=24)
            
            # 遍历临时目录
            for item in temp_dir.iterdir():
                if item.is_dir():
                    mod_time = datetime.fromtimestamp(item.stat().st_mtime)
                    if mod_time < cutoff_time:
                        try:
                            shutil.rmtree(str(item))
                            logger.info(f"Cleaned up old temp directory: {item}")
                        except Exception as e:
                            logger.error(f"Failed to clean up {item}: {e}")
        except Exception as e:
            logger.error(f"Failed to cleanup old temp files: {e}")
```

#### 3.3 在应用启动时启动调度器
```python
# apps/api/main.py

@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    # ... 其他初始化逻辑 ...
    
    # 启动自动清理调度器
    await scheduler_service.start_cleanup_scheduler()
    logger.info("Application started")

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭事件"""
    # 停止自动清理调度器
    await scheduler_service.stop_cleanup_scheduler()
    logger.info("Application stopped")
```

**测试计划**：
1. 设置 `auto_cleanup=True`，下载完成后验证临时目录已清理
2. 设置 `auto_cleanup=False`，下载完成后验证临时目录保留
3. 等待24小时后验证旧的临时文件被自动清理

### ⏳ 阶段4：实现保留失败任务功能

**功能描述**：
- 根据 `storage.keep_failed` 设置决定是否保留失败的下载任务
- 保留的失败任务会被重命名为 `.failed` 后缀

**实施步骤**：

#### 4.1 修改下载流程
```python
# apps/api/src/services/download_service.py

async def _download_video(self, download_id: str):
    """执行视频下载"""
    # ... 前面的代码 ...
    
    try:
        # 下载逻辑
        await self.download_engine.download_video(...)
        # ... 成功处理 ...
        
    except asyncio.CancelledError:
        # 下载被取消
        self.update_download_status(download_id, "cancelled")
        # 如果不保留失败任务，清理临时文件
        if not storage_settings.keep_failed:
            await self._cleanup_temp_dir(temp_dir)
        else:
            logger.info(f"Keeping cancelled download files at: {temp_dir}")
            # 重命名临时目录以便识别
            failed_dir = temp_dir.parent / f"{temp_dir.name}.cancelled"
            if failed_dir.exists():
                shutil.rmtree(str(failed_dir))
            shutil.move(str(temp_dir), str(failed_dir))
            
    except Exception as e:
        # 下载失败
        self.update_download_status(download_id, "failed", str(e))
        # 如果不保留失败任务，清理临时文件
        if not storage_settings.keep_failed:
            await self._cleanup_temp_dir(temp_dir)
        else:
            logger.info(f"Keeping failed download files at: {temp_dir}")
            # 重命名临时目录以便识别
            failed_dir = temp_dir.parent / f"{temp_dir.name}.failed"
            if failed_dir.exists():
                shutil.rmtree(str(failed_dir))
            shutil.move(str(temp_dir), str(failed_dir))
        raise
```

**测试计划**：
1. 设置 `keep_failed=True`，下载失败后验证临时文件保留并重命名为 `.failed`
2. 设置 `keep_failed=False`，下载失败后验证临时文件已清理
3. 测试下载取消情况下的文件保留逻辑

## 设置系统架构

### 设置数据结构

```typescript
interface StorageSettings {
  download_path: string      // 下载路径
  temp_path: string         // 临时文件路径
  auto_cleanup: boolean      // 自动清理临时文件
  keep_failed: boolean       // 保留失败的任务
  sidecar: {
    ffmpeg: string            // FFmpeg路径
    aria2c: string           // Aria2c路径
    danmakufactory: string    // Danmakufactory路径
  }
}
```

### 设置优先级

1. **基础设置**（P0 - 必需）：
   - ✅ sidecar字段保存和读取
   - ✅ 自定义工具路径

2. **增强设置**（P1 - 重要）：
   - ⏳ 自动清理功能
   - ⏳ 保留失败任务

3. **进阶设置**（P2 - 可选）：
   - 定时清理任务
   - 清理策略优化
   - 失败任务分析

## 实施优先级

### 优先级1：基础设置（已完成）
- ✅ sidecar字段保存问题
- ✅ 自定义工具路径

### 优先级2：增强设置（进行中）
- ⏳ 自动清理功能
- ⏳ 保留失败任务

### 优先级3：优化设置（待规划）
- ⏳ 定时清理策略优化
- ⏳ 失败任务分析
- ⏳ 存储空间监控

## 技术要点

### 1. 设置持久化
- 使用 SQLite 数据库存储设置
- JSON 序列化存储复杂类型（sidecar）
- 支持设置初始化和默认值

### 2. 设置更新机制
- 前端通过 API 更新设置
- 后端自动刷新相关服务
- 支持批量更新和单个更新

### 3. 错误处理
- JSON 解析失败时使用默认值
- 文件操作失败时提供详细日志
- 设置读取失败时降级到默认配置

### 4. 性能优化
- 定时任务不要过于频繁
- 文件操作使用异步处理
- 避免阻塞主流程

## 依赖关系

### 阶段3依赖
- 依赖阶段3的临时路径下载功能
- 需要先实现 `_process_completed_download()` 方法

### 阶段4依赖
- 依赖阶段3的临时路径下载功能
- 需要先实现 `_cleanup_temp_dir()` 方法

### 阶段3和4协同
- 自动清理和保留失败任务功能相互关联
- 需要同时测试两个功能

## 测试策略

### 单元测试
- sidecar字段读取和保存
- 自定义工具路径加载
- 自动清理逻辑
- 保留失败任务逻辑

### 集成测试
- 设置更新后下载引擎是否正确刷新
- 下载完成后临时文件是否正确处理
- 失败任务是否正确保留或清理

### 端到端测试
- 前端设置更新是否生效
- 下载流程中设置是否正确应用
- 临时文件清理是否符合预期

## 风险控制

### 技术风险
1. **文件操作错误** - 添加详细的错误处理和日志
2. **并发问题** - 使用锁机制保护文件操作
3. **路径权限** - 确保目录有读写权限

### 缓解措施
1. 降级策略 - 操作失败时使用默认值
2. 重试机制 - 失败后自动重试
3. 日志记录 - 记录所有操作以便排查

### 测试风险
1. **测试覆盖不足** - 编写完整的测试用例
2. **边界情况未覆盖** - 测试各种异常情况
3. **兼容性问题** - 测试不同操作系统

### 缓解措施
1. 测试矩阵 - 覆盖各种场景
2. 边界测试 - 测试边界条件
3. 回归测试 - 确保不影响现有功能

## 完成标准

### 阶段3完成标准
- [ ] 下载完成后自动清理临时文件（auto_cleanup=true）
- [ ] 下载完成后保留临时文件（auto_cleanup=false）
- [ ] 定时清理超过24小时的临时文件
- [ ] 所有功能通过单元测试
- [ ] 所有功能通过集成测试

### 阶段4完成标准
- [ ] 下载失败时保留临时文件（keep_failed=true）
- [ ] 下载失败时清理临时文件（keep_failed=false）
- [ ] 失败任务正确重命名（.failed/.cancelled）
- [ ] 所有功能通过单元测试
- [ ] 所有功能通过集成测试

## 后续规划

### 设置系统优化（P3优先级）
1. 添加设置历史记录
2. 支持设置导入导出
3. 添加设置验证逻辑
4. 实现设置恢复功能

### 监控和告警（P3优先级）
1. 设置修改日志
2. 存储空间监控
3. 下载成功率统计
4. 异常情况告警

### 性能优化（P3优先级）
1. 设置缓存优化
2. 定时任务性能优化
3. 大文件处理优化
4. 并发控制优化

## 总结

本计划专注于PiliNote设置系统的升级，涵盖了sidecar字段保存、自定义工具路径、自动清理和保留失败任务4个设置相关功能。

**已完成**：
- ✅ sidecar字段保存问题
- ✅ 自定义工具路径

**进行中**：
- ⏳ 自动清理功能
- ⏳ 保留失败任务

通过合理的优先级安排和详细的测试策略，确保设置系统升级的稳定性和可靠性。