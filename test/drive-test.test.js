'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const L=require('../drive-logic');
const item={id:'church',name:'A landmark',reason:'This landmark has a long history in its local community. Visitors can see the distinctive stone building and learn how the village grew around it.',coord:{lat:0,lon:.003},source:{url:'https://en.wikipedia.org/wiki/Test',title:'Landmark'}};
const fix=(overrides={})=>({lat:0,lon:0,accuracy:10,time:Date.now(),speed:13.4,heading:90,...overrides});
test('approach uses speed, heading and a narrow corridor; places behind or across another road do not trigger',()=>{
 const f=fix(),m=L.motion(f);assert.ok(L.approaching(item,f,m).eta>20);assert.equal(L.approaching(item,f,m).trigger,false);
 assert.equal(L.approaching(item,fix({lon:.002}),m).trigger,true);
 assert.equal(L.approaching(item,f,{speed:13.4,heading:270}),null);
 assert.equal(L.approaching({...item,coord:{lat:.005,lon:.003}},f,m),null);
 assert.equal(L.approaching(item,f,m,new Set([item.source.url])),null);
});
test('poor fixes, stationary readings and missing direction cannot auto-play; useful motion can be inferred',()=>{
 assert.equal(L.motion(fix({accuracy:200})),null);assert.equal(L.motion(fix({accuracy:NaN})),null);assert.equal(L.motion(fix({speed:0})),null);assert.equal(L.motion(fix({heading:-1})),null);
 const now=Date.now(),previous=fix({time:now-10000,speed:null,heading:null});const m=L.motion(fix({lon:.001,time:now,speed:null,heading:null}),previous);assert.ok(m.speed>10&&m.speed<12);assert.equal(m.heading,90);
});
test('higher speeds trigger further away; duplicate and area-only locations are omitted',()=>{
 const f=fix({lon:.001});assert.equal(L.approaching(item,f,{speed:10,heading:90}).trigger,false);assert.equal(L.approaching(item,f,{speed:25,heading:90}).trigger,true);
 assert.equal(L.places([item,{...item,id:'duplicate'}, {...item,id:'festival',source:{url:'festival'},eventArea:true},{...item,id:'history',source:{url:'history'},historyOnly:true},{...item,id:'bad',coord:{lat:NaN,lon:0}}]).length,1);
 assert.ok(L.opening({...item,reason:('This is a supported sentence about a place. ').repeat(30)}).length<=480);
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function app({tripItems=[item],wakeLock,fetchImpl,online=false,autoStart=true,confirm=true}={}){
 const nodes=new Map(),events={},windowEvents={},sources=[];let gps,requests=0;
 const node=()=>({disabled:false,textContent:'',value:'Buxton',children:[],append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},removeAttribute(name){delete this[name];},pause(){this.paused=true;this.onpause?.();},currentTime:0,async play(){this.paused=false;this.ended=false;this.currentTime=0;this.onplaying?.();this.currentTime=1;this.ontimeupdate?.();sources.push(this);}});
 const document={hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,addEventListener(k,f){events[k]=f;}};
 const trip={label:'Tideswell',items:tripItems,audio:Object.fromEntries(tripItems.map(i=>[L.key(i),new Blob(['wav'])])),savedAt:new Date().toISOString()};
 const indexedDB={open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={objectStore(){return {get(){const r={};queueMicrotask(()=>{r.result=trip;r.onsuccess();tx.oncomplete();});return r;}};}};return tx;}};request.onsuccess();});return request;}};
 class AudioContext{constructor(){this.state='running';this.sampleRate=24000;this.destination={};}resume(){return Promise.resolve();}createBuffer(){return {duration:.0001};}createBufferSource(){const s={connect(){},disconnect(){},start(){sources.push(this);},stop(){}};return s;}async decodeAudioData(){return {duration:22};}}
 const navigator={onLine:online,wakeLock,geolocation:{watchPosition(success){gps=success;return 7;},clearWatch(){gps=null;}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../drive-client.js'),'utf8'),{document,navigator,window:{addEventListener(k,f){windowEvents[k]=f;}},DriveLogic:L,createDrivePlayer:options=>require('../drive-player').createDrivePlayer({...options,schedule:()=>1,cancel(){},url:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}}}),AudioContext,indexedDB,Blob,AbortController,DOMException,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},Date,performance,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},fetch(...args){requests++;if(fetchImpl)return fetchImpl(...args);throw Error('Offline fetch must not occur');}});
 await tick();if(confirm)nodes.get('confirmVoice').onclick();if(autoStart)await nodes.get('start').onclick();await tick();
 return {nodes,events,document,sources,navigator,get gps(){return gps;},get requests(){return requests;},position(overrides){const f=fix(overrides);gps({timestamp:f.time,coords:{latitude:f.lat,longitude:f.lon,accuracy:f.accuracy,speed:f.speed,heading:f.heading}});}};
}
test('offline session prepares saved audio before approach, plays once and makes no network calls',async()=>{
 const a=await app();a.position({});await tick();await tick();assert.match(a.nodes.get('timing').textContent,/saved on this phone/);assert.equal(a.sources.filter(s=>s.currentTime>0).length,0);
 a.position({lon:.002});await tick();assert.equal(a.sources.filter(s=>s.currentTime>0).length,1);assert.equal(a.requests,0);
 const source=a.sources.at(-1);source.onended();a.position({lon:.0021});await tick();assert.equal(a.sources.filter(s=>s.currentTime>0).length,1);
});
test('old GPS and a turn away prevent saved narration from playing',async()=>{
 const a=await app();a.position({});await tick();await tick();a.position({lon:.002,time:Date.now()-20000});assert.equal(a.sources.filter(s=>s.currentTime>0).length,0);assert.match(a.nodes.get('status').textContent,/fresh/);
 a.position({lon:.002,heading:270});await tick();assert.equal(a.sources.filter(s=>s.currentTime>0).length,0);
});
test('hiding the page stops GPS and audio and requires an explicit restart',async()=>{
 const a=await app();a.position({});await tick();a.document.hidden=true;a.events.visibilitychange();assert.equal(a.gps,null);assert.equal(a.nodes.get('start').disabled,false);assert.match(a.nodes.get('status').textContent,/hidden/);
});
test('offline service worker caches only the separate test shell, never API or main app requests',()=>{
 const listeners={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../drive-test-sw.js'),'utf8'),{self:{location:{origin:'https://test.example'},addEventListener(k,f){listeners[k]=f;}},URL});
 for(const pathname of ['/api/explore','/speech','/voices','/explore','/']){listeners.fetch({request:{method:'GET',url:'https://test.example'+pathname},respondWith(){assert.fail('Unrelated route intercepted');}});}
 listeners.fetch({request:{method:'POST',url:'https://test.example/drive-test'},respondWith(){assert.fail('POST intercepted');}});
});

const arrival={...item,id:'arrival:town',kind:'arrival',profileVersion:2,pageId:1,placeName:'Village',name:'Introducing Village',coord:{lat:.01,lon:.01},arrivalRadiusM:700,prepareRadiusM:2200,checkedAt:new Date().toISOString(),reviewAfter:new Date(Date.now()+365*86400000).toISOString(),audioKey:'revision1'};
test('village arrival uses an area instead of the narrow landmark corridor, even with no speed or heading',()=>{
 const f=fix({speed:null,heading:null});const approaching=L.approaching(arrival,f,null);assert.ok(approaching);assert.equal(approaching.trigger,false);assert.equal(L.approaching(arrival,fix({lat:.006,lon:.006,speed:0,heading:null}),null).trigger,true);assert.equal(L.approaching(arrival,fix({accuracy:200}),null),null);
 assert.equal(L.approaching(arrival,fix({lat:.006,lon:.006}),null,new Set([L.key(arrival)])),null);
});
test('downloaded arrival starts on entering the village area without relying on heading and plays once',async()=>{
 const a=await app({tripItems:[arrival]});a.position({speed:null,heading:null});await tick();await tick();assert.equal(a.sources.filter(s=>s.currentTime>0).length,0);a.position({lat:.006,lon:.006,speed:0,heading:null});await tick();assert.equal(a.sources.filter(s=>s.currentTime>0).length,1);a.sources.at(-1).onended();a.position({lat:.007,lon:.007,speed:0,heading:null});await tick();assert.equal(a.sources.filter(s=>s.currentTime>0).length,1);assert.equal(a.requests,0);
});
test('an unresolved screen-wake request no longer prevents GPS tracking from starting',async()=>{const a=await app({wakeLock:{request:()=>new Promise(()=>{})}});assert.equal(typeof a.gps,'function');a.nodes.get('stop').onclick();});

test('starting requires the listener to confirm audible Pippa, not only a successful player request',async()=>{
 const a=await app({confirm:false});assert.equal(a.gps,undefined);assert.match(a.nodes.get('status').textContent,/I can hear Pippa/);a.nodes.get('confirmVoice').onclick();await a.nodes.get('start').onclick();assert.equal(typeof a.gps,'function');a.nodes.get('stop').onclick();
});
test('ambiguous preparation offers place choices before any guide or voice download',async()=>{
 const calls=[];const a=await app({autoStart:false,fetchImpl:async url=>{calls.push(url);return {ok:true,json:async()=>({choices:[{title:'Buxton',description:'Derbyshire, England'},{title:'Buxton, Maine',description:'United States'}]})};}});
 await a.nodes.get('prepare').onclick();assert.equal(calls.length,1);assert.match(calls[0],/place-matches/);assert.equal(a.nodes.get('destinationChoices').children.length,2);assert.match(a.nodes.get('destinationMessage').textContent,/Choose the place/);
});
test('audio prepared online can be reused after turning away and losing signal',async()=>{
 const a=await app({tripItems:[],online:true,fetchImpl:async url=>({ok:true,json:async()=>url==='/api/explore'?{complete:true,location:{label:'Town'},items:[item]}:url==='/api/arrivals'?{items:[]}:{defaultVoice:'pippa'},blob:async()=>new Blob(['wav'])})});
 a.position({});for(let i=0;i<6;i++)await tick();assert.match(a.nodes.get('timing').textContent,/ready/);a.position({heading:270});await tick();a.navigator.onLine=false;const previous=a.requests;a.position({heading:90});await tick();a.position({lon:.002});await tick();assert.equal(a.sources.length,1);assert.equal(a.requests,previous);assert.match(a.nodes.get('log').textContent,/Reusing prepared audio/);a.nodes.get('stop').onclick();
});
