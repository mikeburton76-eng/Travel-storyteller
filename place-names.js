'use strict';
const P=require('./explore-policy');
const {completeSentences}=require('./drive-logic');

// Use complete source sentences so qualifications about a name survive narration.
async function searchNames(location,radiusKm,fetchImpl){
 const km=Math.min(10,radiusKm);
 const url=new URL('https://en.wikipedia.org/w/api.php');
 url.search=new URLSearchParams({action:'query',format:'json',generator:'search',
  gsrsearch:'nearcoord:'+km+'km,'+location.lat+','+location.lon+' "named after"',
  gsrlimit:'20',prop:'extracts|coordinates|description|pageprops',exintro:'1',explaintext:'1',exlimit:'max',colimit:'max'});
 const response=await fetchImpl(url,{headers:{'User-Agent':'DiscoverPlaces/1.0 (https://github.com/mikeburton76-eng/Travel-storyteller)'},signal:AbortSignal.timeout(8000)});
 if(!response.ok)throw Error('Place-name source unavailable');
 const data=await response.json();
 if(data.error)throw Error('Place-name search unavailable');
 const places=[];
 for(const page of Object.values(data.query?.pages||{})){
  const coord=page.coordinates?.[0],intro=P.plain(page.extract||'');
  if(!coord||!page.pageid||page.pageprops?.disambiguation!==undefined||P.distanceKm(location,coord)>km||!P.visitorSuitable(page.title,intro))continue;
  if(!/\b(park|bridge|square|garden|street|road|hill|lake|island|village|town|suburb|neighbou?rhood|district|museum|pub|mountain|river|beach|monument|tower|fort|valley|bay|market|building)\b/i.test(page.description||intro.slice(0,180)))continue;
  const sentences=completeSentences(intro),opening=sentences[0];
  if(!opening||opening.length>450)continue;
  const origin=sentences.find(s=>s.length<=380&&/\b(?:is|was|were|are) (?:originally )?named after\b|\b(?:takes?|derives?) (?:its|their) name from\b/i.test(s));
  if(!origin)continue;
  const title=page.title.split(/,| \(/u)[0].toLowerCase();
  const lead=origin.toLowerCase();
  const directlyNamed=(lead.startsWith(title+' ')||lead.startsWith('the '+title+' '))||/^it\b/i.test(origin)||
   /^(?:in \d{4}[, ]+)?the (?:park|bridge|quay|square|garden|street|road|hill|lake|island|village|town|suburb|district|museum|pub|mountain|river|beach|monument|tower|fort|valley|bay|market|building|house) (?:is|was|takes|derives)\b/i.test(origin);
  if(!directlyNamed||/^(?:List of |Timeline of )/i.test(page.title))continue;
  // A bare pronoun needs an unambiguous antecedent in the opening.
  if(/^It\b/i.test(origin)&&sentences.indexOf(origin)>1)continue;
  const text=opening===origin?origin:opening+' '+origin;
  places.push({name:page.title,text,coord:{lat:coord.lat,lon:coord.lon},nameStory:true,nameOrigin:origin,
   id:'wiki-'+page.pageid,wikidata:page.pageprops?.wikibase_item,
   source:{kind:'wikipedia',title:page.title,url:'https://en.wikipedia.org/?curid='+page.pageid}});
 }
 return places.sort((a,b)=>P.distanceKm(location,a.coord)-P.distanceKm(location,b.coord));
}
async function nearbyNames(location,radiusKm,fetchImpl=fetch){
 const saved=require('./place-name-starters.json').filter(c=>P.distanceKm(location,c.coord)<=radiusKm)
  .map(c=>({...c,nameStory:true,nameOrigin:c.text}));
 const found=await searchNames(location,radiusKm,fetchImpl).catch(()=>[]);
 const byName=new Map([...saved,...found].map(c=>[c.name,c]));
 return [...byName.values()].sort((a,b)=>P.distanceKm(location,a.coord)-P.distanceKm(location,b.coord));
}
module.exports={nearbyNames};
