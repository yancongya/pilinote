"""Real isolated Compose acceptance. Never mounts existing runtime or production data."""
from pathlib import Path
import argparse
import json
import os
import socket
import subprocess
import tempfile
import time
from urllib.request import build_opener, ProxyHandler
import uuid

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--release',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--skill-output')
    args=parser.parse_args()
    project='pilinote-workforce-'+uuid.uuid4().hex[:10]
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    env=dict(os.environ,PILINOTE_RELEASE=args.release)
    report={'scope':'isolated-local-compose','project':project,'release':args.release,'checks':[]}
    with tempfile.TemporaryDirectory(prefix='pilinote-docker-test-') as td:
        override=Path(td)/'override.yaml'
        override.write_text(f'''services:
  api:
    volumes: !override
      - acceptance-data:/runtime
  web:
    ports: !override
      - "127.0.0.1:{port}:8080"
volumes:
  acceptance-data:
''')
        base=['docker','compose','-p',project,'-f',str(ROOT/'compose.production.yaml'),'-f',str(override)]
        def compose(*argv):
            return subprocess.check_output(base+list(argv),env=env,cwd=ROOT,text=True,stderr=subprocess.STDOUT)
        def check(name,condition):
            if not condition: raise RuntimeError(name+' failed')
            report['checks'].append({'name':name,'passed':True})
        def get(path):
            return build_opener(ProxyHandler({})).open(f'http://127.0.0.1:{port}'+path,timeout=5).read()
        def wait():
            for _ in range(120):
                try:
                    value=json.loads(get('/health'))
                    if value.get('status')=='healthy': return value
                except Exception: pass
                time.sleep(1)
            raise RuntimeError('Container API did not become healthy')
        try:
            compose('up','-d','--no-build','--wait','--wait-timeout','180')
            api=compose('ps','-q','api').strip();web=compose('ps','-q','web').strip()
            ids=[api,web];check('two running containers',all(ids))
            health=wait();check('same-origin API release',health.get('release')==args.release)
            page=get('/').decode();check('built frontend HTML','<div id="root">' in page)
            with socket.create_connection(('127.0.0.1',port),timeout=5) as ws:
                ws.sendall((f'GET /ws/queue HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
                check('WebSocket proxy upgrade',b'101 Switching Protocols' in ws.recv(4096))
            compose('exec','-T','api','python','-c',"from pathlib import Path;Path('/runtime/static/screenshots/delivery-probe.txt').write_text('isolated screenshot proxy')")
            check('persistent screenshot proxy',get('/static/screenshots/delivery-probe.txt')==b'isolated screenshot proxy')
            tasks=json.loads(get('/api/unified-queue/tasks'));check('actual isolated task API',tasks.get('success') is True and tasks.get('data')==[])
            formats=json.loads(get('/api/download/format/options'));check('actual formats through proxy',any(x['format']=='mp4' for x in formats['data']))
            cli=json.loads(compose('exec','-T','api','pilinote','--json','tasks','list'));check('installed CLI inside image',cli['success'] and cli['data']['data']==[])
            term_code="from src.services.ai.term_base_service import TermBaseService;s=TermBaseService();assert str(s.term_bases_dir)=='/runtime/term-bases';assert s.list_files();assert s.add_term('delivery-probe-source','delivery-probe-target');print('saved')"
            check('mutable term defaults and save',compose('exec','-T','api','python','-c',term_code).strip().endswith('saved'))
            code="import sqlite3;db=sqlite3.connect('/runtime/data/pilinote.db');db.execute('create table workforce_probe (value text)');db.execute('insert into workforce_probe values (?)',('persisted',));db.commit()"
            compose('exec','-T','api','python','-c',code)
            compose('restart','api');wait()
            result=compose('exec','-T','api','python','-c',"import sqlite3;print(sqlite3.connect('/runtime/data/pilinote.db').execute('select value from workforce_probe').fetchone()[0])")
            check('SQLite persistence across restart',result.strip()=='persisted')
            term_result=compose('exec','-T','api','python','-c',"from src.services.ai.term_base_service import TermBaseService;s=TermBaseService();assert s.replace_term('delivery-probe-source')[0]=='delivery-probe-target';print('persisted')")
            check('custom terms persist across restart',term_result.strip().endswith('persisted'))
            check('readonly CLI mutation preview',json.loads(compose('exec','-T','api','pilinote','--json','tasks','cancel','nonexistent'))['dryRun'] is True)
            skill_checks=[]
            def skill_check(name,argv,predicate):
                value=json.loads(compose('exec','-T','api','pilinote','--json',*argv))
                condition=predicate(value)
                check('Skill scenario: '+name,condition)
                skill_checks.append({'name':name,'passed':condition})
            skill_check('health and release',['health'],lambda x:x['success'] and x['data']['release']==args.release)
            skill_check('task list',['tasks','list'],lambda x:x['success'] and x['data']['data']==[])
            skill_check('queue status',['queue-status'],lambda x:x['success'])
            skill_check('cancel preview',['tasks','cancel','skill-probe'],lambda x:x['dryRun'] and x['method']=='POST')
            if args.skill_output:
                out=Path(args.skill_output);out.parent.mkdir(parents=True,exist_ok=True)
                out.write_text(json.dumps({'scope':'single-agent command scenario regression, not independent model evaluation','skill':'skills/pilinote-cli/SKILL.md','checks':skill_checks,'success':True},ensure_ascii=False,indent=2))
            images=[]
            for container in ids:
                value=json.loads(subprocess.check_output(['docker','inspect',container],text=True))[0]
                image=json.loads(subprocess.check_output(['docker','image','inspect',value['Image']],text=True))[0]
                check('nonroot '+container,value['Config']['User'] not in ('','0','root'))
                images.append({'id':value['Image'],'architecture':image['Architecture'],'os':image['Os']})
            report['images']=images;report['success']=True
        except Exception:
            # Only isolated containers with an empty runtime are involved; preserve diagnostics locally.
            diagnostics=ROOT/'.workforce/container-diagnostics.log'
            diagnostics.parent.mkdir(exist_ok=True)
            diagnostics.write_text(compose('logs','--no-color','--tail','100'))
            raise
        finally:
            compose('down','--volumes','--remove-orphans')
    out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))


if __name__=='__main__':main()
