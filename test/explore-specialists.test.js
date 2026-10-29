'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createExploreService,mergeSpecialists}=require('../explore-service');
const cfg=require('../explore-config.json');
const image={id:'File:Play.jpg',url:'https://upload.wikimedia.org/play.jpg',creator:'Photographer',license:'CC BY 4.0',sourceUrl:'https://commons.wikimedia.org/wiki/File:Play.jpg'};
function pool(){return {location:{label:'Test Town',mode:'area',overview:'A town with gardens and walking trails.'},radiusKm:12,warnings:[],candidates:[
{id:'f',name:'Discovery Garden',text:'The garden offers a playground and activities for children with their families.',theme:'nature',coord:{lat:50,lon:0},distanceKm:1,imageFile:'Play.jpg',image,source:{title:'Garden',url:'https://en.wikipedia.org/wiki/Garden'}},
{id:'w',name:'Valley Trail',text:'The circular walking trail follows the valley on a documented six kilometre route.',theme:'nature',coord:{lat:50,lon:0},distanceKm:2,source:{title:'Trail',url:'https://en.wikipedia.org/wiki/Trail'}},
{id:'b',name:'Old Museum',text:'This family-owned museum stands within walking distance of the railway station.',theme:'culture',coord:{lat:50,lon:0},distanceKm:1,source:{title:'Museum',url:'https://en.wikipedia.org/wiki/Museum'}}]};}
const pick=(c,role)=>({id:c.id,section:role,reason:role==='family'?'Discover the playground and activities for children.':'Follow the documented circular walking trail through the valley.',evidence:c.text,familySuitable:true,confidence:.9,visitorValue:4,imageId:c.image?.id});
test('specialists nominate independently, retain only matching images, and reject irrelevant evidence',()=>{
 const p=pool();const merged=mergeSpecialists({overview:'',items:[]},[{role:'family',answer:{choices:[pick(p.candidates[0],'family'),pick(p.candidates[2],'family')]}},{role:'walks',answer:{choices:[pick(p.candidates[1],'walks'),pick(p.candidates[2],'walks')]}}],p,cfg);
 assert.deepEqual(merged.items.map(x=>x.section),['family','walks']);assert.equal(merged.items[0].image.id,image.id);
 const bad=pick(p.candidates[0],'family');bad.imageId='another-venue';assert.equal(mergeSpecialists({items:[]},[{role:'family',answer:{choices:[bad]}}],p,cfg).items[0].image,null);
 assert.equal(mergeSpecialists({items:merged.items},[{role:'family',answer:{choices:[pick(p.candidates[0],'family')]}}],p,cfg).items.length,2);
 assert.equal(mergeSpecialists({items:[]},[{role:'family',answer:{choices:[pick(p.candidates[0],'family')]}}],p,{...cfg,maxResults:0}).items.length,0);
});
test('trial makes three bounded reviews in parallel, caches separately and tolerates specialist failure',async()=>{
 const calls=[];const p=pool();let release;const gate=new Promise(r=>release=r);
 const svc=createExploreService({provider:{resolve:async()=>p.location,collect:async()=>pool(),images:async()=>new Map([['Play.jpg',image]])},aiWriter:async compact=>{calls.push(compact.role);if(compact.role==='main')return {choices:[]};await gate;if(compact.role==='walks')throw Error('timeout');return {choices:[pick(p.candidates[0],'family')]}}});
 const pending=svc.explore({place:'Test Town'},{specialists:true});
 await new Promise(r=>setImmediate(r));assert.deepEqual(calls,['main','family','walks']);release();
 const result=await pending;assert.ok(result.items.some(x=>x.section==='family'));assert.equal(result.specialistStatus.walks,'unavailable');
 await svc.explore({place:'Test Town'},{specialists:true});assert.equal(calls.length,3);
 await svc.explore({place:'Test Town'});assert.equal(calls.length,4);
});
test('specialists share the existing hourly call budget',async()=>{
 let calls=0;const p=pool();const svc=createExploreService({provider:{resolve:async()=>p.location,collect:async()=>pool(),images:async()=>new Map()},config:{maxAiCallsPerHour:1},aiWriter:async()=>{calls++;return {choices:[]}}});
 const result=await svc.explore({place:'Test Town'},{specialists:true});assert.equal(calls,1);assert.equal(result.specialistStatus.family,'unavailable');
});
