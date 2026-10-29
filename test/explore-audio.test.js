'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function setup(storyFetch){
 const nodes={},calls=[],events={},players=[];
 const element=()=>({hidden:false,disabled:false,events:{},children:[],textContent:'',addEventListener(k,f){this.events[k]=f},replaceChildren(...c){this.children=c},pause(){},load(){},removeAttribute(k){delete this[k]},getAttribute(k){return this[k]}});
 const document={getElementById:id=>nodes[id]??=element(),createElement:()=>element()};
 class Player{static supported=true;constructor(options){this.options=options;players.push(this)}prime(){calls.push({url:'prime'});return true}stop(){calls.push({url:'stop'})}async start(text,voice){calls.push({url:'audio',text,voice});this.options.onState('speaking','Reading aloud…')}pause(){this.options.onState('paused','Paused.')}resume(){this.options.onState('speaking','Reading aloud…')}finish(){this.options.onState('idle','Finished.')}}
 const context=vm.createContext({document,window:{addEventListener:(key,f)=>events[key]=f},NarrationPlayer:Player,localStorage:{getItem:()=>null},AbortController,setTimeout,clearTimeout,URL,fetch:async(url,options)=>{calls.push({url,options});if(url==='/voices')return {ok:true,json:async()=>({defaultVoice:'fixed',voices:{fixed:'Southern English Female'}})};return storyFetch(url,options)}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../explore-audio.js'),'utf8'),context);
 return {nodes,calls,players,events,run:source=>vm.runInContext(source,context)};
}
const item={id:'garden',name:'Town Gardens',title:'Town Gardens',reason:'A riverside garden with paths and unusual trees.',source:{kind:'wikipedia',title:'Town Gardens'}};
const tick=()=>new Promise(r=>setImmediate(r));
test('Listen primes phone audio on the tap, reads the existing summary and makes no paid story request',async()=>{
 const a=setup(()=>{throw Error('No story request expected')});a.run('ExploreNarration.listen('+JSON.stringify(item)+',{label:"Sample Town"})');
 assert.ok(a.calls.some(c=>c.url==='prime'));await tick();assert.equal(a.calls.filter(c=>c.url==='/story').length,0);assert.equal(a.calls.find(c=>c.url==='audio').text,item.reason);assert.equal(a.nodes.storyPlayer.hidden,false);
 assert.equal(a.nodes.storyText.children[0].textContent,item.reason);assert.equal(a.nodes.storyMore.disabled,true);a.players[0].finish();assert.equal(a.nodes.storyMore.disabled,false);
 a.nodes.storyPause.events.click();assert.equal(a.nodes.storyResume.disabled,false);a.nodes.storyResume.events.click();assert.equal(a.nodes.storyPause.disabled,false);
 a.events.pagehide();assert.equal(a.nodes.storyPause.disabled,true);
});
test('Tell me more sends current chapters and speaks only the new part',async()=>{
 const a=setup(async()=>({ok:true,json:async()=>({story:'The gardens developed around a riverside collection of trees.',complete:false})}));
 a.run('ExploreNarration.listen('+JSON.stringify(item)+',{label:"Sample Town"})');await tick();a.players[0].finish();await a.nodes.storyMore.events.click();
 const request=a.calls.find(c=>c.url==='/story');const body=JSON.parse(request.options.body);assert.deepEqual(body.previousStories,[item.reason]);assert.match(body.place,/Town Gardens/);
 assert.equal(a.calls.filter(c=>c.url==='audio').at(-1).text,'The gardens developed around a riverside collection of trees.');assert.equal(a.nodes.storyText.children.length,2);
});
test('switching cards ignores an older More response and resets stop pending work',async()=>{
 let resolve;const a=setup(()=>new Promise(r=>resolve=r));a.run('ExploreNarration.listen('+JSON.stringify(item)+',{label:"Sample Town"})');await tick();a.players[0].finish();const pending=a.nodes.storyMore.events.click();
 a.run('ExploreNarration.listen('+JSON.stringify({...item,id:'museum',name:'Museum',title:'Museum',reason:'A local museum with an interesting collection.'})+',{label:"Sample Town"})');await tick();resolve({ok:true,json:async()=>({story:'Old result that must be ignored.'})});await pending;
 assert.equal(a.nodes.storyName.textContent,'Museum');assert.equal(a.nodes.storyText.children.length,1);assert.ok(!a.calls.some(c=>c.url==='audio'&&c.text.includes('Old result')));
 a.run('ExploreNarration.reset()');assert.equal(a.nodes.storyPlayer.hidden,true);
});

test('phone narrator uses the selected device voice without calling the Piper endpoint',async()=>{
 const a=setup(()=>{throw Error('No paid request expected')});a.run(`globalThis.DiscoverNarrator={ready:async()=>{},get:()=>({provider:'phone',uri:'phone-test'})};globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};globalThis.speechSynthesis={getVoices:()=>[{voiceURI:'phone-test',lang:'en-GB',name:'Test voice'}],speak:u=>{globalThis.lastPhoneUtterance=u;u.onstart()},cancel:()=>{},pause:()=>{},resume:()=>{}};ExploreNarration.listen(${JSON.stringify(item)},{label:'Sample Town'})`);await tick();assert.equal(a.run('lastPhoneUtterance.text'),item.reason);assert.equal(a.run('lastPhoneUtterance.voice.voiceURI'),'phone-test');assert.ok(!a.calls.some(c=>c.url==='audio'));a.nodes.storyPause.events.click();assert.equal(a.nodes.storyResume.disabled,false);a.nodes.storyResume.events.click();assert.equal(a.nodes.storyPause.disabled,false);a.run('lastPhoneUtterance.onend()');assert.equal(a.nodes.storyReplay.disabled,false);
});
