'use strict';
const { distanceKm, allowed } = require('./explore-policy');
const records = require('./historic-battles.json');

// Wikidata CC0 snapshot, 18 November 2026. Each row stores the event QID,
// English label, year, latitude, longitude, parent conflict and source article title. A battlefield
// coordinate identifies an area. Only separately reviewed landmarks go to GPS.
const landmarks = new Map([
 ['Q83224', 'Battle Abbey'], ['Q499626', 'Stirling Old Bridge'],
 ['Q222520', 'Bannockburn Rotunda'], ['Q234188', 'Gifu Sekigahara Battlefield Memorial Museum']
]);
function nearbyBattleStories(location, radiusKm, localPlaces) {
 const names = new Set(localPlaces.map(place => place.name));
 const nearby = [];
 for (const [id, name, year, lat, lon, conflict, article] of records) {
  if (names.has(landmarks.get(id))) continue;
  const coord = {lat, lon};
  const distance = distanceKm(location, coord);
  if (distance > radiusKm || !allowed(name, conflict, article)) continue;
  nearby.push({
   name, coord, distanceKm:distance, historyOnly:true, battleHeritage:true,
   text:name+' took place in '+year+'. Historical context: '+conflict+'.',
   source:{kind:'wikipedia',title:article,url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(article.replace(/ /g,'_'))},
   supportingSources:[{title:name+' — Wikidata',url:'https://www.wikidata.org/wiki/'+id}]
  });
 }
 return nearby.sort((a,b)=>a.distanceKm-b.distanceKm||a.name.localeCompare(b.name)).slice(0,3);
}
module.exports = { nearbyBattleStories };
