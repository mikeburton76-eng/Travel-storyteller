'use strict';
const $=id=>document.getElementById(id);
const sections={
 summary:['📖','Summary of the place','Get a feel for the place'],
 attractions:['📍','Must-see sights','The main things to see and do'],
 gems:['💎','Hidden gems','Less obvious places worth finding'],
 walks:['🥾','Walks','Explore on foot'],
 photos:['📷','Photo opportunities','Find a great view'],
 family:['👨‍👩‍👧','Family activities','Enjoy a day out together'],
 museums:['🖼️','Museums & galleries','Discover art and culture'],
 history:['📜','History & stories','What happened here'],
 buildings:['🏛️','Buildings & architecture','Notice the details']
};
const categoryHelp={walks:'Places and routes mentioned for walking. Check the route, terrain and conditions; map distances are to the place, not the length of a walk.',photos:'Views and subjects supported by the source descriptions. Stay on permitted paths and check access before visiting.',family:'Ideas with source information relevant to families. Check age guidance, steps, access and current visitor information.',museums:'Places to explore collections, art and local culture.',history:'People, discoveries, traditions and how places changed. Map links may show a related area.',attractions:'Main visitor highlights from the available sources. A town search includes the surrounding area.',gems:'Lesser-known suggestions need supporting source evidence.',buildings:'Buildings worth noticing for their architecture or story.'};
function renderCategories(){
 $('tabs').replaceChildren();
 for(const[key,[icon,name,hint]]of Object.entries(sections)){
  const b=document.createElement('button');b.type='button';b.className='tab';b.setAttribute('aria-pressed',String(selected===key));
  const symbol=node('span',icon);symbol.className='category-icon';symbol.setAttribute('aria-hidden','true');
  const copy=document.createElement('span');copy.className='category-copy';copy.append(node('strong',name),node('small',hint));
  b.append(symbol,copy);b.onclick=()=>{selected=key;renderCategories();if(guide){render();if(key==='summary')$('introduction').scrollIntoView?.({behavior:'smooth',block:'start'})}else $('categoryMsg').textContent='Choose a location below to explore '+name.toLowerCase()+'.'};$('tabs').append(b);
 }
 $('categoryMsg').textContent=guide?(selected==='summary'?'A short introduction to help you get your bearings.':categoryHelp[selected]):'Choose what interests you, then search a place or use your location.';
}
const icons={nature:'🌿',culture:'🎨',experience:'🎟️',architecture:'🏛️',history:'📜'};
let guide=null,selected='attractions',requestId=0,lastInput=null,controller=null,activeItem=null,inFlight=false;
function link(text,url){const a=document.createElement('a');a.textContent=text;a.href=url;a.target='_blank';a.rel='noopener';return a}
function node(tag,text){const e=document.createElement(tag);e.textContent=text;return e}
function mapUrl(item){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(item.coord.lat+','+item.coord.lon)}
function render(){
 $('introduction').hidden=false;$('results').hidden=false;$('locationName').textContent=guide.location.label;
 $('overview').textContent=guide.overview||'Choose a suggestion below to start exploring. We have kept the selection to what the available sources can support.';
 $('coverage').replaceChildren(...guide.coverage.notes.map(text=>node('p',text)));
 $('checked').textContent='Sources checked '+new Date(guide.checkedAt).toLocaleString('en-GB')+'. Next source check when in use after '+new Date(guide.cacheUntil).toLocaleString('en-GB')+'.';
 $('areaSources').replaceChildren();for(const source of guide.sources){$('areaSources').append(link(source.kind==='wikivoyage'?'Travel guide ↗':'Place background ↗',source.url),document.createTextNode(' '))}
 renderCategories();
 if(selected==='summary'){$('results').hidden=true;return}
 $('sectionTitle').textContent=sections[selected][1]+' near '+guide.location.label;$('sectionHelp').textContent=categoryHelp[selected]||sections[selected][2];
 $('cards').replaceChildren();const items=guide.items.filter(x=>x.section===selected);
 if(!items.length){const p=node('p',guide.complete===false?'Suggestions for this category are still being prepared.':selected==='gems'?'No sufficiently supported hidden gems found in this search. We have not filled the list with guesses.':selected==='history'?'No suitable historical stories identified in this search yet. This does not mean the place has no history.':'No sufficiently supported '+sections[selected][1].toLowerCase()+' found in this search yet. You can try another category or a nearby town.');p.className='empty';$('cards').append(p);return}
 for(const item of items){
  const card=document.createElement('article');card.className='card';const photo=node('button',icons[item.theme]||'📍');photo.className='photo';photo.type='button';photo.setAttribute('aria-label','Read about '+item.title);photo.onclick=()=>openItem(item);
  if(item.image){const img=document.createElement('img');img.src=item.image.url;img.alt=item.name;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>photo.replaceChildren(document.createTextNode(icons[item.theme]||'📍'));photo.replaceChildren(img)}
  const body=document.createElement('div');body.className='body';const kind=node('small',selected==='attractions'?'Place to see':sections[selected][1]);kind.className='kind';body.append(kind);
  const h=document.createElement('h3'),title=node('button',item.title);title.className='title';title.onclick=()=>openItem(item);h.append(title);body.append(h,node('p',item.reason));const distance=node('small',item.historyOnly?'Related to this area':item.distanceKm+' km from '+(guide.location.mode==='nearby'?'your search location':'the area’s reference point'));distance.className='distance';body.append(distance);
  const links=document.createElement('div');links.className='links';const read=node('button','Read about this place');read.className='textbutton';read.onclick=()=>openItem(item);links.append(read,link(item.historyOnly?'Related area ↗':'View map ↗',mapUrl(item)));body.append(links);card.append(photo,body);$('cards').append(card);
 }
}
function openItem(item){
 activeItem=item;$('detailTitle').textContent=item.title;$('detailKind').textContent=sections[item.section][1];$('detailReason').textContent=item.reason;$('detailBackground').textContent=item.background;$('background').open=false;
 $('detailDistance').textContent=item.historyOnly?'This story is associated with the area shown on the map.':item.distanceKm+' km in a straight line from the search reference point. Check a suitable route and current access before travelling.';
 const image=$('detailImage');image.replaceChildren();image.hidden=!item.image;
 if(item.image){const img=document.createElement('img');img.src=item.image.url;img.alt=item.name;img.referrerPolicy='no-referrer';img.onerror=()=>{image.hidden=true};const credit=document.createElement('figcaption');credit.append(node('small',item.image.creator+' · '+item.image.license+' '),link('Photo and licence ↗',item.image.sourceUrl));image.append(img,credit)}
 $('detailLinks').replaceChildren(link('Source: '+item.source.title+' ↗',item.source.url),link(item.historyOnly?'Related area ↗':'View map ↗',mapUrl(item)));
 for(const source of item.supportingSources||[])$('detailLinks').append(link('Local guide: '+source.title+' ↗',source.url));
 $('reportText').hidden=true;document.body.style.overflow='hidden';$('dialog').showModal();$('dialog').scrollTop=0;
}
$('close').onclick=()=>$('dialog').close();$('dialog').addEventListener('close',()=>document.body.style.overflow='');
$('report').onclick=()=>{const p=$('reportText');p.hidden=false;p.textContent=`Please send Mike this feedback in ChatGPT: ${guide.location.label} — ${activeItem.title} — what was unsuitable, missing or incorrect. This button does not send a report automatically.`};
async function explore(input,{quiet=false}={}){
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
$('searchForm').addEventListener('submit',event=>{event.preventDefault();const place=$('place').value.trim();if(place)explore({place})});
$('gps').onclick=()=>{if(!navigator.geolocation){$('error').hidden=false;$('error').textContent='GPS is unavailable. Please search a town instead.';return}$('status').textContent='Waiting for your location permission…';navigator.geolocation.getCurrentPosition(p=>explore({lat:Number(p.coords.latitude.toFixed(3)),lon:Number(p.coords.longitude.toFixed(3))}),()=>{$('status').textContent='Location could not be found. You can search a town instead.'},{enableHighAccuracy:false,timeout:15000,maximumAge:60000})};
function refreshIfDue(){if(guide&&lastInput&&!inFlight&&!document.hidden&&Date.now()>=Date.parse(guide.cacheUntil))explore(lastInput,{quiet:true})}
setInterval(refreshIfDue,600000);document.addEventListener('visibilitychange',refreshIfDue);

renderCategories();
