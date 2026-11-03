import { pool } from '../server/db.js';
const email = (process.argv[2] || '').trim().toLowerCase(),
  enabled = process.argv[3] !== 'disable';
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  console.error('Usage: node --env-file=.env scripts/allow-user.js email [enable|disable]');
  process.exit(1);
}
try {
  await pool.execute(
    'INSERT INTO allowed_users(email,enabled) VALUES (?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled)',
    [email, enabled],
  );
  console.log(enabled ? 'Access enabled' : 'Access disabled');
} finally {
  await pool.end();
}
