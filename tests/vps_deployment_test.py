"""Checks deployment boundaries without SSH, root operations or VPS changes."""
import importlib.machinery
import importlib.util
from pathlib import Path
import tempfile
import unittest

BASE = Path(__file__).resolve().parents[1] / 'server' / 'vps'


def load(name):
    loader = importlib.machinery.SourceFileLoader(name.replace('-', '_'), str(BASE / name))
    spec = importlib.util.spec_from_loader(loader.name, loader)
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module


class DeploymentTests(unittest.TestCase):
    def test_forced_ssh_rejects_other_commands_and_shell_suffixes(self):
        wrapper = load('climbpass-deploy-ssh')
        sha = 'a' * 40
        self.assertEqual(wrapper.requested_commit('deploy ' + sha), sha)
        for command in ['', 'whoami', 'deploy main', 'deploy ' + sha + ';id',
                        'deploy ' + sha + '\nwhoami', 'deploy ' + sha + ' extra']:
            with self.assertRaises(ValueError):
                wrapper.requested_commit(command)

    def test_trigger_has_fixed_entrypoint_and_no_shell(self):
        trigger = load('climbpass-deploy-trigger')
        command = trigger.deploy_command(['b' * 40])
        self.assertEqual(command[-3:], ['/usr/local/sbin/climbpass-deploy', '--require-tip', 'b' * 40])
        self.assertIn('--property=AssertPathIsMountPoint=/srv', command)
        for args in [[], ['main'], ['b' * 40, '--rollback']]:
            with self.assertRaises(ValueError):
                trigger.deploy_command(args)

    def test_files_snapshot_includes_active_target_not_release_history(self):
        snapshot = load('climbpass-backup-snapshot')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            snapshot.ROOT = root
            active = root / 'releases' / 'active'
            active.mkdir(parents=True)
            (active / 'index.html').write_text('active code')
            previous = root / 'releases' / 'previous'
            previous.mkdir()
            (previous / 'old.html').write_text('rollback code')
            (root / 'current').symlink_to(active)
            snapshot.snapshot_locked()
            output = root / 'backup-snapshot'
            self.assertEqual((output / 'current' / 'index.html').read_text(), 'active code')
            self.assertFalse((output / 'releases' / 'previous').exists())
            self.assertFalse((output / 'current').readlink().is_absolute())
            (active / 'external-secret').symlink_to(root / 'outside.env')
            (root / 'outside.env').write_text('must not silently follow outside code')
            with self.assertRaises(ValueError):
                snapshot.snapshot_locked()
            self.assertEqual((output / 'current' / 'index.html').read_text(), 'active code')


class PublisherTests(unittest.TestCase):
    def test_archive_rejects_symlinks_and_path_traversal(self):
        import io
        import tarfile
        publisher = load('climbpass-deploy')
        for name, kind in [('../escape', tarfile.REGTYPE),
                           ('/absolute', tarfile.REGTYPE),
                           ('outside', tarfile.SYMTYPE)]:
            with tempfile.TemporaryDirectory() as directory:
                stream = io.BytesIO()
                with tarfile.open(fileobj=stream, mode='w') as archive:
                    member = tarfile.TarInfo(name)
                    member.type = kind
                    member.linkname = '/etc/passwd' if kind == tarfile.SYMTYPE else ''
                    archive.addfile(member)
                stream.seek(0)
                with tarfile.open(fileobj=stream) as archive:
                    with self.assertRaises(ValueError):
                        publisher.extract_code(archive, Path(directory))

    def test_archive_restores_regular_code_and_release_metadata(self):
        import io
        import json
        import tarfile
        publisher = load('climbpass-deploy')
        with tempfile.TemporaryDirectory() as directory:
            release = Path(directory)
            stream = io.BytesIO()
            with tarfile.open(fileobj=stream, mode='w') as archive:
                content = b'export const test = true;'
                member = tarfile.TarInfo('js/app.js')
                member.size = len(content)
                archive.addfile(member, io.BytesIO(content))
            stream.seek(0)
            with tarfile.open(fileobj=stream) as archive:
                publisher.extract_code(archive, release)
            self.assertEqual((release / 'js/app.js').read_bytes(), content)
            publisher.write_json(release / 'successful-releases.json', [])
            self.assertEqual(json.loads((release / 'successful-releases.json').read_text()), [])
            self.assertFalse((release / 'successful-releases.json.new').exists())

class DatabasePreparationTests(unittest.TestCase):
    def test_credentials_fit_both_node_and_systemd_env_without_interpolation(self):
        module = load('prepare-database.py')
        module.check_credentials('123-example.apps.googleusercontent.com', 'GOCSPX-example_secret-123')
        for client, secret in [('wrong-client', 'secret'),
                               ('123-example.apps.googleusercontent.com', 'bad\nINJECTED=yes'),
                               ('123-example.apps.googleusercontent.com', 'bad$secret'),
                               ('123-example.apps.googleusercontent.com', '')]:
            with self.assertRaises(ValueError):
                module.check_credentials(client, secret)


class ReleasePermissionsTests(unittest.TestCase):
    def test_closed_build_umask_becomes_readable_but_not_writable_for_runtime(self):
        from unittest import mock
        publisher = load('climbpass-deploy')
        with tempfile.TemporaryDirectory() as directory:
            release = Path(directory).resolve()
            dependency = release / 'node_modules' / 'dependency'
            dependency.mkdir(parents=True)
            dependency.chmod(0o700)
            module = dependency / 'index.js'
            module.write_text('export default true;')
            module.chmod(0o600)
            with mock.patch.object(publisher.os, 'chown'):
                publisher.ownership(release, 'root')
            self.assertEqual(dependency.stat().st_mode & 0o777, 0o755)
            self.assertEqual(module.stat().st_mode & 0o777, 0o644)
            self.assertEqual(module.stat().st_mode & 0o022, 0)


class BackupRestoreTests(unittest.TestCase):
    def test_restore_sql_cannot_select_live_database(self):
        module=load('verify-backup.py')
        module.validate_sql('CREATE TABLE users (id INT); INSERT INTO users VALUES (1);')
        for sql in ['USE climbpass;', 'CREATE DATABASE climbpass;',
                    'DROP DATABASE climbpass;', 'INSERT INTO `climbpass`.`users` VALUES (1);',
                    'CREATE DEFINER=`root`@`localhost` EVENT example DO SELECT 1;']:
            with self.assertRaises(ValueError):
                module.validate_sql(sql)

    def test_restore_extracts_only_active_code_and_keeps_secrets_in_archive(self):
        import io
        import tarfile
        module=load('verify-backup.py')
        commit='c'*40
        base='srv/climbpass/backup-snapshot/releases/'+commit
        names=['etc/climbpass/climbpass.env', 'etc/climbpass/deploy.json',
               'etc/systemd/system/climbpass.service',
               'etc/site-backup/sites/climb-pass.app.shipachev.com.json',
               'srv/climbpass/build-home/.ssh/id_ed25519',base+'/package-lock.json',
               base+'/dist/release.json',base+'/server/migrations/001_initial.sql']
        with tempfile.TemporaryDirectory() as directory:
            directory=Path(directory);archive_path=directory/'backup.tar.gz';code=directory/'code';code.mkdir()
            with tarfile.open(archive_path,'w:gz') as archive:
                for name in names:
                    value=b'fixture';entry=tarfile.TarInfo(name);entry.size=len(value);archive.addfile(entry,io.BytesIO(value))
                link=tarfile.TarInfo('srv/climbpass/backup-snapshot/current');link.type=tarfile.SYMTYPE;link.linkname='releases/'+commit;archive.addfile(link)
            module.restore_code(archive_path,code,commit)
            self.assertTrue((code/'package-lock.json').is_file())
            self.assertFalse((code/'etc').exists())
            self.assertFalse(any(path.name=='id_ed25519' for path in code.rglob('*')))


class NginxActivationTests(unittest.TestCase):
    def test_ipv6_configuration_is_idempotent_and_preserves_host_and_tls(self):
        module=load('activate-nginx.py')
        original=(BASE/'climbpass.nginx.conf').read_text()
        legacy=original.replace('    listen [::]:80;\n','').replace('    listen [::]:443 ssl;\n','')
        updated=module.prepare_config(legacy)
        self.assertEqual(module.prepare_config(updated),updated)
        self.assertEqual(updated.count('listen [::]:80;'),1)
        self.assertEqual(updated.count('listen [::]:443 ssl;'),1)
        self.assertIn('/etc/letsencrypt/live/app.shipachev.com/fullchain.pem',updated)
        self.assertIn('proxy_pass http://127.0.0.1:9083;',updated)
        with self.assertRaises(ValueError):module.prepare_config('server { listen 80; }')


class NginxReadinessTests(unittest.TestCase):
    def test_old_html_after_reload_is_retried_until_json_is_ready(self):
        from unittest import mock
        module=load('activate-nginx.py')
        expected='3.0.0-dc7b712-a4f53fbc2415'
        states=iter([('<html>old static shell</html>','text/html'),
                     ('{"ok":true,"version":"'+expected+'"}','application/json')])
        def probe():
            body,content_type=next(states)
            module.parse_health(body,expected,'test',200,content_type)
        with mock.patch.object(module.time,'sleep') as sleep:
            module.wait_ready(probe,attempts=2)
            sleep.assert_called_once()

    def test_persistent_wrong_route_fails_with_http_diagnostic(self):
        from unittest import mock
        module=load('activate-nginx.py')
        with mock.patch.object(module.time,'sleep'):
            with self.assertRaisesRegex(ValueError,'HTTP 301'):
                module.wait_ready(lambda: module.parse_health('', 'version','test',301,'text/html'),attempts=2)


class HistoryImportVerificationTests(unittest.TestCase):
    def test_every_field_and_same_day_duplicates_are_checked(self):
        import copy
        module=load('verify-history-state.py')
        source=[{'id':7,'start':'2026-01-01','end':'2026-02-01','total':3,'status':'archived','visits':['2026-01-04','2026-01-04']}]
        before={'schemaVersion':2,'programs':[{'id':'program-1'}],'versions':[{'id':'version-1'}],'drafts':[]}
        after={**copy.deepcopy(before),'passes':[{'id':'legacy-7','start':'2026-01-01','end':'2026-02-01','total':3,'status':'archived'}],
               'visits':[{'id':'legacy-7-visit-0','passId':'legacy-7','date':'2026-01-04'},{'id':'legacy-7-visit-1','passId':'legacy-7','date':'2026-01-04'}]}
        self.assertEqual(module.compare(source,before,after),(1,2))
        changed=copy.deepcopy(after);changed['visits'].reverse()
        with self.assertRaises(ValueError):module.compare(source,before,changed)
        changed=copy.deepcopy(after);changed['passes'][0]['total']=4
        with self.assertRaises(ValueError):module.compare(source,before,changed)
        changed=copy.deepcopy(after);changed['versions'][0]['id']='changed'
        with self.assertRaises(ValueError):module.compare(source,before,changed)


class ActiveReleaseRetryTests(unittest.TestCase):
    def test_successful_current_sha_is_checked_without_restart_build_or_new_backup(self):
        import contextlib
        import io
        import json
        from types import SimpleNamespace
        from unittest import mock
        publisher=load('climbpass-deploy')
        sha='d'*40
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory).resolve();release=root/'releases'/sha;release.mkdir(parents=True)
            (root/'current').symlink_to(release)
            ledger=root/'successful-releases.json';ledger.write_text(json.dumps([{'commit':sha,'path':str(release),'archive_sha256':'e'*64,'result':'ready'}]))
            original=ledger.read_bytes()
            config={'repository':'git@github.com:Shipachev/climbing-pass.git','checkout':'/srv/repos/climbpass','branch':'master','build_user':'climbpass-build','port':9083}
            def run(*args,**kwargs):
                self.assertIn('/usr/bin/git',args)
                if 'get-url' in args:return SimpleNamespace(stdout=config['repository']+'\n')
                return SimpleNamespace(stdout=sha+'\n')
            with mock.patch.object(publisher,'ROOT',root),mock.patch.object(publisher,'read_deploy_config',return_value=config),mock.patch.object(publisher.os,'geteuid',return_value=0),mock.patch.object(publisher.os.path,'ismount',return_value=True),mock.patch.object(publisher,'run',side_effect=run),mock.patch.object(publisher,'ready',return_value='version') as ready,mock.patch('sys.argv',['climbpass-deploy',sha]),contextlib.redirect_stdout(io.StringIO()) as output:
                publisher.main()
            ready.assert_called_once_with(release,9083)
            self.assertEqual(ledger.read_bytes(),original)
            self.assertIn('Already active and ready Git commit: '+sha,output.getvalue())


if __name__ == '__main__':
    unittest.main()
