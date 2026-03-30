# PiliNote 数据管理和下载配置实施计划

## 当前项目状态分析

### ✅ 已完成功能
1. **用户认证系统**
   - 扫码登录
   - 短信登录
   - SESSDATA登录
   - 多账号管理

2. **视频源管理**
   - 收藏夹管理
   - 稍后再看
   - 链接解析

3. **性能优化**
   - 懒加载机制
   - 缓存优化
   - 分页加载

### 🏗️ 基础架构
1. **数据库**
   - users表（已创建，存储用户信息）
   - cookies表（模型已定义）
   - downloads表（模型已定义）
   - 数据库位置：`apps/api/data/pilinote.db`

2. **技术栈**
   - 后端：FastAPI + SQLAlchemy + SQLite
   - 前端：React + TypeScript + Zustand
   - 状态管理：Zustand（类似Pinia）

### ❌ 待实现功能
1. **下载管理系统**
2. **设置系统**
3. **数据持久化**

## 分阶段实施计划

## 阶段1：数据库建设（Week 1）

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
1. 在`apps/api/src/models/cookie.py`中完善模型定义
2. 在`apps/api/src/database.py`中添加表创建逻辑
3. 编写数据库迁移脚本
4. 测试表创建和数据插入

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
1. 在`apps/api/src/models/download.py`中完善模型定义
2. 添加表创建逻辑
3. 创建索引优化查询性能
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
3. 实现设置的CRUD操作
4. 添加默认设置初始化逻辑

### 1.2 数据库操作工具类

#### 创建数据库管理器
```python
# apps/api/src/utils/db_manager.py

class DatabaseManager:
    def __init__(self):
        self.db_path = "data/pilinote.db"
    
    def backup_database(self, output_path: str):
        """备份数据库"""
        pass
    
    def restore_database(self, input_path: str):
        """恢复数据库"""
        pass
    
    def get_database_size(self) -> int:
        """获取数据库大小"""
        pass
    
    def clean_database(self, table: str):
        """清理指定表的数据"""
        pass
```

**实施步骤**：
1. 创建数据库管理器类
2. 实现备份恢复功能
3. 实现数据库大小查询
4. 实现数据清理功能

### 1.3 数据库API端点

```python
# apps/api/src/routers/database.py

@router.get("/size")
async def get_database_size():
    """获取数据库大小"""

@router.post("/backup")
async def backup_database(output_path: str):
    """备份数据库"""

@router.post("/restore")
async def restore_database(input_path: str):
    """恢复数据库"""

@router.delete("/clean/{table}")
async def clean_table(table: str):
    """清理指定表"""
```

**实施步骤**：
1. 创建database.py路由
2. 实现各个API端点
3. 添加权限验证
4. 编写API文档

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
1. 创建schemas/settings.py
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
1. 创建SettingsService类
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
1. 创建settings.py路由
2. 实现各个API端点
3. 添加错误处理
4. 编写API文档

## 阶段3：设置系统前端（Week 3）

### 3.1 创建设置页面结构

#### 3.1.1 设置页面组件
```
apps/web/src/pages/SettingsPage.tsx
apps/web/src/pages/settings/
  ├── GeneralSettings.tsx      # 通用设置
  ├── DownloadSettings.tsx     # 下载设置
  ├── StorageSettings.tsx      # 存储设置
  ├── DataManagement.tsx       # 数据管理
  └── AboutSettings.tsx        # 关于设置
```

**实施步骤**：
1. 创建设置页面主组件
2. 创建分类设置子组件
3. 实现设置导航
4. 添加设置图标和样式

### 3.2 设置状态管理

#### 3.2.1 Settings Store
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
  
  // Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  resetSettings: (category?: string) => Promise<void>;
  exportSettings: (path: string) => Promise<void>;
  importSettings: (path: string) => Promise<void>;
}
```

**实施步骤**：
1. 创建settings store
2. 定义设置接口
3. 实现设置操作方法
4. 添加持久化支持

### 3.3 设置UI组件

#### 3.3.1 通用设置组件
```tsx
// apps/web/src/pages/settings/GeneralSettings.tsx

export default function GeneralSettings() {
  return (
    <section>
      <h3>主题设置</h3>
      <Select options={['light', 'dark', 'auto']} />
      
      <h3>语言设置</h3>
      <Select options={['zh-CN', 'en-US']} />
      
      <h3>自动下载</h3>
      <Switch />
      
      <h3>剪贴板监听</h3>
      <Switch />
    </section>
  );
}
```

**实施步骤**：
1. 创建通用设置UI
2. 实现主题切换
3. 实现语言切换
4. 实现开关组件

#### 3.3.2 下载设置组件
```tsx
// apps/web/src/pages/settings/DownloadSettings.tsx

export default function DownloadSettings() {
  return (
    <section>
      <h3>默认视频质量</h3>
      <Select options={qualityOptions} />
      
      <h3>最大并发数</h3>
      <Slider min={1} max={5} />
      
      <h3>速度限制</h3>
      <Input type="number" />
      
      <h3>下载路径</h3>
      <FolderPicker />
    </section>
  );
}
```

**实施步骤**：
1. 创建下载设置UI
2. 实现质量选择
3. 实现并发数调节
4. 实现路径选择

#### 3.3.3 存储设置组件
```tsx
// apps/web/src/pages/settings/StorageSettings.tsx

export default function StorageSettings() {
  return (
    <section>
      <h3>临时文件路径</h3>
      <FolderPicker />
      
      <h3>自动清理</h3>
      <Switch />
      
      <h3>保留失败任务</h3>
      <Switch />
      
      <h3>临时文件大小</h3>
      <Button onClick={cleanTemp}>清理</Button>
    </section>
  );
}
```

**实施步骤**：
1. 创建存储设置UI
2. 实现路径选择
3. 实现清理功能
4. 显示缓存大小

#### 3.3.4 数据管理组件
```tsx
// apps/web/src/pages/settings/DataManagement.tsx

export default function DataManagement() {
  return (
    <section>
      <h3>数据库大小</h3>
      <div>{databaseSize}</div>
      
      <h3>备份数据库</h3>
      <Button onClick={backupDatabase}>备份</Button>
      
      <h3>恢复数据库</h3>
      <Button onClick={restoreDatabase}>恢复</Button>
      
      <h3>清理数据</h3>
      <Button onClick={cleanDatabase}>清理</Button>
    </section>
  );
}
```

**实施步骤**：
1. 创建数据管理UI
2. 实现数据库大小显示
3. 实现备份恢复功能
4. 实现数据清理功能

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
1. 创建download.py路由
2. 实现各个API端点
3. 添加权限验证
4. 实现WebSocket进度推送

### 4.4 下载前端管理

#### 4.4.1 下载页面组件
```tsx
// apps/web/src/pages/DownloadsPage.tsx

export default function DownloadsPage() {
  return (
    <div>
      <DownloadHeader />
      <DownloadList />
      <DownloadStats />
    </div>
  );
}
```

**实施步骤**：
1. 创建下载页面
2. 实现下载列表
3. 实现进度显示
4. 实现任务控制

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
}
```

**实施步骤**：
1. 创建download store
2. 实现下载操作方法
3. 添加WebSocket进度监听
4. 实现状态同步

## 阶段5：完善和优化（Week 6）

### 5.1 性能优化

#### 5.1.1 数据库优化
- 添加索引
- 优化查询
- 实现数据分页

#### 5.1.2 下载优化
- 实现断点续传
- 优化并发控制
- 添加速度限制

### 5.2 用户体验优化

#### 5.2.1 UI优化
- 添加加载动画
- 优化错误提示
- 实现主题切换

#### 5.2.2 功能完善
- 添加批量操作
- 实现拖拽排序
- 添加快捷键支持

### 5.3 测试和文档

#### 5.3.1 测试
- 单元测试
- 集成测试
- 端到端测试

#### 5.3.2 文档
- API文档
- 用户手册
- 开发文档

## 优先级建议

### 高优先级（必须实现）
1. ✅ 数据库建设（cookies、downloads、settings表）
2. ✅ 基础设置系统（通用、下载设置）
3. ✅ 下载任务管理基础功能
4. ✅ 数据库备份恢复

### 中优先级（重要功能）
1. ⭐ 下载进度实时显示
2. ⭐ 任务控制（暂停、继续、取消）
3. ⭐ 设置导入导出
4. ⭐ 数据清理功能

### 低优先级（锦上添花）
1. 💡 高级下载选项
2. 💡 自定义命名格式
3. 💡 下载队列管理
4. 💡 数据统计分析

## 技术要点

### 1. 数据库设计要点
- 使用外键约束保证数据一致性
- 添加索引提高查询性能
- 实现软删除功能
- 添加时间戳字段

### 2. 状态管理要点
- 使用Zustand进行状态管理
- 实现持久化存储
- 添加错误处理
- 实现乐观更新

### 3. API设计要点
- 遵循RESTful规范
- 实现统一的错误处理
- 添加请求验证
- 实现API版本控制

### 4. 下载管理要点
- 使用异步任务队列
- 实现并发控制
- 添加进度回调
- 实现断点续传

## 预期成果

### 阶段1完成后
- ✅ 完整的数据库结构
- ✅ 数据库备份恢复功能
- ✅ 数据管理API

### 阶段2完成后
- ✅ 设置系统后端
- ✅ 设置CRUD操作
- ✅ 设置导入导出

### 阶段3完成后
- ✅ 设置系统前端
- ✅ 设置页面UI
- ✅ 设置状态管理

### 阶段4完成后
- ✅ 下载管理系统
- ✅ 下载任务管理
- ✅ 下载进度显示

### 阶段5完成后
- ✅ 完整的功能实现
- ✅ 性能优化
- ✅ 测试和文档

## 风险和挑战

### 1. 技术风险
- yt-dlp API变化
- 下载任务管理复杂度
- 状态同步问题

### 2. 性能风险
- 大量下载任务
- 数据库性能瓶颈
- 内存使用问题

### 3. 用户体验风险
- 设置过于复杂
- 下载操作不直观
- 错误提示不清晰

## 应对策略

### 1. 技术应对
- 使用成熟的下载库
- 实现任务队列管理
- 添加详细日志

### 2. 性能应对
- 实现任务限流
- 优化数据库查询
- 添加缓存机制

### 3. 用户体验应对
- 简化设置流程
- 提供清晰的反馈
- 添加帮助文档

## 总结

本实施计划分5个阶段，逐步实现PiliNote的数据管理和下载配置功能。通过合理的时间安排和优先级控制，可以在6周内完成核心功能的开发和优化。每个阶段都有明确的目标和可验证的交付物，确保项目按计划推进。

实施过程中需要重点关注数据库设计、状态管理、下载任务管理等关键技术点，同时注意性能优化和用户体验提升。通过充分的测试和文档编写，确保系统的稳定性和可维护性。