"""Serve the site locally, with read-only access to the deployed weather endpoint."""

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import secrets
import sys
import threading
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, parse_qs
from urllib.request import Request, urlopen
sys.path.insert(0, str(Path(__file__).resolve().parent))
import membership


ROOT = Path(__file__).resolve().parent.parent
WEATHER_PATH = "/.netlify/functions/metar-live"
WEATHER_URL = "https://converse-flying-eagles.netlify.app" + WEATHER_PATH


class PreviewHandler(SimpleHTTPRequestHandler):
    service = None
    service_lock = threading.Lock()

    def log_message(self, format, *args):
        # Do not log application data, tokens, or query strings.
        pass

    def list_directory(self, path):
        self.send_error(404)

    def safe_static(self):
        path = Path(self.translate_path(self.path)).resolve()
        relative = path.relative_to(ROOT) if path.is_relative_to(ROOT) else None
        return relative is not None and not any(part.startswith('.') or part in ('output', 'tmp', '__pycache__', 'node_modules') for part in relative.parts)

    def do_HEAD(self):
        if not self.safe_static():
            return self.send_error(404)
        return super().do_HEAD()

    def json_response(self, status, data, headers=None):
        self.reply(status, json.dumps(data).encode(), 'application/json', headers)

    def reply(self, status, body, content_type, headers=None):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        if content_type == 'application/pdf':
            self.send_header('Content-Disposition', 'attachment; filename="membership-application.pdf"')
        self.end_headers()
        self.wfile.write(body)

    def local_request(self):
        expected = f'127.0.0.1:{self.server.server_port}'
        return self.client_address[0] == '127.0.0.1' and self.headers.get('Host') == expected

    def get_service(self):
        with self.service_lock:
            if PreviewHandler.service is None:
                PreviewHandler.service = membership.Service()
        return PreviewHandler.service

    def do_POST(self):
        if not urlsplit(self.path).path.startswith('/api/membership/'):
            return self.json_response(404, {'error': 'Unknown local route.'})
        if not self.local_request() or self.headers.get('Origin') != f'http://127.0.0.1:{self.server.server_port}':
            return self.json_response(403, {'error': 'Same-origin local preview required.'})
        token = self.headers.get('X-Membership-Token', '')
        if not token or f'membership_session={token}' not in self.headers.get('Cookie', '').split('; '):
            return self.json_response(403, {'error': 'The secure application session ended. Start a new application.', 'code': 'session_expired'})
        service = self.get_service()
        with service.lock:
            now = time.time()
            attempts = [t for t in service.rates.get(self.client_address[0], []) if now-t < 60]
            if len(attempts) >= 30:
                return self.json_response(429, {'error': 'Too many requests. Wait one minute and try again.'})
            service.rates[self.client_address[0]] = attempts+[now]
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 12000 or self.headers.get_content_type() != 'application/json':
                return self.json_response(413, {'error': 'Send a small JSON application.'})
            body = json.loads(self.rfile.read(size))
            action = urlsplit(self.path).path.rsplit('/', 1)[-1]
            result = service.handle(token, action, body)
            if action == 'restart':
                data = service.describe_session(result['restartToken'])
                data['resumed'] = False
                return self.session_response(data)
            if action == 'logout':
                return self.json_response(200, result, {'Set-Cookie': 'membership_session=; HttpOnly; SameSite=Strict; Path=/api/membership; Max-Age=0'})
            if isinstance(result, bytes):
                return self.reply(200, result, 'application/pdf')
            self.json_response(200, result)
        except (membership.Invalid, ValueError, TypeError):
            message = str(sys.exc_info()[1]) if isinstance(sys.exc_info()[1], membership.Invalid) else 'Invalid request. Review the application and try again.'
            self.json_response(400, {'error': message, **({'code': 'session_expired'} if message.startswith('Session expired.') else {})})
        except Exception:
            self.json_response(503, {'error': 'Application could not be processed or saved. Your form is still available; please retry.'})

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def session_response(self, data):
        remaining = max(0, int((data['expires']-time.time()*1000)/1000))
        return self.json_response(200, data, {'Set-Cookie': f"membership_session={data['token']}; HttpOnly; SameSite=Strict; Path=/api/membership; Max-Age={remaining}"})

    def do_GET(self):
        if urlsplit(self.path).path in ('/membership-email-preview.html', '/membership-email-preview.txt'):
            if not self.local_request():
                return self.json_response(403, {'error': 'Use the local preview address.'})
            kind = parse_qs(urlsplit(self.path).query).get('type', ['new'])[0]
            if kind not in ('new', 'renewal'):
                return self.json_response(400, {'error': 'Choose new or renewal.'})
            body = membership.notification_preview(kind)
            html = urlsplit(self.path).path.endswith('.html')
            return self.reply(200, body['html' if html else 'text'].encode('utf-8'), 'text/html; charset=utf-8' if html else 'text/plain; charset=utf-8')
        if urlsplit(self.path).path == '/api/membership/session':
            if not self.local_request():
                return self.json_response(403, {'error': 'Use the 127.0.0.1 preview address.'})
            service = self.get_service()
            cookie = next((x.strip().split('=', 1)[1] for x in self.headers.get('Cookie', '').split(';') if x.strip().startswith('membership_session=')), '')
            data = service.describe_session(cookie)
            if data:
                data['resumed'] = True
                return self.session_response(data)
            with service.lock:
                times = [t for t in service.rates.get('sessions', []) if time.time()-t < 60]
                if len(times) >= 30:
                    return self.json_response(429, {'error': 'Wait one minute before reloading.'})
                service.rates['sessions'] = times+[time.time()]
            token = service.session()
            data = service.describe_session(token)
            data['resumed'] = False
            return self.session_response(data)
        if urlsplit(self.path).path != WEATHER_PATH and not self.safe_static():
            return self.send_error(404)
        if urlsplit(self.path).path != WEATHER_PATH:
            return super().do_GET()

        # Fixed public read endpoint only; never forward browser credentials or writes.
        try:
            request = Request(WEATHER_URL, headers={"Accept": "application/json"})
            with urlopen(request, timeout=15) as response:
                data = json.load(response)
            if not isinstance(data, list):
                raise ValueError("Unexpected weather response")
            status = 200
        except (HTTPError, URLError, TimeoutError, ValueError, OSError):
            status = 502
            data = {"error": "Weather data is temporarily unavailable. Please try again later."}

        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), PreviewHandler)
    print(f"Serving {ROOT}\nPreview: http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
