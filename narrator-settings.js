'use strict';
(()=>{
 const el=id=>document.getElementById(id),select=el('narratorChoice'),key='discoverPlaces.narrator';
 let preferred='auto-phone',locked=false,active=null,generation=0,serverPromise;const listeners=[];
 try{const previous=localStorage.getItem(key);preferred=previous&&previous!=='piper'?previous:localStorage.getItem('discoverPlaces.voiceChoiceV2')==='yes'&&previous==='piper'?'piper':'auto-phone';}catch{}
 const voices=()=>globalThis.speechSynthesis?.getVoices()||[];
 const rank=v=>/^en[-_]GB$/i.test(v.lang)&&/\bDaniel\b/i.test(v.name)?0:/^en[-_]GB$/i.test(v.lang)&&/\bKate\b/i.test(v.name)?1:/^en[-_]GB$/i.test(v.lang)?2:/^en[-_]/i.test(v.lang)?3:4;
 function get(){if(preferred==='piper')return {provider:'piper',name:'Pippa'};const list=voices().slice().sort((a,b)=>rank(a)-rank(b)||Number(b.localService)-Number(a.localService)||a.name.localeCompare(b.name));const voice=preferred==='auto-phone'?list[0]:list.find(v=>v.voiceURI===preferred.slice(6));return {provider:'phone',uri:voice?.voiceURI,voice,name:voice?.name||'Phone voice unavailable',local:voice?.localService===true};}
 function load(){if(!select)return;select.replaceChildren(new Option('Automatic phone voice · Daniel / Kate first','auto-phone'));for(const v of voices().slice().sort((a,b)=>rank(a)-rank(b)||a.name.localeCompare(b.name)))select.add(new Option(v.name+' · '+v.lang+(v.localService?' · on device':' · may need internet'),'phone:'+v.voiceURI));select.add(new Option('Pippa · server voice (slower preparation)','piper'));if(![...select.options].some(o=>o.value===preferred))select.add(new Option('Saved voice unavailable · choose another',preferred));select.value=preferred;select.disabled=locked;el('narratorPreview').disabled=locked;const p=get();el('narratorLabel').textContent='Voice: '+p.name+' ▾';el('narratorMessage').textContent=locked?'Voice is locked during the journey. Stop while parked to change it.':p.provider==='piper'?'Pippa needs server audio preparation.':!p.voice?'Waiting for your phone’s voice list. If it stays empty, reopen this page in Safari.':p.local?'Uses your phone directly, without Pippa’s server wait. Your choice is remembered on this browser.':'This voice may need internet. Preview it before relying on it offline.';}
 function stop(){generation++;if(active)clearTimeout(active.timer);active=null;globalThis.speechSynthesis?.cancel();}
 function speak(text,callbacks={}){
  stop();const p=get();if(p.provider!=='phone'||!p.voice||!globalThis.SpeechSynthesisUtterance){callbacks.onError?.('Your selected phone voice is unavailable. Choose another voice and preview it.');return;}
  const id=generation,started=performance.now(),utterance=new SpeechSynthesisUtterance(text),current=()=>id===generation&&active?.utterance===utterance;
  utterance.voice=p.voice;utterance.lang=p.voice.lang;utterance.rate=1;utterance.pitch=1;utterance.volume=1;
  const fail=message=>{if(!current())return;stop();callbacks.onError?.(message);};
  active={utterance,timer:setTimeout(()=>fail('The phone voice did not start. While parked, tap Preview voice, then try Start again.'),10000)};
  utterance.onstart=()=>{if(!current())return;clearTimeout(active.timer);callbacks.onProgress?.();callbacks.onTiming?.(p.name,(performance.now()-started)/1000);};
  utterance.onend=()=>{if(!current())return;clearTimeout(active?.timer);active=null;callbacks.onEnd?.();};
  utterance.onerror=e=>{if(current())fail('Phone voice could not play ('+e.error+'). Choose and preview a voice while parked.');};
  utterance.onpause=()=>{if(current())callbacks.onPaused?.();};
  try{speechSynthesis.resume();speechSynthesis.speak(utterance);}catch(error){fail(error.message);}
 }
 function ready(){if(get().provider==='phone')return Promise.resolve();return serverPromise||=(fetch('/voices').then(async r=>{if(!r.ok)throw Error('Pippa is unavailable.');return r.json();}));}
 const api={get,ready,speak,stop,pause:()=>globalThis.speechSynthesis?.pause(),resume:()=>{if(!active)return false;globalThis.speechSynthesis?.resume();return true;},setLocked:value=>{locked=value;load();},addChangeListener:fn=>listeners.push(fn)};
 globalThis.DiscoverNarrator=api;
 if(select){select.onchange=()=>{if(locked){load();return;}globalThis.ExploreNarration?.stop();stop();preferred=select.value;try{localStorage.setItem(key,preferred);localStorage.setItem('discoverPlaces.voiceChoiceV2','yes');}catch{}load();for(const fn of listeners)fn();};el('narratorPreview').onclick=()=>{const text='Welcome to Discover Places. The Crescent opened in October 2020. You are 400 metres away. Admission is twelve pounds and fifty pence.';if(get().provider==='phone'){globalThis.ExploreNarration?.stop();speak(text,{onTiming:(name,seconds)=>{el('narratorMessage').textContent=name+' started after '+seconds.toFixed(1)+' seconds. This measures the speech event, not sound at your speakers.';},onError:message=>{el('narratorMessage').textContent=message;}});}else if(globalThis.ExploreNarration)globalThis.ExploreNarration.listen({id:'narrator-preview',name:'Voice preview',title:'Voice preview',reason:text},{label:'Discover Places',mode:'nearby'});else el('testVoice')?.onclick();};}
 globalThis.speechSynthesis?.addEventListener('voiceschanged',load);load();
})();
