"""Regression: cache and mutable prompt state must live in an isolated runtime."""
import json
import os
from pathlib import Path
import subprocess
import sys

API = Path(__file__).resolve().parents[1]


def test_cache_and_prompt_override_use_runtime(tmp_path):
    runtime=tmp_path/'runtime'
    runtime.mkdir()
    env=dict(os.environ,PILINOTE_RUNTIME_DIR=str(runtime),PYTHONPATH=str(API))
    code='''import json
from src.services.cache.video_cache import video_cache
from src.services.ai.prompt_template_service import PromptTemplateService
p=PromptTemplateService()
p.save_templates({"delivery_probe":{"enabled":True}})
assert p.get_override_templates()["delivery_probe"]["enabled"] is True
print(json.dumps({"cache":str(video_cache.db_path),"override":str(p.OVERRIDE_PATH)}))
'''
    result=subprocess.run([sys.executable,'-c',code],cwd=tmp_path,env=env,text=True,capture_output=True,check=True)
    paths=json.loads(result.stdout.strip().splitlines()[-1])
    assert Path(paths['cache'])==runtime/'data/video_cache.db'
    assert Path(paths['override'])==runtime/'data/ai_prompt_templates.json'
    assert (runtime/'data/video_cache.db').stat().st_size>0
    assert not (tmp_path/'data').exists()


def test_runtime_default_seed_does_not_overwrite_custom_terms(tmp_path):
    import importlib.util
    entrypoint=API.parents[1]/'deploy/entrypoint.py'
    spec=importlib.util.spec_from_file_location('delivery_entrypoint',entrypoint)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    defaults=tmp_path/'defaults'
    defaults.mkdir()
    (defaults/'custom.csv').write_text('versioned default')
    runtime=tmp_path/'runtime'
    module.initialize(runtime,defaults)
    assert (runtime/'term-bases/custom.csv').read_text()=='versioned default'
    (runtime/'term-bases/custom.csv').write_text('user override')
    module.initialize(runtime,defaults)
    assert (runtime/'term-bases/custom.csv').read_text()=='user override'


def test_append_term_preserves_csv_header_without_final_newline(tmp_path):
    terms=tmp_path/'terms'
    terms.mkdir()
    (terms/'custom.csv').write_text('原术语,替换术语,备注')
    env=dict(os.environ,PYTHONPATH=str(API),PILINOTE_TERM_BASES_DIR=str(terms))
    code="from src.services.ai.term_base_service import TermBaseService;s=TermBaseService();s.add_term('delivery-source','delivery-target');assert s.replace_term('delivery-source')[0]=='delivery-target'"
    subprocess.run([sys.executable,'-c',code],env=env,cwd=tmp_path,check=True,capture_output=True)
