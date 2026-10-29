'use strict';
const P=require('./explore-policy');
// Small, source-verified supplements for gaps in open map coverage. Not an attraction list.
const verified=[{place:'Buxton',lat:53.259,lon:-1.914,name:'Buxton Visitor Centre — The Pump Room',description:'Local advice, maps and ideas for exploring Buxton and the surrounding Peak District. Find the visitor centre in the Pump Room, opposite the Crescent.',mapQuery:'The Pump Room, The Crescent, Buxton, SK17 6BH',website:'https://buxtoncrescentexperience.com/visitor-information/',source:{title:'Buxton Crescent Heritage Trust',url:'https://buxtoncrescentexperience.com/visitor-information/'},verifiedAt:'2026-10-29'}];
function publicWebsite(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
async function visitorInformation(location,{fetchImpl=fetch}={}){
 const supplements=verified.filter(x=>location.mode==='area'&&x.place.toLowerCase()===location.label.split(',')[0].toLowerCase()&&P.distanceKm(location,x)<3).map(({place,lat,lon,...x})=>x);
 if(!P.coordinate(location.lat,location.lon))return {items:supplements,unavailable:true};
 const radius=location.mode==='nearby'?3000:6000;
 const query=`[out:json][timeout:7];nwr(around:${radius},${Number(location.lat)},${Number(location.lon)})[tourism=information][information~"^(office|visitor_centre|visitor_center)$"];out center tags 20;`;
 try{
  const response=await fetchImpl('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded','user-agent':'TravelStoryteller/1.0 (https://github.com/mikeburton76-eng/Travel-storyteller)'},body:new URLSearchParams({data:query}).toString(),signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error('Visitor information lookup unavailable');
  const data=await response.json(),found=[];
  for(const e of (data.elements||[]).slice(0,40)){
   const t=e.tags||{},coord=P.coordinate(e.lat??e.center?.lat,e.lon??e.center?.lon),name=P.plain(t.name||t['name:en']);
   if(t.tourism!=='information'||!['office','visitor_centre','visitor_center'].includes(t.information)||!coord||!name||name.length>140||!P.visitorSuitable(name,t.description||'')||P.distanceKm(location,coord)>radius/1000||!/^(node|way|relation)$/.test(e.type)||!Number.isSafeInteger(e.id)||e.id<1||t.disused==='yes'||t.access==='private')continue;
   const website=publicWebsite(t.website||t['contact:website']);
   if(supplements.some(x=>x.website&&website&&new URL(x.website).hostname===new URL(website).hostname))continue;
   if(found.some(x=>P.distanceKm(x.coord,coord)<.1))continue;
   found.push({name,description:'Mapped visitor information centre. Check its website for current visitor services and opening times.',coord,website,source:{title:'OpenStreetMap contributors',url:`https://www.openstreetmap.org/${e.type}/${e.id}`}});
  }
  return {items:[...supplements,...found].slice(0,3),unavailable:false};
 }catch{return {items:supplements,unavailable:true}}
}
module.exports={visitorInformation,publicWebsite};
