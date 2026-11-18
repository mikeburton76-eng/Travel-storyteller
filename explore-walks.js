'use strict';
const P=require('./explore-policy');
// Reviewed route supplements for gaps in encyclopedia coverage. Expand by publisher,
// keep sources and starting points explicit, and never invent connecting routes.
const reviewed=[{
 name:'Tideswell Dale — picnic site and riverside walks',
 coord:{lat:53.264397,lon:-1.770880},walkOnly:true,theme:'nature',guideListed:true,
 text:'Walk beside the stream from Tideswell Dale car park, with a published 1 km upper loop option. The National Park also describes a 3.2 km route to Miller’s Dale. A shorter alternative starts at the parking area before Litton Mill. The route includes a road section with local traffic and grazing livestock. Use the publisher’s map for route details and current advice.',
 source:{kind:'route-publisher',title:'Peak District National Park — Tideswell Dale',url:'https://www.peakdistrict.gov.uk/visiting/miles-without-stiles/tideswell-dale'},
 supportingSources:[{title:'Peak District National Park — Tideswell Dale sensory trail',url:'https://www.peakdistrict.gov.uk/visiting/places-to-visit/sensory-trails/tideswell-dale-sensory-trail'}],
 reviewedAt:'2026-10-29'
}, ...require('./published-walks.json').map(route=>({...route,walkOnly:true,theme:'nature',guideListed:true,supportingSources:[],reviewedAt:'2026-11-18'}))];
function nearbyWalks(location,radiusKm){return reviewed.filter(c=>P.distanceKm(location,c.coord)<=radiusKm).map(c=>({...c,coord:{...c.coord},supportingSources:[...c.supportingSources]}))}
function walkingParagraphs(text){return String(text||'').slice(0,18000).split(/\n\s*\n/).filter(p=>p.length>=40&&p.length<=800&&P.allowed(p)&&!P.sourceMarkup.test(p)&&!P.closed.test(p)&&/\b(walking route|circular walk|hiking|footpath|walking trail|walkers|strolls?|promenades?|riverside paths?|public paths?|walks? (?:along|through|from|to)|public access)\b/i.test(p)).slice(0,2).join('\n\n')}
const outdoorName=/\b(park|gardens?|arboretum|trail|footpath|promenade|boardwalk|beach|canyon|woodlands?|forest|nature reserve|hills?|crags?|craigs?|lochs?|lakes?|glens?|moors?|muir|ridges?|valleys?|walks?|ways?)\b/i;
const routeEvidence=/\b(circular (?:walk|route)|walking (?:route|trail)|hiking (?:route|trail)|waymarked|signposted (?:walk|trail|route)|footpaths?|riverside paths?|coastal paths?|heritage walks?|walking tours?|walking circuit)\b/i;
const gardenEvidence=/\b(botanic(?:al)? garden|arboretum|public garden|gardens? open to the public)\b/i;
function walkCandidate(c){
 if(c.historyOnly||c.eventArea||!P.allowed(c.name,c.text)||P.closed.test(c.text||''))return false;
 if(/\b(amusement|theme park|water park|dog park|cemetery|museum)\b/i.test(c.name))return false;
 return !!c.walkOnly||(outdoorName.test(c.name)||routeEvidence.test(c.text||''))&&(gardenEvidence.test(c.text||'')||P.walkingUse.test(c.text||'')&&!/walking distance|walked past|walk to (?:the )?station/i.test(c.text||''));
}
function walkKind(c){
 if(/\b(gardens?|arboretum)\b/i.test(c.name))return 'garden';
 if(/\b(beach|coast|ocean|riverside|riverbank|waterfront|promenade|boardwalk)\b/i.test(c.name+' '+c.text))return 'water';
 if(/\b(heritage walk|walking tour|town walk|city walk)\b/i.test(c.text||''))return 'town-and-heritage';
 if(/\b(woodlands?|forest)\b/i.test(c.name+' '+c.text))return 'woodland';
 return 'park-or-hills';
}
function scatterWalks(candidates,location,count=6){
 const pool=candidates.filter(c=>c.coord&&walkCandidate(c)).sort((a,b)=>Number(!!b.guideListed)-Number(!!a.guideListed)||P.distanceKm(location,a.coord)-P.distanceKm(location,b.coord)||a.name.localeCompare(b.name));
 const selected=[];
 while(pool.length&&selected.length<count){
  const kinds=new Set(selected.map(walkKind));
  const score=c=>(c.guideListed?60:routeEvidence.test(c.text||'')?30:0)+(kinds.has(walkKind(c))?0:40)+Math.min(20,selected.length?Math.min(...selected.map(x=>P.distanceKm(x.coord,c.coord))):0);
  // Give nearby publisher routes priority over generic outdoor listings.
  const localRoute=c=>c.source?.kind==='route-publisher'&&P.distanceKm(location,c.coord)<=6;
  pool.sort((a,b)=>Number(!!b.reviewedPriority)-Number(!!a.reviewedPriority)||Number(localRoute(b))-Number(localRoute(a))||score(b)-score(a));
  selected.push(pool.shift());
 }
 return selected;
}
function walkingRadius(location,limit,config){
 return location.mode==='area'&&location.scale==='city'?Math.max(limit,Math.min(30,Number(config.cityWalkRadiusKm)||30)):limit;
}
module.exports={nearbyWalks,walkingParagraphs,walkCandidate,scatterWalks,walkingRadius,gardenEvidence};

