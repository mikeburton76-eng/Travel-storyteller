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
