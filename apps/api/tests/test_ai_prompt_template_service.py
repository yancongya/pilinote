import json

from src.services.ai.prompt_template_service import PromptTemplateService


def test_prompt_template_service_merges_default_and_override(tmp_path, monkeypatch):
    default_path = tmp_path / "ai_prompt_templates.default.json"
    override_path = tmp_path / "ai_prompt_templates.json"
    default_path.write_text(
        json.dumps(
            {
                "base": {"system": "默认系统", "final": ["默认收尾"]},
                "layers": {
                    "t0": "T0默认",
                    "t1": "T1默认",
                    "t2": {"simple": "T2简单", "detailed": "T2详细"},
                    "t3": {"detailed": "T3详细"},
                    "formats": {"summary": "formats总结"},
                },
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    override_path.write_text(
        json.dumps({"layers": {"t2": {"simple": "T2覆盖"}}}, ensure_ascii=False),
        encoding="utf-8",
    )

    monkeypatch.setattr(PromptTemplateService, "DEFAULT_PATH", default_path)
    monkeypatch.setattr(PromptTemplateService, "OVERRIDE_PATH", override_path)

    service = PromptTemplateService()
    templates = service.get_templates()

    assert templates["base"]["system"] == "默认系统"
    assert templates["layers"]["t0"] == "T0默认"
    assert templates["layers"]["t2"]["simple"] == "T2覆盖"
    assert templates["layers"]["formats"]["summary"] == "formats总结"


def test_prompt_template_service_reset_removes_override(tmp_path, monkeypatch):
    default_path = tmp_path / "ai_prompt_templates.default.json"
    override_path = tmp_path / "ai_prompt_templates.json"
    default_path.write_text("{}", encoding="utf-8")
    override_path.write_text('{"layers":{"t0":"override"}}', encoding="utf-8")

    monkeypatch.setattr(PromptTemplateService, "DEFAULT_PATH", default_path)
    monkeypatch.setattr(PromptTemplateService, "OVERRIDE_PATH", override_path)

    service = PromptTemplateService()
    assert override_path.exists()
    service.reset_templates()
    assert not override_path.exists()
