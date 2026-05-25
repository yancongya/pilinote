# PiliNote Desktop Packaging

## Install dependencies

```bash
pnpm --dir apps/desktop install
```

## Local desktop development

```bash
pnpm --dir apps/desktop dev
```

This starts:
- `apps/web` dev server (`http://127.0.0.1:5173`)
- `apps/api` uvicorn server (`http://127.0.0.1:8000`)
- Electron shell

## Package app (unsigned)

```bash
pnpm --dir apps/desktop pack:mac
pnpm --dir apps/desktop pack:win
```

## Frontend artifact policy (`web-dist`)

- `apps/desktop/web-dist/` is a build artifact and is intentionally **not committed**.
- Before packaging, always generate the latest frontend bundle from `apps/web`.

Recommended sequence:

```bash
pnpm --dir apps/desktop build:web
pnpm --dir apps/desktop sync:web
pnpm --dir apps/desktop pack:mac
```

(`pack:*` already includes `build:desktop`, but these commands are useful for explicit preflight checks.)

## Backend binary expectations

Before packaging, provide API executables:

- `apps/desktop/resources/backend/mac/pilinote-api-macos`
- `apps/desktop/resources/backend/win/pilinote-api.exe`

Use helper commands:

```bash
pnpm --dir apps/desktop build:api:mac
pnpm --dir apps/desktop build:api:win
```

## Docs launcher binary

Build a standalone docs launcher binary (serves `apps/docs/.vitepress/dist`):

```bash
./build-docs-binary.command mac
./build-docs-binary.command win
./build-docs-binary.command linux
```

Output locations:

- `apps/desktop/resources/docs/mac/`
- `apps/desktop/resources/docs/win/`
- `apps/desktop/resources/docs/linux/`

One-click full packaging from repo root:

```bash
./pack-installers.command
```
