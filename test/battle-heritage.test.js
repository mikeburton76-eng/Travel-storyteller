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
