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

## Backend binary expectations

Before packaging, provide API executables:

- `apps/desktop/resources/backend/mac/pilinote-api-macos`
- `apps/desktop/resources/backend/win/pilinote-api.exe`

Use helper commands:

```bash
pnpm --dir apps/desktop build:api:mac
pnpm --dir apps/desktop build:api:win
```
