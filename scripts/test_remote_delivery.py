"""Read-only deployment acceptance; optional API restart verifies persisted user data."""
import argparse
import json
from pathlib import Path
import shlex
import socket
import subprocess
import time
from urllib.parse import urlsplit
from urllib.request import ProxyHandler, build_opener


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True)
    parser.add_argument('--url', required=True)
    parser.add_argument('--release', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--restart', action='store_true')
    parser.add_argument('--expected-users', type=int)
    parser.add_argument('--expected-tasks', type=int)
    args = parser.parse_args()
    if args.host.startswith('-'):
        parser.error('Invalid SSH target')
    origin = urlsplit(args.url)
    if origin.scheme not in ('http','https') or not origin.hostname or origin.username or origin.password or origin.path not in ('','/') or origin.query or origin.fragment:
        parser.error('HTTP(S) origin without credentials required')
    ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', args.host]
    def remote(argv):
        return subprocess.check_output(ssh + [shlex.join(argv)], text=True)
    api = remote(['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=pilinote', '--filter', 'label=com.docker.compose.service=api']).strip()
    web = remote(['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=pilinote', '--filter', 'label=com.docker.compose.service=web']).strip()
    if not api or not web or '\n' in api or '\n' in web:
        raise RuntimeError('Exactly one API and Web container required')
    report = {'scope': 'real NAS HTTP + SSH + installed CLI', 'url': args.url, 'release': args.release, 'checks': []}
    def check(name, condition):
        if not condition:
            raise RuntimeError(name + ' failed')
        report['checks'].append({'name': name, 'passed': True})
    def get(path):
        return build_opener(ProxyHandler({})).open(args.url.rstrip('/') + path, timeout=20).read()
    def cli(*argv):
        return json.loads(remote(['docker', 'exec', api, 'pilinote', '--json', *argv]))
    def wait_health():
        for _ in range(90):
            try:
                value = json.loads(get('/health'))
                if value.get('status') == 'healthy':
                    return value
            except Exception:
                pass
            time.sleep(1)
        raise RuntimeError('Remote service not healthy')
    check('NAS release through frontend proxy', wait_health().get('release') == args.release)
    check('built frontend reachable', '<div id="root">' in get('/').decode())
    formats=json.loads(get('/api/download/format/options'))
    check('actual format API', any(item['format']=='mp4' for item in formats['data']))
    task_result=cli('tasks','list')
    check('installed remote CLI actual task list', task_result['success'] and task_result['data']['success'])
    tasks=task_result['data']['data']
    check('remote CLI health identity', cli('health')['data']['release']==args.release)
    check('actual queue status',cli('queue-status')['success'])
    if tasks:
        ident=tasks[0]['id']
        check('existing task retrieval',cli('tasks','get',ident)['success'])
        check('existing task cancel preview',cli('tasks','cancel',ident)['dryRun'] is True)
    code="import sqlite3,json;c=sqlite3.connect('file:/runtime/data/pilinote.db?mode=ro',uri=True);print(json.dumps(dict(integrity=c.execute('pragma quick_check').fetchone()[0],counts={t:c.execute('select count(*) from '+t).fetchone()[0] for t in ['users','cookies','tasks','schedulers']})))"
    def database():
        return json.loads(remote(['docker','exec',api,'python','-c',code]))
    before=database()
    check('SQLite integrity',before['integrity']=='ok')
    if args.expected_users is not None:check('migrated user count',before['counts']['users']==args.expected_users)
    if args.expected_tasks is not None:check('migrated historical task count',before['counts']['tasks']==args.expected_tasks)
    if origin.scheme=='http':
        port=origin.port or 80
        with socket.create_connection((origin.hostname,port),timeout=10) as ws:
            ws.sendall((f'GET /ws/queue HTTP/1.1\r\nHost: {origin.netloc}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
            check('actual WebSocket proxy',b'101 Switching Protocols' in ws.recv(4096))
    if args.restart:
        remote(['docker','restart',api]);wait_health()
        check('user cookie task scheduler counts persist after restart',database()['counts']==before['counts'])
        check('CLI works after restart',cli('tasks','list')['success'])
    for _ in range(40):
        if remote(['docker','inspect','--format','{{.State.Health.Status}}',api]).strip()=='healthy':
            break
        time.sleep(2)
    report['images']=[]
    for container in (api,web):
        value=json.loads(remote(['docker','inspect',container]))[0]
        check('container release tag',value['Config']['Image'].endswith(':'+args.release))
        check('container healthy',value['State']['Health']['Status']=='healthy')
        check('container nonroot',value['Config']['User'] not in ('','root','0'))
        check('restart policy',value['HostConfig']['RestartPolicy']['Name']=='unless-stopped')
        image=json.loads(remote(['docker','image','inspect',value['Image']]))[0]
        check('NAS native amd64 image',image['Architecture']=='amd64')
        report['images'].append({'id':value['Image'],'architecture':image['Architecture']})
    report['databaseCounts']=before['counts']
    report['success']=True
    output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({'success':True,'release':args.release,'checkCount':len(report['checks']),'databaseCounts':before['counts']},ensure_ascii=False))


if __name__=='__main__':
    main()
