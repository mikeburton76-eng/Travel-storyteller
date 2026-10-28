'use strict';
const P = require('./explore-policy');
const {createHash}=require('node:crypto');
const UA = 'TravelStoryteller/1.0 (https://github.com/mikeburton76-eng/Travel-storyteller)';
const endpoint = { wikipedia:'https://en.wikipedia.org/w/api.php', wikivoyage:'https://en.wikivoyage.org/w/api.php', commons:'https://commons.wikimedia.org/w/api.php' };
const pageUrl = (kind, title) => `https://en.${kind}.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
function splitFields(s) {
 const out=[]; let start=0, braces=0, links=0;
 for(let i=0;i<s.length;i++) {
  const pair=s.slice(i,i+2);
  if(pair==='{{'){braces++;i++;continue} if(pair==='}}'){braces--;i++;continue}
  if(pair==='[['){links++;i++;continue} if(pair===']]'){links--;i++;continue}
  if(s[i]==='|'&&braces===0&&links===0){out.push(s.slice(start,i));start=i+1}
 }
 out.push(s.slice(start));return out;
}
function stripWiki(s) {
 return P.plain(String(s||'').replace(/<!--[^]*?-->/g,'').replace(/\[\[(?:File|Image):[^]*?\]\]/gi,'')
  .replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g,'$2').replace(/\[https?:\/\/[^\s\]]+\s*([^\]]*)\]/g,'$1')
  .replace(/\{\{[^{}]*\}\}/g,'').replace(/'{2,5}/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&'));
}
function templates(s) {
 const out=[];let depth=0,start=0;
 for(let i=0;i<s.length-1;i++){
  if(s.slice(i,i+2)==='{{'){if(depth===0)start=i+2;depth++;i++}
  else if(s.slice(i,i+2)==='}}'&&depth){if(--depth===0)out.push({text:s.slice(start,i),start:start-2,end:i+2});i++}
 }
 return out;
}
function parseListings(wikitext, title) {
 const items=[];
 for(const t of templates(wikitext)){
  const fields=splitFields(t.text);const type=fields.shift().trim().toLowerCase();
  if(!['see','do','marker','listing'].includes(type))continue;
  const f={};for(const field of fields){const at=field.indexOf('=');if(at>0)f[field.slice(0,at).trim().toLowerCase()]=field.slice(at+1).trim()}
  const group=(f.type||type).toLowerCase();if(!['see','do'].includes(group))continue;
  const name=stripWiki(f.name||'').slice(0,140);if(!name)continue;
  const context=wikitext.slice(Math.max(0,t.start-220), Math.min(wikitext.length,t.end+500));
  const text=stripWiki(f.content||context).slice(0,1400);
  if(text.length<35||!P.allowed(name,text)||P.closed.test(text))continue;
  const coord=P.coordinate(f.lat,f.long);
  items.push({name,text,coord,wikidata:/^Q\d+$/.test(f.wikidata||'')?f.wikidata:null,wikipedia:f.wikipedia||null,imageFile:f.image||null,
   source:{kind:'wikivoyage',title,url:pageUrl('wikivoyage',title)},guideListed:true, listingType:group});
 }
 return items;
}
function districtTitles(wikitext,title) {
 const found=[];const seen=new Set();
 for(const match of wikitext.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g)) {
  const child=match[1];if(!child.startsWith(title+'/')||seen.has(child))continue;seen.add(child);
  const context=stripWiki(wikitext.slice(match.index,match.index+350));found.push({title:child,theme:P.themeOf(child,context)});
 }
 // Keep one representative of different districts before filling remaining slots.
 const chosen=[];
 const add=f=>{if(f&&!chosen.includes(f)&&chosen.length<4)chosen.push(f)};
 add(found.find(x=>/\/(?:city centre|cbd|central|downtown)(?:$|\b)/i.test(x.title))||found[0]);
 add(found.find(x=>/beach|coast|waterfront/i.test(x.title)));
 add(found.find(x=>/park|garden|island|golden gate|wildlife/i.test(x.title)&&!chosen.includes(x)));
 for(const theme of ['culture','experience','nature','architecture'])add(found.find(x=>x.theme===theme&&!chosen.includes(x)));
 for(const f of found)add(f);
 return chosen.slice(0,4).map(x=>x.title);
}
// Follow attractions explicitly named by the place's tourism section, not just
// whichever articles happen to be closest to its central coordinate.
function tourismHighlights(wikitext,title) {
 const headings=[...wikitext.matchAll(/^(={2,6})\s*(.*?)\s*\1\s*$/gm)],found=new Map();
 for(let i=0;i<headings.length;i++){
  const heading=headings[i];if(!/\b(tourism|tourist attractions|visitor attractions|places of interest|sightseeing|landmarks|recreation)\b/i.test(heading[2]))continue;
  let end=wikitext.length;for(let j=i+1;j<headings.length;j++)if(headings[j][1].length<=heading[1].length){end=headings[j].index;break}
  const body=wikitext.slice(heading.index+heading[0].length,end).replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi,'').replace(/<ref\b[^>]*\/\s*>/gi,'');
  for(const match of body.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g)){
   const target=match[1].trim();if(/^(?:File|Image|Category|Template|Help):/i.test(target)||target.includes(':')||!P.allowed(target))continue;
   const start=body.lastIndexOf('\n',match.index)+1,stop=body.indexOf('\n',match.index);const paragraph=stripWiki(body.slice(start,stop<0?body.length:stop));const label=stripWiki(match[2]||target);
   const context=(paragraph.split(/(?<=[.!?])\s+/).find(sentence=>sentence.includes(label)||sentence.includes(target))||paragraph).slice(0,1000);
   if(!P.allowed(context)||context.length<35)continue;
   found.set(target,{title:target,name:stripWiki(match[2]||target),context,source:{kind:'wikipedia',title: title+' — '+heading[2],url:pageUrl('wikipedia',title)+'#'+encodeURIComponent(heading[2].replace(/ /g,'_'))}});
  }
 }
 return [...found.values()].slice(0,48);
}
function createSourceProvider({fetchImpl=fetch,timeoutMs=14000}={}) {
 async function api(kind,params) {
  const url=new URL(endpoint[kind]);for(const [k,v] of Object.entries({action:'query',format:'json',...params}))url.searchParams.set(k,v);
  const response=await fetchImpl(url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw Error(`${kind} could not be loaded (${response.status}).`);
  const data=await response.json();if(data.error)throw Error(`${kind} could not complete this search.`);return data;
 }
 const pages = data => Object.values(data.query?.pages||{});
 const visitorPage=p=>P.visitor.test(p.title+' '+(p.description||''))&&!/^(?:(?:capital )?(?:village|town|city|suburb|county|municipality|district|neighbourhood) (?:in|of|and|on|near)|local government area|government agency|rail depot)\b/i.test(p.description||'')&&!/^(?:List of |Timeline of |Parks and gardens of |Tourism in |Transport in )/i.test(p.title);
 async function resolve(input) {
  if(input.lat!==undefined){const coord=P.coordinate(input.lat,input.lon);if(!coord)throw Object.assign(Error('Please try your location again.'),{status:400});return {...coord,label:'your location',title:null,mode:'nearby',overview:'',source:null};}
  const query=String(input.place||'').trim();if(!query||query.length>100||!P.allowed(query))throw Object.assign(Error('Please enter a town or city, including its country where needed.'),{status:400});
  async function lookup(titles){return pages(await api('wikipedia',{titles:titles.join('|'),redirects:1,prop:'coordinates|pageprops|extracts|description',exintro:1,explaintext:1,exlimit:'max'}))}
  let candidates=await lookup([query]);
  const valid=p=>p.missing===undefined&&p.pageprops?.disambiguation===undefined&&p.coordinates?.[0]&&P.allowed(p.title)&&!/\b(building|company|film|album|person)\b/i.test(p.description||'');
  if(!candidates.some(valid)){
   const search=await api('wikipedia',{list:'search',srsearch:query,srlimit:5});const titles=(search.query?.search||[]).map(p=>p.title);
   candidates=titles.length?await lookup(titles):[];
   const matches=candidates.filter(valid);
   if(matches.length!==1)throw Object.assign(Error('Please choose the location, or add its region and country.'),{status:409,choices:matches.map(p=>({title:p.title,description:p.description||''}))});
  }
  const page=candidates.find(valid);if(!page)throw Object.assign(Error('We could not identify this place. Try its region and country.'),{status:404});
  const coord=page.coordinates[0];
  return {lat:coord.lat,lon:coord.lon,label:page.title,title:page.title,scale:/\b(village|hamlet)\b/i.test(page.description||'')?'village':/\btown\b/i.test(page.description||'')?'town':'city',mode:'area',overview:P.cleanParagraphs(page.extract||'').slice(0,1800),source:{kind:'wikipedia',title:page.title,url:pageUrl('wikipedia',page.title)}};
 }
 async function collect(location, config, onProgress) {
  const warnings=[],candidates=[];
  const radius=location.mode==='nearby'?config.nearbyRadiusKm:location.scale==='village'?config.villageRadiusKm:location.scale==='town'?config.townRadiusKm:config.areaRadiusKm;
  const base = async radiusKm => {
   const d=await api('wikipedia',{generator:'geosearch',ggscoord:`${location.lat}|${location.lon}`,ggsradius:Math.min(10000,radiusKm*1000),ggslimit:50,prop:'description|coordinates|pageprops'});
   return pages(d).filter(p=>p.title&&p.title!==location.title&&p.pageprops?.disambiguation===undefined&&P.allowed(p.title,p.description||'')&&visitorPage(p)&&!/^List of |^Timeline of /i.test(p.title));
  };
  let near=[];try{near=await base(radius)}catch{warnings.push('Nearby encyclopedia coverage could not be loaded.');}
  if(location.mode==='nearby'&&near.length<4){try{near=await base(config.nearbyWiderRadiusKm);warnings.push('The search includes a wider area because nearby results were limited.');}catch{}}
  const limit=location.mode==='nearby'?config.nearbyWiderRadiusKm:radius;
  // Small, explicitly provisional cards can arrive before the broader searches.
  const first=near.flatMap(p=>{
   const q=p.coordinates?.[0],text=p.description||'';
   if(!q||text.length<20||P.closed.test(text))return [];
   const coord={lat:q.lat,lon:q.lon},distance=P.distanceKm(location,coord);
   if(distance>limit)return [];
   return [{id:'place-'+createHash('sha256').update(p.title+'|'+coord.lat.toFixed(3)+'|'+coord.lon.toFixed(3)).digest('hex').slice(0,12),name:p.title,text,coord,distanceKm:Number(distance.toFixed(1)),theme:P.themeOf(p.title,text),source:{kind:'wikipedia',title:p.title,url:pageUrl('wikipedia',p.title)}}];
  }).slice(0,4);
  if(first.length)onProgress?.({location,candidates:first,warnings:[],radiusKm:limit,travelSource:null});

  async function voyagePage(title) {
   const d=await api('wikivoyage',{action:'parse',page:title,prop:'wikitext',redirects:1});
   return {title:d.parse.title,text:d.parse.wikitext['*']};
  }
  let travelRoot=null,highlights=[];
  if(location.title){try{
   try{travelRoot=await voyagePage(location.title)}catch(error){
    const short=location.title.replace(/,.*$/,'').replace(/\s*\([^)]*\)\s*$/,'').trim();
    if(short===location.title)throw error;
    const alternative=await voyagePage(short),geo=templates(alternative.text).find(t=>/^geo\s*\|/i.test(t.text));
    const fields=geo?splitFields(geo.text):[],coord=P.coordinate(fields[1],fields[2]);
    if(!coord||P.distanceKm(location,coord)>Math.max(10,radius))throw error;
    travelRoot=alternative;
   }
   const rootListings=parseListings(travelRoot.text,travelRoot.title);
   candidates.push(...rootListings.map(c=>({...c,mustSee:rootListings.length<=12})));
   const districts=districtTitles(travelRoot.text,travelRoot.title);
   const results=await Promise.allSettled(districts.map(voyagePage));
   for(const r of results)if(r.status==='fulfilled'){
    candidates.push(...parseListings(r.value.text,r.value.title));
    const name=r.value.title.split('/').pop(),geo=templates(r.value.text).find(t=>/^geo\s*\|/i.test(t.text));
    if(P.visitor.test(name)&&geo){const fields=splitFields(geo.text),coord=P.coordinate(fields[1],fields[2]);const text=stripWiki(r.value.text.split(/\n==/)[0]).slice(0,1200);
     if(coord&&text.length>40&&P.allowed(name,text))candidates.push({name,text,coord,guideListed:true,queryFeatured:true,source:{kind:'wikivoyage',title:r.value.title,url:pageUrl('wikivoyage',r.value.title)}});
    }
   }
  }catch{warnings.push('A travel guide was not available for this place.');}}
  if(location.title){
   const terms=['tourism','walk','viewpoint','family','museum','gallery','park','beach','market','bridge','hiking trail','circular walk','(children OR playground OR kids)','(zoo OR aquarium OR wildlife)'];
   const searchName=location.title.replace(/,.*$/,'');
   const results=await Promise.allSettled(terms.map(terms=>api('wikipedia',{generator:'search',gsrsearch:`"${searchName.replace(/["\\]/g,'')}" ${terms}`,gsrnamespace:0,gsrlimit:12,prop:'coordinates|description|extracts|pageimages|pageprops',exintro:1,explaintext:1,exlimit:'max',piprop:'name'})));
   for(const result of results){if(result.status!=='fulfilled'){warnings.push('Some subject searches were unavailable.');continue}
    const found=pages(result.value).sort((a,b)=>(a.index||0)-(b.index||0));
    for(const [rank,p] of found.entries()){
     const q=p.coordinates?.[0];if(!q||!p.extract||p.title===location.title||p.pageprops?.disambiguation!==undefined||!P.allowed(p.title,p.extract)||P.closed.test(p.extract)||!visitorPage(p))continue;
     candidates.push({name:p.title,text:p.extract.slice(0,1400),coord:{lat:q.lat,lon:q.lon},imageFile:p.pageimage,wikidata:p.pageprops?.wikibase_item,queryFeatured:rank<3,guideListed:false,source:{kind:'wikipedia',title:p.title,url:pageUrl('wikipedia',p.title)}});
    }
   }
  }
  if(location.title){try{
   const data=await api('wikipedia',{action:'parse',page:location.title,prop:'wikitext',redirects:1});
   highlights=tourismHighlights(data.parse.wikitext['*'],data.parse.title);
  }catch{warnings.push('The local tourism highlights could not be checked.');}}
  // Resolve travel listings lacking coordinates or an article name through their Wikidata sitelinks.
  const ids=[...new Set(candidates.filter(c=>c.wikidata&&(!c.coord||!c.wikipedia)).map(c=>c.wikidata))].slice(0,50);
  if(ids.length){try{
   const url=new URL('https://www.wikidata.org/w/api.php');for(const[k,v]of Object.entries({action:'wbgetentities',format:'json',ids:ids.join('|'),props:'claims|sitelinks',sitefilter:'enwiki'}))url.searchParams.set(k,v);
   const res=await fetchImpl(url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(timeoutMs)});if(!res.ok)throw Error();const d=await res.json();
   for(const c of candidates){const entity=d.entities?.[c.wikidata];const value=entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    if(!c.coord&&value)c.coord=P.coordinate(value.latitude,value.longitude);
    if(!c.wikipedia)c.wikipedia=entity?.sitelinks?.enwiki?.title||null;
   }
  }catch{warnings.push('Some travel listings could not be located and were omitted.');}}
  // Main city history provides topics beyond individual buildings. Whole-article paragraphs
  // are screened locally; only a bounded selection enters the AI prompt.
  if(location.title){try{
   const d=await api('wikipedia',{titles:location.title,redirects:1,prop:'extracts',explaintext:1});const page=pages(d)[0];
   const paragraphs=(page?.extract||'').slice(0,65000).split(/\n\s*\n/).filter(p=>p.length>110&&p.length<1600&&P.allowed(p)&&/\b(1[0-9]{3}|20[0-2][0-9]|century|centuries|ancient|historic|traditional)\b/i.test(p));
   const topics=[['Inventions and connections',/\b(invent\w*|discover\w*|engineer\w*|railway|canal|transport|scientist)\b/i],['Traditions and everyday life',/\b(tradition\w*|festival|craft|market|indigenous|language|cultural)\b/i],['How the place grew',/\b(settlement|settled|grew|founded|harbour|harbor|port|industry|industrial)\b/i]];
   const used=new Set();for(const [name,re]of topics){const text=paragraphs.filter(p=>re.test(p)&&!used.has(p)).slice(0,2);text.forEach(p=>used.add(p));if(text.length)candidates.push({name:`${location.label}: ${name.toLowerCase()}`,text:text.join('\n\n').slice(0,1800),coord:{lat:location.lat,lon:location.lon},source:location.source,historyOnly:true,guideListed:false});}
  }catch{warnings.push('Broader historical background could not be loaded.');}}
  if(travelRoot){const lead=stripWiki(travelRoot.text.split(/\n==/)[0]).slice(0,1200);if(P.allowed(lead))location.overview=(location.overview+'\n\n'+lead).slice(0,3000);}
  // Fetch concise encyclopedia evidence in batches, not full pages per card.
  const guideNames=[],guideImageNames=new Set();
  if(travelRoot)for(const match of travelRoot.text.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g)){
   const name=stripWiki((match[2]||match[1]).split('|').pop()).replace(/^The /,'');
   if(name.length>=8&&name.length<=100&&!name.includes('/')&&(P.visitor.test(name)||/[A-Z][a-z]+(?: [A-Z][a-z]+)+/.test(name))&&P.allowed(name)&&!guideNames.includes(name))guideNames.push(name);
   if(/^(?:File|Image):/i.test(match[1]))guideImageNames.add(name);
  }
  guideNames.sort((a,b)=>Number(guideImageNames.has(b))-Number(guideImageNames.has(a))||Number(P.visitor.test(b))-Number(P.visitor.test(a)));
  guideNames.splice(60);
  const titles=[...new Set([...highlights.map(h=>h.title),...guideNames,...candidates.map(c=>c.wikipedia||(c.source?.kind==='wikipedia'?c.source.title:null)).filter(Boolean),...near.map(p=>p.title)])].slice(0,140);
  const articles=new Map();
  for(let start=0;start<titles.length;start+=20){try{
   const d=await api('wikipedia',{titles:titles.slice(start,start+20).join('|'),redirects:1,prop:'extracts|coordinates|pageimages|pageprops|info|description',exintro:1,explaintext:1,exlimit:'max',inprop:'url',piprop:'name'});
   const aliases=new Map([...(d.query?.normalized||[]),...(d.query?.redirects||[])].map(x=>[x.from,x.to]));
   for(const p of pages(d))if(p.missing===undefined&&p.pageprops?.disambiguation===undefined)articles.set(p.title,p);
   for(const [from,to]of aliases)if(articles.has(to))articles.set(from,articles.get(to));
  }catch{warnings.push('Some source descriptions could not be loaded.');}}
  for(const highlight of highlights){const p=articles.get(highlight.title),q=p?.coordinates?.[0];
   if(!q||!p.extract||p.title===location.title||!P.allowed(p.title,p.extract)||P.closed.test(p.extract)||!visitorPage(p))continue;
   candidates.push({name:p.title,text:p.extract.slice(0,1300)+'\n\nLocal tourism context: '+highlight.context.slice(0,1000),coord:{lat:q.lat,lon:q.lon},imageFile:p.pageimage,wikidata:p.pageprops?.wikibase_item,guideListed:true,queryFeatured:true,mustSee:true,supportingSources:[highlight.source],source:{kind:'wikipedia',title:p.title,url:pageUrl('wikipedia',p.title)}});
  }
  for(const name of guideNames){const p=articles.get(name),q=p?.coordinates?.[0];
   if(!q||!p.extract||p.title===location.title||!P.allowed(p.title,p.extract)||P.closed.test(p.extract)||!visitorPage(p))continue;
   candidates.push({name:p.title,text:p.extract.slice(0,1400),coord:{lat:q.lat,lon:q.lon},imageFile:p.pageimage,wikidata:p.pageprops?.wikibase_item,guideListed:true,queryFeatured:true,source:{kind:'wikipedia',title:p.title,url:pageUrl('wikipedia',p.title)}});
  }
  for(const c of candidates){if(c.historyOnly)continue;const p=articles.get(c.wikipedia||(c.source?.kind==='wikipedia'?c.source.title:null));if(p){if(!c.coord&&p.coordinates?.[0])c.coord={lat:p.coordinates[0].lat,lon:p.coordinates[0].lon};if(!c.imageFile)c.imageFile=p.pageimage;if(!c.wikidata)c.wikidata=p.pageprops?.wikibase_item;}}
  for(const nearPage of near){const p=articles.get(nearPage.title);if(!p?.extract||!P.allowed(p.title,p.extract)||P.closed.test(p.extract))continue;
   const q=p.coordinates?.[0]||nearPage.coordinates?.[0];candidates.push({name:p.title,text:p.extract.slice(0,1400),coord:q?{lat:q.lat,lon:q.lon}:null,imageFile:p.pageimage,source:{kind:'wikipedia',title:p.title,url:pageUrl('wikipedia',p.title)},guideListed:false,wikidata:p.pageprops?.wikibase_item});}
  const unique=new Map();
  for(const c of candidates){
   if(!c.coord||!P.allowed(c.name,c.text)||P.closed.test(c.text))continue;
   const distance=P.distanceKm(location,c.coord);if(distance>limit)continue;
   const key=(c.wikidata||c.wikipedia||c.name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
   if(unique.has(key)){const old=unique.get(key);if(c.mustSee){old.mustSee=true;old.supportingSources=c.supportingSources||old.supportingSources;if(c.text.includes('Local tourism context:'))old.text=c.text;}if(c.queryFeatured&&!old.queryFeatured){old.queryFeatured=true;old.prominence+=2;}continue;}
   const old=[...unique.values()].find(x=>(x.name.toLowerCase()===c.name.toLowerCase()&&P.distanceKm(c.coord,x.coord)<2)||P.distanceKm(c.coord,x.coord)<.15&&(x.name.toLowerCase().includes(c.name.toLowerCase())||c.name.toLowerCase().includes(x.name.toLowerCase())));if(old)continue;
   unique.set(key,{...c,distanceKm:Number(distance.toFixed(1)),theme:c.historyOnly?'history':P.themeOf(c.name,c.text),prominence:(/\b(iconic|famous|major attraction|must-see|most popular|renowned)\b/i.test(c.text)?2:0)+(travelRoot?.text.includes(c.name)?2:0)+(c.queryFeatured?2:0)});
  }
  // Interleave themes before trimming, so a dense centre cannot consume the prompt.
  const groups=['nature','culture','experience','architecture','history'].map(theme=>[...unique.values()].filter(c=>c.theme===theme).sort((a,b)=>b.prominence-a.prominence||Number(b.guideListed)-Number(a.guideListed)||a.distanceKm-b.distanceKm));
  const balanced=[...unique.values()].filter(c=>c.mustSee).sort((a,b)=>b.prominence-a.prominence||a.distanceKm-b.distanceKm).slice(0,config.maxCandidates);
  // Reserve a few evidenced category candidates before dense-city trimming.
  const lenses=[/\b(family[ -]friendly|families|for children|children[’']s|kids|playground|all ages)\b/i,/\b(circular walk|walking trail|footpath|hiking trail)\b/i];
  for(const lens of lenses)for(const c of [...unique.values()].filter(c=>!c.historyOnly&&lens.test(c.text)).slice(0,4))if(!balanced.includes(c)&&balanced.length<config.maxCandidates)balanced.push(c);
  for(const g of groups)for(let i=g.length-1;i>=0;i--)if(balanced.includes(g[i]))g.splice(i,1);
  while(groups.some(g=>g.length)&&balanced.length<config.maxCandidates)for(const g of groups)if(g.length&&balanced.length<config.maxCandidates)balanced.push(g.shift());
  balanced.forEach(c=>c.id='place-'+createHash('sha256').update(c.name+'|'+c.coord.lat.toFixed(3)+'|'+c.coord.lon.toFixed(3)).digest('hex').slice(0,12));
  return {location,candidates:balanced,warnings:[...new Set(warnings)],radiusKm:limit,travelSource:travelRoot?{kind:'wikivoyage',title:travelRoot.title,url:pageUrl('wikivoyage',travelRoot.title)}:null};
 }
 async function images(candidates) {
  const files=[...new Set(candidates.filter(c=>!c.historyOnly&&c.imageFile).map(c=>'File:'+c.imageFile.replace(/^File:/,'')))].slice(0,36);const result=new Map();
  for(let start=0;start<files.length;start+=18){try{
   const d=await api('commons',{titles:files.slice(start,start+18).join('|'),prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:480,iiextmetadatafilter:'Artist|LicenseShortName|LicenseUrl|ImageDescription|AttributionRequired'});
   for(const page of pages(d)){
    const info=page.imageinfo?.[0],m=info?.extmetadata;if(!info||!m)continue;
    const license=P.plain(m.LicenseShortName?.value),caption=P.plain(m.ImageDescription?.value).slice(0,500),creator=P.plain(m.Artist?.value).slice(0,200);
    if(!/^(CC BY(?:-SA)? (?:[234]\.0)|Public domain|CC0)$/i.test(license)||!P.allowed(page.title,caption,creator)||/\b(nud[ei]|naked|sexual|corpse|blood|wound)\w*\b/i.test(caption))continue;
    const imageUrl=info.thumburl||info.url;if(!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(imageUrl||''))continue;
    if(!/^https:\/\/commons\.wikimedia\.org\/wiki\//.test(info.descriptionurl||''))continue;
    const licenseUrl=m.LicenseUrl?.value?.replace(/^http:\/\/creativecommons\.org\//,'https://creativecommons.org/');if(license!=='Public domain'&&!/^https:\/\/creativecommons\.org\//.test(licenseUrl||''))continue;
    if(!creator)continue;
    result.set(page.title.replace(/^File:/,''),{id:page.title,url:imageUrl,sourceUrl:info.descriptionurl,caption,creator,license,licenseUrl:licenseUrl||null});
   }
  }catch{/* An icon is preferable to an uncredited or uncertain picture. */}}
  return result;
 }
 return {resolve,collect,images};
}
module.exports={createSourceProvider,parseListings,districtTitles,stripWiki,tourismHighlights};
