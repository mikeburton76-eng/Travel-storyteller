'use strict';
// Straight-line approach estimates, deliberately independent of road navigation.
(()=>{
 const DISTANCE_OPTIONS=Object.freeze([100,200,400,500,1000]);
 let PLAYBACK_METRES=400;
 function setPlaybackMetres(value){const metres=Number(value);PLAYBACK_METRES=DISTANCE_OPTIONS.includes(metres)?metres:400;return PLAYBACK_METRES;}
 const rad=x=>x*Math.PI/180;
 function distance(a,b){const p=rad(b.lat-a.lat),q=rad(b.lon-a.lon);return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(p/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(q/2)**2)));}
 function bearing(a,b){const p=rad(a.lat),q=rad(b.lat),d=rad(b.lon-a.lon);return (Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))*180/Math.PI+360)%360;}
 const angle=(a,b)=>Math.abs((a-b+540)%360-180);
 const valid=c=>c&&Number.isFinite(c.lat)&&Number.isFinite(c.lon)&&Math.abs(c.lat)<=90&&Math.abs(c.lon)<=180;
 const key=item=>item.kind==='arrival'?item.id+':'+(item.audioKey||'legacy'):(item.source?.url||item.id);
 function places(items){const seen=new Set();return items.filter(i=>{const k=i.kind==='arrival'?i.id:key(i);if(!k||seen.has(k)||!valid(i.coord)||i.eventArea||i.historyOnly||!i.reason||!i.name)return false;seen.add(k);return true;});}
 function nearbyPlaces(items,fix,radius=PLAYBACK_METRES){
  if(!valid(fix))return [];
  return places(items).filter(item=>distance(fix,item.coord)<=radius);
 }
 function motion(fix,previous,lastHeading=null){
  if(!valid(fix)||!Number.isFinite(fix.accuracy)||fix.accuracy>75||fix.accuracy<0)return null;
  let speed=Number.isFinite(fix.speed)&&fix.speed>=0?fix.speed:null,heading=Number.isFinite(fix.heading)&&fix.heading>=0&&fix.heading<360?fix.heading:null;
  let quiet=false;
  if(previous){const dt=(fix.time-previous.time)/1000,d=distance(previous,fix);quiet=dt>0&&dt<=60&&d<=Math.max(12,fix.accuracy,previous.accuracy);if(dt>0&&dt<=30&&d>Math.max(12,fix.accuracy,previous.accuracy)){if(speed===null||speed<1)speed=d/dt;if(heading===null)heading=bearing(previous,fix);}}
  if((speed!==null&&speed<1)||(speed===null&&quiet)){if(Number.isFinite(lastHeading)&&lastHeading>=0&&lastHeading<360)return {speed:0,heading:lastHeading,stationary:true};return null;}
  if(speed===null||speed<1||speed>55||heading===null)return null;
  return {speed,heading};
 }
 function approaching(item,fix,movement,played=new Set(),prepareMetres=Math.min(3000,Math.max(1000,movement?.speed*90))){
  if(!valid(item.coord)||!valid(fix)||!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>75||played.has(key(item)))return null;
  if(!movement)return null;
  const metres=distance(fix,item.coord),delta=angle(movement.heading,bearing(fix,item.coord));
  if(delta>65||metres<20)return null;
  const cross=metres*Math.sin(rad(delta)),ahead=metres*Math.cos(rad(delta));
  if(cross>Math.max(250,PLAYBACK_METRES*.625)||ahead>prepareMetres)return null;
  return {item,metres,ahead,cross,eta:movement.speed>0?ahead/movement.speed:null,trigger:metres<=PLAYBACK_METRES,arrival:item.kind==='arrival'};
 }
 function choose(items,fix,movement,played){return items.map(i=>approaching(i,fix,movement,played)).filter(Boolean).sort((a,b)=>Number(b.trigger)-Number(a.trigger)||a.metres-b.metres||Number(!!a.arrival)-Number(!!b.arrival))[0]||null;}
 function movingAway(item,fix,movement){return valid(item?.coord)&&valid(fix)&&!!movement&&distance(fix,item.coord)>35&&angle(movement.heading,bearing(fix,item.coord))>100;}
 function startChime(){
  const rate=24000,frames=Math.round(rate*.6),data=new ArrayBuffer(44+frames*2),view=new DataView(data);
  const text=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+frames*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,frames*2,true);
  for(let i=0;i<frames;i++){const t=i/rate,start=t<.2?0:.3,local=t-start,active=local>=0&&local<.2,gain=active?Math.min(1,local/.01,(.2-local)/.01):0,freq=start===0?600:800;view.setInt16(44+i*2,Math.round(Math.sin(2*Math.PI*freq*local)*gain*.3*32767),true);}
  return new Blob([data],{type:'audio/wav'});
 }
 const notableFact=/\b(?:first|oldest|only|unusual|secret|legend\w*|tradition\w*|invent\w*|discover\w*|designed|restored|buried|built|opened|born|lived|wrote|poet\w*|medieval|Bronze Age|Iron Age|barrow\w*|archaeolog\w*)\b/i;
 const standoutFact=/\b(?:first|oldest|only|unusual|secret|legend\w*|tradition\w*|invent\w*|discover\w*|born|lived|wrote|poet\w*)\b/i;
 const factRank=sentence=>standoutFact.test(sentence)?2:Number(notableFact.test(sentence));
 const sentences=text=>String(text||'').match(/[^.!?\n]+(?:[.!?](?=\s|$)|$)/g)||[];
 const words=text=>new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(word=>word.length>3)||[]);
 function repeats(candidate,previous){
  const tokens=words(candidate),old=words(previous);
  const shared=[...tokens].filter(word=>old.has(word)).length;
  return candidate.toLowerCase()===previous.toLowerCase()||shared/Math.max(1,Math.min(tokens.size,old.size))>.7;
 }
 function opening(item){
  if(item.kind==='arrival'&&item.reason.length<=1700)return item.reason;
  const main=sentences(item.reason),background=sentences(item.background);
  const interest=/\b(battles?|born|lived|poets?|writers?|invent\w*|discover\w*|traditions?|royal|medieval|Bronze Age|Iron Age|barrows?|ancient|archaeolog\w*)\b/i;
  const detail=[...main.slice(1),...background].find(sentence=>interest.test(sentence));
  const selected=[];
  for(const sentence of [main[0],detail,...main.slice(1)]){
   if(!sentence)continue;
   const candidate=sentence.trim();
   if(selected.some(previous=>repeats(candidate,previous)))continue;
   const next=[...selected,candidate].join(' ');
   if(next.length<=700&&next.split(/\s+/).length<=75)selected.push(candidate);
  }
  return selected.join(' ')||String(item.reason||'').split(/\s+/).slice(0,75).join(' ').slice(0,697).replace(/\s+\S*$/,'')+'…';
 }

 function extraFacts(item,alreadySpoken){
  const used=sentences(alreadySpoken).map(sentence=>sentence.trim());
  const candidates=[...sentences(item.reason),...sentences(item.background)]
   .map(sentence=>sentence.trim())
   .filter(sentence=>sentence.length>=35&&sentence.length<=420&&/[.!?]$/.test(sentence)
    &&!/^(?:You[’']re near|Local tourism context:|Walking context:|See also|References|External links|Sources)\b/i.test(sentence));
  candidates.sort((a,b)=>factRank(b)-factRank(a));
  return candidates.filter(sentence=>{
   if(used.some(previous=>repeats(sentence,previous)))return false;
   used.push(sentence);return true;
  });
 }
 function narration(item,{nearby=true}={}){
  if(item.eventArea)return item.reason;
  const base=opening(item);
  if(item.kind==='arrival'&&!item.name)return base; // Parked sound check.
  const name=item.name.split(' — ')[0].trim().replace(/[.!?]+$/,'');
  const story=item.kind==='arrival'||!nearby?base:'You’re near '+name+'. '+base;
  const limit=item.kind==='arrival'?1700:900,wordLimit=item.kind==='arrival'?145:95;
  const fact=extraFacts(item,story).find(sentence=>notableFact.test(sentence)
   &&story.length+sentence.length+1<=limit
   &&(story+' '+sentence).split(/\s+/).length<=wordLimit);
  return fact?story+' '+fact:story;
 }
 function followUp(item,spoken=narration(item)){
  const facts=[];
  for(const sentence of extraFacts(item,spoken)){
   if([...facts,sentence].join(' ').length>900)continue;
   facts.push(sentence);
   if(facts.length===3)break;
  }
  return facts.join(' ');
 }

 const api={narration,followUp,DISTANCE_OPTIONS,setPlaybackMetres,get PLAYBACK_METRES(){return PLAYBACK_METRES;},movingAway,startChime,distance,bearing,angle,valid,key,places,nearbyPlaces,motion,approaching,choose,opening};
 if(typeof module!=='undefined')module.exports=api;else globalThis.DriveLogic=api;
})();
