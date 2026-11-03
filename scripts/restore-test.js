import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
const [defaults, database, backup] = process.argv.slice(2);
if (!defaults || !backup || !/^climbpass_[A-Za-z0-9_]*restore_test$/.test(database || ''))
  throw Error('Usage: restore-test.js defaults.cnf climbpass_restore_test backup.sql.gz');
async function mysql(args, input) {
  const child = spawn('mysql', [`--defaults-extra-file=${defaults}`, ...args], {
    stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'],
  });
  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(Error('Restore mysql failed'))));
  });
  if (input) await pipeline(input, child.stdin);
  await exited;
}
await mysql([
  '-e',
  `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`,
]);
await mysql([database], createReadStream(backup).pipe(createGunzip()));
await mysql([
  database,
  '-e',
  'SELECT name,digest FROM schema_migrations; SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS receipts FROM operations; CHECK TABLE users,operations,changes,imports;',
]);
console.log('Dedicated restore database checked; production databases untouched');
