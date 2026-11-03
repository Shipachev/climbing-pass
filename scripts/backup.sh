#!/usr/bin/env bash
# Use the existing VPS backup mechanism, schedule and credentials.
set -euo pipefail
if [[ "$(id -u)" != 0 ]]; then
  printf '%s\n' 'Run as root on the VPS.' >&2
  exit 77
fi
mode="${1:-databases}"
case "$mode" in
  databases) exec /usr/local/sbin/site-backup databases --site climb-pass.app.shipachev.com ;;
  files)
    /usr/local/sbin/climbpass-backup-snapshot
    exec /usr/local/sbin/site-backup files --site climb-pass.app.shipachev.com ;;
  *) printf '%s\n' 'Usage: backup.sh [databases|files]' >&2; exit 64 ;;
esac
