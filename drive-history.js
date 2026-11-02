'use strict';
(()=>{
 const STORAGE_KEY='discoverPlaces.drivingHistory.v1';
 function placeKey(item){
  try{const u=new URL(item.source?.url);if(/(^|\.)wikipedia\.org$/i.test(u.hostname))return 'wiki:'+u.hostname.toLowerCase()+':'+decodeURIComponent(u.pathname.replace(/^\/wiki\//,'')).replace(/_/g,' ').toLowerCase();u.hash='';u.search='';return 'source:'+u.href;}catch{}
  return 'place:'+String(item.pageId||item.id||item.name||'').replace(/:([a-f0-9]{16})$/,'');
 }
 function createDriveHistory({storage,now=()=>new Date(),onWarning=()=>{}}={}){
  let state={version:1,skipFamiliar:false,places:{}},failed=false;
  if(!storage)try{storage=globalThis.localStorage;}catch{}
  function warn(){if(!failed){failed=true;onWarning('Listening history cannot be saved in this browser. It will last only while this page stays open.');}}
  function read(){try{if(!storage){warn();return;}const raw=storage.getItem(STORAGE_KEY);if(!raw)return;const data=JSON.parse(raw);if(data.version!==1||!data.places||typeof data.places!=='object')throw Error('Invalid history');const places={};for(const [k,v]of Object.entries(data.places)){if(!/^(wiki|source|place):/.test(k)||!v||!Number.isSafeInteger(v.count)||v.count<0||typeof v.name!=='string')continue;places[k]={name:v.name.slice(0,200),count:v.count,lastDay:typeof v.lastDay==='string'?v.lastDay:'',lastAt:typeof v.lastAt==='string'?v.lastAt:'',allowOnce:v.allowOnce===true};}state={version:1,skipFamiliar:data.skipFamiliar===true,places};}catch{warn();}}
  function save(){try{if(!storage)throw Error('No storage');storage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{warn();}}
  const day=()=>{const d=now();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
  function check(item){read();const row=state.places[placeKey(item)];if(row?.allowOnce)return {allowed:true,reason:'Replay allowed'};if(row?.lastDay===day())return {allowed:false,reason:'Already heard today'};if(state.skipFamiliar&&row?.count>=10)return {allowed:false,reason:'Heard ten times'};return {allowed:true,reason:''};}
  function record(item){read();const key=placeKey(item),old=state.places[key];state.places[key]={name:String(item.placeName||item.name||'Place').slice(0,200),count:(old?.count||0)+1,lastDay:day(),lastAt:now().toISOString(),allowOnce:false};save();}
  function allowOnce(key){read();if(state.places[key]){state.places[key].allowOnce=true;save();}}
  function clear(){read();state.places={};save();}
  function setSkipFamiliar(value){read();state.skipFamiliar=!!value;save();}
  function snapshot(){read();return {skipFamiliar:state.skipFamiliar,places:Object.entries(state.places).map(([key,value])=>({key,...value})).sort((a,b)=>b.lastAt.localeCompare(a.lastAt))};}
  read();return {key:placeKey,check,record,allowOnce,clear,setSkipFamiliar,snapshot};
 }
 const api={createDriveHistory,placeKey,STORAGE_KEY};if(typeof module!=='undefined')module.exports=api;else globalThis.DriveHistory=api;
})();
