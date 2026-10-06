import json
import os
from pathlib import Path
import subprocess
import shutil
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CLI = os.environ.get('PILINOTE_CLI') or shutil.which('pilinote')
if not CLI:
    raise RuntimeError('Install pilinote-cli and provide PILINOTE_CLI or PATH')

class Handler(BaseHTTPRequestHandler):
    calls = []
    def log_message(self, *args): pass
    def do_GET(self):
        self.calls.append((self.command, self.path))
        if self.path == '/health':
            self.send_response(200); self.end_headers(); self.wfile.write(b'{"status":"healthy","meta":{"api_key":"secret-canary"}}')
        elif self.path.endswith('/missing'):
            self.send_response(404); self.end_headers(); self.wfile.write(b'secret-canary')
        elif self.path == '/api/download/format/options':
            self.send_response(302); self.send_header('Location', '/health'); self.end_headers()
        else:
            self.send_response(200); self.end_headers(); self.wfile.write(b'not json secret-canary')
    def do_POST(self):
        self.calls.append((self.command, self.path))
        self.send_response(200); self.end_headers(); self.wfile.write(b'{"success":false,"message":"secret-canary"}')

class CLITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1',0), Handler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def call(self,*args,input=None):
        return subprocess.run([CLI,'--json','--api-url',f'http://127.0.0.1:{self.server.server_port}',*args],input=input,cwd='/',text=True,capture_output=True)
    def test_installed_help_unrelated_directory(self):
        self.assertEqual(self.call('--help').returncode,0)
    def test_capabilities_is_local_and_lists_api_domains(self):
        n=len(Handler.calls); r=self.call('capabilities'); self.assertEqual(r.returncode,0)
        data=json.loads(r.stdout); self.assertIn('favorites', data['data']['domains']); self.assertEqual(len(Handler.calls),n)
    def test_generic_api_write_is_preview_and_path_is_restricted(self):
        r=self.call('api','post','/api/favorites/folders','--input','-',input='{}')
        self.assertEqual(r.returncode,0); self.assertTrue(json.loads(r.stdout)['dryRun'])
        self.assertEqual(self.call('api','get','/etc/passwd').returncode,2)
    def test_actual_http_json_redacted(self):
        r=self.call('health');self.assertEqual(r.returncode,0);data=json.loads(r.stdout)
        self.assertEqual(data['data']['status'],'healthy');self.assertNotIn('secret-canary',r.stdout)
    def test_dry_run_never_contacts_backend(self):
        n=len(Handler.calls);r=self.call('tasks','cancel','abc')
        self.assertTrue(json.loads(r.stdout)['dryRun']);self.assertEqual(len(Handler.calls),n)
    def test_creation_input_default_preview(self):
        r=self.call('tasks','create','--input','-',input='{"media_id":"BV1xxx","media_type":"video","cookie":"secret-canary"}')
        self.assertTrue(json.loads(r.stdout)['dryRun']);self.assertNotIn('secret-canary',r.stdout)
    def test_apply_business_failure_is_nonzero_and_secret_safe(self):
        r=self.call('tasks','cancel','abc','--apply');self.assertEqual(r.returncode,1)
        self.assertFalse(json.loads(r.stdout)['success']);self.assertNotIn('secret-canary',r.stdout)
    def test_missing_task_error_no_raw_body(self):
        r=self.call('tasks','get','missing');self.assertEqual(r.returncode,1)
        self.assertEqual(json.loads(r.stdout)['status'],404);self.assertNotIn('secret-canary',r.stdout)
    def test_non_json_response_fails(self):
        r=self.call('queue-status');self.assertEqual(r.returncode,1);self.assertFalse(json.loads(r.stdout)['success'])
    def test_redirect_is_not_followed(self):
        r=self.call('formats');self.assertEqual(r.returncode,1);self.assertEqual(json.loads(r.stdout)['status'],302)
    def test_path_injection_rejected(self):
        self.assertEqual(self.call('tasks','get','../health').returncode,2)
    def test_reserved_delete_ids_never_contact_backend(self):
        n=len(Handler.calls)
        for ident in ('all', 'batch'):
            for flags in ((), ('--apply',)):
                r=self.call('tasks','delete',ident,*flags)
                self.assertEqual(r.returncode,2)
                self.assertFalse(json.loads(r.stdout)['success'])
        self.assertEqual(len(Handler.calls),n)
    def test_origin_credentials_not_echoed(self):
        r=self.call('--api-url','http://user:secret-canary@localhost','health')
        self.assertEqual(r.returncode,1);self.assertNotIn('secret-canary',r.stdout+r.stderr)
