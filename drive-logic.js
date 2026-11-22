'use strict';
// Straight-line approach estimates, deliberately independent of road navigation.
(()=>{
 // Shared presentation policy for live and saved places in both views.
 // Metadata screening catches explicit subjects, not subjective visual resemblance.
 const placeIcons=Object.freeze({nature:'🌿',culture:'🎨',experience:'🎟️',architecture:'🏛️',history:'📜'});
 function placeIcon(item){return placeIcons[item.theme]||'📍';}
 function placePhoto(item){
  const image=item.image;
  if(!image||!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(image.url||'')||
   !/^https:\/\/commons\.wikimedia\.org\/wiki\//.test(image.sourceUrl||''))return null;
  const metadata=[image.id,image.caption,image.sourceUrl].join(' ');
  if(/\b(?:nude|nudity|naked|porn\w*|explicit|sexual|genitals?|penis|vulva|phallic|phallus|erotic|corpse|gore)\b/i.test(metadata.replace(/[_%]/g,' ')))return null;
  return image;
 }
 const DISTANCE_OPTIONS=Object.freeze(Array.from({length:50},(_,i)=>(i+1)*100));
 let PLAYBACK_METRES=400;
 function setPlaybackMetres(value){const metres=Number(value);PLAYBACK_METRES=DISTANCE_OPTIONS.includes(metres)?metres:400;return PLAYBACK_METRES;}
 const rad=x=>x*Math.PI/180;
 function distance(a,b){const p=rad(b.lat-a.lat),q=rad(b.lon-a.lon);return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(p/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(q/2)**2)));}
 function bearing(a,b){const p=rad(a.lat),q=rad(b.lat),d=rad(b.lon-a.lon);return (Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))*180/Math.PI+360)%360;}
 const angle=(a,b)=>Math.abs((a-b+540)%360-180);
 const valid=c=>c&&Number.isFinite(c.lat)&&Number.isFinite(c.lon)&&Math.abs(c.lat)<=90&&Math.abs(c.lon)<=180;
 const key=item=>item.kind==='arrival'?item.id+':'+(item.audioKey||'legacy'):(item.source?.url||item.id);
 // A single canonical record supplies both category cards and driving narration.
 function canonicalPlaces(items){
  const groups=new Map();
  for(const item of items){
   const identity=item.kind==='arrival'?'arrival:'+item.id:item.historyOnly?'story:'+item.id:item.eventArea?'event:'+item.id:item.id||item.source?.url;
   if(!identity)continue;
   if(!groups.has(identity))groups.set(identity,[]);
   groups.get(identity).push(item);
  }
  const priority={attractions:0,museums:1,buildings:2,gems:3,walks:4,family:5,history:6,photos:7,events:8};
  return [...groups.values()].map(records=>{
   const ordered=[...records].sort((a,b)=>(priority[a.section]??9)-(priority[b.section]??9)||String(a.reason).localeCompare(String(b.reason)));
   const item=ordered[0],sections=new Set(records.map(x=>x.section));
   if(item.displayCategory)return {...item,image:placePhoto(item)}; // Already canonical, including saved guides.
   const text=item.name+' '+(item.background||item.reason||'');
   const heritage=sections.has('museums')||item.historyOnly||/\b(museum|gallery|castle|palace|historic house|monument|barrow|stone circle|church|abbey|cathedral)\b/i.test(item.name);
   const outdoor=/\b(gardens?|parks?|woodland|forest|trail|footpath|promenade|nature reserve)\b/i.test(item.name)&&
    /\b(walk\w*|trail|footpath|public park|public garden|promenade)\b/i.test(text);
   const publishedWalk=sections.has('walks')&&records.some(r=>r.source?.kind==='route-publisher');
   const walk=publishedWalk||(!heritage&&(sections.has('walks')||outdoor));
   const interactive=/\b(world of illusions|camera obscura|science cent(?:re|er)|children[’']s museum|chocolatarium)\b/i.test(item.name);
   const family=(!heritage||interactive)&&!walk&&sections.has('family');
   const displayCategory=item.eventArea||sections.has('events')?'events':walk?'walks':family?'family':'attractions';
   return {...item,displayCategory,familyActivity:!!item.familyActivity||sections.has('family'),
    image:placePhoto({...item,image:item.image||records.find(x=>x.image)?.image||null}),
    background:item.background||records.find(x=>x.background)?.background||''};
  });
 }
 function places(items){const seen=new Set();return canonicalPlaces(items).filter(i=>{const k=i.kind==='arrival'?i.id:key(i);if(!k||seen.has(k)||!valid(i.coord)||i.eventArea||i.historyOnly||!i.reason||!i.name)return false;seen.add(k);return true;});}
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
 // Two accurate fixes and sustained travel along the surveyed stretch, in either direction.
 function followingRomanRoad(line,fix){
  const prior=fix?.previousRoadFix;
  if(!prior||!valid(prior)||!valid(fix)||!(fix.accuracy<=15&&prior.accuracy<=15)||fix.time<=prior.time||fix.time-prior.time>15000)return false;
  const project=globalThis.JourneyRoute?.project||(typeof require==='function'&&require('./journey-route').project);
  if(!project)return false;
  const a=project(prior,line),b=project(fix,line),travel=distance(prior,fix);
  return travel>=25&&a.metres<=12&&b.metres<=12&&Math.abs(b.along-a.along)>=0.85*travel;
 }
 function approaching(item,fix,movement,played=new Set(),prepareMetres=Math.max(PLAYBACK_METRES+500,Math.min(3000,Math.max(1000,(movement?.speed||0)*90)))){
  if(!valid(item.coord)||!valid(fix)||!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>75||played.has(key(item)))return null;
  if(!movement)return null;
  if(item.romanRoad?.line)return followingRomanRoad(item.romanRoad.line,fix)?{item,metres:0,ahead:0,cross:0,eta:0,trigger:true}:null;
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
 const humanInterest=/\b(?:battles?|poets?|writers?|royal|medieval|Bronze Age|Iron Age|barrows?|ancient|archaeolog\w*|formerly|originally|converted|unusual|tradition\w*|invent\w*|discover\w*|born|lived|wrote)\b/i;
 const standoutFact=/\b(?:first|oldest|only|unusual|secret|legend\w*|tradition\w*|invent\w*|discover\w*|born|lived|wrote|poet\w*)\b/i;
 const factRank=sentence=>standoutFact.test(sentence)?3:humanInterest.test(sentence)?2:Number(notableFact.test(sentence));
 // Source extracts can end mid-word. Only publish complete sentences, and never
 // split decimal measurements or abbreviations into separate facts.
 function completeSentences(text){
  const value=String(text||'').trim();
  const parts=typeof Intl!=='undefined'&&Intl.Segmenter
   ?Array.from(new Intl.Segmenter('en',{granularity:'sentence'}).segment(value),x=>x.segment)
   :value.match(/[^!?]+?(?:[.!?](?=\s+[A-Z]|$)|$)/g)||[];
  return parts.map(x=>x.trim()).filter(x=>/[.!?][”"'’)]*$/.test(x)&&!/(?:\.\.\.|…)[”"'’)]*$/.test(x));
 }
 const sentences=completeSentences;
 const words=text=>new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter(word=>word.length>3)||[]);
 function repeats(candidate,previous){
  const tokens=words(candidate),old=words(previous);
  const shared=[...tokens].filter(word=>old.has(word)).length;
  return candidate.toLowerCase()===previous.toLowerCase()||shared/Math.max(1,Math.min(tokens.size,old.size))>.7;
 }
 function opening(item){
  if(item.kind==='arrival'&&item.reason.length<=1700)return sentences(item.reason).join(' ');
  const main=sentences(item.reason),background=sentences(item.background);
  const interest=/\b(battles?|born|lived|poets?|writers?|invent\w*|discover\w*|traditions?|royal|medieval|Bronze Age|Iron Age|barrows?|ancient|archaeolog\w*)\b/i;
  const details=[...main.slice(1),...background].filter(sentence=>interest.test(sentence)||humanInterest.test(sentence)).sort((a,b)=>factRank(b)-factRank(a)).slice(0,2);
  const selected=[];
  for(const sentence of [main[0],...details,...main.slice(1)]){
   if(!sentence)continue;
   const candidate=sentence.trim();
   if(selected.some(previous=>repeats(candidate,previous)))continue;
   const next=[...selected,candidate].join(' ');
   if((!selected.length&&next.length<=1500)||(next.length<=950&&next.split(/\s+/).length<=110))selected.push(candidate);
  }
  return selected.join(' ');
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
 function nearbyIntroduction(item,text){
  const name=String(item.name||'').replace(/^Introducing\s+/i,'').split(' — ')[0].trim().replace(/[.!?]+$/,'');
  if(!name)return text;
  // Replace an existing proximity sentence rather than announcing the place twice.
  const body=String(text||'').replace(/^(?:You[’']re near|We[’']re near|We are near|You are near)\s+[^!?]+?[.!?](?:\s+|$)/i,'').trim();
  return 'We’re near '+name+'.'+(body?' '+body:'');
 }
 function narration(item,{nearby=true}={}){
  if(item.eventArea){const text=sentences(item.reason).join(' ');return nearby?nearbyIntroduction(item,text):text;}
  const base=opening(item);
  if(item.kind==='arrival'&&!item.name)return base; // Parked sound check.
  let story=base;
  const limit=item.kind==='arrival'?1700:1100,wordLimit=item.kind==='arrival'?145:115;
  let added=0;
  for(const fact of extraFacts(item,story)){
   if(!(notableFact.test(fact)||humanInterest.test(fact)))continue;
   if(story.length+fact.length+1>limit||(story+' '+fact).split(/\s+/).length>wordLimit)continue;
   story+=' '+fact;
   if(++added===2)break;
  }
  return nearby?nearbyIntroduction(item,story):story;
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

 function fullStory(item,opening){return [opening,...extraFacts(item,opening)].filter(Boolean).join(' ');}
 const api={fullStory,followingRomanRoad,placePhoto,placeIcon,completeSentences,canonicalPlaces,nearbyIntroduction,narration,followUp,DISTANCE_OPTIONS,setPlaybackMetres,get PLAYBACK_METRES(){return PLAYBACK_METRES;},movingAway,startChime,distance,bearing,angle,valid,key,places,nearbyPlaces,motion,approaching,choose,opening};
 if(typeof module!=='undefined')module.exports=api;else globalThis.DriveLogic=api;
})();

