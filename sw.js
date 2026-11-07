/* MOTION. Fast startup: cache static shell, never cache private activity data. */
const CACHE='motion-shell-v1-4-7-faststart-20261107';
const FILES=[
 './','./index.html','./styles.css','./theme.css',
 './v14.css?v=1440','./v141.css','./pace-format.js?v=1440',
 './v14.js?v=1440','./v141.js?v=1440',
 './runtime.js?v=1450','./map-loader.js?v=1471','./app.js?v=1440',
 './strength-core.js?v=1470','./strength-core.css?v=1470',
 './performance.css?v=1460','./performance.js?v=1470',
 './manifest.webmanifest','./icon.svg','./apple-touch-icon.png'
];
const STATIC_URLS=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));

self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(
  caches.keys().then(keys=>Promise.all(
   keys.filter(key=>key.startsWith('motion-shell-')&&key!==CACHE).map(key=>caches.delete(key))
  )).then(()=>self.clients.claim())
 );
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;

 if(request.mode==='navigate'){
  // Show a cached app shell immediately; refresh its HTML for the next visit.
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   const cached=await cache.match(request) ||
    await cache.match(new URL('./index.html',self.registration.scope).href);
   const network=fetch(request).then(async response=>{
    if(response.ok)await cache.put(request,response.clone());
    return response;
   });
   if(cached){
    event.waitUntil(network.catch(()=>{}));
    return cached;
   }
   try{return await network}catch{return Response.error()}
  })());
  return;
 }
 if(!STATIC_URLS.has(request.url))return;
 // Versioned scripts/styles use local cache; uncached files are fetched normally.
 event.respondWith((async()=>{
  const cached=await caches.match(request);
  if(cached)return cached;
  const response=await fetch(request);
  if(response.ok){
   const cache=await caches.open(CACHE);
   await cache.put(request,response.clone());
  }
  return response;
 })());
});
