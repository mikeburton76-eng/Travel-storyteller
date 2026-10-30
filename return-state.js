'use strict';
// A single, tab-local return point, not a location history or a guide database.
globalThis.DiscoverReturnState={
 save(key,value){try{const data=JSON.stringify({version:1,savedAt:Date.now(),value});if(data.length<=1000000)sessionStorage.setItem('discoverPlaces.return.'+key,data);}catch{}},
 load(key){try{const raw=sessionStorage.getItem('discoverPlaces.return.'+key);if(!raw||raw.length>1000000)return null;const data=JSON.parse(raw);if(data.version!==1||Date.now()-data.savedAt>86400000||Date.now()<data.savedAt)return null;return data.value;}catch{return null;}}
};
