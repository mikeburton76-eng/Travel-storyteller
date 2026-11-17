'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const L=require('../drive-logic');
const {sourceDescription}=require('../explore-service');
const W=require('../explore-walks');
test('clipped source tails never reach Explore, driving, arrivals or event narration',()=>{
 const reason='The park has woodland paths and a walled garden. The West Highland Way, a linear long dis';
 assert.equal(sourceDescription(reason),'The park has woodland paths and a walled garden.');
 for(const extra of [{},{kind:'arrival'},{eventArea:true}]){
  const item={name:'Example Park',reason,...extra};
  const explore=L.narration(item,{nearby:false});
  assert.equal(explore,'The park has woodland paths and a walled garden.');
  assert.equal(L.narration(item),'We’re near Example Park. '+explore);
 }
});
test('soft word budgets preserve a whole long opening sentence rather than cutting words',()=>{
 const sentence='The route passes '+Array.from({length:105},()=> 'woodland').join(' ')+' before returning to the starting point.';
 const item={name:'Example Trail',reason:sentence};
 assert.equal(sourceDescription(sentence),sentence);
 assert.equal(L.opening(item),sentence);
});
test('decimal distances remain intact and unfinished follow-up material is ignored',()=>{
 const reason='The trail is 3.2 km long. The garden opened in 1820. A later extension was buil';
 assert.deepEqual(L.completeSentences(reason),['The trail is 3.2 km long.','The garden opened in 1820.']);
 assert.ok(!L.followUp({name:'Garden',reason},'The trail is 3.2 km long.').includes('was buil'));
});
test('walking evidence admits hills, crags, lochs and named routes worldwide, not bare outdoor names',()=>{
 for(const name of ['Example Hill','Example Craig','Example Loch','Back Walk','Local Riverside Circuit']){
  assert.equal(W.walkCandidate({name,text:'A waymarked walking route follows public footpaths through woodland.'}),true,name);
  assert.equal(W.walkCandidate({name,text:'A geological feature outside the town.'}),false,name);
 }
});
test('documented routes are favoured over generic outdoor walking mentions without removing distant walks',()=>{
 const location={lat:56,lon:-4};
 const candidates=Array.from({length:8},(_,i)=>({name:'Park '+i,text:'A park popular for walking.',coord:{lat:56+i*.001,lon:-4}}));
 candidates.push({name:'Woodland Circuit',text:'A waymarked circular walk follows woodland footpaths.',coord:{lat:56.2,lon:-4}});
 const picked=W.scatterWalks(candidates,location,6);
 assert.equal(picked.length,6);assert.ok(picked.some(x=>x.name==='Woodland Circuit'));
});
