import base64
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from werkzeug.security import generate_password_hash

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
import membership as m
from test_membership import SAMPLE

def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result)
    return result

remote=module('remote_preview','preview-hosting/app.py')
mail=module('remote_mail','preview-hosting/mail.py')
packager=module('prepare_preview','preview-hosting/prepare.py')

class RemotePreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password='fictional-preview-access-123456'
        cls.settings={'RC_MEMBERSHIP_PREVIEW_ORIGIN':'https://george-preview.example',
                      'RC_MEMBERSHIP_PREVIEW_USER':'george',
                      'RC_MEMBERSHIP_PREVIEW_PASSWORD_HASH':generate_password_hash(cls.password,method='scrypt')}
        cls.auth='Basic '+base64.b64encode(('george:'+cls.password).encode()).decode()

    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='rc-remote-')
        self.public=Path(self.temp.name)/'public';self.public.mkdir()
        (self.public/'membership.html').write_text('Protected test form')
        self.store=m.Store(Path(self.temp.name)/'private')
        self.app=remote.create_app(self.settings,self.store,self.public)
        self.client=self.app.test_client()
        self.service=self.app.extensions['membership_service']

    def tearDown(self):self.temp.cleanup()

    def request(self,path,method='GET',headers=None,**kwargs):
        return self.client.open(path,method=method,base_url=self.settings['RC_MEMBERSHIP_PREVIEW_ORIGIN'],
                                headers={'Authorization':self.auth,**(headers or {})},**kwargs)

    def session(self):
        response=self.request('/api/membership/session')
        token=response.json['token']
        self.service.sessions[token]['created']-=3
        return token,response

    def post(self,action,token,body):
        return self.request('/api/membership/'+action,'POST',headers={
            'Origin':self.settings['RC_MEMBERSHIP_PREVIEW_ORIGIN'],'X-Membership-Token':token},json=body)

    def test_protection_fails_closed_and_covers_static_documents_and_api(self):
        with self.assertRaises(RuntimeError):remote.create_app({},self.store,self.public)
        with self.assertRaises(RuntimeError):remote.create_app({**self.settings,'RC_MEMBERSHIP_PREVIEW_ORIGIN':'https://converse-flying-eagles.netlify.app'},self.store,self.public)
        for path in ['/','/membership.html','/documents/blank.pdf','/api/membership/session','/membership-email-preview.html']:
            self.assertEqual(self.client.get(path,base_url=self.settings['RC_MEMBERSHIP_PREVIEW_ORIGIN']).status_code,401,path)
        self.assertEqual(self.client.get('/healthz').json,{'ok':True})
        self.assertEqual(self.client.get('/membership.html',headers={'Authorization':self.auth}).status_code,403)
        response=self.request('/membership.html');self.assertEqual(response.status_code,200)
        self.assertIn('no-store',response.headers['Cache-Control'])
        self.assertIn('noindex',response.headers['X-Robots-Tag'])
        response.close()
        for path in ['/.env.membership.local','/scripts/membership.py','/../private/membership.sqlite3','/public/../private/membership.sqlite3','/membership.sqlite3','/api/membership/known-id.pdf']:
            self.assertEqual(self.request(path).status_code,404,path)

    def test_full_review_download_save_persistence_and_no_web_email(self):
        with patch.object(m,'deliver',side_effect=AssertionError('HTTP cannot send email')):
            token,response=self.session()
            self.assertFalse(response.json['sendingEnabled'])
            cookie=response.headers['Set-Cookie']
            for flag in ['Secure','HttpOnly','SameSite=Strict']:self.assertIn(flag,cookie)
            self.assertEqual(self.post('submit',token,{}).status_code,400)
            review=self.post('review',token,{'application':SAMPLE})
            self.assertEqual(review.status_code,200)
            self.assertEqual(review.json['application']['phone'],'(202) 555-0142')
            self.assertEqual(review.json['quote']['amount'],100)
            self.assertEqual(self.post('submit',token,{}).status_code,400)
            document=self.post('download',token,{})
            self.assertEqual(document.mimetype,'application/pdf');self.assertTrue(document.data.startswith(b'%PDF'))
            saved=self.post('submit',token,{})
            self.assertEqual(saved.json['status'],'held')
            self.assertTrue(self.post('submit',token,{}).json['duplicate'])
            restored=m.Store(Path(self.temp.name)/'private')
            with restored.connect() as db:
                row=db.execute('SELECT status,pdf,attempts FROM submissions WHERE id=?',(saved.json['id'],)).fetchone()
            self.assertEqual(row,('held',document.data,0))
            # A service restart expires a review session; submitted records remain durable.
            fresh=remote.create_app(self.settings,restored,self.public)
            self.assertFalse(fresh.extensions['membership_service'].sessions)

    def test_origin_cookie_honeypot_limits_and_recovery_errors(self):
        token,_=self.session()
        bad_origin=self.request('/api/membership/review','POST',headers={'Origin':'https://attacker.example','X-Membership-Token':token},json={})
        self.assertEqual(bad_origin.status_code,403)
        self.assertEqual(self.request('/api/membership/review','POST',headers={'Origin':self.settings['RC_MEMBERSHIP_PREVIEW_ORIGIN']},json={}).status_code,403)
        self.assertEqual(self.post('review',token,{'website':'spam','application':SAMPLE}).status_code,400)
        with patch.object(m,'pdf',side_effect=OSError('private implementation details')):
            response=self.post('review',token,{'application':SAMPLE})
            self.assertEqual(response.status_code,503);self.assertNotIn('private implementation',response.get_data(as_text=True))
        self.assertEqual(self.request('/api/membership/review','POST',headers={'Origin':self.settings['RC_MEMBERSHIP_PREVIEW_ORIGIN'],'X-Membership-Token':token},data=' '*12001,content_type='application/json').status_code,413)
        self.assertEqual(self.post('send',token,{}).status_code,404)
        for _ in range(27):self.post('review',token,{})
        self.assertEqual(self.post('review',token,{}).status_code,429)

    def test_george_only_operator_send_disabled_by_default_no_duplicate_attempt(self):
        data=m.validate(SAMPLE);quote=m.dues('new','regular',m.date(2026,10,1));document=m.pdf(data,quote)
        ident=self.store.save(data,quote,document)['id']
        with self.assertRaises(m.Invalid):mail.send_once(self.store,ident,{},lambda *a,**k:self.fail('No network'))
        captured=[]
        def stub(request,timeout):
            captured.append(request)
            return io.BytesIO(b'{"id":"fake-george-id"}')
        env={'MEMBERSHIP_EMAIL_ENABLED':'true','RC_MEMBERSHIP_RESEND_API_KEY':'re_FAKE', 'TO':'attacker@example.com'}
        original=m.TO
        self.assertIn('accepted',mail.send_once(self.store,ident,env,stub))
        self.assertEqual(m.TO,original)
        payload=json.loads(captured[0].data)
        self.assertEqual(payload['to'],['mg.farris@comcast.net'])
        self.assertEqual(payload['from'],'membership@converseflyingeagles.org')
        self.assertFalse(set(payload)&{'cc','bcc','reply_to'})
        self.assertEqual(base64.b64decode(payload['attachments'][0]['content']),document)
        self.assertIn('FICTIONAL TEST',payload['html']);self.assertIn(m.meeting_label(SAMPLE['meetingDate']),payload['text'])
        with self.assertRaises(m.Invalid):mail.send_once(self.store,ident,env,stub)
        self.assertEqual(len(captured),1)

    def test_failed_george_send_cannot_be_implicitly_retried(self):
        data=m.validate(SAMPLE);ident=self.store.save(data,m.dues('new','regular',m.date(2026,10,1)),b'%PDF fake')['id']
        def fail(*args,**kwargs):raise OSError('simulated connection failure')
        env={'MEMBERSHIP_EMAIL_ENABLED':'true','RC_MEMBERSHIP_RESEND_API_KEY':'re_FAKE'}
        self.assertEqual(mail.send_once(self.store,ident,env,fail),'failed')
        with self.assertRaises(m.Invalid):mail.send_once(self.store,ident,env,fail)
        # Atomic core guard protects even a caller racing past the operator precheck.
        with self.assertRaises(m.Invalid):m.deliver(self.store,ident,{'MEMBERSHIP_EMAIL_ENABLED':'true','RESEND_API_KEY':'FAKE'},transport=fail,first_attempt_only=True)

    def test_weather_fixed_upstream_and_failure(self):
        with patch.object(remote,'urlopen',return_value=io.BytesIO(b'[{"icaoId":"KOKK"}]')) as upstream:
            self.assertEqual(self.request(remote.WEATHER_PATH).json,[{'icaoId':'KOKK'}])
            req=upstream.call_args.args[0]
            self.assertEqual(req.full_url,remote.WEATHER_URL)
            self.assertIsNone(req.get_header('Authorization'))
        with patch.object(remote,'urlopen',side_effect=OSError()):
            self.assertEqual(self.request(remote.WEATHER_PATH).status_code,502)

    def test_package_allowlist_preserves_sources_and_excludes_all_private_state(self):
        output=packager.prepare(Path(self.temp.name)/'package')
        manifest=json.loads((output/'package-manifest.json').read_text())
        for name in manifest:
            self.assertNotIn('.env',name);self.assertNotIn('.sqlite',name);self.assertNotIn('RC-Flyers-private',name)
        self.assertNotIn('public/scripts/membership.py',manifest)
        backend=(output/'scripts/membership.py').read_text(encoding='utf-8')
        source=(ROOT/'scripts/membership.py').read_text(encoding='utf-8')
        self.assertEqual(backend,source.replace("TO = 'mvaughan737@gmail.com'  # Initial test: Michael only; no cc/bcc or applicant mail.","TO = 'mg.farris@comcast.net'  # Protected George preview only; no cc/bcc or applicant mail."))
        self.assertNotIn("TO = 'mvaughan737@gmail.com'",backend)
        self.assertEqual((output/'templates/membership-notification.html').read_bytes(),(ROOT/'templates/membership-notification.html').read_bytes())
        self.assertEqual(len(list((output/'public/documents').glob('*.pdf'))),4)
        for pdf in (ROOT/'documents').glob('*.pdf'):
            self.assertEqual((output/'public/documents'/pdf.name).read_bytes(),pdf.read_bytes())
        with self.assertRaises(ValueError):packager.prepare(output)

if __name__=='__main__':unittest.main()
