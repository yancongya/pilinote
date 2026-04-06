# 前端功能逻辑说明

本文档说明自动下载功能的前端实现逻辑。

## 功能模块

### 1. 配置管理模块

**功能**：允许用户配置自动下载的各种参数

**主要功能**：
- 启用/禁用自动下载
- 设置扫描间隔（分钟）或 Cron 表达式
- 配置视频质量（质量值、编码格式、音频码率、输出格式）
- 配置视频筛选规则（时长限制、UP 主白名单/黑名单）
- 配置重试机制（最大重试次数、重试间隔）

**数据流**：
1. 页面加载时从后端 API 获取当前配置
2. 用户修改配置后，点击"保存配置"按钮
3. 前端调用后端 API 更新配置
4. 显示保存成功/失败提示

**关键逻辑**：
- 使用 React State 管理配置状态
- 实时验证配置有效性
- 配置变更前显示确认提示

---

### 2. 扫描记录模块

**功能**：显示自动下载的扫描历史记录

**主要功能**：
- 显示扫描记录列表（视频源类型、扫描时间、总数、新增数、状态）
- 支持刷新扫描记录
- 支持按视频源类型筛选
- 显示最近 50 条记录

**数据流**：
1. 页面加载时从后端 API 获取扫描记录
2. 用户点击"刷新"按钮时重新获取
3. 列表按扫描时间倒序排列

**关键逻辑**：
- 定时刷新（可选）
- 显示扫描状态（成功/失败）
- 失败记录显示错误信息

---

### 3. 手动触发模块

**功能**：允许用户手动触发扫描，不等待定时任务

**主要功能**：
- 手动触发收藏夹扫描
- 手动触发稍后再看扫描
- 显示扫描结果（总数、新增数、添加到队列数）

**数据流**：
1. 用户点击"立即扫描"按钮
2. 前端调用后端 API 触发扫描
3. 后端执行扫描并返回结果
4. 前端显示结果提示

**关键逻辑**：
- 显示加载状态
- 显示扫描进度
- 扫描完成后自动刷新扫描记录列表

---

### 4. 实时状态更新

**功能**：显示自动下载任务的实时状态

**主要功能**：
- 显示当前是否有扫描任务在运行
- 显示下次扫描时间
- 显示最近一次扫描的结果

**数据流**：
1. 通过 WebSocket 接收后端状态更新
2. 更新页面显示的状态信息
3. 提供任务进度提示

**关键逻辑**：
- 使用 WebSocket 建立实时连接
- 处理连接断开和重连
- 显示友好的状态提示

---

## 页面结构

```
自动下载设置页面
├── 基本设置区域
│   ├── 启用/禁用开关
│   ├── 扫描间隔输入
│   └── Cron 表达式输入
│
├── 视频质量设置区域
│   ├── 视频质量选择器
│   ├── 编码格式选择器
│   ├── 音频码率选择器
│   └── 输出格式选择器
│
├── 视频筛选规则区域
│   ├── 时长限制开关
│   ├── 最小时长输入
│   ├── 最大时长输入
│   ├── UP 主白名单
│   └── UP 主黑名单
│
├── 重试设置区域
│   ├── 最大重试次数输入
│   └── 重试间隔输入
│
├── 操作按钮区域
│   ├── 保存配置按钮
│   ├── 刷新扫描记录按钮
│   ├── 立即扫描收藏夹按钮
│   └── 立即扫描稍后再看按钮
│
└── 扫描记录区域
    ├── 扫描记录列表
    └── 状态信息显示
```

---

## 用户交互流程

### 配置修改流程

```
用户打开设置页面
    ↓
加载当前配置
    ↓
用户修改配置
    ↓
点击"保存配置"
    ↓
调用后端 API
    ↓
显示保存结果
```

### 手动扫描流程

```
用户点击"立即扫描"按钮
    ↓
显示加载状态
    ↓
调用后端 API
    ↓
后端执行扫描
    ↓
显示扫描结果
    ↓
刷新扫描记录列表
```

---

## 数据模型

### AutoDownloadConfig

```typescript
interface AutoDownloadConfig {
  enabled: boolean;              // 是否启用
  scan_interval_minutes: number;   // 扫描间隔（分钟）
  scan_cron?: string;             // Cron 表达式（可选）
  quality: number;                // 视频质量
  codec: string;                  // 编码格式
  audio_bitrate: number;          // 音频码率
  output_format: string;          // 输出格式
  min_duration?: number;          // 最小时长（秒）
  max_duration?: number;          // 最大时长（秒）
  allowed_uploaders?: string[];   // UP 主白名单
  blocked_uploaders?: string[];   // UP 主黑名单
  max_retries: number;            // 最大重试次数
  retry_interval: number;         // 重试间隔（秒）
}
```

### ScanRecord

```typescript
interface ScanRecord {
  id: string;                    // 记录 ID
  source_type: string;            // 视频源类型
  source_id: string;              // 视频源 ID
  last_scan_time: string;         // 最后扫描时间
  total_videos: number;           // 总视频数
  new_videos: number;             // 新视频数
  added_to_queue: number;         // 添加到队列数
  status: string;                 // 状态
}
```

---

## API 对接说明

### 获取配置

```typescript
GET /api/auto-download/config
Response: { success: boolean, data: AutoDownloadConfig }
```

### 更新配置

```typescript
POST /api/auto-download/config
Request: AutoDownloadConfig
Response: { success: boolean, message: string }
```

### 获取扫描记录

```typescript
GET /api/auto-download/scan-records?source_type=favorite
Response: { success: boolean, data: ScanRecord[] }
```

### 手动触发扫描

```typescript
POST /api/auto-download/scan/trigger?source_type=favorite&source_id=all
Response: { success: boolean, data: { total: number, new: number, added: number } }
```

---

## 注意事项

1. **配置验证**：前端需要验证配置的有效性，例如：
   - 扫描间隔必须大于 0
   - 视频质量必须在有效范围内
   - Cron 表达式格式正确

2. **错误处理**：需要处理以下错误：
   - API 调用失败
   - 配置保存失败
   - 扫描触发失败

3. **用户体验**：
   - 显示加载状态
   - 提供操作反馈
   - 友好的错误提示

4. **性能优化**：
   - 避免频繁的 API 调用
   - 使用缓存减少请求
   - 优化列表渲染性能