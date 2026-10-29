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
}];
function nearbyWalks(location,radiusKm){return reviewed.filter(c=>P.distanceKm(location,c.coord)<=radiusKm).map(c=>({...c,coord:{...c.coord},supportingSources:[...c.supportingSources]}))}
function walkingParagraphs(text){return String(text||'').slice(0,18000).split(/\n\s*\n/).filter(p=>p.length>=40&&p.length<=800&&P.allowed(p)&&!P.sourceMarkup.test(p)&&!P.closed.test(p)&&/\b(walking route|circular walk|hiking|footpath|walking trail|walkers|walks? (?:along|through|from|to)|public access)\b/i.test(p)).slice(0,2).join('\n\n')}
module.exports={nearbyWalks,walkingParagraphs};
