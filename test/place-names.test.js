'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {nearbyNames}=require('../place-names');
const {fallbackSelection}=require('../explore-service');
const cfg=require('../explore-config.json');
test('geographic name stories retain source, position and uncertainty; nearby namesakes of another subject are skipped',async()=>{
 const coord={lat:52,lon:0};
 const page={pageid:123,title:'Lime Square',coordinates:[coord],description:'public square',extract:'Lime Square is a public square in the city centre. The square was named after a local orchard, according to local tradition.'};
 const result=await nearbyNames(coord,5,async()=>({ok:true,json:async()=>({query:{pages:{1:page,2:{...page,pageid:124,title:'Forest Park',extract:'Forest Park is a city park. A nearby road was named after the park.'},3:{...page,pageid:125,coordinates:[{lat:54,lon:2}]}}}})}));
 assert.deepEqual(result.map(c=>c.name),['Lime Square']);
 const pool={location:coord,candidates:result};
 const guide=fallbackSelection(pool,cfg);
 const story=guide.items.find(x=>x.name===page.title);
 assert.match(story.reason,/according to local tradition/);
 assert.equal(story.source.url,'https://en.wikipedia.org/?curid=123');
});
