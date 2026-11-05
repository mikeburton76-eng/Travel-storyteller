'use strict';
const P=require('./explore-policy');
const reviewed=[
 {name:'Autumn Fair at Pavilion Gardens',coord:{lat:53.25802,lon:-1.9180561},
  text:'An autumn fair at the Octagon Hall in Buxton with stalls selling handmade goods and local produce. The programme includes live music and activities for children.',
  url:'https://paviliongardens.co.uk/events/autumn-fair-2026-pavilion-gardens/',start:'2026-11-14',end:'2026-11-15',
  proof:/\b14(?:th)?\s+November\s+(?:to|[-–—])\s+(?:Sunday\s+)?15(?:th)?\s+November\s+2026\b/i,oneOff:true},
 {name:'Buxton International Festival',wikipedia:'Buxton Festival',coord:{lat:53.2585,lon:-1.9167},text:'An arts festival in Buxton featuring opera, books, music and jazz. Check the organiser’s programme and age guidance for individual performances.',url:'https://buxtonfestival.co.uk/',start:'2027-07-07',end:'2027-07-25',proof:/\b0?7\s*[-–—]\s*25\s+July\s+2027\b/i},
 {name:'Buxton Festival Fringe',wikipedia:'Buxton Festival Fringe',coord:{lat:53.2585,lon:-1.9167},text:'A fringe festival with performances across Buxton. Check the organiser’s programme for venues, tickets and individual show age guidance.',url:'https://www.buxtonfringe.org.uk/fringelatest.html',start:'2027-07-07',end:'2027-07-25',proof:/\b0?7\s*[-–—]\s*25\s+July\s+2027\b/i},
 {name:'Edinburgh Festival Fringe',wikipedia:'Edinburgh Festival Fringe',coord:{lat:55.9533,lon:-3.1883},text:'A performing arts festival across Edinburgh, with many different venues and types of show. Check the programme and age guidance before booking a performance.',url:'https://www.edfringe.com/',start:'2027-08-06',end:'2027-08-30',proof:/\b0?6\s*[-–—]\s*30\s+August\s+2027\b/i}
];
async function nearbyEvents(location,radiusKm,{fetchImpl=fetch,now=()=>Date.now()}={}){
 const today=new Date(now()).toISOString().slice(0,10);
 const relevant=reviewed.filter(c=>P.distanceKm(location,c.coord)<=radiusKm&&(!c.oneOff||c.end>=today));
 const events=await Promise.all(relevant.map(async c=>{
  let eventTiming=null;
  // Refresh exact dates against the registered organiser. Never fetch a model-supplied URL.
  try{const r=await fetchImpl(c.url,{headers:{'User-Agent':'TravelStoryteller/1.0 (https://github.com/mikeburton76-eng/Travel-storyteller)'},signal:AbortSignal.timeout(8000)});
   if(r.ok){const text=P.plain((await r.text()).slice(0,1500000)).replace(/&nbsp;|&#160;/g,' ').replace(/&ndash;|&mdash;|&#821[12];|&#x201[34];/gi,'-').replace(/\s+/g,' ');
    if(c.proof.test(text)&&c.end>=today)eventTiming={start:c.start,end:c.end,sourceUrl:c.url,...(c.oneOff?{venue:true}:{}),checkedAt:new Date(now()).toISOString()};
   }
  }catch{/* Preserve the festival, not unverified dates. */}
  if(c.oneOff&&!eventTiming)return null;
  return {name:c.name,wikipedia:c.wikipedia,coord:{...c.coord},text:c.text,source:{kind:'organiser',title:c.name+' — organiser',url:c.url},eventArea:true,eventTiming,sourceOnly:!!c.oneOff,reviewedPriority:!!c.oneOff,guideListed:true,theme:'culture'};
 }));
 return events.filter(Boolean);
}
module.exports={nearbyEvents};
