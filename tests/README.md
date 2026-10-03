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

这是 React 和纯工具逻辑的快速检查路径，不依赖真实登录态或外部网络。
Vite 的单测发现限制为 `src/` 下的 `*.test.ts(x)` / `*.spec.ts(x)`，不收集 `e2e/` 中的 Playwright 用例：

```bash
pnpm --dir apps/web test:run
```

部分既有图文/Markdown 测试固定断言 `http://localhost:8000`，但默认 API 配置使用
`127.0.0.1`。本轮默认环境仍有 4 项旧断言失败；受控基址下的完整单测命令为：

```bash
VITE_API_BASE_URL=http://localhost:8000 pnpm --dir apps/web test:run
```

这是测试环境差异，不代表已修复默认配置或验证真实后端。

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

后端测试位于 `apps/api/tests`。当前 `pytest.ini` 的段名为 `[tool:pytest]`，而 pytest
需要 `[pytest]`，因此不能声称其发现/覆盖率配置已生效。本轮保留此既有配置，显式指定测试路径。进入 API 虚拟环境后再运行；部分测试
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

后端配置文本包含全项目 80% 覆盖率门槛，但本轮没有全库 coverage 验收。定向检查使用
`-o addopts=''` 明确局部范围；若 macOS 缺少 libpq，已安装的 PostgreSQL 插件可能在收集前失败，
SQLite/纯规则测试可加 `-p no:postgresql`，不能据此声称 PostgreSQL 测试通过。

```bash
cd apps/api
source venv/bin/activate
DATABASE_URL=sqlite:///:memory: python -m pytest -p no:postgresql -o addopts='' -q tests/test_note_pipeline.py tests/test_note_context.py tests/test_subtitle_utils.py tests/test_note_service_boundaries.py tests/test_refactor_boundaries.py
python ../../scripts/check_refactor_boundaries.py
```

边界检查使用标准库，不加载后端服务；检查所列纯模块的直接依赖和常见 IO，不是全仓依赖分析或安全证明。

## 生成文件

- `test-results/`：Playwright 运行结果（自动生成）
- `playwright-report/`：Playwright HTML 报告（自动生成）
