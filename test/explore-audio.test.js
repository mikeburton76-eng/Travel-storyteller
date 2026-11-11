'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const DriveLogic=require('../drive-logic');

test('Explore uses the shared opening and speaks fresh source details before requesting another story',async()=>{
 const nodes=new Map(),requests=[],spoken=[];
 const makeNode=()=>({events:{},addEventListener(name,callback){this.events[name]=callback;},replaceChildren(){},pause(){},load(){},removeAttribute(){}});
 const document={createElement:makeNode,getElementById(id){if(!nodes.has(id))nodes.set(id,makeNode());return nodes.get(id);}};
 class NarrationPlayer{
  static supported=true;
  constructor({onState}){this.onState=onState;}
  stop(){}
  prime(){}
  async start(text){spoken.push(text);this.onState('idle','Finished.');}
 }
 const item={id:'observatory',name:'The observatory',title:'The observatory',reason:'The observatory sits on a hill overlooking the town.',background:'The observatory was the first in the region to open to the public. The dome is made of copper and turns on a circular track.'};
 const context=vm.createContext({document,window:{addEventListener(){}},DriveLogic,NarrationPlayer,AbortController,setTimeout,clearTimeout,
  fetch:async url=>{requests.push(url);return {ok:true,json:async()=>({defaultVoice:'pippa'})};}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../explore-audio.js'),'utf8'),context);
 context.ExploreNarration.listen(item,{label:'Example town',mode:'area'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(spoken,[DriveLogic.narration(item,{nearby:false})]);
 assert.match(spoken[0],/first in the region/);
 assert.doesNotMatch(spoken[0],/you’re near|did you know/i);
 await nodes.get('storyMore').events.click();
 assert.match(spoken[1],/The dome is made of copper/);
 assert.doesNotMatch(spoken[1],/first in the region/);
 assert.deepEqual(requests,['/voices']);
});
