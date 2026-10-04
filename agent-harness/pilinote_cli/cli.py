import argparse
import json
import os
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

SENSITIVE = re.compile(r'password|secret|token|cookie|authorization|sessdata|bili_jct|api.?key|credential', re.I)
LIMIT = 8 * 1024 * 1024


def redact(value):
    if isinstance(value, dict):
        if isinstance(value.get('name'), str) and SENSITIVE.search(value['name']):
            value = dict(value, value='[REDACTED]')
        return {key: '[REDACTED]' if SENSITIVE.search(key) else redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item) for item in value]
    # Signed URLs and text may carry credentials under unexpected keys.
    if isinstance(value, str):
        value = re.sub(r'(?i)([?&](?:token|access_key|api_key|sessdata|bili_jct|sign|signature)=)[^&#\s]+', r'\1[REDACTED]', value)
    return value


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def identifier(value):
    if value in {'all', 'batch'} or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value):
        raise argparse.ArgumentTypeError('ID must use letters, digits, underscore or hyphen')
    return value


def positive_timeout(value):
    timeout = float(value)
    if not 0 < timeout <= 120:
        raise argparse.ArgumentTypeError('Timeout must be between 0 and 120 seconds')
    return timeout


def request(base, method, path, body, timeout):
    parsed = urlsplit(base)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in {'', '/'}:
        raise ValueError('Base URL must be an HTTP(S) origin without credentials')
    headers = {'Accept': 'application/json'}
    token = os.getenv('PILINOTE_API_TOKEN')
    if token:
        headers['Authorization'] = 'Bearer ' + token
    data = None
    if body is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode()
    opener = build_opener(ProxyHandler({}), NoRedirect())
    req = Request(base.rstrip('/') + path, data=data, headers=headers, method=method)
    with opener.open(req, timeout=timeout) as response:
        raw = response.read(LIMIT + 1)
        if len(raw) > LIMIT:
            raise ValueError('API response exceeds size limit')
        result = json.loads(raw)
    if not isinstance(result, (dict, list)):
        raise ValueError('API must return an object or array')
    return result


class JSONParser(argparse.ArgumentParser):
    def error(self, message):
        print(json.dumps({'schema': 'pilinote-cli/v1', 'success': False, 'error': 'Invalid command arguments'}))
        raise SystemExit(2)


def parser():
    p = JSONParser(description='PiliNote CLI：复用现有 API；写命令默认预览')
    p.add_argument('--json', action='store_true')
    p.add_argument('--api-url', default=os.getenv('PILINOTE_API_URL', 'http://127.0.0.1:8000'))
    p.add_argument('--timeout', type=positive_timeout, default=15)
    groups = p.add_subparsers(dest='group', required=True)
    groups.add_parser('health')
    groups.add_parser('formats')
    task = groups.add_parser('tasks').add_subparsers(dest='action', required=True)
    task.add_parser('list')
    show = task.add_parser('get'); show.add_argument('id', type=identifier)
    create = task.add_parser('create'); create.add_argument('--input', choices=['-'], required=True); create.add_argument('--apply', action='store_true')
    for name in ('pause', 'cancel', 'retry', 'delete'):
        cmd = task.add_parser(name); cmd.add_argument('id', type=identifier); cmd.add_argument('--apply', action='store_true')
    notes = groups.add_parser('notes').add_subparsers(dest='action', required=True)
    for name in ('get', 'status', 'pause', 'resume', 'cancel'):
        cmd = notes.add_parser(name); cmd.add_argument('id', type=identifier)
        if name in ('pause', 'resume', 'cancel'): cmd.add_argument('--apply', action='store_true')
    groups.add_parser('queue-status')
    return p


def operation(args):
    body = None
    if args.group == 'health': return 'GET', '/health', body
    if args.group == 'formats': return 'GET', '/api/download/format/options', body
    if args.group == 'queue-status': return 'GET', '/api/unified-queue/status', body
    if args.group == 'tasks':
        if args.action == 'list': return 'GET', '/api/unified-queue/tasks', body
        if args.action == 'create':
            raw = sys.stdin.read(LIMIT + 1)
            if len(raw) > LIMIT: raise ValueError('Input exceeds size limit')
            body = json.loads(raw)
            if not isinstance(body, dict) or not isinstance(body.get('media_id'), str) or not body['media_id'].strip() or not body.get('media_type'):
                raise ValueError('Task requires media_id and media_type')
            # The existing control routes use this manager's in-memory task registry.
            return 'POST', '/api/queue/tasks', body
        path = '/api/queue/tasks/' + quote(args.id, safe='')
        if args.action == 'get': return 'GET', '/api/unified-queue/tasks/' + quote(args.id, safe=''), body
        if args.action == 'delete': return 'DELETE', path, body
        return 'POST', path + '/' + args.action, body
    path = '/api/note/'
    if args.action == 'get': return 'GET', path + args.id, body
    return ('GET' if args.action == 'status' else 'POST'), path + args.action + '/' + args.id, body


def main():
    args = parser().parse_args()
    try:
        method, path, body = operation(args)
        if method != 'GET' and not args.apply:
            result = {'schema': 'pilinote-cli/v1', 'success': True, 'dryRun': True, 'method': method, 'path': path}
        else:
            result = request(args.api_url, method, path, body, args.timeout)
            if isinstance(result, dict) and result.get('success') is False:
                # API error text can contain URLs or secret values; do not echo raw body.
                print(json.dumps({'schema': 'pilinote-cli/v1', 'success': False, 'error': 'API rejected operation'}))
                return 1
            result = {'schema': 'pilinote-cli/v1', 'success': True, 'dryRun': False, 'data': redact(result)}
        print(json.dumps(result, ensure_ascii=False, indent=None if args.json else 2))
        return 0
    except HTTPError as error:
        result = {'success': False, 'error': 'HTTP error', 'status': error.code}
    except (URLError, TimeoutError, OSError):
        result = {'success': False, 'error': 'API unavailable'}
    except (ValueError, UnicodeError):
        result = {'success': False, 'error': 'Invalid input, origin or API JSON'}
    print(json.dumps(dict(schema='pilinote-cli/v1', **result)))
    return 1


if __name__ == '__main__':
    sys.exit(main())
