"""Michael runs this locally to prepare a password hash; no password/key is echoed."""
from getpass import getpass
from pathlib import Path
from werkzeug.security import generate_password_hash

if __name__ == '__main__':
    first=getpass('Choose a unique George preview password (at least 20 characters): ')
    if len(first)<20 or first!=getpass('Repeat password: '):
        raise SystemExit('Passwords must match and have at least 20 characters. No file written.')
    path=Path(__file__).resolve().parent.parent/'.env.george-preview.local'
    if path.exists(): raise SystemExit('Existing settings preserved. Use your editor to update them privately.')
    path.write_text('RC_MEMBERSHIP_PREVIEW_USER=george\nRC_MEMBERSHIP_PREVIEW_PASSWORD_HASH='+generate_password_hash(first,method='scrypt')+
                    '\nRC_MEMBERSHIP_PREVIEW_ORIGIN=https://REPLACE-WITH-PREVIEW.onrender.com\nRC_MEMBERSHIP_DATA_DIR=/var/data/membership\nMEMBERSHIP_EMAIL_ENABLED=false\nRC_MEMBERSHIP_RESEND_API_KEY=\n',encoding='utf-8')
    print('Created ignored .env.george-preview.local. Copy settings privately to Render; do not upload this file.')
