"""Build a reviewed allowlist-only context. Never copy a checkout or environment wholesale."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
HOSTING = ROOT / 'preview-hosting'
DEFAULT_OUTPUT = ROOT / 'output/george-preview'
PUBLIC_PAGES = ('index.html', 'membership.html', 'about.html', 'events.html', 'gallery.html',
                'weather_final.html', 'resources.html', 'location.html', 'learn-to-fly.html',
                'contact.html', 'news.html', 'style.css', 'membership.css')

def prepare(destination=DEFAULT_OUTPUT):
    destination = Path(destination).resolve()
    # No recursive deletes/moves. Refuse any destination with existing files instead.
    if destination.exists() and any(destination.iterdir()):
        raise ValueError('Choose a new empty output directory; existing artifacts are preserved.')
    destination.mkdir(parents=True, exist_ok=True)
    def copy(source, relative):
        source = Path(source)
        if source.is_symlink(): raise ValueError('Symlinks are excluded from preview packages.')
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    for source, target in [('Dockerfile','Dockerfile'),('.dockerignore','.dockerignore'),('requirements.txt','requirements.txt'),
                           ('gunicorn.conf.py','gunicorn.conf.py'),('entrypoint.sh','entrypoint.sh'),('render.yaml','render.yaml'),
                           ('app.py','remote_preview.py'),('mail.py','remote_mail.py'),('smoke.py','smoke.py')]:
        copy(HOSTING/source, target)
    # Exact backend files: no local preview server, tests, credentials, database or CLI local key loader file.
    copy(ROOT/'scripts/membership.py', 'scripts/membership.py')
    backend = destination/'scripts/membership.py'
    code = backend.read_text(encoding='utf-8')
    recipient_line = "TO = 'mvaughan737@gmail.com'  # Initial test: Michael only; no cc/bcc or applicant mail."
    if code.count(recipient_line) != 1:
        raise ValueError('Review the recipient configuration before packaging; expected local test recipient changed.')
    backend.write_text(code.replace(recipient_line, "TO = 'mg.farris@comcast.net'  # Protected George preview only; no cc/bcc or applicant mail."),encoding='utf-8')
    copy(ROOT/'templates/membership-notification.html', 'templates/membership-notification.html')
    copy(ROOT/'data/membership-meetings.json', 'data/membership-meetings.json')
    for pdf in (ROOT/'documents').glob('*.pdf'):
        copy(pdf, Path('documents')/pdf.name)
        copy(pdf, Path('public/documents')/pdf.name)
    for name in PUBLIC_PAGES:
        copy(ROOT/name, Path('public')/name)
    for folder, suffixes in [('js',{'.js'}),('images',{'.png','.jpg','.jpeg','.webp','.gif','.svg'}),('data',{'.json'}),('admin/content',{'.json'})]:
        for source in (ROOT/folder).rglob('*'):
            if source.is_file() and source.suffix.lower() in suffixes and not any(p.startswith('.') for p in source.relative_to(ROOT).parts):
                copy(source, Path('public')/source.relative_to(ROOT))
    # Clearly distinguish the remote test from the local prototype in its UI only.
    member = destination/'public/membership.html'
    html = member.read_text(encoding='utf-8').replace('Local test', 'George preview test')
    html = html.replace('This prototype saves privately on this computer.', 'This protected preview saves fictional applications privately on the test server.')
    member.write_text(html,encoding='utf-8')
    client = destination/'public/js/membership.js'
    js=client.read_text(encoding='utf-8').replace('local test','preview test').replace('Local test','Preview test').replace('local service','preview service')
    js=js.replace('Online prototype unavailable. Start the local preview and use its 127.0.0.1 address.', 'Protected preview unavailable. Contact Michael; your test may need a fresh session.')
    client.write_text(js,encoding='utf-8')
    (destination/'public/robots.txt').write_text('User-agent: *\nDisallow: /\n',encoding='utf-8')
    hashes={str(p.relative_to(destination)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest()
            for p in destination.rglob('*') if p.is_file()}
    (destination/'package-manifest.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
    return destination

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=DEFAULT_OUTPUT)
    args=parser.parse_args()
    print(prepare(args.output))
