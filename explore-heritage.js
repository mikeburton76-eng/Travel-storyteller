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
},{
 name:'Buxton Museum and Art Gallery',wikipedia:'Buxton Museum and Art Gallery',coord:{lat:53.252346,lon:-1.907888},locationApproximate:true,skipSourceImage:true,reviewedPriority:true,guideListed:true,
 text:'Buxton Museum and Art Gallery reopened in a temporary home beside Buxton Library on Kents Bank Road on 15 October 2026. Its displays include local artefacts and artwork, including the Buxton Bear, alongside exhibitions and community activities. This is the museum’s current visitor location, rather than its former home on Terrace Road. The map point is an approximate reference for the library site; check the council’s visitor information for the entrance and current details.',
 source:{kind:'operator',title:'Derbyshire County Council — Buxton Museum and Art Gallery',url:'https://www.derbyshire.gov.uk/leisure/buxton-museum/buxton-museum-and-art-gallery.aspx'},
 supportingSources:[{title:'Derbyshire County Council — reopening, 14 October 2026',url:'https://www.derbyshire.gov.uk/council/news-events/news-updates/news/buxton-museum-and-art-gallery-returns-in-temporary-new-home.aspx'},{title:'Buxton Library — address',url:'https://libraries.derbyshire.gov.uk/-/buxton-library'},{title:'Library postcode reference point (approximate)',url:'https://www.doogal.co.uk/ShowMap?postcode=SK17%209HW'}],reviewedAt:'2026-11-03'
}];
// These fill gaps in a local guide, rather than promoting Buxton to nearby cities.
function nearbyHeritage(location,radiusKm){const localRadius=Math.min(radiusKm,3);return reviewed.filter(c=>P.distanceKm(location,c.coord)<=localRadius).map(c=>({...c,coord:{...c.coord},supportingSources:c.supportingSources.map(s=>({...s}))}));}
module.exports={nearbyHeritage};

