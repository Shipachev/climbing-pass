import { randomBytes, randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { pool, transaction } from './db.js';
import { digest } from './service.js';
import { migrate } from '../js/domain/model.js';
const random = () => randomBytes(32).toString('base64url');
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export const cookieValue = (req, name) =>
  req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${name}=`))
    ?.slice(name.length + 1);
export const cookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.APP_ORIGIN?.startsWith('https:') ? '; Secure' : ''}`;
export async function login(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
    throw Object.assign(Error('Вход через Google ещё не настроен'), { status: 503 });
  const state = random(),
    verifier = random(),
    nonce = random();
  await pool.execute('DELETE FROM oauth_attempts WHERE expires_at < UTC_TIMESTAMP(3)');
  await pool.execute(
    'INSERT INTO oauth_attempts(state_hash,verifier,nonce,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 10 MINUTE))',
    [digest(state), verifier, nonce],
  );
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const challenge = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.APP_ORIGIN}/auth/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: Buffer.from(challenge).toString('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  res.writeHead(302, { 'Set-Cookie': cookie('cp_oauth', state, 600), Location: url.href });
  res.end();
}
export async function callback(req, res, url) {
  const state = url.searchParams.get('state');
  if (!state || state !== cookieValue(req, 'cp_oauth'))
    throw Object.assign(Error('Неверное состояние входа. Повторите вход'), { status: 400 });
  const attempt = await transaction(async (db) => {
    const [[row]] = await db.execute(
      'SELECT * FROM oauth_attempts WHERE state_hash=? AND expires_at>UTC_TIMESTAMP(3) FOR UPDATE',
      [digest(state)],
    );
    if (!row) throw Object.assign(Error('Время входа истекло'), { status: 400 });
    await db.execute('DELETE FROM oauth_attempts WHERE state_hash=?', [digest(state)]);
    return row;
  });
  if (url.searchParams.has('error'))
    throw Object.assign(Error('Вход отменён. Повторите вход'), { status: 400 });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: url.searchParams.get('code') || '',
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${process.env.APP_ORIGIN}/auth/callback`,
      grant_type: 'authorization_code',
      code_verifier: attempt.verifier,
    }),
  });
  if (!response.ok)
    throw Object.assign(Error('Не удалось завершить вход через Google'), { status: 401 });
  const tokens = await response.json();
  const { payload } = await jwtVerify(tokens.id_token, jwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: process.env.GOOGLE_CLIENT_ID,
    algorithms: ['RS256'],
    maxTokenAge: '10m',
  });
  if (
    payload.nonce !== attempt.nonce ||
    payload.email_verified !== true ||
    typeof payload.email !== 'string' ||
    typeof payload.sub !== 'string'
  )
    throw Object.assign(Error('Email не подтверждён'), { status: 403 });
  const email = payload.email.trim().toLowerCase(),
    token = random(),
    csrf = randomBytes(32).toString('hex');
  await transaction(async (db) => {
    const [[allowed]] = await db.execute('SELECT enabled FROM allowed_users WHERE email=?', [
      email,
    ]);
    if (!allowed?.enabled)
      throw Object.assign(Error('Доступ к ClimbPass для этого аккаунта не разрешён'), {
        status: 403,
      });
    let [[identity]] = await db.execute(
      'SELECT user_id FROM oauth_identities WHERE provider=? AND subject=?',
      ['google', payload.sub],
    );
    if (!identity) {
      const id = randomUUID();
      await db.execute('INSERT INTO users(id,email,state,revisions) VALUES (?,?,?,?)', [
        id,
        email,
        JSON.stringify(migrate([])),
        '{}',
      ]);
      await db.execute('INSERT INTO oauth_identities(provider,subject,user_id) VALUES (?,?,?)', [
        'google',
        payload.sub,
        id,
      ]);
      identity = { user_id: id };
    } else await db.execute('UPDATE users SET email=? WHERE id=?', [email, identity.user_id]);
    await db.execute(
      'INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES (?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 DAY))',
      [digest(token), identity.user_id, csrf],
    );
  });
  res.writeHead(302, {
    'Set-Cookie': [cookie('cp_session', token, 2592000), cookie('cp_oauth', '', 0)],
    Location: '/#home',
  });
  res.end();
}
export async function session(req) {
  const token = cookieValue(req, 'cp_session');
  if (!token) throw Object.assign(Error('Нужно войти'), { status: 401 });
  const [[row]] = await pool.execute(
    'SELECT u.id,u.email,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id JOIN allowed_users a ON a.email=u.email AND a.enabled=TRUE WHERE s.token_hash=? AND s.expires_at>UTC_TIMESTAMP(3)',
    [digest(token)],
  );
  if (!row)
    throw Object.assign(Error('Войдите повторно или проверьте разрешение доступа'), {
      status: 401,
    });
  return { user: { id: row.id, email: row.email }, csrf: row.csrf };
}
export function csrf(req, auth) {
  if (req.headers.origin !== process.env.APP_ORIGIN || req.headers['x-csrf-token'] !== auth.csrf)
    throw Object.assign(Error('Запрос не подтверждён. Перезагрузите страницу'), { status: 403 });
}
export async function logout(req, res) {
  await pool.execute('DELETE FROM sessions WHERE token_hash=?', [
    digest(cookieValue(req, 'cp_session') || ''),
  ]);
  res.setHeader('Set-Cookie', cookie('cp_session', '', 0));
}
