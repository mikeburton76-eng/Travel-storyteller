'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {nearbyEvents}=require('../explore-events'),{fallbackSelection}=require('../explore-service'),cfg=require('../explore-config.json');
const location={label:'Buxton',lat:53.259,lon:-1.914};
test('organiser dates need a current matching year and are never rolled forward',async()=>{
 const options={now:()=>Date.parse('2026-10-29T12:00Z'),fetchImpl:async()=>({ok:true,text:async()=>'<p>7 &ndash; 25 July 2027</p>'})};
 const dates=await nearbyEvents(location,6,options);assert.equal(dates.length,2);assert.equal(dates[0].eventTiming.start,'2027-07-07');assert.match(dates[0].eventTiming.sourceUrl,/buxtonfestival/);
 const stale=await nearbyEvents(location,6,{...options,now:()=>Date.parse('2028-01-01T12:00Z')});assert.ok(stale.every(c=>c.eventTiming===null));
 const wrongYear=await nearbyEvents(location,6,{...options,fetchImpl:async()=>({ok:true,text:async()=>'<p>7–25 July 2026</p>'})});assert.ok(wrongYear.every(c=>c.eventTiming===null));
});
test('unavailable organiser pages keep events with unconfirmed dates; source-based guides populate What’s on',async()=>{
 const records=await nearbyEvents(location,6,{fetchImpl:async()=>{throw Error('timeout')}});assert.ok(records.every(c=>c.eventTiming===null));
 const p={location,candidates:records.map((c,i)=>({...c,id:'event-'+i,distanceKm:.2}))};const r=fallbackSelection(p,cfg);
 assert.equal(r.items.length,2);assert.ok(r.items.every(c=>c.section==='events'&&c.eventArea&&c.eventTiming===null));
 assert.equal((await nearbyEvents({lat:40,lon:-70},6,{fetchImpl:async()=>{throw Error('Must not request unrelated events')}})).length,0);
});
test('refreshing organiser dates does not pay for another unchanged AI summary',async()=>{
 const {createExploreService}=require('../explore-service');let now=0,calls=0,end='2027-07-25';
 const candidate=()=>({id:'festival',name:'Town Festival',eventArea:true,eventTiming:{start:'2027-07-07',end,checkedAt:new Date(now).toISOString()},text:'An annual arts festival with music and performances across the town.',coord:{lat:51,lon:0},distanceKm:0,theme:'culture',source:{title:'Organiser',url:'https://example.org/'}});
 const svc=createExploreService({now:()=>now,config:{cacheMinutes:1},provider:{resolve:async()=>({label:'Town',mode:'area',lat:51,lon:0}),collect:async location=>({location,candidates:[candidate()],warnings:[],radiusKm:6}),images:async()=>new Map()},aiWriter:async()=>{calls++;return {choices:[{id:'festival',section:'events',reason:'Explore music and performances at this annual arts festival.',evidence:candidate().text,familySuitable:true,confidence:.9,visitorValue:4}]}}});
 await svc.explore({place:'Town'});now=61000;end='2027-07-26';const refreshed=await svc.explore({place:'Town'});assert.equal(calls,1);assert.equal(refreshed.items[0].eventTiming.end,'2027-07-26');
});
