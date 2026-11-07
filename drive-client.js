'use strict';
(()=>{
 const $=id=>document.getElementById(id),L=globalThis.DriveLogic;
 let trip={items:[],audio:{},savedAt:null},running=false,watch=null,epoch=0,preparing=false,downloadController=null,guideController=null,audioController=null;
 let source,wakeLock,lastHeading=null,lastGood=null,fix=null,movement=null,pending=null,buffer=null,audioBusy=false,lastEnd=-Infinity,lastSearch=null,lastSearchTime=0,retryAt=0,guideBusy=false,staleTimer;
 const played=new Set(),latchedPlaces=new Map(),closestDistances=new Map(),buffers=new Map(),events=[];let previewURL,arrivalItems=[],arrivalBusy=false,arrivalController=null,lastArrivalSearch=null,lastArrivalTime=0,arrivalRetry=0,lastWaiting='';let nearbyItems=[];
 const nativePlayer=globalThis.createDrivePlayer({element:$('savedPreview'),log:message=>log(message)});let voiceCheckBlob=null,parkedCheck=false,parkedTimer=null,historyReplay=null,starting=false;
 const history=globalThis.DriveHistory.createDriveHistory({onWarning:message=>{$('historyWarning').textContent=message;}});
 function log(message){events.push(new Date().toLocaleTimeString('en-GB')+' '+message);if(events.length>100)events.shift();$('log').textContent=events.join('\n');}
 function status(message){$('status').textContent=message;}
 function waiting(reason,message){$('decision').textContent=reason;status(message);if(lastWaiting!==reason){lastWaiting=reason;log('Waiting: '+reason);}}
 const currentArrival=i=>i?.kind==='arrival'&&(i.profileVersion===3||i.profileVersion===4)&&L.valid(i.coord)&&typeof i.reason==='string'&&Date.parse(i.reviewAfter)>Date.now();
 function rebuild(){candidates=L.places([...arrivalItems.filter(currentArrival),...trip.items.filter(i=>i.kind!=='arrival'||currentArrival(i)),...nearbyItems]);}
 function nextLabel(approach){return approach.item.name+' · '+Math.round(approach.metres)+' m'+(approach.arrival?' from the reference point · plays within 500 m': approach.eta===null?' · stopped; last travel direction held':' · about '+Math.round(approach.eta)+' s');}
 function connection(){const c=navigator.connection;$('connection').textContent=navigator.onLine===false?'Offline: using downloaded information and audio only.':'Connection available'+(c?.effectiveType?' · browser estimate '+c.effectiveType:'')+'. Actual preparation times are measured below.';}
 const db=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('discover-driving-test',2);r.onupgradeneeded=()=>{for(const name of ['trip','arrivals'])if(!r.result.objectStoreNames.contains(name))r.result.createObjectStore(name);};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 async function storage(action,value,namespace='trip'){const d=await db();try{return await new Promise((resolve,reject)=>{const tx=d.transaction(namespace,action==='get'?'readonly':'readwrite'),store=tx.objectStore(namespace);let result;const r=action==='get'?store.get('current'):action==='delete'?store.delete('current'):store.put(value,'current');r.onsuccess=()=>{result=r.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Save cancelled'));});}finally{d.close();}}
 function saved(){const sample=trip.items.find(i=>trip.audio[L.key(i)]&&(i.kind!=='arrival'||currentArrival(i)));if(previewURL)URL.revokeObjectURL(previewURL);$('savedPreview').hidden=!sample;$('previewLabel').hidden=!sample;if(sample){previewURL=URL.createObjectURL(trip.audio[L.key(sample)]);$('savedPreview').src=previewURL;}else $('savedPreview').removeAttribute('src');const count=trip.items.filter(i=>trip.audio[L.key(i)]).length;$('savedStatus').textContent=trip.savedAt?`${count} clips saved on this phone for ${trip.label}. Saved ${new Date(trip.savedAt).toLocaleString('en-GB')}.`:'No offline clips saved yet.';if(trip.savedAt&&!trip.items.some(i=>i.kind==='arrival'))$('savedStatus').textContent+=' No arrival introduction is saved. Prepare again while connected to add one.';if(trip.items.some(i=>i.kind==='arrival'&&!currentArrival(i)))$('savedStatus').textContent+=' An arrival introduction needs updating or its annual review. Prepare again while connected.';}
 async function shell(){if(!('serviceWorker'in navigator))throw Error('Offline page saving is unavailable in this browser.');const r=await navigator.serviceWorker.register('/drive-test-sw.js',{scope:'/drive-test'});const worker=r.installing||r.waiting||r.active;if(!worker)throw Error('Offline page could not be saved.');if(worker.state!=='activated')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Offline page setup took too long. Try again.')),30000);worker.addEventListener('statechange',()=>{if(worker.state==='activated'){clearTimeout(timer);resolve();}if(worker.state==='redundant'){clearTimeout(timer);reject(Error('Offline page saving failed.'));}});});$('offlineStatus').textContent='The driving test page is saved for offline reopening at this address.';}
 async function json(url,body,signal){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal});const data=await r.json();if(!r.ok)throw Error(data.error||'Request failed ('+r.status+').');return data;}
 async function guide(input,signal,onPreview=()=>{}){const end=Date.now()+120000;while(true){const data=await json('/api/explore',{...input,progressive:true,specialists:false},signal);onPreview(data);if(data.complete!==false)return data;if(Date.now()>end)throw Error('Guide preparation took too long. Try again while connected.');await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new DOMException('Cancelled','AbortError'))},timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},1500);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();});}}
 let voice;
 async function audio(item,signal){const started=performance.now();if(!voice){const r=await fetch('/voices',{signal});if(!r.ok)throw Error('Pippa is unavailable.');voice=(await r.json()).defaultVoice;}
 const r=await fetch('/speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:L.opening(item),voice}),signal});if(!r.ok){const data=await r.json();throw Error(data.error||'Pippa could not prepare this clip.');}const blob=await r.blob();if(blob.size>6*1024*1024||!blob.size)throw Error('Unexpected audio size.');return {blob,seconds:(performance.now()-started)/1000};}
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
 try{const selected=await destination(place,controller.signal);if(!selected)return;await shell();$('savedStatus').textContent='Finding places near '+selected+'…';const g=await guide({place:selected},controller.signal);let arrivals=[];try{arrivals=(await json('/api/arrivals',{place:g.location.label},controller.signal)).items||[];}catch(error){if(controller.signal.aborted)throw error;log('Arrival introduction not downloaded: '+error.message);}const items=L.places([...arrivals,...g.items]).sort((a,b)=>Number(b.kind==='arrival')-Number(a.kind==='arrival')||(a.distanceKm||0)-(b.distanceKm||0)).slice(0,9);if(!items.length)throw Error('No places with usable coordinates were found. Try a nearby town.');const next={label:g.location.label,items:[],audio:{},savedAt:new Date().toISOString()},failures=[];let total=0;

 for(const item of items){if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');$('savedStatus').textContent=`Saving Pippa: ${next.items.length+1} of ${items.length} · ${item.name}. The first clip may take a while…`;try{const a=await audio(item,controller.signal);if(total+a.blob.size>24*1024*1024)break;total+=a.blob.size;next.items.push(item);next.audio[L.key(item)]=a.blob;log('Downloaded '+item.name+' · '+a.seconds.toFixed(1)+' seconds');}catch(error){if(controller.signal.aborted)throw error;failures.push(item.name);log('Download failed: '+item.name+' · '+error.message);}}
 if(!next.items.length)throw Error('No audio could be saved. Your previous saved trip is unchanged.');await storage('put',next);trip=next;buffers.clear();saved();if(failures.length)$('savedStatus').textContent+=' '+failures.length+' clips could not be saved.';log('Offline trip saved: '+next.items.length+' clips.');
 }catch(error){$('savedStatus').textContent=(controller.signal.aborted?'Download cancelled or timed out.':error.message)+' Previous saved clips remain available.';log('Preparation stopped: '+error.message);}
 finally{clearTimeout(timer);downloadController=null;preparing=false;renderHistory();$('testVoice').disabled=false;$('testAutomatic').disabled=false;$('prepare').disabled=false;$('start').disabled=false;$('forget').disabled=false;$('cancelPrepare').disabled=true;}
 };
 $('cancelPrepare').onclick=()=>downloadController?.abort();
 $('forget').onclick=async()=>{if(running||preparing)return;try{nativePlayer.stop({release:true});await storage('delete');trip={items:[],audio:{}};buffers.clear();saved();log('Saved trip deleted.');}catch{status('Saved trip could not be deleted.');}};
 function prime(){try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}}
 async function decoded(item,blob){const key=L.key(item);if(buffers.has(key))return buffers.get(key);if(!blob?.size)throw Error('The audio clip is empty.');buffers.set(key,blob);while(buffers.size>10||[...buffers.values()].reduce((sum,b)=>sum+b.size,0)>24*1024*1024)buffers.delete(buffers.keys().next().value);return blob;}
 let candidates=[];
 const AHEAD_CLIPS=3;
 let aheadJob=null,aheadRetryAt=0;
 function aheadPlaces(){
  if(!fix||Date.now()-fix.time>10000||!movement)return [];
  return candidates.filter(item=>history.check(item).allowed&&(!source||L.key(source.item)!==L.key(item)))
   .map(item=>L.approaching(item,fix,movement,played,5000)).filter(Boolean)
   .sort((a,b)=>a.metres-b.metres).slice(0,AHEAD_CLIPS).map(approach=>approach.item);
 }
 function fillAhead(){
  if(!running||parkedCheck)return;
  const items=aheadPlaces();
  const ready=items.filter(item=>buffers.has(L.key(item))||trip.audio[L.key(item)]).length;
  $('ahead').textContent=ready+' of up to '+AHEAD_CLIPS+' clips ready';
  if(aheadJob&&!items.some(item=>L.key(item)===aheadJob.key))aheadJob.controller.abort();
  if(aheadJob||audioBusy||navigator.onLine===false||Date.now()<aheadRetryAt)return;
  const item=items.find(item=>!buffers.has(L.key(item))&&!trip.audio[L.key(item)]);
  if(!item)return;
  const id=epoch,controller=new AbortController();
  const job={key:L.key(item),controller,task:null,timedOut:false};aheadJob=job;
  const timer=setTimeout(()=>{job.timedOut=true;controller.abort();},190000);
  log('Preparing audio buffer: '+item.name);
  job.task=audio(item,controller.signal).then(async result=>{
   if(!running||id!==epoch||controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
   await decoded(item,result.blob);
   log('Buffered audio ready: '+item.name+' · '+result.seconds.toFixed(1)+' seconds');
   return result;
  });
  job.task.catch(error=>{
   if(running&&id===epoch&&(!controller.signal.aborted||job.timedOut)){aheadRetryAt=Date.now()+30000;log('Audio buffer waiting for connection: '+error.message);}
  }).finally(()=>{
   clearTimeout(timer);
   if(aheadJob===job){aheadJob=null;if(running&&id===epoch)evaluate();}
  });
 }

 async function refreshGuide(current,id){
 if(guideBusy||navigator.onLine===false||Date.now()<retryAt)return;
 if(lastSearch&&Date.now()-lastSearchTime<90000)return;
 if(lastSearch&&L.distance(lastSearch,current)<1200)return;
 guideBusy=true;const controller=guideController=new AbortController(),timer=timeout(controller,125000);lastSearchTime=Date.now();const started=performance.now();
 try{await guide({lat:Number(current.lat.toFixed(3)),lon:Number(current.lon.toFixed(3))},controller.signal,g=>{if(!running||id!==epoch)return;nearbyItems=g.items;rebuild();evaluate();});if(running&&id===epoch){lastSearch=current;log('Nearby guide prepared in '+((performance.now()-started)/1000).toFixed(1)+' seconds.');}}
 catch(error){if(running&&id===epoch){retryAt=Date.now()+60000;log('Nearby guide unavailable; using saved places. '+error.message);}}
 finally{clearTimeout(timer);if(guideController===controller){guideBusy=false;guideController=null;}}
 }
 async function prepareCandidate(item,id){
 audioBusy=true;const key=L.key(item),controller=audioController=new AbortController(),timer=timeout(controller,190000);
 try{let blob=trip.audio[key];if(buffers.has(key)){if(id!==epoch||!running||pending!==item)return;buffer=buffers.get(key);$('timing').textContent='Ready · prepared earlier this session';log('Reusing prepared audio: '+item.name);}else if(blob){const b=await decoded(item,blob);if(id!==epoch||!running||pending!==item)return;buffer=b;$('timing').textContent='Ready · saved on this phone';log('Using saved audio: '+item.name);}else{if(navigator.onLine===false)throw Error('No saved audio for this place.');let a;
 if(aheadJob?.key===key){const job=aheadJob;controller.signal.addEventListener('abort',()=>job.controller.abort(),{once:true});a=await job.task;}
 else{aheadJob?.controller.abort();a=await audio(item,controller.signal);}
 const b=await decoded(item,a.blob);if(id!==epoch||!running||pending!==item)return;buffer=b;$('timing').textContent=a.seconds.toFixed(1)+' seconds · ready';log('Audio ready: '+item.name+' · '+a.seconds.toFixed(1)+' seconds');}if(id===epoch&&running){$('play').disabled=false;evaluate();}}
 catch(error){if(id===epoch&&running&&pending===item&&!controller.signal.aborted){log('Audio unavailable: '+item.name+' · '+error.message);pending=null;buffer=null;retryAt=Date.now()+30000;status('Waiting for downloaded audio or a connection.');}}
 finally{clearTimeout(timer);if(audioController===controller){audioBusy=false;audioController=null;if(running&&id===epoch)evaluate();}}
 }
 function renderHistory(){
  const snapshot=history.snapshot();$('skipFamiliar').checked=snapshot.skipFamiliar;$('skipFamiliar').disabled=running||preparing||starting;$('resetHistory').disabled=running||preparing||starting;$('historyList').replaceChildren();
  $('historyStatus').textContent=snapshot.places.length+' places remembered on this browser. Each plays at most once per local calendar day.';
  for(const entry of snapshot.places){const row=document.createElement('p'),label=document.createElement('span'),button=document.createElement('button');label.textContent=entry.name+' · '+entry.count+' plays · last '+entry.lastDay+(entry.allowOnce?' · one replay allowed':'')+' ';button.type='button';button.className='secondary';button.textContent='Hear this place again';button.disabled=running||preparing||starting;button.onclick=()=>replayPlace(entry.key);row.append(label,button);$('historyList').append(row);}
 }
 function replayPlace(key){
  if(running||preparing)return;history.allowOnce(key);for(const item of [...trip.items,...arrivalItems,...nearbyItems])if(history.key(item)===key)played.delete(L.key(item));renderHistory();
  const item=[...trip.items,...arrivalItems,...nearbyItems].find(i=>history.key(i)===key&&(i.kind!=='arrival'||currentArrival(i))&&(trip.audio[L.key(i)]||buffers.has(L.key(i))));
  if(!item){status('One replay is allowed when this place is next available and you pass within 500 metres.');return;}
  nativePlayer.stop();prime();running=true;parkedCheck=true;historyReplay=item;++epoch;source=null;pending=item;buffer=trip.audio[L.key(item)]||buffers.get(L.key(item));lastEnd=-Infinity;retryAt=0;
  $('start').disabled=true;$('stop').disabled=false;$('prepare').disabled=true;$('testVoice').disabled=true;$('testAutomatic').disabled=true;$('forget').disabled=true;renderHistory();log('Listener requested a replay: '+item.name);play(true);
 }
 $('skipFamiliar').onchange=()=>{if(running||preparing)return;history.setSkipFamiliar($('skipFamiliar').checked);renderHistory();};
 $('resetHistory').onclick=()=>{if(running||preparing)return;history.clear();played.clear();latchedPlaces.clear();closestDistances.clear();renderHistory();status('Listening history reset. Places may play again on the next journey.');log('Listener reset listening history.');};
 function show(item){$('arrivalReview').textContent=item.kind==='arrival'?'Source checked '+new Date(item.checkedAt).toLocaleDateString('en-GB')+' · annual review after '+new Date(item.reviewAfter).toLocaleDateString('en-GB')+'. Food and stays in this app remain a Buxton/Tideswell trial.':'';$('placeName').textContent=item.name;$('placeText').textContent=L.opening(item);$('source').replaceChildren();for(const source of item.sources||[item.source]){if(!/^https:\/\//.test(source?.url||''))continue;const a=document.createElement('a');a.href=source.url;a.textContent='Source: '+(source.title||item.name)+' ↗ ';a.target='_blank';a.rel='noopener';$('source').append(a);}}
 function play(manual=false){
  if(!running)return;if(source){if(manual)nativePlayer.resume();return;}if(!buffer||!pending)return;
  if(!parkedCheck&&!history.check(pending).allowed){const reason=history.check(pending).reason;waiting(reason,'Skipping '+pending.name+': '+reason+'. Use Hear this place again while parked to allow a replay.');pending=null;buffer=null;$('play').disabled=true;return;}
  if(!manual&&!parkedCheck&&(!fix||Date.now()-fix.time>10000||L.movingAway(pending,fix,movement)))return;
  if(!manual&&!parkedCheck&&!isLatched(pending)&&(!fix||Date.now()-fix.time>10000||!L.approaching(pending,fix,movement,played)?.trigger))return;
  const item=pending,clip=buffer,id=epoch,token=source={item};prime();show(item);$('play').disabled=false;$('previewLabel').hidden=false;$('previewLabel').textContent='Journey audio — this uses the same player as the Pippa check:';
  log((manual?'Manual playback requested: ':'Automatic playback requested: ')+item.name);status('Starting the audio player for '+item.name+'…');
  nativePlayer.play(clip,{
   onProgress(){if(!running||id!==epoch||source!==token)return;played.add(L.key(item));latchedPlaces.delete(L.key(item));closestDistances.delete(L.key(item));const heard=historyReplay||(!parkedCheck?item:null);if(heard){history.record(heard);historyReplay=null;renderHistory();}pending=null;buffer=null;$('play').disabled=true;$('decision').textContent='Player clock advancing';status('Audio player active: '+item.name+'. Sound at the phone/car output is not verified.');lastWaiting='';},
   onEnd(){if(id!==epoch||source!==token)return;source=null;lastEnd=Date.now();$('play').disabled=true;if(parkedCheck){stop('Parked automatic check finished. Only proceed if you heard the clip.');}else if(running)status('Clip finished in the player. Looking ahead for another place.');},
   onPaused(){if(id!==epoch||source!==token)return;$('play').disabled=false;waiting('Audio paused or interrupted','Stop safely and tap Play prepared clip to resume.');},
   onError(message){if(id!==epoch||source!==token)return;source=null;played.delete(L.key(item));pending=item;buffer=clip;$('play').disabled=false;retryAt=Date.now()+30000;waiting('Audio player needs a tap',message);}
  });
 }
 function latchNearby(){
  if(parkedCheck||!fix||Date.now()-fix.time>10000)return;
  for(const item of L.places([...candidates,...(pending?[pending]:[])])){
   const k=L.key(item);if(latchedPlaces.has(k)||!history.check(item).allowed||played.has(L.key(item)))continue;
   const approach=L.approaching(item,fix,movement,played);if(approach?.trigger){latchedPlaces.set(k,item);closestDistances.set(k,approach.metres);log('Queued after entering 500 m: '+item.name+' · '+Math.round(approach.metres)+' m. Queued while ahead; a turn away will discard it.');}
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
 if(!running)return;dropPlacesBehind();latchNearby();if(source){fillAhead();return;}
 for(const [key,item]of latchedPlaces)if(played.has(L.key(item))||!history.check(item).allowed)latchedPlaces.delete(key);
 const queued=[...latchedPlaces.values()].filter(item=>navigator.onLine!==false||trip.audio[L.key(item)]||buffers.has(L.key(item))).sort((a,b)=>fix?L.distance(fix,a.coord)-L.distance(fix,b.coord):0)[0];
 const fresh=fix&&Date.now()-fix.time<=10000;
 if(!fresh){waiting('Fresh GPS needed','Waiting for fresh GPS before choosing or starting another place.');return;}
 const available=navigator.onLine===false?candidates.filter(i=>trip.audio[L.key(i)]||buffers.has(L.key(i))):candidates;
 const eligible=available.filter(i=>history.check(i).allowed);
 if(pending&&!history.check(pending).allowed){audioController?.abort();audioController=null;audioBusy=false;pending=null;buffer=null;$('play').disabled=true;}
 const best=queued?{item:queued,trigger:true,latched:true}:L.choose(eligible,fix,movement,played);
 if(pending&&best?.trigger&&L.key(best.item)!==L.key(pending)&&(!isLatched(pending)||(fix&&L.distance(fix,best.item.coord)<=L.PLAYBACK_METRES&&(L.distance(fix,pending.coord)>L.PLAYBACK_METRES||(L.distance(fix,best.item.coord)+75<L.distance(fix,pending.coord)))))){
  log('Switching from '+pending.name+' to nearer queued '+best.item.name+'.');audioController?.abort();audioController=null;audioBusy=false;pending=null;buffer=null;retryAt=0;$('play').disabled=true;
 }
 if(pending&&Date.now()<retryAt)return;
 if(pending){const locked=isLatched(pending),approach=locked?{item:pending,metres:fix?L.distance(fix,pending.coord):0,trigger:true,latched:true}:L.approaching(pending,fix,movement,played);
  if(!approach){closestDistances.delete(L.key(pending));audioController?.abort();pending=null;buffer=null;$('play').disabled=true;}
  else{$('next').textContent=locked?pending.name+' · queued from your 500 m approach':nextLabel(approach);if(buffer){fillAhead();if(!approach.trigger)waiting('Outside 500 m playback area','Audio is ready for '+pending.name+' · '+Math.round(approach.metres)+' m from the reference point. It will queue when you enter 500 m.');else if(Date.now()-lastEnd<20000)waiting('Gap between clips','This place is queued. Waiting for the gap between clips; turning away will discard it.');else play();}else $('decision').textContent=locked?'Place queued; preparing audio':'Preparing voice ahead';return;}}
 if(audioBusy||Date.now()<retryAt||Date.now()-lastEnd<20000)return;
 const next=best;if(!next){fillAhead();const suppressed=L.choose(available,fix,movement,new Set());if(suppressed&&!history.check(suppressed.item).allowed){const why=history.check(suppressed.item).reason;$('next').textContent=suppressed.item.name+' · '+why;waiting(why,'Skipping '+suppressed.item.name+': '+why+'.');return;}$('next').textContent='No suitable place ahead';waiting(navigator.onLine===false?'No downloaded place in range':!movement?'Direction not established':'No place in range',navigator.onLine===false?'No saved place in range. GPS is working; download the arrival introduction before leaving.':!movement?'Waiting for a clear direction for landmarks. A clear direction is needed for all automatic narration.':'Looking ahead for a nearby place or arrival introduction.');return;}
 pending=next.item;buffer=null;show(pending);$('next').textContent=next.latched?pending.name+' · queued from your 500 m approach':nextLabel(next);$('timing').textContent='Preparing ahead…';status('Preparing '+pending.name+'.');prepareCandidate(pending,epoch);
 }
 function position(p,id){if(!running||id!==epoch)return;const c=p.coords,current={lat:c.latitude,lon:c.longitude,accuracy:c.accuracy,speed:c.speed,heading:c.heading,time:p.timestamp};$('accuracy').textContent=Number.isFinite(c.accuracy)?'±'+Math.round(c.accuracy)+' m':'Unavailable';if(Date.now()-current.time>10000||current.time>Date.now()+5000||!L.valid(current)||!Number.isFinite(current.accuracy)||current.accuracy>75){fix=null;movement=null;waiting('GPS accuracy or age','Waiting for a fresh GPS fix accurate to about 75 metres or better.');return;}
 fix=current;movement=L.motion(current,lastGood,lastHeading);if(movement&&!movement.stationary)lastHeading=movement.heading;if(!lastGood||L.distance(lastGood,current)>Math.max(12,current.accuracy,lastGood.accuracy)||current.time-lastGood.time>30000)lastGood=current;
 $('speed').textContent=movement?(movement.stationary?'0 mph · last travel direction held':Math.round(movement.speed*2.23694)+' mph'):'Waiting for movement';refreshGuide(current,id);refreshArrivals(current,id);evaluate();}
 async function startTracking(){if(running||preparing)return;if(!navigator.geolocation){status('Location is unavailable in this browser.');return;}try{prime();}catch(error){status(error.message);return;}nativePlayer.stop();$('savedPreview').hidden=true;$('previewLabel').hidden=true;running=true;renderHistory();const id=++epoch;played.clear();latchedPlaces.clear();closestDistances.clear();pending=null;buffer=null;lastHeading=null;lastGood=null;fix=null;movement=null;lastSearch=null;lastSearchTime=0;lastEnd=-Infinity;retryAt=0;arrivalRetry=0;lastArrivalSearch=null;lastArrivalTime=0;aheadRetryAt=0;nearbyItems=[];rebuild();$('start').disabled=true;$('stop').disabled=false;$('prepare').disabled=true;$('testVoice').disabled=true;$('testAutomatic').disabled=true;$('forget').disabled=true;status('Waiting for precise location permission…');log('V10 · 3 clips prepared ahead · 500 m forward selection · Driving session started · '+(navigator.onLine===false?'offline':'online'));shell().catch(error=>{$('offlineStatus').textContent=error.message});try{navigator.wakeLock?.request('screen').then(lock=>{if(running&&id===epoch)wakeLock=lock;else lock.release();}).catch(()=>{});}catch{}watch=navigator.geolocation.watchPosition(p=>position(p,id),error=>{if(id!==epoch)return;fix=null;movement=null;status('Location unavailable: '+(error.code===1?'allow precise location in your browser settings.':'waiting for GPS.'));log('GPS error '+error.code);},{enableHighAccuracy:true,maximumAge:0,timeout:15000});staleTimer=setInterval(()=>{if(running){if(fix&&Date.now()-fix.time>10000){movement=null;if(!source&&!latchedPlaces.size)waiting('GPS fix is old','GPS fix is old. Waiting before selecting another place.');}if(latchedPlaces.size)evaluate();}},2000);}
 function stop(message='Driving test stopped.'){clearTimeout(parkedTimer);parkedTimer=null;parkedCheck=false;historyReplay=null;latchedPlaces.clear();closestDistances.clear();starting=false;running=false;aheadJob?.controller.abort();aheadJob=null;lastHeading=null;downloadController?.abort();renderHistory();epoch++;if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;clearInterval(staleTimer);guideController?.abort();audioController?.abort();arrivalController?.abort();arrivalController=null;arrivalBusy=false;guideController=null;audioController=null;guideBusy=false;audioBusy=false;source=null;nativePlayer.stop();pending=null;buffer=null;$('play').disabled=true;wakeLock?.release().catch(()=>{});wakeLock=null;$('start').disabled=false;$('start').textContent='Start journey with sound';$('stop').disabled=true;$('prepare').disabled=false;$('testVoice').disabled=false;$('testAutomatic').disabled=false;$('forget').disabled=false;$('decision').textContent='Stopped';status(message);log(message);}
 function start(){
  if(running||preparing||starting)return;if(!navigator.geolocation){status('Location is unavailable in this browser.');return;}
  starting=true;const id=++epoch;prime();$('start').disabled=true;$('stop').disabled=false;$('prepare').disabled=true;$('testVoice').disabled=true;$('testAutomatic').disabled=true;$('forget').disabled=true;renderHistory();$('previewLabel').hidden=false;$('previewLabel').textContent='Journey sound';status('You should hear two short notes. GPS starts after the chime. Stay parked if you hear nothing.');log('V10 Start tapped: local chime requested directly from the button gesture; no download required.');
  nativePlayer.play(L.startChime(),{onProgress(){if(id===epoch&&starting)status('Start chime player is active. Stay parked if the notes are silent.');},onEnd(){if(id!==epoch||!starting)return;starting=false;log('Start chime finished; starting GPS automatically.');startTracking();},onPaused(){if(id===epoch&&starting)status('Startup was paused. Stop, then tap Start journey again while parked.');},onError(message){if(id!==epoch||!starting)return;starting=false;stop('Sound could not start: '+message);}});
 }
 $('start').onclick=start;$('stop').onclick=()=>stop();$('play').onclick=()=>{prime();play(true);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&(running||starting))stop('Test paused because the page was hidden. Tap Start when safely parked to resume.');});
 window.addEventListener('pagehide',()=>{downloadController?.abort();if(running||starting)stop();});window.addEventListener('online',()=>{connection();retryAt=0;aheadRetryAt=0;lastSearch=null;evaluate();});window.addEventListener('offline',()=>{connection();aheadJob?.controller.abort();if(running&&!source&&!buffer){audioController?.abort();audioController=null;audioBusy=false;pending=null;}evaluate();});
 $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(events.join('\n'));$('copy').textContent='Copied';}catch{$('copy').textContent='Select and copy the results below';}};

 async function refreshArrivals(current,id){
  if(arrivalBusy||navigator.onLine===false||Date.now()<arrivalRetry)return;
  if(lastArrivalSearch&&(Date.now()-lastArrivalTime<60000||L.distance(lastArrivalSearch,current)<1000))return;
  arrivalBusy=true;const controller=arrivalController=new AbortController(),timer=timeout(controller,35000);lastArrivalTime=Date.now();
  try{const result=await json('/api/arrivals',{lat:Number(current.lat.toFixed(3)),lon:Number(current.lon.toFixed(3)),known:arrivalItems.filter(i=>i.profileVersion===4&&currentArrival(i)).map(i=>i.pageId)},controller.signal);if(!running||id!==epoch)return;lastArrivalSearch=current;const merged=new Map(arrivalItems.filter(currentArrival).map(i=>[i.id,i]));for(const i of result.items||[])if(currentArrival(i))merged.set(i.id,i);arrivalItems=[...merged.values()].slice(-32);storage('put',arrivalItems,'arrivals').catch(()=>{});rebuild();if(result.items?.length)log('Arrival introductions ready: '+result.items.map(i=>i.placeName).join(', ')+'. Annual source review when used.');evaluate();}
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
