'use strict';
(()=>{
 const $=id=>document.getElementById(id),L=globalThis.DriveLogic;
 let trip={items:[],audio:{},savedAt:null},running=false,watch=null,epoch=0,preparing=false,downloadController=null,guideController=null,audioController=null;
 let source,wakeLock,lastHeading=null,lastGood=null,fix=null,movement=null,pending=null,buffer=null,audioBusy=false,lastEnd=-Infinity,lastSearch=null,lastSearchTime=0,retryAt=0,guideRetryAt=0,guideBusy=false,staleTimer;
 const played=new Set(),latchedPlaces=new Map(),closestDistances=new Map(),buffers=new Map(),preparedItems=new Map(),events=[];let previewURL,arrivalItems=[],arrivalBusy=false,arrivalController=null,lastArrivalSearch=null,lastArrivalTime=0,arrivalRetry=0,lastWaiting='';let nearbyItems=[];
 let lastPlayedPlace=null;
 let visiblePlaceCards='';
 $('nearbyPlacesRadius').textContent='Explore places within '+L.PLAYBACK_METRES+' metres of your location.';
 const placeIcons={nature:'🌿',culture:'🎨',experience:'🎟️',architecture:'🏛️',history:'📜'};
 function renderNearbyPlaces(){
  const currentFix=running&&!parkedCheck&&fix&&Date.now()-fix.time<=10000?fix:null;
  const explored=[...nearbyItems,...trip.items,...preparedItems.values()].filter(item=>item.kind!=='arrival');
  const nearby=L.nearbyPlaces(explored,currentFix).sort((a,b)=>a.name.localeCompare(b.name));
  $('nearbyPlaces').hidden=!running||parkedCheck;
  $('nearbyPlacesStatus').textContent=!currentFix?'Waiting for a fresh location.':
   nearby.length?'':'No Explore places loaded within '+L.PLAYBACK_METRES+' m.';
  const signature=JSON.stringify(nearby.map(item=>[L.key(item),item.name,item.theme,item.image,item.reason,item.background]));
  if(signature===visiblePlaceCards)return;
  visiblePlaceCards=signature;
  $('nearbyPlaceCards').replaceChildren(...nearby.map(item=>{
   const card=document.createElement('article');
   card.className='nearby-place-card';
   const icon=document.createElement('span');
   icon.textContent=placeIcons[item.theme]||'📍';
   icon.setAttribute('aria-hidden','true');
   const title=document.createElement('h3');
   title.append(icon,document.createTextNode(' '+item.name));
   card.append(title);
   if(/^https:\/\//.test(item.image?.url||'')){
    const image=document.createElement('img');
    image.src=item.image.url;
    image.alt=item.name;
    image.loading='lazy';
    image.referrerPolicy='no-referrer';
    image.onerror=()=>{image.hidden=true;};
    card.append(image);
    if(/^https:\/\//.test(item.image.sourceUrl||'')){
     const credit=document.createElement('a');
     credit.className='small';
     credit.href=item.image.sourceUrl;
     credit.target='_blank';
     credit.rel='noopener';
     credit.textContent=[item.image.creator,item.image.license].filter(Boolean).join(' · ')||'Photo source';
     card.append(credit);
    }
   }
   const description=document.createElement('p');
   description.textContent=L.narration(item,{nearby:false});
   card.append(description);
   return card;
  }));
 }

 const nativePlayer=globalThis.createDrivePlayer({element:$('savedPreview'),log:message=>log(message)});let voiceCheckBlob=null,parkedCheck=false,parkedTimer=null,historyReplay=null,starting=false;
 const history=globalThis.DriveHistory.createDriveHistory({onWarning:message=>{$('historyWarning').textContent=message;}});
 function log(message){events.push(new Date().toLocaleTimeString('en-GB')+' '+message);if(events.length>100)events.shift();$('log').textContent=events.join('\n');}
 function status(message){$('status').textContent=message;}
 function waiting(reason,message){$('decision').textContent=reason;status(message);if(lastWaiting!==reason){lastWaiting=reason;log('Waiting: '+reason);}}
 const currentArrival=i=>i?.kind==='arrival'&&[3,4,5].includes(i.profileVersion)&&L.valid(i.coord)&&typeof i.reason==='string'&&Date.parse(i.reviewAfter)>Date.now();
 function rebuild(){candidates=L.places([...arrivalItems.filter(currentArrival),...trip.items.filter(i=>i.kind!=='arrival'||currentArrival(i)),...nearbyItems,...[...preparedItems.values()].filter(i=>i.kind!=='arrival'||currentArrival(i))]);}
 function nextLabel(approach){return approach.item.name+' · '+Math.round(approach.metres)+' m'+(approach.arrival?' from the reference point · plays within '+L.PLAYBACK_METRES+' m': approach.eta===null?' · stopped; last travel direction held':' · about '+Math.round(approach.eta)+' s');}
 function connection(){const c=navigator.connection;$('connection').textContent=navigator.onLine===false?'Offline: using downloaded information and audio only.':'Connection available'+(c?.effectiveType?' · browser estimate '+c.effectiveType:'')+'. Actual preparation times are measured below.';}
 const db=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('discover-driving-test',2);r.onupgradeneeded=()=>{for(const name of ['trip','arrivals'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 async function storage(action,value,namespace='trip'){const d=await db();try{return await new Promise((resolve,reject)=>{const tx=d.transaction(namespace,action==='get'?'readonly':'readwrite'),store=tx.objectStore(namespace);let result;const r=action==='get'?store.get('current'):action==='delete'?store.delete('current'):store.put(value,'current');r.onsuccess=()=>{result=r.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Save cancelled'));});}finally{d.close();}}
 function saved(){const sample=trip.items.find(i=>trip.audio[L.key(i)]&&(i.kind!=='arrival'||currentArrival(i)));if(previewURL)URL.revokeObjectURL(previewURL);$('savedPreview').hidden=!sample;$('previewLabel').hidden=!sample;if(sample){previewURL=URL.createObjectURL(trip.audio[L.key(sample)]);$('savedPreview').src=previewURL;}else $('savedPreview').removeAttribute('src');const count=trip.items.filter(i=>trip.audio[L.key(i)]).length;$('savedStatus').textContent=trip.savedAt?`${count} clips saved on this phone for ${trip.label}. Saved ${new Date(trip.savedAt).toLocaleString('en-GB')}.`:'No offline clips saved yet.';if(trip.savedAt&&!trip.items.some(i=>i.kind==='arrival'))$('savedStatus').textContent+=' No arrival introduction is saved. Prepare again while connected to add one.';if(trip.items.some(i=>i.kind==='arrival'&&!currentArrival(i)))$('savedStatus').textContent+=' An arrival introduction needs updating or its annual review. Prepare again while connected.';}
 async function shell(){if(!('serviceWorker'in navigator))throw Error('Offline page saving is unavailable in this browser.');const r=await navigator.serviceWorker.register('/drive-test-sw.js',{scope:'/drive-test'});const worker=r.installing||r.waiting||r.active;if(!worker)throw Error('Offline page could not be saved.');if(worker.state!=='activated')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Offline page setup took too long. Try again.')),30000);worker.addEventListener('statechange',()=>{if(worker.state==='activated'){clearTimeout(timer);resolve();}if(worker.state==='redundant'){clearTimeout(timer);reject(Error('Offline page saving failed.'));}});});$('offlineStatus').textContent='The driving test page is saved for offline reopening at this address.';}
 async function json(url,body,signal){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal});const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed ('+r.status+').');return data;}
 async function guide(input,signal,onPreview=()=>{}){const end=Date.now()+120000;while(true){const data=await json('/api/explore',{...input,progressive:true,specialists:false},signal);onPreview(data);if(data.complete!==false)return data;if(Date.now()>end)throw Error('Guide preparation took too long. Try again while connected.');await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1500);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});}}
 let voice;
 async function audio(item,signal,text=L.narration(item)){const started=performance.now();if(!voice){const r=await fetch('/voices',{signal});if(!r.ok)throw Error('Pippa is unavailable.');voice=(await r.json()).defaultVoice;}
 const r=await fetch('/speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,voice}),signal});if(!r.ok){const data=await r.json();throw Error(data.error||'Pippa could not prepare this clip.');}const blob=await r.blob();if(blob.size>6*1024*1024||!blob.size)throw Error('Unexpected audio size.');return {blob,seconds:(performance.now()-started)/1000};}
 function timeout(controller,ms){return setTimeout(()=>controller.abort(),ms);}
 let chosenDestination='';
 async function destination(place,signal){
  if(chosenDestination===place)return place;
  $('destinationChoices').replaceChildren();$('destinationChoices').hidden=true;$('destinationMessage').textContent='Finding the town or village to prepare…';
  const response=await fetch('/api/place-matches?q='+encodeURIComponent(place),{signal}),data=await response.json();
  if(!response.ok)throw Error(data.error||'Place choices are unavailable.');
  const choices=(data.choices||[]).filter(p=>!p.broad);
  if(choices.length===1){chosenDestination=choices[0].title;$('destination').value=chosenDestination;$('destinationMessage').textContent=choices[0].description||'';return chosenDestination;}
  $('destinationMessage').textContent=choices.length?'Choose the place you mean below, then preparation will begin.':'No clear town or village found. Add its region and country, or try a nearby town.';
  for(const place of choices){const button=document.createElement('button');button.type='button';const title=document.createElement('strong'),detail=document.createElement('small');title.textContent=place.title;detail.textContent=place.description||'';button.append(title,detail);button.onclick=()=>{chosenDestination=place.title;$('destination').value=place.title;$('destinationChoices').replaceChildren();$('destinationChoices').hidden=true;$('destinationMessage').textContent=place.description||'';$('prepare').onclick();};$('destinationChoices').append(button);}
  $('destinationChoices').hidden=!choices.length;$('savedStatus').textContent='Choose a place before downloading. Previous saved clips remain available.';return null;
 }
 $('prepare').onclick=async()=>{
 if(preparing||running)return;const place=$('destination').value.trim();if(!place)return;preparing=true;renderHistory();$('testVoice').disabled=true;$('testAutomatic').disabled=true;$('prepare').disabled=true;$('start').disabled=true;$('forget').disabled=true;$('cancelPrepare').disabled=false;const controller=downloadController=new AbortController(),timer=timeout(controller,12*60*1000);
 try{const selected=await destination(place,controller.signal);if(!selected)return;await shell();$('savedStatus').textContent='Finding places near '+selected+'…';const g=await guide({place:selected},controller.signal);let arrivals=[];try{arrivals=(await json('/api/arrivals',{place:g.location.label},controller.signal)).items||[];}catch(error){if(controller.signal.aborted)throw error;log('Arrival introduction not downloaded: '+error.message);}const items=L.places([...arrivals,...g.items]).sort((a,b)=>Number(b.kind==='arrival')-Number(a.kind==='arrival')||Number(!!b.mustSee)-Number(!!a.mustSee)||(a.distanceKm||0)-(b.distanceKm||0)).slice(0,9);if(!items.length)throw Error('No places with usable coordinates were found. Try a nearby town.');const next={label:g.location.label,items:[],audio:{},savedAt:new Date().toISOString()},failures=[];let total=0;

 for(const item of items){if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');$('savedStatus').textContent=`Saving Pippa: ${next.items.length+1} of ${items.length} · ${item.name}. The first clip may take a while…`;try{const a=await audio(item,controller.signal);if(total+a.blob.size>24*1024*1024)break;total+=a.blob.size;next.items.push({...item,spokenText:L.narration(item)});next.audio[L.key(item)]=a.blob;log('Downloaded '+item.name+' · '+a.seconds.toFixed(1)+' seconds');}catch(error){if(controller.signal.aborted)throw error;failures.push(item.name);log('Download failed: '+item.name+' · '+error.message);}}
 if(!next.items.length)throw Error('No audio could be saved. Your previous saved trip is unchanged.');await storage('put',next);trip=next;buffers.clear();preparedItems.clear();rebuild();saved();if(failures.length)$('savedStatus').textContent+=' '+failures.length+' clips could not be saved.';log('Offline trip saved: '+next.items.length+' clips.');
 }catch(error){$('savedStatus').textContent=(controller.signal.aborted?'Download cancelled or timed out.':error.message)+' Previous saved clips remain available.';log('Preparation stopped: '+error.message);}
 finally{clearTimeout(timer);downloadController=null;preparing=false;renderHistory();$('testVoice').disabled=false;$('testAutomatic').disabled=false;$('prepare').disabled=false;$('start').disabled=false;$('forget').disabled=false;$('cancelPrepare').disabled=true;}
 };
 $('cancelPrepare').onclick=()=>downloadController?.abort();
 $('forget').onclick=async()=>{if(running||preparing)return;try{nativePlayer.stop({release:true});await storage('delete');trip={items:[],audio:{}};buffers.clear();preparedItems.clear();rebuild();saved();log('Saved trip deleted.');}catch{status('Saved trip could not be deleted.');}};
 function prime(){try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}}
 async function decoded(item,blob){
 const key=L.key(item);if(buffers.has(key))return buffers.get(key);if(!blob?.size)throw Error('The audio clip is empty.');
 buffers.set(key,blob);preparedItems.set(key,item);
 while(buffers.size>10||[...buffers.values()].reduce((sum,b)=>sum+b.size,0)>24*1024*1024){const oldest=buffers.keys().next().value;buffers.delete(oldest);preparedItems.delete(oldest);}
 rebuild();return blob;
 }
 let candidates=[];
 const AHEAD_CLIPS=3;
 let aheadJob=null;
 const audioRetries=new Map();
 const audioReady=item=>buffers.has(L.key(item))||!!trip.audio[L.key(item)];
 const audioEligible=item=>audioReady(item)||Date.now()>=(audioRetries.get(L.key(item))||0);
 function aheadPlaces(){
  if(!fix||Date.now()-fix.time>10000||!movement)return [];
  return candidates.filter(item=>history.check(item).allowed&&(!source||L.key(source.item)!==L.key(item)))
   .map(item=>L.approaching(item,fix,movement,played,5000)).filter(Boolean)
   .sort((a,b)=>a.metres-b.metres).slice(0,AHEAD_CLIPS).map(approach=>approach.item);
 }
 // One session-owned download at a time. Selection changes detach a waiter;
 // they must not cancel speech generation already in progress on the server.
 function startAudioJob(item,id){
  const controller=new AbortController(),job={key:L.key(item),item,controller,task:null,timedOut:false};aheadJob=job;
  const timer=setTimeout(()=>{job.timedOut=true;controller.abort();},190000);
  renderAhead();
  log('Preparing audio buffer: '+item.name);
  job.task=audio(item,controller.signal).then(async result=>{
   if(!running||id!==epoch||controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
   await decoded(item,result.blob);audioRetries.delete(job.key);
   log('Buffered audio ready: '+item.name+' · '+result.seconds.toFixed(1)+' seconds');
   return result;
  });
  job.task.catch(error=>{
   if(running&&id===epoch&&(!controller.signal.aborted||job.timedOut)){audioRetries.set(job.key,Date.now()+30000);log('Audio buffer waiting for connection: '+item.name+' · '+error.message);}
  }).finally(()=>{
   clearTimeout(timer);
   if(aheadJob===job){aheadJob=null;if(running&&id===epoch)evaluate();}
  });
  return job;
 }
 function waitForAudio(job,signal){
  return new Promise((resolve,reject)=>{
   const abort=()=>reject(new DOMException('Selection changed','AbortError'));
   if(signal.aborted){abort();return;}
   signal.addEventListener('abort',abort,{once:true});
   job.task.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
 }
 function renderAhead(){
  const items=running&&!parkedCheck?aheadPlaces():[];
  const job=aheadJob?.controller.signal.aborted?null:aheadJob;
  const ready=items.filter(audioReady).length;
  $('ahead').textContent=ready+' ready · '+items.length+(items.length===1?' place':' places')+' ahead (up to '+AHEAD_CLIPS+')';
  const rows=items.map(item=>{
   const row=document.createElement('li');
   const state=audioReady(item)?'Ready':job?.key===L.key(item)?'Downloading':
    navigator.onLine===false?'Needs signal':audioEligible(item)?'Waiting to download':'Waiting to retry';
   row.textContent=item.name+' — '+state;
   return row;
  });
  if(job&&!items.some(item=>L.key(item)===job.key)){
   const row=document.createElement('li');
   row.textContent='Finishing download for '+job.item.name;
   rows.push(row);
  }
  $('aheadPlaces').replaceChildren(...rows);
 }
 function fillAhead(){
  if(!running||parkedCheck||aheadJob||audioBusy||navigator.onLine===false)return;
  const item=aheadPlaces().find(item=>!audioReady(item)&&audioEligible(item));
  if(item)startAudioJob(item,epoch);
 }

 async function refreshGuide(current,id){
 if(guideBusy||navigator.onLine===false||Date.now()<guideRetryAt)return;
 if(lastSearch&&Date.now()-lastSearchTime<90000)return;
 if(lastSearch&&L.distance(lastSearch,current)<1200)return;
 guideBusy=true;const controller=guideController=new AbortController(),timer=timeout(controller,125000);lastSearchTime=Date.now();const started=performance.now();
 try{await guide({lat:Number(current.lat.toFixed(3)),lon:Number(current.lon.toFixed(3))},controller.signal,g=>{if(!running||id!==epoch)return;nearbyItems=g.items;rebuild();evaluate();});if(running&&id===epoch){lastSearch=current;log('Nearby guide prepared in '+((performance.now()-started)/1000).toFixed(1)+' seconds.');}}
 catch(error){if(running&&id===epoch){guideRetryAt=Date.now()+60000;log('Nearby guide unavailable; using saved places. '+error.message);}}
 finally{clearTimeout(timer);if(guideController===controller){guideBusy=false;guideController=null;}}
 }
 async function prepareCandidate(item,id){
 audioBusy=true;let timedOut=false;const key=L.key(item),controller=audioController=new AbortController(),timer=setTimeout(()=>{timedOut=true;controller.abort();},190000);
 const current=()=>id===epoch&&running&&pending===item&&!controller.signal.aborted;
 try{
  while(current()&&!audioReady(item)){
   if(navigator.onLine===false)throw Error('No saved audio for this place.');
   const job=aheadJob||startAudioJob(item,id);
   try{await waitForAudio(job,controller.signal);}catch(error){if(job.key===key||controller.signal.aborted)throw error;}
   if(!current())return;
   // The shared job's cleanup runs after its waiters; let it release the slot.
   if(aheadJob===job)aheadJob=null;
  }
  if(!current())return;
  buffer=buffers.get(key)||await decoded(item,trip.audio[key]);
  if(!current())return;
  $('timing').textContent=trip.audio[key]?'Ready · saved on this phone':'Ready · prepared earlier this session';
  log('Reusing prepared audio: '+item.name);$('play').disabled=false;evaluate();
 }catch(error){
  if(id===epoch&&running&&pending===item&&(!controller.signal.aborted||timedOut)){
   log('Audio unavailable: '+item.name+' · '+(timedOut?'Preparation timed out':error.message));audioRetries.set(key,Date.now()+30000);pending=null;buffer=null;status('Waiting for downloaded audio or a connection.');
  }
 }finally{clearTimeout(timer);if(audioController===controller){audioBusy=false;audioController=null;if(running&&id===epoch)evaluate();}}
 }

 function renderHistory(){
  const snapshot=history.snapshot();$('skipFamiliar').checked=snapshot.skipFamiliar;$('skipFamiliar').disabled=running||preparing||starting;$('resetHistory').disabled=running||preparing||starting;$('historyList').replaceChildren();
  $('historyStatus').textContent=snapshot.places.length+' places remembered on this browser. Each plays at most once per local calendar day.';
  for(const entry of snapshot.places){const row=document.createElement('p'),label=document.createElement('span'),button=document.createElement('button');label.textContent=entry.name+' · '+entry.count+' plays · last '+entry.lastDay+(entry.allowOnce?' · one replay allowed':'')+' ';button.type='button';button.className='secondary';button.textContent='Hear this place again';button.disabled=running||preparing||starting;button.onclick=()=>replayPlace(entry.key);row.append(label,button);$('historyList').append(row);}
 }
 function replayPlace(key){
  if(running||preparing)return;history.allowOnce(key);for(const item of [...trip.items,...arrivalItems,...nearbyItems])if(history.key(item)===key)played.delete(L.key(item));renderHistory();
  const item=[...trip.items,...arrivalItems,...nearbyItems].find(i=>history.key(i)===key&&(i.kind!=='arrival'||currentArrival(i))&&(trip.audio[L.key(i)]||buffers.has(L.key(i))));
  if(!item){status('One replay is allowed when this place is next available and you pass within '+L.PLAYBACK_METRES+' metres.');return;}
  nativePlayer.stop();prime();running=true;parkedCheck=true;historyReplay=item;++epoch;source=null;pending=item;buffer=trip.audio[L.key(item)]||buffers.get(L.key(item));lastEnd=-Infinity;retryAt=0;
  $('start').disabled=true;$('stop').disabled=false;$('prepare').disabled=true;$('testVoice').disabled=true;$('testAutomatic').disabled=true;$('forget').disabled=true;renderHistory();log('Listener requested a replay: '+item.name);play(true);
 }
 $('skipFamiliar').onchange=()=>{if(running||preparing)return;history.setSkipFamiliar($('skipFamiliar').checked);renderHistory();};
 $('resetHistory').onclick=()=>{if(running||preparing)return;history.clear();played.clear();latchedPlaces.clear();closestDistances.clear();renderHistory();status('Listening history reset. Places may play again on the next journey.');log('Listener reset listening history.');};
 function spokenText(item){
  const savedItem=trip.items.find(saved=>L.key(saved)===L.key(item));
  return savedItem?.spokenText||L.narration(item);
 }
 function renderMore(){
  $('moreStory').hidden=!lastPlayedPlace||running||starting;
  $('morePlace').textContent=lastPlayedPlace?.name||'';
 }
 function rememberPlayedPlace(item){
  lastPlayedPlace=item;
  $('moreText').textContent='';
  $('moreStatus').textContent='';
  $('moreListen').hidden=true;
 }
 $('tellMore').onclick=()=>{
  if(running||starting||preparing||!lastPlayedPlace)return;
  const item=lastPlayedPlace;
  const text=L.followUp(item,spokenText(item));
  $('moreText').textContent=text;
  $('moreListen').hidden=!text;
  $('moreStatus').textContent=text?'':'The source has no further distinct details for this place.';
 };
 $('moreCancel').onclick=()=>downloadController?.abort();
 $('moreListen').onclick=async()=>{
  const text=$('moreText').textContent;
  if(running||starting||preparing||!lastPlayedPlace||!text)return;
  if(navigator.onLine===false){
   $('moreStatus').textContent='The extra details are ready to read. Reconnect to listen.';
   return;
  }
  preparing=true;
  const controller=downloadController=new AbortController();
  const timer=timeout(controller,190000);
  prime();
  $('moreListen').disabled=true;
  $('start').disabled=true;
  $('moreCancel').hidden=false;
  $('moreStatus').textContent='Preparing the extra audio…';
  try{
   const result=await audio(lastPlayedPlace,controller.signal,text);
   if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
   $('previewLabel').hidden=false;
   $('previewLabel').textContent='Tell me more audio:';
   $('moreStatus').textContent='Playing the extra details.';
   nativePlayer.play(result.blob,{
    onEnd:()=>{$('moreStatus').textContent='Extra details finished.';},
    onError:()=>{$('moreStatus').textContent='Audio could not play. The extra details are ready to read.';},
    onPaused:()=>{$('moreStatus').textContent='Audio paused. Use the audio controls above to resume.';}
   });
  }catch(error){
   $('moreStatus').textContent=controller.signal.aborted?'Audio preparation stopped. The extra details are ready to read.':'Audio could not be prepared. The extra details are ready to read.';
  }finally{
   clearTimeout(timer);
   downloadController=null;
   preparing=false;
   $('moreListen').disabled=false;
   $('start').disabled=false;
   $('moreCancel').hidden=true;
  }
 };
 function show(item){$('arrivalReview').textContent=item.kind==='arrival'?'Source checked '+new Date(item.checkedAt).toLocaleDateString('en-GB')+' · annual review after '+new Date(item.reviewAfter).toLocaleDateString('en-GB')+'. Food and stays in this app remain a Buxton/Tideswell trial.':'';$('placeName').textContent=item.name;$('placeText').textContent=spokenText(item);$('source').replaceChildren();for(const source of item.sources||[item.source]){if(!/^https:\/\//.test(source?.url||''))continue;const a=document.createElement('a');a.href=source.url;a.textContent='Source: '+(source.title||item.name)+' ↗ ';a.target='_blank';a.rel='noopener';$('source').append(a);}}
 function play(manual=false){
  if(!running)return;if(source){if(manual)nativePlayer.resume();return;}if(!buffer||!pending)return;
  if(!parkedCheck&&!history.check(pending).allowed){const reason=history.check(pending).reason;waiting(reason,'Skipping '+pending.name+': '+reason+'. Use Hear this place again while parked to allow a replay.');pending=null;buffer=null;$('play').disabled=true;return;}
  if(!manual&&!parkedCheck&&(!fix||Date.now()-fix.time>10000||L.distance(fix,pending.coord)>L.PLAYBACK_METRES||L.movingAway(pending,fix,movement)))return;
  if(!manual&&!parkedCheck&&!isLatched(pending)&&(!fix||Date.now()-fix.time>10000||!L.approaching(pending,fix,movement,played)?.trigger))return;
  const item=pending,clip=buffer,id=epoch,token=source={item};prime();show(item);$('play').disabled=false;$('previewLabel').hidden=false;$('previewLabel').textContent='Journey audio — this uses the same player as the Pippa check:';
  const distanceLabel=!manual&&!parkedCheck?' · '+Math.round(L.distance(fix,item.coord))+' m from reference point':'';
  log((manual?'Manual playback requested: ':'Automatic playback requested: ')+item.name+distanceLabel);status('Starting the audio player for '+item.name+'…');
  nativePlayer.play(clip,{
   onProgress(){if(!running||id!==epoch||source!==token)return;played.add(L.key(item));latchedPlaces.delete(L.key(item));closestDistances.delete(L.key(item));const heard=historyReplay||(!parkedCheck?item:null);if(heard){if(!parkedCheck)rememberPlayedPlace(heard);history.record(heard);historyReplay=null;renderHistory();}pending=null;buffer=null;$('play').disabled=true;$('decision').textContent='Player clock advancing';status('Audio player active: '+item.name+'. Sound at the phone/car output is not verified.');lastWaiting='';renderAhead();},
   onEnd(){if(id!==epoch||source!==token)return;source=null;lastEnd=Date.now();$('play').disabled=true;if(parkedCheck){stop('Parked automatic check finished. Only proceed if you heard the clip.');}else if(running){status('Clip finished in the player. Looking ahead for another place.');evaluate();}},
   onPaused(){if(id!==epoch||source!==token)return;$('play').disabled=false;waiting('Audio paused or interrupted','Stop safely and tap Play prepared clip to resume.');},
   onError(message){if(id!==epoch||source!==token)return;source=null;played.delete(L.key(item));pending=item;buffer=clip;$('play').disabled=false;retryAt=Date.now()+30000;waiting('Audio player needs a tap',message);}
  });
 }
 function latchNearby(){
  if(parkedCheck||!fix||Date.now()-fix.time>10000)return;
  for(const item of L.places([...candidates,...(pending?[pending]:[])])){
   const k=L.key(item);if(latchedPlaces.has(k)||!history.check(item).allowed||played.has(L.key(item)))continue;
   const approach=L.approaching(item,fix,movement,played);if(approach?.trigger){latchedPlaces.set(k,item);closestDistances.set(k,approach.metres);log('Queued after entering '+L.PLAYBACK_METRES+' m: '+item.name+' · '+Math.round(approach.metres)+' m. Queued while ahead; a turn away will discard it.');}
  }
 }
 function dropPlacesBehind(){
  if(parkedCheck||!fix||Date.now()-fix.time>10000)return;
  for(const item of L.places([...latchedPlaces.values(),...(pending?[pending]:[])])){
   const key=L.key(item),metres=L.distance(fix,item.coord),closest=Math.min(closestDistances.get(key)??metres,metres);closestDistances.set(key,closest);
   if(!L.movingAway(item,fix,movement)&&metres<=closest+Math.max(100,fix.accuracy*2))continue;
   latchedPlaces.delete(key);closestDistances.delete(key);log('Discarding unplayed '+item.name+': moving away. Looking ahead instead.');
   if(pending&&L.key(pending)===key){audioController?.abort();audioController=null;audioBusy=false;pending=null;buffer=null;retryAt=0;$('play').disabled=true;if(!source){$('next').textContent='Looking ahead';$('timing').textContent='Finding the next place ahead';$('placeName').textContent='';$('placeText').textContent='';$('source').replaceChildren();$('arrivalReview').textContent='';}}
  }
 }
 const isLatched=item=>!!item&&latchedPlaces.has(L.key(item));
 function evaluate(){
 if(!running)return;renderNearbyPlaces();dropPlacesBehind();latchNearby();renderAhead();if(source){fillAhead();return;}
 for(const [key,item]of latchedPlaces)if(played.has(L.key(item))||!history.check(item).allowed)latchedPlaces.delete(key);
 const queued=[...latchedPlaces.values()].filter(item=>audioEligible(item)&&(navigator.onLine!==false||audioReady(item))).sort((a,b)=>fix?L.distance(fix,a.coord)-L.distance(fix,b.coord):0)[0];
 const fresh=fix&&Date.now()-fix.time<=10000;
 if(!fresh){waiting('Fresh GPS needed','Waiting for fresh GPS before choosing or starting another place.');return;}
 const available=candidates.filter(item=>audioEligible(item)&&(navigator.onLine!==false||audioReady(item)));
 const eligible=available.filter(i=>history.check(i).allowed);
 if(pending&&!history.check(pending).allowed){audioController?.abort();audioController=null;audioBusy=false;pending=null;buffer=null;$('play').disabled=true;}
 const best=queued?{item:queued,trigger:true,latched:true}:L.choose(eligible,fix,movement,played);
 if(pending&&best?.trigger&&L.key(best.item)!==L.key(pending)&&(!isLatched(pending)||(fix&&L.distance(fix,best.item.coord)<=L.PLAYBACK_METRES&&(L.distance(fix,pending.coord)>L.PLAYBACK_METRES||(L.distance(fix,best.item.coord)+75<L.distance(fix,pending.coord)))))){
  log('Switching from '+pending.name+' to nearer queued '+best.item.name+'.');audioController?.abort();audioController=null;audioBusy=false;pending=null;buffer=null;retryAt=0;$('play').disabled=true;
 }
 if(pending&&Date.now()<retryAt)return;
 if(pending){const locked=isLatched(pending),approach=locked?{item:pending,metres:fix?L.distance(fix,pending.coord):0,trigger:L.distance(fix,pending.coord)<=L.PLAYBACK_METRES,latched:true}:L.approaching(pending,fix,movement,played,5000);
  if(!approach){closestDistances.delete(L.key(pending));audioController?.abort();pending=null;buffer=null;$('play').disabled=true;}
  else{$('next').textContent=locked?pending.name+' · queued from your '+L.PLAYBACK_METRES+' m approach':nextLabel(approach);if(buffer){fillAhead();if(!approach.trigger)waiting('Outside '+L.PLAYBACK_METRES+' m playback area','Audio is ready for '+pending.name+' · '+Math.round(approach.metres)+' m from the reference point. It will queue when you enter '+L.PLAYBACK_METRES+' m.');else if(Date.now()-lastEnd<20000)waiting('Gap between clips','This place is queued. Waiting for the gap between clips; turning away will discard it.');else play();}else $('decision').textContent=locked?'Place queued; preparing audio':'Preparing voice ahead';return;}}
 if(audioBusy||Date.now()<retryAt)return;
 if(Date.now()-lastEnd<20000){fillAhead();return;}
 const next=best;if(!next){fillAhead();const suppressed=L.choose(available,fix,movement,new Set());if(suppressed&&!history.check(suppressed.item).allowed){const why=history.check(suppressed.item).reason;$('next').textContent=suppressed.item.name+' · '+why;waiting(why,'Skipping '+suppressed.item.name+': '+why+'.');return;}$('next').textContent='No suitable place ahead';waiting(navigator.onLine===false?'No downloaded place in range':!movement?'Direction not established':'No place in range',navigator.onLine===false?'No saved place in range. GPS is working; download the arrival introduction before leaving.':!movement?'Waiting for a clear direction for landmarks. A clear direction is needed for all automatic narration.':'Looking ahead for a nearby place or arrival introduction.');return;}
 pending=next.item;buffer=null;show(pending);$('next').textContent=next.latched?pending.name+' · queued from your '+L.PLAYBACK_METRES+' m approach':nextLabel(next);$('timing').textContent='Preparing ahead…';status('Preparing '+pending.name+'.');prepareCandidate(pending,epoch);
 }
 function position(p,id){if(!running||id!==epoch)return;const c=p.coords,current={lat:c.latitude,lon:c.longitude,accuracy:c.accuracy,speed:c.speed,heading:c.heading,time:p.timestamp};$('accuracy').textContent=Number.isFinite(c.accuracy)?'±'+Math.round(c.accuracy)+' m':'Unavailable';if(Date.now()-current.time>10000||current.time>Date.now()+5000||!L.valid(current)||!Number.isFinite(current.accuracy)||current.accuracy>75){fix=null;movement=null;renderAhead();renderNearbyPlaces();waiting('GPS accuracy or age','Waiting for a fresh GPS fix accurate to about 75 metres or better.');return;}
 fix=current;movement=L.motion(current,lastGood,lastHeading);if(movement&&!movement.stationary)lastHeading=movement.heading;if(!lastGood||L.distance(lastGood,current)>Math.max(12,current.accuracy,lastGood.accuracy)||current.time-lastGood.time>30000)lastGood=current;
 $('speed').textContent=movement?(movement.stationary?'0 mph · last travel direction held':Math.round(movement.speed*2.23694)+' mph'):'Waiting for movement';refreshGuide(current,id);refreshArrivals(current,id);evaluate();}
 async function startTracking(){if(running||preparing)return;if(!navigator.geolocation){status('Location is unavailable in this browser.');return;}try{prime();}catch(error){status(error.message);return;}nativePlayer.stop();$('savedPreview').hidden=true;$('previewLabel').hidden=true;running=true;renderHistory();const id=++epoch;played.clear();latchedPlaces.clear();closestDistances.clear();pending=null;buffer=null;lastHeading=null;lastGood=null;fix=null;movement=null;lastSearch=null;lastSearchTime=0;lastEnd=-Infinity;retryAt=0;arrivalRetry=0;lastArrivalSearch=null;lastArrivalTime=0;guideRetryAt=0;audioRetries.clear();nearbyItems=[];rebuild();renderNearbyPlaces();$('start').disabled=true;$('stop').disabled=false;$('prepare').disabled=true;$('testVoice').disabled=true;$('testAutomatic').disabled=true;$('forget').disabled=true;status('Waiting for precise location permission…');log('V15 · up to 3 clips ahead · '+L.PLAYBACK_METRES+' m forward selection · Driving session started · '+(navigator.onLine===false?'offline':'online'));shell().catch(error=>{$('offlineStatus').textContent=error.message});try{navigator.wakeLock?.request('screen').then(lock=>{if(running&&id===epoch)wakeLock=lock;else lock.release();}).catch(()=>{});}catch{}watch=navigator.geolocation.watchPosition(p=>position(p,id),error=>{if(id!==epoch)return;fix=null;movement=null;renderAhead();renderNearbyPlaces();status('Location unavailable: '+(error.code===1?'allow precise location in your browser settings.':'waiting for GPS.'));log('GPS error '+error.code);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});staleTimer=setInterval(()=>{if(running){if(fix&&Date.now()-fix.time>10000){movement=null;renderAhead();renderNearbyPlaces();if(!source&&!latchedPlaces.size)waiting('GPS fix is old','GPS fix is old. Waiting before selecting another place.');}if(latchedPlaces.size)evaluate();}},2000);}
 function stop(message='Driving test stopped.'){clearTimeout(parkedTimer);parkedTimer=null;parkedCheck=false;historyReplay=null;latchedPlaces.clear();closestDistances.clear();starting=false;running=false;aheadJob?.controller.abort();aheadJob=null;lastHeading=null;downloadController?.abort();renderHistory();epoch++;if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;clearInterval(staleTimer);guideController?.abort();audioController?.abort();arrivalController?.abort();arrivalController=null;arrivalBusy=false;guideController=null;audioController=null;guideBusy=false;audioBusy=false;source=null;nativePlayer.stop();pending=null;buffer=null;$('play').disabled=true;wakeLock?.release().catch(()=>{});wakeLock=null;$('start').disabled=false;$('start').textContent='Start journey with sound';$('stop').disabled=true;$('prepare').disabled=false;$('testVoice').disabled=false;$('testAutomatic').disabled=false;$('forget').disabled=false;$('decision').textContent='Stopped';renderAhead();renderNearbyPlaces();renderMore();status(message);log(message);}
 function start(){
  if(running||preparing||starting)return;if(!navigator.geolocation){status('Location is unavailable in this browser.');return;}
  starting=true;renderMore();const id=++epoch;prime();$('start').disabled=true;$('stop').disabled=false;$('prepare').disabled=true;$('testVoice').disabled=true;$('testAutomatic').disabled=true;$('forget').disabled=true;renderHistory();$('previewLabel').hidden=false;$('previewLabel').textContent='Journey sound';status('You should hear two short notes. GPS starts after the chime. Stay parked if you hear nothing.');log('V15 Start tapped: local chime requested directly from the button gesture; no download required.');
  nativePlayer.play(L.startChime(),{onProgress(){if(id===epoch&&starting)status('Start chime player is active. Stay parked if the notes are silent.');},onEnd(){if(id!==epoch||!starting)return;starting=false;log('Start chime finished; starting GPS automatically.');startTracking();},onPaused(){if(id===epoch&&starting)status('Startup was paused. Stop, then tap Start journey again while parked.');},onError(message){if(id!==epoch||!starting)return;starting=false;stop('Sound could not start: '+message);}});
 }
 $('start').onclick=start;$('stop').onclick=()=>stop();$('play').onclick=()=>{prime();play(true);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||starting))stop('Test paused because the page was hidden. Tap Start when safely parked to resume.');});
 window.addEventListener('pagehide',()=>{downloadController?.abort();if(running||starting)stop();});window.addEventListener('online',()=>{connection();retryAt=0;guideRetryAt=0;audioRetries.clear();lastSearch=null;evaluate();});window.addEventListener('offline',()=>{connection();aheadJob?.controller.abort();if(running&&!source&&!buffer){audioController?.abort();audioController=null;audioBusy=false;pending=null;}evaluate();});
 $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(events.join('\n'));$('copy').textContent='Copied';}catch{$('copy').textContent='Select and copy the results below';}};

 async function refreshArrivals(current,id){
  if(arrivalBusy||navigator.onLine===false||Date.now()<arrivalRetry)return;
  if(lastArrivalSearch&&(Date.now()-lastArrivalTime<60000||L.distance(lastArrivalSearch,current)<1000))return;
  arrivalBusy=true;const controller=arrivalController=new AbortController(),timer=timeout(controller,35000);lastArrivalTime=Date.now();
  try{const result=await json('/api/arrivals',{lat:Number(current.lat.toFixed(3)),lon:Number(current.lon.toFixed(3)),known:arrivalItems.filter(i=>i.profileVersion===5&&currentArrival(i)).map(i=>i.pageId)},controller.signal);if(!running||id!==epoch)return;lastArrivalSearch=current;const merged=new Map(arrivalItems.filter(currentArrival).map(i=>[i.id,i]));for(const i of result.items||[])if(currentArrival(i))merged.set(i.id,i);arrivalItems=[...merged.values()].slice(-32);storage('put',arrivalItems,'arrivals').catch(()=>{});rebuild();if(result.items?.length)log('Arrival introductions ready: '+result.items.map(i=>i.placeName).join(', ')+'. Annual source review when used.');evaluate();}
  catch(error){if(running&&id===epoch){arrivalRetry=Date.now()+60000;log('Arrival lookup unavailable: '+error.message+' Using saved introductions where available.');}}
  finally{clearTimeout(timer);if(arrivalController===controller){arrivalBusy=false;arrivalController=null;}}
 }
 $('testVoice').onclick=async()=>{
  if(running||preparing)return;prime();preparing=true;renderHistory();$('testVoice').disabled=true;$('testAutomatic').disabled=true;$('prepare').disabled=true;$('start').disabled=true;const controller=downloadController=new AbortController(),timer=timeout(controller,190000);$('cancelPrepare').disabled=false;status('Checking Pippa. The first preparation can take a while…');
  try{const result=await audio({kind:'arrival',reason:'Hello Mike. Discover Places is ready for your Buxton test. Please confirm you can hear Pippa before driving.'},controller.signal);voiceCheckBlob=result.blob;$('previewLabel').hidden=false;$('previewLabel').textContent='Pippa check — use these same controls for the journey:';nativePlayer.play(result.blob,{onError:message=>status(message),onProgress:()=>status('The preview player is active. When finished, use Start journey with sound; no separate confirmation is needed.')});status('Pippa is prepared. Press Play on the audio controls if needed. Confirm below only when you hear her.');log('Pippa check prepared in '+result.seconds.toFixed(1)+' seconds. Native media player; audibility not yet confirmed.');}
  catch(error){status('Pippa check failed: '+error.message);log('Pippa check failed: '+error.message);}
  finally{clearTimeout(timer);downloadController=null;preparing=false;renderHistory();$('testVoice').disabled=false;$('testAutomatic').disabled=false;$('prepare').disabled=false;$('start').disabled=false;$('cancelPrepare').disabled=true;}
 };
 $('testAutomatic').onclick=()=>{
  if(running||preparing||starting)return;
  const savedItem=trip.items.find(i=>trip.audio[L.key(i)]&&(i.kind!=='arrival'||currentArrival(i))),clip=savedItem?trip.audio[L.key(savedItem)]:voiceCheckBlob;
  if(!clip){status('Prepare a saved trip or run Check Pippa first, then try this parked check.');return;}
  nativePlayer.stop();prime();running=true;parkedCheck=true;historyReplay=null;renderHistory();++epoch;played.clear();latchedPlaces.clear();closestDistances.clear();source=null;pending={...(savedItem||{}),id:'parked-automatic-check',kind:'arrival',name:'Parked check: '+(savedItem?.name||'Pippa'),reason:savedItem?.reason||'Pippa automatic playback check',coord:savedItem?.coord||{lat:0,lon:0},arrivalRadiusM:100,prepareRadiusM:500};buffer=clip;movement=null;lastEnd=-Infinity;retryAt=0;
  $('start').disabled=true;$('stop').disabled=false;$('prepare').disabled=true;$('testVoice').disabled=true;$('testAutomatic').disabled=true;$('forget').disabled=true;$('play').disabled=true;
  log('Parked automatic check: simulated arrival only; GPS tracking is off. A saved clip will be requested in 5 seconds without another tap.');status('Remain parked. The saved clip should start automatically in 5 seconds.');$('decision').textContent='Parked automatic check countdown';
  parkedTimer=setTimeout(()=>{parkedTimer=null;if(!running||!parkedCheck)return;fix={...pending.coord,accuracy:1,time:Date.now(),speed:0,heading:null};play();},5000);
 };

 storage('get',undefined,'arrivals').then(value=>{if(Array.isArray(value))arrivalItems=value.filter(currentArrival).slice(-32);if(running){rebuild();evaluate();}}).catch(()=>{});

 storage('get').then(value=>{if(value?.items&&value?.audio){trip=value;if(value.welcomeAudio)voiceCheckBlob=value.welcomeAudio;}saved();}).catch(()=>{$('savedStatus').textContent='This browser cannot save an offline trip. Online testing is still available.';}).finally(()=>{if(!preparing&&!running)$('start').disabled=false;});connection();renderHistory();
})();
