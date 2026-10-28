'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {createExploreService,validateSelection}=require('../explore-service');
const {parseListings,districtTitles}=require('../explore-sources');
const P=require('../explore-policy'),defaults=require('../explore-config.json');
function pool(){return {location:{label:'Sample Town',title:'Sample Town',lat:50,lon:-1,mode:'area',overview:'Sample Town is a riverside town with gardens, a market and a long tradition of craft.',source:{kind:'wikipedia',title:'Sample Town',url:'https://en.wikipedia.org/wiki/Sample_Town'}},candidates:[
 {id:'a',name:'Riverside Gardens',text:'The riverside gardens opened in 1880 and contain a collection of unusual trees.',theme:'nature',coord:{lat:50,lon:-1},distanceKm:0.2,source:{title:'Gardens',url:'https://en.wikipedia.org/wiki/Gardens'}},
 {id:'b',name:'Craft Museum',text:'A lesser-known museum explores local craft traditions and the lives of the people who made them.',theme:'culture',coord:{lat:50,lon:-1},distanceKm:0.4,source:{title:'Museum',url:'https://en.wikipedia.org/wiki/Museum'}},
 {id:'h',name:'Sample Town: inventions',text:'In 1880 the engineer developed an innovative railway that changed how people travelled.',theme:'history',historyOnly:true,coord:{lat:50,lon:-1},distanceKm:0,source:{title:'Town history',url:'https://en.wikipedia.org/wiki/Sample_Town'}}],warnings:[],radiusKm:40,travelSource:null}}
function pick(c,section='attractions',extra={}){return {id:c.id,section,reason:'Explore this place and the interesting story supported by its source.',evidence:c.text.slice(0,80),familySuitable:true,confidence:.9,visitorValue:4,imageId:null,...extra}}
function answer(p){return {overview:'A riverside town where gardens and local craft offer a gentle starting point for exploring.',overviewEvidence:p.location.overview.slice(0,80),choices:p.candidates.filter(c=>!c.historyOnly).map(c=>pick(c))}}
function fixtures({writer,conf={},providerChanges}={}){
 let time=0,builds=0,calls=0;const provider={resolve:async()=>pool().location,collect:async()=>{builds++;const p=pool();providerChanges?.(p);return p},images:async()=>new Map()};
 const svc=createExploreService({provider,readKey:()=>'',now:()=>time,config:conf,aiWriter:writer?async compact=>{calls++;return writer(compact)}:undefined});
 return {svc,tick:n=>{time+=n},get builds(){return builds},get calls(){return calls}};
}
test('source IDs, evidence, confidence and family rules gate AI output',()=>{
 const p=pool(),bad=[pick(p.candidates[0],'attractions',{id:'invented'}),pick(p.candidates[0],'attractions',{evidence:'A completely invented claim not in the source.'}),pick(p.candidates[0],'attractions',{confidence:.4}),pick(p.candidates[0],'attractions',{reason:'This is about a massacre.'})];
 assert.equal(validateSelection({choices:bad},p,defaults).items.length,0);
 assert.equal(validateSelection(answer(p),p,defaults).items.length,2);
});
test('a hidden gem needs explicit source support, not merely the AI label',()=>{
 const p=pool();assert.equal(validateSelection({choices:[pick(p.candidates[0],'gems',{gemEvidence:p.candidates[0].text})]},p,defaults).items.length,0);
 assert.equal(validateSelection({choices:[pick(p.candidates[1],'gems',{gemEvidence:p.candidates[1].text.slice(0,80)})]},p,defaults).items.length,1);
});
test('history is a story topic, never a renamed attraction or date alone',()=>{
 const p=pool();assert.equal(validateSelection({choices:[pick(p.candidates[2],'attractions')]},p,defaults).items.length,0);
 const extra={storyTitle:'How an engineer connected the town',storyFocus:'engineering'};
 assert.equal(validateSelection({choices:[pick(p.candidates[2],'history',extra)]},p,defaults).items.length,1);
 p.candidates[2].text='This building was constructed in 1880 and is a stone building.';
 assert.equal(validateSelection({choices:[pick(p.candidates[2],'history',extra)]},p,defaults).items.length,0);
});
test('main attractions cap architecture and deduplicate IDs',()=>{
 const p=pool();p.candidates=Array.from({length:10},(_,i)=>({...p.candidates[0],id:String(i),theme:'architecture'}));
 const r=validateSelection({choices:p.candidates.flatMap(c=>[pick(c),pick(c)])},p,defaults);assert.equal(r.items.length,2);
});
test('unknown images are rejected; a matched source image is allowed',()=>{
 const p=pool();p.candidates[0].image={id:'File:Garden.jpg',url:'https://upload.wikimedia.org/garden.jpg'};
 assert.equal(validateSelection({choices:[pick(p.candidates[0],'attractions',{imageId:'https://evil.test/image'})]},p,defaults).items[0].image,null);
 assert.equal(validateSelection({choices:[pick(p.candidates[0],'attractions',{imageId:'File:Garden.jpg'})]},p,defaults).items[0].image.id,'File:Garden.jpg');
});
test('a warm overview requires supplied area evidence',()=>{
 const p=pool(),a=answer(p);a.overviewEvidence='An invented description that does not occur in the source';assert.equal(validateSelection(a,p,defaults).overview,'');
});
test('small places are never padded; fallback is candid and has no invented gems',async()=>{
 const f=fixtures();const r=await f.svc.explore({place:'Tiny village'});assert.equal(r.selectionMode,'sources');assert.equal(r.items.length,2);assert.ok(r.coverage.notes.some(s=>s.includes('few')));assert.ok(r.items.every(c=>c.section==='attractions'));
});
test('repeated and concurrent requests share a build and one AI review',async()=>{
 const f=fixtures({writer:()=>answer(pool())});const [a,b]=await Promise.all([f.svc.explore({place:'Town'}),f.svc.explore({place:' town '})]);assert.equal(f.builds,1);assert.equal(f.calls,1);assert.deepEqual(a.items,b.items);
 const cached=await f.svc.explore({place:'Town'});assert.equal(cached.reused,true);assert.equal(f.calls,1);assert.equal(cached._fingerprint,undefined);
});
test('regular refresh checks sources, reuses unchanged AI output and updates changed data',async()=>{
 let changed=false;const f=fixtures({writer:()=>answer(pool()),conf:{cacheMinutes:1},providerChanges:p=>{if(changed)p.candidates[0].text+=' A new garden was added.'}});
 const first=await f.svc.explore({place:'Town'});f.tick(61000);const refreshed=await f.svc.explore({place:'Town'});assert.equal(f.builds,2);assert.equal(f.calls,1);assert.notEqual(first.checkedAt,refreshed.checkedAt);assert.equal(first.aiReviewedAt,refreshed.aiReviewedAt);
 changed=true;f.tick(61000);await f.svc.explore({place:'Town'});assert.equal(f.calls,2);
});
test('AI budget, concurrency, cache bound and disabled switch limit work',async()=>{
 const f=fixtures({writer:()=>answer(pool()),conf:{maxAiCallsPerHour:1,cacheEntries:1}});await f.svc.explore({place:'A'});assert.equal((await f.svc.explore({place:'B'})).selectionMode,'sources');await f.svc.explore({place:'A'});assert.equal(f.builds,3);assert.equal(f.calls,1);
 const disabled=fixtures({conf:{enabled:false}});await assert.rejects(disabled.svc.explore({place:'Town'}),{status:503});
});
test('location validation rejects invalid input and rounds GPS before provider use',async()=>{
 let got;const f=fixtures();await assert.rejects(f.svc.explore({lat:91,lon:0}),{status:400});await assert.rejects(f.svc.explore({place:' '}),{status:400});
 const provider={resolve:async x=>{got=x;return pool().location},collect:async()=>pool(),images:async()=>new Map()};await createExploreService({provider,readKey:()=>''}).explore({lat:12.123456,lon:34.987654});assert.deepEqual(got,{lat:12.123,lon:34.988});
});
test('nested travel-guide templates preserve names, coordinates and visitor content',()=>{
 const s='{{see | name=[[Garden|Riverside Garden]] | lat=50 | long=-1 | content=A garden with {{convert|10|ha}} of unusual trees and a lakeside walk. | image=Garden.jpg }}\n{{eat|name=Not a sight|content=Restaurant}}\n{{see|name=Crime museum|lat=50|long=-1|content=A museum about a massacre.}}';
 const r=parseListings(s,'Town');assert.equal(r.length,1);assert.equal(r[0].name,'Riverside Garden');assert.deepEqual(r[0].coord,{lat:50,lon:-1});
});
test('district retrieval includes differing themes rather than only city-centre pages',()=>{
 const s='[[Sydney/Centre]] museums [[Sydney/Offices]] skyscrapers [[Sydney/Beach]] beach and coast [[Sydney/Markets]] market and walks';const d=districtTitles(s,'Sydney');assert.ok(d.includes('Sydney/Beach'));assert.ok(d.length<=4);
});
test('family screening and theme detection cover reported examples',()=>{
 for(const s of ['Queen Street massacre','School shootings','Rape','Sexual abuse','Assassinations of George Moscone and Harvey Milk','Caldron sex club'])assert.equal(P.allowed(s),false,s);
 assert.equal(P.allowed('Grape-growing traditions'),true);assert.equal(P.themeOf('Sydney Opera House','Near gardens and parks'),'culture');assert.equal(P.themeOf('Golden Gate Bridge','Close to a park'),'architecture');assert.equal(P.themeOf('Getty Center','A campus of the Getty Museum with architecture and gardens.'),'culture');
});
test('a landmark can have justified, distinct appearances without repeating a card in a section',()=>{
 const p=pool();p.candidates[0].text='The gardens were designed by an architect in 1880. An engineer developed an innovative irrigation system that changed the growing conditions.';
 const a=pick(p.candidates[0],'attractions',{reason:'Explore the landscaped gardens and the varied plants that grow beside the river.'});
 const b=pick(p.candidates[0],'history',{reason:'Discover how an engineer developed irrigation to transform the conditions for growing plants.',storyTitle:'How an engineer helped the garden grow',storyFocus:'engineering'});
 const c=pick(p.candidates[0],'buildings',{reason:'Look at the architectural design and the structures arranged around the original garden.'});
 assert.equal(validateSelection({choices:[a,b,c,a]},p,defaults).items.length,3);
 assert.equal(validateSelection({choices:[a,{...b,reason:a.reason}]},p,defaults).items.length,1);
});
test('location resolution recognises village scale and asks about ambiguous locations',async()=>{
 const {createSourceProvider}=require('../explore-sources');
 let ambiguous=false;
 const provider=createSourceProvider({fetchImpl:async input=>{const u=new URL(input);let data;if(u.searchParams.get('list')==='search')data={query:{search:[{title:'Springfield, A'},{title:'Springfield, B'}]}};else if(ambiguous&&u.searchParams.get('titles')==='Springfield')data={query:{pages:{1:{title:'Springfield',pageprops:{disambiguation:''}}}}};else if(ambiguous)data={query:{pages:{1:{title:'Springfield, A',coordinates:[{lat:1,lon:2}]},2:{title:'Springfield, B',coordinates:[{lat:3,lon:4}]}}}};else data={query:{pages:{1:{title:'Tideswell',description:'Village in Derbyshire, England',extract:'A village with a market and a church.',coordinates:[{lat:53,lon:-1.7}]}}}};return {ok:true,json:async()=>data}}});
 assert.equal((await provider.resolve({place:'Tideswell'})).scale,'village');ambiguous=true;await assert.rejects(provider.resolve({place:'Springfield'}),error=>error.status===409&&error.choices.length===2);
});
test('Commons picture selection requires a recognised licence, credit and a trusted image host',async()=>{
 const {createSourceProvider}=require('../explore-sources');
 const page=(title,url,creator)=>({title:'File:'+title,imageinfo:[{thumburl:url,descriptionurl:'https://commons.wikimedia.org/wiki/File:'+title,extmetadata:{Artist:{value:creator},LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'http://creativecommons.org/licenses/by-sa/4.0/'},ImageDescription:{value:'A landscape view of the public garden.'}}}]});
 const provider=createSourceProvider({fetchImpl:async()=>({ok:true,json:async()=>({query:{pages:{1:page('Garden.jpg','https://thumb.wikimedia.org/garden.jpg','Jane Photographer'),2:page('No-credit.jpg','https://upload.wikimedia.org/no-credit.jpg',''),3:page('Unknown.jpg','https://unknown.test/image.jpg','Someone')}}})})});
 const images=await provider.images([{imageFile:'Garden.jpg'},{imageFile:'No-credit.jpg'},{imageFile:'Unknown.jpg'}]);assert.equal(images.size,1);assert.equal(images.get('Garden.jpg').licenseUrl,'https://creativecommons.org/licenses/by-sa/4.0/');
});
