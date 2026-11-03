// MOTION. 1.4.3.1 shell cache. Never cache authenticated API or private records.
const CACHE='motion-shell-v1-4-3-2-cadence-20261103';
const FILES=['./','./index.html','./styles.css','./theme.css','./v14.css','./v14.js?v=1432','./v141.js','./v141.css','./v142-atlas.css?v=1431','./v142-atlas.js?v=1431','./v142-3d.js?v=1431','./runtime.js','./app.js','./manifest.webmanifest'];
self.addEventListener('install', e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate', e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('motion-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==self.location.origin)return;
 e.respondWith(fetch(e.request).then(r=>{
  if(r.ok&&FILES.some(p=>new URL(p,self.registration.scope).href===e.request.url)){
   const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
  }
  return r;
 }).catch(()=>caches.match(e.request)));
});
