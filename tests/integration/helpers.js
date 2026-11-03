import { randomUUID, randomBytes } from 'node:crypto';
import { pool } from '../../server/db.js';
import { digest } from '../../server/service.js';
import { emptyState } from '../../js/data/graph.js';
export function assertTestDatabase() {
  const name = new URL(process.env.DATABASE_URL || 'mysql://x/none').pathname.slice(1);
  if (!name.endsWith('_test')) throw Error('Tests require a dedicated *_test database');
}
export async function account(state = emptyState()) {
  assertTestDatabase();
  const id = randomUUID(),
    email = `${id}@climbpass.test`,
    token = randomBytes(32).toString('base64url'),
    csrf = randomBytes(32).toString('hex');
  await pool.execute('INSERT INTO allowed_users(email,enabled) VALUES (?,TRUE)', [email]);
  await pool.execute('INSERT INTO users(id,email,state,revisions) VALUES (?,?,?,?)', [
    id,
    email,
    JSON.stringify(state),
    '{}',
  ]);
  await pool.execute(
    'INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 DAY))',
    [digest(token), id, csrf],
  );
  return { id, email, token, csrf };
}
export async function cleanup(user) {
  for (const table of ['imports', 'changes', 'operations', 'sessions', 'oauth_identities'])
    await pool.execute(`DELETE FROM ${table} WHERE user_id=?`, [user.id]);
  await pool.execute('DELETE FROM users WHERE id=?', [user.id]);
  await pool.execute('DELETE FROM allowed_users WHERE email=?', [user.email]);
}
