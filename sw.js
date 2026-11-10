/* MOTION. v1.4.7 — network-first, never caches private activity data. */
const CACHE='motion-shell-v1-4-7-ethereal-20261111';
const FILES=['./','./index.html','./styles.css','./theme.css','./v14.css?v=1440','./v141.css','./pace-format.js?v=1440','./v14.js?v=1440','./v141.js?v=1440','./runtime.js?v=1450','./app.js?v=1440','./strength-core.js?v=1470','./strength-core.css?v=1470','./performance.css?v=1460','./performance.js?v=1470','./ethereal-glass.css?v=20261111b','./manifest.webmanifest','./icon.svg','./apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('motion-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).then(response=>{
   if(response.ok&&FILES.some(file=>new URL(file,self.registration.scope).href===event.request.url)){
     const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone)).catch(()=>{});
   }
   return response;
 }).catch(()=>caches.match(event.request)));
});
