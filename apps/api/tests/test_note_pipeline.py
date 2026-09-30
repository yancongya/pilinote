import importlib.util
from pathlib import Path
from types import SimpleNamespace


MODULE_PATH = Path(__file__).resolve().parents[1] / "src" / "services" / "ai" / "note_pipeline.py"


def load_note_pipeline():
    spec = importlib.util.spec_from_file_location("note_pipeline", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"无法加载模块: {MODULE_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


note_pipeline = load_note_pipeline()


def test_infers_pipeline_modes_from_download_metadata_and_video_id():
    assert note_pipeline.infer_pipeline_mode("BV1test") == "video"
    assert note_pipeline.infer_pipeline_mode("cv123") == "image_text"
    assert note_pipeline.infer_pipeline_mode(
        "BV1test", SimpleNamespace(media_type="opus", source_type="")
    ) == "image_text"
    assert note_pipeline.infer_pipeline_mode(
        "BV1test", SimpleNamespace(media_type="bangumi", source_type="")
    ) == "series"
    assert note_pipeline.infer_pipeline_mode(
        "BV1test", SimpleNamespace(media_type="", source_type="opus")
    ) == "image_text"


def test_normalizes_modes_and_resolves_pipeline_stages():
    assert note_pipeline.normalize_pipeline_mode(" SERIES ") == "series"
    assert note_pipeline.normalize_pipeline_mode(None) == "video"
    assert note_pipeline.normalize_pipeline_mode("unsupported") == "video"
    assert note_pipeline.get_pipeline_stages("image_text")[0] == "DOC.READ"
    assert note_pipeline.get_pipeline_stages("unsupported") == note_pipeline.SEMANTIC_STAGES
    assert note_pipeline.trace_stage("series", "NFO.READ") == "series.NFO.READ"


def test_stage_keys_and_indices_preserve_existing_validation_rules():
    assert note_pipeline.stage_key(" video.nfo.read ") == "NFO.READ"
    assert note_pipeline.stage_key("DOC.READ") == "DOC.READ"
    assert note_pipeline.stage_index("series.NFO.READ") == 2
    assert note_pipeline.stage_index("image_text.NFO.READ") == 2
    assert note_pipeline.stage_index("image_text.DOC.READ") == 0

    for invalid_stage in (None, "", "UNKNOWN.STAGE"):
        try:
            note_pipeline.stage_key(invalid_stage)
        except ValueError:
            pass
        else:
            raise AssertionError(f"expected ValueError for {invalid_stage!r}")
