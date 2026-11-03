import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pool, json } from '../server/db.js';
import { push, pull } from '../server/service.js';
import { migrate, today, validate } from '../js/store.js';
import { changes, guardsFor } from '../js/data/graph.js';
const [filename, emailArg, flag] = process.argv.slice(2),
  email = (emailArg || '').trim().toLowerCase();
if (!filename || !email || (flag && !['--apply'].includes(flag)))
  throw Error(
    'Usage: node --env-file=.env scripts/import-production-history.js history.json account@email [--apply]',
  );
try {
  const bytes = await readFile(filename),
    sourceHash = createHash('sha256').update(bytes).digest('hex'),
    source = JSON.parse(bytes);
  if (!Array.isArray(source)) throw Error('Expected the legacy history array; no changes made');
  const [[user]] = await pool.execute(
    'SELECT u.id FROM users u JOIN allowed_users a ON a.email=u.email AND a.enabled=TRUE WHERE u.email=?',
    [email],
  );
  if (!user) throw Error('Sign in once with the permitted Google account before importing');
  const [[previous]] = await pool.execute(
    'SELECT import_id FROM imports WHERE user_id=? AND source_hash=? LIMIT 1',
    [user.id, sourceHash],
  );
  if (previous) {
    console.log('This history was already imported; no changes made');
    process.exitCode = 0;
  } else {
    const current = await pull(user.id),
      incoming = migrate(source);
    if (current.state.passes.length || current.state.visits.length)
      throw Error('Account already contains passes or visits; automatic overwrite is forbidden');
    const next = validate({
      ...current.state,
      passes: incoming.passes,
      visits: incoming.visits,
      ...(!current.state.programs.length
        ? { programs: incoming.programs, versions: incoming.versions, drafts: incoming.drafts }
        : {}),
    });
    const patch = changes(current.state, next, current.revisions);
    console.log(
      `Preview: ${incoming.passes.length} passes, ${incoming.visits.length} visits. Original IDs, dates, duplicate visits and order are preserved. Existing programs are preserved.`,
    );
    if (flag === '--apply') {
      const result = await push(user.id, {
        id: `history-${sourceHash.slice(0, 40)}`,
        protocolVersion: 1,
        mode: 'join',
        day: today(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        createdAt: new Date().toISOString(),
        expectedCursor: current.cursor,
        sourceHash,
        changes: patch,
        guards: guardsFor(current.state, patch, current.revisions),
      });
      console.log(
        `Import confirmed at cursor ${result.cursor}; other devices receive it through normal sync`,
      );
    } else
      console.log(
        'Preview only. Back up the database, then repeat with --apply during the production update.',
      );
  }
} finally {
  await pool.end();
}
