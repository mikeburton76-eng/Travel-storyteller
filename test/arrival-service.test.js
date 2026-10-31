'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createArrivalService,profile}=require('../arrival-service');
const page={pageid:42,title:'Exampletown',description:'Town in Australia',coordinates:[{lat:-33,lon:151}],extract:'Exampletown is a town in Australia. It is famous for its historic harbour and sandstone waterfront. The town was founded in 1820 as a trading port. The population was 4,100 at the 2021 census.'};
test('arrival leads with its distinctive feature, preserves dated facts and reviews yearly',()=>{
 const item=profile(page,Date.parse('2026-10-31T12:00:00Z'));
 assert.match(item.reason,/You’re near Exampletown\. It is famous/);
 assert.match(item.reason,/founded in 1820/);assert.match(item.reason,/4,100 at the 2021 census/);
 assert.equal(item.reviewAfter,'2027-10-31T12:00:00.000Z');assert.equal(item.arrivalRadiusM,1400);
 assert.equal(item.audioKey,profile(page).audioKey);
 assert.equal(profile({...page,description:'Museum in a town in Australia'}),null);
 assert.equal(profile({...page,coordinates:[{lat:99,lon:151}]}),null);
 assert.equal(profile({...page,extract:''}),null);
});
test('worldwide lookup reuses an annual introduction and refreshes it when next used after expiry',async()=>{
 let clock=Date.parse('2026-10-31T12:00:00Z'),sourceReads=0;const urls=[];
 const service=createArrivalService({now:()=>clock,fetchImpl:async raw=>{
  const u=new URL(raw);urls.push(u);const full=u.searchParams.has('pageids');if(full)sourceReads++;
  return {ok:true,json:async()=>({query:{pages:full?[page]:[page,{...page,pageid:99,description:'Museum in a town'}]}})};
 }});
 let result=await service.lookup({lat:-33,lon:151});assert.equal(result.items.length,1);assert.equal(sourceReads,1);
 clock+=31*86400000;result=await service.lookup({lat:-33,lon:151});assert.equal(sourceReads,1);
 clock=Date.parse('2027-10-31T12:00:01Z');result=await service.lookup({lat:-33,lon:151});assert.equal(sourceReads,2);
 assert.equal(result.items[0].reviewAfter,'2028-10-31T12:00:01.000Z');
 assert.ok(urls.every(u=>u.hostname==='en.wikipedia.org'));
});
test('valid annual profiles held on the phone avoid re-fetching text after a server restart',async()=>{
 let sourceReads=0;
 const service=createArrivalService({fetchImpl:async raw=>{if(new URL(raw).searchParams.has('pageids'))sourceReads++;return {ok:true,json:async()=>({query:{pages:[page]}})};}});
 assert.deepEqual((await service.lookup({place:'Exampletown',known:[42]})).items,[]);assert.equal(sourceReads,0);
 await assert.rejects(service.lookup({lat:91,lon:0}),{status:400});
 await assert.rejects(service.lookup({place:''}),{status:400});
});
test('Tideswell uses the explicitly dated parish statistic with its primary source',()=>{
 const item=profile({...page,pageid:456017,title:'Tideswell',description:'Village in England'});
 assert.match(item.reason,/including Wheston.*1,827.*2011/);
 assert.ok(item.sources.some(s=>s.url.includes('peakdistrict.gov.uk')));
});
