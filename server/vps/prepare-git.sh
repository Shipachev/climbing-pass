#!/usr/bin/env bash
# Trust the published GitHub Ed25519 key; test only the ClimbPass read-only key.
# Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints
set -euo pipefail
[[ "$(id -u)" == 0 ]] || exit 77
build_home=/srv/climbpass/build-home
ssh_directory="$build_home/.ssh"
key="$ssh_directory/id_ed25519"
test -f "$key"
test ! -L "$key"
test -d "$ssh_directory"
test ! -L "$ssh_directory"
for path in "$ssh_directory/config" "$ssh_directory/known_hosts"; do
  test ! -L "$path"
done
expected=$(mktemp)
trap 'rm -f "$expected"' EXIT
cat > "$expected" <<'CONFIG'
Host github.com
    HostName github.com
    User git
    IdentityFile /srv/climbpass/build-home/.ssh/id_ed25519
    IdentitiesOnly yes
    BatchMode yes
    StrictHostKeyChecking yes
    HostKeyAlgorithms ssh-ed25519
    UserKnownHostsFile /srv/climbpass/build-home/.ssh/known_hosts
    ConnectTimeout 15
CONFIG
if [[ -e "$ssh_directory/config" ]] && ! cmp -s "$expected" "$ssh_directory/config"; then
  printf '%s\n' 'SSH config already exists and differs; inspect before changing it.' >&2
  exit 1
fi
install -o climbpass-build -g climbpass-build -m 0600 "$expected" "$ssh_directory/config"
known='github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl'
touch "$ssh_directory/known_hosts"
if ! grep -qxF "$known" "$ssh_directory/known_hosts"; then
  printf '%s\n' "$known" >> "$ssh_directory/known_hosts"
fi
chown climbpass-build:climbpass-build "$ssh_directory/known_hosts"
chmod 0600 "$ssh_directory/known_hosts"
runuser -u climbpass-build -- env -i HOME="$build_home" PATH=/usr/bin:/bin \
  git ls-remote git@github.com:Shipachev/climbing-pass.git refs/heads/master
printf '%s\n' 'Read-only repository access verified. No clone, build or deployment performed.'
