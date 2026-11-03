const CACHE_VERSION='climbpass-3-development';
const APP_SHELL=/* BUILD_SHELL */ [];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_VERSION).then(cache=>cache.addAll(APP_SHELL.map(url=>new Request(url,{cache:'reload'})))));});
// Never force activation over a running editor or an open IndexedDB transaction.
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('climbpass-')&&k!==CACHE_VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/')||url.pathname==='/health')return;
 event.respondWith(caches.open(CACHE_VERSION).then(async cache=>{
  const cached=await cache.match(event.request);if(cached)return cached;
  if(event.request.mode==='navigate')return cache.match('./index.html');
  return fetch(event.request);
 }));
});
