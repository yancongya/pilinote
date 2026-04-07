# 自动下载功能升级日志

## 阶段 1：基础数据存储与设置界面 (2024-04-06) ✅ 已完成

### 前端改动
- 在设置页面新增"定时"Tab
- 新增 `AutoDownloadSettings` 组件，包含以下配置项：
  - 启用自动下载开关
  - 触发方式：间隔执行 / Cron 表达式
  - 扫描间隔（分钟）：15/30/60/120/360/720/1440
  - Cron 表达式输入框
  - 并发限制：视频并发数、分页并发数
- 实现配置读取、保存、重置功能
- 优化用户体验，删除调试日志

### 后端改动
- 新增 `AutoDownloadSettings` 和 `ConcurrentLimit` Pydantic 模型
- 更新 `Settings` schema 包含 `auto_download` 字段
- 更新 `SettingsService` 实现 auto_download 设置的读写
- 支持嵌套字段 `concurrent_limit.video` 和 `concurrent_limit.page` 的读写
- 在 `init_default_settings` 中添加 auto_download 默认配置
- 修复 logger 定义缺失问题
- 所有设置通过现有 `/api/settings/` API 持久化

### 实现方式
- 采用现有通用架构（方案A）
- 使用 Setting 表存储配置，避免新增专用表
- 使用通用的 `/api/settings/` 接口进行配置管理
- 与 PiliNote 现有架构保持一致

### 测试要点
- ✅ GET /api/settings/ 返回 auto_download 默认配置
- ✅ PUT /api/settings/ 可以修改并持久化 auto_download 配置
- ✅ 并发限制字段正确保存到数据库
- ✅ 配置刷新后正确显示
- ✅ 修改配置后能正确保存并持久化

### 验收标准
- ✅ 前端显示/保存成功
- ✅ 后端 API 正常工作
- ✅ 数据库存储完成（使用 Setting 表）
- ✅ 配置持久化功能完整

### 完成状态
- ✅ 所有验收标准已通过
- ✅ 阶段一已完成

---

## 阶段 1.5：自定义扫描列表功能 (2026-04-06) ✅ 已完成

### 功能描述
- 添加自定义扫描列表配置，允许用户指定需要扫描的收藏夹和每个收藏夹的最大扫描视频数
- 简化界面设计，采用表格形式显示文件夹名和视频数
- 启用开关移到标题右侧，界面更简洁

### 前端改动
- 在自动下载设置页面添加"自定义扫描列表"配置区域
- 实现简洁的表格界面：文件夹名 + 视频数两列
- 支持添加/删除文件夹配置
- 启用开关位于标题右侧，点击即可启用/禁用自定义扫描
- 优化用户体验：删除冗余描述文字，界面更清爽

### 后端改动
- 新增 `FolderScanConfig` Pydantic 模型：
  ```python
  class FolderScanConfig(BaseModel):
      folder_name: str = Field(default="", description="收藏夹名称")
      max_videos: int = Field(default=20, ge=1, le=999, description="最大扫描视频数")
  ```
- 新增 `CustomScanConfig` Pydantic 模型：
  ```python
  class CustomScanConfig(BaseModel):
      enabled: bool = Field(default=False, description="是否启用自定义扫描")
      folder_list: List[FolderScanConfig] = Field(default_factory=list, description="收藏夹扫描列表")
  ```
- 在 `AutoDownloadSettings` 中添加 `custom_scan` 字段
- 在 `SettingsService.get_settings()` 中添加自定义扫描配置的读取和解析逻辑
- 在 `SettingsService.update_settings()` 中添加自定义扫描配置的保存逻辑
- 修复配置持久化问题：将 `custom_scan` 配置以 JSON 格式存储到数据库
- 修复配置读取问题：从数据库读取后正确解析 JSON 为 Python 字典

### 技术实现
- **数据存储**：使用 JSON 格式将 `custom_scan` 配置存储在 Setting 表中
  - Key: `auto_download.custom_scan`
  - Value: JSON 字符串，包含 `enabled` 和 `folder_list`
- **配置读取**：
  ```python
  custom_scan_setting = all_settings.get('auto_download.custom_scan')
  custom_scan_dict = {'enabled': False, 'folder_list': []}
  if custom_scan_setting:
      try:
          custom_scan_data = json.loads(custom_scan_setting.value)
          custom_scan_dict = {
              'enabled': custom_scan_data.get('enabled', False),
              'folder_list': custom_scan_data.get('folder_list', [])
          }
      except json.JSONDecodeError as e:
          logger.error(f"Failed to parse custom_scan setting: {e}")
  ```
- **配置保存**：
  ```python
  if 'auto_download' in settings_dict and 'custom_scan' in settings_dict['auto_download']:
      custom_scan_value = settings_dict['auto_download']['custom_scan']
      if isinstance(custom_scan_value, dict):
          self._update_single_setting('auto_download.custom_scan', custom_scan_value)
      del settings_dict['auto_download']['custom_scan']
  ```

### 数据库设计
- 使用现有 Setting 表存储自定义扫描配置
- 配置项格式：
  - Key: `auto_download.custom_scan`
  - Value: `{"enabled": true, "folder_list": [{"folder_name": "技术教程", "max_videos": 20}]}`
  - Type: `dict`
  - Category: `auto_download`

### 修复的问题
1. **配置持久化问题**：
   - **问题**：保存自定义扫描配置后，刷新页面恢复为默认值
   - **原因**：`custom_scan` 配置在保存时没有正确处理为 JSON 格式存储
   - **解决方案**：在 `update_settings` 方法中添加特殊处理，将 `custom_scan` 字典转换为 JSON 字符串存储

2. **配置读取问题**：
   - **问题**：从数据库读取配置后无法正确解析
   - **原因**：缺少 JSON 解析逻辑
   - **解决方案**：在 `get_settings` 方法中添加 JSON 解析代码，包含错误处理

3. **导入错误**：
   - **问题**：后端启动失败，提示 `NameError: name 'List' is not defined`
   - **原因**：缺少 `List` 类型导入
   - **解决方案**：在 `settings.py` 中添加 `from typing import Optional, Dict, Any, List`

### 前端界面设计
```typescript
// 标题行：标题 + 刷新图标 + 开关
<div className="stg-group-header">
  <span className="stg-group-title">自定义扫描列表</span>
  <div>
    <button onClick={loadFavorites} aria-label="刷新收藏夹列表">
      <RotateCw size={14} />
    </button>
    <label className="stg-toggle">
      <input type="checkbox" checked={customScanEnabled} />
    </label>
  </div>
</div>

// 说明文字
<div>
  💡 视频数为 0 表示不扫描该收藏夹，设置大于 0 的数值后才进行扫描
</div>

// 收藏夹列表（只读名称 + 可编辑视频数）
{folderList.map((config, index) => (
  <div key={index}>
    <div>{config.folder_name}</div>
    <input
      type="number"
      value={config.max_videos}
      onChange={(e) => updateFolderConfig(index, 'max_videos', parseInt(e.target.value) || 0)}
      min={0}
      max={999}
      placeholder="0=不扫描"
    />
  </div>
))}
```

### 扫描逻辑优化
- **智能过滤**：在扫描时应用自定义配置，只扫描 `max_videos > 0` 的收藏夹
- **跳过机制**：`max_videos = 0` 的收藏夹在过滤阶段就被排除，不进行API调用
- **空列表处理**：如果启用自定义扫描但列表为空，不扫描任何收藏夹
- **数量限制**：根据配置的 `max_videos` 限制每个收藏夹的扫描视频数

### 测试要点
- ✅ 添加自定义扫描配置后，保存成功
- ✅ 刷新页面后配置保持不变（不再恢复为默认）
- ✅ 启用开关可以正常切换
- ✅ 点击刷新图标可以加载收藏夹列表
- ✅ 收藏夹名称只读显示，不能修改
- ✅ 可以修改每个收藏夹的视频数
- ✅ 视频数为0的收藏夹在扫描时被跳过
- ✅ 视频数大于0的收藏夹按指定数量扫描
- ✅ 后端服务正常启动，无导入错误
- ✅ 数据库正确存储 JSON 格式的配置
- ✅ API认证正常工作

### 验收标准
- ✅ 前端界面简洁明了，表格格式清晰
- ✅ 刷新图标按钮位于开关旁边
- ✅ 收藏夹列表自动加载，无需手动输入
- ✅ 配置可以正常保存和读取
- ✅ 配置持久化功能完整，刷新后不丢失
- ✅ 后端 API 正常工作，无错误
- ✅ 数据库正确存储配置
- ✅ 扫描逻辑正确应用配置

### 完成状态
- ✅ 所有验收标准已通过
- ✅ 阶段 1.5 已完成

### 修改文件
- `apps/api/src/schemas/settings.py`: 添加 `FolderScanConfig` 和 `CustomScanConfig` 模型
- `apps/api/src/services/settings_service.py`: 添加自定义扫描配置的读写逻辑
- `apps/api/src/services/scan_service.py`: 添加自定义扫描配置应用逻辑
- `apps/web/src/pages/settings/AutoDownloadSettings.tsx`: 实现自定义扫描列表界面
- `docs/sync- updata/CHANGELOG.md`: 更新功能文档

---

## 阶段 2：扫描记录管理与动画优化 (2026-04-07) ✅ 已完成

### 功能描述
- 添加扫描记录定时删除功能，支持配置保留时间
- 优化扫描记录界面，改进用户体验和视觉效果
- 实现逐层扫描动画效果，提升扫描过程的视觉反馈
- 修复时区显示问题，确保时间显示正确

### 前端改动
#### 1. 扫描记录定时删除功能
- 在"扫描记录"标题旁添加保留时间选择器
- 支持选项：不限制、保留7天、保留30天、保留90天、保留180天
- 实现自动清理逻辑：
  - 组件挂载时执行一次清理
  - 每小时自动清理过期记录
- 使用 localStorage 持久化用户偏好设置
- 清除记录按钮去掉背景填充，改为透明背景样式

#### 2. 界面优化
- **按钮样式优化**：
  - 删除按钮和清空记录按钮去掉背景填充
  - Hover 时显示红色背景和边框
  - 平滑的过渡动画效果
- **布局优化**：
  - 扫描按钮组使用 `flex: 1` 等宽分布
  - 扫描结果、扫描记录的所有组件使用 inline 布局
  - 移动端支持横向滚动，保持 inline 布局
- **使用 ConfirmModal 组件**：
  - 替换原生 `confirm()` 对话框
  - 删除记录时使用 ConfirmModal 确认
  - 清空记录时使用 ConfirmModal 确认
  - 统一的确认弹窗风格

#### 3. 时区问题修复
- 简化 `formatRelativeTime` 函数
- 移除错误的时区转换逻辑
- 直接使用 JavaScript 的本地时间解析
- 新创建的记录显示正确时间

#### 4. 逐层扫描动画效果
- **扫描过程动画**：
  - 扫描过程中每隔 800ms 依次显示一个收藏夹卡片
  - 蓝色边框、浅蓝色背景、旋转扫描图标
  - 卡片从下往上滑入，每个卡片延迟 100ms
  - 显示"扫描中..."状态文本
- **扫描完成动画**：
  - 扫描完成后立即显示真实数据
  - 每个收藏夹卡片依次从底部滑入
  - 每 150ms 显示一个卡片
  - 使用 `cubic-bezier(0.4, 0, 0.2, 1)` 缓动函数
- **状态管理**：
  - 新增 `isScanAnimating` 状态控制动画
  - 新增 `scanningFolders` 存储正在扫描的收藏夹索引
  - 扫描开始时启动动画，完成或失败时停止

### 后端改动
#### 1. 时区修复
- 将 `scan_service.py` 中的 `datetime.utcnow()` 改为 `datetime.now()`
- 使用本地时间存储扫描记录
- 修复扫描记录时间显示错误问题

### 技术实现
#### 1. 定时清理逻辑
```typescript
// 自动清理旧记录
useEffect(() => {
  const saved = localStorage.getItem('scan_record_retention_days')
  if (saved && saved !== 'unlimited') {
    const days = parseInt(saved)
    clearScanRecords(undefined, days).catch(err => {
      console.error('Auto cleanup failed:', err)
    })
  }
}, [])

// 定时清理：每小时检查一次
useEffect(() => {
  const saved = localStorage.getItem('scan_record_retention_days')
  if (saved && saved !== 'unlimited') {
    const days = parseInt(saved)
    const interval = setInterval(() => {
      clearScanRecords(undefined, days).catch(err => {
        console.error('Scheduled cleanup failed:', err)
      })
    }, 3600000) // 每小时
    
    return () => clearInterval(interval)
  }
}, [])
```

#### 2. 逐层显示扫描结果
```typescript
// 逐层显示扫描结果
useEffect(() => {
  if (lastScanResult && lastScanResult.folders && lastScanResult.folders.length > 0 && !isScanAnimating) {
    setCurrentFolderIndex(0)
    const interval = setInterval(() => {
      setCurrentFolderIndex(prev => {
        if (prev < lastScanResult.folders!.length - 1) {
          return prev + 1
        }
        clearInterval(interval)
        return prev
      })
    }, 150) // 每150ms显示一个收藏夹
    
    return () => clearInterval(interval)
  }
}, [lastScanResult, isScanAnimating])
```

#### 3. CSS 动画
```css
/* 扫描中动画 */
.folder-card-scanning {
  animation: folderSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
  transform: translateY(10px);
  border-color: #3b82f6;
  background: #eff6ff;
}

.scanning-icon {
  animation: spin 1s linear infinite;
}

/* 扫描完成动画 */
.folder-card-animating {
  animation: folderSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  opacity: 0;
  transform: translateY(10px);
}

@keyframes folderSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 界面设计改进
#### 1. 按钮自适应布局
```css
/* 桌面端 */
.scan-actions {
  display: flex;
  gap: 12px;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: flex-start;
}

.scan-btn {
  flex: 1;
  white-space: nowrap;
}

/* 移动端 */
@media (max-width: 640px) {
  .scan-actions {
    flex-wrap: wrap;
    gap: 8px;
  }

  .scan-btn {
    flex: 1 1 auto;
    min-width: calc(50% - 4px);
  }
}
```

#### 2. ConfirmModal 使用
```typescript
// 删除记录确认
const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; recordId?: string }>({ show: false })

const handleDeleteRecord = async (recordId: string) => {
  setDeleteConfirm({ show: true, recordId })
}

<ConfirmModal
  isOpen={deleteConfirm.show}
  onClose={() => setDeleteConfirm({ show: false })}
  onConfirm={confirmDelete}
  title="删除扫描记录"
  message="确定要删除这条扫描记录吗？"
  confirmText="删除"
  confirmVariant="danger"
/>
```

### 修复的问题
1. **时区显示问题**：
   - **问题**：扫描记录显示"8小时前"，时间不正确
   - **原因**：后端使用 UTC 时间存储，前端解析时区错误
   - **解决方案**：后端改用本地时间 `datetime.now()` 存储

2. **按钮背景填充问题**：
   - **问题**：删除按钮有红色背景填充
   - **解决方案**：改为透明背景，hover 时显示红色背景

3. **原生 confirm 对话框问题**：
   - **问题**：使用原生 `confirm()` 对话框，风格不统一
   - **解决方案**：使用 ConfirmModal 组件替换

4. **布局换行问题**：
   - **问题**：按钮组在不同情况下会换行显示
   - **解决方案**：使用 `flex-wrap: nowrap` 和自适应宽度

5. **扫描动画单调问题**：
   - **问题**：只有简单的图标旋转动画
   - **解决方案**：实现逐层扫描动画效果

### 测试要点
- ✅ 保留时间选择器功能正常
- ✅ 自动清理过期记录功能正常
- ✅ 用户偏好设置持久化正常
- ✅ 删除按钮和清空按钮样式正确（透明背景）
- ✅ ConfirmModal 组件正常工作
- ✅ 所有按钮组 inline 显示不换行
- ✅ 时区显示正确（新创建的记录）
- ✅ 扫描过程中显示逐层动画
- ✅ 扫描完成后显示真实数据的动画
- ✅ 移动端布局自适应正常
- ✅ 按钮等宽分布正常
- ✅ 后端服务正常启动
- ✅ 扫描记录正确保存本地时间

### 验收标准
- ✅ 保留时间选择器功能完整
- ✅ 自动清理功能正常工作
- ✅ 用户偏好设置持久化正常
- ✅ 按钮样式优化完成
- ✅ ConfirmModal 集成完成
- ✅ 布局优化完成（inline 显示）
- ✅ 时区问题修复完成
- ✅ 逐层扫描动画效果完整
- ✅ 按钮自适应布局正常
- ✅ 移动端适配正常
- ✅ 所有功能无错误

### 完成状态
- ✅ 所有验收标准已通过
- ✅ 阶段 2 已完成

### 修改文件
- `apps/api/src/services/scan_service.py`: 修复时区问题（datetime.utcnow() -> datetime.now()）
- `apps/web/src/components/NewDownload/ScanResultContent.tsx`: 添加定时删除、界面优化、动画效果
- `apps/web/src/components/NewDownload/index.css`: 添加动画样式、布局优化
- `docs/sync- updata/CHANGELOG.md`: 更新功能文档

---

## 阶段 3：自动下载队列落地与显示 (2026-04-07) ✅ 已完成

### 功能描述
- 实现将扫描到的新视频自动添加到下载队列
- 在扫描完成后，新视频自动进入队列并显示在下载列表中
- 更新扫描记录，记录实际添加到队列的视频数量

### 后端改动
#### 1. 添加视频到队列转换方法
- 新增 `_convert_video_to_task_create` 方法：
  - 将 `ScanVideoInfo` 转换为 `TaskCreate`
  - 包含完整的 meta 信息（UP主、发布时间、封面等）
  - 根据视频源类型设置正确的 media_type
  - 保留收藏夹 folder_id 信息
- 新增 `add_videos_to_queue` 方法：
  - 批量将新视频添加到队列
  - 使用 QueueManager 的 submit_backlog 方法
  - 统计实际添加成功的视频数量
  - 错误处理和日志记录

#### 2. 集成队列到扫描流程
- 在 `trigger_scan` 方法中集成队列添加逻辑：
  - 识别新视频后，自动调用 `add_videos_to_queue`
  - 将添加数量记录到扫描记录
  - 返回的 `ScanTriggerResponse` 包含 added 字段

#### 3. 数据流
```python
# 扫描流程
videos, folder_infos = await self._fetch_videos(...)
new_videos = await self._identify_new_videos(source_type, videos)

# 添加到队列
added_count = await self.add_videos_to_queue(new_videos, source_type)

# 保存扫描记录（包含 added_to_queue）
await self._save_scan_record(
    ...
    added_to_queue=added_count
)
```

### 前端改动
- 无需改动（下载列表已存在）
- 前端会通过 WebSocket 接收新任务创建事件
- 自动更新下载列表显示

### 技术实现
#### 1. 视频信息转换
```python
def _convert_video_to_task_create(self, video: ScanVideoInfo, source_type: str) -> TaskCreate:
    # 构建 meta 信息
    meta = {
        "bvid": video.bvid,
        "author": video.author,
        "duration": video.duration,
        "pubdate": video.pubdate,
        "cover": video.cover,
        "source_type": source_type
    }
    
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

#### 2. 批量添加到队列
```python
async def add_videos_to_queue(self, videos: List[ScanVideoInfo], source_type: str) -> int:
    from src.services.queue.manager import queue_manager
    
    added_count = 0
    
    for video in videos:
        try:
            task_create = self._convert_video_to_task_create(video, source_type)
            await queue_manager.submit_backlog(task_create)
            added_count += 1
            logger.info(f"✓ 视频已添加到队列: {video.title}")
        except Exception as e:
            logger.error(f"✗ 添加视频到队列失败: {video.title} - {e}")
            continue
    
    return added_count
```

#### 3. WebSocket 事件广播
- QueueManager 的 submit_backlog 方法会自动广播 `broadcast_task_created` 事件
- 前端通过 WebSocket 接收事件并更新下载列表
- 实现实时同步，无需手动刷新

### 数据库变化
- 新任务自动添加到 Task 表
- 队列状态更新到 Queue 表
- 扫描记录包含 added_to_queue 统计

### 测试要点
- ✅ 扫描收藏夹后，新视频自动出现在下载列表
- ✅ 扫描稍后再看后，新视频自动出现在下载列表
- ✅ 扫描结果返回的 added 字段正确
- ✅ 扫描记录的 added_to_queue 字段正确
- ✅ 任务状态为 BACKLOG（待下载）
- ✅ 任务包含完整的 meta 信息
- ✅ WebSocket 事件正确触发
- ✅ 后端服务正常启动
- ✅ 无循环依赖问题

### 验收标准
- ✅ 扫描结果自动进入队列
- ✅ 队列可观测（下载列表显示）
- ✅ added 统计正确
- ✅ added_to_queue 记录正确
- ✅ 任务创建成功
- ✅ WebSocket 事件触发
- ✅ 无错误和异常

### 完成状态
- ✅ 所有验收标准已通过
- ✅ 阶段 3 已完成

### 修改文件
- `apps/api/src/services/scan_service.py`: 添加队列集成功能
- `docs/sync- updata/CHANGELOG.md`: 更新功能文档
