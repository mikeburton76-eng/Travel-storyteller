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
const pavilionCalendar='https://paviliongardens.co.uk/events/';
const pavilionPoint=reviewed[0].coord;
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function pavilionEvents(html, checkedAt) {
 const today=checkedAt.slice(0,10);
 const cutoff=new Date(Date.parse(today)+90*86400000).toISOString().slice(0,10);
 const found=new Map();
 for(const match of html.matchAll(/<div class="event-card-body">([\s\S]*?)<\/a>/gi)){
  const card=match[1];
  const name=P.plain(card.match(/<h4 class="card-title">([\s\S]*?)<\/h4>/i)?.[1])
   .replace(/&amp;/g,'&').replace(/&#8217;|&rsquo;/g,'’');
  const href=card.match(/<a\s+href="([^"]+)"/i)?.[1];
  if(!name||name.length>140||!href||!P.allowed(name)||P.closed.test(name))continue;
  let url;
  try{url=new URL(href,pavilionCalendar)}catch{continue}
  if(url.origin!==new URL(pavilionCalendar).origin||!/^\/events\/[a-z0-9-]+\/$/.test(url.pathname))continue;
  const years=new Set((name+' '+url.pathname).match(/\b20\d{2}\b/g)||[]);
  // The cards omit years from their day/month badges. Use only an explicit year for this event.
  if(years.size!==1)continue;
  const [year]=years;
  const dates=[...card.matchAll(/<div class="event-date-large">\s*<span>(\d{1,2})<\/span>\s*([A-Za-z]{3})\s*<\/div>/gi)]
   .map(([,day,month])=>year+'-'+String(months.findIndex(m=>m.toLowerCase()===month.toLowerCase())+1).padStart(2,'0')+'-'+day.padStart(2,'0'));
  if(dates.length<1||dates.length>2||dates.some(date=>{
   const time=Date.parse(date);
   return !Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date;
  }))continue;
  const [start,end=start]=dates;
  if(end<start||end<today||start>cutoff)continue;
  const sourceUrl=url.origin+url.pathname;
  const event={
   name,coord:{...pavilionPoint},
   text:'This event is listed in the Pavilion Gardens programme in Buxton. See the organiser’s listing for programme and venue details.',
   source:{kind:'organiser',title:'Pavilion Gardens event listing',url:sourceUrl},
   eventArea:true,eventTiming:{start,end,sourceUrl,checkedAt,venue:true},
   sourceOnly:true,reviewedPriority:true,guideListed:true,theme:'culture'
  };
  if(!found.has(sourceUrl)||found.get(sourceUrl).eventTiming.start>start)found.set(sourceUrl,event);
 }
 return [...found.values()].sort((a,b)=>a.eventTiming.start.localeCompare(b.eventTiming.start)).slice(0,3);
}

async function readOrganiser(url,fetchImpl){
 const response=await fetchImpl(url,{headers:{'User-Agent':'TravelStoryteller/1.0 (https://github.com/mikeburton76-eng/Travel-storyteller)'},signal:AbortSignal.timeout(8000)});
 return response.ok?(await response.text()).slice(0,1500000):'';
}

async function nearbyEvents(location,radiusKm,{fetchImpl=fetch,now=()=>Date.now()}={}){
 const checkedAt=new Date(now()).toISOString();
 const today=checkedAt.slice(0,10);
 const calendarTask=P.distanceKm(location,pavilionPoint)<=radiusKm
  ? readOrganiser(pavilionCalendar,fetchImpl).then(html=>pavilionEvents(html,checkedAt)).catch(()=>[])
  : Promise.resolve([]);
 const relevant=reviewed.filter(c=>P.distanceKm(location,c.coord)<=radiusKm&&(!c.oneOff||c.end>=today));
 const events=await Promise.all(relevant.map(async c=>{
  let eventTiming=null;
  // Refresh exact dates against the registered organiser. Never fetch a model-supplied URL.
  try{
   const text=P.plain(await readOrganiser(c.url,fetchImpl)).replace(/&nbsp;|&#160;/g,' ').replace(/&ndash;|&mdash;|&#821[12];|&#x201[34];/gi,'-').replace(/\s+/g,' ');
    if(c.proof.test(text)&&c.end>=today)eventTiming={start:c.start,end:c.end,sourceUrl:c.url,...(c.oneOff?{venue:true}:{}),checkedAt};
  }catch{/* Preserve the festival, not unverified dates. */}
  if(c.oneOff&&!eventTiming)return null;
  return {name:c.name,wikipedia:c.wikipedia,coord:{...c.coord},text:c.text,source:{kind:'organiser',title:c.name+' — organiser',url:c.url},eventArea:true,eventTiming,sourceOnly:!!c.oneOff,reviewedPriority:!!c.oneOff,guideListed:true,theme:'culture'};
 }));
 const confirmed=events.filter(Boolean);
 const knownUrls=new Set(confirmed.map(event=>event.source.url));
 const discovered=(await calendarTask).filter(event=>!knownUrls.has(event.source.url));
 return [...discovered,...confirmed];
}
module.exports={nearbyEvents};
