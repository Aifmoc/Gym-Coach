/* Gym Coach v40. Offline shell, sync client and rest messages. */
const VERSION='v40-20261009-search-conflicts';
const PREFIX='gym-coach-'+encodeURIComponent(self.registration.scope)+'-';
const CACHE=PREFIX+VERSION;
const SHELL=new URL('index.html',self.registration.scope).href;
const ASSETS=['cloud-config.js?v=40','cloud-sync.js?v=40','design37.css?v=40','coach-automation.js?v=40'].map(path=>new URL(path,self.registration.scope).href);
let restTimer=null;
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll([SHELL,...ASSETS].map(url=>new Request(url,{cache:'reload'})));await self.skipWaiting()})());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(url.href.startsWith(new URL('v36/',self.registration.scope).href))return;
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope)||url.pathname.endsWith('/sw.js'))return;
  if(ASSETS.includes(url.href)){
    event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(request);if(cached)return cached;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response})());return;
  }
  if(request.mode==='navigate')event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{const response=await fetch(request);if(response.ok)await cache.put(SHELL,response.clone());return response}
    catch(error){const cached=await cache.match(SHELL);if(cached)return cached;throw error}
  })());
});
self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type==='SKIP_WAITING'){self.skipWaiting();return}
  if(data.type==='cancel-rest'){clearTimeout(restTimer);restTimer=null;return}
  if(data.type!=='schedule-rest')return;
  clearTimeout(restTimer);
  const delay=Number.isFinite(+data.dueAt)?Math.max(0,+data.dueAt-Date.now()):Math.max(0,+data.ms||0);
  // Browser suspension may end worker timers; foreground alert remains in index.html.
  restTimer=setTimeout(()=>{
    restTimer=null;
    self.registration.showNotification(data.title||'Descanso terminado',{body:data.body||'Toca para volver a la serie.',tag:'gym-rest',renotify:true,vibrate:[400,180,400],data:{url:SHELL}}).catch(()=>{});
  },Math.min(delay,2147483647));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=windows.find(c=>c.url.startsWith(self.registration.scope));if(client)return client.focus();return self.clients.openWindow(SHELL)})());
});

