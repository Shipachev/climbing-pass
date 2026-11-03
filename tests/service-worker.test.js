import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
test('PWA устанавливает полный выпуск; офлайн читает согласованный кеш, обновление удаляет только кеши', async () => {
  const source = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8'),
    handlers = {},
    stored = new Map(),
    deleted = [];
  let shell,
    claimed = false;
  const cache = {
    addAll: async (requests) => {
      shell = requests;
      for (const r of requests) stored.set(r.url, { cached: r.url });
    },
    match: async (r) =>
      stored.get(
        typeof r === 'string' ? r : './' + new URL(r.url).pathname.slice(1) + new URL(r.url).search,
      ),
  };
  const context = {
    self: {
      location: { origin: 'http://localhost' },
      addEventListener: (name, fn) => (handlers[name] = fn),
      clients: {
        claim: async () => {
          claimed = true;
        },
      },
    },
    caches: {
      open: async () => cache,
      keys: async () => ['unrelated-cache', 'climbpass-26.13'],
      delete: async (key) => deleted.push(key),
    },
    Request: class {
      constructor(url) {
        this.url = url;
      }
    },
    URL,
    fetch: async () => {
      throw Error('offline');
    },
  };
  vm.runInNewContext(source, context);
  let pending;
  handlers.install({ waitUntil: (p) => (pending = p) });
  await pending;
  for (const r of shell) {
    const path = r.url === './' ? './index.html' : r.url.split('?')[0];
    await readFile(new URL('../dist/' + path, import.meta.url));
  }
  assert.ok(stored.has('./js/workouts.js'));
  assert.ok(stored.has('./styles.css'));
  handlers.activate({ waitUntil: (p) => (pending = p) });
  await pending;
  assert.deepEqual(deleted, ['climbpass-26.13']);
  assert.equal(claimed, true);
  const request = { url: 'http://localhost/some-visit', method: 'GET', mode: 'navigate' };
  handlers.fetch({ request, respondWith: (p) => (pending = p) });
  assert.deepEqual(await pending, { cached: './index.html' });
  handlers.fetch({
    request: { url: 'http://localhost/js/workouts.js', method: 'GET', mode: 'cors' },
    respondWith: (p) => (pending = p),
  });
  assert.deepEqual(await pending, { cached: './js/workouts.js' });
  let intercepted = false;
  for (const path of ['/api/session', '/api/sync', '/auth/google', '/health'])
    handlers.fetch({
      request: { url: 'http://localhost' + path, method: 'GET', mode: 'navigate' },
      respondWith: () => (intercepted = true),
    });
  assert.equal(intercepted, false);
});
