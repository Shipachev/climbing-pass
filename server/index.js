import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { login, callback, session, csrf, logout } from './auth.js';
import { push, pull } from './service.js';
import { pool } from './db.js';
const origin = process.env.APP_ORIGIN || 'http://localhost:4173';
process.env.APP_ORIGIN = origin;
const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const release = JSON.parse(await readFile(resolve(root, 'release.json'), 'utf8'));
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
const limits = new Map();
const send = (res, code, value) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
};
async function body(req) {
  let text = '';
  for await (const part of req) {
    text += part;
    if (Buffer.byteLength(text) > 8 * 1024 * 1024)
      throw Object.assign(Error('Копия превышает 8 МБ'), { status: 413 });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(Error('Неверный JSON'), { status: 400 });
  }
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  if (origin.startsWith('https:')) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  const url = new URL(req.url, origin);
  try {
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
      res.setHeader('Cache-Control', 'no-store');
      const ip = req.socket.remoteAddress,
        now = Date.now();
      let limit = limits.get(ip);
      if (!limit || limit.until < now) {
        limit = { until: now + 60000, n: 0 };
        limits.set(ip, limit);
      }
      if (++limit.n > 180)
        throw Object.assign(Error('Слишком много запросов. Повторите через минуту'), {
          status: 429,
        });
      if (req.method === 'GET' && url.pathname === '/auth/google') return await login(req, res);
      if (req.method === 'GET' && url.pathname === '/auth/callback')
        return await callback(req, res, url);
      const auth = await session(req);
      if (req.method !== 'GET') csrf(req, auth);
      if (req.method === 'GET' && url.pathname === '/api/session') return send(res, 200, auth);
      if (req.method === 'GET' && url.pathname === '/api/sync')
        return send(res, 200, await pull(auth.user.id));
      if (req.method === 'POST' && url.pathname === '/api/sync')
        return send(res, 200, await push(auth.user.id, await body(req)));
      if (req.method === 'POST' && url.pathname === '/api/logout') {
        await logout(req, res);
        return send(res, 200, { ok: true });
      }
      return send(res, 404, { error: 'Не найдено' });
    }
    if (url.pathname === '/health') {
      await pool.query('SELECT 1');
      return send(res, 200, { ok: true, version: release.version });
    }
    if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: 'Метод недоступен' });
    const path = resolve(
      root,
      `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`,
    );
    if (!path.startsWith(root + sep) || !release.files.includes(path.slice(root.length + 1)))
      return send(res, 404, { error: 'Не найдено' });
    const bytes = await readFile(path);
    res.writeHead(200, {
      'Content-Type': mime[extname(path)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500)
      console.error(
        JSON.stringify({
          event: 'request_failed',
          path: url.pathname,
          code: err.code || 'INTERNAL',
        }),
      );
    if (url.pathname.startsWith('/auth/')) {
      res.writeHead(302, {
        Location: `/#login/${status === 403 ? 'denied' : status === 503 ? 'setup' : 'retry'}`,
      });
      res.end();
      return;
    }
    send(res, status, {
      error: status >= 500 ? 'Сервис временно недоступен' : err.message,
      code: err.code,
      key: err.key,
      snapshot: err.snapshot,
    });
  }
});
const sweep = setInterval(() => {
  const now = Date.now();
  for (const [key, v] of limits) if (v.until < now) limits.delete(key);
}, 60000);
sweep.unref();
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () =>
  console.log(`ClimbPass ${release.version} listening`),
);
for (const signal of ['SIGTERM', 'SIGINT'])
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      process.exit(0);
    }),
  );
