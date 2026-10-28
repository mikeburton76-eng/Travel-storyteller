'use strict';
// Shared, replaceable editorial rules. Keyword checks supplement the AI review;
// they cannot certify semantic or visual suitability.
const excluded = /\b(massacres?|shootings?|spree[ -]?kill\w*|school[ -]?shoot\w*|killings?|killed|murder\w*|homicid\w*|assassinat\w*|rap(?:e|es|ed|ing|ist|ists)|sexual[ -]?(?:assault|abuse|violence|exploitation)|child[ -]?abuse|molest\w*|terroris\w*|genocid\w*|lynch\w*|tortur\w*|suicid\w*|executions?|atrocit\w*|porn\w*|sex[ -]?club|strip[ -]?club|brothels?|fatal[ -]?accident|serial[ -]?kill\w*|battlefields?|sieges?)\b/iu;
const closed = /\b(permanently closed|permanently shut|temporarily closed|closed for|closed until|demolished|no longer exists|defunct|disused|was a railway station|former railway station)\b/i;
const visitor = /\b(museum|galler(?:y|ies)|gardens?|parks?|observatory|aquarium|zoo|castle|palace|cathedral|church|abbey|temple|bridge|tower|theat(?:re|er)|concert hall|opera house|librar(?:y|ies)|markets?|arcade|pier|beach|waterfall|caverns?|caves?|botanic\w*|monument|heritage|historic\w*|landmark|archaeolog\w*|ruins|railway|funicular|sculpture|artwork|trail|walk|harbour|harbor|waterfront|festival|tradition|invention|discovery|memorial)\b/i;
const hidden = /\b(lesser[ -]known|less[ -]visited|off the beaten (?:track|path)|overlooked|local favou?rite|hidden gem)\b/i;
function plain(s) { return String(s || '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[\u2010-\u2015]/g, '-').replace(/<[^>]*>/g, '').trim(); }
function allowed(...texts) { return !excluded.test(plain(texts.join(' '))); }
function cleanParagraphs(s) { return plain(s).split(/\n\s*\n/).filter(p => allowed(p)).join('\n\n'); }
function themeOf(name, text) {
 if(/\b(barracks|government house|town hall|office building|bank building|church|cathedral|temple|bridge|tower|streetscapes?)\b/i.test(name))return 'architecture';
 const checks=[
  ['nature', /\b(garden|gardens|park|beach|lake|canyon|waterfall|cave|nature|wildlife|botanic|coast|forest|bay)\b/i],
  ['culture', /\b(museum|gallery|theatre|theater|opera|art|music|library|culture)\b/i],
  ['experience', /\b(market|pier|walk|trail|funicular|railway|cable car|cruise|quay|festival|experience)\b/i],
  ['architecture', /\b(building|architecture|skyscraper|bridge|tower|cathedral|church|palace|castle|temple|monument|office)\b/i]
 ];
 for(const [theme,re]of checks)if(re.test(name))return theme;
 const matches=checks.map(([theme,re])=>({theme,index:re.exec(text)?.index})).filter(x=>x.index!==undefined).sort((a,b)=>a.index-b.index);
 if(matches.length)return matches[0].theme;
 return 'culture';
 if (/\b(market|pier|walk|trail|funicular|railway|cable car|cruise|quay|festival|experience)\b/i.test(s)) return 'experience';
 if (/\b(building|architecture|skyscraper|bridge|tower|cathedral|church|palace|castle|temple|monument|office)\b/i.test(s)) return 'architecture';
 return 'culture';
}
function distanceKm(a, b) {
 const r = Math.PI / 180, x = (b.lat - a.lat)*r, y = (b.lon - a.lon)*r;
 const h = Math.sin(x/2)**2 + Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(y/2)**2;
 return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
function coordinate(lat, lon) {
 if (lat === undefined || lon === undefined || lat === null || lon === null || String(lat).trim()==='' || String(lon).trim()==='') return null;
 lat = Number(lat); lon = Number(lon);
 return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180 ? {lat,lon} : null;
}
module.exports = { allowed, cleanParagraphs, plain, visitor, hidden, closed, themeOf, distanceKm, coordinate };
