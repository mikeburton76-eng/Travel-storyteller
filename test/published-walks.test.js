'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createSourceProvider}=require('../explore-sources');
const {fallbackSelection}=require('../explore-service');
const {canonicalPlaces}=require('../drive-logic');
const config=require('../explore-config.json');
for(const [label,lat,lon,scale,expected] of [
 ['Stirling',56.1165,-3.9369,'city',['Back Walk','Airthrey','Wallace Way','Raploch']],
 ['Buxton',53.258,-1.915,'town',['Solomon','Corbar','Georgian Buxton','Errwood']],
 ['Tideswell',53.278,-1.773,'village',['Tideswell Dale —','village history','Cressbrook Dale','Wormhill']],
 ['Castleton',53.344,-1.777,'village',['Cave Dale','Odin Mine','surrounding fields','Great Ridge']]
]){
 test(label+' shows four published walks even when live sources are unavailable',async()=>{
  const provider=createSourceProvider({fetchImpl:async()=>{throw Error('Offline')}});
  const location={label,title:label,lat,lon,scale,mode:'area',overview:'',source:{title:label}};
  const pool=await provider.collect(location,config);
  const cards=canonicalPlaces(fallbackSelection(pool,config).items).filter(c=>c.displayCategory==='walks');
  for(const fragment of expected)assert.ok(cards.some(c=>c.name.includes(fragment)&&c.source.url),cards.map(c=>c.name).join(', '));
 });
}

const {createExploreService}=require('../explore-service');
for(const [label,lat,lon,minimum] of [
 ['Cardiff',51.482,-3.179,4],['Belfast',54.597,-5.93,4],['Howth',53.386,-6.066,4],['London',51.508,-0.128,4],['Edinburgh',55.953,-3.189,4],
 ['Keswick',54.600,-3.140,3],['Chirk',52.934,-3.059,3],
 ['Strangford',54.370,-5.556,4],['Paris',48.857,2.352,3],
 ['Yosemite Village',37.747,-119.590,4],['Franz Josef',-43.388,170.183,4]
]){
 test(label+' has local published routes in the completed guide',async()=>{
  const provider=createSourceProvider({fetchImpl:async()=>{throw Error('Offline')}});
  provider.resolve=async()=>({label,title:label,lat,lon,scale:'town',mode:'area',overview:'',source:{title:label}});
  const guide=await createExploreService({provider,readKey:()=>null}).explore({place:label});
  const walks=guide.items.filter(item=>item.displayCategory==='walks'&&item.source.kind==='route-publisher');
  assert.ok(walks.length>=minimum,walks.map(item=>item.name).join(', '));
  assert.ok(walks.every(item=>item.distanceKm<=config.townRadiusKm));
  if(label==='London')assert.ok(!walks.some(item=>item.name.includes('Basildon Park')));
 });
}
