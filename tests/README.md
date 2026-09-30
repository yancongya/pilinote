# 测试目录

`tests/` 包含仓库级 Playwright 回归测试和 Python 测试。Playwright 配置文件也位于此处，因此
`testDir` 指向配置文件所在目录，而不是 `tests/tests`。

以下命令从仓库根目录运行。先用 `pnpm install` 安装根目录的 Playwright 依赖，
用 `pnpm --dir apps/web install` 安装 Web 依赖；Python 命令使用已安装后端依赖的虚拟环境。

## 测试位置与运行方式

### 根目录 Playwright：`tests/*.spec.ts`

这些测试覆盖页面与部分 API 流程；其中若干用例需要已启动的前端/后端，或会访问
Bilibili。先列举用例可验证配置迁移而不启动浏览器、不访问网络：

```bash
pnpm exec playwright test --config tests/playwright.config.ts --list
```

需要具备本地服务和相应测试条件时，才运行完整套件：

```bash
pnpm exec playwright test --config tests/playwright.config.ts
```

### Web Vitest：`apps/web/src/**/__tests__` 与 `*.test.ts(x)`

这是 React 和纯工具逻辑的快速检查路径，不依赖真实登录态或外部网络：

```bash
pnpm --dir apps/web test:run
```

可针对单个文件执行：

```bash
pnpm --dir apps/web exec vitest run src/__tests__/newQueue.test.ts
```

### Web 端到端：`apps/web/e2e/*.spec.ts`

此套件使用独立的 `apps/web/playwright.config.ts`；该配置会启动或复用 Vite 服务，
其中 API 断言仍要求本地后端可用：

```bash
pnpm --dir apps/web exec playwright test --config playwright.config.ts
```

### API pytest：`apps/api/tests/test_*.py`

后端测试由 `apps/api/pytest.ini` 发现和配置。进入 API 虚拟环境后再运行；部分测试
可能需要额外服务、媒体工具或受控测试数据，不应作为前端快速检查。

```bash
cd apps/api
source venv/bin/activate
python -m pytest tests -v
```

### 仓库级 Python 测试：`tests/test_*.py`

这些文件不在 API 默认的 `testpaths = tests` 范围内，需要显式指定路径。
例如从仓库根目录运行一个现有测试：

```bash
cd apps/api
source venv/bin/activate
python -m pytest ../../tests/test_link_parser.py -v
```

后端 pytest 配置还包含全项目 80% 覆盖率门槛。仅验证局部用例时，可在命令中加
`-o addopts=''`，但这不代表满足全量覆盖率要求；部分用例还会访问真实外部服务。

## 生成文件

- `test-results/`：Playwright 运行结果（自动生成）
- `playwright-report/`：Playwright HTML 报告（自动生成）
