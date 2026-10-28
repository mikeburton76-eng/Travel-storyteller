'use strict';
// Source retrieval only: deliberately makes no paid AI requests.
const {createSourceProvider}=require('../explore-sources');const config=require('../explore-config.json');
const fs=require('node:fs/promises');
const cities=process.argv.slice(2);if(!cities.length)cities.push('Sydney','Melbourne','Los Angeles','San Francisco','Buxton','Tideswell');
const provider=createSourceProvider();let index=0;
async function worker(){while(index<cities.length){const place=cities[index++],started=Date.now();try{
 const location=await provider.resolve({place});const result=await provider.collect(location,config);const images=await provider.images(result.candidates);
 await fs.mkdir('/tmp/travel-selection-audit',{recursive:true});await fs.writeFile('/tmp/travel-selection-audit/'+place.replace(/[^a-z0-9]/gi,'_')+'.json',JSON.stringify({...result,images:[...images]},null,2));
 console.log(JSON.stringify({place:location.label,seconds:Math.round((Date.now()-started)/1000),candidates:result.candidates.length,themes:Object.fromEntries(['nature','culture','experience','architecture','history'].map(t=>[t,result.candidates.filter(c=>c.theme===t).map(c=>c.name)])),licensedImages:images.size,warnings:result.warnings}));
 }catch(error){console.log(JSON.stringify({place,error:error.message}));process.exitCode=1;}}}
Promise.all([worker(),worker()]);
