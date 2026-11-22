const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('Explore starts the chosen phone voice synchronously without fetching server settings or audio',()=>{
 const elements=new Map(),requests=[],spoken=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,disabled:false,textContent:'',listeners:{},addEventListener(name,fn){this.listeners[name]=fn},replaceChildren(){},pause(){},load(){},removeAttribute(){},getAttribute(){return null}});return elements.get(id)};
 const context={document:{getElementById:element,createElement:()=>({})},window:{addEventListener(){}},fetch:(...args)=>{requests.push(args);throw Error('Phone playback must not fetch')},DiscoverNarrator:{get:()=>({provider:'phone',voice:{name:'Kate',lang:'en-GB'}}),ready:()=>{throw Error('Phone playback must not wait for server configuration')},stop(){},speak(text,callbacks){spoken.push(text);callbacks.onProgress();callbacks.onTiming('Kate',0.01)}},DriveLogic:{narration:()=> 'The Crescent opened in October twenty twenty.'},URL,AbortController,setTimeout,clearTimeout,localStorage:{getItem:()=>null}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../explore-audio.js'),'utf8'),context);
 assert.equal(requests.length,0);
 context.ExploreNarration.listen({id:'crescent',name:'Crescent',title:'Crescent'},{label:'Buxton'});
 assert.equal(spoken.length,1);
 assert.equal(requests.length,0);
 assert.match(element('storyVoice').textContent,/Kate/);
 assert.equal(element('storyStatus').textContent,'Reading aloud…');
});

test('Full story joins three parts, reuses them, and Quick story starts at the opening again',async()=>{
 const nodes=new Map(),spoken=[],requests=[];
 const element=id=>{if(!nodes.has(id))nodes.set(id,{listeners:{},addEventListener(k,f){this.listeners[k]=f;},replaceChildren(){},pause(){},load(){},removeAttribute(){}});return nodes.get(id);};
 let full=true,release;
 const context={document:{getElementById:element,createElement:()=>({})},window:{addEventListener(){}},
  DiscoverNarrator:{get:()=>({provider:'phone',voice:{name:'Kate'}}),fullStory:()=>full,stop(){},speak(text,callbacks){spoken.push(text);callbacks.onEnd();}},
  DriveLogic:{narration:()=> 'Opening.',followUp:(item,previous)=>item.hasMiddle!==false&&previous==='Opening.'?'Middle.':''},
  fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:()=>new Promise(resolve=>{release=resolve;})};},
  AbortController,setTimeout,clearTimeout};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../explore-audio.js'),'utf8'),context);
 const place={id:'one',name:'One',title:'One'},area={label:'Town'},tick=()=>new Promise(r=>setImmediate(r));
 context.ExploreNarration.listen(place,area);await tick();release({story:'Ending.',complete:true});await tick();
 assert.deepEqual(spoken,['Opening. Middle. Ending.']);assert.deepEqual(requests[0].previousStories,['Opening.','Middle.']);
 element('storyReplay').listeners.click();assert.equal(spoken.at(-1),'Opening. Middle. Ending.');
 full=false;context.ExploreNarration.listen(place,area);assert.equal(spoken.at(-1),'Opening.');
 await element('storyMore').listeners.click();assert.equal(spoken.at(-1),'Middle.');assert.equal(requests.length,1);
 full=true;context.ExploreNarration.listen({...place,id:'two'},area);await tick();context.ExploreNarration.stop();release({story:'Late.'});await tick();
 assert.equal(spoken.at(-1),'Middle.');
 for(const [id,hasMiddle,reply,expected] of [
  ['opening-only',false,{story:'',complete:true},'Opening.'],
  ['two-parts',true,{story:'',complete:true},'Opening. Middle.'],
  ['duplicate',false,{story:'Opening.'},'Opening.'],
  ['offline',true,null,'Opening. Middle.']
 ]){
  const before=spoken.length;
  if(reply===null)context.fetch=async()=>{throw Error('Offline');};
  context.ExploreNarration.listen({...place,id,hasMiddle},area);await tick();
  if(reply!==null){release(reply);await tick();}
  assert.deepEqual(spoken.slice(before),[expected],id);
 }
});
