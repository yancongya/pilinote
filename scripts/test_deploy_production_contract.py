"""Local contract tests for the NAS deployment adapter; these never connect to NAS."""
import json
import hashlib
from pathlib import Path
import os
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import deploy_production


class DeploymentContractTests(unittest.TestCase):
    def args(self, **overrides):
        values = dict(release='test-release-123', service_dir='/srv/pilinote',
                      runtime_dir='/srv/pilinote-data', bind='127.0.0.1', port=8080,
                      build_mode='native')
        values.update(overrides)
        return SimpleNamespace(**values)

    def test_adapter_plan_is_stable_json_and_read_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'plan.json'
            result = subprocess.run([
                sys.executable, str(ROOT / 'scripts/deploy_production.py'),
                '--host', 'this-host-must-not-be-contacted', '--release', 'test-release-123',
                '--output', str(output),
            ], cwd=ROOT, text=True, capture_output=True, check=True)
            report = json.loads(result.stdout)
            self.assertEqual(report['schema'], 'project-deploy/v1')
            self.assertEqual(report['serviceId'], 'pilinote')
            self.assertEqual(report['mode'], 'plan')
            self.assertEqual(report['releaseId'], 'test-release-123')
            self.assertIsInstance(report['sourceRevision'], str)
            self.assertIsInstance(report['worktreeClean'], bool)
            self.assertTrue(report['persistentDataPreserved'])
            self.assertTrue(report['plannedActions'])
            self.assertEqual(report['completedActions'], [])
            self.assertTrue(all({'name', 'result', 'evidence'} <= check.keys()
                                for check in report['healthChecks']))
            self.assertEqual(report['healthChecks'][0]['result'], 'planned')
            self.assertTrue(report['ok'])
            self.assertFalse(output.exists())

    def test_apply_script_builds_before_atomic_switch_and_recovers(self):
        script = deploy_production.deployment_script(
            self.args(), '/srv/pilinote/releases/test-release-123', {'a': 'b'})
        self.assertLess(script.index('docker compose -p pilinote -f compose.production.yaml build'),
                        script.index('stage=activate'))
        self.assertIn('docker compose -p pilinote -f compose.production.yaml up -d --no-build --wait', script)
        self.assertIn('pilinote --json health', script)
        self.assertIn('d.get("release")=="test-release-123"', script)
        self.assertIn('os.replace(t,p)', script)
        self.assertIn('PILINOTE_RUNTIME_DIR', script)
        self.assertIn('stage=preflight', script)
        self.assertIn('recovery=restored', script)
        self.assertNotIn('docker system prune', script)
        self.assertNotIn('rm -rf', script)
        self.assertIn('business-health', script)
        self.assertIn('immutable release IDs cannot be reused', script)
        self.assertIn('com.itycon.pilinote.source-sha256', script)
        prebuilt = deploy_production.deployment_script(
            self.args(build_mode='prebuilt'), '/srv/pilinote/releases/test-release-123', {'a': 'b'})
        self.assertIn('source-sha256', prebuilt)
        self.assertIn('.Architecture', prebuilt)

    def test_failed_health_simulation_restores_previous_current_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp).resolve()
            service = root / 'service'
            releases = service / 'releases'
            old, new = releases / 'old-release', releases / 'new-release'
            old.mkdir(parents=True)
            new.mkdir()
            runtime = root / 'runtime'
            runtime.mkdir()
            (old / '.env').write_text(''.join((
                'PILINOTE_RELEASE="old-release"\n',
                f'PILINOTE_RUNTIME_DIR="{runtime}"\n',
                'PILINOTE_WEB_BIND="127.0.0.1"\n',
                'PILINOTE_WEB_PORT="8080"\n',
            )))
            (service / 'current').symlink_to(old)
            source_hash = 'a' * 64
            source_digest = hashlib.sha256(json.dumps({'Dockerfile.api': source_hash}, sort_keys=True).encode()).hexdigest()
            fake_bin = root / 'bin'
            fake_bin.mkdir()
            docker = fake_bin / 'docker'
            docker.write_text('''#!/bin/sh
if [ "$1" = "image" ]; then
  shift
  [ "$1" = "inspect" ] || exit 2
  for arg in "$@"; do ref="$arg"; done
  case "$*" in
    *Healthcheck.Test*) echo ok; exit 0;;
    *source-sha256*) echo "$PILINOTE_SOURCE_SHA256"; exit 0;;
    *Architecture*) echo amd64; exit 0;;
  esac
  case "$ref" in *old-release) exit 0;; esac
  exit 1
fi
if [ "$1" = "compose" ]; then
  case " $* " in
    *" build "*) exit 0;;
    *" up "*)
      if [ "$PILINOTE_RELEASE" = "new-release" ] && [ ! -f "$FAIL_ONCE" ]; then touch "$FAIL_ONCE"; exit 9; fi
      exit 0;;
  esac
fi
exit 2
''')
            docker.chmod(0o755)
            args = self.args(release='new-release', service_dir=str(service), runtime_dir=str(runtime))
            script = deploy_production.deployment_script(args, str(new), {'Dockerfile.api': source_hash})
            env = dict(os.environ, PATH=str(fake_bin) + os.pathsep + os.environ['PATH'],
                       PILINOTE_SOURCE_SHA256=source_digest, FAIL_ONCE=str(root / 'fail-once'))
            result = subprocess.run(['bash', '-c', script], cwd=new, env=env, text=True,
                                    capture_output=True, check=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('stage=compose-health recovery=restored', result.stderr)
            self.assertEqual((service / 'current').resolve(), old.resolve())

    def test_manifest_is_stable_for_same_sources(self):
        files = deploy_production.source_files()
        self.assertTrue(files)
        self.assertEqual(deploy_production.release_manifest(files),
                         deploy_production.release_manifest(files))


if __name__ == '__main__':
    unittest.main()
