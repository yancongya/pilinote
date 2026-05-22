# PiliNote - Coding Agent Guidelines

## Project Overview

PiliNote is a Bilibili video download manager with a monorepo structure:
- **Frontend**: React + TypeScript + Vite (`apps/web/`)
- **Backend**: FastAPI + Python (`apps/api/`)
- **Reference**: Cloned reference projects (`reference/`)

## Build Commands

### Frontend (apps/web/)
```bash
# Navigate to frontend directory
cd apps/web

# Install dependencies (use pnpm)
pnpm install

# Development server
pnpm dev                    # Start dev server at http://localhost:5173

# Build
pnpm build                  # TypeScript check + Vite build
pnpm preview                # Preview production build
```

### Backend (apps/api/)
```bash
# Navigate to backend directory
cd apps/api

# Activate virtual environment
source venv/bin/activate    # macOS/Linux

# Install dependencies
pip install -r requirements.txt
# OR
pip install -e .

# Development server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Database migrations (if using Alembic)
alembic upgrade head
```

## Testing

**Current Status**: No formal test framework is configured.

To test manually:
```bash
# Frontend - no test script available, use browser testing
# Backend - test API endpoints manually
curl http://localhost:8000/api/health
```

### 认证 API 测试（复用已有登录态）

本项目后端默认会从 `apps/api/data/pilinote.db` 读取认证信息。开发时测试需要登录态的接口，优先复用这份数据库里的活跃账号。

1. 从 `apps/api` 目录启动后端，确保配置实际指向 `sqlite:///./data/pilinote.db`。
2. 后端会通过 `HeadersManager.sync_cookies_from_db(user_id)` / `CookieManager.load_from_db(user_id)` 读取 `users` 和 `cookies` 表中的 `SESSDATA`、`bili_jct` 等信息。
3. 调用收藏夹、稍后再看、历史记录、账号状态等接口时，后端会自动带上这份登录态，不需要每次手动重新登录。
4. 如果要直接用 `curl` 测试，可先从数据库里取出 cookie，再手动加到请求头：
```bash
cd apps/api
sqlite3 data/pilinote.db "select name || '=' || value from cookies where user_id=(select id from users where is_active=1) and name in ('SESSDATA','bili_jct');"
curl -H 'Cookie: SESSDATA=...; bili_jct=...' http://localhost:8000/api/auth/status
```
5. 常用的鉴权测试接口：`/api/auth/status`、`/api/favorites/folders`、`/api/watch-later/list`、`/api/history/list`

## Linting & Formatting

### Frontend
- **ESLint**: Not explicitly configured (no .eslintrc found)
- **TypeScript**: Strict mode enabled in `tsconfig.json`
- **Prettier**: Not configured

To check TypeScript:
```bash
cd apps/web
npx tsc --noEmit          # Type check without emitting
```

### Backend
- **No linting configured** (no ruff, black, or flake8 found)
- Follow PEP 8 conventions

## Code Style Guidelines

### TypeScript/React

#### Imports
```typescript
// 1. External libraries (React, React Router, etc.)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

// 2. Internal imports (relative paths)
import { useAuthStore } from '../stores/auth'
import { apiService } from '../services/api'
import HomeContent from './components/HomeContent'

// 3. Types/interfaces (imported separately)
import type { User, ApiResponse } from '../types'
```

#### Naming Conventions
- **Components**: PascalCase (`HomePage.tsx`, `VideoListCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAuthStore`, `useVideoDownload`)
- **Utilities**: camelCase (`formatDuration`, `formatFileSize`)
- **Constants**: UPPER_SNAKE_CASE for config values
- **Files**: Match component name (`HomePage.tsx` → `HomePage`)

#### State Management (Zustand)
```typescript
// Store pattern
interface SomeState {
  // State properties
  user: User | null;
  
  // Actions
  setUser: (user: User | null) => void;
}

export const useSomeStore = create<SomeState>()(
  persist(
    (set) => ({
      // State
      user: null,
      
      // Actions
      setUser: (user) => set({ user, isAuthenticated: user !== null }),
    }),
    { name: 'storage-key' }
  )
)
```

#### Component Structure
```typescript
// Functional components with hooks
function MyComponent() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [state, setState] = useState<string>('')
  
  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies])
  
  // Event handlers
  const handleClick = () => {
    // Handler logic
  }
  
  return (
    <div className="container">
      {/* JSX */}
    </div>
  )
}

export default MyComponent
```

#### Styling
- Use Tailwind CSS utility classes
- Responsive design with breakpoints: `sm:`, `md:`, `lg:`
- Mobile-first approach
- Use CSS modules or inline styles for component-specific styles

#### Error Handling
```typescript
try {
  const response = await apiService.someCall()
  if (response.success) {
    // Handle success
  } else {
    // Handle API error
    console.error('API error:', response.message)
  }
} catch (error) {
  // Handle network or unexpected errors
  console.error('Unexpected error:', error)
}
```

### Python/FastAPI

#### Imports
```python
# 1. Standard library
import asyncio
from datetime import datetime
from typing import Dict, List, Optional

# 2. Third-party libraries
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

# 3. Local imports (relative)
from src.database import SessionLocal
from src.models import User
from src.schemas.user import UserResponse
```

#### Naming Conventions
- **Classes**: PascalCase (`QueueManager`, `DownloadTask`)
- **Functions/Methods**: snake_case (`get_user`, `process_queue`)
- **Variables**: snake_case (`user_id`, `download_count`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_RETRIES`)
- **Files**: snake_case (`queue_manager.py`, `download_service.py`)

#### Type Hints
```python
from typing import Optional, List, Dict, Any

def process_task(
    task_id: str,
    quality: int = 64,
    options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Process a download task with given options."""
    if options is None:
        options = {}
    # Implementation
    return {"task_id": task_id, "status": "completed"}
```

#### Pydantic Models
```python
from pydantic import BaseModel, Field

class TaskCreate(BaseModel):
    """Request model for creating a task."""
    media_type: str
    media_id: str
    title: Optional[str] = None
    quality: int = Field(default=64, ge=16, le=116)
    
    class Config:
        json_schema_extra = {
            "example": {
                "media_type": "video",
                "media_id": "BV1xx411c7mD",
                "quality": 80
            }
        }

class TaskResponse(BaseModel):
    """Response model for task data."""
    id: str
    status: str
    progress: float = 0.0
    created_at: int
```

#### Error Handling
```python
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

@router.post("/tasks")
async def create_task(task_data: TaskCreate):
    try:
        result = await task_service.create(task_data)
        return result
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
```

#### Async Patterns
```python
import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Concurrent execution
async def process_multiple(tasks: List[str]):
    results = await asyncio.gather(
        *[process_task(task) for task in tasks],
        return_exceptions=True
    )
    return results
```

## Project Structure

```
pilinote/
├── apps/
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── components/     # React components
│   │   │   ├── pages/          # Page components
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── hooks/          # Custom hooks
│   │   │   ├── services/       # API services
│   │   │   └── types/          # TypeScript types
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── api/                    # FastAPI backend
│       ├── src/
│       │   ├── routers/        # API routes
│       │   ├── services/       # Business logic
│       │   ├── models/         # SQLAlchemy models
│       │   ├── schemas/        # Pydantic schemas
│       │   └── utils/          # Utilities
│       ├── pyproject.toml
│       └── requirements.txt
│
├── reference/                  # Reference projects
├── apps/docs/                  # VitePress 文档站 + 文档源（docs-dev/docs-guide）
└── todo/                       # Planning documents
```

## Common Patterns

### Frontend: Data Fetching
```typescript
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [data, setData] = useState(null)

const fetchData = async () => {
  setLoading(true)
  setError(null)
  
  try {
    const response = await apiService.getData()
    if (response.success) {
      setData(response.data)
    } else {
      setError(response.message || 'Failed to fetch')
    }
  } catch (err) {
    setError('Network error')
  } finally {
    setLoading(false)
  }
}
```

### Backend: Service Pattern
```python
class DownloadService:
    def __init__(self):
        self._running = False
    
    async def start(self):
        """Initialize the service."""
        self._running = True
        logger.info("Service started")
    
    async def stop(self):
        """Cleanup the service."""
        self._running = False
        logger.info("Service stopped")
    
    async def process(self, task_id: str) -> Dict[str, Any]:
        """Process a download task."""
        if not self._running:
            raise RuntimeError("Service not running")
        # Implementation
```

## Important Notes

1. **Always use pnpm** for frontend package management
2. **Backend requires virtual environment** - activate before running Python commands
3. **API runs on port 8000**, frontend dev server on port 5173
4. **TypeScript strict mode** is enabled - fix all type errors before building
5. **No formal testing** - manual testing via API endpoints and browser
6. **Mobile-first design** - always consider mobile responsiveness
7. **Bilibili API rate limits** - implement proper error handling and retries
8. **SESSDATA authentication** - handle cookie refresh and expiry
