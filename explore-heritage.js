'use strict';
const P=require('./explore-policy');
// Small, source-reviewed supplements. Scope by coordinates, never by a town name.
const reviewed=[{
 name:'Old Hall Hotel',wikipedia:'Old Hall Hotel',coord:{lat:53.2582,lon:-1.9153},reviewedPriority:true,guideListed:true,
 text:'The Old Hall Hotel is a Grade II* listed historic building in Buxton. Mary Queen of Scots stayed here during visits to take the waters in the sixteenth century. The present building incorporates an earlier fortified tower and reflects the town’s long association with its warm springs. It is reputed to be England’s oldest hotel.',
 source:{kind:'wikipedia',title:'Old Hall Hotel',url:'https://en.wikipedia.org/wiki/Old_Hall_Hotel'},
 supportingSources:[{title:'Visit Buxton — Old Hall Hotel',url:'https://www.visitbuxton.co.uk/old-hall-hotel/'},{title:'Historic England — Old Hall Hotel',url:'https://historicengland.org.uk/listing/the-list/list-entry/1257847'}],reviewedAt:'2026-11-02'
},{
 name:'Buxton Pavilion Gardens',wikipedia:'Buxton Pavilion Gardens',coord:{lat:53.25802,lon:-1.9180561},reviewedPriority:true,mustSee:true,guideListed:true,
 text:'Buxton Pavilion Gardens is a Victorian public park laid out in 1871, with landscaped gardens, water, trees and seasonal planting. Public walks run through the gardens, while the Serpentine Walks follow the River Wye on the western side of the site. The operator describes 23 acres of gardens and play areas, including two play areas and a miniature railway for families. The gardens offer a town-centre stroll among planting and water rather than a countryside hike.',
 source:{kind:'wikipedia',title:'Buxton Pavilion Gardens',url:'https://en.wikipedia.org/wiki/Buxton_Pavilion_Gardens'},
 supportingSources:[{title:'Pavilion Gardens — visiting',url:'https://paviliongardens.co.uk/visiting-pavilion-gardens-buxton/'},{title:'Parks & Gardens — Pavilion Gardens, Buxton (location and public walks)',url:'https://www.parksandgardens.org/places/pavilion-gardens-buxton'}],reviewedAt:'2026-11-02'
}];
function nearbyHeritage(location,radiusKm){return reviewed.filter(c=>P.distanceKm(location,c.coord)<=radiusKm).map(c=>({...c,coord:{...c.coord},supportingSources:c.supportingSources.map(s=>({...s}))}));}
module.exports={nearbyHeritage};
