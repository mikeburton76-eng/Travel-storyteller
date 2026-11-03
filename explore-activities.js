'use strict';
const P=require('./explore-policy');
const {publicWebsite}=require('./explore-visitor-info');
const types={bowling_alley:['bowling','Mapped bowling alley offering games of bowling.'],miniature_golf:['mini golf','Mapped miniature golf course. An option for a round of mini golf.'],laser_game:['laser tag','Mapped laser tag venue offering arena-based games.'],indoor_play:['indoor play','Mapped indoor play venue with play activities.'],trampoline_park:['trampolines','Mapped trampoline park offering trampoline activities.']};
function activityRecords(data,location,radiusKm){
 const found=[];
 for(const e of (Array.isArray(data?.elements)?data.elements:[]).slice(0,100)){
  if(!e||typeof e!=='object')continue;
  const t=e.tags||{},coord=P.coordinate(e.lat??e.center?.lat,e.lon??e.center?.lon),name=P.plain(t['name:en']||t.name);
  if(!coord||!name||name.length>140||!['node','way','relation'].includes(e.type)||!Number.isSafeInteger(e.id)||e.id<1||P.distanceKm(location,coord)>radiusKm)continue;
  if(['private','no'].includes(t.access)||['disused','abandoned','demolished','construction'].some(k=>t[k]&& (t[k]==='yes'||t[k]===t.leisure||t[k]===t.tourism))||Object.keys(t).some(k=>/^(disused|abandoned|demolished):(?:leisure|tourism)$/.test(k))||t.opening_hours==='closed'||Number.parseInt(t.min_age,10)>=18)continue;
  const museum=t.tourism==='museum';let type=types[t.leisure];
  if(!type&&t.sport==='laser_tag')type=types.laser_game;
  if(!museum&&!type)continue;
  const description=P.plain(t['description:en']||t.description||'').slice(0,600);
  if(!P.visitorSuitable(name,description)||/(?:\badults? only\b|\b18\+|\bover[ -]18s\b)/i.test(description))continue;
  const text=(museum?'Mapped museum with collections or exhibitions to explore.':type[1])+(description?' '+description:'');
  const website=publicWebsite(t.website||t['contact:website']);
  if(found.some(c=>P.distanceKm(c.coord,coord)<.1&&c.name.toLowerCase()===name.toLowerCase()))continue;
  found.push({name,coord,text,website,sourceOnly:true,activityOnly:!museum,activityKind:museum?'museum':type[0],theme:museum?'culture':'experience',source:{kind:'openstreetmap',title:'OpenStreetMap contributors',url:`https://www.openstreetmap.org/${e.type}/${e.id}`}});
 }
 // Offer different activities before filling with another branch of the same type.
 found.sort((a,b)=>P.distanceKm(location,a.coord)-P.distanceKm(location,b.coord));
 const chosen=[],seen=new Set();for(const c of found)if(!seen.has(c.activityKind)){chosen.push(c);seen.add(c.activityKind);}
 for(const c of found)if(!chosen.includes(c))chosen.push(c);
 return chosen.slice(0,12);
}
function createActivityProvider({fetchImpl=fetch,now=()=>Date.now()}={}){
 const cache=new Map(),pending=new Map();let requests=[];
 return async function nearbyActivities(location,radiusKm){
  const coord=P.coordinate(location.lat,location.lon),radius=Math.min(10,Number(radiusKm));
  if(!coord||!Number.isFinite(radius)||radius<=0)return {candidates:[],unavailable:true};
  const key=[coord.lat.toFixed(3),coord.lon.toFixed(3),radius].join('|');
  const existing=cache.get(key);if(existing&&existing.until>now())return {...existing.value,candidates:existing.value.candidates.filter(c=>P.distanceKm(location,c.coord)<=radius)};
  if(pending.has(key))return pending.get(key);
  requests=requests.filter(t=>t>now()-3600000);
  if(requests.length>=12)return {candidates:[],unavailable:true};
  const task=(async()=>{
   let value;
   const around=`(around:${Math.round(radius*1000)},${coord.lat},${coord.lon})`;
   const query=`[out:json][timeout:6];(nwr${around}[leisure~"^(bowling_alley|miniature_golf|laser_game|indoor_play|trampoline_park)$"];nwr${around}[sport=laser_tag];nwr${around}[tourism=museum];);out center tags 100;`;
   for(const endpoint of ['https://overpass.private.coffee/api/interpreter','https://overpass-api.de/api/interpreter']){
    if(requests.length>=12)break;requests.push(now());
    try{
     const response=await fetchImpl(endpoint+'?'+new URLSearchParams({data:query}),{headers:{'user-agent':'DiscoverPlaces/1.0 (+https://github.com/mikeburton76-eng/Travel-storyteller)'},signal:AbortSignal.timeout(8000)});
     if(response.status===429)break;
     if(!response.ok)throw Error('Activity lookup unavailable');
     const data=await response.json();if(!Array.isArray(data.elements)||data.remark)throw Error('Incomplete activity lookup');
     value={candidates:activityRecords(data,location,radius),unavailable:false};break;
    }catch{/* A second public instance may be available; never use a paid fallback. */}
   }
   value??={candidates:[],unavailable:true};
   if(cache.size>=32)cache.delete(cache.keys().next().value);
   cache.set(key,{value,until:now()+(value.unavailable?300000:30*86400000)});return value;
  })();
  pending.set(key,task);try{return await task}finally{pending.delete(key)}
 };
}
module.exports={createActivityProvider,activityRecords};
