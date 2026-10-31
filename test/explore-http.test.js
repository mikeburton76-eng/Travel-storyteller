'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),path=require('node:path');
test('Explore routes retain authentication and reject invalid or cross-site requests before retrieval',async t=>{
 const port=32000+Math.floor(Math.random()*10000),root=path.resolve(__dirname,'..');
 const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,APP_PASSWORD:'explore-fixture',ANTHROPIC_API_KEY:'',PORT:String(port)},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),5000);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));child.stdout.on('data',chunk=>{if(String(chunk).includes('is running')){clearTimeout(timer);resolve()}})});
 const base='http://127.0.0.1:'+port,auth='Basic '+Buffer.from('traveller:explore-fixture').toString('base64');
 assert.equal((await fetch(base+'/explore')).status,401);
 const page=await fetch(base+'/explore',{headers:{authorization:auth}});assert.equal(page.status,200);assert.match(await page.text(),/Discover Places/);
 const script=await fetch(base+'/explore-client.js',{headers:{authorization:auth}});assert.equal(script.status,200);assert.match(await script.text(),/refreshIfDue/);
 for(const route of ['/', '/explore', '/voice-test', '/listen']){
  const response=await fetch(base+route,{headers:{authorization:auth}});assert.equal(response.status,200);
  const html=await response.text();assert.match(html,/aria-label="Main navigation"/);assert.match(html,/href="\/navigation.css"/);if(route==='/'||route==='/explore'){assert.match(html,/id="modeGo"/);assert.match(html,/id="modeHome"/)}else assert.match(html,/id="app-menu-toggle"/);assert.doesNotMatch(html,/Try the voice/);
 }
 for(const route of ['/navigation.css','/navigation.js','/explore-audio.js','/discover-design.css','/narrator-settings.js','/drive-test','/drive-client.js','/drive-test.css','/drive-logic.js','/drive-test-sw.js','/food-test','/food-test.css','/food-client.js','/food-demo.webp','/food-open-test','/food-open.css','/food-open-client.js','/food-open-data.json','/place-search.js','/return-state.js','/stay','/stay-client.js','/stay-data.json']){
  assert.equal((await fetch(base+route)).status,401);const response=await fetch(base+route,{headers:{authorization:auth}});assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
 }
 assert.equal((await fetch(base+'/api/place-matches?q=Melbourne')).status,401);assert.equal((await fetch(base+'/api/place-matches?q=ab',{headers:{authorization:auth}})).status,400);assert.equal((await fetch(base+'/api/place-matches?q=Melbourne',{headers:{authorization:auth,origin:'https://unrelated.test'}})).status,403);
 const stays=await(await fetch(base+'/stay-data.json',{headers:{authorization:auth}})).json();assert.equal(stays.items.length,16);assert.equal(stays.automaticReview,false);assert.ok(stays.items.every(i=>i.website.startsWith('https://')));
 const openFood=await(await fetch(base+'/food-open-data.json',{headers:{authorization:auth}})).json();assert.equal(openFood.items.length,75);assert.equal(openFood.items.filter(i=>i.photo).length,4);assert.ok(openFood.items.every(i=>i.source.startsWith('https://www.openstreetmap.org/')));assert.ok(openFood.items.filter(i=>i.photo).every(i=>i.photo.author&&i.photo.licenseURL.startsWith('https://creativecommons.org/')));
 const food=await(await fetch(base+'/food-test',{headers:{authorization:auth}})).text();assert.match(food,/not real venues or recommendations/);assert.match(food,/AI-generated food illustrations/);
 const photo=await fetch(base+'/food-demo.webp',{headers:{authorization:auth}});assert.equal(photo.headers.get('content-type'),'image/webp');assert.equal(Buffer.from(await photo.arrayBuffer()).toString('ascii',0,4),'RIFF');
 const landing=await(await fetch(base+'/',{headers:{authorization:auth}})).text();assert.match(landing,/id="storyPlayer"/);assert.match(landing,/id="backToCategories"/);
 assert.equal((await fetch(base+'/api/arrivals',{method:'POST'})).status,401);
 const arrival=(body,extra={})=>fetch(base+'/api/arrivals',{method:'POST',headers:{authorization:auth,'content-type':'application/json',...extra},body:JSON.stringify(body)});
 assert.equal((await arrival({lat:123,lon:0})).status,400);
 assert.equal((await arrival({place:''})).status,400);
 assert.equal((await arrival({place:'Tideswell'},{origin:'https://unrelated.test'})).status,403);
 assert.equal((await arrival({place:'Tideswell'},{'content-type':'text/plain'})).status,415);
 const post=(body,extra={})=>fetch(base+'/api/explore',{method:'POST',headers:{authorization:auth,'content-type':'application/json',...extra},body:JSON.stringify(body)});
 assert.equal((await post({place:'Sydney'},{origin:'https://unrelated.test'})).status,403);
 assert.equal((await post({place:'Sydney'},{'content-type':'text/plain'})).status,415);
 assert.equal((await post({lat:123,lon:0})).status,400);
 assert.equal((await post({place:''})).status,400);
});

