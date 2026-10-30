'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('return points are tab-local, expire after a day, and tolerate blocked storage',()=>{
 const values=new Map();let time=100;class Clock extends Date{static now(){return time;}}
 const context={Date:Clock,sessionStorage:{setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../return-state.js'),'utf8'),context);const s=context.DiscoverReturnState;s.save('food',{area:'Tideswell'});assert.equal(s.load('food').area,'Tideswell');assert.equal(values.size,1);time+=86400001;assert.equal(s.load('food'),null);context.sessionStorage.getItem=()=>{throw Error('Blocked')};context.sessionStorage.setItem=()=>{throw Error('Blocked')};assert.doesNotThrow(()=>s.save('food',{}));assert.equal(s.load('food'),null);
});
