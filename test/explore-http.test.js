'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),path=require('node:path');
test('Explore routes retain authentication and reject invalid or cross-site requests before retrieval',async t=>{
 const port=32000+Math.floor(Math.random()*10000),root=path.resolve(__dirname,'..');
 const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,APP_PASSWORD:'explore-fixture',ANTHROPIC_API_KEY:'',PORT:String(port)},stdio:['ignore','pipe','pipe']});
 t.after(()=>child.kill());
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),5000);child.once('error',reject);child.once('exit',code=>reject(Error('Server exited '+code)));child.stdout.on('data',chunk=>{if(String(chunk).includes('is running')){clearTimeout(timer);resolve()}})});
 const base='http://127.0.0.1:'+port,auth='Basic '+Buffer.from('traveller:explore-fixture').toString('base64');
 assert.equal((await fetch(base+'/explore')).status,401);
 const page=await fetch(base+'/explore',{headers:{authorization:auth}});assert.equal(page.status,200);assert.match(await page.text(),/Explore somewhere/);
 const script=await fetch(base+'/explore-client.js',{headers:{authorization:auth}});assert.equal(script.status,200);assert.match(await script.text(),/refreshIfDue/);
 const post=(body,extra={})=>fetch(base+'/api/explore',{method:'POST',headers:{authorization:auth,'content-type':'application/json',...extra},body:JSON.stringify(body)});
 assert.equal((await post({place:'Sydney'},{origin:'https://unrelated.test'})).status,403);
 assert.equal((await post({place:'Sydney'},{'content-type':'text/plain'})).status,415);
 assert.equal((await post({lat:123,lon:0})).status,400);
 assert.equal((await post({place:''})).status,400);
});
