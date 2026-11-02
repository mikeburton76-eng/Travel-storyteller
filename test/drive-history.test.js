'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDriveHistory}=require('../drive-history');
const item={id:'crescent',name:'Buxton Crescent',source:{url:'https://en.wikipedia.org/wiki/Buxton_Crescent'}};
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
test('daily listening survives reloads and becomes available on the next local calendar day',()=>{
 const storage=memory();let date=new Date(2026,10,2,23,59);let h=createDriveHistory({storage,now:()=>date});assert.equal(h.check(item).allowed,true);h.record(item);
 h=createDriveHistory({storage,now:()=>date});assert.equal(h.check(item).reason,'Already heard today');date=new Date(2026,10,3,0,1);assert.equal(h.check(item).allowed,true);
});
test('the ten-play option is off by default and survives reload when enabled',()=>{
 const storage=memory();let day=1;const now=()=>new Date(2026,10,day,12);let h=createDriveHistory({storage,now});
 for(day=1;day<=10;day++)h.record(item);assert.equal(h.check(item).allowed,true);h.setSkipFamiliar(true);h=createDriveHistory({storage,now});assert.equal(h.check(item).reason,'Heard ten times');h.setSkipFamiliar(false);assert.equal(h.check(item).allowed,true);
});
test('one explicit replay overrides both limits once without erasing the accumulated count',()=>{
 let day=1;const h=createDriveHistory({storage:memory(),now:()=>new Date(2026,10,day,12)});for(day=1;day<=10;day++)h.record(item);h.setSkipFamiliar(true);const key=h.key(item);h.allowOnce(key);assert.equal(h.check(item).allowed,true);h.record(item);assert.equal(h.snapshot().places[0].count,11);assert.equal(h.check(item).allowed,false);day++;assert.equal(h.check(item).reason,'Heard ten times');h.clear();assert.equal(h.check(item).allowed,true);assert.equal(h.snapshot().skipFamiliar,true);
});
test('arrival and landmark versions of the same source share their history across audio refreshes',()=>{
 const h=createDriveHistory({storage:memory()});h.record(item);const arrival={...item,id:'arrival:new',audioKey:'new-recording',kind:'arrival',source:{url:'https://en.wikipedia.org/wiki/Buxton%20Crescent#History'}};assert.equal(h.check(arrival).allowed,false);
 assert.equal(h.check({...item,source:{url:'https://en.wikipedia.org/wiki/Another_Place'}}).allowed,true);
});
test('blocked storage warns once and retains protection for the open page',()=>{
 const warnings=[],h=createDriveHistory({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}},onWarning:m=>warnings.push(m)});h.record(item);assert.equal(h.check(item).allowed,false);assert.equal(warnings.length,1);
});
