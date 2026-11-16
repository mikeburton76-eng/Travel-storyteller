const {test}=require('node:test'),assert=require('node:assert/strict');
const W=require('../explore-walks'),P=require('../explore-policy');
const LA={lat:34.05,lon:-118.24,mode:'area',scale:'city'};
const rows=[
 {name:'Griffith Park',coord:{lat:34.13,lon:-118.30},text:'Griffith Park has hiking trails through the hills.'},
 {name:'Runyon Canyon Park',coord:{lat:34.11,lon:-118.35},text:'The park has walking and hiking trails.'},
 {name:'Palisades Park',coord:{lat:34.02,lon:-118.50},text:'The coastal park has paved paths for walking above the beach.'},
 {name:'Mathias Botanical Garden',coord:{lat:34.06,lon:-118.44},text:'A botanical garden with plant collections.'},
 ...Array.from({length:8},(_,i)=>({name:'Central Park '+i,coord:{lat:34.05+i*.001,lon:-118.24},text:'A public park with walking paths.'}))
].map((c,i)=>({...c,id:String(i)}));
test('LA selects a small mix of gardens, coast and hill parks rather than only central neighbours',()=>{
 const selected=W.scatterWalks(rows,LA,6);
 assert.equal(selected.length,6);
 assert.ok(selected.some(c=>c.name==='Palisades Park'));
 assert.ok(selected.some(c=>c.name==='Mathias Botanical Garden'));
 assert.ok(selected.some(c=>/Griffith|Runyon/.test(c.name)));
 assert.ok(rows.slice(0,4).every(c=>P.distanceKm(LA,c.coord)<=W.walkingRadius(LA,10,{})));
});
test('city walking extent is bounded worldwide, without widening GPS searches or villages',()=>{
 assert.equal(W.walkingRadius(LA,10,{}),30);
 assert.equal(W.walkingRadius({...LA,mode:'nearby'},10,{}),10);
 assert.equal(W.walkingRadius({...LA,scale:'village'},6,{}),6);
 assert.equal(W.walkingRadius(LA,10,{cityWalkRadiusKm:500}),30);
});
test('gardens are valid destinations but a walking-distance hotel or bike-only path is not a documented walk',()=>{
 assert.equal(W.walkCandidate({name:'Botanical Garden',text:'A botanical garden containing rare plants.'}),true);
 assert.equal(W.walkCandidate({name:'Hotel Park',text:'A hotel within walking distance of the station.'}),false);
 assert.equal(W.walkCandidate({name:'Beach Bike Trail',text:'A cycle-only route for bicycles.'}),false);
 assert.equal(W.walkCandidate({name:'Town Museum',text:'Walking tours of the museum.'}),false);
});
test('a different worldwide city gets the same spatial mix with no LA-specific rules',()=>{
 const shifted=rows.map(c=>({...c,name:c.name.replace(/Griffith|Runyon|Palisades|Mathias/g,'Local'),coord:{lat:c.coord.lat+14,lon:c.coord.lon+120}}));
 const selected=W.scatterWalks(shifted,{lat:48.05,lon:1.76},6);
 assert.equal(selected.length,6);
 assert.ok(selected.some(c=>/Botanical/.test(c.name)));assert.ok(selected.some(c=>/coastal/.test(c.text)));
});
test('source collection keeps outer-city walks but rejects distant landmarks and wrong-country names',async()=>{
 const {createSourceProvider}=require('../explore-sources'),config=require('../explore-config.json');
 const candidates=[...rows.slice(0,4),
  {name:'Outer City Museum',coord:{lat:34.02,lon:-118.50},text:'A museum with historical exhibitions.'},
  {name:'Manchester Park',coord:{lat:53.48,lon:-2.24},text:'A public park with walking trails.'}];
 const pages=Object.fromEntries(candidates.map((c,i)=>[i,{pageid:i,title:c.name,extract:c.text,description:c.name,coordinates:[c.coord]}]));
 const fetchImpl=async input=>{
  const url=new URL(String(input));
  return {ok:true,json:async()=>{
   if(url.hostname.includes('wikipedia')&&url.searchParams.get('generator')==='search')return {query:{pages}};
   return {query:{pages:{}},elements:[],parse:{title:'Los Angeles',wikitext:{'*':''}}};
  }};
 };
 const provider=createSourceProvider({fetchImpl});
 const pool=await provider.collect({...LA,title:'Los Angeles',label:'Los Angeles'},config);
 for(const c of rows.slice(0,4))assert.ok(pool.candidates.some(x=>x.name===c.name),c.name);
 assert.ok(!pool.candidates.some(x=>/Outer City Museum|Manchester Park/.test(x.name)));
 assert.equal(pool.walkRadiusKm,30);
 const {createExploreService}=require('../explore-service');
 const service=createExploreService({readKey:()=>'',provider:{resolve:async()=>({...LA,title:'Los Angeles',label:'Los Angeles'}),collect:async()=>pool,images:async()=>new Map()}});
 const result=await service.explore({place:'Los Angeles'});
 const walks=result.items.filter(c=>c.displayCategory==='walks');
 assert.ok(walks.length>=4&&walks.length<=6);
 assert.ok(result.coverage.notes.some(x=>/30 km/.test(x)));
});
