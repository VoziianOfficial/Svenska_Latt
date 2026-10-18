/* Change RELEASE for a manual release. scripts/build_deploy.py derives it from
   the complete deployment content, so each changed publication gets new caches. */
const RELEASE='2026-10-18-word-toggles-1';
const APP_CACHE=`svenska-latt-${RELEASE}-shell`;
const PHOTO_CACHE=`svenska-latt-${RELEASE}-photos`;
const PHOTO_LIMIT=150;
const FILES=['./','./index.html','./style.css','./studio.css','./atelier.css','./learning-polish.css','./atelier.js','./learning-polish.js','./custom-controls.js','./flashcard-media.js','./assets/avatars/pippi-cartoon.png','./app.js','./word-icons.js','./locale-content.js','./supabase-config.js','./supabase-client.js','./supabase-auth.js','./supabase-rpc.js','./supabase-progress.js','./study-time.js','./manual-reviews.js','./words.json','./lessons.json','./books.json','./favicon.svg','./manifest.webmanifest','./privacy.html','./terms.html','./cookies.html'];
const SHELL_URLS=new Set(FILES.map(file=>new URL(file,self.registration.scope).href));
let photoWrites=Promise.resolve();
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(APP_CACHE).then(cache=>cache.addAll(FILES.map(file=>new Request(new URL(file,self.registration.scope),{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('svenska-latt-')&&![APP_CACHE,PHOTO_CACHE].includes(key)).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
async function cachePhoto(request){
 const store=await caches.open(PHOTO_CACHE);
 const cached=await store.match(request);
 if(cached)return cached;
 try{
  const response=await fetch(request,{cache:'no-cache'});
  if(response.ok||response.type==='opaque'){
   const copy=response.clone();
   // Serialize writes and eviction: concurrent image loads cannot exceed the cap.
   photoWrites=photoWrites.catch(()=>{}).then(async()=>{
    await store.put(request,copy);
    const keys=await store.keys();
    for(const key of keys.slice(0,Math.max(0,keys.length-PHOTO_LIMIT)))await store.delete(key);
   });
   await photoWrites.catch(()=>{});
  }
  return response;
 }catch(_){return new Response('',{status:504,statusText:'Offline image unavailable'})}
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 const local=url.origin===self.location.origin;
 const photoRoot=new URL('./assets/flashcards/',self.registration.scope);
 if((local&&url.pathname.startsWith(photoRoot.pathname)&&url.pathname.endsWith('.webp'))||
    (request.destination==='image'&&['images.pexels.com','upload.wikimedia.org'].includes(url.hostname))){
  event.respondWith(cachePhoto(request));return;
 }
 if(!local)return;
 // Match versioned shell requests to the precached canonical URL. Only known
 // public shell resources may enter this cache; API and arbitrary files bypass it.
 url.search='';url.hash='';
 const iconRoot=new URL('./assets/word-icons/',self.registration.scope).pathname;
 const avatarRoot=new URL('./assets/avatars/',self.registration.scope).pathname;
 const staticImage=request.destination==='image'&&
  ((url.pathname.startsWith(iconRoot)&&url.pathname.endsWith('.webp'))||
   (url.pathname.startsWith(avatarRoot)&&/\.(png|jpe?g|webp)$/.test(url.pathname)));
 if(!SHELL_URLS.has(url.href)&&!staticImage)return;
 // Local runtime must reflect the working tree, including during debugging.
 // Never silently fall back to an old script when the local server is down.
 if(['localhost','127.0.0.1','[::1]'].includes(url.hostname)&&SHELL_URLS.has(url.href)){
  event.respondWith(fetch(request,{cache:'no-store'}).catch(()=>new Response('',{status:504,statusText:'Local server unavailable'})));
  return;
 }

 event.respondWith((async()=>{
  const cache=await caches.open(APP_CACHE);
  try{
   const response=await fetch(request,{cache:'no-cache'});
   if(response.ok){const copy=response.clone();event.waitUntil(cache.put(url.href,copy).catch(()=>{}))}
   return response;
  }catch(_){return await cache.match(url.href)||new Response('',{status:504,statusText:'Offline resource unavailable'})}
 })());
});
