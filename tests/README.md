# 测试目录

本目录包含项目的测试代码。

## 目录结构

```
tests/
├── home.spec.ts           # Playwright 前端测试
├── link-parser.spec.ts    # Playwright 链接解析 API 测试
└── test_link_parser.py   # Python 单元测试
```

## 测试类型

### 1. 前端测试 (Playwright)

```bash
# 运行所有 Playwright 测试
npx playwright test

# 运行前端测试
npx playwright test tests/home.spec.ts

# 运行 API 测试
npx playwright test tests/link-parser.spec.ts
```

### 2. 后端单元测试 (pytest)

```bash
# 运行 Python 单元测试
cd apps/api && source venv/bin/activate
python -m pytest ../../tests/test_link_parser.py -v
```

## 测试配置

- `playwright.config.ts` - Playwright 配置文件

## 测试结果

- `test-results/` - Playwright 测试结果（自动生成）

---

## 关联文档

- [web/link-parser.md](../web/link-parser.md) - 链接解析功能测试

---

[返回上级](../README.md)