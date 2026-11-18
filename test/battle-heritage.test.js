'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../explore-policy');
const { nearbyHeritage } = require('../explore-heritage');
const { sourceCategories } = require('../explore-service');
const { places } = require('../drive-logic');
const config = require('../explore-config.json');

for (const [town,lat,lon,count] of [
 ['Stirling',56.1165,-3.9369,2], ['Battle',50.916,.486,1],
 ['Harlech',52.86,-4.11,1], ['Derry',54.997,-7.32,1],
 ['Sekigahara',35.365,136.466,1], ['Manchester',53.48,-2.24,0]
]) {
 test('Local battle heritage in '+town,()=>{
  const location={lat,lon};
  const candidates=nearbyHeritage(location,10).filter(c=>c.battleHeritage)
   .map(c=>({...c,id:c.name,distanceKm:P.distanceKm(location,c.coord)}));
  const guide=sourceCategories({items:[]},{location,candidates},config);
  assert.equal(guide.items.length,count);
  assert.ok(guide.items.every(c=>c.section==='history'&&c.source.url));
  assert.equal(places(guide.items).length,count);
 });
}
test('International discovery distinguishes a physical site from an event',()=>{
 assert.ok(P.battleHeritage('Example Fort','A siege ended here in 1812.'));
 assert.equal(P.visitorSuitable('Battle of Example','The battle took place in 1812.'),false);
 assert.equal(P.allowed('An account of a massacre at the battlefield'),false);
});

const { nearbyBattleStories } = require('../historic-battles');
const catalogue = require('../historic-battles.json');
test('Historic battle catalogue has distinct, dated, mapped records',()=>{
 assert.ok(catalogue.length>=300);
 assert.equal(new Set(catalogue.map(row=>row[0])).size,catalogue.length);
 for(const [id,name,year,lat,lon,conflict] of catalogue){
  assert.match(id,/^Q\d+$/);
  assert.ok(name && year>0 && year<1900 && Math.abs(lat)<=90 && Math.abs(lon)<=180 && conflict);
 }
});
for(const [name,lat,lon] of [
 ['Battle of Bosworth Field',52.62,-1.40],['Battle of Towton',53.85,-1.27],
 ['Battle of Culloden',57.49,-4.14],['Battle of Waterloo',50.714,4.40],
 ['Battle of Gettysburg',39.83,-77.23],['Battle of Ayacucho',-13.05,-74.14],
 ['Battle of Isandlwana',-28.36,30.65],['Battle of Ohaeawai',-35.38,173.85]
]){
 test('Explore shows '+name+' as local history',()=>{
  const location={lat,lon};
  const candidates=nearbyBattleStories(location,10,[]).map(c=>({...c,id:c.source.url}));
  const guide=sourceCategories({items:[]},{location,candidates},config);
  const item=guide.items.find(i=>i.name===name);
  assert.ok(item?.historyOnly);
  assert.equal(item.section,'history');
  assert.equal(places(guide.items).length,0);
 });
}
