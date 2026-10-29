'use strict';
(()=>{
 const el=id=>document.getElementById(id),panel=el('storyPlayer'),audio=el('exploreAudio');
 const sessions=new Map();let current=null,epoch=0,request=null,audioURL=null,state='idle',streaming=false,phoneActive=false;
 const setState=(next,message)=>{state=next;el('storyPause').disabled=next!=='speaking';el('storyResume').disabled=next!=='paused';el('storyStop').disabled=next==='idle';el('storyReplay').disabled=next!=='idle'||!current||current.parts.at(-1).length>1800;el('storyMore').disabled=next!=='idle'||!current||current.complete||current.parts.length>=3;el('storyPause').hidden=next!=='speaking';el('storyResume').hidden=next!=='paused';el('storyStop').hidden=next==='idle';el('storyReplay').hidden=next!=='idle';el('storyMore').hidden=next!=='idle'||!!current?.complete||current?.parts.length>=3;if(message!==undefined)el('storyStatus').textContent=message;};
 const player=globalThis.NarrationPlayer?.supported?new NarrationPlayer({onState:(next,message)=>{if(streaming)setState(next,message)}}):null;
 const voiceConfig=fetch('/voices').then(async r=>{if(!r.ok)throw Error('The narrator could not be loaded.');const c=await r.json();let saved;try{saved=localStorage.getItem('travelStoryteller.narrator')}catch{}return Object.hasOwn(c.voices||{},saved)?saved:c.defaultVoice;}).then(voice=>({voice}),error=>({error}));
 function stop(){epoch++;if(phoneActive)globalThis.speechSynthesis?.cancel();phoneActive=false;request?.abort();request=null;streaming=false;player?.stop();audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;if(audioURL)URL.revokeObjectURL(audioURL);audioURL=null;setState('idle','Stopped.');}
 function reset(){stop();current=null;panel.hidden=true;setState('idle','');}
 function renderText(){el('storyText').replaceChildren(...current.parts.map((text,i)=>{const p=document.createElement('p');p.textContent=(i?'More: ':'')+text;return p}));el('storyName').textContent=current.title;el('storySources').replaceChildren(...current.sources.filter(s=>/^https:\/\//.test(s.url||'')).map(s=>{const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener';a.textContent=s.title+' ↗';return a}));}
 async function speak(text,id){
  if(text.length>1800){setState('idle','This longer part is ready to read below; it exceeds the audio length limit.');return;}
  if(globalThis.DiscoverNarrator)await globalThis.DiscoverNarrator.ready();
  if(id!==epoch)return;const preference=globalThis.DiscoverNarrator?.get();
  if(preference?.provider==='phone'){
   if(!globalThis.speechSynthesis)throw Error('Phone narration is unavailable in this browser.');
   const voice=speechSynthesis.getVoices().find(v=>v.voiceURI===preference.uri);if(!voice)throw Error('The chosen phone voice is unavailable. Please choose another narrator.');
   const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.85;phoneActive=true;
   utterance.onstart=()=>{if(id===epoch)setState('speaking','Reading aloud…')};utterance.onend=()=>{if(id===epoch){phoneActive=false;setState('idle','Finished.')}};utterance.onerror=e=>{if(id===epoch&&e.error!=='canceled'&&e.error!=='interrupted'){phoneActive=false;setState('idle','Phone audio could not play. Choose another narrator.')}};
   speechSynthesis.speak(utterance);return;
  }
  const config=await voiceConfig;if(id!==epoch)return;if(config.error)throw config.error;
  if(preference?.voice)config.voice=preference.voice;
  if(player){streaming=true;await player.start(text,config.voice);return;}
  const controller=request=new AbortController(),timer=setTimeout(()=>controller.abort(),190000);
  try{const response=await fetch('/speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:config.voice}),signal:controller.signal});if(!response.ok){const data=await response.json();throw Error(data.error||'Audio could not be prepared.')}
   const blob=await response.blob();if(id!==epoch)return;audioURL=URL.createObjectURL(blob);audio.src=audioURL;audio.hidden=false;
   try{await audio.play();if(id===epoch)setState('speaking','Reading aloud…');}catch{if(id===epoch)setState('idle','Your audio is ready. Press play below.');}
  }finally{clearTimeout(timer);if(id===epoch)request=null;}
 }
 function listen(item,location){
  stop();const id=epoch;player?.prime();
  const key=location.label+'|'+item.id;current=sessions.get(key);
  if(!current){
   const canonical=item.source?.kind==='wikipedia'?item.source.title:item.name;
   const query=(canonical===location.label||location.mode==='nearby'?canonical:canonical+', '+location.label);
   current={title:item.title,place:query.length<=100?query:canonical.slice(0,100),parts:[item.reason],sources:[item.source,...(item.supportingSources||[])].filter(Boolean),complete:false};
   if(sessions.size>=8)sessions.delete(sessions.keys().next().value);sessions.set(key,current);
  }
  panel.hidden=false;renderText();setState('loading','Preparing the opening narration…');
  speak(current.parts.at(-1),id).catch(error=>{if(id===epoch)setState('idle',error.message||'Audio could not play. The written story is available below.');});
 }
 el('storyMore').addEventListener('click',async()=>{
  if(!current||state!=='idle'||current.complete||current.parts.length>=3)return;
  stop();const id=epoch,session=current;player?.prime();const controller=request=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);setState('loading','Finding more of this story…');
  try{const response=await fetch('/story',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({place:session.place,previousStories:[...session.parts]}),signal:controller.signal});const data=await response.json();if(id!==epoch)return;if(!response.ok)throw Error(data.error||'More of this story could not be loaded.');
   const text=typeof data.story==='string'?data.story.trim():'';session.complete=!!data.complete||!text;
   if(!text){setState('idle','No further distinct details are available for this story.');return;}
   if(text.length>2500)throw Error('The extra story was too long. Please try again.');
   session.parts.push(text);for(const s of (data.sources||[]).slice(0,8))if(s&&typeof s.title==='string'&&typeof s.url==='string'&&!session.sources.some(x=>x.url===s.url))session.sources.push(s);renderText();clearTimeout(timer);request=null;await speak(text,id);
  }catch(error){if(id===epoch)setState('idle',error.name==='AbortError'?'The request stopped. Your earlier story is still available.':error.message);}
  finally{clearTimeout(timer);if(id===epoch&&request===controller)request=null;}
 });
 el('storyPause').addEventListener('click',()=>{if(phoneActive){speechSynthesis.pause();setState('paused','Paused.')}else if(streaming)player.pause();else audio.pause();});
 el('storyResume').addEventListener('click',()=>{if(phoneActive){speechSynthesis.resume();setState('speaking','Reading aloud…')}else if(streaming)player.resume();else audio.play().catch(()=>setState('idle','Press play on the audio player.'));});
 el('storyStop').addEventListener('click',stop);
 el('storyReplay').addEventListener('click',()=>{if(!current)return;stop();const id=epoch;player?.prime();setState('loading','Preparing narration…');speak(current.parts.at(-1),id).catch(error=>{if(id===epoch)setState('idle',error.message);});});
 audio.addEventListener('playing',()=>setState('speaking','Reading aloud…'));
 audio.addEventListener('pause',()=>{if(state==='speaking'&&!audio.ended)setState('paused','Paused.');});
 audio.addEventListener('ended',()=>setState('idle','Finished.'));
 audio.addEventListener('error',()=>{if(audio.getAttribute('src'))setState('idle','The audio could not play. Please try again.');});
 window.addEventListener('pagehide',stop);
 globalThis.ExploreNarration={listen,reset,stop};setState('idle','');
})();
