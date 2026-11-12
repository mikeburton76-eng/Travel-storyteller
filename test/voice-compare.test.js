const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createComparison,samples}=require('../voice-compare-service');
const input={sample:'numbers',voice:'en-GB-Neural2-F'};
test('missing configuration never calls Google or exposes credentials',async()=>{
 let calls=0;const service=createComparison({readKey:()=>'',fetchImpl:()=>calls++});
 assert.equal(service.config().configured,false);
 await assert.rejects(service.generate(input),{status:503});assert.equal(calls,0);
});
test('fixed samples and voice allowlist reject arbitrary billed input',async()=>{
 const service=createComparison({readKey:()=> 'secret'});
 for(const bad of [{...input,sample:'constructor'},{...input,voice:'unknown'},null])await assert.rejects(service.generate(bad),{status:400});
});
test('sends the exact same sample, securely authenticated, and decodes audio',async()=>{
 const service=createComparison({readKey:()=> 'secret',fetchImpl:async(url,options)=>{
 assert.equal(url,'https://texttospeech.googleapis.com/v1/text:synthesize');assert.equal(options.headers['X-Goog-Api-Key'],'secret');
 const body=JSON.parse(options.body);assert.equal(body.input.text,samples.numbers);assert.equal(body.voice.name,input.voice);assert.equal(body.audioConfig.speakingRate,1);
 return {ok:true,json:async()=>({audioContent:Buffer.from('audio').toString('base64')})};
 }});
 assert.equal((await service.generate(input)).toString(),'audio');assert.equal(JSON.stringify(service.config()).includes('secret'),false);
});
test('no provider error contents leak and busy state recovers',async()=>{
 let fail=true;const service=createComparison({readKey:()=> 'secret',fetchImpl:async()=>fail?{ok:false,status:403}:{ok:true,json:async()=>({audioContent:'YQ=='})}});
 await assert.rejects(service.generate(input),{status:502});fail=false;assert.equal((await service.generate(input)).toString(),'a');
});
test('concurrent requests blocked; hourly test cap and reset',async()=>{
 let resolve,time=0,calls=0;const service=createComparison({readKey:()=> 'secret',now:()=>time,fetchImpl:async()=>{calls++;if(calls===1)await new Promise(r=>resolve=r);return{ok:true,json:async()=>({audioContent:'YQ=='})};}});
 const pending=service.generate(input);await assert.rejects(service.generate(input),{status:429});resolve();await pending;
 for(let i=1;i<20;i++)await service.generate(input);
 await assert.rejects(service.generate(input),{status:429});time=3600000;await service.generate(input);
});
const vm=require('node:vm'),fs=require('node:fs');
test('device voice stays in tap handler; stop cancels and stale events cannot overwrite status',async()=>{
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{value:id==='sample'?'numbers':'',textContent:'',disabled:false,replaceChildren(...v){this.options=v;if(!this.value)this.value=v[0]?.value||'';},pause(){},load(){},removeAttribute(){}});return elements.get(id);};
 let spoken,cancelled=0;
 const synth={getVoices:()=>[{name:'Kate',lang:'en-GB',voiceURI:'kate',localService:true}],addEventListener(){},cancel(){cancelled++;},speak(u){spoken=u;}};
 const context={document:{getElementById:el,createElement:()=>({})},window:{speechSynthesis:synth,addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},SpeechSynthesisUtterance:function(text){this.text=text;},performance,Date,setTimeout,clearTimeout,AbortController,URL,fetch:async()=>({ok:true,json:async()=>({configured:false,samples})})};
 vm.runInNewContext(fs.readFileSync(require.resolve('../voice-compare.js'),'utf8'),context);
 await new Promise(r=>setImmediate(r));
 assert.equal(el('phonePlay').disabled,false);assert.equal(el('googlePlay').disabled,true);
 el('phonePlay').onclick();assert.equal(spoken.text,samples.numbers);assert.equal(spoken.voice.name,'Kate');
 const staleStart=spoken.onstart;el('stop').onclick();staleStart();assert.equal(el('status').textContent,'Stopped.');assert.ok(cancelled>=2);
});
