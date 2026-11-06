"""Local-only membership service. No automatic mail and no public storage routes."""
import base64
from zoneinfo import ZoneInfo
from datetime import date, datetime, timedelta, timezone
import hashlib
from html import escape
import io
import json
from pathlib import Path
import re
import secrets
import sqlite3
import threading
import time
import unicodedata
from string import Template
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parent.parent
PRIVATE = ROOT.parent / 'RC-Flyers-private'
FROM = 'membership@converseflyingeagles.org'
TO = 'mvaughan737@gmail.com'  # Initial test: Michael only; no cc/bcc or applicant mail.
USER_AGENT = 'RC-Flyers-Membership/1.0'
FIELDS = {'kind', 'category', 'paymentDate', 'name', 'ama', 'address', 'city', 'state',
          'zip', 'phone', 'cell', 'email', 'dob', 'meetingDate', 'acknowledge', 'fictional'}
LIMITS = {'name': 100, 'ama': 24, 'address': 140, 'city': 70, 'state': 2,
          'zip': 10, 'phone': 80, 'cell': 80, 'email': 160, 'dob': 10}

class Invalid(ValueError):
    pass

MONTHS = ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')

def meeting_schedule(now=None, count=12):
    local = (now or datetime.now(timezone.utc)).astimezone(ZoneInfo('America/Indiana/Indianapolis'))
    dates = []
    offset = 0
    while len(dates) < count:
        year = local.year + (local.month - 1 + offset) // 12
        month = (local.month - 1 + offset) % 12 + 1
        first = date(year, month, 1)
        meeting = first + timedelta(days=(1 - first.weekday()) % 7)
        if meeting > local.date() or (meeting == local.date() and local.hour < 18):
            dates.append(meeting.isoformat())
        offset += 1
    return {'confirmedDates': dates, 'time': '18:00', 'timeZone': 'America/Indiana/Indianapolis',
            'notice': 'Meetings are exclusively the first Tuesday of each month at 6:00 PM Eastern Time (EST or EDT as shown for each date). New members pay by cash or check at the meeting. Selected meeting and expected payment date are separate.'}


def notification(data, quote, preview=False):
    """Both email alternatives share the same formatted, escaped details; no network I/O."""
    sentence = ('A membership renewal has been submitted.' if data['kind'] == 'renewal'
                else 'A new membership application has been submitted.')
    selected = data.get('meetingDate', '')
    instruction = ('Print the attached application and bring it to the selected club meeting: '+meeting_label(selected)+'.' if selected else 'Renewal by mail: no meeting selected. Print the attached application for review.')
    instruction += ' An officer verifies AMA membership, then the applicant signs the printed application at the meeting.'
    notice = 'FICTIONAL TEST - LOCAL PREVIEW ONLY. No email has been sent.' if preview else 'FICTIONAL TEST - applicant details are for testing only.'
    fields = dict(display_fields(data))
    address = ', '.join([data['address'], data['city'], data['state']+' '+data['zip']])
    details = [('Application', fields['Application']), ('Category', fields['Category']),
               ('Selected meeting date', meeting_label(selected) if selected else 'Renewal by mail - no meeting selected'),
               ('Full name', data['name']), ('AMA number', data['ama']), ('Address', address),
               ('Phone', fields['Phone'] or '(not provided)'), ('Cell', fields['Cell'] or '(not provided)'), ('Email', data['email'])]
    if data.get('dob'):
        details.append(('Date of Birth', fields['Date of Birth']))
    amount = quote.get('amount')
    dues_text = '$'+str(amount) if amount is not None else quote.get('reason') or 'Secretary confirmation required'
    if quote.get('lateFee'):
        dues_text += ' (includes $'+str(quote['lateFee'])+' late fee)'
    details += [('Expected Payment Receipt', display_date(data['paymentDate'])), ('Estimated dues', dues_text),
                ('Membership year', str(quote['membershipYear'])), ('Estimated Expiry', display_date(quote['expiry']))]
    rows = ''.join('<tr><th scope="row" class="detail-label" style="width:35%;padding:12px 10px 12px 0;text-align:left;vertical-align:top;border-bottom:1px solid #e2e6ed;color:#34445d;font-weight:600;overflow-wrap:anywhere;word-break:break-word;">'+escape(label, quote=True)+
                   '</th><td class="detail-value" style="width:65%;padding:12px 0 12px 10px;vertical-align:top;border-bottom:1px solid #e2e6ed;color:#202b3c;overflow-wrap:anywhere;word-break:break-word;">'+escape(str(value), quote=True)+'</td></tr>' for label,value in details)
    template = Template((ROOT / 'templates/membership-notification.html').read_text(encoding='utf-8'))
    html = template.substitute(test_notice=escape(notice, quote=True), submission_sentence=escape(sentence, quote=True),
                               meeting_instruction=escape(instruction, quote=True), rows=rows)
    text = notice+'\n\nDear Membership,\n\n'+sentence+'\n\n'+instruction+'\n\nApplicant details appear below.\n\n'
    text += '\n'.join(f'{label}: {value}' for label,value in details)
    text += '\n\nAttachment: membership-test.pdf\nSubmission does not confirm payment or membership approval. Dues and membership year are based on expected payment receipt. Sign the printed application at the meeting after an officer verifies AMA membership.'
    return {'html': html, 'text': text}

def notification_preview(kind='new'):
    # Fixed fictional fixture only; preview never reads or modifies submissions.
    data = dict(kind=kind, category='regular', name='Alex Fictional Pilot', ama='TEST-123456',
                address='123 Example Lane', city='Example Town', state='IN', zip='46919',
                phone='(333) 453-5923', cell='(202) 555-0198', email='fictional.pilot@example.com',
                dob='1990-11-14', paymentDate='2026-11-14', meetingDate=meeting_schedule()['confirmedDates'][0])
    return notification(data, dues(kind, data['category'], date.fromisoformat(data['paymentDate'])), preview=True)

def display_date(value):
    if not value:
        return ''
    day = date.fromisoformat(value)
    return f'{MONTHS[day.month-1]} {day.day}, {day.year}'

def meeting_label(value):
    if not value:
        return ''
    meeting = datetime.combine(date.fromisoformat(value), datetime.min.time()).replace(hour=18, tzinfo=ZoneInfo('America/Indiana/Indianapolis'))
    return display_date(value)+' at 6:00 PM '+meeting.tzname()


def normalize_phone(value, label='Phone'):
    if not value.strip():
        return ''
    if any(not ('0' <= c <= '9' or c.isspace() or unicodedata.category(c).startswith('P') or c == '+') for c in value):
        raise Invalid(f'{label}: enter exactly 10 digits; spaces and punctuation are allowed.')
    digits = ''.join(c for c in value if '0' <= c <= '9')
    if len(digits) != 10:
        raise Invalid(f'{label}: enter exactly 10 digits; spaces and punctuation are allowed.')
    return f'({digits[:3]}) {digits[3:6]}-{digits[6:]}'

def display_fields(data):
    labels = {'name': 'Full name', 'ama': 'AMA number', 'address': 'Address', 'city': 'City',
              'state': 'State', 'zip': 'ZIP', 'phone': 'Phone', 'cell': 'Cell', 'email': 'Email', 'dob': 'Date of Birth'}
    return [('Application', data['kind'].capitalize()), ('Category', data['category'].capitalize())] + [
        (labels[k], display_date(data[k]) if k == 'dob' else normalize_phone(data[k], labels[k]) if k in ('phone', 'cell') else data[k]) for k in LIMITS] + [
        ('Expected Payment Receipt', display_date(data['paymentDate']))]

def dues(kind, category, received):
    year, month = received.year, received.month
    following = category == 'regular' and month >= 10
    membership_year = year + int(following)
    base = 5 if category == 'spouse' else 0 if category == 'junior' else 75 if kind == 'new' and 7 <= month <= 9 else 100
    late_fee = 20 if kind == 'renewal' and month >= 4 and not following else 0
    return {'amount': base + late_fee, 'expiry': f'{membership_year}-12-31', 'membershipYear': membership_year,
            'reason': '', 'lateFee': late_fee,
            'note': 'Based on expected payment receipt. Submission does not establish payment, approval, or active membership.'}


def validate(raw):
    if not isinstance(raw, dict) or set(raw) - FIELDS:
        raise Invalid('Unexpected application fields.')
    data = {}
    selected = raw.get('meetingDate', '')
    if not isinstance(selected, str) or (raw.get('kind') == 'new' and not selected) or (selected and selected not in meeting_schedule()['confirmedDates']):
        raise Invalid('Select an upcoming first-Tuesday club meeting. New members must select a meeting.')
    # Existing saved applications omit this field; preserve that compatibility.
    if 'meetingDate' in raw:
        data['meetingDate'] = selected
    for key, maximum in LIMITS.items():
        value = raw.get(key, '')
        if key in ('phone', 'cell') and isinstance(value, str) and len(value) <= maximum:
            value = normalize_phone(value, 'Phone' if key == 'phone' else 'Cell')
        if not isinstance(value, str) or len(value) > maximum or any(ord(c) < 32 for c in value):
            raise Invalid(f'Check {key}: invalid characters or too long (maximum {maximum}).')
        data[key] = value.strip()
    for key in ('name', 'ama', 'address', 'city', 'state', 'zip', 'email'):
        if not data[key]:
            raise Invalid(f'{key} is required.')
    for key, options in [('kind', ('new', 'renewal')), ('category', ('regular', 'spouse', 'junior'))]:
        if raw.get(key) not in options:
            raise Invalid(f'Choose a valid {key}.')
        data[key] = raw[key]
    if raw.get('acknowledge') is not True or raw.get('fictional') is not True:
        raise Invalid('Confirm review and fictional test data. This is not a signature.')
    data.update(acknowledge=True, fictional=True)
    if not re.fullmatch(r'[^\s@]+@(?:example\.(?:com|org|net)|[a-z0-9.-]+\.example)', data['email'], re.I):
        raise Invalid('Use a fictional email at example.com, example.org, example.net, or a .example domain.')
    if not re.fullmatch(r'[A-Za-z]{2}', data['state']) or not re.fullmatch(r'\d{5}(?:-\d{4})?', data['zip']):
        raise Invalid('Use a two-letter state and a US ZIP code.')
    data['state'] = data['state'].upper()
    if not (data['phone'] or data['cell']):
        raise Invalid('Provide a phone or cell number.')
    try:
        received = date.fromisoformat(raw.get('paymentDate', ''))
        if not 2026 <= received.year <= 2030:
            raise ValueError()
        data['paymentDate'] = received.isoformat()
        if data['dob']:
            born = date.fromisoformat(data['dob'])
            if not date(1900, 1, 1) <= born <= date.today():
                raise ValueError()
        elif data['category'] == 'junior':
            raise Invalid('Date of birth is required for junior membership.')
        if data['category'] == 'junior' and born <= date(received.year - 19, 3, 31):
            raise Invalid('Junior members must be younger than 19 as of March 31 of the application year.')
    except (ValueError, TypeError) as exc:
        raise Invalid(str(exc) if isinstance(exc, Invalid) else 'Check date of birth and expected payment date (2026-2030).') from None
    return data

def pdf(data, quote):
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase.pdfmetrics import stringWidth
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from pypdf import PdfReader, PdfWriter
    # Embed Unicode font, preserving names and addresses rather than replacing letters.
    font = 'MembershipSans'
    if font not in pdfmetrics.getRegisteredFontNames():
        font_path = Path('C:/Windows/Fonts/arial.ttf')
        if not font_path.exists():
            font_path = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
        pdfmetrics.registerFont(TTFont(font, str(font_path)))
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(612, 792), invariant=1)
    def fit(text, x, top, width, size=10):
        size = min(size, width / max(stringWidth(text, font, 1), 1))
        # Long values get a readable reference, with the full answer on page 2.
        if size < 8:
            text, size = 'See full answer on attached review page', 9
            size = min(size, width / stringWidth(text, font, 1))
        c.setFont(font, size)
        c.drawString(x, 792-top, text)
    fit(data['ama'], 112, 124, 102)
    fit(display_date(data['paymentDate']), 425, 124, 112)
    fit(data['name'], 137, 149, 400)
    fit(data['address'], 115, 175, 422)
    fit(data['city'], 98, 200, 260)
    fit(data['state'], 391, 200, 37)
    fit(data['zip'], 451, 200, 86)
    # Cover only preprinted number placeholders, keeping labels and answer rules.
    def replace_placeholder(value, x, top, width, rule=False):
        c.setFillColorRGB(1, 1, 1)
        c.rect(x, 792-top-3, width, 16, fill=1, stroke=0)
        c.setFillColorRGB(0, 0, 0)
        if rule:
            c.setStrokeColorRGB(.4, .4, .4)
            c.setLineWidth(.4)
            c.line(x, 792-top-2, x+width, 792-top-2)
        fit(value, x, top, width)
    for key, top, start, width in [('phone', 225, 113, 110), ('cell', 251, 134, 112)]:
        replace_placeholder(normalize_phone(data[key]), start, top, width, rule=True)
    fit(data['email'], 110, 277, 427)
    mark_top = {'regular': 328, 'spouse': 376, 'junior': 400}[data['category']]
    if data['kind'] == 'new' and data['category'] == 'regular' and 7 <= int(data['paymentDate'][5:7]) <= 9:
        mark_top = 437
    fit('X', 79, mark_top, 10)
    if quote['lateFee']:
        fit('X', 79, 352, 10)
    if data['dob']:
        replace_placeholder(display_date(data['dob']), 232, 398, 76)
    # Keep applicant and guardian signature lines blank. Instructions sit below the applicant line.
    fit('At the meeting: officer verifies AMA membership, then applicant signs above.', 72, 613, 465, 8)
    fit(str(quote['amount']) if quote['amount'] is not None else 'TBD*', 502, 486, 35, 9)
    fit('LOCAL TEST | '+data['kind'].capitalize()+' | Expected receipt date used above; estimate only. See attached review.', 72, 725, 465, 8)
    c.showPage()
    c.setFont(font, 15)
    c.drawString(54, 743, 'Application review - FICTIONAL LOCAL TEST')
    y = 714
    details = display_fields(data) + [
        ('Dues estimate', '$'+str(quote['amount']) if quote['amount'] is not None else quote['reason']),
        ('Membership year', str(quote['membershipYear'])), ('Estimated Expiry', display_date(quote['expiry'])),
        ('Status', 'Submission does not establish payment, approval, or active membership. Officer verifies AMA, then applicant signs the printed application at the meeting.'),
        ('Review acknowledgment', 'Applicant reviewed documents; acknowledgment is not a signature.'),
        ('Policy', 'Field improvement fee eliminated. New members have no renewal late fee. Board-approved online rules apply; printed provisions, including the obsolete $25 option, await revision.')]
    c.setFont(font, 10)
    for key, value in details:
        lines, line = [], ''
        for char in f'{key}: {value or "(not provided)"}':
            if stringWidth(line+char, font, 10) > 504:
                lines.append(line)
                line = ''
            line += char
        lines.append(line)
        for line in lines:
            if y < 60:
                c.showPage()
                c.setFont(font, 10)
                y = 738
            c.drawString(54, y, line)
            y -= 14
        y -= 4
    c.save()
    original = PdfReader(ROOT / 'documents/Converse Flying Eagles Application (Nov 2026).pdf')
    overlay = PdfReader(io.BytesIO(buf.getvalue()))
    writer = PdfWriter()
    writer.add_page(original.pages[0])
    writer.pages[0].merge_page(overlay.pages[0])
    for page in overlay.pages[1:]:
        writer.add_page(page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()

class ClosingConnection(sqlite3.Connection):
    def __exit__(self, *args):
        try:
            return super().__exit__(*args)
        finally:
            self.close()

class Store:
    def __init__(self, directory=PRIVATE):
        self.directory = Path(directory)
        if self.directory.resolve().is_relative_to(ROOT.resolve()):
            raise RuntimeError('Private submissions must be outside the published repository.')
        self.directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.path = self.directory / 'membership.sqlite3'
        with self.connect() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS submissions (
                id TEXT PRIMARY KEY, digest TEXT UNIQUE, data TEXT, quote TEXT, pdf BLOB,
                status TEXT, attempts INTEGER DEFAULT 0, error TEXT, provider_id TEXT,
                first_attempt REAL, created TEXT)''')

    def connect(self):
        return sqlite3.connect(self.path, timeout=10, factory=ClosingConnection)

    def save(self, data, quote, document):
        payload = json.dumps(data, sort_keys=True, ensure_ascii=False)
        digest = hashlib.sha256(payload.encode()).hexdigest()
        ident = secrets.token_hex(16)
        with self.connect() as db:
            db.execute('INSERT OR IGNORE INTO submissions(id,digest,data,quote,pdf,status,created) VALUES(?,?,?,?,?,?,?)',
                       (ident, digest, payload, json.dumps(quote), document, 'held', datetime.now(timezone.utc).isoformat()))
            row = db.execute('SELECT id,status FROM submissions WHERE digest=?', (digest,)).fetchone()
        return {'id': row[0], 'status': row[1], 'duplicate': row[0] != ident}

class Service:
    def __init__(self, store=None):
        self.store = store or Store()
        self.sessions = {}
        self.lock = threading.Lock()
        self.rates = {}

    def session(self):
        token = secrets.token_urlsafe(32)
        with self.lock:
            now = time.time()
            self.sessions = {k: v for k, v in self.sessions.items() if now-v['created'] < 3600}
            self.sessions[token] = {'created': now, 'review': None, 'downloaded': False}
        return token

    def describe_session(self, token):
        with self.lock:
            state = self.sessions.get(token)
            if not state or time.time()-state['created'] >= 3600:
                return None
            reviewed = state['review']
            return {'token': token, 'sessionID': hashlib.sha256(token.encode()).hexdigest(),
                    'expires': int((state['created']+3600)*1000), 'sendingEnabled': False,
                    'meetings': meeting_schedule(),
                    'review': {'application': reviewed[0], 'quote': reviewed[1],
                               'downloaded': state['downloaded'], 'saved': state.get('submitted')} if reviewed else None}

    def handle(self, token, action, body):
        with self.lock:
            return self._handle(token, action, body)

    def _handle(self, token, action, body):
        now = time.time()
        session = self.sessions.get(token)
        if not session or now-session['created'] > 3600:
            raise Invalid('Session expired. Reload and review your application again.')
        if not isinstance(body, dict) or body.get('website', ''):
            raise Invalid('Please wait a moment and try again; leave the hidden website field blank.')
        if action in ('logout', 'restart'):
            session.update(created=now-3601, review=None, downloaded=False, submitted=None)
            if action == 'logout':
                return {'ended': True}
            fresh = secrets.token_urlsafe(32)
            self.sessions[fresh] = {'created': now, 'review': None, 'downloaded': False}
            # Describe outside the lock in the HTTP adapter.
            return {'restartToken': fresh}
        if now-session['created'] < 2:
            raise Invalid('Please wait a moment before reviewing your application.')
        if action == 'download':
            if not session['review']:
                raise Invalid('Review the application first.')
            session['downloaded'] = True
            return session['review'][2]
        if action == 'submit':
            if not session['review'] or not session['downloaded']:
                raise Invalid('Review and download the current PDF before saving.')
            result = self.store.save(*session['review'])
            session['submitted'] = {'id': result['id'], 'status': result['status']}
            return result
        if action != 'review':
            raise Invalid('Unknown membership action.')
        data = validate(body.get('application'))
        quote = dues(data['kind'], data['category'], date.fromisoformat(data['paymentDate']))
        document = pdf(data, quote)
        session['review'], session['downloaded'], session['submitted'] = (data, quote, document), False, None
        return {'application': data, 'quote': quote}

def load_email_config():
    # Isolated file only; do not read shared keys or other projects' environment.
    path = ROOT / '.env.membership.local'
    config = {}
    if path.exists():
        for line in path.read_text().splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                config[key.strip()] = value.strip()
    return config

def delivery_error(exc, key, response_status=None):
    """Retain useful diagnostics without storing credentials, headers, or requests."""
    def redact(value):
        text = str(value)
        if key:
            text = text.replace(key, '[REDACTED]')
        text = re.sub(r'(?i)Bearer\s+[^\s"\x27]+', 'Bearer [REDACTED]', text)
        text = re.sub(r'\bre_[A-Za-z0-9_-]+', '[REDACTED]', text)
        text = re.sub(r'(?i)(authorization\s*[:=]\s*)[^\r\n]+', r'\1[REDACTED]', text)
        text = re.sub(r'(https?://)[^/@\s]+:[^/@\s]+@', r'\1[REDACTED]@', text)
        return ' '.join(text.split())[:1000]
    info = {'error_type': type(exc).__name__, 'http_status': response_status,
            'response_received': response_status is not None,
            'reconciliation_required': True, 'automatic_retry': False}
    if isinstance(exc, HTTPError):
        info.update(http_status=exc.code, response_received=True)
        try:
            body = exc.read(16384).decode('utf-8', errors='replace')
            try:
                parsed = json.loads(body)
            except ValueError:
                parsed = None
            if isinstance(parsed, dict):
                for name in ('name', 'code', 'message', 'error', 'statusCode', 'title', 'detail', 'error_code', 'error_name'):
                    if name in parsed:
                        info['provider_'+name] = redact(parsed[name])
            if not any(k.startswith('provider_') for k in info):
                info['response_excerpt'] = redact(body)
        except Exception:
            info['message'] = 'HTTP error response body could not be read.'
    else:
        info['message'] = redact(getattr(exc, 'reason', str(exc)))
    return info

def deliver(store, ident, config, transport=urlopen, first_attempt_only=False):
    """Explicit CLI only; never called by the HTTP server. No applicant confirmation mail."""
    if config.get('MEMBERSHIP_EMAIL_ENABLED') != 'true' or not config.get('RESEND_API_KEY'):
        raise Invalid('Sending is disabled or the membership key is missing.')
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT pdf,status,first_attempt,data,quote,attempts FROM submissions WHERE id=?', (ident,)).fetchone()
        if not row:
            raise Invalid('Unknown submission.')
        if row[1] == 'accepted':
            return 'already accepted'
        if first_attempt_only and (row[1] != 'held' or row[5] != 0):
            raise Invalid('This controlled test has already been attempted. Reconciliation is required; no retry made.')
        if row[1] == 'sending' or (row[2] and time.time()-row[2] >= 23*3600):
            raise Invalid('Reconcile provider status before retry: in-flight or outside the safe idempotency window.')
        db.execute('UPDATE submissions SET status=?,attempts=attempts+1,first_attempt=COALESCE(first_attempt,?) WHERE id=?', ('sending', time.time(), ident))
    data, quote = json.loads(row[3]), json.loads(row[4])
    body = notification(data, quote)
    payload = {'from': FROM, 'to': [TO], 'subject': 'FICTIONAL TEST - membership application '+ident,
               'text': body['text'], 'html': body['html'],
               'attachments': [{'filename': 'membership-test.pdf', 'content': base64.b64encode(row[0]).decode()}]}
    request = Request('https://api.resend.com/emails', data=json.dumps(payload).encode(),
                      headers={'Authorization': 'Bearer '+config['RESEND_API_KEY'], 'Content-Type': 'application/json',
                               'User-Agent': USER_AGENT, 'Accept': 'application/json',
                               'Idempotency-Key': 'membership-test/'+ident}, method='POST')
    response_status = None
    try:
        with transport(request, timeout=20) as response:
            response_status = getattr(response, 'status', 200)
            provider_id = json.load(response).get('id')
        if not isinstance(provider_id, str) or not provider_id:
            raise ValueError('No provider id')
    except Exception as exc:
        diagnostic = delivery_error(exc, config['RESEND_API_KEY'], response_status)
        with store.connect() as db:
            db.execute('UPDATE submissions SET status=?,error=? WHERE id=?', ('failed', json.dumps(diagnostic), ident))
        return 'failed'
    with store.connect() as db:
        db.execute('UPDATE submissions SET status=?,provider_id=?,error=NULL WHERE id=?', ('accepted', provider_id, ident))
    return 'accepted by Resend (inbox delivery not yet confirmed)'

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--send-test', metavar='SUBMISSION_ID')
    parser.add_argument('--list', action='store_true')
    args = parser.parse_args()
    store = Store()
    if args.send_test:
        print(deliver(store, args.send_test, load_email_config()))
    elif args.list:
        with store.connect() as db:
            for row in db.execute('SELECT id,status,attempts,error FROM submissions'):
                print(*row)
