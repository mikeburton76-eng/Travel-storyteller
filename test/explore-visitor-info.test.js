'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {visitorInformation}=require('../explore-visitor-info');
const buxton={label:'Buxton',mode:'area',lat:53.259,lon:-1.914};
test('verified Buxton visitor centre survives map outage and does not match another Buxton',async()=>{
 const fetchImpl=async()=>{throw Error('Unavailable')};
 const r=await visitorInformation(buxton,{fetchImpl});assert.match(r.items[0].name,/Pump Room/);assert.match(r.items[0].source.url,/buxtoncrescentexperience/);assert.equal(r.unavailable,true);
 assert.equal((await visitorInformation({...buxton,lat:40,lon:-70},{fetchImpl})).items.length,0);
});
test('generic office lookup excludes signs, closed offices, unsafe links and remote locations',async()=>{
 const element=(id,tags={},lat=51)=>({id,type:'node',lat,lon:0,tags:{tourism:'information',information:'office',name:'Visitor Office '+id,...tags}});
 let request;
 const fetchImpl=async(url,opts)=>{request={url,opts};return {ok:true,json:async()=>({elements:[element(1,{website:'https://visitors.example.org'}),element(2,{information:'board'}),element(3,{description:'Permanently closed'}),element(4,{},60),element(5,{website:'javascript:alert(1)'},51.005)]})}};
 const r=await visitorInformation({label:'Sample Town',mode:'area',lat:51,lon:0},{fetchImpl});assert.equal(r.items.length,2);assert.equal(r.items[0].website,'https://visitors.example.org/');assert.equal(r.items[1].website,null);assert.equal(r.items[0].source.url,'https://www.openstreetmap.org/node/1');assert.equal(request.url,'https://overpass-api.de/api/interpreter');assert.match(request.opts.body,/6000/);
});
test('the guide includes independent visitor information even when there are no attractions',async()=>{
 const {createExploreService}=require('../explore-service');const office={name:'Local Visitor Centre',mapQuery:'Sample Town Visitor Centre',description:'Local visitor advice',source:{title:'Local operator',url:'https://example.org/visitors'}};
 const svc=createExploreService({readKey:()=>'',provider:{resolve:async()=>({label:'Sample Town',mode:'area',lat:51,lon:0}),collect:async location=>({location,candidates:[],warnings:[],radiusKm:6}),images:async()=>new Map(),visitorInformation:async()=>({items:[office],unavailable:false})}});
 const guide=await svc.explore({place:'Sample Town'});assert.equal(guide.items.length,0);assert.equal(guide.visitorInformation[0].name,office.name);
 const cached=await svc.explore({place:'Sample Town'});assert.equal(cached.visitorInformation[0].name,office.name);
});
