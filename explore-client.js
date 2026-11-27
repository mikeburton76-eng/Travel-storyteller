'use strict';
const $=id=>document.getElementById(id);
const researchMode=typeof location!=='undefined'&&new URLSearchParams(location.search).get('research')==='1';
$('researchOptions').hidden=!researchMode;
const standardSections={
 attractions:['📍','Sights & heritage','Landmarks, museums, historic places and local stories'],
 walks:['🥾','Walks & gardens','Documented walks, gardens and parks'],
 family:['👨‍👩‍👧','Family activities','Ideas for time together'],
 events:['🎭','What’s on','Festivals, fairs and local events']
};
const buxtonSections={
 history:['🏛️','Architecture & heritage','Historic buildings, spa heritage and local stories'],
 nature:['🌿','Nature & scenery','Caves, gardens and viewpoints'],
 arts:['🎨','Arts & culture','Theatres, museums and galleries'],
 family:['👨‍👩‍👧','Family days out','Play areas and family activities'],
 walks:['🥾','Walks','Published routes around Buxton'],
 events:['🎭','What’s on','Dated events and performances']
};
function isBuxtonPilot(){
 const place=guide?.location;
 return /^Buxton(?:, Derbyshire| \(Derbyshire\))?$/i.test(place?.label||'') &&
  Math.abs(place.lat-53.258)<0.035 && Math.abs(place.lon+1.915)<0.05;
}
function buxtonSegment(item,category){
 if(item.subject==='Walking')return category==='walks'?'Walking trails':'';
 if(item.romanRoad)return category==='history'?'Archaeology · Roman roads':'';
 const name=item.name||'';
 if(item.displayCategory==='events')return category==='events'?( /festival|fringe/i.test(name)?'Festivals':'Shows & events'):'';
 if(item.source?.kind==='route-publisher'){
  if(category!=='walks')return '';
  if(/temple|corbar|edge/i.test(name))return 'Hill walks';
  if(/town|georgian|heritage/i.test(name))return 'Town trails';
  return /river|water|reservoir/i.test(name)?'Waterside walks':'Countryside walks';
 }
 if(category==='family'){
  if(/pavilion gardens/i.test(name))return 'Parks & play';
  if(/grin low woods|buxton country park/i.test(name))return 'Woodland adventures';
  return item.familyActivity||item.displayCategory==='family'?'Family activities':'';
 }
 if(category==='history'&&/^Buxton Opera House$/i.test(name))return 'Historic buildings';
 if(/opera house|theat(?:re|er)|cinema/i.test(name))return category==='arts'?'Stage & screen':'';
 if(item.section==='museums'||/museum|galler(?:y|ies)/i.test(name))return category==='arts'?'Museums & galleries':'';
 if(/cavern|cave\b/i.test(name))return category==='nature'?'Caves':'';
 if(/solomon.s temple|corbar cross/i.test(name))return category==='nature'?'Viewpoints':'';
 if(item.theme==='nature'||/gardens|country park|woods/i.test(name))return category==='nature'?'Gardens & countryside':'';
 if(category!=='history')return '';
 if(/crescent|pump room|st\.? ann.s well|thermal baths/i.test(name))return 'Spa heritage';
 if(item.theme==='architecture'||item.section==='buildings'||/old hall hotel/i.test(name))return 'Historic buildings';
 return item.historyOnly||item.theme==='history'||item.section==='history'?'Local history':'';
}
function segmentLabels(item){
 const labels=[buxtonSegment(item,selected)];
 if(selected==='history'){
  // A property's own visitor website can establish its operator.
  const website=item.website||'';
  if(/^https:\/\/(?:www\.)?nationaltrust\.org\.uk\/visit\/[^/]+\/[^/?#]+/i.test(website))labels.push('National Trust');
  if(/^https:\/\/(?:www\.)?english-heritage\.org\.uk\/visit\/places\/[^/?#]+/i.test(website))labels.push('English Heritage');
 }
 return labels;
}
function renderSegments(items){
 const controls=$('segmentFilters');
 controls.replaceChildren();
 controls.hidden=!isBuxtonPilot()||!items.length;
 if(controls.hidden)return items;
 const segments=[...new Set(items.flatMap(segmentLabels))];
 if(!segments.includes(selectedSegment))selectedSegment='';
 for(const label of ['',...segments]){
  const button=node('button',label||'All');
  button.type='button';button.className='action secondary';
  button.setAttribute('aria-pressed',String(label===selectedSegment));
  button.onclick=()=>{selectedSegment=label;render();};
  controls.append(button);
 }
 return selectedSegment?items.filter(item=>segmentLabels(item).includes(selectedSegment)):items;
}
let sections=standardSections,selectedSegment='';
const categoryHelp={events:'Upcoming and ongoing events with dates checked against the organiser. Check the organiser for the latest programme and age guidance.',walks:'Walks and outdoor places. Each card distinguishes a documented walk from a place to visit. Check routes, terrain and access; map distances are not walk lengths.',family:'Local places to explore together. Check venue details for age guidance and access.',history:'Discover local stories, museums, galleries and heritage. Map links for stories may show a related area.',attractions:'Landmarks, museums, heritage and local stories, each shown once. A town search includes the surrounding area.'};
const originalNames={attractions:'Place to see',gems:'Lesser-known place',walks:'Walk',photos:'Photo spot',family:'Family activity',museums:'Museum or gallery',history:'History & stories',buildings:'Building & architecture',events:'Local event'};
function eventDateLabel(item){
 const t=item.eventTiming;if(!t?.start||!t?.end)return 'Dates to be confirmed — check the organiser';
 const format=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 return format(t.start)+' – '+format(t.end)+' · check the organiser';
}
function outdoorPlace(item){return item.theme==='nature'&&/\b(park|gardens?|woodland|forest|hill|mountain|ridge|valley|beach|coast|lake|reservoir|nature reserve|countryside)\b/i.test(item.name+' '+item.background)}
const mappedPoint=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
function distanceFromReference(item){
 if(!mappedPoint(item.coord))return Infinity;
 const origin=guide?.location;if(!mappedPoint(origin))return Number.isFinite(item.distanceKm)&&item.distanceKm>=0?item.distanceKm:Infinity;
 const r=x=>x*Math.PI/180,a=r(item.coord.lat-origin.lat),b=r(item.coord.lon-origin.lon);
 return 6371*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(a/2)**2+Math.cos(r(origin.lat))*Math.cos(r(item.coord.lat))*Math.sin(b/2)**2)));
}
function distanceText(item){const km=distanceFromReference(item);return !Number.isFinite(km)?'Distance unavailable':km<1?Math.round(km*1000)+' m':km.toFixed(1)+' km';}
function itemsForCategory(items,category){
 const canonical=globalThis.DriveLogic.canonicalPlaces(items);
 let matched=canonical.filter(item=>isBuxtonPilot()?buxtonSegment(item,category):item.displayCategory===category);
 if(category==='family'&&!isBuxtonPilot()){
  const removed=/\b(cinemas?|movie theat(?:re|er)s?|bowling|escape rooms?|(?:mini(?:ature)?[ -]?|crazy |adventure )golf)\b/i;
  matched=matched.filter(item=>!removed.test(item.name));
 }
 if(category==='events')matched=matched.filter(item=>item.eventTiming?.start&&Date.parse(item.eventTiming.end+'T23:59:59.999Z')>=Date.now());
 const unique=new Map(matched.map(item=>[item.id,item]));
 return [...unique.values()].sort((a,b)=>distanceFromReference(a)-distanceFromReference(b)||a.name.localeCompare(b.name,'en'));
}
function hasFamilyTaster(){
 const loc=guide?.location;
 return !!$('familyFinder') && !!loc && loc.lat>=49.7 && loc.lat<=61.1 && loc.lon>=-8.3 && loc.lon<=2.1;
}
function renderCategories(){
 sections=isBuxtonPilot()?buxtonSections:standardSections;
 const visible=isBuxtonPilot()?Object.keys(sections):Object.keys(sections).filter(key=>key==='events'
  ? guide&&itemsForCategory(guide.items,key).length
  : (key==='family'&&hasFamilyTaster())||!guide||guide.complete===false||itemsForCategory(guide.items,key).length);
 if(!visible.length)$('backToCategories').hidden=true;
 if(!visible.includes(selected))selected=visible[0]||'attractions';
 $('tabs').replaceChildren();
 for(const[key,[icon,name,hint]]of Object.entries(sections)){
  if(!visible.includes(key))continue;
  const b=document.createElement('button');b.type='button';b.className='tab';b.setAttribute('aria-pressed',String(selected===key));
  const symbol=node('span',icon);symbol.className='category-icon';symbol.setAttribute('aria-hidden','true');
  const copy=document.createElement('span');copy.className='category-copy';copy.append(node('strong',name),node('small',hint));
  b.append(symbol,copy);b.onclick=()=>{selected=key;selectedSegment='';renderCategories();if(guide){render()}else $('categoryMsg').textContent='Choose a location below to explore '+name.toLowerCase()+'.'};$('tabs').append(b);
 }
 const familyFinder=$('familyFinder');
 if(familyFinder){
  const loc=guide?.location;
  familyFinder.hidden=selected!=='family'||!hasFamilyTaster();
  familyFinder.href=loc&&!familyFinder.hidden?'/family-days.html?'+new URLSearchParams({place:loc.label,lat:loc.lat,lon:loc.lon}):'/family-days.html';
 }
 for(const [id,path]of [['foodTile','/food-open-test'],['stayTile','/stay']]){if($(id)){const params=new URLSearchParams();if(guide?.location){params.set('place',guide.location.label);if(Number.isFinite(guide.location.lat)&&Number.isFinite(guide.location.lon)){params.set('lat',guide.location.lat);params.set('lon',guide.location.lon);}}$(id).href=path+(params.toString()?'?'+params.toString():'');}}
 $('categoryMsg').textContent=guide?(visible.length?'':'No supported suggestions found for this search yet. Try a nearby town.'):'Choose what interests you, then search a place or use your location.';
 $('categoryMsg').hidden=!!guide&&!!visible.length;
}
const icons={nature:'🌿',culture:'🎨',experience:'🎟️',architecture:'🏛️',history:'📜'};
let detailHistory=false;
let guide=null,selected='attractions',requestId=0,lastInput=null,controller=null,activeItem=null,inFlight=false;
function link(text,url){const a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.rel='noopener';return a}
function node(tag,text){const e=document.createElement(tag);e.textContent=text;return e}
function mapUrl(item){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(item.coord.lat+','+item.coord.lon)}
function renderVisitorInformation(){
 const panel=$('visitorInformation'),list=$('visitorInfoList');list.replaceChildren();
 const items=guide.visitorInformation||[];panel.hidden=!items.length;
 for(const info of items){
  const article=document.createElement('article');article.append(node('h3',info.name),node('p',info.description));
  const links=document.createElement('p');links.className='links';
  if(info.website)links.append(link('Visitor website ↗',info.website));
  const query=info.mapQuery||(info.coord.lat+','+info.coord.lon);
  links.append(link('View map ↗','https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query)),link('Source: '+info.source.title+' ↗',info.source.url));article.append(links);list.append(article);
 }
}
function render(){
 guide.items=globalThis.DriveLogic.canonicalPlaces(guide.items);
 $('introduction').hidden=false;$('results').hidden=false;$('locationName').textContent=guide.location.label;
 $('overview').textContent=guide.overview||'Choose a suggestion below to start exploring. We have kept the selection to what the available sources can support.';
 $('coverage').replaceChildren(...guide.coverage.notes.map(text=>node('p',text)));
 $('checked').textContent='Sources retrieved '+new Date(guide.checkedAt).toLocaleString('en-GB')+'. Next refresh when in use after '+new Date(guide.cacheUntil).toLocaleString('en-GB')+'.';
 $('areaSources').replaceChildren();for(const source of guide.sources){$('areaSources').append(link(source.kind==='wikivoyage'?'Travel guide ↗':source.kind==='openstreetmap'?'Map data: OpenStreetMap ↗':'Place background ↗',source.url),document.createTextNode(' '))}
 renderCategories();renderVisitorInformation();if($('listenNearby'))$('listenNearby').disabled=!guide.items.length;
 if(!isBuxtonPilot()&&!hasFamilyTaster()&&!Object.keys(sections).some(key=>itemsForCategory(guide.items,key).length)&&guide.complete!==false){$('results').hidden=true;return;}
 $('sectionTitle').textContent=sections[selected][1]+' near '+guide.location.label;$('sectionHelp').textContent=(isBuxtonPilot()?sections[selected][2]:categoryHelp[selected]||sections[selected][2])+' Nearest first; distances are in a straight line.';
 if(selected==='attractions'){
  const where=mappedPoint(guide.location)?guide.location.lat+','+guide.location.lon:guide.location.label;
  const query='museums and galleries near '+where;
  $('sectionHelp').append(document.createTextNode(' '),link('More museums on Google Maps ↗','https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query)));
 }
 $('cards').replaceChildren();const items=renderSegments(itemsForCategory(guide.items,selected));
 if(!items.length){const p=node('p',guide.complete===false?'Suggestions for this category are still being prepared.':isBuxtonPilot()&&selected==='events'?'No upcoming events with confirmed dates in this guide yet.':selected==='history'?'No supported history or cultural suggestions found in this search yet. This does not mean the place has no history or culture.':'No sufficiently supported '+sections[selected][1].toLowerCase()+' found in this search yet. You can try another category or a nearby town.');p.className='empty';$('cards').append(p);return}
 for(const item of items){
  const card=document.createElement('article');card.className='card';const photo=node('button',globalThis.DriveLogic.placeIcon(item));photo.className='photo';photo.type='button';photo.setAttribute('aria-label','Read about '+item.title);photo.onclick=()=>openItem(item);
  if(globalThis.DriveLogic.placePhoto(item)){const img=document.createElement('img');img.src=item.image.url;img.alt=item.name;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>photo.replaceChildren(document.createTextNode(globalThis.DriveLogic.placeIcon(item)));photo.replaceChildren(img)}
  const body=document.createElement('div');body.className='body';const kind=node('small',item.romanRoad?'Roman archaeology · '+item.romanRoad.status:originalNames[item.section]||'Place to visit');kind.className='kind';body.append(kind);
  const h=document.createElement('h3'),title=node('button',item.title);title.className='title';title.onclick=()=>openItem(item);h.append(title);body.append(h);if(item.subject)body.append(node('small',item.subject));body.append(node('p',globalThis.DriveLogic.narration(item,{nearby:false})));if(item.familyActivity&&selected!=='family')body.append(node('small','Family activity · check venue age guidance'));if(item.eventArea){const dates=node('small',eventDateLabel(item));dates.className='event-dates';body.append(dates);}if(guide.items.some(x=>x.id===item.id&&x.section==='photos')){const badge=node('small','📷 Photo spot');badge.className='photo-badge';body.append(badge);}const distance=node('small',item.eventArea?distanceText(item)+(item.eventTiming?.venue?' to the event venue':' to the event area'):item.historyOnly?'Related to this area':distanceText(item)+' from '+(guide.location.mode==='nearby'?'your search location':'the area’s reference point'));distance.className='distance';body.append(distance);
  const links=document.createElement('div');links.className='links';const listen=node('button','▶ Listen to this place');listen.className='textbutton';listen.onclick=()=>listenToItem(item);const read=node('button','Read about this place');read.className='textbutton';read.onclick=()=>openItem(item);links.append(read,listen,link(item.eventArea?(item.eventTiming?.venue?'Event venue ↗':'Event area ↗'):item.historyOnly?'Related area ↗':'View map ↗',mapUrl(item)));if(item.website)links.append(link('Venue website ↗',item.website));body.append(links);card.append(photo,body);$('cards').append(card);
 }
}
function openItem(item){
 item={...item,image:globalThis.DriveLogic.placePhoto(item)};activeItem=item;$('detailTitle').textContent=item.title;$('detailKind').textContent=originalNames[item.section]||'Place to visit';const opening=globalThis.DriveLogic.narration(item,{nearby:false});
 $('detailReason').textContent=opening;
 const more=globalThis.DriveLogic.followUp(item,opening);
 $('detailBackground').textContent=more;
 $('background').hidden=!more;
 $('background').open=false;
 $('detailDistance').textContent=item.eventArea?eventDateLabel(item)+(item.eventTiming?.venue?'. The map shows the listed venue.':'. The map shows the wider event area.')+' Check the organiser’s programme and age guidance.':item.historyOnly?'This story is associated with the area shown on the map.':distanceText(item)+' in a straight line from the search reference point. Check a suitable route and current access before travelling.';
 const image=$('detailImage');image.replaceChildren();image.hidden=!item.image;
 if(globalThis.DriveLogic.placePhoto(item)){const img=document.createElement('img');img.src=item.image.url;img.alt=item.name;img.referrerPolicy='no-referrer';img.onerror=()=>{image.hidden=true};const credit=document.createElement('figcaption');credit.append(node('small',item.image.creator+' · '+item.image.license+' '),link('Photo and licence ↗',item.image.sourceUrl));image.append(img,credit)}
 $('detailLinks').replaceChildren(link('Source: '+item.source.title+' ↗',item.source.url),link(item.eventArea?(item.eventTiming?.venue?'Event venue ↗':'Event area ↗'):item.historyOnly?'Related area ↗':'View map ↗',mapUrl(item)));
 if(item.website)$('detailLinks').append(link('Venue website ↗',item.website));
 if(item.eventTiming?.sourceUrl)$('detailLinks').append(link('Organiser dates ↗',item.eventTiming.sourceUrl));
 for(const source of item.supportingSources||[])$('detailLinks').append(link('Local guide: '+source.title+' ↗',source.url));
 $('reportText').hidden=true;document.body.style.overflow='hidden';const wasOpen=$('dialog').open;$('dialog').showModal();$('dialog').scrollTop=0;if(!wasOpen&&globalThis.history?.pushState){try{globalThis.history.pushState({...globalThis.history.state,discoverPlaceDetail:true},'');detailHistory=true;}catch{detailHistory=false;}}
}
function listenToItem(item){if(globalThis.ExploreNarration){globalThis.ExploreNarration.listen(item,guide.location);if($('dialog').open)$('dialog').close();}}
$('listenDetail').onclick=()=>{if(activeItem)listenToItem(activeItem)};
function closeDetail(){if($('dialog').open)$('dialog').close();}
$('close').onclick=closeDetail;if($('closeDetailBottom'))$('closeDetailBottom').onclick=closeDetail;
$('dialog').addEventListener('close',()=>{document.body.style.overflow='';if(detailHistory){detailHistory=false;if(globalThis.history?.state?.discoverPlaceDetail)globalThis.history.back();}});
globalThis.window?.addEventListener?.('popstate',()=>{detailHistory=false;closeDetail();});
$('report').onclick=()=>{const p=$('reportText');p.hidden=false;p.textContent=`Please send Mike this feedback in ChatGPT: ${guide.location.label} — ${activeItem.title} — what was unsuitable, missing or incorrect. This button does not send a report automatically.`};
async function explore(input,{quiet=false}={}){
 if(!quiet){globalThis.ExploreNarration?.reset();input={...input,specialists:researchMode&&!!$('specialists').checked};}
 const id=++requestId;controller?.abort();controller=new AbortController();const currentController=controller;lastInput=input;inFlight=true;
 if(!quiet){$('status').textContent='Finding a varied selection and checking the source material. The first guide may take a little while…';$('searchBtn').disabled=true;$('gps').disabled=true;}
 $('error').hidden=true;$('choices').replaceChildren();
 const timer=setTimeout(()=>currentController.abort(),120000);
 try{
  while(true){
  const response=await fetch('/api/explore',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...input,progressive:true}),signal:currentController.signal});const data=await response.json();if(id!==requestId)return;
  if(!response.ok){if(data.choices?.length){for(const choice of data.choices){const b=node('button',choice.title+(choice.description?' — '+choice.description:''));b.className='action secondary';b.onclick=()=>{$('place').value=choice.title;explore({place:choice.title})};$('choices').append(b)}}throw Error(data.error||'The guide could not be loaded.')}
  if(!quiet||data.complete!==false){if(guide?.location?.label!==data.location.label)selectedSegment='';guide=data;render();}if(data.complete===false){$('status').textContent='Here are the first suggestions. More places, photographs and categories are on their way…';await new Promise(resolve=>setTimeout(resolve,1500));if(id!==requestId)return;continue;}
  $('status').textContent='Showing '+guide.items.length+' suggestions covering '+new Set(guide.items.map(x=>x.id)).size+' places in '+guide.location.label+'.';
  break;
  }
 }catch(error){if(id!==requestId)return;if(!quiet){$('error').hidden=false;$('error').textContent=error.name==='AbortError'?guide?.complete===false?'The fuller guide took too long. The first source-based suggestions remain below; please try again.':'The guide took too long to prepare. Please try again.':error.message;$('status').textContent=guide?'The previous guide is still shown below.':'';}}
 finally{clearTimeout(timer);if(id===requestId){inFlight=false;$('searchBtn').disabled=false;$('gps').disabled=false}}
}
if(globalThis.DiscoverPlaceSearch)globalThis.DiscoverPlaceSearch.attach({form:$('searchForm'),input:$('place'),list:$('placeSuggestions'),message:$('placeMatchStatus'),clearScope:$('clearPlaceScope'),onChoose:choice=>explore({place:choice.title})});
else $('searchForm').addEventListener('submit',event=>{event.preventDefault();const place=$('place').value.trim();if(place)explore({place})});
$('gps').onclick=()=>{if(!navigator.geolocation){$('error').hidden=false;$('error').textContent='GPS is unavailable. Please search a town instead.';return}$('status').textContent='Waiting for your location permission…';navigator.geolocation.getCurrentPosition(p=>explore({lat:Number(p.coords.latitude.toFixed(3)),lon:Number(p.coords.longitude.toFixed(3))}),()=>{$('status').textContent='Location could not be found. You can search a town instead.'},{enableHighAccuracy:false,timeout:15000,maximumAge:60000})};
function refreshIfDue(){if(guide&&lastInput&&!inFlight&&!document.hidden&&Date.now()>=Date.parse(guide.cacheUntil))explore(lastInput,{quiet:true})}
setInterval(refreshIfDue,600000);document.addEventListener('visibilitychange',refreshIfDue);

renderCategories();

const backCategories=$('backToCategories');
backCategories.onclick=()=>{
 const target=$('categories');
 target.scrollIntoView?.({behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 const first=$('tabs').querySelector?.('button');first?.focus({preventScroll:true});
};
if(typeof IntersectionObserver!=='undefined'){
 new IntersectionObserver(entries=>{const entry=entries[0];backCategories.hidden=!$('tabs').children.length||entry.isIntersecting||entry.boundingClientRect.top>0;},{threshold:0}).observe($('categories'));
}else if(typeof window!=='undefined'){
 const update=()=>{backCategories.hidden=!$('tabs').children.length||$('categories').getBoundingClientRect().bottom>=0};window.addEventListener('scroll',update,{passive:true});update();
}

$('listenNearby').onclick=()=>{if(!guide?.items.length)return;const items=itemsForCategory(guide.items,selected);const item=(items.length?items:guide.items).slice().sort((a,b)=>(a.distanceKm??Infinity)-(b.distanceKm??Infinity))[0];if(item)listenToItem(item);};

function saveExploreReturn(){
 if(!guide)return;globalThis.DiscoverReturnState?.save('explore',{guide,selected,lastInput,place:$('place').value,scroll:globalThis.window?.scrollY||0});
}
for(const id of ['foodTile','stayTile'])if($(id))$(id).addEventListener('click',saveExploreReturn);
globalThis.window?.addEventListener?.('pagehide',saveExploreReturn);
try{
 const saved=globalThis.DiscoverReturnState?.load('explore');
 if(saved?.guide?.location&&Array.isArray(saved.guide.items)&&saved.guide.coverage&&Array.isArray(saved.guide.sources)){
  guide=saved.guide;selected=saved.selected;lastInput=saved.lastInput||null;$('place').value=saved.place||'';render();setTimeout(()=>globalThis.window?.scrollTo?.({top:Number(saved.scroll)||0,behavior:'instant'}),0);
 }
}catch{/* A missing return point must not prevent a fresh search. */}

