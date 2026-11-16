const {test}=require('node:test'),assert=require('node:assert/strict');
const P=require('../explore-policy'),L=require('../drive-logic'),{createExploreService}=require('../explore-service');
const candidate=(id,name,text)=>({id,name,text,coord:{lat:55.95,lon:-3.19},theme:'experience',source:{title:name,url:'https://example.org/'+id}});
const examples=[
 candidate('illusions','World of Illusions','Visitors explore optical illusions and a mirror maze.'),
 candidate('creative','Chocolate Workshop','A chocolate-making experience for children aged six and over.'),
 candidate('animals','City Zoo','A zoo with animal exhibits and activities for families.'),
 candidate('active','Adventure Playground','An outdoor playground for children and their families.')
];
test('worldwide selection protects varied activities from a museum-heavy candidate list',()=>{
 for(const place of ['Edinburgh','Bangkok','Sydney']){
  const rows=[...Array.from({length:12},(_,i)=>candidate('m'+i,place+' Museum '+i,'A museum with activities for children.')),...examples.map(c=>({...c,name:place+' '+c.name}))];
  const chosen=P.familyIdeas(rows,6);
  for(const c of examples)assert.ok(chosen.some(x=>x.id===c.id),place+' '+c.id);
  assert.equal(chosen.length,6);
 }
});
test('family eligibility needs evidence and respects excluded venues and closures',()=>{
 const bad=[
 candidate('hotel','Family Hotel','A hotel owned by a family for three generations.'),
 candidate('closed','Illusions Centre','Permanently closed. Interactive exhibits for families.'),
 candidate('golf','Crazy Golf','Family-friendly activities for children.'),
 candidate('historic','Old House','A family lived here in the nineteenth century.')
 ];
 assert.equal(P.familyIdeas(bad).length,0);
});
test('source fallback serves distinct family experiences with retained age wording and shared narration',async()=>{
 const location={label:'Sample City',lat:55.95,lon:-3.19,mode:'area',overview:''};
 const pool={location,candidates:examples,warnings:[],radiusKm:10};
 const svc=createExploreService({readKey:()=>'',provider:{resolve:async()=>location,collect:async()=>pool,images:async()=>new Map()}});
 const result=await svc.explore({place:'Sample City'});
 const family=result.items.filter(x=>x.displayCategory==='family');
 assert.ok(family.some(x=>x.id==='illusions'));
 const chocolate=family.find(x=>x.id==='creative');assert.ok(chocolate);
 const text=L.narration(chocolate,{nearby:false});
 assert.match(text,/six and over/);
 assert.equal(L.narration(chocolate),'We’re near '+chocolate.name+'. '+text);
 assert.equal(new Set(result.items.map(x=>x.id)).size,result.items.length);
});
