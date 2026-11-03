#!/usr/bin/env bash
# Administrative convenience entrypoint. The root-owned publisher is installed
# separately after VPS inspection; never execute application-controlled code as
# root from a forced SSH command.
set -euo pipefail
if [[ "$(id -u)" != 0 ]]; then
  printf '%s\n' 'Run the administrative publisher as root on the VPS; CI uses its restricted SSH trigger.' >&2
  exit 77
fi
revision="${1:?Full Git SHA required}"
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || exit 64
exec /usr/local/sbin/climbpass-deploy "$revision"
