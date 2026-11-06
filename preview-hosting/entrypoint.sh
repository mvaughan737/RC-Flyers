#!/bin/sh
set -eu
# A mounted persistent disk can replace image ownership. Prepare only our named folder.
mkdir -p /var/data/membership
chown 10001:10001 /var/data/membership
chmod 700 /var/data/membership
exec gunicorn --config gunicorn.conf.py --user preview --group preview 'remote_preview:create_app()'
