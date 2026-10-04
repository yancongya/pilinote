"""Standalone NAS deployment: immutable source releases, existing runtime preserved."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = ['Dockerfile.api', 'Dockerfile.web', '.dockerignore', 'compose.production.yaml',
                'deploy', 'agent-harness', 'term-bases', 'apps/api/main.py',
                'apps/api/requirements.txt', 'apps/api/src', 'apps/api/tools/README.md',
                'apps/api/tools/setup_tools.py', 'apps/api/data/ai_prompt_templates.default.json',
                'apps/web', 'scripts/test_delivery_containers.py', 'skills/pilinote-cli']
EXCLUDED = {'node_modules', 'venv', '.venv', '__pycache__', 'build', 'dist', '.git',
            'test-results', 'playwright-report', 'output', '.workforce'}


def source_files():
    files = []
    for name in SOURCE_ROOTS:
        path = ROOT / name
        candidates = path.rglob('*') if path.is_dir() else [path]
        for candidate in candidates:
            relative = candidate.relative_to(ROOT)
            if any(part in EXCLUDED for part in relative.parts):
                continue
            if candidate.name.startswith('.env') or candidate.suffix in {'.log', '.pyc', '.db', '.sqlite', '.sqlite3', '.tsbuildinfo'}:
                continue
            if any(part.endswith('.egg-info') for part in relative.parts):
                continue
            if candidate.is_symlink():
                raise ValueError('Source symlinks are not supported: ' + str(relative))
            if candidate.is_file():
                files.append(relative.as_posix())
    return sorted(set(files))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host', required=True, help='SSH alias or user@host; SSH key authentication')
    parser.add_argument('--release', required=True)
    parser.add_argument('--service-dir', default='/vol1/1000/services/pilinote')
    parser.add_argument('--runtime-dir', default='/vol1/1000/services/data/pilinote')
    parser.add_argument('--bind', default='0.0.0.0')
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--output', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--resume', action='store_true', help='Resume an identical uploaded release after build failure')
    parser.add_argument('--build-mode', choices=('native','legacy','prebuilt'), default='native',
                        help='prebuilt verifies locally loaded native-architecture images before deployment')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,80}', args.release):
        parser.error('Invalid release tag')
    if args.host.startswith('-') or not 1 <= args.port <= 65535:
        parser.error('Invalid host or port')
    for path in (args.service_dir, args.runtime_dir):
        if not path.startswith('/') or path in ('/', '/vol1', '/vol1/1000', '/vol1/1000/services', '/vol1/1000/services/data'):
            parser.error('Explicit application directory required')
    files = source_files()
    manifest = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in files}
    digest = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
    release_dir = args.service_dir + '/releases/' + args.release
    report = {'release': args.release, 'sourceSha256': digest, 'sourceFiles': manifest,
              'host': args.host, 'serviceDir': args.service_dir, 'runtimeDir': args.runtime_dir,
              'port': args.port, 'dryRun': not args.apply}
    if not args.apply:
        print(json.dumps({key: value for key, value in report.items() if key != 'sourceFiles'}, indent=2))
        return
    q = shlex.quote
    ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', args.host]
    prepare = f'umask 077; test ! -e {q(release_dir)} && mkdir -p {q(release_dir)} {q(args.runtime_dir)}'
    if args.resume:
        verification = 'import sys,json,pathlib,hashlib;root=pathlib.Path(' + repr(release_dir) + ');expected=json.load(sys.stdin);actual={p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() and p.relative_to(root).as_posix() not in ("previous-release.txt",".env")};assert actual==set(expected) and all(not (root/p).is_symlink() and hashlib.sha256((root/p).read_bytes()).hexdigest()==sha for p,sha in expected.items()), "Uploaded release differs; use a new release tag"'
        subprocess.run(ssh + ['python3 -c ' + q(verification)], input=json.dumps(manifest), text=True, check=True)
    else:
        subprocess.run(ssh + [prepare], check=True)
    with tempfile.NamedTemporaryFile(suffix='.tar.gz') as archive:
        with tarfile.open(archive.name, 'w:gz') as tar:
            for name in files:
                tar.add(ROOT / name, arcname=name, recursive=False)
        if not args.resume:
            with open(archive.name, 'rb') as stream:
                subprocess.run(ssh + [f'tar -xzf - -C {q(release_dir)}'], stdin=stream, check=True)
    configuration = {'PILINOTE_RELEASE': args.release, 'PILINOTE_RUNTIME_DIR': args.runtime_dir,
                     'PILINOTE_WEB_BIND': args.bind, 'PILINOTE_WEB_PORT': str(args.port)}
    env_text = ''.join(key + '=' + json.dumps(value, ensure_ascii=False) + '\n' for key, value in configuration.items())
    write_config = 'import pathlib,sys;p=pathlib.Path(' + repr(release_dir + '/.env') + ');p.write_text(sys.stdin.read())'
    subprocess.run(ssh + ['python3 -c ' + q(write_config)], input=env_text, text=True, check=True)
    report['deploymentConfigSha256'] = hashlib.sha256(env_text.encode()).hexdigest()
    report['buildMode'] = args.build_mode
    # Build before changing any running service. Keep previous current release for rollback.
    environment = f'PILINOTE_RELEASE={q(args.release)} PILINOTE_RUNTIME_DIR={q(args.runtime_dir)} PILINOTE_WEB_BIND={q(args.bind)} PILINOTE_WEB_PORT={args.port}'
    compose = environment + ' docker compose -p pilinote -f compose.production.yaml'
    if args.build_mode == 'native':
        build = compose + ' build'
    elif args.build_mode == 'legacy':
        build = f'DOCKER_BUILDKIT=0 docker build -t pilinote-api:{args.release} -f Dockerfile.api .\nDOCKER_BUILDKIT=0 docker build -t pilinote-web:{args.release} -f Dockerfile.web .'
    else:
        build = f'''architecture=$(docker info --format '{{{{.Architecture}}}}')
case "$architecture" in x86_64) architecture=amd64;; aarch64) architecture=arm64;; esac
for image in pilinote-api:{args.release} pilinote-web:{args.release}; do
  test "$(docker image inspect --format '{{{{.Architecture}}}}' "$image")" = "$architecture"
done'''
    commands = f'''set -eu
cd {q(release_dir)}
{build}
{compose} up -d --no-build --wait --wait-timeout 180
readlink {q(args.service_dir + '/current')} > {q(release_dir + '/previous-release.txt')} || true
ln -sfn {q(release_dir)} {q(args.service_dir + '/current')}
{compose} ps
'''
    subprocess.run(ssh + [commands], check=True)
    report['success'] = True
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
