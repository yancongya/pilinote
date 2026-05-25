# 安装包打包与脚本说明

本文档说明如何在仓库根目录通过脚本构建：

- 文档站启动二进制（docs launcher）
- 桌面端安装包（mac / Windows / Linux）

## 1. 前置条件

在仓库根目录执行，确保已安装：

- Node.js + pnpm
- Python（推荐复用 `apps/api/venv`）
- Electron 依赖下载可用网络

首次建议先安装 desktop 依赖：

```bash
pnpm --dir apps/desktop install
```

## 2. 根目录脚本

### 2.1 构建文档二进制

脚本：

```bash
./build-docs-binary.command [mac|win|linux]
```

示例：

```bash
./build-docs-binary.command mac
```

执行内容：

1. 构建 VitePress 静态产物（`apps/docs/.vitepress/dist`）
2. 用 PyInstaller 构建 docs launcher（二进制）
3. 拷贝到 `apps/desktop/resources/docs/<target>/`

产物目录：

- `apps/desktop/resources/docs/mac/`
- `apps/desktop/resources/docs/win/`
- `apps/desktop/resources/docs/linux/`

### 2.2 一键构建三端安装包

脚本：

```bash
./pack-installers.command
```

执行内容：

1. 依次构建 docs launcher（mac / win / linux）
2. 依次执行 desktop 打包（mac dmg / win nsis / linux AppImage）

安装包输出目录：

```text
apps/desktop/dist/
```

常见文件：

- `PiliNote-<version>-arm64.dmg`
- `PiliNote Setup <version>.exe`
- `PiliNote-<version>-arm64.AppImage`

## 3. 单独打包命令（不走一键脚本）

如果只想打某一个平台：

```bash
pnpm --dir apps/desktop pack:mac
pnpm --dir apps/desktop pack:win
pnpm --dir apps/desktop pack:linux
```

## 4. 测试建议

### 4.1 基础检查

1. 安装包文件已生成到 `apps/desktop/dist/`
2. 启动后端健康检查可达：`/health`
3. 设置页路径可保存并落盘

### 4.2 mac 本机可验证项

- `.dmg` 可安装启动
- `~/Library/Application Support/pilinote-desktop/` 下有：
  - `data/`
  - `logs/`
  - `downloads/`
  - `temp/`

### 4.3 跨平台验证建议

- Windows 安装和运行建议在 Windows 机器或 CI 上验证
- Linux AppImage 建议在目标发行版实际运行验证

## 5. 常见问题

### Q1: docs launcher 为什么没生成？

先确认：

```bash
pnpm --dir apps/docs build
```

并检查是否存在：

```text
apps/docs/.vitepress/dist
```

### Q2: 打包很慢或卡住？

首次构建需要下载 Electron / 签名相关依赖，耗时会明显更长。

### Q3: 为什么出现未签名提示？

当前流程默认是未签名构建，mac 上会有系统安全提示，属于预期行为。
