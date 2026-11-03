'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('../drive-logic');
const fix=(extra={})=>({lat:0,lon:0,accuracy:3,speed:0,heading:null,time:10000,...extra});
test('stopping holds the last heading and ignores noisy stationary compass readings',()=>{
 for(const heading of [null,180,359])assert.deepEqual(L.motion(fix({heading}),fix({time:9000}),90),{speed:0,heading:90,stationary:true});
 assert.equal(L.motion(fix(),fix({time:9000})),null);
});
test('quiet fixes with missing speed can retain a known direction, but poor GPS cannot',()=>{
 assert.equal(L.motion(fix({speed:null}),fix({time:9000}),90).heading,90);
 assert.equal(L.motion(fix({accuracy:200}),fix({time:9000}),90),null);
 assert.equal(L.motion(fix({speed:10}),null,90),null);
});
test('real movement replaces the held direction, including an inferred reversal',()=>{
 assert.equal(L.motion(fix({speed:10,heading:270}),null,90).heading,270);
 const inferred=L.motion(fix({lon:-.001,speed:null}),fix({time:0}),90);assert.equal(inferred.heading,270);assert.ok(!inferred.stationary);
});
test('a stopped car can retain a place ahead without inventing an arrival time',()=>{
 const movement=L.motion(fix(),fix({time:9000}),90),item={id:'ahead',coord:{lat:0,lon:.003}};
 const candidate=L.approaching(item,fix(),movement);assert.equal(candidate.trigger,true);assert.equal(candidate.eta,null);
 assert.equal(L.approaching({...item,coord:{lat:0,lon:-.003}},fix(),movement),null);
});
