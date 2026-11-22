'use strict';
const {distanceKm}=require('./explore-policy');
const reviewed=require('./roman-roads/reviewed.json').map(row=>({
 name:row.name,coord:row.coord,text:row.text,romanRoad:{status:row.status,line:row.line},
 reviewedPriority:true,guideListed:true,theme:'history',source:{kind:'heritage',title:row.name,url:row.url},
 supportingSources:[...(row.extra?[{title:'Historical evidence',url:row.extra}]:[]),...(row.line?[{title:'Modern road geometry © OpenStreetMap contributors (OSRM)',url:'https://www.openstreetmap.org/copyright'}]:[])]
}));
const atlas=[50,51,52,53,54,55].flatMap(band=>require('./roman-roads/'+band+'.json'));
function nearRoads(place,radiusKm){
 if(place.lat<49.8||place.lat>59||place.lon< -6.2||place.lon>2)return [];
 const local=reviewed.filter(r=>distanceKm(place,r.coord)<=Math.min(12,radiusKm)).sort((a,b)=>distanceKm(place,a.coord)-distanceKm(place,b.coord)).slice(0,3);
 if(local.length)return local;
 // Atlas positions are approximate. Offer the closest reconstruction for Explore only.
 const scale=Math.cos(place.lat*Math.PI/180),limit=Math.min(3,radiusKm)/111.2;
 let nearest=null,best=limit*limit;
 for(const [id,name,certainty,line] of atlas){
  for(let i=1;i<line.length;i++){
   const [x,y]=line[i-1],[u,v]=line[i];
   if(place.lat<Math.min(y,v)-limit||place.lat>Math.max(y,v)+limit||place.lon<Math.min(x,u)-limit/scale||place.lon>Math.max(x,u)+limit/scale)continue;
   const dx=(u-x)*scale,dy=v-y,ax=(place.lon-x)*scale,ay=place.lat-y;
   const t=Math.max(0,Math.min(1,(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
   const squared=(ax-t*dx)**2+(ay-t*dy)**2;
   if(squared<best){best=squared;nearest={id,name,certainty,coord:{lat:y+t*dy,lon:x+t*(u-x)}};}
  }
 }
 if(!nearest)return [];
 const {id,name,certainty,coord}=nearest;
 return [{name:'Possible Roman road · '+name,coord,historyOnly:true,theme:'history',romanRoad:{status:'Present use unverified'},source:{kind:'atlas',title:'Itiner-e · segment '+id+' · CC BY 4.0',url:'https://itiner-e.org/about'},supportingSources:[{title:'Brughmans, de Soto, Pažout and Bjerregaard Vahlstrup · adapted geometry, CC BY 4.0',url:'https://creativecommons.org/licenses/by/4.0/'}],text:'The Itiner-e atlas maps a possible Roman road here. Its researchers classify the alignment as '+certainty.toLowerCase()+'. The map pin marks an approximate point on their reconstruction. Its present-day use has not been verified.'}];
}
module.exports={nearRoads,reviewed};
