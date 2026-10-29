'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {nearbyWalks,walkingParagraphs}=require('../explore-walks');
const {fallbackSelection}=require('../explore-service'),config=require('../explore-config.json');
test('Tideswell Dale is a source-linked walk with a starting point and separate published route distances',()=>{
 const location={label:'Tideswell',lat:53.278,lon:-1.77};const routes=nearbyWalks(location,6);assert.equal(routes.length,1);
 assert.match(routes[0].text,/1 km upper loop/);assert.match(routes[0].text,/3.2 km route to Miller/);assert.match(routes[0].text,/Litton Mill/);assert.match(routes[0].source.url,/peakdistrict.gov.uk/);
 const route={...routes[0],id:'route',distanceKm:1.5};const guide=fallbackSelection({location,candidates:[route]},config);assert.equal(guide.items.length,1);assert.equal(guide.items[0].section,'walks');assert.equal(guide.items[0].distanceKm,1.5);
 assert.equal(nearbyWalks({label:'Another Tideswell',lat:40,lon:-70},6).length,0);
});
test('walking context retrieves route descriptions rather than generic scenery or unsuitable paragraphs',()=>{
 const text='A limestone valley with scenic views and an old building.\n\nA public footpath crosses the valley, used by walkers following the marked circular walk.\n\nThe site was the scene of a massacre in the past. Walkers once visited it.\n\nA former railway station is disused and closed for restoration.';
 const found=walkingParagraphs(text);assert.match(found,/public footpath/);assert.doesNotMatch(found,/massacre|disused|scenic views/);
 assert.equal(walkingParagraphs('A pretty hill above the village with views across the surrounding countryside.'),'');
});
