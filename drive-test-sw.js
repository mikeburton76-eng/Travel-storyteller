'use strict';
const CACHE='discover-driving-shell-v3';
const ASSETS=['/drive-test','/drive-test.css','/drive-client.js','/drive-player.js','/drive-logic.js'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Only this explicitly downloaded test shell is saved. Never cache API calls,
// credentials, the main app or arbitrary pages; trip audio lives in IndexedDB.
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!ASSETS.includes(url.pathname))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);try{const response=await fetch(event.request);if(response.ok){await cache.put(url.pathname,response.clone());return response;}if(response.status<500)return response;const saved=await cache.match(url.pathname);return saved||response;}catch(error){const saved=await cache.match(url.pathname);if(saved)return saved;throw error;}})());
});
