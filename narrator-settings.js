'use strict';
(()=>{
 const el=id=>document.getElementById(id),select=el('narratorChoice');if(!select)return;
 let serverVoice='en_GB-southern_english_female-low',serverReady=false,preferred='piper';
 try{preferred=localStorage.getItem('discoverPlaces.narrator')||'piper'}catch{}
 function load(){const old=select.value||preferred;select.replaceChildren(new Option('Pippa · Southern English female','piper'));const voices=globalThis.speechSynthesis?.getVoices()||[];voices.slice().sort((a,b)=>Number(!/^en[-_]/i.test(a.lang))-Number(!/^en[-_]/i.test(b.lang))||a.name.localeCompare(b.name)).forEach(v=>select.add(new Option(v.name+' · '+v.lang,'phone:'+v.voiceURI)));select.value=[...select.options].some(o=>o.value===old)?old:'piper';el('narratorLabel').textContent='Narrator: '+(select.value==='piper'?'Pippa':select.selectedOptions[0].textContent.split(' · ')[0])+' ▾';if(old!==select.value)el('narratorMessage').textContent='Your saved phone voice is unavailable here. Pippa is selected; choose and preview another voice if you wish.';else el('narratorMessage').textContent=serverReady?'Pippa uses the existing app narrator. Phone voices depend on this device.':'Phone voices are available to preview. Checking Pippa…';}
 const ready=fetch('/voices').then(async r=>{if(!r.ok)throw Error('Pippa’s configuration could not be loaded.');const c=await r.json();serverVoice=c.defaultVoice;serverReady=true;load()}).catch(e=>{el('narratorMessage').textContent=e.message+' Try refreshing, or choose a phone voice.'});
 select.onchange=()=>{globalThis.ExploreNarration?.stop();preferred=select.value;try{localStorage.setItem('discoverPlaces.narrator',preferred)}catch{}load()};
 el('narratorPreview').onclick=()=>{globalThis.ExploreNarration?.listen({id:'narrator-preview',name:'Voice preview',title:'Voice preview',reason:'Welcome to Discover Places. Your companion for travelling and exploring. Discover information about the places around you and ideas for what to see and do.'},{label:'Discover Places',mode:'nearby'})};
 globalThis.speechSynthesis?.addEventListener('voiceschanged',load);
 globalThis.DiscoverNarrator={ready:()=>ready,get:()=>select.value.startsWith('phone:')?{provider:'phone',uri:select.value.slice(6)}:{provider:'piper',voice:serverVoice}};load();
})();
