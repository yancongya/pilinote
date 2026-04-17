# Key, Metadata, and Status Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the AI/video-library lookup key, metadata source, and status display so the same video can be found, analyzed, and displayed consistently across the library, panel, and backend without route errors or ambiguous identifiers.

**Architecture:** Keep a single primary lookup path for the UI and a compatibility layer on the backend. The frontend uses the local library folder path only where the actual file path is required for analysis, while lookup requests go through a query-based `lookup` endpoint. The backend resolves lookup requests against the canonical `download.id`, then falls back to `file_path`, and finally to legacy folder keys for historical records.

**Tech Stack:** React + TypeScript + Vite frontend, FastAPI + SQLAlchemy backend, existing `AiNoteService`, `VideoLibrary`, `AiNotePanel`, and `AiNoteModal` components.

---

### Task 1: Stabilize AI lookup contract

**Files:**
- Modify: `apps/api/src/routers/note.py`
- Modify: `apps/api/src/services/ai/note_service.py`
- Modify: `apps/web/src/services/aiNote.ts`

- [ ] **Step 1: Add a lookup response test case**

```python
def test_lookup_returns_found_false_for_missing_video():
    service = AiNoteService()
    note = service.get_note_by_video("missing-video-key")
    assert note is None
```

- [ ] **Step 2: Run the backend import/route check**

Run:
```bash
cd apps/api
source venv/bin/activate
python3 -m py_compile src/routers/note.py src/services/ai/note_service.py
```

Expected: PASS with no syntax errors.

- [ ] **Step 3: Keep the backend lookup endpoint query-based**

```python
@router.get("/by-video", response_model=NoteLookupResponse)
async def get_note_by_video(video_id: str = Query(..., description="视频 ID 或文件路径")):
    service = AiNoteService()
    note = service.get_note_by_video(video_id)

    if not note:
        return NoteLookupResponse(success=True, found=False, note=None, message="该视频暂无笔记")

    return NoteLookupResponse(
        success=True,
        found=True,
        note=NoteResponse(
            success=True,
            id=note.id,
            video_id=note.video_id,
            content=note.content,
            summary=note.summary,
            style=note.style,
            formats=note.formats,
            status=note.status,
            model_provider=note.model_provider,
            model_name=note.model_name,
            error=note.error,
            meta=note.meta,
            created_at=note.created_at,
            updated_at=note.updated_at,
            completed_at=note.completed_at,
        ),
    )
```

- [ ] **Step 4: Keep the frontend service on the same lookup shape**

```ts
export interface NoteLookupResponse {
  success: boolean
  found: boolean
  note: NoteResponse | null
  message?: string
}

async lookupNoteByVideo(videoId: string): Promise<NoteLookupResponse> {
  const response = await apiService.request<NoteLookupResponse>(
    `/api/note/by-video?video_id=${encodeURIComponent(videoId)}`
  )
  return (response.data ?? response) as NoteLookupResponse
}
```

- [ ] **Step 5: Verify the lookup endpoint returns 200 for missing videos**

Run:
```bash
cd apps/api
source venv/bin/activate
python3 - <<'PY'
import sys, os, asyncio
sys.path.insert(0, os.getcwd())
from main import app
import httpx

async def main():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/note/by-video", params={"video_id": "missing"})
        print(resp.status_code)
        print(resp.text)

asyncio.run(main())
PY
```

Expected: `200` and a JSON body with `found=false`.

---

### Task 2: Make media-library lookup use the canonical key and keep compatibility

**Files:**
- Modify: `apps/web/src/components/NewDownload/VideoLibrary.tsx`
- Modify: `apps/web/src/components/ai/AiNotePanel.tsx`
- Modify: `apps/api/src/services/ai/note_service.py`

- [ ] **Step 1: Use the folder path only as the lookup input**

```ts
const videoFilePath = task.meta?.folder_path

useEffect(() => {
  const checkAiNoteStatus = async () => {
    if (!videoFilePath || isOpus) return

    setIsLoadingStatus(true)
    try {
      const lookup = await aiNoteService.lookupNoteByVideo(videoFilePath)
      if (!lookup.found || !lookup.note) {
        setAiNoteStatus('none')
        setExistingNote(null)
        return
      }

      setExistingNote(lookup.note)
      if (lookup.note.status === 'processing') setAiNoteStatus('processing')
      else if (lookup.note.status === 'completed') setAiNoteStatus('completed')
      else if (lookup.note.status === 'failed') setAiNoteStatus('failed')
      else setAiNoteStatus('none')
    } finally {
      setIsLoadingStatus(false)
    }
  }

  checkAiNoteStatus()
}, [videoFilePath, isOpus])
```

- [ ] **Step 2: Make the modal open on the same folder-path identity**

```ts
<AiNoteModal
  videoId={videoFilePath}
  videoTitle={task.title}
  existingNote={existingNote}
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onComplete={handleAiNoteComplete}
/>
```

- [ ] **Step 3: Keep backend compatibility for old folder keys**

```python
def get_note_by_video(self, video_id: str) -> Optional[AiNote]:
    note = self.db.query(AiNote).filter(AiNote.video_id == video_id).first()
    if note:
        self.db.close()
        return note

    download = self.db.query(Download).filter(Download.id == video_id).first()
    if not download:
        download = self.db.query(Download).filter(Download.file_path == video_id).first()

    if download:
        note = self.db.query(AiNote).filter(AiNote.video_id == download.id).first()
        if note:
            self.db.close()
            return note

        if download.file_path:
            note = self.db.query(AiNote).filter(AiNote.video_id == download.file_path).first()
            if note:
                self.db.close()
                return note

            folder_name = os.path.basename(os.path.dirname(download.file_path))
            folder_key = f"folder-{folder_name}"
            note = self.db.query(AiNote).filter(AiNote.video_id == folder_key).first()
            if note:
                self.db.close()
                return note

    self.db.close()
    return None
```

- [ ] **Step 4: Keep `AiNotePanel` aligned with the same lookup behavior**

```ts
useEffect(() => {
  const checkExistingNote = async () => {
    setIsLoadingExisting(true)
    try {
      const lookup = await aiNoteService.lookupNoteByVideo(videoId)
      if (lookup.found && lookup.note) {
        setNote(lookup.note)
        setStyle(lookup.note.style || DEFAULT_STYLE)
        setFormats(lookup.note.formats || DEFAULT_FORMATS)
        setViewMode(lookup.note.status === 'processing' ? 'loading' : 'result')
      }
    } finally {
      setIsLoadingExisting(false)
    }
  }

  if (videoId) checkExistingNote()
}, [videoId])
```

- [ ] **Step 5: Verify the lookup contract using an ASGI in-process call**

Run:
```bash
cd apps/api
source venv/bin/activate
python3 - <<'PY'
import sys, os, asyncio
sys.path.insert(0, os.getcwd())
from main import app
import httpx

async def main():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/note/by-video", params={"video_id": "test"})
        print(resp.status_code)
        print(resp.text)

asyncio.run(main())
PY
```

Expected: `200` and a `found` flag in the response.

---

### Task 3: Keep status display consistent without reintroducing 404 behavior

**Files:**
- Modify: `apps/web/src/components/ai/AiNoteModal.tsx`
- Modify: `apps/web/src/components/ai/AiNoteButton.tsx`
- Modify: `apps/web/src/components/NewDownload/index.css`

- [ ] **Step 1: Ensure the card status remains informational only**

```ts
type AiNoteCardStatus = 'none' | 'processing' | 'completed' | 'failed'
```

- [ ] **Step 2: Keep failed/completed states opening the modal instead of querying the API directly**

```ts
const handleAiNoteClick = () => {
  setShowModal(true)
}
```

- [ ] **Step 3: Keep the modal result state and reanalyze action attached to the existing note**

```ts
const handleReanalyze = async () => {
  await startAnalyze()
}
```

- [ ] **Step 4: Verify the frontend no longer hits a path-based by-video route**

Run:
```bash
cd apps/web
pnpm exec tsc --noEmit --pretty false
```

Expected: no new errors introduced by the AI lookup changes; only pre-existing repository errors may remain.

- [ ] **Step 5: Commit the lookup and status unification changes**

```bash
git add apps/api/src/routers/note.py apps/api/src/services/ai/note_service.py apps/web/src/services/aiNote.ts apps/web/src/components/NewDownload/VideoLibrary.tsx apps/web/src/components/ai/AiNotePanel.tsx apps/web/src/components/ai/AiNoteModal.tsx apps/web/src/components/ai/AiNoteButton.tsx apps/web/src/components/NewDownload/index.css
git commit -m "feat: unify ai note lookup and status routing"
```

