'use strict';
// Straight-line approach estimates, deliberately independent of road navigation.
(()=>{
 const PLAYBACK_METRES=500;
 const rad=x=>x*Math.PI/180;
 function distance(a,b){const p=rad(b.lat-a.lat),q=rad(b.lon-a.lon);return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(p/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(q/2)**2)));}
 function bearing(a,b){const p=rad(a.lat),q=rad(b.lat),d=rad(b.lon-a.lon);return (Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))*180/Math.PI+360)%360;}
 const angle=(a,b)=>Math.abs((a-b+540)%360-180);
 const valid=c=>c&&Number.isFinite(c.lat)&&Number.isFinite(c.lon)&&Math.abs(c.lat)<=90&&Math.abs(c.lon)<=180;
 const key=item=>item.kind==='arrival'?item.id+':'+(item.audioKey||'legacy'):(item.source?.url||item.id);
 function places(items){const seen=new Set();return items.filter(i=>{const k=i.kind==='arrival'?i.id:key(i);if(!k||seen.has(k)||!valid(i.coord)||i.eventArea||i.historyOnly||!i.reason||!i.name)return false;seen.add(k);return true;});}
 function motion(fix,previous,lastHeading=null){
  if(!valid(fix)||!Number.isFinite(fix.accuracy)||fix.accuracy>75||fix.accuracy<0)return null;
  let speed=Number.isFinite(fix.speed)&&fix.speed>=0?fix.speed:null,heading=Number.isFinite(fix.heading)&&fix.heading>=0&&fix.heading<360?fix.heading:null;
  let quiet=false;
  if(previous){const dt=(fix.time-previous.time)/1000,d=distance(previous,fix);quiet=dt>0&&dt<=60&&d<=Math.max(12,fix.accuracy,previous.accuracy);if(dt>0&&dt<=30&&d>Math.max(12,fix.accuracy,previous.accuracy)){if(speed===null||speed<1)speed=d/dt;if(heading===null)heading=bearing(previous,fix);}}
  if((speed!==null&&speed<1)||(speed===null&&quiet)){if(Number.isFinite(lastHeading)&&lastHeading>=0&&lastHeading<360)return {speed:0,heading:lastHeading,stationary:true};return null;}
  if(speed===null||speed<1||speed>55||heading===null)return null;
  return {speed,heading};
 }
 function approaching(item,fix,movement,played=new Set()){
  if(!valid(item.coord)||!valid(fix)||!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>75||played.has(key(item)))return null;
  if(!movement)return null;
  const metres=distance(fix,item.coord),delta=angle(movement.heading,bearing(fix,item.coord));
  if(delta>65||metres<20)return null;
  const cross=metres*Math.sin(rad(delta)),ahead=metres*Math.cos(rad(delta));
  if(cross>250||ahead>Math.min(3000,Math.max(1000,movement.speed*90)))return null;
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
 function opening(item){if(item.kind==='arrival'&&item.reason.length<=1500)return item.reason;const sentences=item.reason.match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)||[item.reason];let text='';for(const sentence of sentences){if((text+' '+sentence).trim().length>480)break;text=(text+' '+sentence).trim();if(text.split(/\s+/).length>=40)break;}return text||item.reason.slice(0,450).replace(/\s+\S*$/,'')+'…';}
 const api={PLAYBACK_METRES,movingAway,startChime,distance,bearing,angle,valid,key,places,motion,approaching,choose,opening};
 if(typeof module!=='undefined')module.exports=api;else globalThis.DriveLogic=api;
})();
