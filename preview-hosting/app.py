"""Protected, single-instance remote preview. Not a Netlify Function or local HTTP server."""
from collections import defaultdict
import hmac
import json
import os
from pathlib import Path
import sys
import threading
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from flask import Flask, Response, jsonify, request, send_file
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash
from werkzeug.exceptions import RequestEntityTooLarge

ROOT = Path(__file__).resolve().parent
if (ROOT / 'scripts').is_dir():
    sys.path.insert(0, str(ROOT / 'scripts'))
else:
    sys.path.insert(0, str(ROOT.parent / 'scripts'))
import membership as m

GEORGE = 'mg.farris@comcast.net'
WEATHER_PATH = '/.netlify/functions/metar-live'
WEATHER_URL = 'https://converse-flying-eagles.netlify.app' + WEATHER_PATH

def create_app(settings=None, store=None, public_dir=None):
    env = os.environ if settings is None else settings
    origin = env.get('RC_MEMBERSHIP_PREVIEW_ORIGIN', '')
    parsed = urlsplit(origin)
    user = env.get('RC_MEMBERSHIP_PREVIEW_USER', '')
    password_hash = env.get('RC_MEMBERSHIP_PREVIEW_PASSWORD_HASH', '')
    if parsed.scheme != 'https' or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username:
        raise RuntimeError('A dedicated HTTPS preview origin is required.')
    if parsed.hostname in ('converseflyingeagles.org', 'www.converseflyingeagles.org', 'converse-flying-eagles.netlify.app'):
        raise RuntimeError('Production origins are forbidden for this preview.')
    if not user or not password_hash.startswith('scrypt:'):
        raise RuntimeError('Preview username and scrypt password hash are required; access fails closed.')
    app = Flask(__name__, static_folder=None)
    # Render terminates TLS; trust only its final forwarding hop for scheme and client IP.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=0)
    app.config['MAX_CONTENT_LENGTH'] = 12000
    storage = store or m.Store(env.get('RC_MEMBERSHIP_DATA_DIR', '/var/data/membership'))
    service = m.Service(storage)
    app.extensions['membership_service'] = service
    static_root = Path(public_dir or ROOT / 'public').resolve()
    auth_failures = defaultdict(list)
    throttle = threading.Lock()

    def limited(bucket, count):
        now = time.time()
        with throttle:
            # Expire buckets as well as entries; prevent unbounded per-IP memory growth.
            for key in list(auth_failures):
                auth_failures[key] = [t for t in auth_failures[key] if now-t < 60]
                if not auth_failures[key]: del auth_failures[key]
            hits = auth_failures[bucket]
            if len(hits) >= count: return True
            hits.append(now)
            return False

    @app.before_request
    def protect():
        if request.path == '/healthz' and request.method in ('GET', 'HEAD'):
            return None  # Health check exposes no application, configuration or storage data.
        if not request.is_secure or request.host != parsed.netloc:
            return jsonify(error='Use the approved HTTPS preview address.'), 403
        ip = request.remote_addr or 'unknown'
        with throttle:
            failures = [t for t in auth_failures.get('auth:'+ip, []) if time.time()-t < 60]
        if len(failures) >= 10:
            return jsonify(error='Too many login attempts. Wait one minute.'), 429
        auth = request.authorization
        valid = auth and auth.type.lower() == 'basic' and hmac.compare_digest((auth.username or '').encode(), user.encode())
        if not valid or not check_password_hash(password_hash, auth.password or ''):
            limited('auth:'+ip, 10)
            return Response('Protected fictional membership preview. Sign in to continue.', 401,
                            {'WWW-Authenticate': 'Basic realm="Flying Eagles private preview", charset="UTF-8"'})
        if request.method not in ('GET', 'HEAD', 'POST'):
            return jsonify(error='Method not allowed.'), 405
        if request.method == 'POST' and request.headers.get('Origin') != origin:
            return jsonify(error='Same-origin preview request required.'), 403

    @app.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'private, no-store'
        response.headers['X-Robots-Tag'] = 'noindex, nofollow, noarchive'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Strict-Transport-Security'] = 'max-age=86400'
        return response

    @app.errorhandler(413)
    def too_large(_):
        return jsonify(error='Send a small JSON application (maximum 12 KB).'), 413

    @app.errorhandler(404)
    def missing(_):
        return jsonify(error='Not found.'), 404

    @app.errorhandler(500)
    def internal(_):
        return jsonify(error='Preview service temporarily unavailable. Retain your answers and try again.'), 503

    @app.get('/healthz')
    def health():
        return jsonify(ok=True)

    @app.get('/api/membership/session')
    def session():
        if limited('session:'+str(request.remote_addr), 20):
            return jsonify(error='Wait one minute before starting another session.'), 429
        token = service.session()
        response = jsonify(token=token, sendingEnabled=False, meetings=m.meeting_schedule())
        response.set_cookie('membership_session', token, secure=True, httponly=True,
                            samesite='Strict', path='/api/membership', max_age=3600)
        return response

    @app.post('/api/membership/<action>')
    def membership_action(action):
        if action not in ('review', 'download', 'submit'):
            return jsonify(error='Unknown preview action.'), 404
        token = request.headers.get('X-Membership-Token', '')
        if not token or not hmac.compare_digest(token, request.cookies.get('membership_session', '')):
            return jsonify(error='Reload to start a secure preview session.'), 403
        if limited('api:'+str(request.remote_addr), 30):
            return jsonify(error='Too many requests. Wait one minute and try again.'), 429
        if not request.is_json:
            return jsonify(error='Send a JSON application.'), 400
        try:
            body = request.get_json(silent=True)
            result = service.handle(token, action, body)
            if isinstance(result, bytes):
                return Response(result, mimetype='application/pdf', headers={
                    'Content-Disposition': 'attachment; filename="membership-application.pdf"'})
            return jsonify(result)
        except m.Invalid as exc:
            return jsonify(error=str(exc)), 400
        except RequestEntityTooLarge:
            return too_large(None)
        except Exception:
            # Do not log applicant data, credentials or request headers.
            return jsonify(error='Application could not be processed or saved. Retain your answers and retry.'), 503

    @app.get('/membership-email-preview.<suffix>')
    def email_preview(suffix):
        kind = request.args.get('type', 'new')
        if suffix not in ('html', 'txt') or kind not in ('new', 'renewal'):
            return missing(None)
        body = m.notification_preview(kind)
        return Response(body['html' if suffix == 'html' else 'text'], mimetype='text/html' if suffix == 'html' else 'text/plain')

    @app.get(WEATHER_PATH)
    def weather():
        # Same fixed public read endpoint as accepted local preview. Never forward login headers.
        try:
            with urlopen(Request(WEATHER_URL, headers={'Accept':'application/json', 'User-Agent':m.USER_AGENT}), timeout=15) as upstream:
                reports = json.load(upstream)
            if not isinstance(reports, list): raise ValueError()
            return jsonify(reports)
        except Exception:
            return jsonify(error='Weather data is temporarily unavailable. Please try again later.'), 502

    @app.get('/')
    @app.get('/<path:filename>')
    def static_file(filename='membership.html'):
        candidate = (static_root / filename).resolve()
        if not candidate.is_relative_to(static_root) or any(p.startswith('.') for p in Path(filename).parts) or not candidate.is_file():
            return missing(None)
        return send_file(candidate, conditional=False)

    return app
