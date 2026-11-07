'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const L=require('../drive-logic');
const item={id:'church',name:'A landmark',reason:'This landmark has a long history in its local community. Visitors can see the distinctive stone building and learn how the village grew around it.',coord:{lat:0,lon:.006},source:{url:'https://en.wikipedia.org/wiki/Test',title:'Landmark'}};
const fix=(overrides={})=>({lat:0,lon:0,accuracy:10,time:Date.now(),speed:13.4,heading:90,...overrides});
test('approach uses speed, heading and a narrow corridor; places behind or across another road do not trigger',()=>{
 const f=fix(),m=L.motion(f);assert.ok(L.approaching(item,f,m).eta>20);assert.equal(L.approaching(item,f,m).trigger,false);
 assert.equal(L.approaching(item,fix({lon:.0023}),m).trigger,true);
 assert.equal(L.approaching(item,f,{speed:13.4,heading:270}),null);
 assert.equal(L.approaching({...item,coord:{lat:.005,lon:.003}},f,m),null);
 assert.equal(L.approaching(item,f,m,new Set([item.source.url])),null);
});
test('poor fixes, stationary readings and missing direction cannot auto-play; useful motion can be inferred',()=>{
 assert.equal(L.motion(fix({accuracy:200})),null);assert.equal(L.motion(fix({accuracy:NaN})),null);assert.equal(L.motion(fix({speed:0})),null);assert.equal(L.motion(fix({heading:-1})),null);
 const now=Date.now(),previous=fix({time:now-10000,speed:null,heading:null});const m=L.motion(fix({lon:.001,time:now,speed:null,heading:null}),previous);assert.ok(m.speed>10&&m.speed<12);assert.equal(m.heading,90);
});
test('playback stays local at higher speeds; duplicate and area-only locations are omitted',()=>{
 const f=fix({lon:.001});assert.equal(L.approaching(item,f,{speed:10,heading:90}).trigger,false);assert.equal(L.approaching(item,f,{speed:25,heading:90}).trigger,false);
 assert.equal(L.places([item,{...item,id:'duplicate'}, {...item,id:'festival',source:{url:'festival'},eventArea:true},{...item,id:'history',source:{url:'history'},historyOnly:true},{...item,id:'bad',coord:{lat:NaN,lon:0}}]).length,1);
 assert.ok(L.opening({...item,reason:('This is a supported sentence about a place. ').repeat(30)}).length<=700);
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function app({tripItems=[item],wakeLock,fetchImpl,online=false,autoStart=true,confirm=true,historyStorage}={}){
 const nodes=new Map(),events={},windowEvents={},sources=[],chimes=[],timers=new Map(),intervals=[];let gps,requests=0,timerId=0,nowMs=Date.now(),chimePlaying=false;
 class Clock extends Date{constructor(...args){super(...(args.length?args:[nowMs]));}static now(){return nowMs;}}
 const node=()=>({disabled:false,textContent:'',value:'Buxton',children:[],append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},removeAttribute(name){delete this[name];},pause(){this.paused=true;this.onpause?.();},currentTime:0,async play(){this.paused=false;this.ended=false;this.currentTime=0;this.onplaying?.();this.currentTime=1;this.ontimeupdate?.();(chimePlaying?chimes:sources).push(this);}});
 const historyData=new Map(),historyStore=historyStorage||{getItem:key=>historyData.get(key)||null,setItem:(key,value)=>historyData.set(key,value)};
 const document={hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,addEventListener(k,f){events[k]=f;}};
 const trip={label:'Tideswell',items:tripItems,audio:Object.fromEntries(tripItems.map(i=>[L.key(i),new Blob(['wav'])])),savedAt:new Date().toISOString()};
 const indexedDB={open(){const request={};queueMicrotask(()=>{request.result={close(){},transaction(){const tx={objectStore(){return {get(){const r={};queueMicrotask(()=>{r.result=trip;r.onsuccess();tx.oncomplete();});return r;}};}};return tx;}};request.onsuccess();});return request;}};
 class AudioContext{constructor(){this.state='running';this.sampleRate=24000;this.destination={};}resume(){return Promise.resolve();}createBuffer(){return {duration:.0001};}createBufferSource(){const s={connect(){},disconnect(){},start(){sources.push(this);},stop(){}};return s;}async decodeAudioData(){return {duration:22};}}
 const navigator={onLine:online,wakeLock,geolocation:{watchPosition(success){gps=success;return 7;},clearWatch(){gps=null;}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../drive-client.js'),'utf8'),{document,navigator,window:{addEventListener(k,f){windowEvents[k]=f;}},DriveLogic:L,DriveHistory:{createDriveHistory:options=>require('../drive-history').createDriveHistory({...options,storage:historyStore})},createDrivePlayer:options=>require('../drive-player').createDrivePlayer({...options,schedule:()=>1,cancel(){},url:{createObjectURL:blob=>{chimePlaying=blob.type==='audio/wav';return 'blob:fixture';},revokeObjectURL(){}}}),AudioContext,indexedDB,Blob,AbortController,DOMException,URL:{createObjectURL:()=> 'blob:fixture',revokeObjectURL(){}},Date:Clock,performance,setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout(id){timers.delete(id);},setInterval(fn){intervals.push(fn);return intervals.length;},clearInterval(id){intervals[id-1]=null;},fetch(...args){requests++;if(fetchImpl)return fetchImpl(...args);throw Error('Offline fetch must not occur');}});
 await tick();if(autoStart){await nodes.get('start').onclick();if(confirm)nodes.get('savedPreview').onended?.();}await tick();
 return {nodes,events,document,sources,chimes,navigator,async startJourney(){await nodes.get('start').onclick();nodes.get('savedPreview').onended?.();await tick();},timers,historyStore,runIntervals(){for(const fn of intervals)fn?.();},advance(ms){nowMs+=ms;},runTimer(ms){const entry=[...timers].find(([,t])=>t.ms===ms);if(entry){timers.delete(entry[0]);entry[1].fn();}},get gps(){return gps;},get requests(){return requests;},position(overrides){const f=fix({time:Clock.now(),...overrides});gps({timestamp:f.time,coords:{latitude:f.lat,longitude:f.lon,accuracy:f.accuracy,speed:f.speed,heading:f.heading}});}};
}
test('offline session prepares saved audio before approach, plays once and makes no network calls',async()=>{
 const a=await app();a.position({});await tick();await tick();assert.match(a.nodes.get('timing').textContent,/saved on this phone/);assert.equal(a.sources.filter(s=>s.currentTime>0).length,0);
 a.position({lon:.0023});await tick();assert.equal(a.sources.filter(s=>s.currentTime>0).length,1);assert.equal(a.requests,0);
 const source=a.sources.at(-1);source.onended();a.position({lon:.0021});await tick();assert.equal(a.sources.filter(s=>s.currentTime>0).length,1);
});
test('old GPS and a turn away prevent saved narration from playing',async()=>{
 const a=await app();a.position({});await tick();await tick();a.position({lon:.0023,time:Date.now()-20000});assert.equal(a.sources.filter(s=>s.currentTime>0).length,0);assert.match(a.nodes.get('status').textContent,/fresh/);
 a.position({lon:.0023,heading:270});await tick();assert.equal(a.sources.filter(s=>s.currentTime>0).length,0);
});
test('hiding the page stops GPS and audio and requires an explicit restart',async()=>{
 const a=await app();a.position({});await tick();a.document.hidden=true;a.events.visibilitychange();assert.equal(a.gps,null);assert.equal(a.nodes.get('start').disabled,false);assert.match(a.nodes.get('status').textContent,/hidden/);
});
test('offline service worker caches only the separate test shell, never API or main app requests',()=>{
 const listeners={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../drive-test-sw.js'),'utf8'),{self:{location:{origin:'https://test.example'},addEventListener(k,f){listeners[k]=f;}},URL});
 for(const pathname of ['/api/explore','/speech','/voices','/explore','/']){listeners.fetch({request:{method:'GET',url:'https://test.example'+pathname},respondWith(){assert.fail('Unrelated route intercepted');}});}
 listeners.fetch({request:{method:'POST',url:'https://test.example/drive-test'},respondWith(){assert.fail('POST intercepted');}});
});

const arrival={...item,id:'arrival:town',kind:'arrival',profileVersion:3,pageId:1,placeName:'Village',name:'Introducing Village',coord:{lat:0,lon:.01},arrivalRadiusM:700,prepareRadiusM:2200,checkedAt:new Date().toISOString(),reviewAfter:new Date(Date.now()+365*86400000).toISOString(),audioKey:'revision1'};
test('settlements require a direction and use the 500 m forward area',()=>{
 const f=fix({speed:null,heading:null});assert.equal(L.approaching(arrival,f,null),null);const movement={speed:10,heading:90};assert.equal(L.approaching(arrival,fix({lon:.006}),movement).trigger,true);assert.equal(L.approaching(arrival,fix({lon:.006}),{speed:10,heading:270}),null);assert.equal(L.approaching(arrival,fix({accuracy:200}),movement),null);
});
test('downloaded settlement starts ahead within 500 m and plays once',async()=>{
 const a=await app({tripItems:[arrival]});a.position({speed:null,heading:null});await tick();assert.equal(a.sources.length,0);a.advance(5000);a.position({lon:.006});await tick();await tick();assert.equal(a.sources.length,1);a.sources[0].onended();a.position({lon:.0061});await tick();assert.equal(a.sources.length,1);assert.equal(a.requests,0);
});
test('an unresolved screen-wake request no longer prevents GPS tracking from starting',async()=>{const a=await app({wakeLock:{request:()=>new Promise(()=>{})}});assert.equal(typeof a.gps,'function');a.nodes.get('stop').onclick();});

test('one Start tap plays a local chime and starts GPS after it ends without any download',async()=>{
 const a=await app({confirm:false,tripItems:[]});assert.equal(a.gps,undefined);assert.equal(a.chimes.length,1);assert.equal(a.requests,0);a.chimes[0].onended();assert.equal(typeof a.gps,'function');assert.equal(a.nodes.get('historyList').children.length,0);a.nodes.get('stop').onclick();
});
test('ambiguous preparation offers place choices before any guide or voice download',async()=>{
 const calls=[];const a=await app({autoStart:false,fetchImpl:async url=>{calls.push(url);return {ok:true,json:async()=>({choices:[{title:'Buxton',description:'Derbyshire, England'},{title:'Buxton, Maine',description:'United States'}]})};}});
 await a.nodes.get('prepare').onclick();assert.equal(calls.length,1);assert.match(calls[0],/place-matches/);assert.equal(a.nodes.get('destinationChoices').children.length,2);assert.match(a.nodes.get('destinationMessage').textContent,/Choose the place/);
});
test('audio prepared online can be reused after turning away and losing signal',async()=>{
 const a=await app({tripItems:[],online:true,fetchImpl:async url=>({ok:true,json:async()=>url==='/api/explore'?{complete:true,location:{label:'Town'},items:[item]}:url==='/api/arrivals'?{items:[]}:{defaultVoice:'pippa'},blob:async()=>new Blob(['wav'])})});
 a.position({});for(let i=0;i<6;i++)await tick();assert.match(a.nodes.get('timing').textContent,/ready/);a.position({heading:270});await tick();a.navigator.onLine=false;const previous=a.requests;a.position({heading:90});await tick();a.position({lon:.0023});await tick();assert.equal(a.sources.length,1);assert.equal(a.requests,previous);assert.match(a.nodes.get('log').textContent,/Reusing prepared audio/);a.nodes.get('stop').onclick();
});

test('an in-range landmark takes priority over a distant arrival introduction',()=>{
 const f=fix({lon:.0023}),near=L.choose([arrival,item],f,L.motion(f),new Set());assert.equal(near.item.id,item.id);assert.equal(near.trigger,true);
});
test('the nearest forward landmark is prepared before a more distant settlement',async()=>{
 const a=await app({tripItems:[arrival,item]});a.position({});await tick();await tick();assert.equal(a.nodes.get('placeName').textContent,item.name);assert.equal(a.sources.length,0);a.position({lon:.0023});await tick();await tick();assert.equal(a.sources.length,1);assert.equal(a.nodes.get('placeName').textContent,item.name);a.nodes.get('stop').onclick();
});
test('parked automatic check uses the actual automatic playback path after a delay without GPS or downloads',async()=>{
 const a=await app({autoStart:false});a.nodes.get('testAutomatic').onclick();assert.equal(a.gps,undefined);assert.equal(a.sources.length,0);assert.equal(a.requests,0);a.runTimer(5000);await tick();assert.equal(a.sources.length,1);assert.match(a.nodes.get('log').textContent,/Automatic playback requested: Parked check/);assert.equal(a.gps,undefined);assert.equal(a.requests,0);a.sources.at(-1).onended();assert.match(a.nodes.get('status').textContent,/Parked automatic check finished/);
});
test('hiding the page cancels the parked countdown without starting audio',async()=>{
 const a=await app({autoStart:false});a.nodes.get('testAutomatic').onclick();a.document.hidden=true;a.events.visibilitychange();a.runTimer(5000);await tick();assert.equal(a.sources.length,0);assert.equal(a.nodes.get('start').disabled,false);
});

test('500 m forward trigger ignores old broad radii and rejects places behind or across the corridor',()=>{
 const at=m=>fix({lon:item.coord.lon-m/6371000*180/Math.PI}),m={speed:10,heading:90};for(const speed of [10,30]){assert.equal(L.approaching(item,at(499),{speed,heading:90}).trigger,true);assert.equal(L.approaching(item,at(501),{speed,heading:90}).trigger,false);}const old={...arrival,coord:item.coord,arrivalRadiusM:3000,prepareRadiusM:4800};assert.equal(L.approaching(old,at(499),m).trigger,true);assert.equal(L.approaching(old,at(501),m).trigger,false);assert.equal(L.approaching(old,at(200),{speed:10,heading:270}),null);const across=L.approaching(item,fix({lat:.002,lon:item.coord.lon-.0042}),m);assert.ok(across.ahead<500&&across.metres>500);assert.equal(across.trigger,false);
});

test('old downloaded arrival audio with the repetitive advice is not reused after the content revision',async()=>{
 const old={...arrival,profileVersion:2,coord:{lat:0,lon:0}};const a=await app({tripItems:[old]});a.position({speed:0,heading:null});await tick();assert.equal(a.sources.length,0);assert.match(a.nodes.get('savedStatus').textContent,/needs updating/);a.nodes.get('stop').onclick();
});

test('a return journey after reloading does not play an item already heard today',async()=>{
 const first=await app();first.position({lon:.0023});await tick();await tick();assert.equal(first.sources.length,1);first.nodes.get('stop').onclick();
 const second=await app({historyStorage:first.historyStore});second.position({lon:.0023});await tick();await tick();assert.equal(second.sources.length,0);assert.match(second.nodes.get('decision').textContent,/Already heard today/);second.nodes.get('stop').onclick();
});
test('Hear this place again plays a saved clip once on request, and reset allows a new journey',async()=>{
 const a=await app();a.position({lon:.0023});await tick();await tick();a.nodes.get('stop').onclick();const row=a.nodes.get('historyList').children[0];assert.ok(row);row.children[1].onclick();await tick();assert.equal(a.sources.length,2);a.sources.at(-1).onended();assert.match(a.nodes.get('historyList').children[0].children[0].textContent,/2 plays/);
 a.nodes.get('resetHistory').onclick();assert.equal(a.nodes.get('historyList').children.length,0);await a.startJourney();a.position({lon:.0023});await tick();await tick();assert.equal(a.sources.length,3);a.nodes.get('stop').onclick();
});
test('the parked automatic sound check does not consume daily playback of a place',async()=>{
 const a=await app({autoStart:false});a.nodes.get('testAutomatic').onclick();a.runTimer(5000);await tick();a.sources.at(-1).onended();assert.equal(a.nodes.get('historyList').children.length,0);await a.startJourney();a.position({lon:.0023});await tick();await tick();assert.equal(a.sources.length,2);a.nodes.get('stop').onclick();
});

test('moving away discards delayed narration instead of speaking about a place behind the car',async()=>{
 let resolveSpeech;const speech=new Promise(resolve=>{resolveSpeech=resolve;});const a=await app({tripItems:[],online:true,fetchImpl:async url=>url==='/speech'?speech:{ok:true,json:async()=>url==='/api/explore'?{complete:true,location:{label:'Town'},items:[item]}:url==='/api/arrivals'?{items:[]}:{defaultVoice:'pippa'}}});a.position({lon:.0023});for(let i=0;i<5;i++)await tick();assert.match(a.nodes.get('log').textContent,/Queued after entering 500 m/);a.position({lon:.014});resolveSpeech({ok:true,blob:async()=>new Blob(['wav'])});for(let i=0;i<5;i++)await tick();assert.equal(a.sources.length,0);assert.match(a.nodes.get('log').textContent,/Discarding unplayed A landmark: moving away/);assert.equal(a.nodes.get('placeName').textContent,'');a.nodes.get('stop').onclick();
});
test('a playing clip continues but the next queued clip must still be ahead',async()=>{
 const second={...item,id:'second',name:'Second landmark',coord:{lat:0,lon:.012},source:{url:'https://en.wikipedia.org/wiki/Second'}};const a=await app({tripItems:[item,second]});a.position({lon:.0023});await tick();await tick();assert.equal(a.sources.length,1);a.position({lon:.0085});assert.equal(a.nodes.get('savedPreview').paused,false);assert.match(a.nodes.get('log').textContent,/Queued after entering 500 m: Second landmark/);a.sources[0].onended();a.advance(20001);a.position({lon:.0105});await tick();await tick();assert.equal(a.sources.length,2);assert.equal(a.nodes.get('placeName').textContent,'Second landmark');a.nodes.get('stop').onclick();
});
test('Stop discards a triggered item even if an outstanding audio request later returns',async()=>{
 let resolveSpeech;const speech=new Promise(resolve=>{resolveSpeech=resolve;});const a=await app({tripItems:[],online:true,fetchImpl:async url=>url==='/speech'?speech:{ok:true,json:async()=>url==='/api/explore'?{complete:true,location:{label:'Town'},items:[item]}:url==='/api/arrivals'?{items:[]}:{defaultVoice:'pippa'}}});a.position({lon:.0023});for(let i=0;i<4;i++)await tick();a.nodes.get('stop').onclick();resolveSpeech({ok:true,blob:async()=>new Blob(['wav'])});for(let i=0;i<4;i++)await tick();assert.equal(a.sources.length,0);
});

test('a village behind the car is dropped and a museum ahead is selected instead',async()=>{
 const village={...arrival,id:'staden',name:'Introducing Staden',coord:{lat:0,lon:.0005},source:{url:'https://en.wikipedia.org/wiki/Staden'}},museum={...item,id:'museum',name:'Museum',coord:{lat:0,lon:.006},source:{url:'https://en.wikipedia.org/wiki/Museum'}};let finishSpeech;const speech=new Promise(resolve=>{finishSpeech=resolve;});const a=await app({tripItems:[museum],online:true,fetchImpl:async url=>url==='/speech'?speech:{ok:true,json:async()=>url==='/api/explore'?{complete:true,location:{label:'Buxton'},items:[village,museum]}:url==='/api/arrivals'?{items:[]}:{defaultVoice:'pippa'}}});a.position({});for(let i=0;i<5;i++)await tick();a.position({lon:.0045});for(let i=0;i<4;i++)await tick();assert.equal(a.sources.length,1);assert.equal(a.nodes.get('placeName').textContent,'Museum');assert.match(a.nodes.get('log').textContent,/Discarding unplayed Introducing Staden: moving away/);a.sources[0].onended();finishSpeech({ok:true,blob:async()=>new Blob(['wav'])});a.advance(20001);a.position({lon:.0046});for(let i=0;i<5;i++)await tick();assert.equal(a.sources.length,1);a.nodes.get('stop').onclick();
});
test('online startup also plays the local chime synchronously without fetching a voice',async()=>{
 const a=await app({tripItems:[],autoStart:false,confirm:false,online:true,fetchImpl:async()=>{throw Error('Startup must not fetch');}});a.nodes.get('start').onclick();assert.equal(a.chimes.length,1);assert.equal(a.requests,0);assert.equal(a.gps,undefined);a.chimes[0].onended();assert.equal(typeof a.gps,'function');a.nodes.get('stop').onclick();
});
test('Stop during the chime prevents its completion from starting GPS later',async()=>{
 const a=await app({confirm:false});const ended=a.chimes.at(-1).onended;a.nodes.get('stop').onclick();ended();assert.equal(a.gps,undefined);assert.equal(a.nodes.get('start').disabled,false);
});

test('start chime is a valid short PCM WAV with nonzero samples, not a silent placeholder',async()=>{
 const blob=L.startChime(),bytes=await blob.arrayBuffer(),v=new DataView(bytes);assert.equal(blob.type,'audio/wav');assert.equal(String.fromCharCode(...new Uint8Array(bytes,0,4)),'RIFF');assert.equal(String.fromCharCode(...new Uint8Array(bytes,8,4)),'WAVE');assert.equal(v.getUint16(20,true),1);assert.equal(v.getUint32(24,true),24000);assert.equal(v.getUint16(34,true),16);assert.equal(v.getUint32(40,true),bytes.byteLength-44);assert.ok((bytes.byteLength-44)/48000<1);let peak=0;for(let i=44;i<bytes.byteLength;i+=2)peak=Math.max(peak,Math.abs(v.getInt16(i,true)));assert.ok(peak>8000&&peak<32767);
});
test('a prepared settlement is abandoned immediately when the car turns away before entering its trigger',async()=>{
 const a=await app({tripItems:[arrival]});a.position({lon:0});await tick();await tick();assert.match(a.nodes.get('placeName').textContent,/Introducing Village/);a.position({lon:-.001,heading:270});await tick();assert.equal(a.sources.length,0);assert.equal(a.nodes.get('placeName').textContent,'');assert.match(a.nodes.get('log').textContent,/Discarding unplayed Introducing Village: moving away/);assert.equal(a.nodes.get('historyList').children.length,0);a.nodes.get('stop').onclick();
});

test('the journey holds its last moving heading when parked instead of waiting for direction again',async()=>{
 const a=await app();a.position({speed:10,heading:90});await tick();a.advance(2000);a.position({speed:0,heading:null});await tick();assert.match(a.nodes.get('speed').textContent,/last travel direction held/);assert.doesNotMatch(a.nodes.get('decision').textContent,/Direction not established/);a.nodes.get('stop').onclick();
});

test('three complete clips prepare ahead and play through a signal gap without new requests',async()=>{
 const places=[0,1,2,3].map(i=>({...item,id:'buffer-'+i,name:'Place '+i,reason:'Place '+i+' was founded by local craftspeople and became known for its stone buildings and historic market.',coord:{lat:0,lon:.006*(i+1)},source:{url:'https://example.org/'+i,title:'Place '+i}}));
 const speech=[];
 const a=await app({tripItems:[],online:true,fetchImpl:async(url,options)=>{
  if(url==='/speech')speech.push(JSON.parse(options.body));
  return {ok:true,json:async()=>url==='/api/explore'?{complete:true,location:{label:'Town'},items:places}:url==='/api/arrivals'?{items:[]}:{defaultVoice:'pippa'},blob:async()=>new Blob(['wav'])};
 }});
 a.position({});for(let i=0;i<25;i++)await tick();
 assert.equal(speech.length,3);assert.match(a.nodes.get('ahead').textContent,/3 of up to 3/);assert.equal(a.sources.length,0);
 a.navigator.onLine=false;const previous=a.requests;
 for(const lon of [.0023,.0085,.0145]){
  a.advance(21000);a.position({lon});for(let i=0;i<5;i++)await tick();
  assert.ok(a.sources.length>0);a.sources.at(-1).onended();
 }
 assert.equal(a.sources.length,3);assert.equal(a.requests,previous);a.nodes.get('stop').onclick();
});
test('a clip being buffered is reused when it becomes the nearest place',async()=>{
 const second={...item,id:'second',name:'Second landmark',reason:'This second landmark was built by a famous inventor and is known for its unusual historic design.',coord:{lat:0,lon:.012},source:{url:'https://example.org/second'}};
 let resolveSecond;const held=new Promise(resolve=>{resolveSecond=resolve});let secondRequests=0;
 const a=await app({tripItems:[],online:true,fetchImpl:async(url,options)=>{
  if(url==='/speech'&&JSON.parse(options.body).text.includes('famous inventor')){secondRequests++;return held;}
  return {ok:true,json:async()=>url==='/api/explore'?{complete:true,location:{label:'Town'},items:[item,second]}:url==='/api/arrivals'?{items:[]}:{defaultVoice:'pippa'},blob:async()=>new Blob(['wav'])};
 }});
 a.position({});for(let i=0;i<15;i++)await tick();assert.equal(secondRequests,1);
 a.position({lon:.0085});resolveSecond({ok:true,blob:async()=>new Blob(['wav'])});for(let i=0;i<12;i++)await tick();
 assert.equal(secondRequests,1);assert.equal(a.sources.length,1);assert.equal(a.nodes.get('placeName').textContent,'Second landmark');a.nodes.get('stop').onclick();
});
test('the fuller opening brings a sourced historical detail forward',()=>{
 const reason='The monument stands near the village. It is built from local stone. It sits beside a road through the valley.';
 const text=L.opening({...item,reason,background:'A Bronze Age barrow survives beside the monument. The stone was restored in 1920.'});
 assert.match(text,/Bronze Age barrow/);assert.ok(text.split(/\s+/).length<=75);assert.ok(text.length<=700);
});

test('stopping cancels background preparation and late audio cannot restart playback',async()=>{
 const second={...item,id:'second',name:'Second place',coord:{lat:0,lon:.012},source:{url:'https://example.org/second'},reason:'The second place is a medieval monument near the village.'};
 let finish,signal;const held=new Promise(resolve=>{finish=resolve});
 const a=await app({tripItems:[],online:true,fetchImpl:async(url,options)=>{
  if(url==='/speech'&&JSON.parse(options.body).text.includes('second place')){signal=options.signal;return held;}
  return {ok:true,json:async()=>url==='/api/explore'?{complete:true,location:{label:'Town'},items:[item,second]}:url==='/api/arrivals'?{items:[]}:{defaultVoice:'pippa'},blob:async()=>new Blob(['wav'])};
 }});
 a.position({});for(let i=0;i<15;i++)await tick();assert.ok(signal);a.nodes.get('stop').onclick();assert.equal(signal.aborted,true);
 finish({ok:true,blob:async()=>new Blob(['wav'])});for(let i=0;i<8;i++)await tick();assert.equal(a.sources.length,0);assert.equal(a.nodes.get('start').disabled,false);assert.doesNotMatch(a.nodes.get('log').textContent,/Buffered audio ready: Second place/);
});
