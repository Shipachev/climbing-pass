#!/usr/bin/env bash
# Administrative preparation only. Does not change legacy ClimbPass, NGINX,
# databases, keys or services. Run as root after the documented read-only audit.
set -euo pipefail
[[ "$(id -u)" == 0 ]] || exit 77
mountpoint -q /srv
for name in climbpass climbpass-build climbpass-deploy; do
  if getent passwd "$name" >/dev/null; then
    printf '%s\n' "User $name already exists; inspect it before repeating preparation." >&2
    exit 1
  fi
done
for path in /srv/climbpass /srv/repos/climbpass /etc/climbpass; do
  [[ ! -e "$path" && ! -L "$path" ]] || { printf '%s\n' "Path $path already exists; inspect before repeating." >&2; exit 1; }
done
useradd --system --user-group --home-dir /srv/climbpass --shell /usr/sbin/nologin climbpass
useradd --system --user-group --home-dir /srv/climbpass/build-home --shell /bin/sh climbpass-build
useradd --system --user-group --home-dir /srv/climbpass/deploy-home --shell /bin/sh climbpass-deploy
install -d -o root -g root -m 0755 /srv/climbpass /srv/climbpass/releases
install -d -o root -g root -m 0700 /etc/climbpass
install -d -o climbpass-build -g climbpass-build -m 0700 /srv/climbpass/build-home /srv/climbpass/build-home/.ssh
install -d -o climbpass-build -g climbpass-build -m 0750 /srv/repos/climbpass
install -d -o root -g root -m 0700 /srv/climbpass/deploy-home /srv/climbpass/deploy-home/.ssh
getent passwd climbpass climbpass-build climbpass-deploy
namei -l /srv/repos/climbpass
printf '%s\n' 'Project users and directories prepared. No runtime or deploy service started.'
