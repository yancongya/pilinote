# PiliNote 隔离浏览器回归

这是可复用的 Playwright CLI 流程，不是 `@playwright/test` spec。真实 Chrome 只访问 `127.0.0.1:5178` 的 Vite 前端；API 由 `pilinote-browser-mock.js` 伪造，外网请求会被中止，WebSocket 在导航前禁用。不要连接真实后端或输入账号凭据。

## 启动

从前端目录启动已安装的 Vite，不安装依赖：

```bash
cd apps/web
./node_modules/.bin/vite --host 127.0.0.1 --port 5178 --strictPort
```

在另一个终端从仓库根目录运行 CLI，使用新的独占会话：

```bash
export PWCLI="${HOME}/.codex/skills/playwright/scripts/playwright_cli.sh"
pw() { "$PWCLI" --session pilinote-isolated-smoke "$@"; }
pw open about:blank --headed
pw run-code --filename "$PWD/tests/pilinote-browser-mock.js"
pw run-code 'async (page) => page.evaluate(() => window.__pilinoteReadMockState())'
pw goto http://127.0.0.1:5178/video/BV1TEST001
pw snapshot
```

此 CLI session 由本流程独占。必须先在 `about:blank` 安装 mock，读取状态得到空 requests/errors/unmocked 后才进入应用。CLI 即使退出码为 0 也可能显示 `### Error`，遇到安装错误立即停止，不能继续导航。fixture 是单个 `async (page) => { ... }` 函数，不是顶层执行代码或 IIFE。重装需新会话，避免重复注册绑定。若从其他目录运行，请将 fixture 路径改为绝对路径。

## 回归流程

1. At desktop width, confirm the fixture title, author, current-submission section, two P entries, and collection selector render.
2. Choose `合集列表 (2)` from a fresh snapshot; confirm both mock collection submissions render. Choose `当前投稿 (2)` again.
3. Click a specific `下载此视频` P card from a fresh snapshot. Confirm one POST to `/api/queue/tasks` contains the selected CID/page; confirm task refresh returns the mock task.
4. P2 入队后，主按钮应显示 `添加剩余 1 个视频`，只提交 P1；一个任务不创建调度器。空队列时主按钮一次提交两 P 及含两 ID 的调度器；合集模式提交三 P 及含三 ID 的合集调度器。
5. Navigate to `/video/BV1DOWN001`; click the main add button and verify the re-download confirmation appears. Confirm once and verify its task POST has the expected video/CID metadata.
6. Return to the primary detail, inspect the AI note preview, use `打开面板`, switch among `字幕`, `笔记`, and `导图`, then use the panel return control and verify detail is restored.
7. Repeat detail/AI preview and tab navigation at a mobile viewport (390×844); record a screenshot at each responsive checkpoint.
8. Run the controlled race check in this same mounted `VideoDetailPage`: visit `/video/BV1RACEA`, then use client-side navigation to `/video/BV1RACEB` before A's first mocked detail response resolves. Confirm B's title, no loading skeleton, and no error after A responds late. Navigate back to A; its first local-playback map is delayed. Navigate to B after A detail renders and before that map resolves, confirm B's P1 has the local-playable state after B's map, then wait for A's stale map and confirm B's state remains. The mock fixture defaults only A's first detail and first playback-map responses to a 1.5-second delay.

Refs 只对最近一次 snapshot 有效。每次重要状态变化后重新 snapshot，并使用最新 refs 点击；常规 UI 操作不要用 `run-code` 代替。

## 证据与安全检查

CLI 输出、截图、请求与 console 快照写入 `output/playwright/pilinote-full-goal/`。用 `pw run-code 'async (page) => page.evaluate(() => window.__pilinoteReadMockState())'` 查看记录。验收要求：`unmocked` 和 `errors` 为空，API 全部标为 `mocked-api`，非 Vite 外网全部中止；整个 `/api` 代理前缀被拦截，未知路径返回 mock 501，不能落到真实后端。请求 URL 即使包含 8000 端口，也由 route.fulfill 在浏览器内响应，不表示触达该主机。任务/调度器 payload 必须匹配 UI 选择。WebSocket 禁用标志为 `window.__PILINOTE_WS_DISABLED__`。

竞态场景优先点击应用内链接；若无适用入口，可使用已授权的客户端路由动作 `await page.evaluate(() => { history.pushState({}, '', '/video/BV1RACEB'); dispatchEvent(new PopStateEvent('popstate')); })`，保持 React 页面挂载。其余 UI 仍按 snapshot refs 操作。

可执行的请求乱序脚本显式设置 2 秒延迟，先清目标 sessionStorage 并 reload 清模块内存，再清本轮请求记录；随后 A/B 之间仅使用客户端路由，不重新加载。需使用包含最新版 fixture 的新会话，回到详情页后执行：

```bash
pw run-code --filename "$PWD/tests/pilinote-browser-races.js"
```

每轮证据只保留在本地，不提交生成物。结束后停止 Vite 并关闭命名浏览器 session。源码负责人通知修复完成后，使用新的 CLI session 重跑完整流程。

本流程不证明真实 B 站登录、下载、模型生成、后端启动或媒体解码通过。不要点击“重新生成”、保存编辑、模型测试、真实 B 站链接或播放不存在的模拟视频。早期安装失败或不完整 fixture 的日志不算成功证据。
