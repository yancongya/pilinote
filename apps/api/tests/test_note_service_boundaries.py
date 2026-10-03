import ast
from pathlib import Path


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
