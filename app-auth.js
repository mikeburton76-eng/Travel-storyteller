'use strict';
const crypto = require('node:crypto');
const FORM_COOKIE = '__Host-discover_login';
const COOKIE = '__Host-discover_session';
const TTL = 12 * 60 * 60 * 1000;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function destination(value) {
  // Restrict redirects to a path on this app, never an external URL.
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value) || value.startsWith('/login')) return '/';
  return value;
}
function equal(a,b) {
  const digest = value => crypto.createHash('sha256').update(String(value)).digest();
  return crypto.timingSafeEqual(digest(a),digest(b));
}
function signature(value,password) {return crypto.createHmac('sha256',password).update('discover-session-v1:'+value).digest('base64url');}
function issue(password, now) {
  const value = `${now+TTL}.${crypto.randomBytes(24).toString('base64url')}`;
  return value+'.'+signature(value,password);
}
function valid(token,password,now) {
  if (!token || token.length>250) return false;
  const bits=token.split('.'); if(bits.length!==3 || !/^\d+$/.test(bits[0]))return false;
  const expiry=Number(bits[0]);
  return expiry>now && expiry<=now+TTL && equal(bits[2],signature(bits[0]+'.'+bits[1],password));
}
function cookie(req) {return String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);}
function page(next,message='',formToken='') {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Discover Places</title><style>body{font:18px system-ui,sans-serif;background:#edf3f5;color:#233640;margin:0;padding:24px}main{max-width:440px;margin:6vh auto;background:white;border-radius:20px;padding:26px}h1{font-size:1.8rem}p{line-height:1.5}label{display:block;margin:18px 0 8px;font-weight:600}input,button{font:inherit;box-sizing:border-box;width:100%;padding:14px;border-radius:10px;border:1px solid #8ba1ad}button{margin-top:24px;background:#2e6077;color:white;border:0;cursor:pointer}.error{background:#fff0df;border-radius:10px;padding:14px}small{display:block;margin-top:20px;line-height:1.5;color:#536672}</style></head><body><main><h1>Discover Places</h1><p>Sign in to continue to your app.</p>${message?`<p class="error" role="alert">${escape(message)}</p>`:''}<form method="post" action="/login"><input type="hidden" name="formToken" value="${escape(formToken)}"><input type="hidden" name="next" value="${escape(destination(next))}"><label for="username">Username</label><input id="username" name="username" value="traveller" autocomplete="username" autocapitalize="none" spellcheck="false" required><label for="password">App password</label><input id="password" name="password" type="password" autocomplete="current-password" required><button type="submit">Sign in</button></form><small>Use your Discover Places app password, not your Render, Google or ChatGPT password. If you need to check it, it is stored as APP_PASSWORD in your Render service’s Environment settings. Please do not share it in chat.</small><small>Sign-in page v3 · successful sign-in lasts up to 12 hours in this browser.</small></main></body></html>`;
}
function createAppAuth({readPassword=()=>process.env.APP_PASSWORD,now=Date.now}={}) {
  let failed=0, windowStart=now();
  return async function authenticate(req,res) {
    res.setHeader('Cache-Control','private, no-store');
    const password=readPassword();
    const send=(status,type,body,extra={})=>{res.writeHead(status,{'Content-Type':type,...extra});res.end(body);return false;};
    const html=(status,next,message)=>{
      const formToken=crypto.randomBytes(32).toString('base64url');
      return send(status,'text/html; charset=utf-8',page(next,message,formToken),{
        'Set-Cookie':`${FORM_COOKIE}=${formToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800`,
        'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'
      });
    };
    if (!password) return send(503,'text/plain; charset=utf-8','The app password is not configured on Render. Set APP_PASSWORD, then redeploy.');
    let url;
    try {url=new URL(req.url,'https://app.invalid');}catch{return send(400,'text/plain','Invalid request.');}
    if (url.pathname==='/login-complete' && req.method==='GET') {
      const next=destination(url.searchParams.get('next'));
      if(valid(cookie(req),password,now()))return send(303,'text/plain','Signed in.',{Location:next});
      return html(401,next,'Your password was accepted, but this browser did not keep the sign-in cookie. Open this page in Safari and allow cookies, then try again.');
    }
    if (url.pathname==='/login') {
      if(req.method==='GET')return html(200,url.searchParams.get('next'));
      if(req.method!=='POST')return send(405,'text/plain','Use the sign-in form.');
      if(req.headers['sec-fetch-site']==='cross-site')return html(403,'/','Please open the app directly before signing in.');
      // Privacy-restricted browsers can send the literal Origin: null.
      // The cookie-bound form token below protects these requests too.
      if(req.headers.origin && req.headers.origin !== 'null') {
        try {if(new URL(req.headers.origin).host!==req.headers.host)return html(403,'/','Please open the app directly before signing in.');}
        catch{return html(403,'/','Invalid sign-in origin.');}
      }
      if(!String(req.headers['content-type']||'').startsWith('application/x-www-form-urlencoded'))return html(415,'/','Please use the sign-in form.');
      if(now()-windowStart>=60000){failed=0;windowStart=now();}
      if(failed>=10)return html(429,'/','Too many unsuccessful attempts. Wait one minute, then try again.');
      req.setEncoding('utf8');
      let body='',tooLarge=false;
      try {for await(const chunk of req){body+=chunk.toString('utf8');if(Buffer.byteLength(body)>4096){tooLarge=true;break;}}}
      catch{return send(400,'text/plain','The sign-in request was interrupted. Please reload.');}
      if(tooLarge)return html(413,'/','The sign-in form was too large.');
      const form=new URLSearchParams(body),next=destination(form.get('next'));
      const expectedForm=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(FORM_COOKIE+'='))?.slice(FORM_COOKIE.length+1);
      const suppliedForm=form.get('formToken');
      if(!expectedForm || !suppliedForm || !/^[A-Za-z0-9_-]{43}$/.test(expectedForm) || !equal(expectedForm,suppliedForm)) {
        return html(403,next,'This sign-in form expired or its cookie was blocked. Please try the refreshed form below. If this repeats, open the page in Safari with cookies allowed.');
      }
      // Username is not secret; allow keyboard-added spaces and capitals. Password stays exact.
      if(form.get('username')?.trim().toLowerCase()!=='traveller' || !equal(form.get('password')||'',password)) {
        failed++;return html(401,next,'Sign-in was not accepted. The username is traveller. Check the app password stored as APP_PASSWORD in Render, then try again.');
      }
      const token=issue(password,now());
      return send(303,'text/plain','Signed in. Opening your page…',{'Location':'/login-complete?next='+encodeURIComponent(next),'Set-Cookie':`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL/1000}`});
    }
    if(valid(cookie(req),password,now()))return true;
    // Preserve already-working browser/API Basic sessions, but never trigger the native dialog again.
    const expected='Basic '+Buffer.from('traveller:'+password).toString('base64');
    if(req.headers.authorization && equal(req.headers.authorization,expected))return true;
    if(req.method==='GET' && !url.pathname.startsWith('/api/') && !/\.(js|css|json|png|webp|ico)$/.test(url.pathname)) {
      return send(303,'text/plain','Please sign in.',{Location:'/login?next='+encodeURIComponent(destination(req.url))});
    }
    return send(401,'application/json',JSON.stringify({error:'Your session needs a sign-in. Open /login in this browser, then return to the app.',login:'/login'}));
  };
}
module.exports={createAppAuth,issue,valid,destination};
