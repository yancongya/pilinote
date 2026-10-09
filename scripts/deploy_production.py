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
SERVICE_ID = 'pilinote'
SCHEMA = 'project-deploy/v1'


def git_revision():
    return subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()


def worktree_clean():
    return not subprocess.check_output(
        ['git', '-C', str(ROOT), 'status', '--porcelain'], text=True
    ).strip()


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


def release_manifest(files):
    return {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in files}


def deployment_script(args, release_dir, manifest):
    """Build and activate one immutable source release with automatic recovery."""
    q = shlex.quote
    service_dir = args.service_dir
    current_link = service_dir + '/current'
    source_sha = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
    environment = f'PILINOTE_RELEASE={q(args.release)} PILINOTE_SOURCE_SHA256={source_sha} PILINOTE_RUNTIME_DIR={q(args.runtime_dir)} PILINOTE_WEB_BIND={q(args.bind)} PILINOTE_WEB_PORT={args.port}'
    compose = environment + ' docker compose -p pilinote -f compose.production.yaml'
    if args.build_mode == 'native':
        build = compose + ' build'
    elif args.build_mode == 'legacy':
        build = f'DOCKER_BUILDKIT=0 docker build --build-arg PILINOTE_SOURCE_SHA256={source_sha} -t pilinote-api:{q(args.release)} -f Dockerfile.api .\nDOCKER_BUILDKIT=0 docker build --build-arg PILINOTE_SOURCE_SHA256={source_sha} -t pilinote-web:{q(args.release)} -f Dockerfile.web .'
    else:
        build = f'''architecture=$(docker info --format '{{{{.Architecture}}}}')
case "$architecture" in x86_64) architecture=amd64;; aarch64) architecture=arm64;; esac
for image in pilinote-api:{q(args.release)} pilinote-web:{q(args.release)}; do
  test "$(docker image inspect --format '{{{{.Architecture}}}}' "$image")" = "$architecture"
  test "$(docker image inspect --format '{{{{index .Config.Labels \"com.itycon.pilinote.source-sha256\"}}}}' "$image")" = {source_sha}
done'''
    # The archive is verified on resume before this script is invoked. A release
    # directory is never overwritten and old release directories are retained.
    expected_release = json.dumps(args.release)
    return f'''set -eu
release_dir={q(release_dir)}
current_link={q(current_link)}
previous_release=""
if [ -L "$current_link" ]; then
  previous_release=$(readlink -f "$current_link")
  case "$previous_release" in {q(service_dir + '/releases')}/*) ;; *) echo 'invalid current release target' >&2; exit 2;; esac
  if [ "$previous_release" = "$release_dir" ]; then echo 'release is already current' >&2; exit 2; fi
fi
stage=preflight
recovery=not-needed
restore_current() {{
  if [ -n "$previous_release" ] && [ -d "$previous_release" ]; then
    python3 -c 'import os,sys; p=sys.argv[1]; t=p+".recovery."+str(os.getpid()); os.symlink(sys.argv[2],t); os.replace(t,p)' "$current_link" "$previous_release" || return 1
    recovery=attempted
    cd "$previous_release"
    PILINOTE_RELEASE="$(basename "$previous_release")" PILINOTE_RUNTIME_DIR={q(args.runtime_dir)} PILINOTE_WEB_BIND={q(args.bind)} PILINOTE_WEB_PORT={args.port} docker compose -p pilinote -f compose.production.yaml up -d --no-build --wait --wait-timeout 180 || return 1
    recovery=restored
  else
    recovery=unavailable-no-previous-release
  fi
}}
on_exit() {{
  result=$?
  trap - EXIT
  if [ "$result" -ne 0 ]; then
    if [ "$(readlink "$current_link" 2>/dev/null || true)" = "$release_dir" ]; then
      restore_current || recovery=failed
    fi
    printf 'PILINOTE_DEPLOYMENT_FAILURE stage=%s recovery=%s restoredRelease=%s\\n' "$stage" "$recovery" "$previous_release" >&2
  fi
  exit "$result"
}}
trap on_exit EXIT
cd "$release_dir"
if [ -n "$previous_release" ]; then
  python3 -c 'import json,pathlib,sys; p=pathlib.Path(sys.argv[1]); d={{}}; [d.__setitem__(k,json.loads(v)) for line in (p/".env").read_text().splitlines() for k,_,v in [line.partition("=")]]; expected={{"PILINOTE_RELEASE":p.name,"PILINOTE_RUNTIME_DIR":sys.argv[2],"PILINOTE_WEB_BIND":sys.argv[3],"PILINOTE_WEB_PORT":sys.argv[4]}}; sys.exit(0 if d==expected else 1)' "$previous_release" {q(args.runtime_dir)} {q(args.bind)} {q(str(args.port))}
  docker image inspect pilinote-api:"$(basename "$previous_release")" >/dev/null
  docker image inspect pilinote-web:"$(basename "$previous_release")" >/dev/null
fi
'''+(f'''for image in pilinote-api:{q(args.release)} pilinote-web:{q(args.release)}; do
  test "$(docker image inspect --format '{{{{index .Config.Labels \"com.itycon.pilinote.source-sha256\"}}}}' "$image")" = {source_sha}
done
''' if args.build_mode == 'prebuilt' else f'''if docker image inspect pilinote-api:{q(args.release)} >/dev/null 2>&1 || docker image inspect pilinote-web:{q(args.release)} >/dev/null 2>&1; then
  echo 'release image tag already exists; immutable release IDs cannot be reused' >&2
  exit 3
fi
''')+f'''
{build}
stage=image-validation
for image in pilinote-api:{q(args.release)} pilinote-web:{q(args.release)}; do
  docker image inspect --format '{{{{if .Config.Healthcheck.Test}}}}ok{{{{end}}}}' "$image" | grep -qx ok
  test "$(docker image inspect --format '{{{{index .Config.Labels \"com.itycon.pilinote.source-sha256\"}}}}' "$image")" = {source_sha}
done
stage=activate
python3 -c 'import os,sys; p=sys.argv[1]; t=p+".next."+str(os.getpid()); os.symlink(sys.argv[2],t); os.replace(t,p)' "$current_link" "$release_dir"
stage=compose-health
{compose} up -d --no-build --wait --wait-timeout 180
stage=application-health
{compose} exec -T api pilinote --json health | python3 -c 'import json,sys; r=json.load(sys.stdin); d=r.get("data", {{}}); sys.exit(0 if r.get("success") is True and d.get("status")=="healthy" and d.get("release")=={expected_release} else 1)'
stage=business-health
{compose} exec -T api pilinote --json formats | python3 -c 'import json,sys; r=json.load(sys.stdin); d=r.get("data", {{}}); sys.exit(0 if r.get("success") is True and isinstance(d,list) and any(x.get("format")=="mp4" for x in d if isinstance(x,dict)) else 1)'
{compose} exec -T api pilinote --json queue-status | python3 -c 'import json,sys; r=json.load(sys.stdin); sys.exit(0 if r.get("success") is True else 1)'
{compose} exec -T api pilinote --json tasks list | python3 -c 'import json,sys; r=json.load(sys.stdin); sys.exit(0 if r.get("success") is True else 1)'
{compose} exec -T web wget -qO- http://127.0.0.1:8080/healthz | grep -qx ok
{compose} exec -T web wget -qO- http://127.0.0.1:8080/ | grep -q '<div id="root">'
{compose} exec -T web wget -qO- http://127.0.0.1:8080/api/download/format/options | python3 -c 'import json,sys; r=json.load(sys.stdin); d=r.get("data",r); sys.exit(0 if isinstance(d,list) and any(x.get("format")=="mp4" for x in d if isinstance(x,dict)) else 1)'
stage=complete
trap - EXIT
printf 'PILINOTE_DEPLOYMENT_SUCCESS release=%s previous=%s\\n' {q(args.release)} "$previous_release"
'''


def emit_report(report, output_path):
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


def mark_health_unrun(report, reason):
    report['healthChecks'] = [dict(check, result='not-run', evidence=reason)
                              for check in report['healthChecks']]


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
    parser.add_argument('--resume', action='store_true', help='Resume identical uploaded files only while neither immutable image tag exists')
    parser.add_argument('--build-mode', choices=('native','legacy','prebuilt'), default='native',
                        help='prebuilt verifies locally loaded native-architecture images before deployment')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{0,80}', args.release):
        parser.error('Invalid release tag')
    if args.host.startswith('-') or not 1 <= args.port <= 65535:
        parser.error('Invalid host or port')
    for path in (args.service_dir, args.runtime_dir):
        if not path.startswith('/') or '..' in Path(path).parts or path in ('/', '/vol1', '/vol1/1000', '/vol1/1000/services', '/vol1/1000/services/data'):
            parser.error('Explicit application directory required')
    service_path, runtime_path = Path(args.service_dir), Path(args.runtime_dir)
    if service_path == runtime_path or service_path in runtime_path.parents or runtime_path in service_path.parents:
        parser.error('Service and persistent runtime directories must be separate')
    if not re.fullmatch(r'[0-9A-Za-z:.[\]-]+', args.bind):
        parser.error('Invalid bind address')
    files = source_files()
    manifest = release_manifest(files)
    digest = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()
    release_dir = args.service_dir + '/releases/' + args.release
    clean = worktree_clean()
    revision = git_revision()
    configuration = {'PILINOTE_RELEASE': args.release, 'PILINOTE_RUNTIME_DIR': args.runtime_dir,
                     'PILINOTE_WEB_BIND': args.bind, 'PILINOTE_WEB_PORT': str(args.port)}
    env_text = ''.join(key + '=' + json.dumps(value, ensure_ascii=False) + '\n' for key, value in configuration.items())
    config_digest = hashlib.sha256(env_text.encode()).hexdigest()
    release_manifest_text = json.dumps({'schema': 'pilinote-release/v1', 'releaseId': args.release,
        'sourceRevision': revision, 'sourceSha256': digest, 'deploymentConfigSha256': config_digest,
        'buildMode': args.build_mode, 'files': manifest}, sort_keys=True, ensure_ascii=False, indent=2) + '\n'
    actions = ['verify source manifest', 'create immutable release directory', 'verify previous runtime and rollback images', 'build release images',
               'atomically switch current release', 'wait for Compose health',
               'verify application health, release identity, queue, tasks, formats and frontend proxy',
               'retain previous release and images for rollback']
    report = {'schema': SCHEMA, 'serviceId': SERVICE_ID, 'mode': 'apply' if args.apply else 'plan',
              'sourceRevision': revision, 'sourceSha256': digest, 'worktreeClean': clean,
              'releaseId': args.release, 'plannedActions': actions, 'completedActions': [],
              'persistentDataPreserved': True, 'healthChecks': [
                  {'name': 'compose-services-healthy', 'result': 'planned', 'evidence': 'docker compose up --wait'},
                  {'name': 'application-health-release-identity', 'result': 'planned', 'evidence': 'pilinote --json health'},
                  {'name': 'business-api-and-frontend-proxy', 'result': 'planned', 'evidence': 'formats, queue-status, tasks list and HTTP proxy smoke checks'}],
              'release': args.release, 'sourceFileCount': len(manifest), 'host': args.host,
              'serviceDir': args.service_dir, 'runtimeDir': args.runtime_dir,
              'port': args.port, 'dryRun': not args.apply, 'ok': None, 'recovered': False,
              'restoredRelease': None, 'deploymentConfigSha256': config_digest}
    if not args.apply:
        report['ok'] = True
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    if not clean:
        report.update(ok=False, failure='worktree-not-clean', dryRun=False)
        mark_health_unrun(report, 'Deployment was blocked before remote access')
        emit_report(report, args.output)
        raise SystemExit(2)
    q = shlex.quote
    ssh = ['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', args.host]
    prepare = f'umask 077; test ! -e {q(release_dir)} && mkdir -p {q(release_dir)} {q(args.runtime_dir)}'
    if args.resume:
        verification = 'import sys,json,pathlib,hashlib;root=pathlib.Path(' + repr(release_dir) + ');expected=json.load(sys.stdin);files=expected["files"];actual={p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file() and p.relative_to(root).as_posix() not in ("previous-release.txt",".env",".release.json")};assert actual==set(files) and all(not (root/p).is_symlink() and hashlib.sha256((root/p).read_bytes()).hexdigest()==sha for p,sha in files.items()), "Uploaded release differs; use a new release tag";env=root/".env";assert not env.is_symlink() and (not env.exists() or hashlib.sha256(env.read_bytes()).hexdigest()==expected["configSha256"]), "Release configuration differs; use a new release tag";meta=root/".release.json";assert not meta.is_symlink() and (not meta.exists() or meta.read_text()==expected["releaseManifest"]), "Release manifest differs; use a new release tag"'
        verified = subprocess.run(ssh + ['python3 -c ' + q(verification)], input=json.dumps({'files': manifest, 'configSha256': config_digest, 'releaseManifest': release_manifest_text}), text=True, capture_output=True)
        if verified.returncode:
            report.update(ok=False, failure='resume-release-content-mismatch', remoteExitCode=verified.returncode)
            mark_health_unrun(report, 'Resume verification failed before deployment')
            emit_report(report, args.output)
            raise SystemExit(verified.returncode)
    if not args.resume:
        prepared = subprocess.run(ssh + [prepare], text=True, capture_output=True)
        if prepared.returncode:
            report.update(ok=False, failure='release-directory-or-prepare-failed', recovered=False)
            report['remoteExitCode'] = prepared.returncode
            mark_health_unrun(report, 'Release directory preparation failed before deployment')
            emit_report(report, args.output)
            raise SystemExit(prepared.returncode)
    with tempfile.NamedTemporaryFile(suffix='.tar.gz') as archive:
        with tarfile.open(archive.name, 'w:gz') as tar:
            for name in files:
                tar.add(ROOT / name, arcname=name, recursive=False)
        if not args.resume:
            with open(archive.name, 'rb') as stream:
                uploaded = subprocess.run(ssh + [f'tar -xzf - -C {q(release_dir)}'], stdin=stream, capture_output=True)
            if uploaded.returncode:
                report.update(ok=False, failure='release-upload-failed', remoteExitCode=uploaded.returncode)
                mark_health_unrun(report, 'Release upload failed before deployment')
                emit_report(report, args.output)
                raise SystemExit(uploaded.returncode)
    write_manifest = 'import pathlib,sys;p=pathlib.Path(' + repr(release_dir + '/.release.json') + ');data=sys.stdin.read();p.open("x").write(data)'
    if args.resume:
        write_manifest = 'import pathlib,sys;p=pathlib.Path(' + repr(release_dir + '/.release.json') + ');data=sys.stdin.read();p.open("x").write(data) if not p.exists() else (None if p.read_text()==data else sys.exit(2))'
    metadata = subprocess.run(ssh + ['python3 -c ' + q(write_manifest)], input=release_manifest_text, text=True, capture_output=True)
    if metadata.returncode:
        report.update(ok=False, failure='release-manifest-write-or-verify-failed', remoteExitCode=metadata.returncode)
        mark_health_unrun(report, 'Release manifest verification failed before deployment')
        emit_report(report, args.output)
        raise SystemExit(metadata.returncode)
    write_config = 'import pathlib,sys;p=pathlib.Path(' + repr(release_dir + '/.env') + ');data=sys.stdin.read();assert not p.is_symlink();p.open("x").write(data) if not p.exists() else (None if p.read_text()==data else sys.exit(2))'
    configured = subprocess.run(ssh + ['python3 -c ' + q(write_config)], input=env_text, text=True, capture_output=True)
    if configured.returncode:
        report.update(ok=False, failure='release-config-write-failed', remoteExitCode=configured.returncode)
        mark_health_unrun(report, 'Release configuration failed before deployment')
        emit_report(report, args.output)
        raise SystemExit(configured.returncode)
    report['deploymentConfigSha256'] = config_digest
    report['buildMode'] = args.build_mode
    commands = deployment_script(args, release_dir, manifest)
    applied = subprocess.run(ssh + [commands], text=True, capture_output=True)
    if applied.returncode:
        marker = re.search(r'PILINOTE_DEPLOYMENT_FAILURE stage=([^ ]+) recovery=([^ ]+) restoredRelease=([^\s]*)', applied.stderr)
        was_recovered = bool(marker and marker.group(2) == 'restored')
        report.update(ok=False, failure='remote-deployment-failed', recovered=was_recovered,
                      failureStage=marker.group(1) if marker else 'unknown',
                      restoredRelease=marker.group(3) or None if was_recovered else None)
        failed_check = {'compose-health': 'compose-services-healthy',
                        'application-health': 'application-health-release-identity',
                        'business-health': 'business-api-and-frontend-proxy'}.get(marker.group(1) if marker else '')
        report['healthChecks'] = [dict(check, result='failed' if check['name'] == failed_check else check['result']) for check in report['healthChecks']]
        if failed_check is None:
            mark_health_unrun(report, 'Deployment stopped before the health acceptance stage')
        report['remoteExitCode'] = applied.returncode
        emit_report(report, args.output)
        raise SystemExit(applied.returncode)
    report.update(ok=True, success=True, completedActions=actions,
                  healthChecks=[{'name': 'compose-services-healthy', 'result': 'passed', 'evidence': 'docker compose up --wait'},
                                {'name': 'application-health-release-identity', 'result': 'passed', 'evidence': 'pilinote --json health returned healthy with matching releaseId'},
                                {'name': 'business-api-and-frontend-proxy', 'result': 'passed', 'evidence': 'formats, queue-status, tasks list, frontend and API proxy smoke checks'}])
    emit_report(report, args.output)


if __name__ == '__main__':
    main()
