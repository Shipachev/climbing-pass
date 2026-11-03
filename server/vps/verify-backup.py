#!/usr/bin/python3
"""Restore one ClimbPass backup in an isolated context; never start the app.
Run as root. Uses the existing site-backup S3 client/config without exposing it.
"""
import argparse
import gzip
import hashlib
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import subprocess
import tarfile

SITE = 'climb-pass.app.shipachev.com'
ROOT = Path('/srv/climbpass')


def backup_module():
    loader = importlib.machinery.SourceFileLoader('existing_site_backup', '/usr/local/sbin/site-backup')
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


def download_checked(client, bucket, key, destination, size=None, checksum=None):
    response = client.get_object(Bucket=bucket, Key=key)
    expected_hash = checksum or response.get('Metadata', {}).get('sha256')
    if not expected_hash or not re.fullmatch('[a-f0-9]{64}', expected_hash):
        raise ValueError('Backup has no SHA-256 integrity metadata')
    digest = hashlib.sha256()
    total = 0
    try:
        with destination.open('xb') as output:
            while block := response['Body'].read(1024 * 1024):
                output.write(block)
                digest.update(block)
                total += len(block)
    finally:
        response['Body'].close()
    if digest.hexdigest() != expected_hash or size is not None and total != size:
        raise ValueError('Backup size/SHA-256 mismatch')
    return destination


def fetch_set(client, bucket, mode, stamp, private):
    if mode not in ['files', 'databases'] or not re.fullmatch(r'\d{8}T\d{12}Z', stamp):
        raise ValueError('Invalid backup set')
    prefix = f'{SITE}/{mode}/{stamp}/'
    marker = private / (mode + '-manifest.json')
    download_checked(client, bucket, prefix + 'manifest.json', marker)
    manifest = json.loads(marker.read_text())
    if manifest.get('format') != 'site-backup-v1' or manifest.get('site') != SITE or manifest.get('mode') != mode or manifest.get('timestamp') != stamp:
        raise ValueError('Manifest identity does not match requested backup')
    name = 'climbpass.sql.gz' if mode == 'databases' else 'files-and-settings.tar.gz'
    objects = manifest.get('objects', [])
    if len(objects) != 1 or objects[0].get('key') != prefix + name:
        raise ValueError('Unexpected backup object list')
    obj = objects[0]
    return download_checked(client, bucket, obj['key'], private / name, obj['size'], obj['sha256'])


def restore_code(archive_path, code, commit):
    base = f'srv/climbpass/backup-snapshot/releases/{commit}'
    with tarfile.open(archive_path, 'r:gz') as archive:
        members = {}
        for member in archive.getmembers():
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or member.name.rstrip('/') in members:
                raise ValueError('Unsafe or duplicate archive path')
            members[member.name.rstrip('/')] = member
        link = members.get('srv/climbpass/backup-snapshot/current')
        if not link or not link.issym() or link.linkname != 'releases/' + commit:
            raise ValueError('Current symlink does not select expected active release')
        release_roots = {name.split('/')[4] for name in members if name.startswith('srv/climbpass/backup-snapshot/releases/')}
        if release_roots != {commit}:
            raise ValueError('Archive includes unexpected release history')
        required = ['etc/climbpass/climbpass.env', 'etc/climbpass/deploy.json',
                    'etc/systemd/system/climbpass.service',
                    'etc/site-backup/sites/' + SITE + '.json',
                    'srv/climbpass/build-home/.ssh/id_ed25519',
                    base + '/package-lock.json', base + '/dist/release.json',
                    base + '/server/migrations/001_initial.sql']
        if any(name not in members for name in required):
            raise ValueError('Archive lacks required code/settings/key paths')
        for name, member in members.items():
            if not name.startswith(base + '/'):
                continue
            relative = name[len(base) + 1:]
            if not (member.isfile() or member.isdir() or member.issym()):
                raise ValueError('Unsupported code archive entry')
            if member.issym():
                target = PurePosixPath(member.linkname)
                resolved = Path(os.path.normpath(str(PurePosixPath(relative).parent / target)))
                if target.is_absolute() or '..' in resolved.parts:
                    raise ValueError('Code symlink escapes isolated release')
            mode = 0o755 if member.isdir() or member.mode & 0o111 else 0o644
            copy = member.replace(name=relative, mode=mode, uid=None, gid=None, uname=None, gname=None)
            archive.extract(copy, code, filter='data')
    # Only non-secret release code is extracted. Env and private keys remain
    # inside the root-only downloaded archive, outside the build user's access.
    for parent, directories, files in os.walk(code, followlinks=False):
        Path(parent).chmod(0o755)
        for name in files:
            path = Path(parent) / name
            if not path.is_symlink():
                path.chmod(0o755 if path.stat().st_mode & 0o111 else 0o644)


def validate_sql(sql):
    # This application currently has no routines/events/triggers. Refuse an
    # unexpected expanded SQL surface instead of granting global privileges.
    if re.search(r'(?im)^\s*(?:USE\s|(?:CREATE|DROP)\s+DATABASE\b)', sql):
        raise ValueError('Dump may change the selected schema')
    if re.search(r'`climbpass`\s*\.', sql, re.I) or re.search(r'\bDEFINER\s*=', sql, re.I):
        raise ValueError('Dump contains production-qualified objects or a definer')


def root_sql(sql):
    result = subprocess.run(['/usr/bin/mysql', '--protocol=socket', '--user=root', '--batch', '--skip-column-names'],
                            input=sql, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError('Isolated MySQL administration failed; stderr withheld to protect credentials')
    return result.stdout.strip()


def verify_import_history(source, state):
    path = Path(__file__).with_name('verify-history-state.py')
    loader = importlib.machinery.SourceFileLoader('history_field_verifier', str(path))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    # There is no pre-import graph in a backup. Verify the legacy fields here;
    # program immutability was checked against the real before-state at import.
    return module.compare(source, {}, state)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database-set', required=True)
    parser.add_argument('--files-set', required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--owner-email', help='Required when the backup includes imported history')
    args = parser.parse_args()
    if os.geteuid() != 0 or not os.path.ismount('/srv'):
        parser.error('Run as root with /srv mounted')
    if not re.fullmatch('[a-f0-9]{40}', args.commit):
        parser.error('Full expected release SHA required')
    if args.owner_email and not re.fullmatch(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}', args.owner_email):
        parser.error('Invalid owner email')
    os.umask(0o077)
    token = secrets.token_hex(6)
    private = ROOT / ('restore-artifacts-' + token)
    code = ROOT / ('restore-code-' + token)
    private.mkdir(mode=0o700)
    code.mkdir(mode=0o755)
    code.chmod(0o755)
    module = backup_module()
    config = module.read_config(Path('/etc/site-backup/s3.json'))
    client = module.client(config)
    database = fetch_set(client, config['bucket'], 'databases', args.database_set, private)
    archive = fetch_set(client, config['bucket'], 'files', args.files_set, private)
    restore_code(archive, code, args.commit)
    version = json.loads((code / 'dist/release.json').read_text())['version']
    if not version.startswith('3.0.0-' + args.commit[:7] + '-'):
        raise ValueError('Restored content version mismatch')
    subprocess.run(['/usr/sbin/runuser', '-u', 'climbpass-build', '--', '/usr/bin/env', '-i',
                    'HOME=/srv/climbpass/build-home', 'PATH=/usr/bin:/bin',
                    '/usr/bin/node', '--test', *[str(p) for p in sorted((code / 'tests').glob('*.test.js'))]],
                   cwd=code, check=True)
    sql = gzip.decompress(database.read_bytes()).decode('utf8')
    validate_sql(sql)
    temporary_db, temporary_user = 'climbpass_restore_' + token, 'cp_restore_' + token
    password = secrets.token_hex(32)
    write_info = {'database': temporary_db, 'user': temporary_user, 'code': str(code), 'version': version}
    (private / 'check.json').write_text(json.dumps(write_info) + '\n')
    root_sql(f"CREATE DATABASE `{temporary_db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
    root_sql(f"CREATE USER '{temporary_user}'@'localhost' IDENTIFIED BY '{password}';")
    root_sql(f"GRANT ALL ON `{temporary_db}`.* TO '{temporary_user}'@'localhost';")
    defaults = private / 'restore-client.cnf'
    defaults.write_text('[client]\nuser=' + temporary_user + '\npassword=' + password + '\nhost=127.0.0.1\nprotocol=TCP\n')
    defaults.chmod(0o600)
    def isolated(query):
        result = subprocess.run(['/usr/bin/mysql', '--defaults-file=' + str(defaults), '--no-login-paths',
                                 '--default-character-set=utf8mb4', '--batch', '--raw', '--skip-column-names', temporary_db], input=query, text=True,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode:
            raise RuntimeError('Restore/query failed in isolated schema; private artifacts retain the test context')
        return result.stdout.strip()
    isolated(sql)
    rows = isolated('SELECT name,digest FROM schema_migrations;').splitlines()
    expected = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in (code / 'server/migrations').glob('*.sql')}
    actual = dict(row.split('\t') for row in rows)
    if actual != expected:
        raise ValueError('Restored migration checksums mismatch')
    tables = ['allowed_users', 'users', 'oauth_identities', 'sessions', 'oauth_attempts', 'operations', 'changes', 'imports']
    counts = {name: int(isolated(f'SELECT COUNT(*) FROM `{name}`;')) for name in tables}
    if len(isolated('SHOW TABLES;').splitlines()) != 9:
        raise ValueError('Unexpected restored table set')
    print('Restored table row counts:', json.dumps(counts))
    with tarfile.open(archive,'r:gz') as files:
        try: history=files.getmember('srv/climbpass/import/history.json')
        except KeyError: history=None
        if history is not None:
            if not history.isfile() or not args.owner_email:
                raise ValueError('Imported history requires a regular source file and --owner-email')
            source_bytes=files.extractfile(history).read()
            owner=args.owner_email.lower()
            restored_state=json.loads(isolated(f"SELECT state FROM users WHERE email='{owner}';"))
            pass_count,visit_count=verify_import_history(json.loads(source_bytes),restored_state)
            source_hash=hashlib.sha256(source_bytes).hexdigest()
            receipt=isolated(f"SELECT COUNT(*) FROM imports WHERE user_id=(SELECT id FROM users WHERE email='{owner}') AND source_hash='{source_hash}';")
            if receipt!='1':
                raise ValueError('Restored import receipt does not match owner and history source')
            write_info['history']={'passes':pass_count,'visits':visit_count,'source_sha256':source_hash,'receipt_verified':True}
            print(f'Restored imported history verified: {pass_count} passes, {visit_count} visits; owner and source receipt match.')
    root_sql(f"DROP USER '{temporary_user}'@'localhost';")
    root_sql(f'DROP DATABASE `{temporary_db}`;')
    defaults.unlink()
    write_info.update({'result': 'verified', 'counts': counts, 'temporary_database_removed': True})
    (private / 'check.json').write_text(json.dumps(write_info, indent=2) + '\n')
    print('Backup restore verified:', version)
    print('Isolated temporary database/user removed; production database unchanged.')
    print('Protected backup artifacts:', private)
    print('Isolated restored code:', code)
    print('No application, OAuth flow or background services started.')


if __name__ == '__main__':
    main()
