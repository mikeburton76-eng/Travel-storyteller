'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
class Element {constructor(){this.children=[];this.style={};this.attrs={};this.events={};this.hidden=false;this.value='';this.textContent='';this.open=false}before(node){this.beforeNode=node}after(node){this.afterNode=node}removeAttribute(k){delete this.attrs[k]}replaceChildren(...c){this.children=c}append(...c){this.children.push(...c)}setAttribute(k,v){this.attrs[k]=v}addEventListener(k,fn){this.events[k]=fn}showModal(){this.open=true}close(){this.open=false;this.events.close?.()}}
function app(fetchImpl,search='',extras={}){const nodes={},document={hidden:false,body:new Element(),getElementById:id=>nodes[id]??=new Element(),createElement:()=>new Element(),createTextNode:text=>({textContent:text}),addEventListener(){}};const context=vm.createContext({document,navigator:{},console,Date,setInterval(){},setTimeout,clearTimeout,AbortController,URLSearchParams,location:{search},fetch:fetchImpl,DriveLogic:require("../drive-logic"),...extras});vm.runInContext(fs.readFileSync(path.join(__dirname,'../explore-client.js'),'utf8'),context);return{nodes,run:source=>vm.runInContext(source,context)}}

test('renders distinct tiles and one museum card with shared wording',()=>{
 const a=app();
 const item={id:'m',name:'Town Museum',title:'Town Museum',section:'museums',reason:'The museum was originally a school.',background:'The museum was originally a school.',coord:{lat:53,lon:-1},source:{title:'Museum',url:'https://example.org/m'}};
 const garden={...item,id:'g',name:'Town Gardens',title:'Town Gardens',section:'walks',source:{title:'Garden',url:'https://example.org/g'},reason:'A public park with walking paths.',background:'A public park with walking paths.'};
 const guide={location:{label:'Town',lat:53,lon:-1,mode:'area'},coverage:{notes:[]},sources:[],checkedAt:'2026-11-16',cacheUntil:'2026-12-16',items:[item,{...item,section:'family'},garden,{...garden,section:'attractions'}],complete:true};
 a.run('guide='+JSON.stringify(guide)+';render()');
 assert.equal(a.run('guide.items.length'),2);
 assert.equal(a.nodes.tabs.children.length,2);
 assert.equal(a.run('sections.attractions[1]'),'Sights & heritage');
 assert.equal(a.nodes.cards.children.length,1);
 const read=a.nodes.cards.children[0].children[1].children[2].textContent;
 a.run('openItem(guide.items[0])');
 assert.equal(a.nodes.detailReason.textContent,read);
 a.run('selected="walks";render()');
 assert.equal(a.nodes.cards.children.length,1);
 assert.equal(a.run('itemsForCategory(guide.items,"walks")[0].id'),'g');
});

test('Buxton From Home pilot filters real guide cards and stays local',()=>{
 const a=app(),location={label:'Buxton',lat:53.258,lon:-1.915,mode:'area'};
 const places=[
  ['Old Hall Hotel','buildings'],['Buxton Crescent','buildings'],['Buxton Opera House','attractions'],
  ['Poole’s Cavern','attractions'],['Buxton Pavilion Gardens','walks'],
  ['Corbar Cross from Buxton Station','walks']
 ];
 const items=places.map(([name,section],i)=>({id:String(i),name,title:name,section,coord:location,
  source:{title:name,url:'https://example.org/'+i,kind:i===5?'route-publisher':'operator'}}));
 const guide={location,items,coverage:{notes:[]},sources:[],complete:true};
 a.run('guide='+JSON.stringify(guide)+';render()');
 assert.equal(a.nodes.tabs.children.length,6);
 const heritage=a.nodes.segmentFilters.children.find(b=>b.textContent==='Historic buildings');
 heritage.onclick();
 assert.equal(a.nodes.cards.children.length,1);
 assert.equal(a.nodes.cards.children[0].children[1].children[1].children[0].textContent,'Old Hall Hotel');
 for(const [index,count] of [[1,2],[2,1],[3,1],[4,1],[5,0]]){
  a.nodes.tabs.children[index].onclick();
  assert.equal(a.nodes.cards.children.filter(c=>c.className==='card').length,count);
 }
 a.nodes.modeGo.onclick();assert.equal(a.run('sections===standardSections'),true);
 a.nodes.modeHome.onclick();assert.equal(a.nodes.tabs.children.length,6);
 for(const change of ['guide.location.label="Stirling"','guide.location.label="Buxton Opera House"','guide.location.label="Buxton";guide.location.lat=52.76']){
  a.run(change+';render()');assert.equal(a.run('sections===standardSections'),true);
 }
});
