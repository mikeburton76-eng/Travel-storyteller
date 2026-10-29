'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('shared menu opens and closes with focus and expanded state restored',()=>{
 const element=()=>({events:{},attrs:{},addEventListener(k,f){this.events[k]=f},setAttribute(k,v){this.attrs[k]=v},focus(){this.focused=true}});
 const button=element(),close=element(),menu=element(),body={style:{overflow:'auto'}};
 menu.showModal=()=>{menu.open=true};menu.close=()=>{menu.open=false;menu.events.close()};
 const document={body,getElementById:id=>({'app-menu-toggle':button,'app-menu':menu,'app-menu-close':close})[id]};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../navigation.js'),'utf8'),{document});
 button.events.click();assert.equal(menu.open,true);assert.equal(button.attrs['aria-expanded'],'true');assert.equal(body.style.overflow,'hidden');
 close.events.click();assert.equal(menu.open,false);assert.equal(button.attrs['aria-expanded'],'false');assert.equal(body.style.overflow,'auto');assert.equal(button.focused,true);
 button.events.click();menu.close();assert.equal(button.attrs['aria-expanded'],'false');assert.equal(body.style.overflow,'auto');
});
test('all pages have current-page links and use same-window paths in their shared navigation',()=>{
 for(const [file,href]of [['index.html','/explore'],['explore.html','/explore'],['voice-test.html',null]]){
  const html=fs.readFileSync(path.join(__dirname,'..',file),'utf8');const menu=html.slice(html.indexOf('<nav class="app-nav"'));
  if(href)assert.ok(menu.includes('href="'+href+'" aria-current="page"'));
  for(const page of ['/explore', '/explore#categories'])assert.ok(menu.includes('href="'+page+'"'));
  assert.doesNotMatch(menu,/href="\/voice-test"/);assert.doesNotMatch(menu,/target="_blank"|window.open/);assert.match(menu,/Back to the page/);
 }
});
