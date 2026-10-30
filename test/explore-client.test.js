'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
class Element {constructor(){this.children=[];this.style={};this.attrs={};this.events={};this.hidden=false;this.value='';this.textContent='';this.open=false}before(node){this.beforeNode=node}after(node){this.afterNode=node}removeAttribute(k){delete this.attrs[k]}replaceChildren(...c){this.children=c}append(...c){this.children.push(...c)}setAttribute(k,v){this.attrs[k]=v}addEventListener(k,fn){this.events[k]=fn}showModal(){this.open=true}close(){this.open=false;this.events.close?.()}}
function app(fetchImpl,search='',extras={}){const nodes={},document={hidden:false,body:new Element(),getElementById:id=>nodes[id]??=new Element(),createElement:()=>new Element(),createTextNode:text=>({textContent:text}),addEventListener(){}};const context=vm.createContext({document,navigator:{},console,Date,setInterval(){},setTimeout,clearTimeout,AbortController,URLSearchParams,location:{search},fetch:fetchImpl,...extras});vm.runInContext(fs.readFileSync(path.join(__dirname,'../explore-client.js'),'utf8'),context);return{nodes,run:source=>vm.runInContext(source,context)}}
const fixture={location:{label:'Sample Town',mode:'area'},overview:'A town by a river.',coverage:{notes:[]},sources:[],checkedAt:'2026-10-28T12:00:00Z',cacheUntil:'2026-10-28T18:00:00Z',selectionMode:'ai',items:[{id:'a',name:'A garden',title:'A garden',theme:'nature',section:'attractions',reason:'<img src=x onerror=alert(1)>',background:'Source background.',coord:{lat:1,lon:2},distanceKm:1,source:{title:'Garden source',url:'https://en.wikipedia.org/wiki/Garden'},image:null}]};
test('renders categories, candid empty sections, literal external text and accessible reading panel',()=>{const a=app();a.run('guide='+JSON.stringify(fixture)+';render()');assert.equal(a.nodes.cards.children.length,1);assert.equal(a.nodes.tabs.children.length,2);assert.equal(a.nodes.tabs.children[0].attrs['aria-pressed'],'true');assert.match(a.nodes.cards.children[0].children[1].children[2].textContent,/<img/);a.run('openItem(guide.items[0])');assert.equal(a.nodes.dialog.open,true);assert.equal(a.nodes.detailBackground.textContent,'Source background.');a.run('selected="gems";render()');assert.equal(a.nodes.tabs.children[0].attrs['aria-pressed'],'true');assert.equal(a.nodes.cards.children.length,1);});
test('latest search wins even when an older response arrives afterwards',async()=>{const pending=[];const a=app(()=>new Promise(resolve=>pending.push(resolve)));const first=a.run('explore({place:"First"})'),second=a.run('explore({place:"Second"})');pending[1]({ok:true,json:async()=>({...fixture,location:{label:'Second',mode:'area'}})});await second;pending[0]({ok:true,json:async()=>({...fixture,location:{label:'First',mode:'area'}})});await first;assert.equal(a.nodes.locationName.textContent,'Second');assert.equal(a.nodes.searchBtn.disabled,false);});
test('shows provisional cards before the completed guide and keeps categories usable',async()=>{
 let requests=0;
 const a=app(async()=>({ok:true,json:async()=>++requests===1?{...fixture,complete:false,selectionMode:'preview'}:{...fixture,complete:true,overview:'The completed guide.'}}));
 const done=a.run('explore({place:"Sample Town"})');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(a.nodes.cards.children.length,1);
 assert.match(a.nodes.status.textContent,/first suggestions/);
 a.run('selected="family";render()');assert.match(a.nodes.cards.children[0].textContent,/still being prepared/);
 await done;assert.equal(requests,2);assert.equal(a.nodes.overview.textContent,'The completed guide.');assert.equal(a.nodes.tabs.children[0].attrs['aria-pressed'],'true');
});
test('specialist trial is explicitly selected and carried with the search request',async()=>{
 let input;const a=app(async(url,options)=>{input=JSON.parse(options.body);return {ok:true,json:async()=>({...fixture,complete:true})}},'?research=1');
 a.nodes.specialists ??= new Element();a.nodes.specialists.checked=true;
 await a.run('explore({place:"Sample Town"})');assert.equal(input.specialists,true);assert.equal(input.progressive,true);
});

test('five categories fold legacy sections without duplicate cards and retain photo labels',()=>{
 const a=app();const base=fixture.items[0];
 const items=[{...base,id:'building',name:'Town Hall',theme:'architecture',section:'buildings'},{...base,id:'museum',name:'Town Museum',theme:'culture',section:'museums'},{...base,id:'garden',section:'attractions',name:'Town Gardens'},{...base,id:'garden',section:'walks',name:'Town Gardens'},{...base,id:'garden',section:'photos',name:'Town Gardens'}];
 a.run('guide='+JSON.stringify({...fixture,items})+';selected="history";render()');assert.equal(a.nodes.cards.children.length,2);
 a.run('selected="walks";render()');assert.equal(a.nodes.cards.children.length,1);assert.equal(a.nodes.cards.children[0].children[1].children[0].textContent,'Walk');
 assert.ok(a.nodes.cards.children[0].children[1].children.some(x=>x.textContent==='📷 Photo spot'));
 a.run('openItem(guide.items[1])');assert.equal(a.nodes.detailKind.textContent,'Museum or gallery');
});

test('empty categories are hidden only when complete and an empty guide has no dead-end buttons',()=>{
 const a=app();a.run('guide='+JSON.stringify({...fixture,complete:false})+';render()');assert.equal(a.nodes.tabs.children.length,6);
 a.run('guide.complete=true;selected="family";render()');assert.equal(a.nodes.tabs.children.length,2);assert.equal(a.nodes.tabs.children[0].attrs['aria-pressed'],'true');
 a.run('guide.items=[];render()');assert.equal(a.nodes.tabs.children.length,0);assert.equal(a.nodes.results.hidden,true);assert.match(a.nodes.categoryMsg.textContent,/No supported suggestions/);
});
test('visitor information appears separately from attraction categories with its source and map',()=>{
 const a=app();a.run('guide='+JSON.stringify({...fixture,visitorInformation:[{name:'Test Visitor Centre',description:'Visitor information in the town.',mapQuery:'Test town visitor centre',website:'https://example.org/visitors',source:{title:'Operator',url:'https://example.org/visitors'}}]})+';render()');assert.equal(a.nodes.visitorInformation.hidden,false);assert.equal(a.nodes.visitorInfoList.children.length,1);
 a.run('guide.visitorInformation=[];render()');assert.equal(a.nodes.visitorInformation.hidden,true);
});
test('normal app hides research controls and cannot accidentally enable extra AI reviews',async()=>{
 let input;const a=app(async(url,options)=>{input=JSON.parse(options.body);return {ok:true,json:async()=>({...fixture,complete:true})}});assert.equal(a.nodes.researchOptions.hidden,true);a.nodes.specialists??=new Element();a.nodes.specialists.checked=true;
 await a.run('explore({place:"Sample Town"})');assert.equal(input.specialists,false);
});
test('What’s on displays organiser-verified years or an explicit unconfirmed date label',()=>{
 const a=app();const event={...fixture.items[0],id:'festival',name:'Town Festival',title:'Town Festival',section:'events',theme:'culture',eventArea:true,eventTiming:{start:'2027-07-07',end:'2027-07-25',sourceUrl:'https://example.org/festival'}};
 a.run('guide='+JSON.stringify({...fixture,items:[event],complete:true})+';selected="events";render()');assert.equal(a.nodes.tabs.children.length,1);assert.ok(a.nodes.cards.children[0].children[1].children.some(c=>c.textContent.includes('2027')));
 a.run('guide.items[0].eventTiming=null;render()');assert.ok(a.nodes.cards.children[0].children[1].children.some(c=>c.textContent.includes('Dates to be confirmed')));
});
test('Listen passes the chosen card to the shared player and Categories keeps the guide intact',()=>{
 const a=app();a.run('guide='+JSON.stringify(fixture)+';globalThis.played=null;globalThis.ExploreNarration={listen:(item,location)=>globalThis.played={item,location}};render();listenToItem(guide.items[0])');
 assert.equal(a.run('played.item.id'),'a');assert.equal(a.run('played.location.label'),'Sample Town');
 a.run("$('categories')");let scrolled=false;a.nodes.categories.scrollIntoView=()=>scrolled=true;a.nodes.backToCategories.onclick();assert.equal(scrolled,true);assert.equal(a.nodes.cards.children.length,1);
});

test('Categories shortcut appears only after populated choices have scrolled away',()=>{
 let observe;class Observer{constructor(callback){observe=callback}observe(){}}
 const a=app(undefined,'',{IntersectionObserver:Observer});a.run('guide='+JSON.stringify(fixture)+';render()');
 observe([{isIntersecting:false,boundingClientRect:{top:-400}}]);assert.equal(a.nodes.backToCategories.hidden,false);
 observe([{isIntersecting:true,boundingClientRect:{top:0}}]);assert.equal(a.nodes.backToCategories.hidden,true);
 a.run('guide.items=[];render()');observe([{isIntersecting:false,boundingClientRect:{top:-400}}]);assert.equal(a.nodes.backToCategories.hidden,true);
});

test('On the Go puts location controls first and From Home puts search first',()=>{const a=app();assert.equal(a.nodes.modeHome.attrs['aria-current'],'page');assert.equal(a.nodes.searchForm.afterNode,a.nodes.locationControls);a.nodes.modeGo.onclick();assert.equal(a.nodes.modeGo.attrs['aria-current'],'page');assert.equal(a.nodes.searchForm.beforeNode,a.nodes.locationControls);assert.equal(a.nodes.listenNearby.hidden,false);a.nodes.modeHome.onclick();assert.equal(a.nodes.listenNearby.hidden,true);});


test('food navigation carries the selected place and coordinates without changing category selection',()=>{const a=app();a.run('guide='+JSON.stringify({...fixture,location:{label:'Melbourne, Derbyshire',mode:'area',lat:52.82,lon:-1.43}})+';render()');const u=new URL(a.nodes.foodTile.href,'https://test.example');assert.equal(u.pathname,'/food-open-test');assert.equal(u.searchParams.get('place'),'Melbourne, Derbyshire');assert.equal(u.searchParams.get('lat'),'52.82');assert.equal(a.nodes.tabs.children[0].attrs['aria-pressed'],'true');});

test('returning from Food restores the guide and selected mode without another AI request',()=>{
 let saved;const state={save:(key,value)=>{if(key==='explore')saved=value},load:()=>null};
 const a=app(()=>assert.fail('No request expected'),'',{DiscoverReturnState:state});a.run('guide='+JSON.stringify(fixture)+';render()');a.nodes.modeGo.onclick();a.nodes.place.value='Sample Town';a.nodes.foodTile.events.click();assert.equal(saved.guide.location.label,'Sample Town');assert.equal(saved.mode,'go');
 const b=app(()=>assert.fail('Returning must not rebuild the guide'),'',{DiscoverReturnState:{load:()=>saved}});assert.equal(b.nodes.locationName.textContent,'Sample Town');assert.equal(b.nodes.modeGo.attrs['aria-current'],'page');assert.equal(b.nodes.cards.children.length,1);
});
test('reading panel has top/bottom close controls and browser Back closes it without leaving the guide',()=>{
 const listeners={};let backs=0;const history={state:null,pushState(s){this.state=s;},back(){backs++;this.state=null;listeners.popstate?.();}};
 const window={addEventListener(k,f){listeners[k]=f;},scrollTo(){},scrollY:0};class Observer{observe(){}}
 const a=app(undefined,'',{history,window,IntersectionObserver:Observer});a.run('guide='+JSON.stringify(fixture)+';render();openItem(guide.items[0])');assert.equal(a.nodes.dialog.open,true);history.back();assert.equal(a.nodes.dialog.open,false);assert.equal(backs,1);assert.equal(a.nodes.cards.children.length,1);
 a.run('openItem(guide.items[0])');a.nodes.closeDetailBottom.onclick();assert.equal(a.nodes.dialog.open,false);assert.equal(backs,2);assert.equal(a.nodes.locationName.textContent,'Sample Town');
});
