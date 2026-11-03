import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const revision =
  process.env.CLIMBPASS_GIT_SHA ||
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(revision)) throw Error('Expected a full Git SHA for the release');
const version = revision.slice(0, 7);
await mkdir('dist', { recursive: true });
const entries = [
  'index.html',
  'styles.css',
  'js',
  'assets',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
];
for (const entry of entries) await cp(entry, `dist/${entry}`, { recursive: true });
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) => (e.isDirectory() ? files(`${dir}/${e.name}`) : `${dir}/${e.name}`)),
    )
  ).flat();
}
const shell = (
  await Promise.all(
    entries.map((e) => (['js', 'assets'].includes(e) ? files(`dist/${e}`) : `dist/${e}`)),
  )
)
  .flat()
  .map((p) => p.slice(5));
const hashes = await Promise.all(
  shell.map(async (p) =>
    createHash('sha256')
      .update(await readFile(`dist/${p}`))
      .digest('hex'),
  ),
);
const releaseVersion = `3.0.0-${version}-${createHash('sha256').update(hashes.join('')).digest('hex').slice(0, 12)}`;
const source = await readFile('sw.js', 'utf8');
const sw = source
  .replace("'climbpass-3-development'", JSON.stringify(`climbpass-${releaseVersion}`))
  .replace(
    '/* BUILD_SHELL */ []',
    JSON.stringify(['./', './release.json', ...shell.map((p) => `./${p}`)]),
  );
await writeFile('dist/sw.js', sw);
await writeFile(
  'dist/release.json',
  JSON.stringify({ version: releaseVersion, files: [...shell, 'sw.js', 'release.json'] }, null, 2),
);
console.log(`Built ${releaseVersion} (${shell.length} shell files)`);
