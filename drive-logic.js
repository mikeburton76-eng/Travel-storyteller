'use strict';
// Straight-line approach estimates, deliberately independent of road navigation.
(()=>{
 const rad=x=>x*Math.PI/180;
 function distance(a,b){const p=rad(b.lat-a.lat),q=rad(b.lon-a.lon);return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(p/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(q/2)**2)));}
 function bearing(a,b){const p=rad(a.lat),q=rad(b.lat),d=rad(b.lon-a.lon);return (Math.atan2(Math.sin(d)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(d))*180/Math.PI+360)%360;}
 const angle=(a,b)=>Math.abs((a-b+540)%360-180);
 const valid=c=>c&&Number.isFinite(c.lat)&&Number.isFinite(c.lon)&&Math.abs(c.lat)<=90&&Math.abs(c.lon)<=180;
 const key=item=>item.source?.url||item.id;
 function places(items){const seen=new Set();return items.filter(i=>{const k=key(i);if(!k||seen.has(k)||!valid(i.coord)||i.eventArea||i.historyOnly||!i.reason||!i.name)return false;seen.add(k);return true;});}
 function motion(fix,previous){
  if(!valid(fix)||!Number.isFinite(fix.accuracy)||fix.accuracy>75||fix.accuracy<0)return null;
  let speed=Number.isFinite(fix.speed)&&fix.speed>=0?fix.speed:null,heading=Number.isFinite(fix.heading)&&fix.heading>=0&&fix.heading<360?fix.heading:null;
  if(previous){const dt=(fix.time-previous.time)/1000,d=distance(previous,fix);if(dt>0&&dt<=30&&d>Math.max(12,fix.accuracy,previous.accuracy)){if(speed===null)speed=d/dt;if(heading===null)heading=bearing(previous,fix);}}
  if(speed===null||speed<2.5||speed>55||heading===null)return null;
  return {speed,heading};
 }
 function approaching(item,fix,movement,played=new Set()){
  if(!valid(item.coord)||played.has(key(item))||!movement)return null;
  const metres=distance(fix,item.coord),delta=angle(movement.heading,bearing(fix,item.coord));
  if(delta>65||metres<20)return null;
  const cross=metres*Math.sin(rad(delta)),ahead=metres*Math.cos(rad(delta));
  if(cross>120||ahead>Math.min(3000,Math.max(1000,movement.speed*90)))return null;
  return {item,metres,ahead,cross,eta:ahead/movement.speed,trigger:ahead<=Math.max(80,Math.min(450,movement.speed*12))};
 }
 function choose(items,fix,movement,played){return items.map(i=>approaching(i,fix,movement,played)).filter(Boolean).sort((a,b)=>a.eta-b.eta)[0]||null;}
 function opening(item){const sentences=item.reason.match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)||[item.reason];let text='';for(const sentence of sentences){if((text+' '+sentence).trim().length>480)break;text=(text+' '+sentence).trim();if(text.split(/\s+/).length>=40)break;}return text||item.reason.slice(0,450).replace(/\s+\S*$/,'')+'…';}
 const api={distance,bearing,angle,valid,key,places,motion,approaching,choose,opening};
 if(typeof module!=='undefined')module.exports=api;else globalThis.DriveLogic=api;
})();
