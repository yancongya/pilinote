# 整理基线（2026-09-30）

## 已核对的结构

- 前端：`apps/web/src`，React / TypeScript / Zustand；`pnpm build` 执行 `tsc -b && vite build`。
- 后端：`apps/api/src`，FastAPI / SQLAlchemy；应用入口实际为 `apps/api/main.py`。
- 文档站：`pilinote-docs`，不是 AGENTS.md 描述的 `apps/docs`。
- 前端已有 Vitest 和 Playwright 脚本，不能继续按“无正式测试”评估。
- 后端已有 `apps/api/tests` 与 `pytest.ini`，但配置包含全项目 80% 覆盖率门槛，定向检查应区分局部测试和全量覆盖率验收。

## 当前工作区风险

用户已有迁移脚本、后端测试、Playwright 配置移动，以及文档、技能、参考库删除。此次 commit 只使用本轮明确文件清单，避免将原有 staged / unstaged / untracked 变更混入。

根级 Playwright 配置已被用户移至 `tests/playwright.config.ts`，其 `testDir: './tests'` 会相对配置目录寻找 `tests/tests`；迁移后的路径需在后续测试布局阶段修复。该配置本轮不修改。

当前 checkout 未发现 `apps/api/venv`、`apps/api/.venv`、根 `.venv` 或 `apps/web/node_modules`。实际验证环境和执行结果以试点报告为准。

## 优先级

1. 试点提取纯逻辑，保留旧调用入口，以验证渐进式拆分方式。
2. 校准 AGENTS.md、测试说明中的后端入口、文档路径和测试命令。
3. 明确 Vitest、两份 Playwright 配置和 pytest 的测试边界，修复迁移后的路径。
4. 逐模块梳理视频详情、AI 笔记、下载队列职责及依赖，再设置自动边界检查。

## 分工

GPT-5.6 Luna / low 完成只读结构、文档和测试盘点。两个 GPT-5.6 Terra / low 分别负责前端队列归一化及后端字幕纯逻辑提取。GPT-6 Sol / low 在变更完成后独立审查。
