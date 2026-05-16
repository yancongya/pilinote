# Aria2c-First Download Pipeline Design

## Background

PiliNote currently mixes several download-related paths:

- `queue_manager -> TaskService -> DownloadEngine`
- legacy `DownloadService`
- legacy `DownloadManager`
- `unified_queue_manager`
- legacy subtitle fallback paths

Video downloading is still powered by `yt-dlp`, while subtitle downloading has now been unified onto the Bilibili player/WBI path. The remaining structural issue is that `yt-dlp` is still acting as both resolver and downloader for video tasks, while `aria2c` exists as an accelerator rather than a clearly owned transport layer.

The goal of this design is to make the video pipeline explicit and stable:

- `yt-dlp` resolves media streams only
- `aria2c` becomes the primary media transport
- `yt-dlp` builtin downloader remains as a controlled fallback
- subtitles, covers, avatars, and NFO stay outside the media transport path
- the queue path becomes the single supported execution path for new download behavior

## Goals

1. Make `queue_manager -> TaskService -> DownloadEngine` the only primary execution path for video downloads.
2. Split video download responsibilities into resolver, transport, and post-processing.
3. Use `aria2c` as the default video/audio downloader.
4. Keep `yt-dlp` only for stream extraction and transport fallback.
5. Preserve existing behavior for:
   - single videos
   - multi-part videos
   - scheduler/series tasks
   - current directory layout rules
6. Keep subtitle handling on the existing player/WBI path.
7. Add observable task metadata so the UI and logs can show which downloader path was used.

## Non-Goals

1. Replacing `yt-dlp` as the video resolver.
2. Rewriting the whole queue system in this phase.
3. Removing all legacy services immediately.
4. Changing AI note/subtitle logic beyond keeping path compatibility.
5. Changing media-library directory semantics in this phase.

## Current Problems

### 1. Resolver and downloader are coupled

`DownloadEngine.download_video()` currently lets `yt-dlp` both resolve and download. This makes it hard to reason about fallback, headers, cookies, and downloader ownership.

### 2. Multiple execution paths still exist

The codebase still contains several historical download coordinators. Even when they ultimately call `DownloadEngine`, they do not share one explicit contract.

### 3. Downloader state is not explicit enough

Tasks do not clearly expose:

- which resolver was used
- which downloader actually performed the transfer
- whether fallback occurred
- whether a merge was required

### 4. Aria2c is present but not the architectural owner

`aria2c` support exists, but it is still treated as an implementation detail rather than the default transport.

## Proposed Architecture

### Primary pipeline

For every video task:

1. `TaskService` prepares normalized task metadata (`aid`, `cid`, `page`, `part_title`, `series metadata`).
2. `DownloadEngine` requests a resolved media plan from a new resolver component.
3. The resolver uses `yt-dlp extract_info` to produce a normalized media plan.
4. `DownloadEngine` sends the media plan to the primary transport (`aria2c`).
5. If transport succeeds:
   - media files are placed in the temp directory
   - `ffmpeg` merges audio/video if required
   - `TaskService` moves the final media file into the task output directory
6. If primary transport fails in a retryable way:
   - `DownloadEngine` falls back to `yt-dlp` builtin transfer
   - task metadata records the fallback
7. Post-processing continues unchanged for subtitles, cover, avatar, and NFO.

### Component split

#### 1. `MediaResolver`

Responsibility:

- resolve Bilibili media streams using `yt-dlp`
- normalize output into a stable internal schema

Input:

- `bvid`
- `page_num`
- `cid`
- requested quality
- requested codec/audio bitrate
- cookie/auth headers

Output:

- `video_url`
- `audio_url`
- `video_headers`
- `audio_headers`
- `referer`
- `cookie_header`
- `requires_merge`
- `container`
- `selected_quality`
- `selected_codec`
- `source_title`
- `source_ext`

#### 2. `Aria2Transfer`

Responsibility:

- download one or two streams to temp files using `aria2c`
- respect headers, cookies, referer, retries, and resume

Rules:

- if only one muxed stream exists, download one file
- if separate audio/video exist, download both and mark for merge
- return exact temp file paths and sizes

#### 3. `BuiltinTransfer`

Responsibility:

- fallback downloader when aria2c path fails
- reuse existing `yt-dlp` download path, but only in fallback mode

Rules:

- fallback must be explicit in task metadata and logs
- fallback should not change subtitle logic

#### 4. `DownloadEngine`

Responsibility:

- orchestrate resolver + downloader + merge
- choose primary vs fallback transport
- provide one stable API to `TaskService`

It should no longer own all low-level details inline.

## Task Metadata Contract

Every video task should expose downloader metadata in `task.meta` or `task.status`:

- `resolver`: `yt-dlp`
- `downloader`: `aria2c` or `yt-dlp-builtin`
- `fallback_used`: `true/false`
- `merge_required`: `true/false`
- `stream_count`: `1/2`
- `selected_quality`: resolved quality label/code
- `selected_codec`: resolved codec label

This gives frontend and logs a stable source of truth.

## Queue and Routing Strategy

### Supported primary path

New behavior is only guaranteed on:

- `queue_manager`
- `TaskService`
- `DownloadEngine`
- `/api/queue/...`
- frontend `newQueue.ts`

### Legacy paths

These stay temporarily for compatibility, but should stop gaining new behavior:

- `DownloadService`
- `DownloadManager`
- `unified_queue_manager`
- `unifiedDownload.ts`
- `queue/handlers/video.py` if it diverges from `TaskService`

The phase goal is not immediate deletion. The phase goal is to make them clearly secondary and progressively forward-compatible with the main pipeline.

## Failure Handling

### Resolver failure

If `yt-dlp` cannot resolve media info:

- fail task during media preparation/download stage
- classify error through existing error handling
- do not attempt subtitle fallback logic here

### Aria2 transport failure

If `aria2c` fails for a retryable transfer reason:

- log the transfer failure
- attempt builtin fallback once
- set:
  - `fallback_used = true`
  - `downloader = yt-dlp-builtin`

If fallback also fails:

- fail task normally with detailed error classification

### Merge failure

If audio/video were downloaded but merge fails:

- retain enough temp evidence for logging/debugging
- fail task clearly at merge stage

## Testing Strategy

### Automated backend verification

Must cover:

1. Single video resolution -> aria2 plan generation
2. Multi-part video resolution -> correct page/cid-specific plan generation
3. Aria2 transfer happy path for:
   - single muxed stream or
   - separate audio/video streams
4. Fallback path when aria2 transfer is forced to fail
5. Merge path when two streams are downloaded
6. Subtitle path remains independent and working
7. Task metadata records resolver/downloader/fallback state correctly

### Real integration verification

Must manually verify on running app:

1. Homepage/detail page add single video to queue
2. Detail page add specific multi-part entry to queue
3. Subscription/series path add queue item
4. Download list reflects actual task state
5. Completed item opens in AI subtitle view
6. Subtitle source label still displays correctly

## Rollout Plan

### Phase 1

- Introduce resolver/transfer split inside `DownloadEngine`
- Keep public API stable for `TaskService`
- Keep fallback to builtin downloader
- Do not delete legacy services yet

### Phase 2

- Add explicit downloader metadata to task state/UI consumption
- Make legacy download entrypoints forward to the main engine contract where feasible

### Phase 3

- Audit dead paths and remove truly unused legacy download wrappers
- Keep only one maintained download orchestration path

## Open Decisions

1. `MediaResolver` can start as a helper inside `download_engine.py`, then move into its own file once stable.
2. `queue/handlers/video.py` should eventually reuse the same engine contract rather than maintain separate behavior.
3. `unified_queue_manager` should not be expanded further until the primary queue path is stable.

## Recommended Implementation Order

1. Stabilize the spec and implementation plan.
2. Extract resolver logic from current `DownloadEngine`.
3. Add aria2-first transport execution.
4. Add explicit fallback metadata.
5. Run backend automation.
6. Run browser-level verification.
7. Only then start pruning secondary paths.
