"""Prepare ignored hosted configuration locally. Never reads the existing Resend/Alumni keys."""
from pathlib import Path
from getpass import getpass
import hashlib
import secrets

target = Path(__file__).resolve().parent.parent / '.env.netlify-pilot.local'
if target.exists():
    raise SystemExit('Existing pilot configuration preserved. Edit it privately; no changes made.')
password = getpass('Choose a NEW strong pilot password (hidden; share privately with George): ')
if len(password) < 16:
    raise SystemExit('Use at least 16 characters. No file written.')
if password != getpass('Repeat password (hidden): '):
    raise SystemExit('Passwords did not match. No file written.')
salt = secrets.token_bytes(16)
digest = hashlib.scrypt(password.encode(), salt=salt, n=32768, r=8, p=1, dklen=32, maxmem=128*1024*1024)
lines = [
    '# Private server configuration. Never publish this file or paste its contents in chat.',
    'CFE_PILOT_ENABLED=false',
    'CFE_PILOT_ORIGIN=https://converse-flying-eagles.netlify.app',
    f'CFE_PILOT_PASSWORD_HASH=scrypt-v1${salt.hex()}${digest.hex()}',
    f'CFE_PILOT_SECRET={secrets.token_hex(32)}',
    f'CFE_PILOT_OPERATOR_TOKEN={secrets.token_hex(32)}',
    'MEMBERSHIP_EMAIL_ENABLED=false',
    'CFE_PILOT_SEND_REFERENCE=',
    '# Dedicated converseflyingeagles.org Resend Sending key only; never use Alumni credentials.',
    'CFE_PILOT_RESEND_API_KEY=',
]
with target.open('x', encoding='utf-8') as output:
    output.write('\n'.join(lines)+'\n')
print(f'Prepared private configuration: {target}')
print('The Resend setting is blank. Paste the dedicated key privately into server secret configuration; sending stays disabled.')
