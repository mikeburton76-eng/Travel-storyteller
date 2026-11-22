'use strict';
(()=>{
 const el=id=>document.getElementById(id),panel=el('storyPlayer'),audio=el('exploreAudio');
 let partIndex=0,joined=false;
 const canExtend=()=>current&&(partIndex+1<current.parts.length||(!current.complete&&current.parts.length<3));
 const playbackText=()=>joined?current.parts.slice(0,partIndex+1).join(' '):current.parts[partIndex];
 const sessions=new Map();let current=null,epoch=0,request=null,audioURL=null,state='idle',streaming=false,phoneActive=false;
 const setState=(next,message)=>{state=next;el('storyPause').disabled=next!=='speaking';el('storyResume').disabled=next!=='paused';el('storyStop').disabled=next==='idle';el('storyReplay').disabled=next!=='idle'||!current;el('storyMore').disabled=next!=='idle'||!canExtend();el('storyPause').hidden=next!=='speaking';el('storyResume').hidden=next!=='paused';el('storyStop').hidden=next==='idle';el('storyReplay').hidden=next!=='idle';el('storyMore').hidden=next!=='idle'||!canExtend();if(message!==undefined)el('storyStatus').textContent=message;};
 const player=globalThis.NarrationPlayer?.supported?new NarrationPlayer({onState:(next,message)=>{if(streaming)setState(next,message)}}):null;
 let voiceConfig;const getVoiceConfig=()=>voiceConfig||=fetch('/voices').then(async r=>{if(!r.ok)throw Error('The narrator could not be loaded.');const c=await r.json();let saved;try{saved=localStorage.getItem('travelStoryteller.narrator')}catch{}return Object.hasOwn(c.voices||{},saved)?saved:c.defaultVoice;}).then(voice=>({voice}),error=>({error}));
 function stop(){epoch++;const diagnostic=el('storyVoice');diagnostic.textContent='';diagnostic.hidden=true;if(phoneActive)globalThis.DiscoverNarrator?.stop();phoneActive=false;request?.abort();request=null;streaming=false;player?.stop();audio.pause();audio.removeAttribute('src');audio.load();audio.hidden=true;if(audioURL)URL.revokeObjectURL(audioURL);audioURL=null;setState('idle','Stopped.');}
 function reset(){stop();current=null;panel.hidden=true;setState('idle','');}
 function renderText(){el('storyText').replaceChildren(...(joined?[playbackText()]:current.parts.slice(0,partIndex+1)).map((text,i)=>{const p=document.createElement('p');p.textContent=(i?'More: ':'')+text;return p}));el('storyName').textContent=current.title;el('storySources').replaceChildren(...current.sources.filter(s=>/^https:\/\//.test(s.url||'')).map(s=>{const a=document.createElement('a');a.href=s.url;a.target='_blank';a.rel='noopener';a.textContent=s.title+' ↗';return a}));}
 function showVoice(text){
  const diagnostic=el('storyVoice');
  diagnostic.textContent=text;
  diagnostic.hidden=false;
 }
 function reportServerVoice(response,path){
  const engine=response.headers.get('X-Discover-Voice-Engine');
  const model=response.headers.get('X-Discover-Voice-Model');
  const speed=response.headers.get('X-Discover-Voice-Speed');
  if(!engine||!model){showVoice(path+' · the server did not identify its voice');return;}
  const name=engine==='Piper'&&model==='en_GB-southern_english_female-low'?'Pippa':model;
  showVoice(name+' · '+engine+' · '+path+(speed?' · speed '+speed:''));
 }
 async function speak(text,id){
  if(text.length>1800&&globalThis.DiscoverNarrator?.get().provider!=='phone'){setState('idle','This longer part is ready to read below; it exceeds the audio length limit.');return;}
  if(globalThis.DiscoverNarrator?.get().provider==='piper')await globalThis.DiscoverNarrator.ready();
  if(id!==epoch)return;const preference=globalThis.DiscoverNarrator?.get();
  if(preference?.provider==='phone'){
   const voice=preference.voice;if(!voice)throw Error('Your selected phone voice is unavailable. Choose another narrator.');
   phoneActive=true;showVoice(voice.name+' · phone voice · '+voice.lang);
   globalThis.DiscoverNarrator.speak(text,{onProgress:()=>{if(id===epoch)setState('speaking','Reading aloud…');},onTiming:(name,seconds)=>{if(id===epoch)showVoice(name+' · phone voice · started after '+seconds.toFixed(1)+' seconds');},onEnd:()=>{if(id===epoch){phoneActive=false;setState('idle','Finished.');}},onError:message=>{if(id===epoch){phoneActive=false;setState('idle',message);}}});return;
  }
  const config=await getVoiceConfig();if(id!==epoch)return;if(config.error)throw config.error;
  if(preference?.voice)config.voice=preference.voice;
  if(player){streaming=true;await player.start(text,config.voice,response=>{if(id===epoch)reportServerVoice(response,'Streamed audio');});return;}
  const controller=request=new AbortController(),timer=setTimeout(()=>controller.abort(),190000);
  try{const response=await fetch('/speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice:config.voice}),signal:controller.signal});if(!response.ok){const data=await response.json();throw Error(data.error||'Audio could not be prepared.')}
   const blob=await response.blob();if(id!==epoch)return;reportServerVoice(response,'Full recording');audioURL=URL.createObjectURL(blob);audio.src=audioURL;audio.hidden=false;
   try{await audio.play();if(id===epoch)setState('speaking','Reading aloud…');}catch{if(id===epoch)setState('idle','Your audio is ready. Press play below.');}
  }finally{clearTimeout(timer);if(id===epoch)request=null;}
 }
 function listen(item,location){
  stop();const id=epoch;if(globalThis.DiscoverNarrator?.get().provider!=='phone')player?.prime();
  const key=location.label+'|'+item.id;current=sessions.get(key);
  if(!current){
   const canonical=item.source?.kind==='wikipedia'?item.source.title:item.name;
   const query=(canonical===location.label||location.mode==='nearby'?canonical:canonical+', '+location.label);
   current={title:item.title,place:query.length<=100?query:canonical.slice(0,100),item,parts:[globalThis.DriveLogic.narration(item,{nearby:false})],sources:[item.source,...(item.supportingSources||[])].filter(Boolean),complete:false};
   if(sessions.size>=8)sessions.delete(sessions.keys().next().value);sessions.set(key,current);
  }
  partIndex=0;joined=!!globalThis.DiscoverNarrator?.fullStory?.();
  panel.hidden=false;renderText();
  if(joined){playExtended(id,true);return;}
  setState('loading','Preparing the opening narration…');
  speak(playbackText(),id).catch(error=>{if(id===epoch)setState('idle',error.message);});
 }
 async function nextPart(session,id){
  if(partIndex+1<session.parts.length){partIndex++;return true;}
  if(session.complete||session.parts.length>=3)return false;
  let data={story:globalThis.DriveLogic.followUp(session.item,session.parts.join(' '))};
  if(!data.story){
   const controller=request=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
   try{
    const response=await fetch('/story',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({place:session.place,previousStories:[...session.parts]}),signal:controller.signal});
    data=await response.json();
    if(!response.ok)throw Error(data.error||'Further details could not be loaded.');
   }finally{clearTimeout(timer);if(request===controller)request=null;}
  }
  if(id!==epoch)return false;
  const text=typeof data.story==='string'?data.story.trim():'';
  if(text.length>2500)throw Error('The extra story was too long.');
  session.complete=!!data.complete||!text||session.parts.includes(text);
  if(!text||session.parts.includes(text))return false;
  session.parts.push(text);partIndex++;
  for(const source of (data.sources||[]).slice(0,8))if(source?.title&&source.url&&!session.sources.some(s=>s.url===source.url))session.sources.push(source);
  return true;
 }
 async function playExtended(id,full){
  const session=current;
  setState('loading',full?'Preparing the full story…':'Finding more of this story…');
  try{
   do{
    if(!await nextPart(session,id)){
     if(id!==epoch)return;
     if(!full){setState('idle','No further distinct details are available.');return;}
     break;
    }
   }while(full&&id===epoch&&canExtend());
  }catch(error){
   if(id!==epoch)return;
   if(!full){setState('idle',error.message);return;}
  }
  if(id!==epoch)return;
  renderText();
  try{await speak(playbackText(),id);}catch(error){if(id===epoch)setState('idle',error.message);}
 }
 el('storyMore').addEventListener('click',()=>{
  if(state!=='idle'||!canExtend())return;
  stop();joined=false;return playExtended(epoch,false);
 });
 el('storyPause').addEventListener('click',()=>{if(phoneActive){speechSynthesis.pause();setState('paused','Paused.')}else if(streaming)player.pause();else audio.pause();});
 el('storyResume').addEventListener('click',()=>{if(phoneActive){speechSynthesis.resume();setState('speaking','Reading aloud…')}else if(streaming)player.resume();else audio.play().catch(()=>setState('idle','Press play on the audio player.'));});
 el('storyStop').addEventListener('click',stop);
 el('storyReplay').addEventListener('click',()=>{if(!current)return;stop();const id=epoch;if(globalThis.DiscoverNarrator?.get().provider!=='phone')player?.prime();setState('loading','Preparing narration…');speak(playbackText(),id).catch(error=>{if(id===epoch)setState('idle',error.message);});});
 audio.addEventListener('playing',()=>setState('speaking','Reading aloud…'));
 audio.addEventListener('pause',()=>{if(state==='speaking'&&!audio.ended)setState('paused','Paused.');});
 audio.addEventListener('ended',()=>setState('idle','Finished.'));
 audio.addEventListener('error',()=>{if(audio.getAttribute('src'))setState('idle','The audio could not play. Please try again.');});
 window.addEventListener('pagehide',stop);
 globalThis.ExploreNarration={listen,reset,stop};setState('idle','');
})();

