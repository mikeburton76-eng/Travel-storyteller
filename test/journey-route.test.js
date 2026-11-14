'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),JR=require('../journey-route');
test('route distance is measured to road segments rather than a straight origin/destination line',()=>{
 const line=[[0,0],[.02,0],[.02,.02]];
 assert.ok(JR.project({lat:0,lon:.01},line).metres<1);
 assert.ok(JR.project({lat:.01,lon:.01},line).metres>1000);
 assert.ok(JR.project({lat:.01,lon:.02},line).along>3000);
 assert.equal(JR.project(null,line).metres,Infinity);
});
test('selection enforces the chosen corridor, removes outlying places and spreads across the journey',()=>{
 const line=[[0,0],[1,0]],items=Array.from({length:25},(_,n)=>({name:'start '+n,coord:{lat:0,lon:n*.00001}}));
 items.push({name:'middle',coord:{lat:0,lon:.5}},{name:'end',coord:{lat:0,lon:1}},{name:'away',coord:{lat:.1,lon:.5}});
 const found=JR.within({coordinates:line,items},400),picked=JR.select(found,3);
 assert.deepEqual(picked.map(p=>p.name),['start 0','middle','end']);assert.equal(found.some(p=>p.name==='away'),false);assert.equal(JR.select(found,20).length,20);assert.equal(new Set(JR.select(found,20).map(p=>p.name)).size,20);
});
test('prepared route starts in Tideswell and ends in Buxton, has attributed sources, and retains useful 400 m suggestions',()=>{
 require('../route-test-data');const p=globalThis.DiscoverRouteTest;
 const last=p.coordinates.at(-1);assert.ok(Math.abs(last[0]+1.914)<.003&&Math.abs(last[1]-53.259)<.003);
 const first=p.coordinates[0];assert.ok(Math.abs(first[0]+1.77389)<.003&&Math.abs(first[1]-53.27794)<.003);
 assert.equal(p.id,'route-tideswell-buxton-v1');assert.ok(p.distanceM>12000&&p.distanceM<18000);
 const items=JR.within(p,400);assert.ok(items.length>=8);
 for(const i of items){assert.match(i.source.url,/^https:\/\/en.wikipedia.org\/wiki\//);assert.ok(i.reason.length>60);assert.ok(i.route.metres<=400);}
});
