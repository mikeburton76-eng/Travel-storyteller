'use strict';
const {createHash}=require('node:crypto');
const P=require('./explore-policy');
const JR=require('./journey-route');
const headers={'User-Agent':'DiscoverPlaces/1.0 (https://github.com/mikeburton76-eng/Travel-storyteller)'};
const failure=(message,status)=>Object.assign(Error(message),{status});

function endpoint(value){
 const coord=P.coordinate(value?.lat,value?.lon);
 if(!coord||typeof value.title!=='string'||!value.title.trim()||value.title.length>160)throw failure('Choose both places before planning a journey.',400);
 return {...coord,title:value.title.trim()};
}
// Space lookups by distance along the road, even where there are many bends.
function sampleRoad(line,count){
 const lengths=[0];
 for(let i=1;i<line.length;i++){
  const km=P.distanceKm({lon:line[i-1][0],lat:line[i-1][1]},{lon:line[i][0],lat:line[i][1]});
  lengths.push(lengths[i-1]+km);
 }
 let i=1;
 return Array.from({length:count},(_,n)=>{
  const target=lengths.at(-1)*n/(count-1);
  while(i<line.length-1&&lengths[i]<target)i++;
  const fraction=(target-lengths[i-1])/(lengths[i]-lengths[i-1]||1);
  return line[i].map((v,j)=>line[i-1][j]+fraction*(v-line[i-1][j]));
 });
}
async function getJson(url,fetchImpl){
 const response=await fetchImpl(url,{headers,signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Source unavailable');
 return response.json();
}
async function stories(point,searchRadius,fetchImpl){
 const url=new URL('https://en.wikipedia.org/w/api.php');
 url.search=new URLSearchParams({action:'query',format:'json',generator:'geosearch',ggscoord:point[1].toFixed(5)+'|'+point[0].toFixed(5),ggsradius:String(searchRadius),ggslimit:'45',prop:'coordinates|extracts',exintro:'1',explaintext:'1',exlimit:'max',colimit:'max'});
 const data=await getJson(url,fetchImpl);
 if(data.error)throw Error('Story source unavailable');
 const items=[];
 for(const page of Object.values(data.query?.pages||{})){
  const name=page.title,text=P.plain(page.extract||''),coord=page.coordinates?.[0];
  if(!coord||!text||!P.visitor.test(name+' '+text)||!P.visitorSuitable(name,text))continue;
  const sentences=text.match(/[^.!?]+[.!?]+(?:\s|$)/g)||[];
  const reason=sentences.slice(0,2).join('').trim();
  if(reason.length<40||reason.length>780)continue;
  items.push({id:'wiki-'+page.pageid,name,title:name,coord:{lat:coord.lat,lon:coord.lon},reason,background:text.slice(0,1800),section:'attractions',theme:P.themeOf(name,text),source:{kind:'wikipedia',title:name,url:'https://en.wikipedia.org/?curid='+page.pageid}});
 }
 return items;
}
let lastRequest=0;
async function plan(input,{fetchImpl=fetch}={}){
 const radius=Number(input?.radiusM??1000);
 if(!Number.isInteger(radius)||radius<100||radius>20000)throw failure('Choose a search distance between 100 metres and 20 kilometres.',400);
 const from=endpoint(input?.from),to=endpoint(input?.to);
 if(P.distanceKm(from,to)<0.1)throw failure('Choose two different places.',400);
 if(Date.now()-lastRequest<1000)throw failure('Please wait a moment and try the route again.',429);
 lastRequest=Date.now();
 const trial=input.trial==='buxton-tideswell';
 const via=trial?[
  {lon:-1.874857,lat:53.284868},{lon:-1.858085,lat:53.292888},
  {lon:-1.843391,lat:53.299537},{lon:-1.830962,lat:53.310205}
 ]:[];
 const points=[from,...via,to].map(p=>p.lon+','+p.lat).join(';');
 const response=await getJson('https://routing.openstreetmap.de/routed-car/route/v1/driving/'+points+'?overview=full&geometries=geojson&steps=false',fetchImpl);
 const road=response.routes?.[0],coordinates=road?.geometry?.coordinates;
 if(!coordinates||coordinates.length<2)throw failure('No connected driving route was found between those places.',422);
 const centres=sampleRoad(coordinates,Math.max(3,Math.min(14,Math.ceil(road.distance/4500)+1)));
 const pointsToSearch=[...centres];
 // Wikipedia accepts at most 10 km per lookup. Sample both sides of wider corridors.
 if(radius>9000){
  for(let i=0;i<centres.length;i++){
   const [lon,lat]=centres[i],before=centres[Math.max(0,i-1)],after=centres[Math.min(i+1,centres.length-1)];
   const scale=Math.max(0.02,Math.cos(lat*Math.PI/180)),dx=(after[0]-before[0])*scale,dy=after[1]-before[1],length=Math.hypot(dx,dy)||1;
   for(const sign of [-1,1]){
    const offset=sign*(radius-6500)/111200;
    pointsToSearch.push([((lon-offset*dy/(length*scale)+540)%360)-180,Math.max(-89.99,Math.min(89.99,lat+offset*dx/length))]);
   }
  }
 }
 const unique=new Map();let successful=0;
 for(let i=0;i<pointsToSearch.length;i+=4){
  const responses=await Promise.allSettled(pointsToSearch.slice(i,i+4).map(point=>stories(point,Math.min(10000,Math.max(4500,radius+1000)),fetchImpl)));
  for(const response of responses)if(response.status==='fulfilled'){successful++;for(const item of response.value)unique.set(item.id,item);}
 }
 for(const road of require('./roman-roads').reviewed){
  const item={...road,id:'roman-road-'+road.name,title:road.name,reason:road.text,background:road.text,section:'history'};
  if(JR.project(item.coord,coordinates).metres<=radius)unique.set(item.id,item);
 }
 if(!successful&&!unique.size)throw failure('The story source is unavailable. Try again while connected.',503);
 const items=JR.within({coordinates,items:[...unique.values()].filter(item=>!trial||item.name!=='Batham Gate'||!unique.has('roman-road-Batham Gate Roman road near Smalldale'))},radius);
 const id='road-'+createHash('sha256').update(JSON.stringify(coordinates)).digest('hex').slice(0,20);
 return {id,label:from.title+' → '+to.title+(trial?' via Batham Gate, Smalldale and Peak Forest':''),from,to,via,radiusM:radius,coordinates,distanceM:road.distance,durationS:road.duration,items};
}
module.exports={plan,sampleRoad};
