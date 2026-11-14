'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const daniel={name:'Daniel',lang:'en-GB',voiceURI:'daniel',localService:true},kate={name:'Kate (Enhanced)',lang:'en-GB',voiceURI:'kate-plus',localService:true},karen={name:'Karen',lang:'en-AU',voiceURI:'karen',localService:true};
function setup({initial={},list=[kate,daniel,karen]}={}){
 const stored=new Map(Object.entries(initial)),nodes=new Map(),timers=new Map(),spoken=[],events={};let calls=0,cancelled=0,id=0;
 class Option{constructor(text,value){this.textContent=text;this.value=value;}}
 const node=()=>({options:[],value:'',textContent:'',replaceChildren(...opts){this.options=opts;},add(option){this.options.push(option);}});
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);}};
 const synth={getVoices:()=>list,speak:u=>spoken.push(u),cancel:()=>cancelled++,resume(){},addEventListener:(name,fn)=>events[name]=fn};
 const context={document,Option,SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},speechSynthesis:synth,performance:{now:()=>100},localStorage:{getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)},fetch:async()=>{calls++;return {ok:true,json:async()=>({defaultVoice:'pippa'})};},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(fs.readFileSync(require.resolve('../narrator-settings.js'),'utf8'),context);
 return {context,api:context.DiscoverNarrator,nodes,stored,spoken,timers,events,setVoices:v=>{list=v;events.voiceschanged();},get requests(){return calls;},get cancelled(){return cancelled;}};
}
test('defaults to Daniel, offers Kate, and does not fetch Pippa configuration for phone playback',async()=>{
 const a=setup();assert.equal(a.api.get().name,'Daniel');assert.ok(a.nodes.get('narratorChoice').options.some(o=>o.value==='phone:kate-plus'));await a.api.ready();a.nodes.get('narratorPreview').onclick();assert.equal(a.spoken.length,1);assert.equal(a.requests,0);assert.equal(a.spoken[0].rate,1);a.spoken[0].onstart();assert.match(a.nodes.get('narratorMessage').textContent,/Daniel started/);a.spoken[0].onend();assert.equal(a.timers.size,0);
});
test('personal voice selection survives reload and delayed voice lists without switching to Pippa',()=>{
 const a=setup();a.nodes.get('narratorChoice').value='phone:kate-plus';a.nodes.get('narratorChoice').onchange();const b=setup({initial:Object.fromEntries(a.stored),list:[]});assert.equal(b.api.get().provider,'phone');assert.equal(b.api.get().voice,undefined);b.setVoices([daniel,kate]);assert.equal(b.api.get().name,'Kate (Enhanced)');assert.equal(b.requests,0);
});
test('old Pippa default migrates to phone once, but a new explicit Pippa selection is retained',async()=>{
 const a=setup({initial:{'discoverPlaces.narrator':'piper'}});assert.equal(a.api.get().provider,'phone');a.nodes.get('narratorChoice').value='piper';a.nodes.get('narratorChoice').onchange();await a.api.ready();await a.api.ready();assert.equal(a.requests,1);const b=setup({initial:Object.fromEntries(a.stored)});assert.equal(b.api.get().provider,'piper');
});
test('selection locks during a journey and missing voice errors never silently substitute another narrator',()=>{
 const a=setup();a.api.setLocked(true);a.nodes.get('narratorChoice').value='phone:karen';a.nodes.get('narratorChoice').onchange();assert.equal(a.api.get().name,'Daniel');const b=setup({initial:{'discoverPlaces.narrator':'phone:missing'}});let error;b.api.speak('hello',{onError:m=>error=m});assert.match(error,/unavailable/);assert.equal(b.spoken.length,0);assert.equal(b.requests,0);
});
test('speech startup times out clearly and cancelling prevents stale callbacks',()=>{
 const a=setup();let starts=0,errors=[];a.api.speak('one',{onProgress:()=>starts++,onError:e=>errors.push(e)});const old=a.spoken[0];a.api.speak('two',{onProgress:()=>starts++,onError:e=>errors.push(e)});old.onstart();old.onend();assert.equal(starts,0);assert.equal(a.timers.size,1);[...a.timers.values()][0]();assert.match(errors[0],/did not start/);assert.equal(a.timers.size,0);
});
