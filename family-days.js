'use strict';
const byId=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const valid=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=49.7&&lat<=61.1&&lon>=-8.3&&lon<=2.1;
let base={lat:53.2574,lon:-1.9098,label:'Buxton, Derbyshire'};
if(params.has('lat')&&params.has('lon')&&valid(Number(params.get('lat')),Number(params.get('lon')))){
 base={lat:Number(params.get('lat')),lon:Number(params.get('lon')),label:params.get('place')||'your search location'};
}
let venues=[], towns=[];
byId('town').value=base.label;
if(['5','10','20','30'].includes(params.get('radius')))byId('radius').value=params.get('radius');
function miles(a,b){
 const rad=n=>n*Math.PI/180;
 const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;
 return 3958.76*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
function element(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
function render(){
 const radius=Number(byId("radius").value);
 const type=byId('kind').value;
 const nearby=venues.filter(v=>!type||Object.hasOwn(v.activities,type)).map(v=>({v,d:miles(base,v)})).filter(x=>x.d<=radius).sort((a,b)=>a.d-b.d);
 byId('heading').textContent='Around '+base.label;
 byId('summary').textContent=nearby.length?nearby.length+' listed '+(nearby.length===1?'listing':'listings')+' within '+radius+' miles · nearest first':'No listed activities within '+radius+' miles. Try a wider distance or another activity.';
 const list=byId('list');list.replaceChildren();
 for(const {v,d} of nearby){
  const article=element('article','');article.className='card';
  const body=element('div','');body.className='body';article.append(body);
  const kinds=Object.keys(v.activities);
  const options=new Intl.ListFormat('en-GB',{type:'conjunction'}).format(kinds.map(k=>k.toLowerCase()));
  body.append(element('small',Object.keys(v.activities).join(' · ')+' · '+d.toFixed(1)+' miles'),element('h3',v.name));
  body.append(element('p',v.description || v.playNote || ('Try '+options+' here.')));
  for(const [kind,url] of Object.entries(v.activities)){
   const link=element('a',kind+' details');link.href=url;body.append(link);
  }
  const map=element('a','Check the drive');const q=new URLSearchParams({api:'1',origin:base.lat+','+base.lon,destination:v.name+' '+(v.postcode||''),travelmode:'driving'});
  if(!v.postcode)q.set('destination',v.lat+','+v.lon);
  map.href='https://www.google.com/maps/dir/?'+q;body.append(map);list.append(article);
 }
}
byId('kind').onchange=render;
const townInput=byId('town');
const normalize=value=>value.trim().toLocaleLowerCase('en-GB');
function suggest(){
 const term=normalize(townInput.value);
 const list=byId('places');list.replaceChildren();
 if(term.length<2)return;
 for(const [label] of towns.filter(([name])=>normalize(name).startsWith(term)).slice(0,20)){
  const option=element('option','');option.value=label;list.append(option);
 }
}
townInput.oninput=suggest;
byId('radius').onchange=render;
byId('search').onsubmit=event=>{
 event.preventDefault();
 const term=normalize(townInput.value);
 const matches=towns.filter(([name])=>[name,name.split(',')[0]].some(value=>normalize(value)===term));
 if(matches.length===1){
  const [label,lat,lon]=matches[0];base={label,lat,lon};townInput.value=label;
 }else if(term!==normalize(base.label)||matches.length>1){
  byId('status').textContent=matches.length?'Several places share that name. Choose one from the suggestions.':'Choose a town from the suggestions or try a nearby town.';
  suggest();return;
 }
 byId('status').textContent='';render();
};
fetch('family-towns.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{
 towns=data;suggest();
}).catch(()=>{byId('status').textContent='Town names could not load. Refresh to try again.';});
fetch('family-venues.json').then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{
 venues=data;for(const name of [...new Set(venues.flatMap(v=>Object.keys(v.activities)))].sort()){const option=element('option',name);option.value=name;byId('kind').append(option);}
 if(params.get('activity')==='soft-play')byId('kind').value='Soft play';
 render();
}).catch(()=>{byId('status').textContent='The activity catalogue could not load. Refresh to try again.';});
