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
async function app(){
 const nodes=new Map(),events={},windowEvents={},sources=[];let gps,requests=0;
 const node=()=>({disabled:false,textContent:'',value:'Tideswell',append(){},replaceChildren(){},removeAttribute(){},pause(){}});
 const document={hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,addEventListener(k,f){events[k]=f;}};
 const trip={label:'Tideswell',items:[item],audio:{[item.source.url]:new Blob(['wav'])},savedAt:new Date().toISOString()};
 const indexedDB={open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={objectStore(){return {get(){const r={};queueMicrotask(()=>{r.result=trip;r.onsuccess();tx.oncomplete();});return r;}};}};return tx;}};request.onsuccess();});return request;}};
 class AudioContext{constructor(){this.state='running';this.sampleRate=24000;this.destination={};}resume(){return Promise.resolve();}createBuffer(){return {duration:.0001};}createBufferSource(){const s={connect(){},disconnect(){},start(){sources.push(this);},stop(){}};return s;}async decodeAudioData(){return {duration:22};}}
 const navigator={onLine:false,geolocation:{watchPosition(success){gps=success;return 7;},clearWatch(){gps=null;}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../drive-client.js'),'utf8'),{document,navigator,window:{addEventListener(k,f){windowEvents[k]=f;}},DriveLogic:L,AudioContext,indexedDB,Blob,AbortController,DOMException,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},Date,performance,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},fetch(){requests++;throw Error('Offline fetch must not occur');}});
 await tick();await nodes.get('start').onclick();await tick();
 return {nodes,events,document,sources,get gps(){return gps;},get requests(){return requests;},position(overrides){const f=fix(overrides);gps({timestamp:f.time,coords:{latitude:f.lat,longitude:f.lon,accuracy:f.accuracy,speed:f.speed,heading:f.heading}});}};
}
test('offline session decodes saved audio before approach, plays once and makes no network calls',async()=>{
 const a=await app();a.position({});await tick();await tick();assert.match(a.nodes.get('timing').textContent,/saved on this phone/);assert.equal(a.sources.filter(s=>s.buffer.duration===22).length,0);
 a.position({lon:.002});await tick();assert.equal(a.sources.filter(s=>s.buffer.duration===22).length,1);assert.equal(a.requests,0);
 const source=a.sources.at(-1);source.onended();a.position({lon:.0021});await tick();assert.equal(a.sources.filter(s=>s.buffer.duration===22).length,1);
});
test('old GPS and a turn away prevent saved narration from playing',async()=>{
 const a=await app();a.position({});await tick();await tick();a.position({lon:.002,time:Date.now()-20000});assert.equal(a.sources.filter(s=>s.buffer.duration===22).length,0);assert.match(a.nodes.get('status').textContent,/fresh/);
 a.position({lon:.002,heading:270});await tick();assert.equal(a.sources.filter(s=>s.buffer.duration===22).length,0);
});
test('hiding the page stops GPS and audio and requires an explicit restart',async()=>{
 const a=await app();a.position({});await tick();a.document.hidden=true;a.events.visibilitychange();assert.equal(a.gps,null);assert.equal(a.nodes.get('start').disabled,false);assert.match(a.nodes.get('status').textContent,/hidden/);
});
test('offline service worker caches only the separate test shell, never API or main app requests',()=>{
 const listeners={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../drive-test-sw.js'),'utf8'),{self:{location:{origin:'https://test.example'},addEventListener(k,f){listeners[k]=f;}},URL});
 for(const pathname of ['/api/explore','/speech','/voices','/explore','/']){listeners.fetch({request:{method:'GET',url:'https://test.example'+pathname},respondWith(){assert.fail('Unrelated route intercepted');}});}
 listeners.fetch({request:{method:'POST',url:'https://test.example/drive-test'},respondWith(){assert.fail('POST intercepted');}});
});
