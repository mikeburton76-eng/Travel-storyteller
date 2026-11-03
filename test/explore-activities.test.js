'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {activityRecords,createActivityProvider}=require('../explore-activities');
const {sourceCategories,createExploreService}=require('../explore-service');
const cfg=require('../explore-config'),P=require('../explore-policy');
const {createSourceProvider}=require('../explore-sources');
const origin={lat:53.4808,lon:-2.2426};
const element=(id,tags,point=origin)=>({type:'node',id,lat:point.lat,lon:point.lon,tags:{name:'Venue '+id,...tags}});
test('mapped activity types work at coordinates worldwide without assuming prices, ages or facilities',()=>{
 for(const point of [origin,{lat:-33.87,lon:151.21},{lat:40.71,lon:-74}]){
  const records=activityRecords({elements:[element(1,{leisure:'bowling_alley',website:'https://example.org/'},point),element(2,{leisure:'miniature_golf'},point),element(3,{sport:'laser_tag'},point),element(4,{tourism:'museum',name:'Science Museum'},point),element(5,{amenity:'cinema'},point),element(6,{leisure:'escape_game'},point)]},point,10);
  assert.equal(records.length,6);assert.ok(records.every(c=>c.sourceOnly));
  assert.equal(records.find(c=>c.activityKind==='bowling').website,'https://example.org/');
  assert.ok(records.filter(c=>c.activityOnly).every(c=>P.familyUse.test(c.text)));
  assert.ok(records.every(c=>!/free entry|all ages|wheelchair|open daily|£/.test(c.text)));
 }
});
test('private, closed, adult-only, unsafe and far-away records do not become family suggestions',()=>{
 const records=activityRecords({elements:[element(1,{leisure:'bowling_alley',access:'private'}),element(2,{leisure:'miniature_golf',disused:'yes'}),element(3,{leisure:'laser_game',min_age:'18'}),element(4,{leisure:'bowling_alley',description:'A site associated with a massacre.'}),element(5,{leisure:'indoor_play'},{lat:53.2582,lon:-1.9153}),element(6,{leisure:'bowling_alley',website:'javascript:alert(1)'}),element(7,{amenity:'cinema',cinema:'erotic'}),element(8,{amenity:'cinema','disused:amenity':'cinema'})]},origin,10);
 assert.equal(records.length,1);assert.equal(records[0].name,'Venue 6');assert.equal(records[0].website,null);
 assert.ok(!P.familyUse.test('The museum was founded by a family of merchants.'));
});
test('cached and concurrent lookups share one free request, use the boundary and fail briefly without blocking',async()=>{
 let calls=0,time=0,query='';const lookup=createActivityProvider({now:()=>time,fetchImpl:async(url,o)=>{calls++;query=new URL(url).searchParams.get('data');return {ok:true,json:async()=>({elements:[element(1,{leisure:'miniature_golf'})]})}}});
 const [a,b]=await Promise.all([lookup(origin,40),lookup(origin,40)]);assert.equal(calls,1);assert.equal(a.candidates.length,1);assert.deepEqual(a,b);assert.match(query,/around:10000,/);assert.match(query,/out body center 100/);assert.ok(query.includes('[amenity=cinema]'));assert.ok(query.includes('escape_game'));
 time=29*86400000;await lookup(origin,40);assert.equal(calls,1);time=31*86400000;await lookup(origin,40);assert.equal(calls,2);
 let attempts=0;const broken=createActivityProvider({now:()=>time,fetchImpl:async()=>{attempts++;throw Error('offline')}});assert.equal((await broken(origin,10)).unavailable,true);await broken(origin,10);assert.equal(attempts,2);time+=300001;await broken(origin,10);assert.equal(attempts,4);
});
test('a full selection makes room for museum and activity ideas while retaining must-sees and the total cap',()=>{
 const candidates=activityRecords({elements:[element(1,{leisure:'bowling_alley'}),element(2,{leisure:'miniature_golf'}),element(3,{sport:'laser_tag'}),...['Natural History Museum','Science Museum','Football Museum'].map((name,i)=>element(10+i,{tourism:'museum',name}))]},origin,10).map((c,i)=>({...c,id:'venue-'+i}));
 const existing=Array.from({length:cfg.maxResults},(_,i)=>({id:'sight-'+i,section:'attractions',mustSee:i===0}));
 const guide=sourceCategories({items:existing},{candidates},cfg);
 assert.equal(guide.items.length,cfg.maxResults);assert.ok(guide.items.some(c=>c.id==='sight-0'));
 assert.equal(guide.items.filter(c=>c.section==='family').length,3);assert.equal(guide.items.filter(c=>c.section==='museums').length,3);
});
test('map-only listings do not start any paid AI review',async()=>{
 let aiCalls=0;const candidates=activityRecords({elements:[element(1,{leisure:'miniature_golf'})]},origin,10).map((c,i)=>({...c,id:'a'+i}));
 const provider={resolve:async()=>({...origin,label:'A city',mode:'area',overview:''}),collect:async location=>({location,candidates,warnings:[],radiusKm:10}),images:async()=>new Map()};
 const svc=createExploreService({provider,readKey:()=>'',aiWriter:async()=>{aiCalls++;return {choices:[]}}});
 const guide=await svc.explore({place:'A city'});assert.equal(aiCalls,0);assert.ok(guide.items.some(c=>c.section==='family'));
 assert.ok(guide.sources.some(s=>s.kind==='openstreetmap'));
});
test('the fallback remains free, honours rate limiting and bounds requests across different places',async()=>{
 let calls=0;const lookup=createActivityProvider({fetchImpl:async()=>{calls++;return calls%2?{ok:false,status:502}:{ok:true,json:async()=>({elements:[]})}}});
 assert.equal((await lookup(origin,10)).unavailable,false);assert.equal(calls,2);
 let limitedCalls=0;const limited=createActivityProvider({fetchImpl:async()=>{limitedCalls++;return {ok:false,status:429}}});
 for(let i=0;i<15;i++)await limited({...origin,lat:origin.lat+i*.001},10);
 assert.equal(limitedCalls,12);
});
test('a dense city retains museums and different activities, enriches museum evidence and enforces range',async()=>{
 const location={...origin,label:'Example City',title:'Example City',mode:'area',scale:'city'};
 const museum={title:'City Science Museum',description:'Science museum',coordinates:[{lat:origin.lat,lon:origin.lon}],extract:'A science museum displaying the city’s industrial collections and scientific discoveries.'};
 const other=Array.from({length:55},(_,i)=>({title:'Tower '+i,description:'Historic landmark tower',coordinates:[{lat:origin.lat+.001*(i+1),lon:origin.lon}],extract:'A historic tower and architectural landmark with a distinctive facade for visitors to see.'}));
 const map=[element(1,{leisure:'bowling_alley',website:'https://example.org/bowl'}),element(2,{leisure:'miniature_golf'}),element(3,{sport:'laser_tag'}),element(4,{leisure:'bowling_alley'},{lat:53.2582,lon:-1.9153})];
 const provider=createSourceProvider({fetchImpl:async raw=>{
  const u=new URL(raw);if(u.hostname.startsWith('overpass'))return {ok:true,json:async()=>({elements:map})};
  if(u.hostname==='en.wikivoyage.org')return {ok:true,json:async()=>({error:{code:'missingtitle'}})};
  if(u.searchParams.get('action')==='parse')return {ok:true,json:async()=>({parse:{title:location.title,wikitext:{'*':''}}})};
  const full=u.searchParams.get('prop')==='extracts';
  const pages=full?[{...museum,extract:museum.extract+'\n\nChildren can explore interactive exhibits and hands-on experiments in the science gallery.'}]:[museum,...other];
  return {ok:true,json:async()=>({query:{pages:Object.fromEntries(pages.map((p,i)=>[i,p]))}})};
 }});
 const pool=await provider.collect(location,cfg);assert.equal(pool.candidates.length,cfg.maxCandidates);
 assert.ok(pool.candidates.every(c=>P.distanceKm(location,c.coord)<=10));
 const m=pool.candidates.find(c=>c.name===museum.title);assert.ok(m);assert.match(m.text,/interactive exhibits/);
 assert.equal(new Set(pool.candidates.filter(c=>c.activityOnly).map(c=>c.activityKind)).size,3);
 const guide=sourceCategories({items:[]},pool,cfg);assert.ok(guide.items.some(c=>c.name===museum.title&&c.section==='family'));assert.ok(guide.items.some(c=>c.name===museum.title&&c.section==='museums'));
 assert.ok(guide.items.some(c=>c.website==='https://example.org/bowl'));
});


test('named aquariums and planetariums qualify without family wording in the source',()=>{
 const examples=[
  ['SEA LIFE Bangkok Ocean World','SEA LIFE Bangkok Ocean World is an aquarium in the Siam Paragon shopping centre.'],
  ['Bangkok Planetarium','Bangkok Planetarium presents shows about astronomy and the night sky.'],
  ['Siam Paragon','Siam Paragon is a shopping centre that contains an aquarium.']
 ];
 const candidates=examples.map(([name,text],i)=>({id:String(i),name,text,theme:'experience',coord:origin,source:{kind:'wikipedia'}}));
 const guide=sourceCategories({items:[]},{candidates},cfg);
 assert.deepEqual(guide.items.filter(item=>item.section==='family').map(item=>item.name),examples.slice(0,2).map(([name])=>name));
});

test('coordinate-based discovery lists named family attractions in local scripts', async()=>{
 for(const [point,name,tags] of [
  [{lat:13.75,lon:100.5},'พิพิธภัณฑ์สัตว์น้ำ',{tourism:'aquarium'}],
  [{lat:35.68,lon:139.76},'プラネタリウム',{amenity:'planetarium'}],
  [{lat:-23.55,lon:-46.63},'Parque Aquático',{leisure:'water_park'}]
 ]){
  const provider=createActivityProvider({fetchImpl:async raw=>{
   const query=new URL(raw).searchParams.get('data');
   assert.match(query,/out body center 100/);
   assert.ok(query.includes(Object.values(tags)[0]));
   return {ok:true,json:async()=>({elements:[element(1,{name,...tags},point)]})};
  }});
  const pool=await provider(point,10);
  const candidates=pool.candidates.map(c=>({...c,id:'mapped'}));
  assert.deepEqual(sourceCategories({items:[]},{candidates},cfg).items.filter(c=>c.section==='family').map(c=>c.name),[P.plain(name)]);
 }
});
