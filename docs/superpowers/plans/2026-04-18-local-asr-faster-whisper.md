# Local ASR with faster-whisper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the AI note transcription backend with a local faster-whisper pipeline by default so video-to-text transcription runs on macOS, Windows, and Linux without requiring `OPENAI_API_KEY`.

**Architecture:** Keep the existing transcription boundary intact: `ffmpeg` extracts audio locally, then a pluggable ASR backend converts audio to text. Introduce a local `FasterWhisperBackend` as the default backend and keep `OpenAIWhisperBackend` only as an optional compatibility backend. The AI note service continues to consume transcription text the same way, so T0/T2/T3, prompt construction, and the frontend do not need protocol changes.

**Tech Stack:** Python 3.11, FastAPI backend, ffmpeg, faster-whisper, SQLAlchemy, existing AI note service and trace system.

---

### Task 1: Add a local faster-whisper backend

**Files:**
- Create: `apps/api/src/services/ai/faster_whisper_backend.py`
- Modify: `apps/api/src/services/ai/asr_backends.py`

- [ ] **Step 1: Add a backend test scaffold**

```python
def test_faster_whisper_backend_exports():
    from src.services.ai.faster_whisper_backend import FasterWhisperBackend

    assert FasterWhisperBackend.__name__ == "FasterWhisperBackend"
```

- [ ] **Step 2: Run the import check and confirm the new backend is missing before implementation**

Run:
```bash
cd apps/api
source venv/bin/activate
python3 - <<'PY'
try:
    from src.services.ai.faster_whisper_backend import FasterWhisperBackend
    print("unexpected")
except Exception as exc:
    print(type(exc).__name__, exc)
PY
```

Expected: import fails before the file exists.

- [ ] **Step 3: Implement the local backend**

```python
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class FasterWhisperBackend:
    def __init__(
        self,
        model_size: str = "base",
        device: str = "auto",
        compute_type: str = "auto",
    ):
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type

    def transcribe_audio(self, audio_path: str) -> str:
        from faster_whisper import WhisperModel

        model = WhisperModel(
            self.model_size,
            device=None if self.device == "auto" else self.device,
            compute_type=None if self.compute_type == "auto" else self.compute_type,
        )
        segments, _ = model.transcribe(audio_path, beam_size=5)
        return "\n".join(segment.text.strip() for segment in segments if segment.text.strip())
```

- [ ] **Step 4: Make the backend available through the shared ASR protocol**

```python
from .faster_whisper_backend import FasterWhisperBackend

class ASRBackend(Protocol):
    def transcribe_audio(self, audio_path: str) -> str:
        ...
```

- [ ] **Step 5: Run a syntax check**

Run:
```bash
cd apps/api
source venv/bin/activate
python3 -m py_compile src/services/ai/faster_whisper_backend.py src/services/ai/asr_backends.py
```

Expected: PASS.

---

### Task 2: Switch the transcriber default to local ASR

**Files:**
- Modify: `apps/api/src/services/ai/transcriber.py`
- Modify: `apps/api/src/services/ai/note_service.py`
- Modify: `apps/api/src/services/ai/__init__.py`

- [ ] **Step 1: Remove the hidden fallback to subtitle parsing**

```python
class AutoTranscriber(TranscriberBase):
    def __init__(self, **kwargs):
        self.whisper_transcriber = ASRTranscriber(**kwargs)

    def transcribe(self, video_path: str, video_id: str) -> Optional[str]:
        return self.whisper_transcriber.transcribe(video_path, video_id)
```

- [ ] **Step 2: Make `ASRTranscriber` default to the local backend**

```python
from .faster_whisper_backend import FasterWhisperBackend

class ASRTranscriber(TranscriberBase):
    def __init__(self, api_key: Optional[str] = None, audio_extractor: Optional[AudioExtractor] = None, asr_backend: Optional[ASRBackend] = None):
        self.audio_extractor = audio_extractor or FFmpegAudioExtractor()
        self.asr_backend = asr_backend or FasterWhisperBackend()

    def get_pipeline_name(self) -> str:
        return "ffmpeg + faster-whisper"
```

- [ ] **Step 3: Keep the AI note trace readable**

```python
self._add_trace(
    "PREP.T1.2",
    "本地 ASR 请求",
    "正在使用 faster-whisper 生成正文转写",
    45.0,
    {"backend": pipeline_name},
)
```

- [ ] **Step 4: Ensure the AI note service no longer depends on OpenAI keys for transcription**

```python
transcriber = get_transcriber("asr")
pipeline_name = getattr(transcriber, "get_pipeline_name", lambda: "ffmpeg + faster-whisper")()
```

- [ ] **Step 5: Run a backend syntax check**

Run:
```bash
cd apps/api
source venv/bin/activate
python3 -m py_compile src/services/ai/transcriber.py src/services/ai/note_service.py src/services/ai/__init__.py
```

Expected: PASS.

---

### Task 3: Add installation notes and a smoke check

**Files:**
- Modify: `apps/api/requirements.txt`
- Modify: `apps/api/pyproject.toml`

- [ ] **Step 1: Add the local ASR dependency**

```text
faster-whisper>=1.1.0
```

- [ ] **Step 2: Run a package metadata sanity check**

Run:
```bash
cd apps/api
python3 - <<'PY'
from pathlib import Path
print(Path("requirements.txt").read_text().count("faster-whisper"))
print(Path("pyproject.toml").read_text().count("faster-whisper"))
PY
```

Expected: both files mention `faster-whisper` once.

- [ ] **Step 3: Smoke test the default backend selection**

Run:
```bash
cd apps/api
source venv/bin/activate
python3 - <<'PY'
import sys, os
sys.path.insert(0, os.getcwd())
from src.services.ai.transcriber import get_transcriber

transcriber = get_transcriber("asr")
print(type(transcriber).__name__)
print(getattr(transcriber, "get_pipeline_name")())
PY
```

Expected: prints `ASRTranscriber` and `ffmpeg + faster-whisper`.

---

### Task 4: Verify end-to-end note analysis still works

**Files:**
- No new files; verify existing AI note flow

- [ ] **Step 1: Re-run the prompt tests**

Run:
```bash
cd apps/api
source venv/bin/activate
python3 test_ai_note_prompts.py
```

Expected: PASS.

- [ ] **Step 2: Run a minimal ASGI lookup / analysis smoke test**

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
        print(resp.json()["found"])

asyncio.run(main())
PY
```

Expected: `200` and `False`.

- [ ] **Step 3: Commit the local ASR switch**

```bash
git add apps/api/src/services/ai/faster_whisper_backend.py apps/api/src/services/ai/asr_backends.py apps/api/src/services/ai/transcriber.py apps/api/src/services/ai/note_service.py apps/api/src/services/ai/__init__.py apps/api/requirements.txt apps/api/pyproject.toml
git commit -m "feat: switch ai transcription to local faster-whisper"
```

---
