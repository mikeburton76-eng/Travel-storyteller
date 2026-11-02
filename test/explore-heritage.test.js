'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {nearbyHeritage}=require('../explore-heritage'),P=require('../explore-policy');
const {fallbackSelection,validateSelection,sourceCategories}=require('../explore-service'),{createSourceProvider}=require('../explore-sources'),cfg=require('../explore-config');
const location={label:'Buxton',title:'Buxton',lat:53.258,lon:-1.916,mode:'area',scale:'town',overview:''};
test('Buxton historic hotel and public gardens fit the existing categories without booking copy',()=>{
 const candidates=nearbyHeritage(location,3).map((c,i)=>({...c,id:'reviewed-'+i,theme:P.themeOf(c.name,c.text),distanceKm:.2}));
 const guide=fallbackSelection({location,candidates},cfg);
 assert.ok(guide.items.some(c=>c.name==='Old Hall Hotel'&&c.section==='history'));
 assert.ok(guide.items.some(c=>c.name==='Buxton Pavilion Gardens'&&c.section==='walks'));
 assert.ok(guide.items.some(c=>c.name==='Buxton Pavilion Gardens'&&c.section==='family'));
 assert.ok(guide.items.every(c=>!/(book now|reserve a room|check-in|check-out)/i.test(c.reason)));
 const hotel=candidates.find(c=>c.name==='Old Hall Hotel');assert.match(hotel.text,/reputed to be England’s oldest/);assert.doesNotMatch(hotel.text,/UK’s oldest/);
 assert.equal(nearbyHeritage({lat:40,lon:-70,label:'Buxton'},3).length,0);
});
test('worldwide heritage rules require significance for working hotels and evidence for walks',()=>{
 assert.equal(P.visitorSuitable('Town Hotel','A hotel in the historic centre with rooms and breakfast.'),false);
 const text='This historic hotel is a listed building. The queen stayed here during her visits to the town.';
 assert.equal(P.visitorSuitable('Royal Hotel',text),true);assert.equal(P.historySubject(text),true);
 assert.equal(P.historySubject('A house constructed in 1850.'),false);
 for(const name of ['Country house','Manor','Historic house','Château'])assert.equal(P.visitor.test(name),true);
 const base={id:'overseas',name:'River Promenade',text:'A public riverside promenade offers a stroll beside the water and established paths through the public gardens.',coord:{lat:-33,lon:151},theme:'nature',source:{title:'Local guide'}};
 const result=fallbackSelection({location:{overview:''},candidates:[base,{...base,id:'private',name:'Private garden',text:'A landscaped garden with flower beds and a lake.'}]},cfg);
 assert.ok(result.items.some(i=>i.id==='overseas'&&i.section==='walks'));assert.ok(!result.items.some(i=>i.id==='private'&&i.section==='walks'));
});
test('an evidenced royal stay in a historic house qualifies for AI history selection',()=>{
 const c={id:'h',name:'Historic House',text:'The house was a former royal residence. The queen stayed here during her visits to the region.',theme:'architecture',coord:{lat:1,lon:2},source:{title:'Guide'}};
 const items=validateSelection({choices:[{id:'h',section:'history',storyTitle:'Royal visitors to the house',storyFocus:'people',reason:'The house has a documented connection with royal visitors to the region.',evidence:'The queen stayed here during her visits to the region.',familySuitable:true,confidence:.95,visitorValue:4}]},{location:{overview:''},candidates:[c]},cfg).items;
 assert.equal(items.length,1);assert.equal(items[0].section,'history');
});
test('reviewed gardens survive absent sources and an encyclopedia location that is too far west',async()=>{
 const wrong={title:'Buxton Pavilion Gardens',description:'Public park in England',extract:'Buxton Pavilion Gardens is a public park with Victorian gardens.',coordinates:[{lat:53.25,lon:-1.933}]};
 const provider=createSourceProvider({fetchImpl:async raw=>{const u=new URL(raw);let data={query:{pages:{}}};if(u.hostname==='en.wikivoyage.org')data={error:{code:'missingtitle'}};else if(u.searchParams.get('generator')==='geosearch')data={query:{pages:{1:wrong}}};else if(u.searchParams.get('action')==='parse')data={parse:{title:'Buxton',wikitext:{'*':''}}};else if(u.searchParams.has('titles'))data={query:{pages:{1:wrong}}};return {ok:true,json:async()=>data};}});
 const pool=await provider.collect({...location},cfg);const park=pool.candidates.find(c=>c.name==='Buxton Pavilion Gardens');assert.ok(park);assert.deepEqual(park.coord,{lat:53.25802,lon:-1.9180561});assert.equal(pool.candidates.filter(c=>c.name==='Buxton Pavilion Gardens').length,1);
 const guide=fallbackSelection(pool,cfg);assert.ok(guide.items.some(i=>i.name==='Buxton Pavilion Gardens'&&i.section==='walks'));assert.ok(guide.items.some(i=>i.name==='Old Hall Hotel'&&i.section==='history'));
});

test('a full guide keeps reviewed walking and historic coverage within the result budget',()=>{
 const candidates=nearbyHeritage(location,3).map((c,i)=>({...c,id:'reviewed-'+i,theme:P.themeOf(c.name,c.text)}));const existing=Array.from({length:cfg.maxResults},(_,i)=>({id:'other-'+i,name:'Other sight '+i,section:'attractions',mustSee:i===0}));const guide=sourceCategories({overview:'',items:existing},{location,candidates},cfg);assert.ok(guide.items.length<=cfg.maxResults);assert.ok(guide.items.some(i=>i.id==='other-0'));assert.ok(guide.items.some(i=>i.name==='Old Hall Hotel'&&i.section==='history'));assert.ok(guide.items.some(i=>i.name==='Buxton Pavilion Gardens'&&i.section==='walks'));
});
