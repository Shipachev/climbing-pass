#!/usr/bin/python3
"""Initial ClimbPass database/env provisioning. Run interactively as root.
Does not alter global MySQL configuration, existing users or other schemas.
"""
import getpass
import os
from pathlib import Path
import re
import secrets
import subprocess

ENV = Path('/etc/climbpass/climbpass.env')
SCHEMA = 'climbpass'
DB_USER = 'climbpass'


def mysql(sql):
    result = subprocess.run(['/usr/bin/mysql', '--batch', '--skip-column-names'],
                            input=sql, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        # Never print a SQL statement or stderr that may include credentials.
        raise RuntimeError('MySQL command failed; inspect the setup state without printing secrets')
    return result.stdout.strip()


def check_credentials(client_id, client_secret):
    if not re.fullmatch(r'[A-Za-z0-9._-]+\.apps\.googleusercontent\.com', client_id):
        raise ValueError('Expected Google OAuth Web client ID ending in .apps.googleusercontent.com')
    if not re.fullmatch(r'[A-Za-z0-9._~-]+', client_secret):
        raise ValueError('Invalid Google client secret format; whitespace/control characters are not accepted')


def main():
    if os.geteuid() != 0 or not os.path.ismount('/srv'):
        raise SystemExit('Run as root on the VPS with /srv mounted')
    os.umask(0o077)
    if ENV.exists() or ENV.is_symlink():
        raise SystemExit('Project env already exists; refusing to overwrite credentials')
    directory = ENV.parent
    st = directory.stat()
    if directory.is_symlink() or st.st_uid != 0 or st.st_mode & 0o077:
        raise SystemExit('/etc/climbpass must be root-owned, mode 700')
    if mysql("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='climbpass';") != '0':
        raise SystemExit('Schema climbpass already exists; refusing to modify it')
    if mysql("SELECT COUNT(*) FROM mysql.user WHERE User='climbpass';") != '0':
        raise SystemExit('MySQL account climbpass already exists; inspect it before continuing')
    client_id = input('Google Client ID: ').strip()
    client_secret = getpass.getpass('Google Client secret (hidden): ').strip()
    check_credentials(client_id, client_secret)
    password = secrets.token_hex(32)
    content = (
        'APP_ORIGIN=https://climb-pass.app.shipachev.com\n'
        'PORT=9083\nNODE_ENV=production\nTZ=Asia/Novokuznetsk\n'
        f'DATABASE_URL=mysql://{DB_USER}:{password}@127.0.0.1:3306/{SCHEMA}\n'
        f'GOOGLE_CLIENT_ID={client_id}\nGOOGLE_CLIENT_SECRET={client_secret}\n'
    )
    # Preserve generated credentials even if MySQL provisioning is interrupted.
    # A retry deliberately refuses to overwrite this file or partially made DB.
    with ENV.open('x') as file:
        file.write(content)
        file.flush()
        os.fsync(file.fileno())
    ENV.chmod(0o600)
    try:
        mysql(
            "CREATE DATABASE `climbpass` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n"
            f"CREATE USER 'climbpass'@'localhost' IDENTIFIED BY '{password}';\n"
            "GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,INDEX,REFERENCES "
            "ON `climbpass`.* TO 'climbpass'@'localhost';\n"
        )
        # Check the exact TCP connection used by mysql2. Password never enters argv.
        with __import__('tempfile').TemporaryDirectory(prefix='climbpass-db-check-') as tmp:
            defaults = Path(tmp) / 'client.cnf'
            defaults.write_text('[client]\nuser=climbpass\npassword=' + password + '\nhost=127.0.0.1\nprotocol=TCP\n')
            defaults.chmod(0o600)
            result = subprocess.run(['/usr/bin/mysql', '--defaults-file=' + str(defaults), '--no-login-paths',
                                     '--batch', '--skip-column-names', 'climbpass', '-e', "SELECT CONCAT(CURRENT_USER(), ':', DATABASE())"],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            if result.returncode or result.stdout.strip() != 'climbpass@localhost:climbpass':
                raise RuntimeError('Project MySQL TCP connection check failed')
    except BaseException:
        print('Setup incomplete. Generated credentials remain in the root-only env; do not rerun or delete partial state blindly.')
        raise SystemExit(1)
    print('Database climbpass created. Dedicated account has privileges only on climbpass.*.')
    print('Project TCP database connection verified. Env saved root:root 0600; secrets not displayed.')
    print('No migrations, history import, NGINX changes or service start performed.')


if __name__ == '__main__':
    main()
