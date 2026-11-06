"""Operator-only George test sender. No HTTP send endpoint and no automatic worker."""
import argparse
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'scripts' if (ROOT / 'scripts').is_dir() else ROOT.parent / 'scripts'))
import membership as m

GEORGE = 'mg.farris@comcast.net'  # No environment or applicant recipient overrides.

def send_once(store, ident, env, transport=None):
    if env.get('MEMBERSHIP_EMAIL_ENABLED') != 'true' or not env.get('RC_MEMBERSHIP_RESEND_API_KEY'):
        raise m.Invalid('George preview sending is disabled or its dedicated key is absent.')
    with store.connect() as db:
        row = db.execute('SELECT status,attempts FROM submissions WHERE id=?', (ident,)).fetchone()
    if not row or row != ('held', 0):
        raise m.Invalid('Select a held, never-attempted reference. No automatic or implicit retry is allowed.')
    config = {'MEMBERSHIP_EMAIL_ENABLED':'true', 'RESEND_API_KEY':env['RC_MEMBERSHIP_RESEND_API_KEY']}
    # This module runs in a separate operator CLI process; the accepted local setup is untouched.
    original_recipient = m.TO
    try:
        m.TO = GEORGE
        return m.deliver(store, ident, config, first_attempt_only=True, **({'transport':transport} if transport else {}))
    finally:
        m.TO = original_recipient

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--list', action='store_true')
    group.add_argument('--send-once', metavar='REFERENCE')
    args = parser.parse_args()
    store = m.Store(os.environ.get('RC_MEMBERSHIP_DATA_DIR', '/var/data/membership'))
    try:
        if args.list:
            with store.connect() as db:
                for row in db.execute('SELECT id,status,attempts,provider_id,error FROM submissions ORDER BY created'):
                    print(json.dumps(dict(zip(['reference','status','attempts','message_id','diagnostic'],row))))
        else:
            result = send_once(store, args.send_once, os.environ)
            with store.connect() as db:
                row = db.execute('SELECT status,provider_id,error FROM submissions WHERE id=?',(args.send_once,)).fetchone()
            print(json.dumps({'recipient':GEORGE,'provider_result':result,'status':row[0], 'message_id':row[1], 'diagnostic':row[2]}))
    except m.Invalid as exc:
        print(str(exc))
        sys.exit(1)
    finally:
        os.environ['MEMBERSHIP_EMAIL_ENABLED'] = 'false'
