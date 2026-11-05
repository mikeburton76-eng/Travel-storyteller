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

test('a local fair is included only while its organiser confirms upcoming dates',async()=>{
 const options={
  now:()=>Date.parse('2026-11-05T12:00Z'),
  fetchImpl:async url=>({ok:true,text:async()=>url.includes('autumn-fair')?'Saturday 14th November to Sunday 15th November 2026.':''})
 };
 const records=await nearbyEvents(location,6,options);
 const fair=records.find(c=>c.name==='Autumn Fair at Pavilion Gardens');
 assert.equal(fair.eventTiming.start,'2026-11-14');
 assert.equal(fair.eventTiming.end,'2026-11-15');
 assert.equal(fair.eventTiming.venue,true);
 const result=fallbackSelection({location,candidates:[{...fair,id:'fair',distanceKm:.2}]},cfg);
 assert.equal(result.items[0].section,'events');
 assert.ok(!(await nearbyEvents(location,6,{...options,now:()=>Date.parse('2026-11-16T12:00Z')})).some(c=>c.name===fair.name));
});

test('nearby guides discover dated events from the organiser’s calendar',async()=>{
 const card=(name,slug,day)=>`<div class="event-card-body">
  <div class="event-date-large"><span>${day}</span> Nov</div>
  <h4 class="card-title">${name}</h4>
  <a href="${slug}">View event</a>
 </div>`;
 const html=card('Christmas Market','/events/christmas-market-2026/',22)
  +card('Year missing','/events/indoor-market/',12)
  +card('Past Fair 2026','/events/past-fair/',1)
  +card('External event 2026','https://example.org/events/external/',18);
 const options={
  now:()=>Date.parse('2026-11-05T12:00Z'),
  fetchImpl:async url=>({ok:url==='https://paviliongardens.co.uk/events/',text:async()=>html})
 };
 const records=await nearbyEvents(location,6,options);
 const dated=records.filter(event=>event.eventTiming);
 assert.deepEqual(dated.map(event=>event.name),['Christmas Market']);
 assert.equal(dated[0].eventTiming.start,'2026-11-22');
 assert.equal(dated[0].eventTiming.end,'2026-11-22');
 assert.equal(dated[0].sourceOnly,true);
 assert.equal((await nearbyEvents({lat:40,lon:-70},6,{...options,fetchImpl:()=>assert.fail('Unrelated location')})).length,0);
});
