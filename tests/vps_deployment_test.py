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


if __name__ == '__main__':
    unittest.main()
