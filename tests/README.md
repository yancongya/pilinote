# 测试目录

`tests/` 包含仓库级 Playwright 回归测试和 Python 测试。Playwright 配置文件也位于此处，因此
`testDir` 指向配置文件所在目录，而不是 `tests/tests`。

以下命令从仓库根目录运行。先用 `pnpm install` 安装根目录的 Playwright 依赖，
用 `pnpm --dir apps/web install` 安装 Web 依赖；Python 命令使用已安装后端依赖的虚拟环境。

## 测试位置与运行方式

### 重构安全冒烟

`bash scripts/smoke-refactor.sh` 执行定向前端单测、类型、纯模块边界及临时运行目录/内存 DB 后端回归；`--build` 可选构建。退出时核验真实状态和已有暂存内容不变，不安装依赖。详见 [refactor-smoke.md](./refactor-smoke.md)。

真实浏览器的受控 API 流程单独执行，覆盖桌面/移动详情、分 P、合集、重下载、AI 面板和请求乱序，详见 [pilinote-browser-regression.md](./pilinote-browser-regression.md)。不能把本地冒烟通过或 `--list` 视为真实账号、下载、模型及完整后端验收。

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

图文/Markdown 测试的预期基址已改为当前配置，仍独立断言完整 API 路径与编码 query。
默认环境不再需要显式 localhost 才能通过；也可验证环境覆盖：

```bash
VITE_API_BASE_URL=http://localhost:8000 pnpm --dir apps/web test:run
```

`apiConfig.test.ts` 另以固定预期测试 runtime/env/默认基址优先级、生产相对路径、
localhost/IPv6/LAN、图片路径编码与 WebSocket 配置；这些单测不请求真实后端。

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

队列执行测试将设置服务模块替换为 fixture，避免 `patch()` 导入真实 AI/ASR singleton
刷新本地运行态。涉及服务导入的回归仍建议在启动 pytest 前设置临时 `PILINOTE_RUNTIME_DIR`
和 `DATABASE_URL=sqlite:///:memory:`；仅在测试函数开始后设置环境可能晚于模块初始化。
NFO 测试显式 await 异步生成，并 mock 封面/头像步骤，产物仅落在 pytest 临时目录。
`ai_runtime_state_service.py` 的缓存路径仍固定在项目内，不受运行目录变量隔离；本轮依靠
模块替身避免导入，再用运行前后内容哈希核验未改动。哈希核验是改动检测，不是写入防护，
不能把这个受控测试文件的结果推广为所有后端测试均已隔离。

## 生成文件

- `test-results/`：Playwright 运行结果（自动生成）
- `playwright-report/`：Playwright HTML 报告（自动生成）
