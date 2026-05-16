# Aria2c-First Download Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the PiliNote video pipeline so `yt-dlp` resolves streams, `aria2c` performs the primary transfer, `yt-dlp builtin` acts only as fallback, and queue-driven downloads remain stable for single videos and series videos.

**Architecture:** Keep `queue_manager -> TaskService -> DownloadEngine` as the single maintained execution path. Split `DownloadEngine` into resolver and transfer concerns without breaking current task preparation, subtitle handling, or directory layout behavior. Add explicit downloader metadata so verification and debugging stop depending on inference.

**Tech Stack:** FastAPI, Python, SQLAlchemy task models, `yt-dlp`, `aria2c`, `ffmpeg`, existing queue/task services.

---

### Task 1: Document and isolate the current main download path

**Files:**
- Modify: `apps/api/src/services/download_engine.py`
- Modify: `apps/api/src/services/queue/task.py`
- Modify: `apps/api/src/services/download_manager.py`
- Modify: `apps/api/src/services/download_service.py`

- [ ] **Step 1: Add docstrings/comments that mark the primary path and compatibility paths**

Add concise comments stating that `TaskService -> DownloadEngine` is the maintained path, while `DownloadService` and `DownloadManager` are compatibility layers.

- [ ] **Step 2: Run a text search to confirm all `download_video(...)` call sites**

Run: `rg -n "download_video\(" apps/api/src`
Expected: call sites limited to the known queue/service wrappers.

- [ ] **Step 3: Commit the path-ownership clarification**

```bash
git add apps/api/src/services/download_engine.py apps/api/src/services/queue/task.py apps/api/src/services/download_manager.py apps/api/src/services/download_service.py
git commit -m "docs(download): mark primary and compatibility download paths"
```

### Task 2: Introduce a normalized media resolution contract

**Files:**
- Modify: `apps/api/src/services/download_engine.py`
- Create or modify: `apps/api/src/services/download_engine.py` helper section or `apps/api/src/services/media_resolver.py`

- [ ] **Step 1: Define a normalized resolver result schema**

Add a typed internal structure containing fields for:
- `video_url`
- `audio_url`
- `video_headers`
- `audio_headers`
- `cookie_header`
- `referer`
- `requires_merge`
- `stream_count`
- `selected_quality`
- `selected_codec`
- `source_title`
- `source_ext`

- [ ] **Step 2: Implement `yt-dlp extract_info` as resolution only**

Refactor current `DownloadEngine` logic so one method resolves stream URLs and metadata without starting the transfer.

- [ ] **Step 3: Verify the resolver with a real multi-part BVID**

Run a Python snippet under `apps/api` that resolves `BV1JA9wBqEbi` page 2 and prints the normalized result.
Expected: resolved video/audio URLs and correct page-specific metadata.

- [ ] **Step 4: Commit the resolver split**

```bash
git add apps/api/src/services/download_engine.py apps/api/src/services/media_resolver.py 2>/dev/null || true
git commit -m "refactor(download): split media resolution from transfer"
```

### Task 3: Add aria2c-first transfer execution

**Files:**
- Modify: `apps/api/src/services/download_engine.py`

- [ ] **Step 1: Add an aria2 transfer helper that accepts one resolved stream**

Implement a helper that downloads a single resolved URL to a target file using `aria2c`, with request headers and cookie header forwarded explicitly.

- [ ] **Step 2: Add a dual-stream execution path**

When the resolver reports separate audio/video streams, download both temp files via `aria2c` and return their paths.

- [ ] **Step 3: Keep the current output directory behavior unchanged**

Ensure the aria2 temp files still land in the same temp directory flow currently expected by `TaskService`.

- [ ] **Step 4: Verify aria2 transfer on a single video task**

Run a Python integration snippet that downloads a real short single video into a temp directory.
Expected: media file(s) appear in temp output and task does not fail before merge/move.

- [ ] **Step 5: Commit the aria2 primary transport**

```bash
git add apps/api/src/services/download_engine.py
git commit -m "feat(download): use aria2c as primary media transport"
```

### Task 4: Add builtin fallback and downloader metadata

**Files:**
- Modify: `apps/api/src/services/download_engine.py`
- Modify: `apps/api/src/services/queue/task.py`

- [ ] **Step 1: Wrap aria2 transfer in explicit fallback handling**

On retryable transport failure, call the builtin `yt-dlp` transfer path once.

- [ ] **Step 2: Write downloader metadata into task state**

Populate task metadata/state fields for:
- `resolver`
- `downloader`
- `fallback_used`
- `merge_required`
- `stream_count`
- `selected_quality`
- `selected_codec`

- [ ] **Step 3: Verify forced fallback behavior**

Temporarily simulate aria2 failure in a controlled dev run and confirm:
- task completes through builtin fallback
- metadata records fallback

- [ ] **Step 4: Commit fallback support**

```bash
git add apps/api/src/services/download_engine.py apps/api/src/services/queue/task.py
git commit -m "feat(download): add builtin fallback metadata for aria2 pipeline"
```

### Task 5: Preserve merge, move, and subtitle independence

**Files:**
- Modify: `apps/api/src/services/download_engine.py`
- Modify: `apps/api/src/services/queue/task.py`
- Modify: `apps/api/src/services/queue/handlers/subtitle.py` only if needed

- [ ] **Step 1: Verify ffmpeg merge still runs for dual-stream downloads**

Run a real multipart P2 download and confirm the final merged `.mp4` is produced.

- [ ] **Step 2: Verify subtitle flow remains on WBI/player and unaffected**

Run the subtitle handler integration check after media download changes.
Expected: `*.zh-CN.ai.srt` still downloads correctly.

- [ ] **Step 3: Verify single-video and scheduler directory rules remain unchanged**

Run one single-video task and one scheduler/series-style task into temp output directories and compare results to existing expected layout.

- [ ] **Step 4: Commit post-processing compatibility fixes**

```bash
git add apps/api/src/services/download_engine.py apps/api/src/services/queue/task.py apps/api/src/services/queue/handlers/subtitle.py
git commit -m "fix(download): preserve merge, subtitle, and output layout behavior"
```

### Task 6: Browser and API verification

**Files:**
- No code changes required unless verification finds regressions

- [ ] **Step 1: Verify backend status and auth**

Run:
```bash
curl -s http://127.0.0.1:8000/api/auth/status
```
Expected: logged-in response.

- [ ] **Step 2: Verify queue-based UI path on 5173**

Manual/browser verification:
- add a single video from detail/home path
- add a series video part
- inspect `/downloads#downloads`
- inspect `/video/:bvid/ai#subtitle`

Expected:
- queue task appears
- download completes
- subtitle can be read from AI subtitle view

- [ ] **Step 3: Capture any regressions before legacy cleanup**

If UI verification finds mismatches, fix them before touching legacy wrappers.

### Task 7: Reduce legacy downloader surface safely

**Files:**
- Modify: `apps/api/src/services/download_service.py`
- Modify: `apps/api/src/services/download_manager.py`
- Modify: `apps/api/src/services/unified_queue_manager.py` only if needed

- [ ] **Step 1: Stop adding new behavior to compatibility wrappers**

Keep wrappers thin and align them to the main engine contract.

- [ ] **Step 2: Add comments or forwarding behavior where old paths remain**

Make it explicit that they defer to the main pipeline and are not feature-authoritative.

- [ ] **Step 3: Run a final search for duplicate downloader ownership**

Run: `rg -n "YoutubeDL\(|yt_dlp|aria2c" apps/api/src`
Expected: `yt_dlp` appears in resolver/fallback areas, `aria2c` appears as primary transport, and no new subtitle `yt-dlp` path remains.

- [ ] **Step 4: Commit legacy surface reduction**

```bash
git add apps/api/src/services/download_service.py apps/api/src/services/download_manager.py apps/api/src/services/unified_queue_manager.py
git commit -m "refactor(download): reduce legacy downloader surface"
```
