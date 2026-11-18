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
