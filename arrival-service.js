'use strict';
const P=require('./explore-policy'),{createHash}=require('node:crypto');
const settlement=/\b(village|town|city|hamlet|suburb|neighbou?rhood|settlement|municipality)\b/i;
const formerSettlement=/\b(?:ancient|former|abandoned|deserted|defunct|ruined|Roman)\s+(?:(?:Roman|spa|market|port|bathing|fortified)\s+)*(?:town|city|village|settlement|hamlet|site)\b|\barchaeological site\b/i;
const isSettlement=p=>!formerSettlement.test(p.description||'')&&settlement.test(p.description||'')&&!/\b(hotel|church|cathedral|museum|gallery|company|university|school|hospital|airport|railway station|town hall|film|album|sports team|national park|monument|battlefield)\b/i.test(p.description||'');
const radius=description=>/\bcity\b/i.test(description)?3000:/\btown\b/i.test(description)?1400:/\bhamlet\b/i.test(description)?500:1000;
function profile(page,now=Date.now()){
 const coord=P.coordinate(page.coordinates?.[0]?.lat,page.coordinates?.[0]?.lon),name=P.plain(page.title||'');
 if(!coord||!name||!isSettlement(page)||!P.allowed(name,page.description||''))return null;
 const sentences=P.cleanParagraphs(page.extract||'').replace(/\([^)]*pronunciation[^)]*\)/gi,'').match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g)||[];
 const safe=sentences.map(s=>s.trim()).filter(s=>s.length>=20&&s.length<=550&&P.allowed(s)&&!P.sourceMarkup.test(s));if(!safe.length)return null;
 const hook=safe.find(s=>/\b(known|famous|notable|cathedral|UNESCO|world heritage|landmark)\b/i.test(s));
 const history=safe.find(s=>s!==hook&&/\b(market charter|founded|medieval|Roman|industrial|developed|established|historic)\b/i.test(s));
 const stat=page.pageid===456017?'The parish, including Wheston, had 1,827 residents at the 2011 census.':safe.find(s=>/\b(population|residents|inhabitants)\b/i.test(s)&&/\b(?:19|20)\d{2}\b/.test(s));
 const selected=[],add=s=>{if(!s||selected.includes(s))return;const candidate=[...selected,s].join(' ');if(candidate.split(/\s+/).length<=120&&candidate.length<=1200)selected.push(s);};
 add(hook||safe[0]);add(history);add(stat);if(selected.join(' ').split(/\s+/).length<60)add(safe.find(s=>!selected.includes(s)));
 if(!selected.length)return null;
 const text='You’re near '+name+'. '+selected.join(' ')+' Explore local visitor information for places to eat and stay; check details directly with each venue.';
 const checkedAt=new Date(now).toISOString(),due=new Date(now);due.setUTCFullYear(due.getUTCFullYear()+1);
 return {id:'arrival:'+page.pageid,profileVersion:2,kind:'arrival',pageId:page.pageid,name:'Introducing '+name,placeName:name,title:name,reason:text,coord,arrivalRadiusM:radius(page.description||''),prepareRadiusM:radius(page.description||'')+1800,source:{kind:'wikipedia',title:name,url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(name.replace(/ /g,'_'))},sources:[{title:name,url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(name.replace(/ /g,'_'))},...(page.pageid===456017?[{title:'Peak District National Park — Tideswell and Wheston parish statement (2011 census)',url:'https://www.peakdistrict.gov.uk/__data/assets/pdf_file/0021/344451/Tideswell-and-Wheston.pdf'}]:[])],checkedAt,reviewAfter:due.toISOString(),audioKey:createHash('sha256').update(text).digest('hex').slice(0,16),standout:hook||null,history:history||null,stat:stat||null,selectionBasis:'source',notice:'Source-based introduction; annual review when used. Distances are approximate, and food/stay coverage in this app remains local.'};
}
function createArrivalService({fetchImpl=fetch,now=()=>Date.now()}={}){
 const profiles=new Map(),geocache=new Map(),pending=new Map();let calls=[];
 async function api(params){const url=new URL('https://en.wikipedia.org/w/api.php');for(const[k,v]of Object.entries({action:'query',format:'json',formatversion:2,...params}))url.searchParams.set(k,v);const r=await fetchImpl(url,{headers:{'User-Agent':'DiscoverPlaces/1.0 (https://github.com/mikeburton76-eng/Travel-storyteller)'},signal:AbortSignal.timeout(14000)});if(!r.ok)throw Error('Nearby arrival information could not be loaded.');const d=await r.json();if(d.error)throw Error('Arrival sources could not complete the request.');return d.query?.pages||[];}
 async function lookup(input){
  const byPlace=typeof input?.place==='string';const coord=P.coordinate(input?.lat,input?.lon);
  if(byPlace&&(!input.place.trim()||input.place.length>100||!P.allowed(input.place)))throw Object.assign(Error('Choose a town or village.'),{status:400});if(!byPlace&&!coord)throw Object.assign(Error('A valid location is needed.'),{status:400});
  const key=byPlace?'place:'+input.place.trim().toLowerCase():'gps:'+coord.lat.toFixed(2)+','+coord.lon.toFixed(2);
  const known=new Set((Array.isArray(input.known)?input.known:[]).filter(x=>Number.isSafeInteger(x)).slice(0,32));
  let pages=geocache.get(key);if(!pages||pages.expires<=now()){
   if(pending.has(key))pages=await pending.get(key);
   else{calls=calls.filter(t=>now()-t<60000);if(calls.length>=30||pending.size>=3)throw Object.assign(Error('Arrival lookup is busy. Saved introductions remain available.'),{status:429});calls.push(now());
    const job=(async()=>{const found=await api(byPlace?{titles:input.place.trim(),redirects:1,prop:'coordinates|description|pageprops',colimit:'max'}:{generator:'geosearch',ggscoord:coord.lat+'|'+coord.lon,ggsradius:10000,ggslimit:50,prop:'coordinates|description|pageprops',colimit:'max'});
     const candidates=found.filter(p=>p.pageid&&p.pageprops?.disambiguation===undefined&&isSettlement(p)&&P.allowed(p.title,p.description||'')&&P.coordinate(p.coordinates?.[0]?.lat,p.coordinates?.[0]?.lon));if(coord)candidates.sort((a,b)=>P.distanceKm(coord,a.coordinates[0])-P.distanceKm(coord,b.coordinates[0]));const result={pages:candidates.slice(0,3),expires:now()+1800000};if(geocache.size>=64)geocache.delete(geocache.keys().next().value);geocache.set(key,result);return result;
    })().finally(()=>pending.delete(key));pending.set(key,job);pages=await job;
   }
  }
  const wanted=pages.pages.filter(p=>!known.has(p.pageid)),items=[];const missing=[];
  for(const p of wanted){const hit=profiles.get(p.pageid);if(hit&&Date.parse(hit.reviewAfter)>now())items.push(hit);else missing.push(p.pageid);}
  if(missing.length){const full=await api({pageids:missing.join('|'),prop:'extracts|coordinates|description',exintro:1,explaintext:1,exlimit:'max',colimit:'max'});for(const p of full){const item=profile(p,now());if(!item)continue;if(profiles.size>=64)profiles.delete(profiles.keys().next().value);profiles.set(p.pageid,item);items.push(item);}}
  return {items,reviewPolicy:'annually-when-used',source:'Wikipedia',note:'Introductions depend on source coverage. No paid AI request is made by this lookup.'};
 }
 return {lookup};
}
module.exports={createArrivalService,profile};
