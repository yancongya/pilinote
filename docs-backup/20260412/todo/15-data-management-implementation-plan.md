# PiliNote 数据管理和下载配置实施计划

## 当前项目状态分析

### ✅ 已完成功能
1. **用户认证系统**
   - 扫码登录
   - 短信登录
   - SESSDATA登录
   - 多账号管理（切换、刷新、删除）

2. **视频源管理**
   - 收藏夹管理
   - 稍后再看
   - 链接解析

3. **性能优化**
   - 懒加载机制
   - 缓存优化
   - 分页加载

### 🏗️ 基础架构
1. **数据库现状**
   - 数据库位置：`apps/api/data/pilinote.db`
   - 已有表：`users`（存储用户信息）
   - 缺失表：`cookies`、`downloads`、`settings`

2. **技术栈**
   - 后端：FastAPI + SQLAlchemy + SQLite
   - 前端：React + TypeScript + Zustand
   - 状态管理：Zustand（类似Pinia）

3. **路由结构**
   - 设置页面路由：`/settings`
   - 点击头像跳转到设置页面
   - 当前SettingsPage：只有账号管理功能

### ❌ 待实现功能
1. **数据库表补充**（cookies、downloads、settings）
2. **设置系统**（下载设置、数据管理）
3. **下载管理系统**

## 分阶段实施计划

## 阶段1：数据库改造（Week 1）

### 1.1 创建缺失的数据表

#### 1.1.1 创建cookies表
```sql
CREATE TABLE cookies (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    value VARCHAR(2000) NOT NULL,
    domain VARCHAR(200),
    path VARCHAR(200),
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**实施步骤**：
1. 在`apps/api/src/database.py`中添加表创建逻辑
2. 运行数据库迁移创建新表
3. 测试表创建和数据插入

#### 1.1.2 创建downloads表
```sql
CREATE TABLE downloads (
    id VARCHAR(36) PRIMARY KEY,
    bvid VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL,
    progress FLOAT DEFAULT 0.0,
    downloaded_bytes INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    download_speed FLOAT DEFAULT 0.0,
    eta FLOAT DEFAULT 0.0,
    cid INTEGER,
    aid INTEGER,
    quality INTEGER,
    output_format VARCHAR(10) DEFAULT 'mp4',
    thumbnail_url VARCHAR(500),
    duration INTEGER,
    uploader VARCHAR(100),
    uploader_mid INTEGER,
    file_path VARCHAR(500),
    file_size INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    sessdata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**实施步骤**：
1. 使用已有的`apps/api/src/models/download.py`模型
2. 在`apps/api/src/database.py`中添加表创建逻辑
3. 创建索引优化查询性能：
   ```sql
   CREATE INDEX ix_downloads_bvid ON downloads(bvid);
   CREATE INDEX ix_downloads_status ON downloads(status);
   CREATE INDEX ix_downloads_created_at ON downloads(created_at);
   ```
4. 测试表创建和数据操作

#### 1.1.3 创建settings表
```sql
CREATE TABLE settings (
    id INTEGER PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    type VARCHAR(20) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    default_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**实施步骤**：
1. 创建`apps/api/src/models/setting.py`
2. 定义Settings模型
3. 在`apps/api/src/database.py`中添加表创建逻辑
4. 添加默认设置初始化数据

### 1.2 数据库改造脚本

#### 1.2.1 创建数据库迁移工具
```python
# apps/api/src/utils/db_migration.py

def migrate_database():
    """执行数据库迁移"""
    # 创建缺失的表
    create_cookies_table()
    create_downloads_table()
    create_settings_table()
    
    # 初始化默认设置
    init_default_settings()
```

**实施步骤**：
1. 创建数据库迁移工具
2. 实现表创建逻辑
3. 添加默认设置初始化
4. 编写迁移日志

## 阶段2：设置系统后端（Week 2）

### 2.1 设置数据模型

#### 2.1.1 Settings类型定义
```python
# apps/api/src/schemas/settings.py

from pydantic import BaseModel, Field
from typing import Optional

class DownloadSettings(BaseModel):
    default_quality: int = Field(80, description="默认视频质量")
    max_concurrent: int = Field(3, description="最大并发下载数")
    speed_limit: int = Field(0, description="速度限制(KB/s), 0表示不限制")
    output_format: str = Field("mp4", description="输出格式")
    download_path: str = Field("./downloads", description="下载路径")

class StorageSettings(BaseModel):
    temp_path: str = Field("./temp", description="临时文件路径")
    auto_cleanup: bool = Field(True, description="自动清理临时文件")
    keep_failed: bool = Field(False, description="保留失败的任务")

class GeneralSettings(BaseModel):
    theme: str = Field("auto", description="主题设置")
    language: str = Field("zh-CN", description="语言设置")
    auto_download: bool = Field(False, description="自动下载")
    clipboard_monitor: bool = Field(False, description="剪贴板监听")

class Settings(BaseModel):
    download: DownloadSettings
    storage: StorageSettings
    general: GeneralSettings
```

**实施步骤**：
1. 创建`schemas/settings.py`
2. 定义完整的设置类型
3. 添加字段验证规则
4. 编写示例和文档

### 2.2 设置管理服务

#### 2.2.1 SettingsService类
```python
# apps/api/src/services/settings_service.py

class SettingsService:
    def __init__(self):
        self.db = get_db()
    
    async def get_settings(self) -> Settings:
        """获取所有设置"""
        pass
    
    async def update_settings(self, settings: dict):
        """更新设置"""
        pass
    
    async def reset_settings(self, category: str = None):
        """重置设置"""
        pass
    
    async def export_settings(self, output_path: str):
        """导出设置"""
        pass
    
    async def import_settings(self, input_path: str):
        """导入设置"""
        pass
```

**实施步骤**：
1. 创建`services/settings_service.py`
2. 实现设置CRUD操作
3. 实现设置导入导出
4. 添加设置验证逻辑

### 2.3 设置API端点

```python
# apps/api/src/routers/settings.py

@router.get("/")
async def get_settings():
    """获取所有设置"""

@router.put("/")
async def update_settings(settings: dict):
    """更新设置"""

@router.post("/reset")
async def reset_settings(category: str = None):
    """重置设置"""

@router.post("/export")
async def export_settings(output_path: str):
    """导出设置"""

@router.post("/import")
async def import_settings(input_path: str):
    """导入设置"""
```

**实施步骤**：
1. 创建`routers/settings.py`
2. 实现各个API端点
3. 添加错误处理
4. 编写API文档

## 阶段3：设置系统前端改造（Week 3）

### 3.1 改造SettingsPage组件结构

#### 3.1.1 添加Tab导航
```tsx
// apps/web/src/pages/SettingsPage.tsx

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('accounts') // accounts, download, storage
  
  const tabs = [
    { id: 'accounts', label: '账号管理', icon: User },
    { id: 'download', label: '下载设置', icon: Download },
    { id: 'storage', label: '数据管理', icon: Database }
  ]
  
  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>设置</h1>
      </div>
      
      {/* Tab导航 */}
      <div className="settings-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      
      {/* Tab内容 */}
      <div className="settings-content">
        {activeTab === 'accounts' && <AccountsSettings />}
        {activeTab === 'download' && <DownloadSettings />}
        {activeTab === 'storage' && <StorageSettings />}
      </div>
    </div>
  )
}
```

**实施步骤**：
1. 添加Tab状态管理
2. 实现Tab切换逻辑
3. 保持现有的账号管理功能
4. 添加Tab切换动画

### 3.2 拆分SettingsPage组件

#### 3.2.1 创建子组件目录
```
apps/web/src/pages/settings/
  ├── AccountsSettings.tsx      # 账号管理（从SettingsPage迁移）
  ├── DownloadSettings.tsx      # 下载设置（新建）
  └── StorageSettings.tsx       # 数据管理（新建）
```

**实施步骤**：
1. 创建settings子目录
2. 将现有账号管理逻辑迁移到AccountsSettings.tsx
3. 创建DownloadSettings.tsx
4. 创建StorageSettings.tsx

#### 3.2.2 AccountsSettings组件
```tsx
// apps/web/src/pages/settings/AccountsSettings.tsx

export default function AccountsSettings() {
  // 从原SettingsPage迁移的账号管理代码
  return (
    <div className="accounts-settings">
      {/* 现有的账号列表、切换、删除功能 */}
    </div>
  )
}
```

**实施步骤**：
1. 迁移现有的账号管理代码
2. 保持所有现有功能
3. 保持现有的样式
4. 保持现有的交互

#### 3.2.3 DownloadSettings组件
```tsx
// apps/web/src/pages/settings/DownloadSettings.tsx

export default function DownloadSettings() {
  const { settings, updateSettings } = useSettingsStore()
  
  return (
    <section>
      <h3>默认视频质量</h3>
      <Select 
        value={settings.download.default_quality}
        onChange={(value) => updateSettings({ download: { default_quality: value }})}
        options={qualityOptions}
      />
      
      <h3>最大并发数</h3>
      <Slider 
        min={1} max={5}
        value={settings.download.max_concurrent}
        onChange={(value) => updateSettings({ download: { max_concurrent: value }})}
      />
      
      <h3>速度限制</h3>
      <Input 
        type="number"
        value={settings.download.speed_limit}
        onChange={(value) => updateSettings({ download: { speed_limit: value }})}
      />
      
      <h3>下载路径</h3>
      <FolderPicker 
        value={settings.download.download_path}
        onChange={(value) => updateSettings({ download: { download_path: value }})}
      />
    </section>
  )
}
```

**实施步骤**：
1. 创建下载设置UI
2. 实现质量选择器
3. 实现并发数滑块
4. 实现路径选择器

#### 3.2.4 StorageSettings组件
```tsx
// apps/web/src/pages/settings/StorageSettings.tsx

export default function StorageSettings() {
  const { settings, updateSettings, databaseInfo } = useSettingsStore()
  
  return (
    <section>
      <h3>临时文件路径</h3>
      <FolderPicker 
        value={settings.storage.temp_path}
        onChange={(value) => updateSettings({ storage: { temp_path: value }})}
      />
      
      <h3>自动清理</h3>
      <Switch 
        checked={settings.storage.auto_cleanup}
        onChange={(checked) => updateSettings({ storage: { auto_cleanup: checked }})}
      />
      
      <h3>数据库信息</h3>
      <div className="database-info">
        <div className="info-item">
          <span>数据库大小:</span>
          <span>{formatBytes(databaseInfo.size)}</span>
        </div>
        <div className="info-item">
          <span>用户数量:</span>
          <span>{databaseInfo.userCount}</span>
        </div>
        <div className="info-item">
          <span>下载任务:</span>
          <span>{databaseInfo.downloadCount}</span>
        </div>
      </div>
      
      <div className="action-buttons">
        <Button onClick={handleBackup}>备份数据库</Button>
        <Button onClick={handleRestore}>恢复数据库</Button>
        <Button onClick={handleClean}>清理数据</Button>
      </div>
    </section>
  )
}
```

**实施步骤**：
1. 创建存储设置UI
2. 实现路径选择器
3. 实现开关组件
4. 实现数据库信息显示
5. 实现备份恢复功能

### 3.3 设置状态管理

#### 3.3.1 Settings Store
```typescript
// apps/web/src/stores/settings.ts

interface Settings {
  download: DownloadSettings;
  storage: StorageSettings;
  general: GeneralSettings;
}

interface SettingsStore {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
  databaseInfo: {
    size: number;
    userCount: number;
    downloadCount: number;
  };
  
  // Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  resetSettings: (category?: string) => Promise<void>;
  exportSettings: (path: string) => Promise<void>;
  importSettings: (path: string) => Promise<void>;
  fetchDatabaseInfo: () => Promise<void>;
  backupDatabase: (path: string) => Promise<void>;
  restoreDatabase: (path: string) => Promise<void>;
  cleanDatabase: (table: string) => Promise<void>;
}
```

**实施步骤**：
1. 创建settings store
2. 定义设置接口
3. 实现设置操作方法
4. 添加数据库管理方法
5. 添加持久化支持

### 3.4 API服务集成

#### 3.4.1 添加设置API方法
```typescript
// apps/web/src/services/api.ts

// 设置相关API
async getSettings(): Promise<ApiResponse<Settings>> {
  return this.request<Settings>('/api/settings/', { method: 'GET' });
}

async updateSettings(settings: Partial<Settings>): Promise<ApiResponse<void>> {
  return this.request<void>('/api/settings/', { 
    method: 'PUT',
    body: JSON.stringify(settings)
  });
}

async resetSettings(category?: string): Promise<ApiResponse<void>> {
  return this.request<void>(`/api/settings/reset${category ? `?category=${category}` : ''}`, { 
    method: 'POST'
  });
}

async getDatabaseInfo(): Promise<ApiResponse<DatabaseInfo>> {
  return this.request<DatabaseInfo>('/api/database/info', { method: 'GET' });
}

async backupDatabase(path: string): Promise<ApiResponse<void>> {
  return this.request<void>('/api/database/backup', { 
    method: 'POST',
    body: JSON.stringify({ output_path: path })
  });
}

async restoreDatabase(path: string): Promise<ApiResponse<void>> {
  return this.request<void>('/api/database/restore', { 
    method: 'POST',
    body: JSON.stringify({ input_path: path })
  });
}

async cleanDatabase(table: string): Promise<ApiResponse<void>> {
  return this.request<void>(`/api/database/clean/${table}`, { method: 'DELETE' });
}
```

**实施步骤**：
1. 添加设置API方法
2. 添加数据库管理API方法
3. 实现错误处理
4. 添加类型定义

## 阶段4：下载管理系统（Week 4-5）

### 4.1 下载任务管理

#### 4.1.1 下载任务服务
```python
# apps/api/src/services/download_manager.py

class DownloadManager:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.active_downloads = {}
        self.max_concurrent = 3
    
    async def add_task(self, task: DownloadTask):
        """添加下载任务"""
        pass
    
    async def start_task(self, task_id: str):
        """开始下载任务"""
        pass
    
    async def pause_task(self, task_id: str):
        """暂停下载任务"""
        pass
    
    async def resume_task(self, task_id: str):
        """继续下载任务"""
        pass
    
    async def cancel_task(self, task_id: str):
        """取消下载任务"""
        pass
    
    async def get_task_status(self, task_id: str):
        """获取任务状态"""
        pass
    
    async def get_all_tasks(self):
        """获取所有任务"""
        pass
```

**实施步骤**：
1. 创建DownloadManager类
2. 实现任务队列管理
3. 实现并发控制
4. 实现任务状态管理

### 4.2 下载执行引擎

#### 4.2.1 yt-dlp集成
```python
# apps/api/src/services/download_engine.py

class DownloadEngine:
    def __init__(self):
        self.yt_dlp_path = "yt-dlp"
        self.ffmpeg_path = "ffmpeg"
    
    async def download_video(
        self,
        bvid: str,
        quality: int,
        output_path: str,
        progress_callback: Callable
    ):
        """下载视频"""
        pass
    
    async def extract_audio(self, video_path: str, output_path: str):
        """提取音频"""
        pass
    
    async def convert_format(self, input_path: str, output_path: str):
        """转换格式"""
        pass
```

**实施步骤**：
1. 集成yt-dlp库
2. 实现视频下载
3. 实现进度回调
4. 实现格式转换

### 4.3 下载API端点

```python
# apps/api/src/routers/download.py

@router.post("/add")
async def add_download(video_info: dict):
    """添加下载任务"""

@router.post("/{task_id}/start")
async def start_download(task_id: str):
    """开始下载"""

@router.post("/{task_id}/pause")
async def pause_download(task_id: str):
    """暂停下载"""

@router.post("/{task_id}/resume")
async def resume_download(task_id: str):
    """继续下载"""

@router.delete("/{task_id}")
async def cancel_download(task_id: str):
    """取消下载"""

@router.get("/list")
async def get_downloads():
    """获取下载列表"""

@router.get("/{task_id}/status")
async def get_download_status(task_id: str):
    """获取下载状态"""
```

**实施步骤**：
1. 创建`routers/download.py`
2. 实现各个API端点
3. 添加权限验证
4. 实现WebSocket进度推送

### 4.4 下载前端管理

#### 4.4.1 下载页面改造
```tsx
// apps/web/src/pages/HomePage.tsx (下载tab)

export default function HomePage() {
  const { activeTab } = useAppStore()
  
  return (
    <div>
      {activeTab === 'downloads' && <DownloadsContent />}
      {/* 其他tab */}
    </div>
  )
}
```

**实施步骤**：
1. 在DownloadsContent中添加下载列表
2. 实现下载进度显示
3. 实现任务控制
4. 添加拖拽上传功能

#### 4.4.2 Download Store
```typescript
// apps/web/src/stores/download.ts

interface DownloadStore {
  downloads: Download[];
  activeCount: number;
  completedCount: number;
  
  // Actions
  addDownload: (video: Video) => Promise<void>;
  startDownload: (id: string) => Promise<void>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  removeDownload: (id: string) => Promise<void>;
  fetchDownloads: () => Promise<void>;
}
```

**实施步骤**：
1. 增强现有download store
2. 添加下载操作方法
3. 添加WebSocket进度监听
4. 实现状态同步

## 阶段5：完善和优化（Week 6）

### 5.1 UI/UX优化

#### 5.1.1 设置页面样式
- Tab切换动画
- 表单验证提示
- 加载状态显示
- 错误提示优化

#### 5.1.2 下载管理UI
- 进度条优化
- 速度显示
- 预计剩余时间
- 错误状态显示

### 5.2 性能优化

#### 5.2.1 数据库优化
- 添加索引
- 优化查询
- 实现数据分页
- 添加缓存机制

#### 5.2.2 下载优化
- 实现断点续传
- 优化并发控制
- 添加速度限制
- 优化任务调度

### 5.3 测试和文档

#### 5.3.1 测试
- API接口测试
- 前端组件测试
- 集成测试
- 性能测试

#### 5.3.2 文档
- API文档更新
- 用户手册
- 开发文档
- 部署文档

## 优先级建议

### 高优先级（必须实现）
1. ✅ 数据库表补充（cookies、downloads、settings）
2. ✅ 设置页面Tab改造
3. ✅ 下载设置功能
4. ✅ 数据管理功能
5. ✅ 基础下载管理

### 中优先级（重要功能）
1. ⭐ 下载进度实时显示
2. ⭐ 任务控制（暂停、继续、取消）
3. ⭐ 设置导入导出
4. ⭐ 数据库备份恢复

### 低优先级（锦上添花）
1. 💡 高级下载选项
2. 💡 自定义命名格式
3. 💡 下载队列管理
4. 💡 数据统计分析

## 技术要点

### 1. 数据库改造要点
- 在现有users表基础上添加新表
- 使用外键约束保证数据一致性
- 添加索引提高查询性能
- 实现数据库迁移工具

### 2. 设置页面改造要点
- 保持现有账号管理功能
- 添加Tab导航系统
- 实现平滑的Tab切换
- 保持统一的UI风格

### 3. 状态管理要点
- 扩展现有的Zustand store
- 实现设置持久化
- 添加错误处理
- 实现乐观更新

### 4. API设计要点
- 遵循RESTful规范
- 实现统一的错误处理
- 添加请求验证
- 与现有API风格保持一致

### 5. 下载管理要点
- 使用异步任务队列
- 实现并发控制
- 添加进度回调
- 实现断点续传

## 预期成果

### 阶段1完成后
- ✅ 完整的数据库结构（users + cookies + downloads + settings）
- ✅ 数据库迁移工具
- ✅ 数据库管理API

### 阶段2完成后
- ✅ 设置系统后端
- ✅ 设置CRUD操作
- ✅ 设置导入导出
- ✅ 设置API文档

### 阶段3完成后
- ✅ 设置页面Tab改造
- ✅ 账号管理功能保持
- ✅ 下载设置UI
- ✅ 数据管理UI
- ✅ 设置状态管理

### 阶段4完成后
- ✅ 下载管理系统
- ✅ 下载任务管理
- ✅ 下载进度显示
- ✅ 下载控制功能

### 阶段5完成后
- ✅ 完整的功能实现
- ✅ 优秀的UI/UX
- ✅ 性能优化
- ✅ 测试和文档

## 风险和挑战

### 1. 改造风险
- 现有功能可能受影响
- 数据迁移可能导致数据丢失
- UI改造可能影响用户体验

### 2. 技术风险
- yt-dlp API变化
- 下载任务管理复杂度
- 状态同步问题

### 3. 性能风险
- 大量下载任务
- 数据库性能瓶颈
- 内存使用问题

## 应对策略

### 1. 改造应对
- 使用数据库迁移工具
- 实现数据备份恢复
- 充分测试现有功能
- 保持向后兼容

### 2. 技术应对
- 使用成熟的下载库
- 实现任务队列管理
- 添加详细日志
- 实现错误恢复

### 3. 性能应对
- 实现任务限流
- 优化数据库查询
- 添加缓存机制
- 实现资源回收

## 总结

本实施计划基于当前项目状态，采用**改造而非重建**的策略：

1. **数据库改造**：在现有users表基础上添加cookies、downloads、settings表
2. **设置页面改造**：在现有SettingsPage内添加Tab导航，保持账号管理功能
3. **功能扩展**：逐步添加下载设置、数据管理等新功能
4. **渐进式开发**：分阶段实施，确保每个阶段都能正常工作

通过合理的时间安排和优先级控制，可以在6周内完成数据管理和下载配置功能的开发。每个阶段都有明确的目标和可验证的交付物，确保项目按计划推进，同时不影响现有功能的正常运行。