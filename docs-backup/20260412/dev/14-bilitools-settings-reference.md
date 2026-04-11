# BiliTools 设置面板参考文档

## 概述

本文档详细说明了BiliTools设置面板的数据结构、存储方式和管理机制，为PiliNote项目的设置系统设计提供参考。

## 完整的设置数据结构

### Settings 类型定义

```typescript
type Settings = {
  // 通用设置
  add_metadata: boolean;           // 添加元数据
  auto_check_update: boolean;      // 自动检查更新
  auto_download: boolean;          // 自动下载
  block_pcdn: boolean;             // 阻止PCDN
  check_update: boolean;           // 检查更新
  clipboard: boolean;              // 剪贴板监听
  convert: {
    danmaku: boolean;              // 转换弹幕
    mp3: boolean;                  // 转换MP3
    mp4: boolean;                  // 转换MP4
  };
  default: {
    res: number;                   // 默认分辨率
    abr: number;                   // 默认音频码率
    enc: number;                   // 默认编码
  };
  down_dir: string;                // 下载目录
  drag_search: boolean;            // 拖拽搜索
  format: {
    series: string;                // 系列命名格式
    item: string;                  // 项目命名格式
    file: string;                  // 文件命名格式
  };
  language: string;                // 语言
  max_conc: number;                // 最大并发数
  notify: boolean;                 // 通知
  temp_dir: string;                // 临时目录
  theme: 'light' | 'dark' | 'auto'; // 主题
  window_effect: 'auto' | 'mica' | 'acrylic' | 'sidebar' | 'none'; // 窗口效果
  organize: {
    auto_rename: boolean;          // 自动重命名
    top_folder: boolean;           // 顶层文件夹
    sub_folder: boolean;           // 子文件夹
  };
  proxy: {
    address: string;               // 代理地址
    username: string;              // 代理用户名
    password: string;              // 代理密码
  };
  sidecar: {
    aria2c: string;                // aria2c路径
    ffmpeg: string;                // ffmpeg路径
    danmakufactory: string;        // danmakufactory路径
  };
  speed_limit: number;             // 速度限制
}
```

## 设置页面分类

### 1. 通用设置

#### 语言
- 选项：多语言支持
- 类型：`string`
- 默认值：根据系统语言自动选择

#### 主题
- 选项：`light` | `dark` | `auto`
- 类型：`string`
- 默认值：`auto`
- 说明：自动主题根据系统主题切换

#### 窗口效果
- 选项：`auto` | `mica` | `acrylic` | `sidebar` | `none`
- 类型：`string`
- 默认值：`auto`
- 说明：
  - `auto`: 根据平台自动选择
  - `mica`: Windows 11+ Mica效果
  - `acrylic`: Windows 10+ Acrylic效果
  - `sidebar`: macOS Sidebar效果
  - `none`: 无窗口效果

#### 剪贴板监听
- 类型：`boolean`
- 默认值：`false`
- 说明：监听剪贴板自动解析B站链接

#### 拖拽搜索
- 类型：`boolean`
- 默认值：`true`
- 说明：支持拖拽链接到应用内搜索

#### 通知
- 类型：`boolean`
- 默认值：`true`
- 说明：下载完成时显示系统通知

#### 自动下载
- 类型：`boolean`
- 默认值：`false`
- 说明：解析后自动开始下载

#### 自动检查更新
- 类型：`boolean`
- 默认值：`false`
- 说明：启动时自动检查应用更新

### 2. 存储设置

#### 下载目录
- 类型：`string`
- 默认值：用户下载目录
- 说明：视频文件保存路径

#### 临时目录
- 类型：`string`
- 默认值：系统临时目录
- 说明：临时文件存储路径

#### 辅助工具路径
##### aria2c路径
- 类型：`string`
- 说明：aria2c下载工具路径
- 过滤器：`Executable File (*.exe)`

##### ffmpeg路径
- 类型：`string`
- 说明：ffmpeg视频处理工具路径
- 过滤器：`Executable File (*.exe)`

##### danmakufactory路径
- 类型：`string`
- 说明：弹幕处理工具路径
- 过滤器：`Executable File (*.exe)`

#### 缓存管理
##### 缓存类型
- `log`: 日志缓存
- `temp`: 临时缓存
- `webview`: WebView缓存
- `database`: 数据库缓存

##### 操作
- 查看缓存大小
- 清理指定缓存
- 打开缓存目录

#### 数据库管理
##### 导入数据库
- 选择数据库文件导入
- 支持数据恢复

##### 导出数据库
- 选择保存路径
- 文件名格式：`Storage_{timestamp}`
- 支持数据备份

### 3. 下载设置

#### 默认质量设置

##### 分辨率
- 类型：`number`
- 选项：B站支持的分辨率级别
- 说明：默认视频分辨率

##### 音频码率
- 类型：`number`
- 选项：B站支持的音频码率
- 说明：默认音频码率

##### 编码
- 类型：`number`
- 选项：B站支持的编码格式
- 说明：默认视频编码

#### 最大并发数
- 类型：`number`
- 选项：1-5
- 默认值：根据系统性能自动选择
- 说明：同时下载的最大任务数

#### 速度限制
- 类型：`number`
- 单位：MiB/s
- 最大值：10 GiB/s
- 说明：下载速度限制，0表示不限制

#### 代理设置

##### 代理地址
- 类型：`string`
- 格式：`http://proxy.example.com:port` 或 `socks5://proxy.example.com:port`
- 占位符：代理地址示例

##### 代理用户名
- 类型：`string`
- 说明：代理认证用户名（可选）

##### 代理密码
- 类型：`string`
- 说明：代理认证密码（可选）

### 4. 策略设置

#### 添加元数据
- 类型：`boolean`
- 默认值：`true`
- 说明：下载时添加NFO等元数据文件

#### 阻止PCDN
- 类型：`boolean`
- 默认值：`true`
- 说明：阻止使用PCDN节点，提高下载速度

#### 转换设置

##### 转换弹幕
- 类型：`boolean`
- 默认值：`true`
- 说明：将弹幕转换为ASS等格式

##### 转换MP3
- 类型：`boolean`
- 默认值：`false`
- 说明：提取音频并转换为MP3格式

##### 转换MP4
- 类型：`boolean`
- 默认值：`false`
- 说明：转换视频为MP4容器格式

#### 文件组织

##### 自动重命名
- 类型：`boolean`
- 默认值：`true`
- 说明：根据命名规则自动重命名文件

##### 顶层文件夹
- 类型：`boolean`
- 默认值：`true`
- 说明：为每个系列创建顶层文件夹

##### 子文件夹
- 类型：`boolean`
- 默认值：`true`
- 说明：为每个项目创建子文件夹

参考文档：https://btjawa.top/bilitools/organize

### 5. 格式设置

#### 命名格式

##### 系列命名格式
- 类型：`string`
- 说明：文件夹命名规则
- 占位符示例：
  - `{title}`: 系列标题
  - `{up}`: UP主名称
  - `{pubtime:YYYY-MM-DD}`: 发布时间
  - `{mid}`: UP主MID

##### 项目命名格式
- 类型：`string`
- 说明：项目文件夹命名规则
- 占位符示例：
  - `{title}`: 项目标题
  - `{idx}`: 项目序号
  - `{bvid}`: 视频BV号
  - `{pubtime:YYYY-MM-DD}`: 发布时间

##### 文件命名格式
- 类型：`string`
- 说明：文件命名规则
- 占位符示例：
  - `{title}`: 视频标题
  - `{idx}`: 视频序号
  - `{part}`: 分P序号
  - `{pubtime:YYYY-MM-DD_HH-mm-ss}`: 完整时间戳
  - `{bvid}`: 视频BV号
  - `{aid}`: 视频AID
  - `{p}`: 分P序号
  - `{quality}`: 视频质量
  - `{res}`: 分辨率
  - `{fps}`: 帧率
  - `{codec}`: 编码格式
  - `{size}`: 文件大小

#### 命名模板快捷按钮
- 系列模板：`{pubtime:YYYY-MM-DD} {title}`, `{title}`, `{up} - {title}`
- 项目模板：`{title}`, `{idx:02d} {title}`, `{bvid}`, `{pubtime:YYYY-MM-DD} {title}`
- 文件模板：`{title}`, `{p} {title}`, `{idx:02d} {title}`, `{pubtime:YYYY-MM-DD_HH-mm-ss} {title}`

参考文档：https://btjawa.top/bilitools/naming

## 数据管理方式

### 1. Pinia Store管理

#### Store定义
```typescript
export const useSettingsStore = defineStore('settings', () => {
  const s = reactive<Settings>({
    add_metadata: true,
    auto_check_update: false,
    auto_download: false,
    block_pcdn: true,
    check_update: true,
    clipboard: false,
    convert: {
      danmaku: true,
      mp3: false,
      mp4: false,
    },
    default: {
      res: Number(),
      abr: Number(),
      enc: Number(),
    },
    down_dir: String(),
    drag_search: true,
    format: {
      series: String(),
      item: String(),
      file: String(),
    },
    language: String(),
    max_conc: Number(),
    notify: true,
    temp_dir: String(),
    theme: 'auto',
    window_effect: 'auto',
    organize: {
      auto_rename: true,
      top_folder: true,
      sub_folder: true,
    },
    proxy: {
      address: String(),
      username: String(),
      password: String(),
    },
    sidecar: {
      aria2c: String(),
      ffmpeg: String(),
      danmakufactory: String(),
    },
    speed_limit: Number(),
  });

  const isDark = ref(false);

  const observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark');
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  const proxyUrl = computed(() => {
    if (!s.proxy.address.length) return null;
    const url = new URL(s.proxy.address);
    url.username = s.proxy.username || '';
    url.password = s.proxy.password || '';
    return url.toString();
  });

  const proxyConfig = computed(() => ({
    url: s.proxy.address || '*',
    basicAuth: {
      username: s.proxy.username,
      password: s.proxy.password,
    },
    noProxy: s.proxy.address ? undefined : '*',
  }));

  return { ...toRefs(s), isDark, proxyUrl, proxyConfig };
});
```

#### 特点
- 使用Vue 3 Composition API
- 响应式数据管理
- 计算属性自动更新
- 主题实时监听

### 2. Tauri后端存储

#### 配置写入
```typescript
async configWrite(settings: Partial<{ [key in string]: JsonValue }>): Promise<Result<null, TauriError>>
```

#### 特点
- 双向数据绑定
- 自动持久化
- 部分更新支持
- 错误处理机制

### 3. 缓存管理

#### 获取缓存大小
```typescript
async getSize(key: CacheKey, event: TAURI_CHANNEL<number>): Promise<Result<null, TauriError>>
```

#### 清理缓存
```typescript
async cleanCache(key: CacheKey): Promise<Result<null, TauriError>>
```

#### 打开缓存目录
```typescript
async openCache(key: CacheKey): Promise<Result<null, TauriError>>
```

#### 缓存类型
- `log`: 日志文件
- `temp`: 临时文件
- `webview`: WebView缓存
- `database`: 数据库文件

### 4. 数据库管理

#### 导入数据库
```typescript
async dbImport(input: string): Promise<Result<null, TauriError>>
```

#### 导出数据库
```typescript
async dbExport(output: string): Promise<Result<null, TauriError>>
```

#### 特点
- 支持数据备份
- 支持数据迁移
- 支持数据恢复

## 关键特点

### 1. 响应式数据管理
- Vue 3 + Pinia实现
- 自动响应式更新
- 计算属性自动计算

### 2. 分层存储架构
- 前端：Pinia Store
- 后端：Tauri配置文件
- 数据同步：自动双向绑定

### 3. 类型安全
- 完整的TypeScript类型定义
- 编译时类型检查
- IDE智能提示

### 4. 实时同步
- 设置修改立即生效
- 自动保存到后端
- 无需手动保存

### 5. 缓存管理
- 分类缓存管理
- 查看缓存大小
- 一键清理缓存

### 6. 数据备份
- 数据库导入导出
- 支持完整备份
- 支持数据迁移

### 7. 命名模板
- 自定义命名规则
- 丰富的占位符
- 快捷模板按钮

### 8. 代理支持
- HTTP/HTTPS代理
- SOCKS5代理
- 用户名密码认证

### 9. 性能优化
- 最大并发数控制
- 速度限制功能
- 阻止PCDN节点

### 10. 主题系统
- 浅色/深色/自动主题
- 多种窗口效果
- 平台自适应

## PiliNote应用建议

### 1. 数据库表设计
```sql
CREATE TABLE settings (
    id INTEGER PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    type VARCHAR(20) NOT NULL,  -- boolean, string, number, object
    category VARCHAR(50),       -- general, storage, download, strategy, format
    description TEXT,
    default_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. 必需设置项
- 下载目录
- 默认视频质量
- 最大并发数
- 主题设置

### 3. 可选设置项
- 代理设置
- 速度限制
- 命名格式
- 文件组织规则

### 4. 参考实现
- 使用Pinia Store管理前端状态
- 通过API同步到后端数据库
- 实现设置导入导出功能
- 支持缓存管理和清理

### 5. 差异化考虑
- PiliNote是Web应用，不需要窗口效果
- PiliNote的下载策略可能更简单
- PiliNote可以增加更多云存储相关设置
- PiliNote的命名格式可以更灵活

## 总结

BiliTools的设置系统设计非常完善，具有以下优点：

1. **全面性**：覆盖了用户可能需要的所有配置选项
2. **易用性**：直观的分类和清晰的说明
3. **灵活性**：支持自定义命名和多种配置
4. **可靠性**：完善的备份和恢复机制
5. **性能**：精细的性能控制和优化选项

PiliNote可以参考这个设计，结合Web应用特点，构建自己的设置系统。