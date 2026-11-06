import io
import json
from datetime import date, datetime, timezone
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'scripts'))
import membership as m
import preview

SAMPLE = dict(kind='new', category='regular', paymentDate='2026-10-01',
              name='Alexandria Fictional Montgomery-Skywalker Example', ama='TEST-123456789',
              address='12345 Fictional Aviation Boulevard, Apartment 987, North Test Wing',
              city='Fictional Long Town Name', state='IN', zip='46919-1234',
              phone='202-555-0142', cell='202-555-0198', email='fictional.pilot@example.com',
              dob='', meetingDate=m.meeting_schedule()['confirmedDates'][0], acknowledge=True, fictional=True)

class MembershipTests(unittest.TestCase):
    def test_concise_notification_and_meeting_timezone(self):
        for kind in ('new', 'renewal'):
            for day, label in [('2026-12-01', 'Dec 1, 2026 at 6:00 PM EST'), ('2027-07-06', 'Jul 6, 2027 at 6:00 PM EDT')]:
                self.assertEqual(m.meeting_label(day), label)
                for body in m.notification({**SAMPLE, 'kind': kind, 'meetingDate': day}, m.dues(kind, 'regular', date(2026, 10, 1))).values():
                    for phrase in ('Dear Membership', 'An officer verifies AMA membership, then the applicant signs', label, 'membership-test.pdf'):
                        self.assertIn(phrase, body)
                    for phrase in ('Mailing payment is not an option', 'The printed $25 option', 'Board vote followed', 'America/Indiana/Indianapolis'):
                        self.assertNotIn(phrase, body)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='rc-membership-')
        self.store = m.Store(self.temp.name)
        self.service = m.Service(self.store)
        self.token = self.service.session()
        self.service.sessions[self.token]['created'] -= 3

    def tearDown(self):
        self.temp.cleanup()

    def test_dues_boundaries_and_unresolved_rules(self):
        cases = [('renewal', '2026-01-01', 100, '2026-12-31'),
                 ('renewal', '2026-03-31', 100, '2026-12-31'),
                 ('renewal', '2026-04-01', 120, '2026-12-31'),
                 ('renewal', '2026-09-30', 120, '2026-12-31'),
                 ('renewal', '2026-10-01', 100, '2027-12-31'),
                 ('renewal', '2026-12-31', 100, '2027-12-31'),
                 ('new', '2026-06-30', 100, '2026-12-31'),
                 ('new', '2026-07-01', 75, '2026-12-31'),
                 ('new', '2026-09-30', 75, '2026-12-31'),
                 ('new', '2026-10-01', 100, '2027-12-31'),
                 ('new', '2026-12-31', 100, '2027-12-31')]
        for kind, day, amount, expiry in cases:
            with self.subTest(kind=kind, day=day):
                quote = m.dues(kind, 'regular', date.fromisoformat(day))
                self.assertEqual((quote['amount'], quote['expiry']), (amount, expiry))
                if kind == 'new': self.assertEqual(quote['lateFee'], 0)
        for category, base in [('spouse', 5), ('junior', 0)]:
            self.assertEqual(m.dues('new', category, date(2026, 11, 1))['amount'], base)
            self.assertEqual(m.dues('renewal', category, date(2026, 3, 31))['amount'], base)
            self.assertEqual(m.dues('renewal', category, date(2026, 4, 1))['amount'], base+20)

    def test_validation_and_junior_age(self):
        self.assertEqual(m.validate(SAMPLE)['state'], 'IN')
        for change in [dict(email='real@other.test'), dict(name='x'*101), dict(name='A\nB'),
                       dict(phone='', cell=''), dict(category='unknown'), dict(acknowledge=False),
                       dict(fictional=False), dict(zip='123'), dict(paymentDate='2026-02-30'),
                       dict(to='attacker@example.com'), dict(category='junior', dob=''),
                       dict(category='junior', dob='2007-03-31')]:
            with self.subTest(change=change), self.assertRaises(m.Invalid):
                m.validate({**SAMPLE, **change})
        m.validate({**SAMPLE, 'category':'junior', 'dob':'2007-04-01'})

    def test_display_formatting_and_phone_normalization(self):
        for value in ['3334535923', '(333) 453-5923', '333.453.5923', '333 / 453 / 5923', '333\u00a0453\u00a05923', '333–453—5923']:
            with self.subTest(value=value):
                self.assertEqual(m.validate({**SAMPLE, 'phone':value})['phone'], '(333) 453-5923')
        self.assertEqual(m.normalize_phone('012 034 0056'), '(012) 034-0056')
        self.assertEqual(m.normalize_phone('  '), '')
        for value in ['333453592', '13334535923', '33345359233', '333CALL5923', '3334535923 ext 9']:
            with self.subTest(value=value), self.assertRaisesRegex(m.Invalid, 'exactly 10 digits'):
                m.validate({**SAMPLE,'phone':value})
        for iso, expected in [('2026-11-14','Nov 14, 2026'), ('2028-02-29','Feb 29, 2028'), ('2026-01-01','Jan 1, 2026')]:
            self.assertEqual(m.display_date(iso),expected)
        data=m.validate({**SAMPLE,'paymentDate':'2026-11-14','dob':'2000-01-01','phone':'012.034.0056','cell':''})
        fields=dict(m.display_fields(data))
        self.assertEqual(fields['Application'],'New')
        self.assertEqual(fields['Category'],'Regular')
        self.assertEqual(fields['Expected Payment Receipt'],'Nov 14, 2026')
        self.assertEqual(fields['Date of Birth'],'Jan 1, 2000')
        self.assertEqual(fields['Phone'],'(012) 034-0056')
        self.assertEqual(fields['Cell'],'')
        from pypdf import PdfReader
        reader=PdfReader(io.BytesIO(m.pdf(data,m.dues('new','regular',date(2026,11,14)))))
        for expected in ['Nov 14, 2026','Jan 1, 2000','(012) 034-0056']:
            self.assertIn(expected,reader.pages[0].extract_text())
        for expected in ['Application: New','Category: Regular','Estimated Expiry: Dec 31, 2027']:
            self.assertIn(expected,reader.pages[1].extract_text())

    def test_notification_html_fallback_escaping_and_meeting_separation(self):
        data=m.validate({**SAMPLE,'name':'Fictional <img src=x onerror=alert(1)> & "Pilot"',
                         'address':'123 <script>Example</script> Lane','dob':'1990-11-14','meetingDate':SAMPLE['meetingDate'],'paymentDate':'2026-11-14'})
        quote=m.dues('new','regular',date(2026,11,14))
        body=m.notification(data,quote)
        self.assertIn('A new membership application has been submitted.',body['html'])
        self.assertIn('Dear Membership,',body['text'])
        self.assertIn('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Pilot&quot;',body['html'])
        self.assertNotIn('<script>Example</script>',body['html'])
        self.assertIn('123 &lt;script&gt;Example&lt;/script&gt; Lane',body['html'])
        self.assertIn('Selected meeting date: '+m.meeting_label(SAMPLE['meetingDate']),body['text'])
        self.assertIn('bring it to the selected club meeting',body['text'])
        self.assertIn('bring it to the selected club meeting',body['html'])
        self.assertIn('Expected Payment Receipt: Nov 14, 2026',body['text'])
        for expected in ['New','Regular','Nov 14, 1990','(202) 555-0142','Estimated dues: $100','Estimated Expiry: Dec 31, 2027']:
            self.assertIn(expected,body['text'])
        self.assertIn('FICTIONAL TEST',body['html'])
        self.assertIn('Submission does not confirm payment or membership approval.',body['text'])
        self.assertIn('@media only screen and (max-width: 480px)',body['html'])
        renewal=m.notification({**data,'kind':'renewal','meetingDate':'2026-12-01'},quote)
        self.assertIn('A membership renewal has been submitted.',renewal['html'])
        self.assertIn('Selected meeting date: Dec 1, 2026',renewal['text'])
        self.assertIn('bring it to the selected club meeting',renewal['text'])
        self.assertIn('Expected Payment Receipt: Nov 14, 2026',renewal['text'])
        self.assertNotIn('Date of Birth:',m.notification({**data,'dob':''},quote)['text'])

    def test_monthly_meetings_and_validation(self):
        schedule = m.meeting_schedule(datetime(2026, 12, 31, 23, tzinfo=timezone.utc))
        self.assertEqual(schedule['confirmedDates'][:3], ['2027-01-05', '2027-02-02', '2027-03-02'])
        for day in schedule['confirmedDates']:
            parsed = date.fromisoformat(day)
            self.assertEqual(parsed.weekday(), 1)
            self.assertLessEqual(parsed.day, 7)
        self.assertEqual(m.meeting_schedule(datetime(2026, 12, 1, 22, 59, tzinfo=timezone.utc))['confirmedDates'][0], '2026-12-01')
        self.assertEqual(m.meeting_schedule(datetime(2026, 12, 1, 23, 0, tzinfo=timezone.utc))['confirmedDates'][0], '2027-01-05')
        self.assertEqual(m.meeting_schedule(datetime(2026, 7, 7, 21, 59, tzinfo=timezone.utc))['confirmedDates'][0], '2026-07-07')
        self.assertEqual(m.meeting_schedule(datetime(2026, 7, 7, 22, 0, tzinfo=timezone.utc))['confirmedDates'][0], '2026-08-04')
        with self.assertRaises(m.Invalid): m.validate({**SAMPLE, 'meetingDate': ''})
        self.assertEqual(m.validate({**SAMPLE, 'kind': 'renewal', 'meetingDate': ''})['meetingDate'], '')
        with self.assertRaises(m.Invalid): m.validate({**SAMPLE, 'meetingDate': '2026-11-14'})

    def test_review_download_before_save_duplicate_and_edit(self):
        with self.assertRaises(m.Invalid): self.service.handle(self.token, 'submit', {})
        self.service.handle(self.token, 'review', {'application': SAMPLE})
        with self.assertRaises(m.Invalid): self.service.handle(self.token, 'submit', {})
        self.assertTrue(self.service.handle(self.token, 'download', {}).startswith(b'%PDF'))
        first = self.service.handle(self.token, 'submit', {})
        second = self.service.handle(self.token, 'submit', {})
        self.assertEqual(first['id'], second['id'])
        self.assertTrue(second['duplicate'])
        self.assertEqual(first['status'], 'held')
        restarted_store = m.Store(self.temp.name)
        persisted = restarted_store.save(*self.service.sessions[self.token]['review'])
        self.assertEqual(persisted['id'], first['id'])
        self.assertTrue(persisted['duplicate'])
        self.service.handle(self.token, 'review', {'application':{**SAMPLE, 'name':'Changed Fictional Name'}})
        with self.assertRaises(m.Invalid): self.service.handle(self.token, 'submit', {})
        with self.store.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM submissions').fetchone()[0], 1)

    def test_spam_and_expiry(self):
        with self.assertRaises(m.Invalid): self.service.handle(self.token, 'review', {'website':'spam', 'application':SAMPLE})
        fresh = self.service.session()
        with self.assertRaises(m.Invalid): self.service.handle(fresh, 'review', {'application':SAMPLE})
        self.service.sessions[self.token]['created'] -= 3600
        with self.assertRaises(m.Invalid): self.service.handle(self.token, 'review', {'application':SAMPLE})

    def test_session_recovery_restart_and_logout_preserve_private_submissions(self):
        self.service.handle(self.token, 'review', {'application': SAMPLE})
        self.service.handle(self.token, 'download', {})
        saved = self.service.handle(self.token, 'submit', {})
        resumed = self.service.describe_session(self.token)
        self.assertEqual(resumed['review']['application']['name'], SAMPLE['name'])
        self.assertEqual(resumed['review']['saved']['id'], saved['id'])
        self.assertTrue(resumed['review']['downloaded'])
        self.assertNotIn('pdf', resumed['review'])
        fresh = self.service.handle(self.token, 'restart', {})['restartToken']
        self.assertIsNone(self.service.describe_session(self.token))
        self.assertIsNone(self.service.describe_session(fresh)['review'])
        self.assertEqual(self.service.handle(fresh, 'logout', {}), {'ended': True})
        self.assertIsNone(self.service.describe_session(fresh))
        with self.store.connect() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM submissions').fetchone()[0], 1)

    def test_pdf_long_entries_background_and_signatures(self):
        from pypdf import PdfReader
        data = m.validate({**SAMPLE, 'name':'Fictional '+ 'W'*90, 'address':'Fictional '+ 'W'*130,
                           'email':'w'*135+'@example.com', 'city':'Fictional '+ 'W'*60})
        doc = m.pdf(data, m.dues('new', 'regular', date(2026, 10, 1)))
        reader = PdfReader(io.BytesIO(doc))
        original = PdfReader(m.ROOT / 'documents/Converse Flying Eagles Application (Nov 2026).pdf')
        self.assertEqual(len(reader.pages), 2)
        self.assertEqual(len(reader.pages[0].images), len(original.pages[0].images))
        text = reader.pages[0].extract_text()
        self.assertNotIn('Pending Board confirmation', text)
        self.assertIn('officer verifies AMA membership, then applicant signs above.', text)
        self.assertIn('attached review page', text)
        full = reader.pages[1].extract_text().replace('\n','')
        for key in ('name', 'address', 'city', 'email'):
            self.assertIn(data[key].replace(' ', ''), full.replace(' ', ''))

    def test_email_disabled_allowlist_failure_retry_and_idempotency(self):
        self.service.handle(self.token, 'review', {'application':SAMPLE})
        self.service.handle(self.token, 'download', {})
        ident = self.service.handle(self.token, 'submit', {})['id']
        requests = []
        def transport(request, timeout):
            requests.append(request)
            return io.BytesIO(b'{"id":"fake-provider-id"}')
        with self.assertRaises(m.Invalid):
            m.deliver(self.store, ident, {'RESEND_API_KEY':'FAKE'}, transport)
        self.assertFalse(requests)
        config = {'RESEND_API_KEY':'FAKE', 'MEMBERSHIP_EMAIL_ENABLED':'true', 'TO':'attacker@example.com'}
        def fail(request, timeout):
            requests.append(request)
            raise URLError('simulated offline')
        self.assertEqual(m.deliver(self.store, ident, config, fail), 'failed')
        with self.store.connect() as db:
            row = db.execute('SELECT status,error,attempts FROM submissions WHERE id=?', (ident,)).fetchone()
        self.assertEqual((row[0],row[2]), ('failed',1))
        self.assertNotIn('FAKE', row[1])
        self.assertIn('accepted by Resend', m.deliver(self.store, ident, config, transport))
        self.assertEqual(m.deliver(self.store, ident, config, transport), 'already accepted')
        self.assertEqual(len(requests), 2)
        for request in requests:
            payload = json.loads(request.data)
            self.assertEqual(payload['to'], ['mvaughan737@gmail.com'])
            self.assertEqual(payload['from'], m.FROM)
            self.assertEqual(request.get_header('User-agent'), 'RC-Flyers-Membership/1.0')
            self.assertFalse(set(payload) & {'cc','bcc','reply_to'})
            self.assertIn('Application: New',payload['text'])
            self.assertIn('Category: Regular',payload['text'])
            self.assertIn('Expected Payment Receipt: Oct 1, 2026',payload['text'])
            self.assertIn('Phone: (202) 555-0142',payload['text'])
            self.assertIn('Estimated Expiry: Dec 31, 2027',payload['text'])
            self.assertIn('<html lang="en">',payload['html'])
            self.assertIn('FICTIONAL TEST',payload['html'])
            import base64
            with self.store.connect() as db:
                saved_pdf=db.execute('SELECT pdf FROM submissions WHERE id=?',(ident,)).fetchone()[0]
            self.assertEqual(base64.b64decode(payload['attachments'][0]['content']),saved_pdf)
        self.assertEqual(requests[0].get_header('Idempotency-key'), requests[1].get_header('Idempotency-key'))

    def test_redacted_http_and_connection_diagnostics(self):
        key='re_FAKE_PRIVATE_TEST'
        error=HTTPError('https://api.resend.com/emails',403,'Forbidden',{},io.BytesIO(json.dumps({
            'name':'validation_error', 'message':'Invalid domain; '+key+' Authorization: Bearer '+key,
            'ignored_request_headers':{'Authorization':'Bearer '+key}}).encode()))
        info=m.delivery_error(error,key)
        self.assertEqual(info['http_status'],403)
        self.assertEqual(info['provider_name'],'validation_error')
        self.assertTrue(info['response_received'])
        self.assertFalse(info['automatic_retry'])
        self.assertNotIn(key,json.dumps(info))
        self.assertNotIn('ignored_request_headers',info)
        connection=m.delivery_error(URLError('DNS lookup failed '+key),key)
        self.assertEqual(connection['error_type'],'URLError')
        self.assertIsNone(connection['http_status'])
        self.assertFalse(connection['response_received'])
        self.assertIn('DNS lookup failed',connection['message'])
        self.assertNotIn(key,json.dumps(connection))
        non_json=m.delivery_error(HTTPError('https://api.resend.com/emails',403,'Forbidden',{},io.BytesIO(b'error code: 1010')),key)
        self.assertEqual(non_json['response_excerpt'],'error code: 1010')
        response=m.delivery_error(ValueError('No provider id'),key,200)
        self.assertEqual(response['http_status'],200)
        self.assertTrue(response['reconciliation_required'])

    def test_http_failure_is_recorded_once_without_retry(self):
        self.service.handle(self.token,'review',{'application':SAMPLE})
        self.service.handle(self.token,'download',{})
        ident=self.service.handle(self.token,'submit',{})['id']
        calls=[]
        def blocked(request,timeout):
            calls.append(request)
            raise HTTPError(request.full_url,403,'Forbidden',{},io.BytesIO(json.dumps({
                'title':'Error 1010: Access denied','error_code':1010,
                'detail':"The site owner has blocked access based on your browser's signature."}).encode()))
        self.assertEqual(m.deliver(self.store,ident,{'RESEND_API_KEY':'re_FAKE_TEST','MEMBERSHIP_EMAIL_ENABLED':'true'},blocked),'failed')
        with self.store.connect() as db:
            status,attempts,error=db.execute('SELECT status,attempts,error FROM submissions WHERE id=?',(ident,)).fetchone()
        diagnostic=json.loads(error)
        self.assertEqual((status,attempts,len(calls)),('failed',1,1))
        self.assertEqual(diagnostic['http_status'],403)
        self.assertEqual(diagnostic['provider_error_code'],'1010')
        self.assertIn('browser',diagnostic['provider_detail'])
        self.assertNotIn('re_FAKE_TEST',error)

    def test_uncertain_delivery_outside_window_is_blocked(self):
        ident = self.store.save(m.validate(SAMPLE), {}, b'%PDF')['id']
        with self.store.connect() as db:
            db.execute('UPDATE submissions SET first_attempt=?, status=? WHERE id=?', (time.time()-24*3600,'failed',ident))
        with self.assertRaises(m.Invalid):
            m.deliver(self.store, ident, {'RESEND_API_KEY':'FAKE', 'MEMBERSHIP_EMAIL_ENABLED':'true'}, lambda *a,**k:self.fail('Network forbidden'))

class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix='rc-http-')
        preview.PreviewHandler.service = m.Service(m.Store(cls.temp.name))
        cls.server = preview.ThreadingHTTPServer(('127.0.0.1',0), preview.PreviewHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.thread.join(); cls.temp.cleanup()
        preview.PreviewHandler.service = None

    def test_private_routes_and_original_downloads(self):
        for path in ['/.env.membership.local','/.git/config','/output/pdf/sample.pdf','/tmp/test', '/documents/', '/api/membership/some-id.pdf']:
            with self.subTest(path=path), self.assertRaises(HTTPError) as exc: urlopen(self.base+path)
            self.assertEqual(exc.exception.code,404)
        for path in (m.ROOT/'documents').glob('*.pdf'):
            from urllib.parse import quote
            with urlopen(self.base+'/documents/'+quote(path.name)) as response:
                self.assertEqual(response.headers.get_content_type(),'application/pdf')
                self.assertEqual(response.read(),path.read_bytes())

    def test_fictional_html_preview_and_plain_text_do_not_change_submissions(self):
        service=preview.PreviewHandler.service
        with service.store.connect() as db: before=db.execute('SELECT count(*) FROM submissions').fetchone()[0]
        for suffix,content_type in [('html','text/html'),('txt','text/plain')]:
            with urlopen(self.base+'/membership-email-preview.'+suffix+'?type=renewal') as response:
                body=response.read().decode()
                self.assertEqual(response.headers.get_content_type(),content_type)
                self.assertIn('FICTIONAL TEST',body)
                self.assertIn('A membership renewal has been submitted.',body)
                self.assertIn('Nov 14, 2026',body)
        with service.store.connect() as db: self.assertEqual(db.execute('SELECT count(*) FROM submissions').fetchone()[0],before)

    def test_origin_csrf_errors_and_rate_limit(self):
        with urlopen(self.base+'/api/membership/session') as response:
            token = json.load(response)['token']
            self.assertIn('HttpOnly',response.headers['Set-Cookie'])
        headers = {'Content-Type':'application/json','Origin':self.base,'X-Membership-Token':token,'Cookie':f'membership_session={token}'}
        for changes, status in [({'Origin':'https://other.example'},403), ({'X-Membership-Token':''},403)]:
            req = Request(self.base+'/api/membership/review',data=b'{}',headers={**headers,**changes})
            with self.assertRaises(HTTPError) as exc: urlopen(req)
            self.assertEqual(exc.exception.code,status)
        preview.PreviewHandler.service.sessions[token]['created'] -= 3
        req = Request(self.base+'/api/membership/review',data=b'not json',headers=headers)
        with self.assertRaises(HTTPError) as exc: urlopen(req)
        self.assertEqual(exc.exception.code,400)
        req = Request(self.base+'/api/membership/review',data=b' '*12001,headers=headers)
        with self.assertRaises(HTTPError) as exc: urlopen(req)
        self.assertEqual(exc.exception.code,413)
        req = Request(self.base+'/api/membership/review',data=json.dumps({'application':SAMPLE}).encode(),headers=headers)
        with patch.object(m, 'pdf', side_effect=OSError('simulated disk or rendering failure')):
            with self.assertRaises(HTTPError) as exc: urlopen(req)
            self.assertEqual(exc.exception.code,503)
            self.assertNotIn('simulated', json.load(exc.exception)['error'])
        preview.PreviewHandler.service.rates['127.0.0.1'] = [time.time()]*30
        with self.assertRaises(HTTPError) as exc: urlopen(req)
        self.assertEqual(exc.exception.code,429)
        preview.PreviewHandler.service.rates.clear()

if __name__ == '__main__': unittest.main()
