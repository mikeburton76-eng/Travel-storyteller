'use strict';
const $=id=>document.getElementById(id);
const researchMode=typeof location!=='undefined'&&new URLSearchParams(location.search).get('research')==='1';
$('researchOptions').hidden=!researchMode;
const sections={
 attractions:['📍','Must-see sights','The main things to see and do'],
 gems:['💎','Hidden gems','Less obvious places worth finding'],
 walks:['🥾','Walks & outdoors','Walks, gardens, parks and countryside'],
 family:['👨‍👩‍👧','Family activities','Enjoy a day out together'],
 history:['📜','History & culture','Stories, museums, galleries and heritage'],
 events:['🎭','What’s on','Festivals, local events and traditions']
};
const categoryHelp={events:'Festivals and local events. Exact dates are shown only when checked against the organiser; annual traditions may still be awaiting dates. Check the programme and age guidance before booking.',walks:'Walks and outdoor places. Each card distinguishes a documented walk from a place to visit. Check routes, terrain and access; map distances are not walk lengths.',family:'Ideas with source information relevant to families. Check age guidance, steps, access and current visitor information.',history:'Discover local stories, museums, galleries and heritage. Map links for stories may show a related area.',attractions:'Main visitor highlights, landmarks and buildings from the available sources. A town search includes the surrounding area.',gems:'Less obvious places with a source-supported reason to visit.'};
const originalNames={attractions:'Place to see',gems:'Hidden gem',walks:'Walk',photos:'Photo spot',family:'Family activity',museums:'Museum or gallery',history:'History & stories',buildings:'Building & architecture',events:'Festival or local tradition'};
function eventDateLabel(item){
 const t=item.eventTiming;if(!t?.start||!t?.end)return 'Dates to be confirmed — check the organiser';
 const format=value=>new Date(value+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 return format(t.start)+' – '+format(t.end)+' · check the organiser';
}
function outdoorPlace(item){return item.theme==='nature'&&/\b(park|gardens?|woodland|forest|hill|mountain|ridge|valley|beach|coast|lake|reservoir|nature reserve|countryside)\b/i.test(item.name+' '+item.background)}
function itemsForCategory(items,category){
 const groups={attractions:['attractions','buildings'],gems:['gems'],walks:['walks'],family:['family'],history:['history','museums','buildings'],events:['events']};
 const matched=items.filter(x=>groups[category].includes(x.section)||(category==='walks'&&outdoorPlace(x)&&!x.historyOnly)||(x.section==='photos'&&category===(outdoorPlace(x)?'walks':'attractions')));
 const rank=x=>groups[category].indexOf(x.section)<0?99:groups[category].indexOf(x.section);
 matched.sort((a,b)=>rank(a)-rank(b));
 const unique=new Map();for(const item of matched)if(!unique.has(item.id))unique.set(item.id,item);
 return [...unique.values()];
}
function renderCategories(){
 const visible=Object.keys(sections).filter(key=>!guide||guide.complete===false||itemsForCategory(guide.items,key).length);
 if(!visible.length)$('backToCategories').hidden=true;
 if(!visible.includes(selected))selected=visible[0]||'attractions';
 $('tabs').replaceChildren();
 for(const[key,[icon,name,hint]]of Object.entries(sections)){
  if(!visible.includes(key))continue;
  const b=document.createElement('button');b.type='button';b.className='tab';b.setAttribute('aria-pressed',String(selected===key));
  const symbol=node('span',icon);symbol.className='category-icon';symbol.setAttribute('aria-hidden','true');
  const copy=document.createElement('span');copy.className='category-copy';copy.append(node('strong',name),node('small',hint));
  b.append(symbol,copy);b.onclick=()=>{selected=key;renderCategories();if(guide){render()}else $('categoryMsg').textContent='Choose a location below to explore '+name.toLowerCase()+'.'};$('tabs').append(b);
 }
 if($('foodTile')){const params=new URLSearchParams();if(guide?.location){params.set('place',guide.location.label);if(Number.isFinite(guide.location.lat)&&Number.isFinite(guide.location.lon)){params.set('lat',guide.location.lat);params.set('lon',guide.location.lon);}}$('foodTile').href='/food-open-test'+(params.toString()?'?'+params.toString():'');}
 $('categoryMsg').textContent=guide?(visible.length?categoryHelp[selected]:'No supported suggestions found for this search yet. Try a nearby town.'):'Choose what interests you, then search a place or use your location.';
}
const icons={nature:'🌿',culture:'🎨',experience:'🎟️',architecture:'🏛️',history:'📜'};
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
 $('introduction').hidden=false;$('results').hidden=false;$('locationName').textContent=guide.location.label;
 $('overview').textContent=guide.overview||'Choose a suggestion below to start exploring. We have kept the selection to what the available sources can support.';
 $('coverage').replaceChildren(...guide.coverage.notes.map(text=>node('p',text)));
 $('checked').textContent='Sources retrieved '+new Date(guide.checkedAt).toLocaleString('en-GB')+'. Next refresh when in use after '+new Date(guide.cacheUntil).toLocaleString('en-GB')+'.';
 $('areaSources').replaceChildren();for(const source of guide.sources){$('areaSources').append(link(source.kind==='wikivoyage'?'Travel guide ↗':'Place background ↗',source.url),document.createTextNode(' '))}
 renderCategories();renderVisitorInformation();if($('listenNearby'))$('listenNearby').disabled=!guide.items.length;
 if(!Object.keys(sections).some(key=>itemsForCategory(guide.items,key).length)&&guide.complete!==false){$('results').hidden=true;return;}
 $('sectionTitle').textContent=sections[selected][1]+' near '+guide.location.label;$('sectionHelp').textContent=categoryHelp[selected]||sections[selected][2];
 $('cards').replaceChildren();const items=itemsForCategory(guide.items,selected);
 if(!items.length){const p=node('p',guide.complete===false?'Suggestions for this category are still being prepared.':selected==='gems'?'No sufficiently supported hidden gems found in this search. We have not filled the list with guesses.':selected==='history'?'No supported history or cultural suggestions found in this search yet. This does not mean the place has no history or culture.':'No sufficiently supported '+sections[selected][1].toLowerCase()+' found in this search yet. You can try another category or a nearby town.');p.className='empty';$('cards').append(p);return}
 for(const item of items){
  const card=document.createElement('article');card.className='card';const photo=node('button',icons[item.theme]||'📍');photo.className='photo';photo.type='button';photo.setAttribute('aria-label','Read about '+item.title);photo.onclick=()=>openItem(item);
  if(item.image){const img=document.createElement('img');img.src=item.image.url;img.alt=item.name;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>photo.replaceChildren(document.createTextNode(icons[item.theme]||'📍'));photo.replaceChildren(img)}
  const body=document.createElement('div');body.className='body';const kind=node('small',originalNames[item.section]||'Place to visit');kind.className='kind';body.append(kind);
  const h=document.createElement('h3'),title=node('button',item.title);title.className='title';title.onclick=()=>openItem(item);h.append(title);body.append(h,node('p',item.reason));if(item.eventArea){const dates=node('small',eventDateLabel(item));dates.className='event-dates';body.append(dates);}if(guide.items.some(x=>x.id===item.id&&x.section==='photos')){const badge=node('small','📷 Photo spot');badge.className='photo-badge';body.append(badge);}const distance=node('small',item.eventArea?item.distanceKm+' km to the festival area':item.historyOnly?'Related to this area':item.distanceKm+' km from '+(guide.location.mode==='nearby'?'your search location':'the area’s reference point'));distance.className='distance';body.append(distance);
  const links=document.createElement('div');links.className='links';const listen=node('button','▶ Listen to this place');listen.className='textbutton';listen.onclick=()=>listenToItem(item);const read=node('button','Read about this place');read.className='textbutton';read.onclick=()=>openItem(item);links.append(read,listen,link(item.eventArea?'Festival area ↗':item.historyOnly?'Related area ↗':'View map ↗',mapUrl(item)));body.append(links);card.append(photo,body);$('cards').append(card);
 }
}
function openItem(item){
 activeItem=item;$('detailTitle').textContent=item.title;$('detailKind').textContent=originalNames[item.section]||'Place to visit';$('detailReason').textContent=item.reason;$('detailBackground').textContent=item.background;$('background').open=false;
 $('detailDistance').textContent=item.eventArea?eventDateLabel(item)+'. The map shows the festival area, not a confirmed venue. Check the programme and individual show age guidance.':item.historyOnly?'This story is associated with the area shown on the map.':item.distanceKm+' km in a straight line from the search reference point. Check a suitable route and current access before travelling.';
 const image=$('detailImage');image.replaceChildren();image.hidden=!item.image;
 if(item.image){const img=document.createElement('img');img.src=item.image.url;img.alt=item.name;img.referrerPolicy='no-referrer';img.onerror=()=>{image.hidden=true};const credit=document.createElement('figcaption');credit.append(node('small',item.image.creator+' · '+item.image.license+' '),link('Photo and licence ↗',item.image.sourceUrl));image.append(img,credit)}
 $('detailLinks').replaceChildren(link('Source: '+item.source.title+' ↗',item.source.url),link(item.eventArea?'Festival area ↗':item.historyOnly?'Related area ↗':'View map ↗',mapUrl(item)));
 if(item.eventTiming?.sourceUrl)$('detailLinks').append(link('Organiser dates ↗',item.eventTiming.sourceUrl));
 for(const source of item.supportingSources||[])$('detailLinks').append(link('Local guide: '+source.title+' ↗',source.url));
 $('reportText').hidden=true;document.body.style.overflow='hidden';$('dialog').showModal();$('dialog').scrollTop=0;
}
function listenToItem(item){if(globalThis.ExploreNarration){globalThis.ExploreNarration.listen(item,guide.location);if($('dialog').open)$('dialog').close();}}
$('listenDetail').onclick=()=>{if(activeItem)listenToItem(activeItem)};
$('close').onclick=()=>$('dialog').close();$('dialog').addEventListener('close',()=>document.body.style.overflow='');
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
  if(!quiet||data.complete!==false){guide=data;render();}if(data.complete===false){$('status').textContent='Here are the first suggestions. More places, photographs and categories are on their way…';await new Promise(resolve=>setTimeout(resolve,1500));if(id!==requestId)return;continue;}
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

// UI modes reuse the original AI discovery and narration endpoints.
if($('modeGo')&&$('modeHome')){
 let pageMode='home';
 const setMode=mode=>{pageMode=mode;globalThis.ExploreNarration?.stop();const controls=$('locationControls'),form=$('searchForm');if(mode==='go'){form.before(controls);$('locationHeading').textContent='Discover around you';$('modeHelp').textContent='Use your location, then choose a nearby place to read or hear.';$('listenNearby').hidden=false;$('place').placeholder='Or explore somewhere else';}else{form.after(controls);$('locationHeading').textContent='Where would you like to explore?';$('modeHelp').textContent='Search a place and choose what you would like to read or hear.';$('listenNearby').hidden=true;$('place').placeholder='Town, neighbourhood or landmark';}for(const [id,on]of [['modeGo',mode==='go'],['modeHome',mode==='home']]){if(on)$(id).setAttribute('aria-current','page');else $(id).removeAttribute('aria-current')}globalThis.window?.scrollTo?.({top:0,behavior:'smooth'});};
 $('modeGo').onclick=()=>setMode('go');$('modeHome').onclick=()=>setMode('home');
 $('listenNearby').onclick=()=>{if(!guide?.items.length)return;const items=itemsForCategory(guide.items,selected);const item=(items.length?items:guide.items).slice().sort((a,b)=>(a.distanceKm??Infinity)-(b.distanceKm??Infinity))[0];if(item)listenToItem(item);};
 setMode('home');
}

