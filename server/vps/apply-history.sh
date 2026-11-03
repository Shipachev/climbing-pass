#!/usr/bin/env bash
# Explicit one-time import. Takes fresh backups, runs as runtime user and verifies
# all imported pass/visit fields. Never overwrites a different user's history.
set -euo pipefail
[[ "$(id -u)" == 0 ]] || exit 77
mountpoint -q /srv
climb_email="${1:?Google account email required}"
[[ "$climb_email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$ ]] || exit 64
climb_email="${climb_email,,}"
climb_source=/srv/climbpass/import/history.json
climb_config=/etc/site-backup/sites/climb-pass.app.shipachev.com.json
climb_verify="$(dirname "$0")/verify-history-state.py"
test -f "$climb_verify"
printf '%s\n' "f547f7b0506798193f296318ca26a78a188156bfc3f6f7d22d5a9c028a6facd5  $climb_source" | sha256sum -c -
umask 077
climb_audit=$(mktemp -d /srv/climbpass/history-import-check.XXXXXX)
printf '%s\n' "Private import verification context: $climb_audit"

python3 - "$climb_config" <<'PY'
import fcntl
import json
import os
from pathlib import Path
import sys
path=Path(sys.argv[1])
if path.is_symlink() or path.stat().st_uid!=0 or path.stat().st_mode & 0o077:
    raise SystemExit('Expected root-owned mode-600 backup config')
with Path('/srv/climbpass/deploy.lock').open('a') as project:
    fcntl.flock(project,fcntl.LOCK_EX)
    with Path('/srv/backups/site-backup/.lock').open('a') as backup:
        fcntl.flock(backup,fcntl.LOCK_EX)
        config=json.loads(path.read_text())
        if '/srv/climbpass/import' not in config['files']:
            config['files'].append('/srv/climbpass/import')
        temporary=path.with_name(path.name+'.history-new')
        with temporary.open('x') as output:
            output.write(json.dumps(config,indent=2)+'\n')
        temporary.chmod(0o600)
        os.replace(temporary,path)
PY

/usr/local/sbin/site-backup databases --site climb-pass.app.shipachev.com
mysql --protocol=socket --user=root --default-character-set=utf8mb4 --batch --raw --skip-column-names \
  -e "SELECT state FROM climbpass.users WHERE email='$climb_email';" > "$climb_audit/before.json"

systemd-run --unit=climbpass-history-import --wait --pipe --collect \
  --property=User=climbpass --property=Group=climbpass \
  --property=EnvironmentFile=/etc/climbpass/climbpass.env \
  --property=WorkingDirectory=/srv/climbpass/current \
  --property=RequiresMountsFor=/srv/climbpass \
  --property=AssertPathIsMountPoint=/srv \
  --property=NoNewPrivileges=true --property=UMask=0077 \
  /usr/bin/node scripts/import-production-history.js "$climb_source" "$climb_email" --apply

mysql --protocol=socket --user=root --default-character-set=utf8mb4 --batch --raw --skip-column-names \
  -e "SELECT state FROM climbpass.users WHERE email='$climb_email';" > "$climb_audit/after.json"
python3 "$climb_verify" "$climb_source" "$climb_audit/before.json" "$climb_audit/after.json"
/usr/local/sbin/climbpass-backup-snapshot
/usr/local/sbin/site-backup databases --site climb-pass.app.shipachev.com
/usr/local/sbin/site-backup files --site climb-pass.app.shipachev.com
printf '%s\n' 'History import and field verification completed; post-import database and file backups verified by site-backup.'
