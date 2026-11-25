'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../subject-stories'),P=require('../explore-policy'),drive=require('../drive-logic'),planner=require('../journey-planner');
const {createExploreService}=require('../explore-service');
test('checked stories have distinct identifiers, positions, sources and family-suitable narration',()=>{
 assert.equal(new Set(S.stored.map(s=>s.id)).size,S.stored.length);
 for(const s of S.stored){assert.ok(P.allowed(s.name,s.reason));assert.ok(drive.valid(s.coord));assert.match(s.source.url,/^https:/);assert.ok(drive.narration(s).length>50);}
});
test('an Explore guide returns dated local royal history, without duplicating an existing place or exposing distant records',async()=>{
 const location={label:'Buxton',title:'Buxton',mode:'area',lat:53.259,lon:-1.915};
 const provider={resolve:async()=>location,collect:async()=>({location,radiusKm:3,candidates:[],warnings:[]}),images:async()=>new Map()};
 const service=createExploreService({provider,readKey:()=>null});
 const g=await service.explore({place:'Buxton'});const hall=g.items.find(s=>s.name==='Old Hall Hotel');
 assert.match(hall.reason,/1573 and 1584/);assert.ok(g.items.every(s=>P.distanceKm(location,s.coord)<=3));
 const merged=S.mergeStories([{...hall,reason:'Old hall.',id:'existing-card'}],[hall]);
 assert.equal(merged.length,1);assert.equal(merged[0].id,'existing-card');
});
test('route planner includes the same stories and applies the actual road corridor',async()=>{
 const coord=[[-1.915,53.259],[-1.897,53.259]];
 const fetchImpl=async url=>({ok:true,json:async()=>String(url).includes('routed-car')?{routes:[{distance:1300,duration:120,geometry:{coordinates:coord}}]}:{query:{pages:{}}}});
 const plan=await planner.plan({from:{lat:53.259,lon:-1.915,title:'Buxton'},to:{lat:53.259,lon:-1.897,title:'East'},radiusM:400},{fetchImpl});
 assert.ok(plan.items.some(s=>s.subject==='Royal visits'));assert.ok(plan.items.every(s=>s.route.metres<=400));
});
test('nearby source evidence can identify other locations and archaeological periods',()=>{
 const page={title:'Example Fort',pageid:7,coordinates:[{lat:44,lon:-2}],extract:'Example Fort is an Iron Age hillfort on a rocky ridge. Its banks surround the summit.'};
 assert.equal(S.fromPage(page).subject,'Iron Age archaeology');
 assert.equal(S.fromPage({...page,extract:'The fort was the site of a massacre.'}),null);
 assert.equal(S.fromPage({...page,coordinates:[]}),null);
});
