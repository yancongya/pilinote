from .transcriber import (
    TranscriberBase,
    ASRTranscriber,
    WhisperTranscriber,
    get_transcriber,
    TranscriberFactory,
)
from .asr_backends import FFmpegAudioExtractor
from .faster_whisper_backend import FasterWhisperBackend
from .whisper_backend import OpenAIWhisperBackend
from .local_asr_model_service import (
    LocalASRModelService,
    LocalASRModelNotReadyError,
    get_local_asr_model_service,
)

__all__ = [
    "TranscriberBase",
    "ASRTranscriber",
    "WhisperTranscriber",
    "FFmpegAudioExtractor",
    "FasterWhisperBackend",
    "OpenAIWhisperBackend",
    "LocalASRModelService",
    "LocalASRModelNotReadyError",
    "get_local_asr_model_service",
    "get_transcriber",
    "TranscriberFactory",
    "AiNoteService",
]


def __getattr__(name: str):
    if name == "AiNoteService":
        from .note_service import AiNoteService

        return AiNoteService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
