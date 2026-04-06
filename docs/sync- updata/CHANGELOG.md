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
