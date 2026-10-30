'use strict';
const P=require('./explore-policy');
function createPlaceSearch({fetchImpl=fetch,now=()=>Date.now()}={}){
 const cache=new Map(),pending=new Map();let starts=[];
 async function search(value){
  const q=typeof value==='string'?value.trim().replace(/\s+/g,' '):'';
  if(q.length<3||q.length>100||!P.allowed(q))throw Object.assign(Error('Enter at least three letters; add a region or country if needed.'),{status:400});
  const key=q.toLowerCase(),hit=cache.get(key);if(hit&&hit.expires>now())return hit.choices;if(pending.has(key))return pending.get(key);
  starts=starts.filter(t=>now()-t<60000);if(starts.length>=30||pending.size>=4)throw Object.assign(Error('Place search is busy. Please try again shortly.'),{status:429});starts.push(now());
  const job=(async()=>{
   const headers={'User-Agent':'DiscoverPlaces/1.0 (https://github.com/mikeburton76-eng/Travel-storyteller)'};
   async function api(params){const u=new URL('https://www.wikidata.org/w/api.php');for(const [k,v]of Object.entries({format:'json',...params}))u.searchParams.set(k,v);const r=await fetchImpl(u,{headers,signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Place choices are unavailable. Try again, or add a region and country.');const data=await r.json();if(data.error)throw Error('Place choices could not be loaded. Please try again.');return data;}
   const [name,...regions]=q.split(',').map(s=>s.trim()).filter(Boolean);
   const found=await api({action:'wbsearchentities',search:name,language:'en',limit:10});
   const geographic=/\b(city|town|village|hamlet|suburb|neighbou?rhood|district|county|region|state|country|capital|island|archipelago|continent|borough|municipality|settlement|landmark|monument|museum|gallery|park|garden|mountain|hill|valley|lake|beach|castle|palace|cathedral|bridge|building|square|street|road|river|forest|station)\b/i;
   const matches=(found.search||[]).filter(p=>/^Q\d+$/.test(p.id)&&P.allowed(p.label,p.description||'')&&geographic.test(p.description||'')&&!/\b(company|film|album|football club|cricket team|basketball team|rugby team|university|hospital|television series)\b/i.test(p.description||''));
   const qualified=matches.filter(p=>regions.every(region=>{const text=(p.label+' '+p.description).toLowerCase(),r=region.toLowerCase();return /^(uk|united kingdom|britain)$/.test(r)?/united kingdom|england|scotland|wales|northern ireland|britain/.test(text):/^(us|usa|united states)$/.test(r)?/united states|usa/.test(text):text.includes(r);}));
   const entities=qualified.length?(await api({action:'wbgetentities',ids:qualified.map(p=>p.id).join('|'),props:'claims|sitelinks',sitefilter:'enwiki'})).entities:{};
   const choices=qualified.map(p=>{const entity=entities[p.id],c=entity?.claims?.P625?.find(c=>c.rank!=='deprecated'&&c.mainsnak?.datavalue?.value)?.mainsnak.datavalue.value;const coord=c&&P.coordinate(c.latitude,c.longitude);const title=entity?.sitelinks?.enwiki?.title;if(!coord||!title)return null;return {title,description:p.description||'',lat:coord.lat,lon:coord.lon,broad:/\b(country|continent|state|region|county)\b/i.test(p.description||'')&&!/\b(city|town|village|suburb|neighbou?rhood|landmark|museum|park|garden)\b/i.test(p.description||'')};}).filter(Boolean).slice(0,6);
   if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(key,{choices,expires:now()+86400000});return choices;
  })().finally(()=>pending.delete(key));pending.set(key,job);return job;
 }
 return {search};
}
module.exports={createPlaceSearch};
