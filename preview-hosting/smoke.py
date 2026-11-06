"""Offline Linux image smoke check; creates only fictional data and never sends email."""
import base64
import io
from pathlib import Path
import tempfile
from werkzeug.security import generate_password_hash
from pypdf import PdfReader
from remote_preview import create_app, m

if __name__=='__main__':
    with tempfile.TemporaryDirectory() as directory:
        settings={'RC_MEMBERSHIP_PREVIEW_ORIGIN':'https://george-preview.example',
                  'RC_MEMBERSHIP_PREVIEW_USER':'george',
                  'RC_MEMBERSHIP_PREVIEW_PASSWORD_HASH':generate_password_hash('fictional-smoke-password-12345',method='scrypt')}
        app=create_app(settings,m.Store(directory));client=app.test_client()
        base=settings['RC_MEMBERSHIP_PREVIEW_ORIGIN']
        headers={'Authorization':'Basic '+base64.b64encode(b'george:fictional-smoke-password-12345').decode()}
        assert client.get('/membership.html',base_url=base).status_code==401
        assert client.get('/membership.html',base_url=base,headers=headers).status_code==200
        response=client.get('/api/membership/session',base_url=base,headers=headers)
        token=response.json['token'];app.extensions['membership_service'].sessions[token]['created']-=3
        assert not response.json['sendingEnabled']
        headers.update(Origin=base,**{'X-Membership-Token':token})
        data=dict(kind='new',category='regular',meetingDate='',paymentDate='2026-11-14',
                  name='Fictional George Preview Pilot',ama='TEST123',address='123 Example Lane',
                  city='Example Town',state='IN',zip='46919',phone='012.034.0056',cell='',
                  email='pilot@example.com',dob='',acknowledge=True,fictional=True)
        response=client.post('/api/membership/review',base_url=base,headers=headers,json={'application':data})
        assert response.status_code==200 and response.json['quote']['amount']==25
        response=client.post('/api/membership/download',base_url=base,headers=headers,json={})
        pdf=PdfReader(io.BytesIO(response.data));assert len(pdf.pages)==2
        assert 'Nov 14, 2026' in pdf.pages[0].extract_text()
        assert '(012) 034-0056' in pdf.pages[1].extract_text()
        Path('/tmp/preview-smoke.pdf').write_bytes(response.data)
        response=client.post('/api/membership/submit',base_url=base,headers=headers,json={})
        assert response.json['status']=='held'
        for path in ['/.env.membership.local','/scripts/membership.py','/membership.sqlite3']:
            assert client.get(path,base_url=base,headers=headers).status_code==404
        print('Protected routes, private save and Linux PDF generation passed. No email sent. PDF: /tmp/preview-smoke.pdf')
