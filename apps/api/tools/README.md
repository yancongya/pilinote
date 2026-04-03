# 工具目录

这个目录包含了 PiliNote 项目所需的二进制工具。

## 目录结构

```
tools/
├── macos/      # macOS 平台工具
├── linux/      # Linux 平台工具
├── windows/    # Windows 平台工具
└── setup_tools.py  # 工具设置脚本
```

## 包含的工具

- **ffmpeg**: 视频处理工具
- **aria2c**: 多线程下载工具

## 初始化工具

### 自动设置（推荐）

如果你已经在系统中安装了 ffmpeg 和 aria2c，可以运行自动设置脚本：

```bash
cd apps/api
python3 tools/setup_tools.py
```

这个脚本会：
1. 自动检测当前平台
2. 复制系统中的 ffmpeg 和 aria2c 到对应平台目录
3. 添加执行权限

### 手动设置

如果自动设置脚本无法使用，可以手动复制工具文件：

#### macOS
```bash
# 复制工具
cp /opt/homebrew/bin/ffmpeg tools/macos/
cp /opt/homebrew/bin/aria2c tools/macos/

# 添加执行权限
chmod +x tools/macos/ffmpeg
chmod +x tools/macos/aria2c
```

#### Linux (Ubuntu/Debian)
```bash
# 复制工具
cp /usr/bin/ffmpeg tools/linux/
cp /usr/bin/aria2c tools/linux/

# 添加执行权限
chmod +x tools/linux/ffmpeg
chmod +x tools/linux/aria2c
```

#### Windows
从官方下载二进制文件并放入 `tools/windows/` 目录：
- ffmpeg: https://ffmpeg.org/download.html
- aria2c: https://aria2.github.io/

## 平台支持

- ✅ macOS (Darwin)
- ✅ Linux
- ✅ Windows

## 系统依赖

如果系统未安装这些工具，可以使用以下命令安装：

### macOS
```bash
brew install ffmpeg aria2
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install ffmpeg aria2
```

### Arch Linux
```bash
sudo pacman -S ffmpeg aria2
```

### Windows
- ffmpeg: https://ffmpeg.org/download.html
- aria2c: https://aria2.github.io/

## 使用方式

项目会自动检测并使用项目内的工具，无需额外配置。

优先级：
1. 项目内工具（`tools/{platform}/`）
2. 系统工具（PATH）
3. 默认命令名称

## 更新工具

要更新工具版本，重新运行设置脚本或手动复制新版本：

```bash
cd apps/api
python3 tools/setup_tools.py
```

## 注意事项

- 工具文件可能很大（ffmpeg 约 100MB+）
- 不同平台的二进制文件不能混用
- 确保工具具有执行权限
- Git 可能需要配置忽略二进制文件的更改

## Git 配置

如果不想提交二进制文件，可以将工具目录添加到 `.gitignore`：

```
apps/api/tools/macos/
apps/api/tools/linux/
apps/api/tools/windows/
```

或者使用 Git LFS（Large File Storage）管理大文件。