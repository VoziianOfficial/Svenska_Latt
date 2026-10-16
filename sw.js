/* Svenska Lätt v12: cache application shell and previously-viewed photographs.
   External images remain third-party content. A picture has to load once online
   before it can be available offline. */
const APP_CACHE='svenska-latt-v45-shell';
const PHOTO_CACHE='svenska-latt-v23-photos';
const PHOTO_LIMIT=150;
const FILES=['./','./index.html','./style.css','./studio.css','./atelier.css','./learning-polish.css','./atelier.js','./learning-polish.js','./flashcard-media.js','./assets/flashcards/work.webp','./assets/avatars/pippi-cartoon.png','./app.js','./word-icons.js','./locale-content.js','./supabase-config.js','./words.json','./lessons.json','./books.json','./favicon.svg','./favicon.svg?v=42','./manifest.webmanifest','./privacy.html','./terms.html','./cookies.html'];
self.addEventListener('install',e=>{
 e.waitUntil(caches.open(APP_CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('svenska-latt-')&&!([APP_CACHE,PHOTO_CACHE].includes(k))).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
async function cachePhoto(request,event){
 const store=await caches.open(PHOTO_CACHE);
 const cached=await store.match(request);
 if(cached)return cached;
 try{
  const response=await fetch(request);
  if(response.ok||response.type==='opaque'){
   // Never hold up the first paint while saving the photograph to disk.
   event.waitUntil((async()=>{
    await store.put(request,response.clone());
    const keys=await store.keys();
    if(keys.length>PHOTO_LIMIT){for(const k of keys.slice(0,keys.length-PHOTO_LIMIT))await store.delete(k)}
   })().catch(()=>{}));
  }
  return response;
 }catch(_){return new Response('',{status:504,statusText:'Offline image unavailable'})}
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(request.destination==='image'&&(['images.pexels.com','upload.wikimedia.org'].includes(url.hostname))){
  event.respondWith(cachePhoto(request,event));return;
 }
 if(url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(APP_CACHE).then(c=>c.put(request,copy)).catch(()=>{}))}
  return response;
 }).catch(()=>caches.match(request)));
});
