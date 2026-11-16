const test=require('node:test'),assert=require('node:assert/strict'),L=require('../drive-logic');
const base=(id,name,section,reason='A visitor attraction with a distinctive local history.')=>({id,name,title:name,section,reason,background:reason,coord:{lat:53,lon:-1},source:{url:'https://example.org/'+id}});
test('one canonical museum record serves heritage and driving, retaining a family badge',()=>{
 const museum=base('museum','Town Museum','attractions');
 const variants=[{...museum,section:'family',reason:'Children can try hands-on exhibits.'},{...museum,section:'museums'},museum];
 const result=L.canonicalPlaces(variants);
 assert.equal(result.length,1);assert.equal(result[0].displayCategory,'attractions');assert.equal(result[0].familyActivity,true);
 assert.equal(result[0].reason,museum.reason);
 assert.deepEqual(L.places(variants),result);
 assert.deepEqual(L.canonicalPlaces(result),result);
});
test('walks and gardens are distinct from nearby landmarks and family activities',()=>{
 const garden=base('garden','Town Gardens','attractions','The public gardens have walking paths.');
 const tower=base('tower','Hill Tower','attractions','An ancient tower overlooks the valley.');
 const walk=base('walk','Riverside circuit','walks','A documented walking route passes the tower.');
 const farm=base('farm','Activity Farm','family','Children can meet farm animals.');
 const result=L.canonicalPlaces([garden,{...garden,section:'walks'},tower,walk,farm]);
 assert.deepEqual(result.map(x=>[x.id,x.displayCategory]),[['garden','walks'],['tower','attractions'],['walk','walks'],['farm','family']]);
 assert.equal(new Set(result.map(x=>x.id)).size,result.length);
});
test('general history and dated events retain their own identity',()=>{
 const history={...base('history','Town traditions','history'),historyOnly:true};
 const festival={...base('festival','Town Festival','events'),eventArea:true,eventTiming:{start:'2027-01-01',end:'2027-01-02'}};
 const result=L.canonicalPlaces([history,festival]);
 assert.equal(result[0].displayCategory,'attractions');assert.equal(result[1].displayCategory,'events');
 assert.equal(L.places(result).length,0);
});
