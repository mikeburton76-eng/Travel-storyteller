const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createAppAuth,issue,valid,destination}=require('../app-auth');
async function fixture(t,options={}) {
 const auth=createAppAuth({readPassword:()=> 'test-£-password',...options});
 const server=http.createServer(async(req,res)=>{if(await auth(req,res)){res.writeHead(200);res.end('protected app');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port;
 return async (path,options={})=>{
   const {skipFormToken,...request}=options;
   if(path==='/login' && request.method==='POST' && !skipFormToken) {
     const login=await fetch(base+'/login');const text=await login.text();
     const token=text.match(/name="formToken" value="([^"]+)"/)[1];
     request.body=new URLSearchParams(request.body);request.body.set('formToken',token);
     request.headers={...request.headers,cookie:login.headers.get('set-cookie').split(';')[0]};
   }
   return fetch(base+path,{redirect:'manual',...request});
 };
}
const form=(password='test-£-password',next='/voice-compare')=>({method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:' Traveller ',password,next})});
test('unauthenticated page redirects to real form, never native popup',async t=>{
 const get=await fixture(t),r=await get('/voice-compare');assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/login?next=%2Fvoice-compare');assert.equal(r.headers.has('www-authenticate'),false);
 const login=await get(r.headers.get('location'));assert.equal(login.status,200);assert.match(await login.text(),/Sign-in page v3/);
});
test('wrong password gives visible error without prompt and preserves target',async t=>{
 const get=await fixture(t),r=await get('/login',form('wrong'));assert.equal(r.status,401);assert.equal(r.headers.has('www-authenticate'),false);assert.ok(!r.headers.get('set-cookie').startsWith('__Host-discover_session='));const html=await r.text();assert.match(html,/Sign-in was not accepted/);assert.match(html,/value="\/voice-compare"/);
});
test('valid Unicode password issues secure cookie, verifies it and opens page plus APIs',async t=>{
 const get=await fixture(t),r=await get('/login',form());assert.equal(r.status,303);
 const cookie=r.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(cookie.includes(flag));
 const headers={cookie:cookie.split(';')[0]};const verified=await get(r.headers.get('location'),{headers});assert.equal(verified.status,303);assert.equal(verified.headers.get('location'),'/voice-compare');
 for(const path of ['/voice-compare','/api/voice-compare/config','/voice-compare.js'])assert.equal((await get(path,{headers})).status,200);
 const noCookie=await get(r.headers.get('location'));assert.match(await noCookie.text(),/password was accepted/);
});
test('expired/tampered cookies rejected and password changes invalidate sessions',()=>{
 const token=issue('a',1000);assert.ok(valid(token,'a',1001));assert.equal(valid(token,'b',1001),false);assert.equal(valid(token+'x','a',1001),false);assert.equal(valid(token,'a',1000+12*3600000),false);assert.equal(valid('bad','a',1000),false);
});
test('legacy Basic login retained but invalid Basic does not cause popup loop',async t=>{
 const get=await fixture(t);assert.equal((await get('/voice-compare',{headers:{authorization:'Basic '+Buffer.from('traveller:test-£-password').toString('base64')}})).status,200);
 const invalid=await get('/voice-compare',{headers:{authorization:'Basic invalid'}});assert.equal(invalid.status,303);assert.equal(invalid.headers.has('www-authenticate'),false);
});
test('API remains protected; missing configuration fails closed',async t=>{
 const get=await fixture(t);assert.equal((await get('/api/voice-compare/config')).status,401);
 const missing=await fixture(t,{readPassword:()=>''});assert.equal((await missing('/voice-compare')).status,503);
});
test('external redirects and cross-origin login blocked',async t=>{
 for(const url of ['//evil.example','https://evil.example','/\\evil.example','/login','/bad\npath'])assert.equal(destination(url),'/');
 const get=await fixture(t),req=form();req.headers.origin='https://evil.example';assert.equal((await get('/login',req)).status,403);
 const r=await get('/login',form('test-£-password','//evil.example'));assert.equal(r.headers.get('location'),'/login-complete?next=%2F');
});
test('failed attempts throttled and recover after one minute',async t=>{
 let now=0;const get=await fixture(t,{now:()=>now});for(let i=0;i<10;i++)assert.equal((await get('/login',form('wrong'))).status,401);
 assert.equal((await get('/login',form())).status,429);now=61000;assert.equal((await get('/login',form())).status,303);
});
test('actual app server wrapper admits authenticated test page and protects voice API',async t=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'..');let server;
 const customRequire=name=>name==='http'?{createServer:fn=>{server=http.createServer(fn);const listen=server.listen.bind(server);server.listen=()=>listen(0,'127.0.0.1');return server;}}:name==='./speech-service'?{createSpeechService:()=>({config:{}})}:name==='./speech-settings.json'?{}:name==='./app-auth'?{createAppAuth:()=>createAppAuth({readPassword:()=> 'integration-test'})}:name.startsWith('./')?require(path.join(root,name)):require(name);
 vm.runInNewContext(fs.readFileSync(path.join(root,'server.js'),'utf8'),{require:customRequire,process:{env:{APP_PASSWORD:'integration-test'},exit(){}},__dirname:root,fetch,console,Buffer,URL,AbortController});
 if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const base='http://127.0.0.1:'+server.address().port;
 const landing=await fetch(base+'/login');const landingText=await landing.text();
 const request=form('integration-test');request.body.set('formToken',landingText.match(/name="formToken" value="([^"]+)"/)[1]);request.headers.cookie=landing.headers.get('set-cookie').split(';')[0];
 const login=await fetch(base+'/login',{...request,redirect:'manual'});assert.equal(login.status,303);
 const headers={cookie:login.headers.get('set-cookie').split(';')[0]};
 const page=await fetch(base+'/voice-compare',{headers});assert.match(await page.text(),/Find a voice you enjoy/);
 const config=await fetch(base+'/api/voice-compare/config',{headers});assert.equal(config.status,200);assert.ok((await config.json()).samples.crescent);
 const blocked=await fetch(base+'/api/voice-compare/google',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(blocked.status,401);
});

test('privacy browser Origin null accepted only with cookie-bound form token',async t=>{
 const get=await fixture(t),request=form();request.headers.origin='null';
 assert.equal((await get('/login',request)).status,303);
 const missing=await get('/login',{...form(),headers:{...form().headers,origin:'null'},skipFormToken:true});
 assert.equal(missing.status,403);assert.match(await missing.text(),/form expired or its cookie was blocked/);
});
test('normal same-origin and absent Origin work with form token; malformed Origin stays blocked',async t=>{
 const get=await fixture(t);assert.equal((await get('/login',form())).status,303);
 const request=form();request.headers.origin='not-a-url';assert.equal((await get('/login',request)).status,403);
});
