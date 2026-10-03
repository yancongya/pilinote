import ast
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace


MODULE_PATH = Path(__file__).resolve().parents[1] / "src" / "services" / "ai" / "note_service.py"
MODULE_TREE = ast.parse(MODULE_PATH.read_text(encoding="utf-8"), filename=str(MODULE_PATH))


def find_function(name: str) -> ast.FunctionDef:
    for node in ast.walk(MODULE_TREE):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node
    raise AssertionError(f"未找到函数: {name}")


def find_method(class_name: str, method_name: str) -> ast.FunctionDef:
    for node in MODULE_TREE.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            for child in node.body:
                if isinstance(child, ast.FunctionDef) and child.name == method_name:
                    return child
    raise AssertionError(f"未找到方法: {class_name}.{method_name}")


def qualified_call_name(call: ast.Call) -> str:
    if not isinstance(call.func, ast.Attribute) or not isinstance(call.func.value, ast.Name):
        return ""
    return f"{call.func.value.id}.{call.func.attr}"


def calls_in(node: ast.AST, qualified_name: str):
    return [
        child
        for child in ast.walk(node)
        if isinstance(child, ast.Call) and qualified_call_name(child) == qualified_name
    ]


def test_legacy_private_wrappers_delegate_to_note_context():
    imports = [
        node
        for node in MODULE_TREE.body
        if isinstance(node, ast.ImportFrom) and node.module == "src.services.ai"
    ]
    assert any(
        imported.name == "note_context"
        for import_node in imports
        for imported in import_node.names
    )

    wrappers = {
        "_detect_transcript_language": "note_context.detect_transcript_language",
        "_build_language_policy_block": "note_context.build_language_policy_block",
        "_normalize_note_formats": "note_context.normalize_note_formats",
    }

    for wrapper_name, target_name in wrappers.items():
        wrapper = find_function(wrapper_name)
        returns = [node for node in wrapper.body if isinstance(node, ast.Return)]
        assert len(returns) == 1
        assert isinstance(returns[0].value, ast.Call)
        assert qualified_call_name(returns[0].value) == target_name


def test_transcript_paths_pass_normalized_formats_to_timecode_rule():
    for method_name in ("_generate_transcript", "_prepare_analysis_context"):
        method = find_method("AiNoteService", method_name)
        calls = calls_in(method, "note_context.wants_timecoded_transcript")

        assert len(calls) == 1
        assert len(calls[0].args) == 1
        assert isinstance(calls[0].args[0], ast.Name)
        assert calls[0].args[0].id == "normalized_formats"


def test_main_flow_passes_complete_prompt_inputs_to_pure_preparation():
    method = find_method("AiNoteService", "_run_analysis")
    calls = calls_in(method, "note_context.prepare_prompt_extras")

    assert len(calls) == 1
    call = calls[0]
    assert not call.args
    assert {keyword.arg for keyword in call.keywords} == {
        "transcript",
        "extras",
        "series_memory",
    }

    assignment = next(
        node
        for node in ast.walk(method)
        if isinstance(node, ast.Assign) and node.value is call
    )
    assert len(assignment.targets) == 1
    assert isinstance(assignment.targets[0], ast.Tuple)
    assert [element.id for element in assignment.targets[0].elts] == [
        "transcript_lang",
        "merged_extras",
    ]


def load_bound_output_wrappers(tmp_path):
    output_path = MODULE_PATH.with_name("note_outputs.py")
    spec = importlib.util.spec_from_file_location("isolated_note_outputs", output_path)
    assert spec is not None and spec.loader is not None
    note_outputs = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(note_outputs)

    method_names = (
        "_resolve_index_path",
        "_read_note_index_output",
        "_write_note_index_output",
        "_resolve_series_root",
        "_read_series_memory",
        "_update_series_memory",
    )
    class_node = ast.ClassDef(
        name="BoundOutputWrappers",
        bases=[],
        keywords=[],
        body=[find_method("AiNoteService", name) for name in method_names],
        decorator_list=[],
    )
    module = ast.fix_missing_locations(
        ast.Module(
            body=[
                ast.ImportFrom(
                    module="__future__",
                    names=[ast.alias(name="annotations")],
                    level=0,
                ),
                class_node,
            ],
            type_ignores=[],
        )
    )
    namespace = {
        "note_outputs": note_outputs,
        "app_settings": SimpleNamespace(default_download_path=tmp_path / "downloads"),
        "_safe_read_json": note_outputs.safe_read_json,
        "_compact_markdown_for_memory": note_outputs.compact_markdown_for_memory,
        "Path": Path,
    }
    exec(compile(module, str(MODULE_PATH), "exec"), namespace)
    return namespace["BoundOutputWrappers"], namespace, note_outputs


def test_index_wrappers_honor_overridden_path(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    base_class, _, _ = load_bound_output_wrappers(tmp_path)
    custom_path = tmp_path / "custom.index.json"
    custom_path.write_text('{"legacy": true}', encoding="utf-8")

    class CustomService(base_class):
        def _resolve_index_path(self, source_path, note_id):
            return custom_path

    service = CustomService()
    assert service._read_note_index_output("missing.mp4", "note-1") == {"legacy": True}
    written_path = service._write_note_index_output(
        "missing.mp4",
        "note-1",
        markdown_path="note.md",
        input_fingerprint="input",
        cache_fingerprint="cache",
        pipeline_mode="single",
        style="default",
        formats=["summary"],
        model_provider="provider",
        model_name="model",
    )

    assert written_path == str(custom_path)
    assert json.loads(custom_path.read_text(encoding="utf-8"))["note_id"] == "note-1"
    assert not (tmp_path / "missing.ai-note.index.json").exists()


def test_series_wrappers_honor_overridden_root_and_compactor(tmp_path):
    base_class, namespace, note_outputs = load_bound_output_wrappers(tmp_path)
    custom_root = tmp_path / "custom-series"
    custom_root.mkdir()
    memory_path = custom_root / note_outputs.SERIES_MEMORY_FILENAME
    memory_path.write_text('{"memory_text": "旧记忆"}', encoding="utf-8")

    class CustomService(base_class):
        def _resolve_series_root(self, video_path):
            return custom_root

    namespace["_compact_markdown_for_memory"] = lambda markdown: "覆盖后的摘要"
    service = CustomService()
    assert service._read_series_memory("missing.mp4") == "旧记忆"
    assert service._update_series_memory("missing.mp4", "note-1", "# 原文") == str(memory_path)
    payload = json.loads(memory_path.read_text(encoding="utf-8"))
    assert payload["memory_text"] == "旧记忆\n\n覆盖后的摘要"
    assert payload["series_root"] == str(custom_root)
