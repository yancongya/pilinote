"""Exercise installed CLI writes against an isolated real backend, without download workers."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cli', required=True)
    parser.add_argument('--python', default=str(ROOT / 'apps/api/venv/bin/python'))
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    cli = str(Path(args.cli).resolve())
    checks = []
    def check(name, condition):
        if not condition:
            raise RuntimeError(name + ' failed')
        checks.append({'name': name, 'passed': True})
    with tempfile.TemporaryDirectory(prefix='pilinote-cli-lifecycle-') as td:
        runtime = Path(td)
        (runtime / 'data').mkdir()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1', 0));port = sock.getsockname()[1]
        origin = f'http://127.0.0.1:{port}'
        env = dict(os.environ, PILINOTE_RUNTIME_DIR=td, PILINOTE_LOG_DIR=td+'/logs',
                   PILINOTE_DOWNLOAD_PATH=td+'/downloads', PILINOTE_TEMP_PATH=td+'/temp',
                   DATABASE_URL='sqlite:///'+td+'/data/pilinote.db', PYTHONPATH=str(ROOT/'apps/api'))
        env.pop('PILINOTE_API_TOKEN', None)
        with (runtime/'server.log').open('w') as log:
            proc = subprocess.Popen([args.python, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1',
                                     '--port', str(port), '--lifespan', 'off'], cwd=td, env=env, stdout=log, stderr=log)
            try:
                def call(*argv, body=None):
                    result = subprocess.run([cli, '--json', '--api-url', origin, *argv], input=body,
                                            cwd='/', env=env, capture_output=True, text=True, timeout=30)
                    return result.returncode, json.loads(result.stdout)
                for _ in range(120):
                    code, health = call('health')
                    if code == 0:break
                    if proc.poll() is not None:raise RuntimeError('Isolated API exited; original data was not used')
                    time.sleep(.5)
                check('real isolated API healthy', code == 0 and health['data']['status']=='healthy')
                def create(media_id):
                    code, value = call('tasks','create','--input','-','--apply',body=json.dumps({'media_id':media_id,'media_type':'video'}))
                    check('create backlog task through actual backend', code==0 and value['data']['success'])
                    return value['data']['data']['id']
                first = create('workforce-lifecycle-first')
                sentinel = create('workforce-lifecycle-sentinel')
                code, value = call('tasks','get',first)
                check('created task readable through unified DB API',code==0 and value['data']['data']['state']==0)
                code, value = call('tasks','pause',first,'--apply')
                check('control reaches same task registry and obeys backlog state guard',code==1 and value.get('status')==400)
                for ident in ('all','batch'):
                    code, value = call('tasks','delete',ident,'--apply')
                    check('reserved bulk-delete ID rejected '+ident,code==2 and value['success'] is False)
                code, value = call('tasks','delete',first,'--apply')
                check('actual single-task delete',code==0 and value['data']['success'])
                code, value = call('tasks','get',first)
                check('deleted task absent from persistent DB',code==1 and value.get('status')==404)
                code, value = call('tasks','get',sentinel)
                check('single deletion preserves unrelated sentinel task',code==0 and value['data']['data']['id']==sentinel)
                code, value = call('tasks','delete',sentinel,'--apply')
                check('owned sentinel cleanup',code==0 and value['data']['success'])
                code, value = call('tasks','list')
                check('isolated DB empty after cleanup',code==0 and value['data']['data']==[])
            finally:
                proc.terminate()
                try:proc.wait(timeout=15)
                except subprocess.TimeoutExpired:proc.kill();proc.wait()
        log_text = (runtime/'server.log').read_text()
        check('no bulk delete request reached API','DELETE /api/queue/tasks/all' not in log_text and 'DELETE /api/queue/tasks/batch' not in log_text)
    report={'success':True,'scope':'installed CLI create/read/state-guard/delete on real isolated FastAPI and SQLite; lifespan off; no external download or AI', 'checks':checks}
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({'success':True,'checks':len(checks)}))


if __name__=='__main__':
    main()
