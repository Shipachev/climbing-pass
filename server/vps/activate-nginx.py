#!/usr/bin/python3
"""Activate only ClimbPass NGINX routing with checked rollback to legacy routing."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.request

HOST = 'climb-pass.app.shipachev.com'
AVAILABLE = Path('/etc/nginx/sites-available/climbpass.conf')
ENABLED = Path('/etc/nginx/sites-enabled/climbpass.conf')
BACKUP = Path('/etc/site-backup/sites/' + HOST + '.json')


def prepare_config(text):
    if text.count('server_name ' + HOST + ';') != 2 or 'proxy_pass http://127.0.0.1:9083;' not in text:
        raise ValueError('Unexpected project NGINX configuration; inspect before changing it')
    for old, new in [('listen 80;', 'listen [::]:80;'), ('listen 443 ssl;', 'listen [::]:443 ssl;')]:
        if new not in text:
            if old not in text:
                raise ValueError('Expected listen directive missing')
            text = text.replace(old, old + '\n    ' + new)
    return text


def atomic_write(path, content, mode):
    temporary = path.with_name(path.name + '.climbpass-new')
    with temporary.open('xb') as stream:
        stream.write(content)
    temporary.chmod(mode)
    os.replace(temporary, path)


def run(*args):
    return subprocess.run(args, check=True, stdout=subprocess.PIPE, text=True)


def parse_health(body, expected, source, status=200, content_type='application/json'):
    if status != 200 or 'application/json' not in content_type.lower():
        raise ValueError(f'{source}: expected HTTP 200 JSON; received HTTP {status}, Content-Type={content_type or "missing"}, bytes={len(body.encode())}')
    try:
        value=json.loads(body)
    except json.JSONDecodeError:
        raise ValueError(f'{source}: response is not valid JSON, bytes={len(body.encode())}') from None
    if not isinstance(value,dict) or value.get('ok') is not True or value.get('version') != expected:
        raise ValueError('Unexpected health version for ' + source)


def verify_health(url, expected):
    # Probe the real target, even if the administrative shell has proxy env.
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(url,timeout=5) as response:
        parse_health(response.read().decode(), expected, url, response.status, response.headers.get('Content-Type',''))


def verify_local_tls(expected):
    result=run('/usr/bin/curl','--disable','--noproxy','*','--silent','--show-error',
               '--max-time','5','--resolve',HOST+':443:127.0.0.1',
               '--write-out','\n%{http_code}\n%{content_type}', 'https://'+HOST+'/health')
    body,status,content_type=result.stdout.rsplit('\n',2)
    parse_health(body,expected,'local Host/SNI HTTPS',int(status),content_type)


def wait_ready(probe, attempts=30):
    # systemctl reload sends HUP; returning does not mean new workers have
    # already accepted the next connection. Never parse one old HTML response
    # as a fatal deployment error; wait for the exact new health version.
    deadline=time.monotonic()+30
    last=None
    for attempt in range(attempts):
        try:
            probe()
            return
        except (ValueError,OSError,subprocess.CalledProcessError) as error:
            last=error
            if attempt+1==attempts or time.monotonic()>=deadline:
                break
            time.sleep(.5)
    raise ValueError('Readiness did not converge: '+str(last)) from last


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'3\.0\.0-[a-f0-9]{7}-[a-f0-9]{12}', args.version):
        parser.error('Expected exact ClimbPass content version')
    if os.geteuid() != 0 or not os.path.ismount('/srv'):
        parser.error('Run as root with /srv mounted')
    os.umask(0o077)
    with Path('/srv/climbpass/deploy.lock').open('a') as project:
        fcntl.flock(project, fcntl.LOCK_EX)
        with Path('/srv/backups/site-backup/.lock').open('a') as backup:
            fcntl.flock(backup, fcntl.LOCK_EX)
            if ENABLED.exists() or ENABLED.is_symlink():
                parser.error('Project enabled link already exists; no automatic overwrite')
            for path in [AVAILABLE, BACKUP]:
                if path.is_symlink() or path.stat().st_uid != 0:
                    parser.error('Expected root-owned regular project config: ' + str(path))
            verify_health('http://127.0.0.1:9083/health', args.version)
            original, original_backup = AVAILABLE.read_bytes(), BACKUP.read_bytes()
            text = prepare_config(original.decode())
            linked = False
            try:
                atomic_write(AVAILABLE, text.encode(), 0o644)
                ENABLED.symlink_to(AVAILABLE)
                linked = True
                run('/usr/sbin/nginx', '-t')
                run('/usr/bin/systemctl', 'reload', 'nginx')
                wait_ready(lambda: verify_local_tls(args.version))
                wait_ready(lambda: verify_health('https://' + HOST + '/health', args.version))
                cfg = json.loads(original_backup)
                if str(ENABLED) not in cfg['files']:
                    cfg['files'].append(str(ENABLED))
                atomic_write(BACKUP, (json.dumps(cfg, indent=2) + '\n').encode(), 0o600)
            except BaseException:
                if linked:
                    if not ENABLED.is_symlink() or ENABLED.readlink() != AVAILABLE:
                        raise RuntimeError('Enabled link changed unexpectedly; manual recovery required')
                    ENABLED.unlink()
                atomic_write(AVAILABLE, original, 0o644)
                atomic_write(BACKUP, original_backup, 0o600)
                if linked:
                    run('/usr/sbin/nginx', '-t')
                    run('/usr/bin/systemctl', 'reload', 'nginx')
                print('ClimbPass activation failed; previous routing restored.')
                raise
    print('ClimbPass HTTPS routing verified:', args.version)
    print('IPv4/IPv6 listeners configured; existing wildcard certificate retained.')
    print('Enabled project config added to backup coverage. Production success ledger not yet finalized.')


if __name__ == '__main__':
    main()
