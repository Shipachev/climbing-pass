import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool } from './db.js';
const connection = await pool.getConnection();
try {
  const [[lock]] = await connection.query("SELECT GET_LOCK('climbpass_migrate',60) AS acquired");
  if (!lock.acquired) throw Error('Migration lock unavailable');
  await connection.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, digest CHAR(64) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)',
  );
  for (const name of (await readdir(new URL('./migrations/', import.meta.url)))
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    const sql = await readFile(new URL(`./migrations/${name}`, import.meta.url), 'utf8'),
      digest = createHash('sha256').update(sql).digest('hex');
    const [[existing]] = await connection.execute(
      'SELECT digest FROM schema_migrations WHERE name=?',
      [name],
    );
    if (existing) {
      if (existing.digest !== digest) throw Error(`Changed migration: ${name}`);
      continue;
    }
    // MySQL DDL commits implicitly. Each version must be restored from backup if
    // interrupted; do not stamp a partially applied migration as successful.
    for (const statement of sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await connection.query(statement);
    await connection.execute('INSERT INTO schema_migrations(name,digest) VALUES (?,?)', [
      name,
      digest,
    ]);
    console.log(`Applied ${name}`);
  }
} finally {
  await connection.query("SELECT RELEASE_LOCK('climbpass_migrate')");
  connection.release();
  await pool.end();
}
