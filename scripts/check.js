import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
async function files(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory() ? files(`${dir}/${e.name}`) : `${dir}/${e.name}`,
      ),
    )
  ).flat();
}
for (const file of (await Promise.all(['js', 'server', 'scripts'].map(files)))
  .flat()
  .filter((f) => f.endsWith('.js')))
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
console.log('JavaScript syntax checked');
