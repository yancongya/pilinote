# 自动化功能文档

## 目录

1. [自动化功能概述](#自动化功能概述)
2. [自动触发扫描](#自动触发扫描)
3. [手动触发扫描](#手动触发扫描)
4. [扫描逻辑详解](#扫描逻辑详解)
5. [配置和设置](#配置和设置)
6. [数据流程](#数据流程)
7. [用户界面](#用户界面)
8. [性能优化](#性能优化)
9. [错误处理](#错误处理)
10. [最佳实践](#最佳实践)

---

## 自动化功能概述

### 功能定义

PiliNote 的自动化功能是一个智能的视频下载管理系统，可以定时扫描用户的收藏夹和稍后再看列表，自动发现新视频并将其添加到下载队列。系统支持灵活的扫描策略、存储空间控制和自动下载触发机制。

### 核心特性

- **双重扫描模式**：支持自动定时扫描和手动触发扫描
- **灵活的调度策略**：支持固定间隔扫描和 Cron 表达式定时扫描
- **智能存储管理**：自动检查存储空间，避免磁盘空间不足
- **自定义扫描范围**：可选择扫描特定收藏夹，控制扫描数量
- **扫描记录追踪**：记录每次扫描的结果，便于查看和追溯
- **自动下载触发**：扫描完成后可自动开始下载新视频
- **并发控制**：控制同时扫描和下载的任务数量

### 使用场景

1. **定时备份收藏夹**：定期扫描收藏夹，自动下载新内容
2. **稍后再看自动归档**：定时清理稍后再看列表，下载到本地
3. **特定收藏夹监控**：只关注某个收藏夹的更新，选择性下载
4. **离线观看准备**：在空闲时间批量下载视频，方便离线观看
5. **存储空间管理**：自动监控存储空间，避免空间不足

### 系统架构

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              PiliNote 自动化系统架构                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              前端层 (React + TypeScript)                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐              │
│  │ AutoDownloadSettings │  │  ScanResultContent   │  │    scanStore         │              │
│  │   - 自动下载配置     │  │   - 扫描结果显示     │  │   - 状态管理         │              │
│  │   - 定时任务设置     │  │   - 记录管理         │  │   - API 调用         │              │
│  └──────────┬───────────┘  └──────────┬───────────┘  └──────────┬───────────┘              │
│             │                         │                         │                          │
│             └─────────────────────────┴─────────────────────────┘                          │
│                                       │                                                     │
└───────────────────────────────────────│─────────────────────────────────────────────────────┘
                                        │ HTTP API
┌───────────────────────────────────────▼─────────────────────────────────────────────────────┐
│                              API 层 (FastAPI)                                                │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  /api/auto-download/*                                                               │  │
│  │  ├─ GET  /scan-records        - 获取扫描记录                                        │  │
│  │  ├─ POST /scan/trigger        - 手动触发扫描                                        │  │
│  │  ├─ DELETE /scan-records/{id} - 删除单条记录                                        │  │
│  │  └─ DELETE /scan-records      - 清空记录                                            │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│  │  /api/settings/*                                                                      │  │
│  │  ├─ GET  /                 - 获取设置                                               │  │
│  │  ├─ PUT  /                 - 更新设置（包含自动下载配置）                            │  │
│  │  ├─ POST /reset            - 重置设置                                               │  │
│  │  ├─ GET  /export           - 导出设置                                               │  │
│  │  └─ POST /import           - 导入设置                                               │  │
│  └─────────────────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────────────────────┐
│                              服务层 (Python Services)                                        │
│                                                                                             │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐  │
│  │   SchedulerService       │  │      ScanService         │  │    BilibiliService       │  │
│  │   - 定时任务调度         │  │   - 扫描逻辑实现         │  │   - B站 API 调用         │  │
│  │   - Cookie 自动刷新      │  │   - 新视频识别           │  │   - 获取收藏夹列表       │  │
│  │   - 临时文件清理         │  │   - 扫描记录管理         │  │   - 获取稍后再看         │  │
│  │   - 配置动态更新         │  │   - 队列添加             │  │   - Cookie 管理          │  │
│  └──────────┬───────────────┘  └──────────┬───────────────┘  └──────────┬───────────────┘  │
│             │                              │                              │                  │
│             └──────────────────────────────┴──────────────────────────────┘                  │
│                                        │                                                 │
│  ┌─────────────────────────────────────▼──────────────────────────────────────────────┐   │
│  │                         QueueManager (队列管理)                                    │   │
│  │   - submit_backlog()        - 提交任务到队列                                      │   │
│  │   - execute_single_task()   - 执行单个任务                                        │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼─────────────────────────────────────────────────────┐
│                              数据层 (Database)                                              │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐  │
│  │      Setting 表          │  │       User 表            │  │        Task 表           │  │
│  │   - 扫描记录存储         │  │   - 用户信息             │  │   - 下载任务             │  │
│  │   - 配置存储             │  │   - SESSDATA             │  │   - 任务状态             │  │
│  │   - 扫描视频列表         │  │   - Cookie 信息          │  │   - 任务元数据           │  │
│  └──────────────────────────┘  └──────────────────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 自动触发扫描

### 功能概述

自动触发扫描是基于定时任务的自动化扫描机制，系统会根据用户配置的触发方式（间隔扫描或 Cron 表达式）自动执行扫描任务，发现新视频并添加到下载队列。

### 触发方式

#### 1. 间隔触发 (Interval)

按固定时间间隔触发扫描，适用于需要持续监控的场景。

**支持的时间间隔：**

| 间隔 | 适用场景 | 推荐度 |
|------|----------|--------|
| 15 分钟 | 频繁更新的收藏夹 | ⭐⭐⭐ |
| 30 分钟 | 一般监控频率 | ⭐⭐⭐⭐⭐ |
| 60 分钟 | 默认推荐设置 | ⭐⭐⭐⭐⭐ |
| 120 分钟 | 较少更新的内容 | ⭐⭐⭐ |
| 360 分钟 (6小时) | 低频监控 | ⭐⭐ |
| 720 分钟 (12小时) | 每日备份 | ⭐⭐ |
| 1440 分钟 (24小时) | 每日归档 | ⭐⭐⭐ |

**实现原理：**

```python
# services/scheduler_service.py
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

def _schedule_interval_scan(self, minutes: int):
    """设置间隔扫描任务"""
    # 移除旧的定时任务
    self._remove_auto_scan_job()
    
    # 添加新的定时任务
    self.scheduler.add_job(
        lambda: asyncio.run(self.perform_auto_scan()),
        trigger=IntervalTrigger(minutes=minutes),
        id=self.auto_scan_job_id,
        name='自动扫描任务',
        replace_existing=True
    )
```

#### 2. Cron 表达式触发

使用标准 Cron 表达式定义复杂的定时规则，适用于需要精确控制执行时间的场景。

**常用 Cron 表达式：**

| 表达式 | 说明 | 适用场景 |
|--------|------|----------|
| `0 * * * *` | 每小时的第 0 分钟 | 每小时检查 |
| `0 */6 * * *` | 每 6 小时 | 多次检查 |
| `0 2 * * *` | 每天凌晨 2 点 | 深夜下载 |
| `0 8 * * *` | 每天早上 8 点 | 工作时间 |
| `0 8 * * 1` | 每周一早上 8 点 | 周更新 |
| `0 0 * * 0` | 每周日 0 点 | 周日备份 |
| `0 0 1 * *` | 每月 1 号 0 点 | 月归档 |
| `0 0 * * 1-5` | 工作日每天 0 点 | 工作日更新 |

**Cron 表达式格式：**

```
┌───────────── 分钟 (0 - 59)
│ ┌───────────── 小时 (0 - 23)
│ │ ┌───────────── 日 (1 - 31)
│ │ │ ┌───────────── 月 (1 - 12)
│ │ │ │ ┌───────────── 周 (0 - 6，0=周日)
│ │ │ │ │
* * * * *
```

**实现原理：**

```python
# services/scheduler_service.py
from apscheduler.triggers.cron import CronTrigger

def _schedule_cron_scan(self, cron_expression: str):
    """设置 Cron 扫描任务"""
    if not cron_expression:
        logger.warning("[Scheduler] Cron 表达式为空，取消定时扫描")
        self._remove_auto_scan_job()
        return
    
    # 移除旧的定时任务
    self._remove_auto_scan_job()
    
    # 添加新的定时任务
    self.scheduler.add_job(
        lambda: asyncio.run(self.perform_auto_scan()),
        trigger=CronTrigger.from_crontab(cron_expression),
        id=self.auto_scan_job_id,
        name='自动扫描任务',
        replace_existing=True
    )
```

### 调度器服务

#### 服务启动

```python
# main.py - 应用启动时启动调度器
from src.services.scheduler_service import scheduler_service

@app.on_event("startup")
async def startup_event():
    """应用启动时初始化"""
    # 启动调度器服务
    scheduler_service.start()
    logger.info("[Startup] 调度器服务已启动")

@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时清理"""
    # 停止调度器服务
    scheduler_service.stop()
    logger.info("[Shutdown] 调度器服务已停止")
```

#### 调度器初始化

```python
# services/scheduler_service.py
class SchedulerService:
    """定时任务服务"""
    
    def start(self):
        """启动定时任务"""
        if self.scheduler and self.scheduler.running:
            logger.warning("[Scheduler] 定时任务已经在运行")
            return
        
        # 创建调度器
        self.scheduler = BackgroundScheduler()
        
        # 添加定时任务：每30分钟检查一次cookie有效期
        self.scheduler.add_job(
            self.check_and_refresh_cookies,
            trigger=IntervalTrigger(minutes=30),
            id='refresh_cookies',
            name='刷新Cookie任务',
            replace_existing=True
        )
        
        # 添加定时任务：每小时清理一次临时文件
        self.scheduler.add_job(
            self.cleanup_old_temp_files,
            trigger=IntervalTrigger(hours=1),
            id='cleanup_temp_files',
            name='清理临时文件任务',
            replace_existing=True
        )
        
        # 添加定时任务：每5分钟检查并更新自动扫描配置
        self.scheduler.add_job(
            self.update_auto_scan_schedule,
            trigger=IntervalTrigger(minutes=5),
            id='update_auto_scan_schedule',
            name='更新自动扫描配置',
            replace_existing=True
        )
        
        # 初始化自动扫描任务
        self.update_auto_scan_schedule()
        
        # 启动调度器
        self.scheduler.start()
        logger.info("[Scheduler] 定时任务已启动")
```

#### 配置动态更新

调度器会每 5 分钟检查一次自动扫描配置，如果配置发生变化，会自动更新定时任务：

```python
def update_auto_scan_schedule(self):
    """更新自动扫描的定时任务配置"""
    try:
        from src.services.settings_service import SettingsService
        
        with SessionLocal() as db:
            settings_service = SettingsService(db)
            settings = settings_service.get_settings()
            auto_download = getattr(settings, 'auto_download', None)
            
            # 构建当前配置
            new_config = {
                'enabled': False,
                'trigger_type': None,
                'scan_interval': None,
                'cron_expression': None
            }
            
            if auto_download:
                new_config['enabled'] = auto_download.enabled
                new_config['trigger_type'] = auto_download.trigger_type
                new_config['scan_interval'] = auto_download.scan_interval
                new_config['cron_expression'] = auto_download.cron_expression
            
            # 检查配置是否改变
            if new_config == self._current_config:
                logger.debug("[Scheduler] 自动扫描配置未改变，跳过更新")
                return
            
            # 配置改变了，更新任务
            logger.info(f"[Scheduler] 自动扫描配置已改变: {self._current_config} -> {new_config}")
            self._current_config = new_config
            
            if not auto_download or not auto_download.enabled:
                logger.debug("[Scheduler] 自动下载未启用")
                self._remove_auto_scan_job()
                return
            
            # 根据触发类型设置不同的定时任务
            trigger_type = auto_download.trigger_type
            
            if trigger_type == 'interval':
                scan_interval = auto_download.scan_interval
                self._schedule_interval_scan(scan_interval)
            elif trigger_type == 'cron':
                cron_expression = auto_download.cron_expression
                self._schedule_cron_scan(cron_expression)
            else:
                logger.warning(f"[Scheduler] 未知的触发类型: {trigger_type}")
                self._remove_auto_scan_job()
                
    except Exception as e:
        logger.error(f"[Scheduler] 更新自动扫描配置失败: {str(e)}")
```

### 自动扫描执行

```python
async def perform_auto_scan(self):
    """执行自动扫描"""
    try:
        logger.info("[Scheduler] 开始执行自动扫描...")
        
        # 获取活跃用户
        db = SessionLocal()
        try:
            active_user = db.query(User).filter(User.is_active == True).first()
            if not active_user:
                logger.warning("[Scheduler] 未找到活跃用户，跳过扫描")
                return
            
            # 获取用户配置的扫描源类型
            settings_service = SettingsService(db)
            settings = settings_service.get_settings()
            auto_download = getattr(settings, 'auto_download', None)
            
            if not auto_download or not auto_download.enabled:
                logger.debug("[Scheduler] 自动下载未启用，跳过扫描")
                return
            
            # 创建扫描服务
            scan_service = ScanService(db)
            
            # 扫描收藏夹
            logger.info("[Scheduler] 开始扫描收藏夹...")
            try:
                result = await scan_service.trigger_scan(
                    source_type='favorite',
                    source_id='all',
                    user_mid=active_user.mid
                )
                logger.info(f"[Scheduler] 收藏夹扫描完成: 总计={result.total}, 新视频={result.new}, 已添加={result.added}")
            except Exception as e:
                logger.error(f"[Scheduler] 收藏夹扫描失败: {str(e)}")
            
            # 扫描稍后再看
            logger.info("[Scheduler] 开始扫描稍后再看...")
            try:
                result = await scan_service.trigger_scan(
                    source_type='watch_later',
                    source_id='all',
                    user_mid=active_user.mid
                )
                logger.info(f"[Scheduler] 稍后再看扫描完成: 总计={result.total}, 新视频={result.new}, 已添加={result.added}")
            except Exception as e:
                logger.error(f"[Scheduler] 稍后再看扫描失败: {str(e)}")
            
            logger.info("[Scheduler] 自动扫描完成")
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"[Scheduler] 执行自动扫描失败: {str(e)}")
```

---

## 手动触发扫描

### 功能概述

手动触发扫描允许用户主动启动扫描任务，查看扫描结果，并选择性地将视频添加到下载队列。手动扫描提供了更灵活的控制，适合临时需要扫描特定内容的情况。

### 扫描入口

#### 1. 新建下载页面

在新建下载页面中，提供扫描功能入口：

```typescript
// components/NewDownload/ScanResultContent.tsx
export default function ScanResultContent() {
  const {
    loading,
    scanning,
    scanRecords,
    lastScanResult,
    error,
    fetchScanRecords,
    triggerScan,
    deleteScanRecord,
    clearScanRecords,
    clearError
  } = useScanStore()

  const handleTriggerScan = async (sourceType: 'favorite' | 'watch_later') => {
    try {
      setSelectedSource(sourceType)
      setIsScanAnimating(true)
      setCurrentFolderIndex(0)
      setScanningFolders([])
      
      // 模拟扫描动画
      const animInterval = setInterval(() => {
        setScanningFolders(prev => [...prev, prev.length])
      }, 800) // 每800ms扫描一个收藏夹
      
      await triggerScan(sourceType, 'all')
      
      clearInterval(animInterval)
      setIsScanAnimating(false)
    } catch (err) {
      console.error('Scan failed:', err)
      setIsScanAnimating(false)
      setScanningFolders([])
    }
  }

  return (
    <div className="scan-result-content">
      {/* 操作按钮区域 */}
      <div className="scan-actions">
        <button
          className="scan-btn scan-btn-favorite"
          onClick={() => handleTriggerScan('favorite')}
          disabled={scanning}
        >
          <Heart size={16} />
          <span>{scanning && selectedSource === 'favorite' ? '扫描中...' : '扫描收藏夹'}</span>
        </button>

        <button
          className="scan-btn scan-btn-watchlater"
          onClick={() => handleTriggerScan('watch_later')}
          disabled={scanning}
        >
          <Clock size={16} />
          <span>扫描稍后再看</span>
        </button>

        <button
          className="scan-btn scan-btn-refresh"
          onClick={() => fetchScanRecords()}
          disabled={loading}
        >
          {loading ? (
            <RefreshCw size={16} className="spinner" />
          ) : (
            <RefreshCw size={16} />
          )}
          <span>刷新记录</span>
        </button>
      </div>
      
      {/* 扫描结果显示 */}
      {/* ... */}
    </div>
  )
}
```

### 扫描类型

#### 1. 收藏夹扫描

扫描用户的所有收藏夹或特定收藏夹：

```typescript
// 扫描所有收藏夹
await triggerScan('favorite', 'all')

// 扫描特定收藏夹
await triggerScan('favorite', '123456')
```

#### 2. 稍后再看扫描

扫描用户的稍后再看列表：

```typescript
// 扫描稍后再看列表
await triggerScan('watch_later', 'all')
```

### 扫描结果展示

#### 1. 实时扫描动画

扫描过程中显示动画效果，提升用户体验：

```typescript
// 扫描中动画显示
{isScanAnimating && selectedSource === 'favorite' && (
  <div className="scan-last-result scan-animating">
    <h3>扫描中...</h3>
    <div className="folders-list">
      <h4>正在扫描收藏夹</h4>
      <div className="folders-grid">
        {scanningFolders.map((_, index) => (
          <div 
            key={index} 
            className="folder-card folder-card-scanning"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="folder-header">
              <Heart size={14} />
              <span className="folder-title">收藏夹 {index + 1}</span>
              <RefreshCw size={14} className="spinner scanning-icon" />
            </div>
            <div className="folder-stats">
              <div className="folder-stat">
                <span className="folder-stat-label">扫描中</span>
                <span className="folder-stat-value">...</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
)}
```

#### 2. 扫描结果详情

扫描完成后显示详细结果：

```typescript
// 最后扫描结果
{lastScanResult && !isScanAnimating && (
  <div className="scan-last-result">
    <h3>扫描结果</h3>

    {/* 收藏夹详情列表 */}
    {lastScanResult.folders && lastScanResult.folders.length > 0 && (
      <div className="folders-list">
        <h4>收藏夹详情</h4>
        <div className="folders-grid">
          {lastScanResult.folders.slice(0, currentFolderIndex + 1).map((folder, index) => (
            <div 
              key={folder.id} 
              className="folder-card folder-card-animating"
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="folder-header">
                <Heart size={14} />
                <span className="folder-title">{folder.title}</span>
              </div>
              <div className="folder-stats">
                <div className="folder-stat">
                  <span className="folder-stat-label">视频数</span>
                  <span className="folder-stat-value">{folder.video_count}</span>
                </div>
                <div className="folder-stat">
                  <span className="folder-stat-label">新视频</span>
                  <span className="folder-stat-value new">{folder.new_count}</span>
                </div>
                <div className="folder-stat">
                  <span className="folder-stat-label">总计</span>
                  <span className="folder-stat-value">{folder.media_count}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* 总体统计 */}
    <div className="result-stats">
      <div className="stat-item">
        <span className="stat-label">总视频数</span>
        <span className="stat-value">{lastScanResult.total}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">新视频</span>
        <span className="stat-value new">{lastScanResult.new}</span>
      </div>
      <div className="stat-item">
        <span className="stat-label">已添加</span>
        <span className="stat-value added">{lastScanResult.added}</span>
      </div>
    </div>
  </div>
)}
```

### 扫描记录管理

#### 1. 记录列表

显示历史扫描记录：

```typescript
// 扫描记录列表
<div className="scan-records">
  <div style={{ 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '12px'
  }}>
    <h3 style={{ flex: 1, minWidth: 'auto' }}>扫描记录</h3>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      {/* 保留时间选择 */}
      <select
        value={retentionDays === null ? '' : retentionDays}
        onChange={(e) => handleRetentionDaysChange(e.target.value ? parseInt(e.target.value) : null)}
        style={{
          padding: '6px 12px',
          fontSize: '12px',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          backgroundColor: 'white',
          color: '#64748b',
          cursor: 'pointer',
          minWidth: '120px'
        }}
        title="设置记录保留时间"
      >
        <option value="">不限制</option>
        <option value={7}>保留7天</option>
        <option value={30}>保留30天</option>
        <option value={90}>保留90天</option>
        <option value={180}>保留180天</option>
      </select>
      
      {/* 清空记录按钮 */}
      {scanRecords.length > 0 && (
        <button
          className="scan-btn"
          onClick={handleClearRecords}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'transparent',
            color: '#dc2626',
            border: '1px solid transparent',
            minWidth: 'auto',
            cursor: 'pointer'
          }}
        >
          <Trash2 size={14} />
          <span className="desktop-only">清空记录</span>
        </button>
      )}
    </div>
  </div>
  
  {/* 记录列表 */}
  {scanRecords.map((record) => (
    <div key={record.id} className="record-item">
      <div className="record-header">
        <div className="record-source">
          {record.source_type === 'favorite' ? (
            <Heart size={14} />
          ) : (
            <Clock size={14} />
          )}
          <span>
            {record.source_type === 'favorite' ? '收藏夹' : '稍后再看'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="record-status">
            {record.status === 'success' ? (
              <CheckCircle size={14} className="success" />
            ) : (
              <XCircle size={14} className="error" />
            )}
          </div>
          <button
            onClick={() => handleDeleteRecord(record.id)}
            style={{
              padding: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.2s'
            }}
            title="删除此记录"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="record-stats">
        <div className="record-stat">
          <span className="label">总视频数</span>
          <span className="value">{record.total_videos}</span>
        </div>
        <div className="record-stat">
          <span className="label">新视频</span>
          <span className="value new">{record.new_videos}</span>
        </div>
        <div className="record-stat">
          <span className="label">已添加</span>
          <span className="value added">{record.added_to_queue}</span>
        </div>
      </div>

      <div className="record-time">
        {formatRelativeTime(record.last_scan_time)}
      </div>
    </div>
  ))}
</div>
```

#### 2. 自动清理

系统支持自动清理旧记录，避免记录过多：

```typescript
// 自动清理旧记录
useEffect(() => {
  const saved = localStorage.getItem('scan_record_retention_days')
  if (saved && saved !== 'unlimited') {
    const days = parseInt(saved)
    const interval = setInterval(() => {
      clearScanRecords(undefined, days).catch(err => {
        console.error('Scheduled cleanup failed:', err)
      })
    }, 3600000) // 每小时检查一次
    
    return () => clearInterval(interval)
  }
}, [])

// 保留时间选择
const handleRetentionDaysChange = async (days: number | null) => {
  setRetentionDays(days)
  
  try {
    // 清理指定天数之前的记录
    if (days !== null) {
      await clearScanRecords(undefined, days)
    }
    
    // 保存偏好到localStorage
    localStorage.setItem('scan_record_retention_days', days?.toString() || 'unlimited')
  } catch (err) {
    console.error('Failed to update retention days:', err)
  }
}
```

### 手动扫描 vs 自动扫描对比

| 特性 | 手动扫描 | 自动扫描 |
|------|----------|----------|
| **触发方式** | 用户主动点击 | 定时任务自动触发 |
| **扫描范围** | 可选择收藏夹/稍后再看 | 根据配置自动扫描 |
| **扫描结果** | 实时显示详细结果 | 仅记录到日志 |
| **添加到队列** | 可选择性添加 | 根据配置自动添加 |
| **开始下载** | 手动触发 | 可配置自动触发 |
| **适用场景** | 临时扫描、查看结果 | 定期备份、自动归档 |
| **资源占用** | 扫描时占用 | 持续占用（调度器） |

---

## 扫描逻辑详解

### 核心扫描服务

扫描服务 (`ScanService`) 是自动化功能的核心，负责执行扫描任务、识别新视频、管理扫描记录。

#### 服务初始化

```python
# services/scan_service.py
class ScanService:
    """扫描服务"""
    
    def __init__(self, db: Session):
        self.db = db
```

### 扫描流程

#### 完整扫描流程

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              扫描完整流程                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

用户触发 / 定时任务
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. 验证扫描参数                                                                                │
│    - 检查 source_type (favorite/watch_later)                                                   │
│    - 检查 source_id (all 或特定 ID)                                                           │
│    - 获取用户 SESSDATA 和 MID                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. 获取自定义扫描配置                                                                          │
│    - custom_scan.enabled: 是否启用自定义扫描                                                    │
│    - custom_scan.folder_list: 收藏夹配置列表                                                    │
│    - watch_later_max: 稍后再看数量限制                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. 获取视频列表和收藏夹信息                                                                     │
│    如果 source_type = favorite:                                                               │
│      - 获取收藏夹列表                                                                          │
│      - 应用自定义扫描配置（过滤收藏夹）                                                          │
│      - 对每个收藏夹获取视频列表                                                                │
│      - 应用视频数量限制                                                                        │
│    如果 source_type = watch_later:                                                            │
│      - 获取稍后再看列表                                                                        │
│      - 应用稍后再看数量限制                                                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. 识别新视频                                                                                  │
│    - 获取上次扫描记录                                                                          │
│    - 比对当前视频列表与上次扫描的视频列表                                                        │
│    - 标记新增的视频为新视频                                                                    │
│    - 计算每个收藏夹的新视频数量                                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 5. 检查自动下载条件                                                                            │
│    - auto_start_after_scan: 是否启用自动开始下载                                                │
│    - storage_threshold_gb: 存储空间阈值                                                        │
│    - 计算当前视频库大小                                                                        │
│    - 判断是否超过阈值                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
    ┌───┴───┐
    │ 条件  │
    └───┬───┘
        │
    ┌───▼────────────────┐    ┌───────────────────┐
    │ 满足条件            │    │ 不满足条件          │
    │ (自动下载启用)      │    │ (自动下载禁用)      │
    └───┬────────────────┘    └───────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 6. 添加到下载队列                                                                              │
│    - 转换视频信息为任务创建请求                                                                │
│    - 提交到队列管理器                                                                          │
│    - 记录任务 ID                                                                               │
│    - 统计成功添加的数量                                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 7. 触发开始下载（如果满足条件）                                                                │
│    - 更新任务状态为 active                                                                    │
│    - 广播任务更新事件（WebSocket）                                                             │
│    - 创建异步任务执行下载                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 8. 保存扫描记录                                                                                │
│    - 生成记录 ID                                                                               │
│    - 保存扫描结果到 Setting 表                                                                 │
│    - 保存扫描到的视频列表（用于下次比对）                                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 9. 返回扫描结果                                                                                │
│    - 总视频数                                                                                  │
│    - 新视频数                                                                                  │
│    - 已添加到队列数                                                                            │
│    - 收藏夹详情（如果是收藏夹扫描）                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 关键方法实现

#### 1. 触发扫描

```python
async def trigger_scan(
    self,
    source_type: str,
    source_id: str = "all",
    sessdata: str = None,
    user_mid: int = None
) -> ScanTriggerResponse:
    """
    触发扫描
    
    Args:
        source_type: 视频源类型 (favorite/watch_later)
        source_id: 视频源 ID
        sessdata: 用户 SESSDATA
        user_mid: 用户 MID
        
    Returns:
        扫描结果
    """
    logger.info(f"Triggering scan: source_type={source_type}, source_id={source_id}, user_mid={user_mid}")
    
    # 获取视频列表和收藏夹信息
    videos, folder_infos = await self._fetch_videos(source_type, source_id, sessdata, user_mid)
    total_videos = len(videos)
    
    # 识别新视频
    new_videos = await self._identify_new_videos(source_type, videos)
    new_count = len(new_videos)
    
    # 计算每个收藏夹的新视频数量
    for folder_info in folder_infos:
        folder_bvids = {v.bvid for v in videos if hasattr(v, 'folder_id') and v.folder_id == folder_info.id}
        folder_new_videos = [v for v in new_videos if v.bvid in folder_bvids]
        folder_info.new_count = len(folder_new_videos)
    
    # 检查是否应该自动添加到下载队列
    should_auto_add, auto_add_reason = self._should_auto_start_download()
    added_count = 0
    
    if should_auto_add and new_videos:
        # 自动添加到下载队列
        added_count, task_ids = await self.add_videos_to_queue(new_videos, source_type)
        logger.info(f"✓ 自动添加到队列: {added_count}/{new_count} 个视频已添加到队列")
        
        # 触发开始下载
        if added_count > 0 and task_ids:
            try:
                import asyncio
                from src.models.task import Task
                from src.routers.queue import _execute_single_task
                from src.routers.websocket import broadcast_task_updated
                
                # 更新任务状态为active
                db = SessionLocal()
                try:
                    for task_id in task_ids:
                        task = db.query(Task).filter_by(id=task_id).first()
                        if task:
                            task.state = 2  # TaskState.ACTIVE = 2
                            task.updated_at = int(datetime.now().timestamp())
                            logger.info(f"✓ 触发下载: {task.title} (ID: {task.id})")
                            
                            # 广播任务更新事件
                            broadcast_task_updated(task_id, "2", False)
                    
                    db.commit()
                    
                    # 创建异步任务来执行下载
                    async def execute_tasks():
                        for task_id in task_ids:
                            try:
                                await _execute_single_task(task_id)
                            except Exception as e:
                                logger.error(f"执行任务失败: {task_id} - {e}")
                    
                    asyncio.create_task(execute_tasks())
                    logger.info(f"✓ 已触发 {added_count} 个任务开始下载")
                    
                finally:
                    db.close()
                    
            except Exception as e:
                logger.error(f"✗ 触发下载失败: {e}")
            
    elif not should_auto_add:
        # 不自动添加，但不影响扫描记录
        logger.info(f"✗ 不自动添加到队列: {auto_add_reason}")
        added_count = 0
    else:
        # 没有新视频
        logger.info("✓ 扫描完成，没有新视频")
        added_count = 0
    
    # 保存扫描记录
    await self._save_scan_record(
        source_type=source_type,
        source_id=source_id,
        total_videos=total_videos,
        new_videos=new_count,
        added_to_queue=added_count
    )
    
    return ScanTriggerResponse(
        total=total_videos,
        new=new_count,
        added=added_count,
        folder_count=len(folder_infos),
        folders=folder_infos
    )
```

#### 2. 获取视频列表

```python
async def _fetch_videos(
    self,
    source_type: str,
    source_id: str,
    sessdata: str,
    user_mid: int = None
) -> tuple[List[ScanVideoInfo], List[Dict]]:
    """
    获取视频列表和收藏夹信息
    
    Args:
        source_type: 视频源类型
        source_id: 视频源 ID
        sessdata: 用户 SESSDATA
        user_mid: 用户 MID
        
    Returns:
        (视频列表, 收藏夹信息列表)
    """
    logger.info(f"_fetch_videos called: source_type={source_type}, source_id={source_id}, user_mid={user_mid}")
    
    # 从数据库获取用户的原始sessdata（URL编码格式）
    user = self.db.query(User).filter(User.mid == user_mid).first()
    if not user:
        logger.error(f"未找到MID={user_mid}的用户")
        return [], []
    
    # 使用数据库中的原始sessdata（URL编码格式）
    original_sessdata = user.sessdata
    logger.info(f"使用原始sessdata: {original_sessdata[:50]}...")
    
    # 对sessdata进行URL解码，确保格式正确
    from urllib.parse import unquote
    decoded_sessdata = unquote(original_sessdata)
    logger.info(f"解码后的sessdata: {decoded_sessdata[:50]}...")
    
    # 获取自定义扫描配置
    custom_scan_config = self._get_custom_scan_config()
    logger.info(f"自定义扫描配置: enabled={custom_scan_config['enabled']}")
    
    service = BilibiliService()
    try:
        if source_type == "favorite":
            # 获取收藏夹视频
            logger.info(f"开始获取收藏夹列表, user_mid={user_mid}")
            result = await service.get_folder_list(decoded_sessdata, user_mid, 1, 50)
            logger.info(f"收藏夹列表结果: {result.get('success')}")
            
            if result["success"]:
                folders = result["data"].get("list", [])
                logger.info(f"获取到 {len(folders)} 个收藏夹")
                
                # 应用自定义扫描配置
                if custom_scan_config['enabled'] and custom_scan_config['folder_list']:
                    # 创建文件夹名称到配置的映射
                    folder_config_map = {item['folder_name']: item['max_videos'] for item in custom_scan_config['folder_list']}
                    
                    # 只保留配置中的收藏夹，且max_videos大于0的
                    filtered_folders = []
                    for folder in folders:
                        folder_name = folder.get("title", "")
                        if folder_name in folder_config_map:
                            max_videos = folder_config_map[folder_name]
                            if max_videos and max_videos > 0:
                                folder['max_videos'] = max_videos
                                filtered_folders.append(folder)
                            else:
                                logger.info(f"跳过收藏夹 {folder_name} (max_videos={max_videos}，不扫描)")
                    
                    folders = filtered_folders
                    logger.info(f"应用自定义扫描配置后，剩余 {len(folders)} 个收藏夹")
                elif custom_scan_config['enabled']:
                    # 启用了自定义扫描但folder_list为空，不扫描任何收藏夹
                    logger.info("启用了自定义扫描但收藏夹列表为空，不扫描任何收藏夹")
                    return [], []
                
                videos = []
                folder_infos = []
                
                for folder in folders:
                    if source_id == "all" or str(folder.get("id")) == source_id:
                        logger.info(f"正在扫描收藏夹: {folder.get('title')} (ID: {folder.get('id')}, FID: {folder.get('fid')})")
                        
                        # 获取收藏夹详情
                        page_size = 20
                        if custom_scan_config['enabled'] and 'max_videos' in folder:
                            # 使用配置中的max_videos限制
                            max_videos = folder['max_videos']
                            page_size = min(max_videos, 20)
                        
                        detail_result = await service.get_folder_detail(
                            decoded_sessdata,
                            folder.get("id"),
                            1,
                            page_size
                        )
                        logger.info(f"收藏夹详情结果: {detail_result.get('success')}")
                        
                        if detail_result["success"]:
                            # B站 API 返回的是 "medias" 而不是 "media_list"
                            media_list = detail_result["data"].get("medias", [])
                            
                            # 应用视频数量限制
                            if custom_scan_config['enabled'] and 'max_videos' in folder:
                                max_videos = folder['max_videos']
                                if max_videos and max_videos < len(media_list):
                                    media_list = media_list[:max_videos]
                                    logger.info(f"应用视频数量限制，保留 {len(media_list)} 个视频")
                            
                            media_count = detail_result["data"].get("info", {}).get("media_count", len(media_list))
                            logger.info(f"收藏夹 {folder.get('title')} 包含 {len(media_list)} 个视频 (总计: {media_count})")
                            
                            # 转换视频信息并添加 folder_id
                            transformed_videos = self._transform_to_scan_videos(media_list, folder.get("id"))
                            videos.extend(transformed_videos)
                            
                            # 收藏夹信息
                            from src.schemas.auto_download import FolderScanInfo
                            folder_info = FolderScanInfo(
                                id=folder.get("id"),
                                title=folder.get("title"),
                                video_count=len(transformed_videos),
                                new_count=0,  # 后续会计算
                                media_count=media_count
                            )
                            folder_infos.append(folder_info)
                
                logger.info(f"总共收集到 {len(videos)} 个视频，扫描了 {len(folder_infos)} 个收藏夹")
                return videos, folder_infos
            else:
                logger.error(f"收藏夹列表获取失败: {result}")
        
        elif source_type == "watch_later":
            # 获取稍后再看视频
            logger.info("开始获取稍后再看列表")
            result = await service.get_watch_later(decoded_sessdata)
            if result["success"]:
                watch_later_data = result["data"]
                video_list = watch_later_data.get("list", []) if isinstance(watch_later_data, dict) else []
                logger.info(f"获取到 {len(video_list)} 个稍后再看视频")
                
                # 应用稍后再看数量限制
                watch_later_max = self._get_watch_later_max()
                if watch_later_max and watch_later_max < len(video_list):
                    video_list = video_list[:watch_later_max]
                    logger.info(f"应用稍后再看数量限制，保留 {len(video_list)} 个视频")
                elif watch_later_max == 0:
                    logger.info(f"稍后再看数量限制为0，跳过扫描")
                    return [], []
                
                return self._transform_watchlater_to_videos(video_list), []
        
        return [], []
    except Exception as e:
        logger.error(f"_fetch_videos 异常: {e}", exc_info=True)
        raise
    finally:
        service.close()
```

#### 3. 识别新视频

```python
async def _identify_new_videos(
    self,
    source_type: str,
    videos: List[ScanVideoInfo]
) -> List[ScanVideoInfo]:
    """
    识别新视频
    
    Args:
        source_type: 视频源类型
        videos: 视频列表
        
    Returns:
        新视频列表
    """
    # 获取上次扫描记录
    records = await self.get_scan_records(source_type)
    if not records:
        # 第一次扫描，所有视频都是新的
        for video in videos:
            video.is_new = True
        return videos
    
    # 获取最近一次扫描的视频列表
    last_record = records[0]
    last_videos_key = f"auto_download.scan_videos.{last_record.id}"
    last_videos_setting = self.db.query(Setting).filter(Setting.key == last_videos_key).first()
    
    if not last_videos_setting:
        # 没有上次扫描的视频列表，所有视频都是新的
        for video in videos:
            video.is_new = True
        return videos
    
    try:
        import json
        last_bvids = set(json.loads(last_videos_setting.value))
        new_videos = []
        
        for video in videos:
            if video.bvid not in last_bvids:
                video.is_new = True
                new_videos.append(video)
        
        return new_videos
    except Exception as e:
        logger.error(f"Failed to parse last videos: {e}")
        return videos
```

#### 4. 添加到队列

```python
async def add_videos_to_queue(self, videos: List[ScanVideoInfo], source_type: str) -> tuple[int, List[str]]:
    """
    将新视频添加到队列
    
    Args:
        videos: 新视频列表
        source_type: 视频源类型
        
    Returns:
        (实际添加到队列的视频数量, 任务ID列表)
    """
    if not videos:
        return 0, []
    
    logger.info(f"准备将 {len(videos)} 个新视频添加到队列")
    
    # 延迟导入避免循环依赖
    from src.services.queue.manager import queue_manager
    
    added_count = 0
    task_ids = []
    
    for video in videos:
        try:
            # 转换为任务创建请求
            task_create = self._convert_video_to_task_create(video, source_type)
            
            # 提交到队列
            task = await queue_manager.submit_backlog(task_create)
            task_ids.append(task.id)
            added_count += 1
            logger.info(f"✓ 视频已添加到队列: {video.title} (BV: {video.bvid}, Task ID: {task.id})")
            
        except Exception as e:
            logger.error(f"✗ 添加视频到队列失败: {video.title} - {e}")
            continue
    
    logger.info(f"✓ 成功将 {added_count}/{len(videos)} 个视频添加到队列")
    return added_count, task_ids

def _convert_video_to_task_create(self, video: ScanVideoInfo, source_type: str) -> TaskCreate:
    """
    将扫描到的视频信息转换为任务创建请求
    
    Args:
        video: 扫描到的视频信息
        source_type: 视频源类型
        
    Returns:
        任务创建请求
    """
    # 构建 meta 信息
    meta = {
        "bvid": video.bvid,
        "author": video.author,
        "duration": video.duration,
        "pubdate": video.pubdate,
        "cover": video.cover,
        "source_type": source_type
    }
    
    # 如果是收藏夹，添加 folder_id
    if hasattr(video, 'folder_id') and video.folder_id:
        meta["folder_id"] = video.folder_id
    
    # 确定媒体类型
    if source_type == "favorite":
        media_type = MediaType.FAVORITE
    elif source_type == "watch_later":
        media_type = MediaType.WATCH_LATER
    else:
        media_type = MediaType.VIDEO
    
    return TaskCreate(
        media_type=media_type,
        media_id=video.bvid,
        title=video.title,
        cover=video.cover,
        desc=f"UP主: {video.author}",
        meta=meta
    )
```

#### 5. 保存扫描记录

```python
async def _save_scan_record(
    self,
    source_type: str,
    source_id: str,
    total_videos: int,
    new_videos: int,
    added_to_queue: int
):
    """
    保存扫描记录
    
    Args:
        source_type: 视频源类型
        source_id: 视频源 ID
        total_videos: 总视频数
        new_videos: 新视频数
        added_to_queue: 添加到队列数
    """
    record_id = str(uuid.uuid4())
    now = datetime.now()
    
    # 保存扫描记录
    record_data = {
        "id": record_id,
        "source_type": source_type,
        "source_id": source_id,
        "last_scan_time": now.isoformat(),
        "total_videos": total_videos,
        "new_videos": new_videos,
        "added_to_queue": added_to_queue,
        "status": "success"
    }
    
    import json
    setting_key = f"auto_download.scan_records.{source_type}.{record_id}"
    setting = self.db.query(Setting).filter(Setting.key == setting_key).first()
    
    if setting:
        setting.value = json.dumps(record_data)
        setting.updated_at = now
    else:
        setting = Setting(
            key=setting_key,
            value=json.dumps(record_data),
            type="json",
            category="auto_download",
            description=f"Scan record for {source_type}/{source_id}",
            default_value=None,
            created_at=now,
            updated_at=now
        )
        self.db.add(setting)
    
    self.db.commit()
```

### 存储空间检查

```python
def _get_library_size_gb(self) -> float:
    """
    计算视频库的大小（GB）
    
    Returns:
        视频库大小（GB）
    """
    try:
        # 获取下载路径设置
        setting = self.db.query(Setting).filter(Setting.key == "storage.download_path").first()
        if not setting:
            logger.warning("未找到下载路径设置，使用默认路径")
            download_path = "./downloads"
        else:
            download_path = setting.value
        
        # 解析路径（处理相对路径）
        if not os.path.isabs(download_path):
            download_path = os.path.abspath(download_path)
        
        logger.info(f"计算视频库大小: {download_path}")
        
        # 如果目录不存在，返回0
        if not os.path.exists(download_path):
            logger.warning(f"下载路径不存在: {download_path}")
            return 0.0
        
        # 计算目录大小
        total_size = 0
        for root, dirs, files in os.walk(download_path):
            for file in files:
                file_path = os.path.join(root, file)
                try:
                    total_size += os.path.getsize(file_path)
                except (OSError, FileNotFoundError) as e:
                    logger.warning(f"无法计算文件大小: {file_path} - {e}")
                    continue
        
        # 转换为GB
        size_gb = total_size / (1024 * 1024 * 1024)
        logger.info(f"视频库大小: {size_gb:.2f} GB")
        return size_gb
        
    except Exception as e:
        logger.error(f"计算视频库大小失败: {e}")
        return 0.0

def _check_storage_threshold(self) -> tuple[bool, float]:
    """
    检查存储空间是否超过阈值
    
    Returns:
        (是否超过阈值, 当前库大小GB)
    """
    try:
        # 获取存储阈值设置
        setting = self.db.query(Setting).filter(Setting.key == "auto_download.storage_threshold_gb").first()
        if not setting:
            logger.warning("未找到存储阈值设置，使用默认值20GB")
            threshold_gb = 20
        else:
            threshold_gb = int(setting.value)
        
        # 计算当前库大小
        current_size_gb = self._get_library_size_gb()
        
        # 检查是否超过阈值
        exceeds_threshold = current_size_gb >= threshold_gb
        
        logger.info(f"存储检查: 当前 {current_size_gb:.2f}GB, 阈值 {threshold_gb}GB, 超过: {exceeds_threshold}")
        
        return exceeds_threshold, current_size_gb
        
    except Exception as e:
        logger.error(f"检查存储阈值失败: {e}")
        return False, 0.0

def _should_auto_start_download(self) -> tuple[bool, str]:
    """
    检查是否应该自动开始下载
    
    Returns:
        (是否应该自动开始, 原因描述)
    """
    try:
        # 检查是否启用自动开始下载
        setting = self.db.query(Setting).filter(Setting.key == "auto_download.auto_start_after_scan").first()
        if not setting or setting.value.lower() != 'true':
            logger.info("自动开始下载未启用")
            return False, "自动开始下载未启用"
        
        # 检查存储空间
        exceeds_threshold, current_size = self._check_storage_threshold()
        if exceeds_threshold:
            reason = f"存储空间超过阈值 ({current_size:.2f}GB >= 阈值)"
            logger.info(reason)
            return False, reason
        
        logger.info("满足自动开始下载条件")
        return True, "满足条件"
        
    except Exception as e:
        logger.error(f"检查自动开始下载失败: {e}")
        return False, f"检查失败: {str(e)}"
```

---

## 配置和设置

### 自动下载配置结构

```typescript
interface AutoDownloadSettings {
  // 基本设置
  enabled: boolean                              // 是否启用自动下载
  trigger_type: 'interval' | 'cron'            // 触发方式
  scan_interval: number                        // 扫描间隔（分钟）
  cron_expression: string                      // Cron 表达式
  
  // 并发控制
  concurrent_limit: {
    video: number                               // 视频并发数
    page: number                                // 分页并发数
  }
  
  // 自定义扫描配置
  custom_scan: {
    enabled: boolean                            // 是否启用自定义扫描
    folder_list: FolderScanConfig[]            // 收藏夹扫描列表
  }
  
  // 稍后再看配置
  watch_later_max: number                       // 稍后再看最大扫描数
  
  // 下载触发控制
  auto_start_after_scan: boolean                // 扫描完成后自动开始下载
  storage_threshold_gb: number                  // 存储空间阈值（GB）
}

interface FolderScanConfig {
  folder_name: string                           // 收藏夹名称
  max_videos: number                            // 最大扫描视频数
}
```

### 配置项详解

#### 1. 基本设置

##### 启用自动下载

```typescript
enabled: boolean
```

- **默认值**: `false`
- **说明**: 控制自动下载功能的总开关
- **影响**: 
  - 关闭时，所有定时扫描任务停止
  - 不会影响手动扫描功能
- **注意**: 关闭后需要等待调度器检测到配置变化（最多5分钟）

##### 触发方式

```typescript
trigger_type: 'interval' | 'cron'
```

- **默认值**: `'interval'`
- **选项**:
  - `'interval'`: 按固定时间间隔扫描
  - `'cron'`: 按 Cron 表达式定时扫描
- **说明**: 选择不同的触发方式后，需要配置相应的参数

##### 扫描间隔

```typescript
scan_interval: number  // 单位：分钟
```

- **默认值**: `60` (1小时)
- **范围**: `15-1440`
- **常用值**:
  - `15` - 15分钟
  - `30` - 30分钟
  - `60` - 1小时
  - `120` - 2小时
  - `360` - 6小时
  - `720` - 12小时
  - `1440` - 24小时
- **注意**: 只在 `trigger_type = 'interval'` 时生效

##### Cron 表达式

```typescript
cron_expression: string
```

- **默认值**: `''` (空字符串)
- **格式**: 标准的 5 位 Cron 表达式
- **示例**:
  - `'0 * * * *'` - 每小时
  - `'0 */6 * * *'` - 每6小时
  - `'0 2 * * *'` - 每天凌晨2点
  - `'0 8 * * *'` - 每天早上8点
  - `'0 0 * * 0'` - 每周日0点
- **注意**: 只在 `trigger_type = 'cron'` 时生效

#### 2. 并发控制

##### 视频并发数

```typescript
concurrent_limit.video: number
```

- **默认值**: `3`
- **范围**: `1-5`
- **说明**: 同时下载的视频数量
- **影响**:
  - 过高可能导致网络拥塞
  - 过低会影响下载速度
- **建议**: 根据网络带宽调整

##### 分页并发数

```typescript
concurrent_limit.page: number
```

- **默认值**: `3`
- **范围**: `1-5`
- **说明**: 同时请求的 API 分页数量
- **影响**:
  - 影响扫描速度
  - 可能触发 B站 API 限流
- **建议**: 保持默认值

#### 3. 自定义扫描配置

##### 启用自定义扫描

```typescript
custom_scan.enabled: boolean
```

- **默认值**: `false`
- **说明**: 启用后，只扫描配置列表中的收藏夹
- **影响**:
  - 关闭时，扫描所有收藏夹
  - 开启时，扫描 `folder_list` 中指定的收藏夹

##### 收藏夹列表

```typescript
custom_scan.folder_list: FolderScanConfig[]
```

**配置结构**:

```typescript
interface FolderScanConfig {
  folder_name: string   // 收藏夹名称（必须与 B站收藏夹名称完全匹配）
  max_videos: number    // 最大扫描视频数（0表示不扫描）
}
```

**示例配置**:

```typescript
{
  enabled: true,
  folder_list: [
    {
      folder_name: "必看",
      max_videos: 50      // 扫描最近50个视频
    },
    {
      folder_name: "技术",
      max_videos: 20      // 扫描最近20个视频
    },
    {
      folder_name: "音乐",
      max_videos: 0       // 不扫描
    }
  ]
}
```

**使用场景**:
- 只关注特定收藏夹的更新
- 控制扫描数量，避免过多视频
- 根据收藏夹重要性设置不同的扫描数量

#### 4. 稍后再看配置

##### 稍后再看数量限制

```typescript
watch_later_max: number
```

- **默认值**: `0` (不扫描)
- **范围**: `0-999`
- **说明**: 限制稍后再看列表的扫描数量
- **示例**:
  - `0` - 不扫描稍后再看
  - `10` - 扫描最近10个视频
  - `50` - 扫描最近50个视频

#### 5. 下载触发控制

##### 扫描后自动开始下载

```typescript
auto_start_after_scan: boolean
```

- **默认值**: `false`
- **说明**: 扫描完成后是否自动开始下载新视频
- **影响**:
  - 开启后，扫描完成会立即开始下载
  - 关闭后，视频只添加到队列，需要手动开始
- **注意事项**:
  - 需要配合存储阈值使用
  - 确保有足够的存储空间

##### 存储空间阈值

```typescript
storage_threshold_gb: number  // 单位：GB
```

- **默认值**: `20` GB
- **范围**: `5-1024`
- **常用值**:
  - `10` - 10GB
  - `20` - 20GB (推荐)
  - `50` - 50GB
  - `100` - 100GB
  - `200` - 200GB
- **说明**: 
  - 当前视频库占用空间超过此值时，不会触发自动下载
  - 用于防止磁盘空间不足
- **计算方式**:
  ```python
  # 遍历下载路径，计算所有文件的总大小
  total_size = sum(file.size for file in all_files)
  size_gb = total_size / (1024 * 1024 * 1024)
  
  # 判断是否超过阈值
  if size_gb >= storage_threshold_gb:
      # 不触发自动下载
  ```

### 配置示例

#### 示例 1: 基础自动下载

```json
{
  "auto_download": {
    "enabled": true,
    "trigger_type": "interval",
    "scan_interval": 60,
    "cron_expression": "",
    "concurrent_limit": {
      "video": 3,
      "page": 3
    },
    "custom_scan": {
      "enabled": false,
      "folder_list": []
    },
    "watch_later_max": 0,
    "auto_start_after_scan": false,
    "storage_threshold_gb": 20
  }
}
```

**说明**: 每小时扫描所有收藏夹，新视频添加到队列但不自动下载。

#### 示例 2: 自定义收藏夹扫描

```json
{
  "auto_download": {
    "enabled": true,
    "trigger_type": "interval",
    "scan_interval": 120,
    "cron_expression": "",
    "concurrent_limit": {
      "video": 2,
      "page": 2
    },
    "custom_scan": {
      "enabled": true,
      "folder_list": [
        {
          "folder_name": "必看",
          "max_videos": 50
        },
        {
          "folder_name": "技术教程",
          "max_videos": 30
        }
      ]
    },
    "watch_later_max": 0,
    "auto_start_after_scan": true,
    "storage_threshold_gb": 50
  }
}
```

**说明**: 每2小时扫描特定收藏夹，自动开始下载。

#### 示例 3: Cron 定时扫描

```json
{
  "auto_download": {
    "enabled": true,
    "trigger_type": "cron",
    "scan_interval": 60,
    "cron_expression": "0 2 * * *",
    "concurrent_limit": {
      "video": 3,
      "page": 3
    },
    "custom_scan": {
      "enabled": false,
      "folder_list": []
    },
    "watch_later_max": 20,
    "auto_start_after_scan": true,
    "storage_threshold_gb": 30
  }
}
```

**说明**: 每天凌晨2点扫描所有收藏夹和稍后再看，自动开始下载。

### 配置管理 API

#### 获取设置

```bash
GET /api/settings
```

**响应**:

```json
{
  "success": true,
  "data": {
    "auto_download": {
      "enabled": true,
      "trigger_type": "interval",
      "scan_interval": 60,
      "cron_expression": "",
      "concurrent_limit": {
        "video": 3,
        "page": 3
      },
      "custom_scan": {
        "enabled": false,
        "folder_list": []
      },
      "watch_later_max": 0,
      "auto_start_after_scan": false,
      "storage_threshold_gb": 20
    }
  }
}
```

#### 更新设置

```bash
PUT /api/settings
Content-Type: application/json

{
  "auto_download": {
    "enabled": true,
    "trigger_type": "interval",
    "scan_interval": 30,
    "concurrent_limit": {
      "video": 2,
      "page": 2
    }
  }
}
```

**响应**:

```json
{
  "success": true,
  "data": {
    "auto_download": {
      "enabled": true,
      "trigger_type": "interval",
      "scan_interval": 30,
      "cron_expression": "",
      "concurrent_limit": {
        "video": 2,
        "page": 2
      },
      "custom_scan": {
        "enabled": false,
        "folder_list": []
      },
      "watch_later_max": 0,
      "auto_start_after_scan": false,
      "storage_threshold_gb": 20
    }
  }
}
```

#### 重置设置

```bash
POST /api/settings/reset?category=auto_download
```

**响应**:

```json
{
  "success": true,
  "data": {
    "auto_download": {
      "enabled": false,
      "trigger_type": "interval",
      "scan_interval": 60,
      "cron_expression": "",
      "concurrent_limit": {
        "video": 3,
        "page": 3
      },
      "custom_scan": {
        "enabled": false,
        "folder_list": []
      },
      "watch_later_max": 0,
      "auto_start_after_scan": false,
      "storage_threshold_gb": 20
    }
  }
}
```

---

## 数据流程

### 完整数据流程

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              自动化功能数据流程                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 阶段 1: 用户配置                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

用户在设置页面配置自动下载参数
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ AutoDownloadSettings.tsx                                                                    │
│ - 用户启用自动下载                                                                            │
│ - 选择触发方式（interval/cron）                                                              │
│ - 配置扫描间隔或 Cron 表达式                                                                 │
│ - 配置自定义扫描列表                                                                          │
│ - 配置稍后再看数量限制                                                                        │
│ - 配置自动开始下载和存储阈值                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PUT /api/settings                                                                            │
│ Body: { auto_download: { ... } }                                                            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ settings.py (Router)                                                                         │
│ - 接收设置更新请求                                                                            │
│ - 验证配置参数                                                                                │
│ - 保存到 Setting 表                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Setting 表                                                                                    │
│ key: "auto_download.enabled" → value: "true"                                                │
│ key: "auto_download.trigger_type" → value: "interval"                                       │
│ key: "auto_download.scan_interval" → value: "60"                                             │
│ key: "auto_download.storage_threshold_gb" → value: "20"                                      │
│ ...                                                                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 阶段 2: 定时调度                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

调度器每5分钟检查配置变化
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ SchedulerService.update_auto_scan_schedule()                                                │
│ - 读取最新配置                                                                                │
│ - 检查配置是否变化                                                                            │
│ - 更新定时任务                                                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ APScheduler                                                                                  │
│ - 如果配置变化，重新设置任务                                                                  │
│ - 等待触发条件满足                                                                            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
    ┌───┴───┐
    │ 触发  │
    └───┬───┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ SchedulerService.perform_auto_scan()                                                        │
│ - 执行自动扫描                                                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 阶段 3: 执行扫描                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

ScanService.trigger_scan()
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. 获取视频列表                                                                               │
│    - 从 User 表获取 SESSDATA                                                                  │
│    - 调用 BilibiliService 获取收藏夹列表                                                       │
│    - 应用自定义扫描配置                                                                        │
│    - 获取每个收藏夹的视频列表                                                                  │
│    - 应用视频数量限制                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. 识别新视频                                                                                 │
│    - 从 Setting 表获取上次扫描记录                                                            │
│    - 获取上次扫描的视频列表（BV号集合）                                                        │
│    - 比对当前视频列表与上次扫描列表                                                            │
│    - 标记新增的视频为新视频                                                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. 检查自动下载条件                                                                           │
│    - 检查 auto_start_after_scan 是否启用                                                      │
│    - 计算当前视频库大小                                                                        │
│    - 检查是否超过存储阈值                                                                      │
│    - 判断是否满足自动下载条件                                                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
    ┌───┴────────────────┐
    │ 满足条件？          │
    └───┬────────────────┘
        │
   ┌────▼────┐    ┌────────────────┐
   │  是     │    │      否         │
   └────┬────┘    └────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. 添加到下载队列                                                                             │
│    - 转换视频信息为 TaskCreate                                                                │
│    - 提交到 QueueManager                                                                     │
│    - 记录任务 ID                                                                               │
│    - 统计成功添加的数量                                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 5. 触发开始下载（如果满足条件）                                                               │
│    - 更新任务状态为 active                                                                    │
│    - 广播任务更新事件（WebSocket）                                                             │
│    - 创建异步任务执行下载                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 6. 保存扫描记录                                                                               │
│    - 生成记录 ID                                                                               │
│    - 保存扫描结果到 Setting 表                                                                 │
│      key: "auto_download.scan_records.favorite.{record_id}"                                   │
│    - 保存扫描到的视频列表（用于下次比对）                                                       │
│      key: "auto_download.scan_videos.{record_id}"                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 7. 返回扫描结果                                                                               │
│    - total: 总视频数                                                                          │
│    - new: 新视频数                                                                            │
│    - added: 已添加到队列数                                                                    │
│    - folders: 收藏夹详情（如果是收藏夹扫描）                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 阶段 4: 数据存储                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

Setting 表存储结构：
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ key                                          │ value (JSON)                                 │
├──────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ auto_download.enabled                       │ "true"                                       │
│ auto_download.trigger_type                   │ "interval"                                    │
│ auto_download.scan_interval                  │ "60"                                          │
│ auto_download.storage_threshold_gb           │ "20"                                          │
│ auto_download.custom_scan                    │ {"enabled": true, "folder_list": [...]}      │
│ auto_download.scan_records.favorite.{id}     │ {"id": "...", "source_type": "favorite", ...}│
│ auto_download.scan_videos.{id}               │ ["BV1xx411c7mD", "BV1yy411c7mE", ...]        │
└──────────────────────────────────────────────┴──────────────────────────────────────────────┘

Task 表存储结构：
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ id    │ media_type │ media_id │ title │ state │ meta (JSON)                              │
├───────┼────────────┼──────────┼───────┼───────┼──────────────────────────────────────────┤
│ 123   │ favorite   │ BV1xxx   │ 视频A │ 2     │ {"bvid": "BV1xxx", "folder_id": 123, ...}│
│ 124   │ favorite   │ BV1yyy   │ 视频B │ 2     │ {"bvid": "BV1yyy", "folder_id": 123, ...}│
└───────┴────────────┴──────────┴───────┴───────┴──────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ 阶段 5: 前端显示                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

scanStore 获取扫描记录
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ GET /api/auto-download/scan-records                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ auto_download.py (Router)                                                                   │
│ - 从 Setting 表查询扫描记录                                                                   │
│ - 解析 JSON 数据                                                                             │
│ - 返回记录列表                                                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ ScanResultContent.tsx                                                                        │
│ - 显示扫描记录列表                                                                            │
│ - 显示最后扫描结果                                                                            │
│ - 提供删除和清空操作                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 数据流关键节点

#### 1. 配置保存

```python
# routers/settings.py
@router.put("/", response_model=dict)
async def update_settings(
    updates: dict,
    db: Session = Depends(get_db)
):
    """更新设置"""
    try:
        settings_service = SettingsService(db)
        result = await settings_service.update_settings(updates)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### 2. 配置读取

```python
# services/scheduler_service.py
def update_auto_scan_schedule(self):
    """更新自动扫描配置"""
    with SessionLocal() as db:
        settings_service = SettingsService(db)
        settings = settings_service.get_settings()
        auto_download = getattr(settings, 'auto_download', None)
        
        if auto_download:
            # 读取配置
            enabled = auto_download.enabled
            trigger_type = auto_download.trigger_type
            scan_interval = auto_download.scan_interval
            cron_expression = auto_download.cron_expression
            
            # 更新任务
            if enabled:
                if trigger_type == 'interval':
                    self._schedule_interval_scan(scan_interval)
                elif trigger_type == 'cron':
                    self._schedule_cron_scan(cron_expression)
```

#### 3. 扫描记录保存

```python
# services/scan_service.py
async def _save_scan_record(
    self,
    source_type: str,
    source_id: str,
    total_videos: int,
    new_videos: int,
    added_to_queue: int
):
    """保存扫描记录"""
    record_id = str(uuid.uuid4())
    now = datetime.now()
    
    # 保存扫描记录
    record_data = {
        "id": record_id,
        "source_type": source_type,
        "source_id": source_id,
        "last_scan_time": now.isoformat(),
        "total_videos": total_videos,
        "new_videos": new_videos,
        "added_to_queue": added_to_queue,
        "status": "success"
    }
    
    setting_key = f"auto_download.scan_records.{source_type}.{record_id}"
    setting = Setting(
        key=setting_key,
        value=json.dumps(record_data),
        type="json",
        category="auto_download",
        description=f"Scan record for {source_type}/{source_id}",
        created_at=now,
        updated_at=now
    )
    self.db.add(setting)
    self.db.commit()
```

#### 4. 扫描记录读取

```python
# services/scan_service.py
async def get_scan_records(self, source_type: Optional[str] = None) -> List[ScanRecord]:
    """获取扫描记录"""
    # 从 Setting 表读取扫描记录
    base_key = f"auto_download.scan_records"
    if source_type:
        base_key = f"{base_key}.{source_type}"
    
    settings = self.db.query(Setting).filter(Setting.key.like(f"{base_key}%")).all()
    
    records = []
    for setting in settings:
        try:
            record_data = json.loads(setting.value)
            record_data['created_at'] = setting.created_at
            records.append(ScanRecord(**record_data))
        except Exception as e:
            logger.error(f"Failed to parse scan record {setting.key}: {e}")
    
    # 按扫描时间倒序排序
    records.sort(key=lambda x: x.last_scan_time, reverse=True)
    
    return records
```

---

## 用户界面

### 自动下载设置页面

#### 页面结构

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           自动下载设置 (AutoDownloadSettings)                                │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ 自动下载                          [启用]                                              │   │
│  │ 定时扫描并下载                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ 触发方式                                                                             │   │
│  │ 定时扫描的执行方式                                                                 │   │
│  │                                                                                       │   │
│  │ 🕐 触发方式          [间隔执行 ▼]                                                    │   │
│  │ 🕐 扫描间隔 (分钟)   [60 ▼]                                                         │   │
│  │ └─ 15分钟, 30分钟, 1小时, 2小时, 6小时, 12小时, 24小时                                │   │
│  │                                                                                       │   │
│  │ 🕐 触发方式          [间隔执行 ▼]                                                    │   │
│  │ # Cron 表达式       [0 2 * * *            ]                                          │   │
│  │ └─ 例：0 0 * * * 表示每天 0 点                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ 并发限制                                                                             │   │
│  │ 控制同时下载的任务数                                                                 │   │
│  │                                                                                       │   │
│  │ ⚡ 视频并发数         [3 ▼]                                                           │   │
│  │ ⚡ 分页并发数         [3 ▼]                                                           │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ 自定义扫描列表                      [刷新列表] [启用]                                │   │
│  │                                                                                       │   │
│  │ ┌─────────────────────────────────────────────────────────────────────────────┐     │   │
│  │ │ 💡 视频数为 0 表示不扫描该收藏夹，设置大于 0 的数值后才进行扫描              │     │   │
│  │ └─────────────────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                                       │   │
│  │ ┌─────────────────────┬──────────┐                                                  │   │
│  │ │ 收藏夹名称          │ 视频数   │                                                  │   │
│  │ ├─────────────────────┼──────────┤                                                  │   │
│  │ │ 必看                │ 50       │                                                  │   │
│  │ │ 技术教程            │ 30       │                                                  │   │
│  │ │ 音乐                │ 0        │                                                  │   │
│  │ └─────────────────────┴──────────┘                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ 稍后再看数量设置                                                                     │   │
│  │                                                                                       │   │
│  │ ┌─────────────────────┬──────────┐                                                  │   │
│  │ │ 稍后再看            │ 视频数   │                                                  │   │
│  │ ├─────────────────────┼──────────┤                                                  │   │
│  │ │ 稍后再看列表        │ 10       │                                                  │   │
│  │ └─────────────────────┴──────────┘                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ 下载触发控制                                                                         │   │
│  │ 控制扫描后是否自动开始下载及存储空间限制                                             │   │
│  │                                                                                       │   │
│  │ ⚡ 扫描后自动开始下载  [启用]                                                         │   │
│  │    └─ 开启后，扫描完成会自动开始下载新视频                                           │   │
│  │                                                                                       │   │
│  │ # 存储空间阈值 (GB)  [20 ▼]                                                          │   │
│  │    └─ 超过此值时不触发自动下载，避免空间不足                                        │   │
│  │                                                                                       │   │
│  │ ┌─────────────────────────────────────────────────────────────────────────────┐     │   │
│  │ │ 💡 工作流程说明：                                                          │     │   │
│  │ │ 1. 当"扫描后自动开始下载"开启时，扫描完成后会自动触发下载                     │     │   │
│  │ │ 2. 触发下载前会检查当前视频库占用空间                                         │     │   │
│  │ │ 3. 如果占用空间超过设定的阈值，则不会触发下载，避免磁盘空间不足               │     │   │
│  │ │ 4. 即使自动下载被禁用，你也可以手动选择扫描结果进行下载                       │     │   │
│  │ └─────────────────────────────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  [ 🔄 重置自动下载设置 ]                                                                    │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 关键交互

1. **启用自动下载**
   - 切换开关后，需要等待调度器检测（最多5分钟）
   - 可以通过查看日志确认任务是否启动

2. **切换触发方式**
   - 切换到 `interval` 时，需要选择扫描间隔
   - 切换到 `cron` 时，需要输入 Cron 表达式

3. **自定义扫描列表**
   - 点击"刷新列表"按钮获取收藏夹列表
   - 修改"视频数"配置，0 表示不扫描
   - 点击"启用"开关激活自定义扫描

4. **稍后再看设置**
   - 输入数字控制扫描数量
   - 0 表示不扫描稍后再看

5. **存储阈值设置**
   - 选择合适的阈值，避免磁盘空间不足
   - 建议根据磁盘大小和视频数量调整

### 扫描结果页面

#### 页面结构

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           扫描结果 (ScanResultContent)                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ [❤️ 扫描收藏夹]  [🕐 扫描稍后再看]  [🔄 刷新记录]                                      │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ 扫描结果                                                                               │   │
│  │                                                                                       │   │
│  │ ┌─────────────────────────────────────────────────────────────────────────────┐     │   │
│  │ │ 收藏夹详情                                                                  │     │   │
│  │ │ ┌─────────────────────────────────────────────────────────────────────┐   │     │   │
│  │ │ │ ❤️ 必看                                    │   │     │   │
│  │ │ │ ┌──────────────┬──────────────┬──────────────┐                     │   │     │   │
│  │ │ │ │ 视频数       │ 新视频       │ 总计         │                     │   │     │   │
│  │ │ │ │ 50           │ 5            │ 120          │                     │   │     │   │
│  │ │ │ └──────────────┴──────────────┴──────────────┘                     │   │     │   │
│  │ │ └─────────────────────────────────────────────────────────────────────┘   │     │   │
│  │ │                                                                             │     │   │
│  │ │ ┌─────────────────────────────────────────────────────────────────────┐   │     │   │
│  │ │ │ ❤️ 技术教程                                │   │     │   │
│  │ │ │ ┌──────────────┬──────────────┬──────────────┐                     │   │     │   │
│  │ │ │ │ 视频数       │ 新视频       │ 总计         │                     │   │     │   │
│  │ │ │ │ 30           │ 2            │ 80           │                     │   │     │   │
│  │ │ │ └──────────────┴──────────────┴──────────────┘                     │   │     │   │
│  │ │ └─────────────────────────────────────────────────────────────────────┘   │     │   │
│  │ └─────────────────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                                       │   │
│  │ ┌──────────────┬──────────────┬──────────────┐                                        │   │
│  │ │ 总视频数     │ 新视频       │ 已添加       │                                        │   │
│  │ │ 80           │ 7            │ 7            │                                        │   │
│  │ └──────────────┴──────────────┴──────────────┘                                        │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐   │
│  │ 扫描记录                                   [保留30天 ▼] [🗑️ 清空记录]                      │   │
│  │                                                                                       │   │
│  │ ┌─────────────────────────────────────────────────────────────────────────────┐     │   │
│  │ │ ❤️ 收藏夹                                    ✓                          [🗑️] │     │   │
│  │ │ ┌──────────────┬──────────────┬──────────────┐                          │     │     │   │
│  │ │ │ 总视频数     │ 新视频       │ 已添加       │                          │     │     │   │
│  │ │ │ 80           │ 7            │ 7            │                          │     │     │   │
│  │ │ └──────────────┴──────────────┴──────────────┘                          │     │     │   │
│  │ │ 5分钟前                                                                   │     │     │   │
│  │ └─────────────────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                                       │   │
│  │ ┌─────────────────────────────────────────────────────────────────────────────┐     │   │
│  │ │ 🕐 稍后再看                                ✓                          [🗑️] │     │   │
│  │ │ ┌──────────────┬──────────────┬──────────────┐                          │     │     │   │
│  │ │ │ 总视频数     │ 新视频       │ 已添加       │                          │     │     │   │
│  │ │ │ 10           │ 3            │ 3            │                          │     │     │   │
│  │ │ └──────────────┴──────────────┴──────────────┘                          │     │     │   │
│  │ │ 1小时前                                                                  │     │     │   │
│  │ └─────────────────────────────────────────────────────────────────────────────┘     │   │
│  │                                                                                       │   │
│  │ ┌─────────────────────────────────────────────────────────────────────────────┐     │   │
│  │ │ ❤️ 收藏夹                                    ✓                          [🗑️] │     │   │
│  │ │ ┌──────────────┬──────────────┬──────────────┐                          │     │     │   │
│  │ │ │ 总视频数     │ 新视频       │ 已添加       │                          │     │     │   │
│  │ │ │ 75           │ 0            │ 0            │                          │     │     │   │
│  │ │ └──────────────┴──────────────┴──────────────┘                          │     │     │   │
│  │ │ 3小时前                                                                  │     │     │   │
│  │ └─────────────────────────────────────────────────────────────────────────────┘     │   │
│  └─────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### 关键交互

1. **触发扫描**
   - 点击"扫描收藏夹"或"扫描稍后再看"按钮
   - 扫描过程中显示动画效果
   - 扫描完成后显示结果

2. **查看结果**
   - 显示每个收藏夹的扫描结果
   - 统计总视频数、新视频数、已添加数
   - 显示相对时间（如"5分钟前"）

3. **管理记录**
   - 选择保留时间（7天、30天、90天、180天或不限制）
   - 删除单条记录
   - 清空所有记录

4. **刷新记录**
   - 点击"刷新记录"按钮重新获取记录列表
   - 适用于多设备同步或记录更新

### 状态管理

#### scanStore 结构

```typescript
interface ScanState {
  // 状态
  loading: boolean              // 加载中
  scanning: boolean             // 扫描中
  scanRecords: ScanRecord[]     // 扫描记录列表
  lastScanResult: ScanTriggerResponse | null  // 最后扫描结果
  error: string | null          // 错误信息

  // Actions
  fetchScanRecords: (sourceType?: string) => Promise<void>
  triggerScan: (sourceType: string, sourceId?: string) => Promise<void>
  deleteScanRecord: (recordId: string) => Promise<void>
  clearScanRecords: (sourceType?: string, days?: number) => Promise<void>
  clearError: () => void
}
```

#### 使用示例

```typescript
// 获取扫描记录
const { fetchScanRecords, scanRecords } = useScanStore()
await fetchScanRecords('favorite')

// 触发扫描
const { triggerScan, lastScanResult } = useScanStore()
await triggerScan('favorite', 'all')

// 删除记录
const { deleteScanRecord } = useScanStore()
await deleteScanRecord('record-id-123')

// 清空记录
const { clearScanRecords } = useScanStore()
await clearScanRecords('favorite', 30)  // 清空30天前的收藏夹记录
```

---

## 性能优化

### 扫描性能优化

#### 1. 批量请求

```python
# services/scan_service.py
async def _fetch_videos(
    self,
    source_type: str,
    source_id: str,
    sessdata: str,
    user_mid: int = None
) -> tuple[List[ScanVideoInfo], List[Dict]]:
    """获取视频列表和收藏夹信息"""
    
    # 使用并发请求获取多个收藏夹的视频
    if source_type == "favorite":
        service = BilibiliService()
        try:
            # 获取收藏夹列表
            result = await service.get_folder_list(decoded_sessdata, user_mid, 1, 50)
            
            if result["success"]:
                folders = result["data"].get("list", [])
                
                # 应用自定义扫描配置
                if custom_scan_config['enabled']:
                    folders = self._filter_folders(folders, custom_scan_config)
                
                # 并发获取每个收藏夹的视频
                import asyncio
                tasks = []
                for folder in folders:
                    if source_id == "all" or str(folder.get("id")) == source_id:
                        task = service.get_folder_detail(
                            decoded_sessdata,
                            folder.get("id"),
                            1,
                            page_size
                        )
                        tasks.append((task, folder))
                
                # 等待所有请求完成
                results = await asyncio.gather(*[t[0] for t in tasks], return_exceptions=True)
                
                # 处理结果
                videos = []
                folder_infos = []
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        logger.error(f"获取收藏夹失败: {result}")
                        continue
                    
                    folder = tasks[i][1]
                    media_list = result.get("data", {}).get("medias", [])
                    transformed_videos = self._transform_to_scan_videos(media_list, folder.get("id"))
                    videos.extend(transformed_videos)
                    
                    # 收藏夹信息
                    folder_info = FolderScanInfo(
                        id=folder.get("id"),
                        title=folder.get("title"),
                        video_count=len(transformed_videos),
                        new_count=0,
                        media_count=result.get("data", {}).get("info", {}).get("media_count", 0)
                    )
                    folder_infos.append(folder_info)
                
                return videos, folder_infos
```

#### 2. 缓存优化

```python
# 使用内存缓存减少重复请求
from functools import lru_cache

class ScanService:
    def __init__(self, db: Session):
        self.db = db
        self._cache = {}
    
    async def _fetch_videos_with_cache(
        self,
        source_type: str,
        source_id: str,
        sessdata: str,
        user_mid: int = None
    ) -> tuple[List[ScanVideoInfo], List[Dict]]:
        """带缓存的获取视频列表"""
        cache_key = f"{source_type}_{source_id}_{user_mid}"
        
        # 检查缓存（5分钟内有效）
        if cache_key in self._cache:
            cached_data, cached_time = self._cache[cache_key]
            if datetime.now() - cached_time < timedelta(minutes=5):
                logger.info(f"使用缓存数据: {cache_key}")
                return cached_data
        
        # 获取新数据
        videos, folder_infos = await self._fetch_videos(
            source_type, source_id, sessdata, user_mid
        )
        
        # 缓存结果
        self._cache[cache_key] = (videos, folder_infos), datetime.now()
        
        return videos, folder_infos
```

#### 3. 分页优化

```python
# 控制单次请求的视频数量
async def _fetch_videos(
    self,
    source_type: str,
    source_id: str,
    sessdata: str,
    user_mid: int = None
) -> tuple[List[ScanVideoInfo], List[Dict]]:
    """获取视频列表和收藏夹信息"""
    
    # 使用配置限制分页大小
    page_size = 20
    if custom_scan_config['enabled'] and 'max_videos' in folder:
        max_videos = folder['max_videos']
        page_size = min(max_videos, 20)
    
    # 只请求需要的页数
    result = await service.get_folder_detail(
        decoded_sessdata,
        folder.get("id"),
        1,  # 只请求第一页
        page_size
    )
    
    media_list = result["data"].get("medias", [])
    
    # 应用视频数量限制
    if custom_scan_config['enabled'] and 'max_videos' in folder:
        max_videos = folder['max_videos']
        if max_videos and max_videos < len(media_list):
            media_list = media_list[:max_videos]
```

#### 4. 数据库优化

```python
# 使用索引加速查询
# models/setting.py
class Setting(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), index=True)  # 为 key 字段添加索引
    value = Column(Text)
    type = Column(String(50))
    category = Column(String(50), index=True)  # 为 category 字段添加索引
    created_at = Column(DateTime, index=True)  # 为 created_at 字段添加索引
    updated_at = Column(DateTime)

# 扫描记录查询优化
async def get_scan_records(self, source_type: Optional[str] = None) -> List[ScanRecord]:
    """获取扫描记录"""
    # 使用索引加速查询
    base_key = f"auto_download.scan_records"
    if source_type:
        base_key = f"{base_key}.{source_type}"
    
    # 只查询需要的字段
    settings = self.db.query(Setting).filter(
        Setting.key.like(f"{base_key}%")
    ).options(
        load_only(Setting.key, Setting.value, Setting.created_at)
    ).all()
    
    records = []
    for setting in settings:
        try:
            record_data = json.loads(setting.value)
            record_data['created_at'] = setting.created_at
            records.append(ScanRecord(**record_data))
        except Exception as e:
            logger.error(f"Failed to parse scan record {setting.key}: {e}")
    
    # 按扫描时间倒序排序
    records.sort(key=lambda x: x.last_scan_time, reverse=True)
    
    return records
```

### 调度器性能优化

#### 1. 配置缓存

```python
# services/scheduler_service.py
class SchedulerService:
    def __init__(self):
        self.scheduler: Optional[BackgroundScheduler] = None
        self.auto_scan_job_id = 'auto_scan'
        # 缓存当前配置，避免频繁重置
        self._current_config = {
            'enabled': False,
            'trigger_type': None,
            'scan_interval': None,
            'cron_expression': None
        }
        self._config_cache_time = None
    
    def update_auto_scan_schedule(self):
        """更新自动扫描的定时任务配置"""
        # 检查配置是否改变
        if new_config == self._current_config:
            logger.debug("[Scheduler] 自动扫描配置未改变，跳过更新")
            return
        
        # 配置改变了，更新任务
        logger.info(f"[Scheduler] 自动扫描配置已改变: {self._current_config} -> {new_config}")
        self._current_config = new_config
        self._config_cache_time = datetime.now()
        
        # 更新任务...
```

#### 2. 错误重试

```python
# 添加错误重试机制
async def perform_auto_scan(self):
    """执行自动扫描"""
    max_retries = 3
    retry_delay = 60  # 秒
    
    for attempt in range(max_retries):
        try:
            logger.info(f"[Scheduler] 开始执行自动扫描 (尝试 {attempt + 1}/{max_retries})...")
            
            # 执行扫描...
            
            logger.info("[Scheduler] 自动扫描完成")
            break  # 成功则退出循环
            
        except Exception as e:
            logger.error(f"[Scheduler] 执行自动扫描失败 (尝试 {attempt + 1}/{max_retries}): {str(e)}")
            
            if attempt < max_retries - 1:
                logger.info(f"[Scheduler] {retry_delay} 秒后重试...")
                await asyncio.sleep(retry_delay)
                retry_delay *= 2  # 指数退避
            else:
                logger.error("[Scheduler] 达到最大重试次数，放弃扫描")
```

### 存储优化

#### 1. 扫描记录清理

```python
# 定期清理旧记录
async def clear_scan_records(self, source_type: Optional[str] = None, days: Optional[int] = None) -> int:
    """清除扫描记录"""
    try:
        query = self.db.query(Setting).filter(
            Setting.key.like("auto_download.scan_records.%")
        )
        
        if source_type:
            query = query.filter(Setting.key.like(f"auto_download.scan_records.{source_type}%"))
        
        if days is not None:
            from datetime import timedelta
            cutoff_time = datetime.utcnow() - timedelta(days=days)
            query = query.filter(Setting.created_at < cutoff_time)
        
        deleted_count = query.count()
        query.delete()
        self.db.commit()
        
        logger.info(f"Cleared {deleted_count} scan records (source_type={source_type}, days={days})")
        return deleted_count
    except Exception as e:
        self.db.rollback()
        logger.error(f"Failed to clear scan records: {e}")
        return 0
```

#### 2. 视频列表压缩

```python
# 压缩存储的视频列表
import zlib

async def _save_scan_record(
    self,
    source_type: str,
    source_id: str,
    total_videos: int,
    new_videos: int,
    added_to_queue: int,
    videos: List[ScanVideoInfo]  # 添加视频列表
):
    """保存扫描记录"""
    record_id = str(uuid.uuid4())
    now = datetime.now()
    
    # 保存扫描记录
    record_data = {
        "id": record_id,
        "source_type": source_type,
        "source_id": source_id,
        "last_scan_time": now.isoformat(),
        "total_videos": total_videos,
        "new_videos": new_videos,
        "added_to_queue": added_to_queue,
        "status": "success"
    }
    
    # 保存视频列表（压缩）
    bvids = [video.bvid for video in videos]
    bvids_json = json.dumps(bvids)
    bvids_compressed = zlib.compress(bvids_json.encode('utf-8'))
    bvids_base64 = base64.b64encode(bvids_compressed).decode('utf-8')
    
    # 保存到数据库
    setting_key = f"auto_download.scan_records.{source_type}.{record_id}"
    setting = Setting(
        key=setting_key,
        value=json.dumps(record_data),
        type="json",
        category="auto_download",
        created_at=now,
        updated_at=now
    )
    self.db.add(setting)
    
    # 保存视频列表
    videos_key = f"auto_download.scan_videos.{record_id}"
    videos_setting = Setting(
        key=videos_key,
        value=bvids_base64,
        type="compressed",
        category="auto_download",
        created_at=now,
        updated_at=now
    )
    self.db.add(videos_setting)
    
    self.db.commit()
```

---

## 错误处理

### 常见错误类型

#### 1. 认证错误

**错误描述**: SESSDATA 过期或无效

**错误信息**:
```
[ScanService] 获取收藏夹列表失败: SESSDATA 已过期
[Scheduler] Cookie 刷新失败: 无法获取用户信息
```

**处理方法**:

```python
# services/scan_service.py
async def _fetch_videos(
    self,
    source_type: str,
    source_id: str,
    sessdata: str,
    user_mid: int = None
) -> tuple[List[ScanVideoInfo], List[Dict]]:
    """获取视频列表和收藏夹信息"""
    
    # 获取用户信息
    user = self.db.query(User).filter(User.mid == user_mid).first()
    if not user:
        logger.error(f"未找到MID={user_mid}的用户")
        raise ValueError(f"用户不存在: {user_mid}")
    
    # 检查 SESSDATA 是否有效
    if not user.sessdata:
        logger.error(f"用户 {user.username} 的 SESSDATA 为空")
        raise ValueError("SESSDATA 为空，请重新登录")
    
    # 尝试刷新 Cookie
    try:
        service = BilibiliService()
        refresh_result = await service.refresh_cookie()
        if not refresh_result.get("success"):
            logger.error(f"Cookie 刷新失败: {refresh_result.get('message')}")
            raise ValueError("SESSDATA 已过期，请重新登录")
    except Exception as e:
        logger.error(f"Cookie 刷新异常: {e}")
        raise ValueError("SESSDATA 验证失败，请重新登录")
```

#### 2. 网络错误

**错误描述**: 网络连接失败或超时

**错误信息**:
```
[ScanService] 获取收藏夹列表失败: 连接超时
[Scheduler] 扫描失败: 网络不可达
```

**处理方法**:

```python
# 添加重试机制
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
async def _fetch_videos_with_retry(
    self,
    source_type: str,
    source_id: str,
    sessdata: str,
    user_mid: int = None
) -> tuple[List[ScanVideoInfo], List[Dict]]:
    """带重试的获取视频列表"""
    try:
        return await self._fetch_videos(source_type, source_id, sessdata, user_mid)
    except Exception as e:
        logger.error(f"获取视频列表失败: {e}")
        raise
```

#### 3. API 限流

**错误描述**: 请求过于频繁，触发 B站 API 限流

**错误信息**:
```
[ScanService] 获取收藏夹列表失败: 请求过于频繁，请稍后再试
[Scheduler] 扫描失败: 429 Too Many Requests
```

**处理方法**:

```python
# 添加限流控制
import time
from functools import wraps

def rate_limit(max_calls=10, period=60):
    """限流装饰器"""
    def decorator(func):
        calls = []
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            now = time.time()
            # 移除过期记录
            calls[:] = [c for c in calls if c > now - period]
            
            # 检查是否超过限制
            if len(calls) >= max_calls:
                wait_time = calls[0] + period - now
                logger.warning(f"达到限流限制，等待 {wait_time:.2f} 秒")
                await asyncio.sleep(wait_time)
            
            # 记录调用
            calls.append(now)
            
            # 执行函数
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator

class ScanService:
    @rate_limit(max_calls=10, period=60)
    async def _fetch_videos(
        self,
        source_type: str,
        source_id: str,
        sessdata: str,
        user_mid: int = None
    ) -> tuple[List[ScanVideoInfo], List[Dict]]:
        """获取视频列表和收藏夹信息"""
        # ...
```

#### 4. 存储空间不足

**错误描述**: 磁盘空间不足，无法下载

**错误信息**:
```
[ScanService] 存储空间超过阈值 (25.50GB >= 20GB)
[Scheduler] 不触发自动下载: 存储空间不足
```

**处理方法**:

```python
# 提供清理建议
def _check_storage_threshold(self) -> tuple[bool, float]:
    """检查存储空间是否超过阈值"""
    try:
        setting = self.db.query(Setting).filter(
            Setting.key == "auto_download.storage_threshold_gb"
        ).first()
        threshold_gb = int(setting.value) if setting else 20
        
        current_size_gb = self._get_library_size_gb()
        exceeds_threshold = current_size_gb >= threshold_gb
        
        logger.info(f"存储检查: 当前 {current_size_gb:.2f}GB, 阈值 {threshold_gb}GB, 超过: {exceeds_threshold}")
        
        if exceeds_threshold:
            logger.warning(f"⚠️ 存储空间不足！当前 {current_size_gb:.2f}GB，建议清理旧视频或增加阈值")
        
        return exceeds_threshold, current_size_gb
        
    except Exception as e:
        logger.error(f"检查存储阈值失败: {e}")
        return False, 0.0
```

#### 5. 数据库错误

**错误描述**: 数据库连接失败或查询错误

**错误信息**:
```
[ScanService] 保存扫描记录失败: 数据库连接超时
[Scheduler] 获取配置失败: 表 'settings' 不存在
```

**处理方法**:

```python
# 添加数据库重试和连接池
from sqlalchemy.pool import QueuePool

# 配置连接池
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=3600
)

# 添加重试机制
async def _save_scan_record_with_retry(
    self,
    source_type: str,
    source_id: str,
    total_videos: int,
    new_videos: int,
    added_to_queue: int
):
    """带重试的保存扫描记录"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            await self._save_scan_record(
                source_type, source_id, total_videos, new_videos, added_to_queue
            )
            break
        except Exception as e:
            logger.error(f"保存扫描记录失败 (尝试 {attempt + 1}/{max_retries}): {e}")
            
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
            else:
                # 记录到日志文件
                logger.error(f"保存扫描记录失败，已达到最大重试次数")
                # 保存到本地文件作为备份
                self._save_to_local_file(source_type, source_id, total_videos, new_videos, added_to_queue)
```

### 错误恢复

#### 1. 自动恢复

```python
# services/scheduler_service.py
async def perform_auto_scan(self):
    """执行自动扫描"""
    try:
        logger.info("[Scheduler] 开始执行自动扫描...")
        
        # 执行扫描...
        
        logger.info("[Scheduler] 自动扫描完成")
        
    except ValueError as e:
        # 认证错误，跳过本次扫描
        logger.warning(f"[Scheduler] 认证错误，跳过扫描: {e}")
        # 发送通知用户重新登录
        
    except ConnectionError as e:
        # 网络错误，等待下次重试
        logger.warning(f"[Scheduler] 网络错误，跳过扫描: {e}")
        
    except Exception as e:
        # 其他错误，记录日志
        logger.error(f"[Scheduler] 执行自动扫描失败: {e}")
        # 发送错误通知
```

#### 2. 用户通知

```python
# 添加错误通知
async def perform_auto_scan(self):
    """执行自动扫描"""
    try:
        # 执行扫描...
        
    except Exception as e:
        logger.error(f"[Scheduler] 执行自动扫描失败: {e}")
        
        # 发送错误通知
        error_message = f"自动扫描失败: {str(e)}"
        await self._send_error_notification(error_message)

async def _send_error_notification(self, message: str):
    """发送错误通知"""
    # 通过 WebSocket 广播错误
    from src.routers.websocket import broadcast_message
    
    notification = {
        "type": "error",
        "message": message,
        "timestamp": datetime.now().isoformat()
    }
    
    await broadcast_message("error", notification)
```

### 错误日志

```python
# 配置详细的错误日志
import logging

# 创建日志格式
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=log_format)

# 创建文件处理器
file_handler = logging.FileHandler('logs/scan_service.log')
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(logging.Formatter(log_format))

# 添加到 logger
logger = logging.getLogger(__name__)
logger.addHandler(file_handler)

# 记录详细的错误信息
try:
    await self._fetch_videos(source_type, source_id, sessdata, user_mid)
except Exception as e:
    logger.error(f"获取视频列表失败", exc_info=True)
    logger.error(f"错误详情: {type(e).__name__}: {str(e)}")
    logger.error(f"参数: source_type={source_type}, source_id={source_id}, user_mid={user_mid}")
```

---

## 最佳实践

### 配置建议

#### 1. 触发方式选择

| 场景 | 推荐方式 | 配置示例 |
|------|----------|----------|
| 持续监控 | 间隔触发 | `interval: 30` (30分钟) |
| 定时备份 | Cron 触发 | `cron: 0 2 * * *` (每天凌晨2点) |
| 工作时间监控 | Cron 触发 | `cron: 0 */4 9-18 * *` (工作时间每4小时) |
| 低频检查 | 间隔触发 | `interval: 360` (6小时) |

#### 2. 并发设置

| 网络带宽 | 视频并发 | 分页并发 |
|----------|----------|----------|
| 低速 (<10Mbps) | 1 | 2 |
| 中速 (10-50Mbps) | 2 | 3 |
| 高速 (>50Mbps) | 3-5 | 3 |

#### 3. 存储阈值设置

| 磁盘大小 | 推荐阈值 | 说明 |
|----------|----------|------|
| 256GB | 50GB | 保留足够空间 |
| 512GB | 100GB | 保留约20%空间 |
| 1TB | 200GB | 保留约20%空间 |
| 2TB+ | 500GB | 保留约25%空间 |

#### 4. 自定义扫描配置

**示例 1: 优先级扫描**

```json
{
  "custom_scan": {
    "enabled": true,
    "folder_list": [
      {
        "folder_name": "必看",
        "max_videos": 100
      },
      {
        "folder_name": "教程",
        "max_videos": 50
      },
      {
        "folder_name": "娱乐",
        "max_videos": 20
      }
    ]
  }
}
```

**示例 2: 最新视频扫描**

```json
{
  "custom_scan": {
    "enabled": true,
    "folder_list": [
      {
        "folder_name": "技术",
        "max_videos": 10
      },
      {
        "folder_name": "音乐",
        "max_videos": 10
      }
    ]
  }
}
```

### 使用建议

#### 1. 初次使用

1. **禁用自动下载**
   - 先手动扫描几次，了解系统工作原理
   - 确认网络连接和存储空间正常

2. **测试手动扫描**
   - 点击"扫描收藏夹"按钮
   - 查看扫描结果
   - 检查是否有新视频被识别

3. **配置自定义扫描**
   - 刷新收藏夹列表
   - 设置每个收藏夹的扫描数量
   - 启用自定义扫描

4. **启用自动下载**
   - 设置合理的扫描间隔（建议1-2小时）
   - 关闭自动开始下载
   - 观察几次扫描结果

5. **启用自动开始下载**
   - 设置存储阈值
   - 启用自动开始下载
   - 监控下载队列

#### 2. 日常使用

1. **定期检查扫描记录**
   - 查看扫描是否正常执行
   - 检查新视频数量
   - 确认下载任务状态

2. **清理旧记录**
   - 设置合理的保留时间（建议30天）
   - 定期清空记录，避免数据库膨胀

3. **调整扫描策略**
   - 根据收藏夹更新频率调整扫描间隔
   - 根据存储空间调整扫描数量
   - 根据网络带宽调整并发数

4. **监控存储空间**
   - 定期检查磁盘使用情况
   - 及时清理旧视频
   - 调整存储阈值

#### 3. 故障排除

1. **扫描失败**
   - 检查 SESSDATA 是否过期
   - 检查网络连接
   - 查看错误日志

2. **没有新视频**
   - 检查上次扫描记录
   - 确认收藏夹是否有更新
   - 检查自定义扫描配置

3. **自动下载未触发**
   - 检查自动开始下载开关
   - 检查存储空间是否超过阈值
   - 查看调度器日志

4. **磁盘空间不足**
   - 清理旧视频
   - 增加存储阈值
   - 减少扫描数量

### 性能优化建议

#### 1. 扫描优化

- **使用自定义扫描**: 只扫描需要的收藏夹
- **限制扫描数量**: 每个收藏夹最多扫描50个视频
- **合理设置间隔**: 避免过于频繁的扫描
- **并发控制**: 不要设置过高的并发数

#### 2. 存储优化

- **定期清理**: 设置合理的记录保留时间
- **压缩存储**: 启用视频列表压缩
- **索引优化**: 为数据库表添加索引

#### 3. 网络优化

- **限流控制**: 避免触发 API 限流
- **重试机制**: 设置合理的重试次数
- **连接池**: 使用数据库连接池

### 安全建议

#### 1. 认证安全

- **定期刷新 Cookie**: 调度器会自动刷新
- **监控过期时间**: 提前7天提醒用户
- **多账号支持**: 使用活跃用户的 SESSDATA

#### 2. 数据安全

- **定期备份**: 备份配置和扫描记录
- **加密存储**: 加密敏感信息（如 SESSDATA）
- **访问控制**: 限制 API 访问权限

#### 3. 系统安全

- **日志审计**: 记录所有扫描和下载操作
- **错误监控**: 及时发现和处理错误
- **资源限制**: 限制 CPU 和内存使用

### 监控建议

#### 1. 扫描监控

```python
# 记录扫描指标
class ScanMetrics:
    def __init__(self):
        self.total_scans = 0
        self.successful_scans = 0
        self.failed_scans = 0
        self.total_videos_found = 0
        self.total_new_videos = 0
        self.total_added_to_queue = 0
    
    def record_scan(self, result: ScanTriggerResponse):
        """记录扫描结果"""
        self.total_scans += 1
        if result:
            self.successful_scans += 1
            self.total_videos_found += result.total
            self.total_new_videos += result.new
            self.total_added_to_queue += result.added
        else:
            self.failed_scans += 1
    
    def get_summary(self) -> dict:
        """获取统计摘要"""
        success_rate = (self.successful_scans / self.total_scans * 100) if self.total_scans > 0 else 0
        return {
            "total_scans": self.total_scans,
            "successful_scans": self.successful_scans,
            "failed_scans": self.failed_scans,
            "success_rate": f"{success_rate:.2f}%",
            "total_videos_found": self.total_videos_found,
            "total_new_videos": self.total_new_videos,
            "total_added_to_queue": self.total_added_to_queue
        }
```

#### 2. 性能监控

```python
# 记录性能指标
import time

class PerformanceMetrics:
    def __init__(self):
        self.scan_times = []
        self.api_request_times = []
        self.database_query_times = []
    
    def record_scan_time(self, duration: float):
        """记录扫描时间"""
        self.scan_times.append(duration)
    
    def record_api_request_time(self, duration: float):
        """记录 API 请求时间"""
        self.api_request_times.append(duration)
    
    def record_database_query_time(self, duration: float):
        """记录数据库查询时间"""
        self.database_query_times.append(duration)
    
    def get_summary(self) -> dict:
        """获取性能摘要"""
        import statistics
        
        return {
            "scan_times": {
                "avg": statistics.mean(self.scan_times) if self.scan_times else 0,
                "max": max(self.scan_times) if self.scan_times else 0,
                "min": min(self.scan_times) if self.scan_times else 0
            },
            "api_request_times": {
                "avg": statistics.mean(self.api_request_times) if self.api_request_times else 0,
                "max": max(self.api_request_times) if self.api_request_times else 0,
                "min": min(self.api_request_times) if self.api_request_times else 0
            },
            "database_query_times": {
                "avg": statistics.mean(self.database_query_times) if self.database_query_times else 0,
                "max": max(self.database_query_times) if self.database_query_times else 0,
                "min": min(self.database_query_times) if self.database_query_times else 0
            }
        }
```

#### 3. 告警设置

```python
# 设置告警阈值
ALERT_THRESHOLDS = {
    "scan_failure_rate": 0.1,  # 扫描失败率超过10%
    "scan_duration": 300,      # 单次扫描超过5分钟
    "storage_usage": 0.9,      # 存储使用率超过90%
    "api_error_rate": 0.05,    # API 错误率超过5%
}

async def check_alerts(metrics: ScanMetrics, perf_metrics: PerformanceMetrics):
    """检查告警条件"""
    alerts = []
    
    # 检查扫描失败率
    if metrics.failed_scans / metrics.total_scans > ALERT_THRESHOLDS["scan_failure_rate"]:
        alerts.append({
            "type": "scan_failure_rate",
            "message": f"扫描失败率过高: {metrics.failed_scans / metrics.total_scans * 100:.2f}%",
            "severity": "warning"
        })
    
    # 检查扫描时长
    if perf_metrics.scan_times and max(perf_metrics.scan_times) > ALERT_THRESHOLDS["scan_duration"]:
        alerts.append({
            "type": "scan_duration",
            "message": f"扫描时间过长: {max(perf_metrics.scan_times):.2f}秒",
            "severity": "warning"
        })
    
    # 检查存储使用率
    current_size = get_library_size_gb()
    threshold = get_storage_threshold()
    if current_size / threshold > ALERT_THRESHOLDS["storage_usage"]:
        alerts.append({
            "type": "storage_usage",
            "message": f"存储使用率过高: {current_size / threshold * 100:.2f}%",
            "severity": "critical"
        })
    
    # 发送告警
    for alert in alerts:
        await send_alert(alert)
```

---

## 总结

PiliNote 的自动化功能提供了一个强大而灵活的视频下载管理系统，支持定时扫描、手动触发、智能存储管理等功能。通过合理配置和使用，可以大大提高视频下载的效率，减少人工操作。

### 关键要点

1. **双重扫描模式**: 支持自动定时扫描和手动触发扫描，满足不同场景需求
2. **灵活调度策略**: 支持间隔扫描和 Cron 表达式，实现精确的定时控制
3. **智能存储管理**: 自动检查存储空间，避免磁盘空间不足
4. **自定义扫描范围**: 可选择扫描特定收藏夹，控制扫描数量
5. **完整的记录追踪**: 记录每次扫描的结果，便于查看和追溯
6. **自动下载触发**: 扫描完成后可自动开始下载新视频
7. **并发控制**: 控制同时扫描和下载的任务数量

### 适用场景

- **定时备份收藏夹**: 定期扫描收藏夹，自动下载新内容
- **稍后再看自动归档**: 定时清理稍后再看列表，下载到本地
- **特定收藏夹监控**: 只关注某个收藏夹的更新，选择性下载
- **离线观看准备**: 在空闲时间批量下载视频，方便离线观看
- **存储空间管理**: 自动监控存储空间，避免空间不足

### 扩展建议

1. **支持更多视频源**: 除了收藏夹和稍后再看，可以支持其他视频源
2. **更复杂的调度规则**: 支持更灵活的调度规则，如工作日/周末不同策略
3. **智能推荐**: 根据用户习惯推荐扫描配置
4. **统计分析**: 提供更详细的扫描和下载统计分析
5. **通知功能**: 支持邮件、短信等通知方式

---

## 相关文档

- [自动下载设置](../settings/auto-download.md) - 自动下载配置详细说明
- [队列管理](queue.md) - 下载队列管理
- [任务管理](tasks.md) - 下载任务管理
- [API 端点](../api/endpoints.md) - 完整 API 列表
- [系统架构](../architecture/system.md) - 系统架构文档

---

**文档版本**: 1.0.0  
**最后更新**: 2026-04-14  
**维护者**: PiliNote Team