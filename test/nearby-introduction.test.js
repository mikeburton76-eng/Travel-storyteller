const test=require('node:test'),assert=require('node:assert/strict'),L=require('../drive-logic.js');
test('landmarks, villages and event areas all start with a named nearby introduction',()=>{
 for(const item of [
 {name:'Buxton Crescent',reason:'The curved building was designed as a spa hotel.'},
 {name:'Introducing Tideswell',kind:'arrival',reason:'You’re near Tideswell. The church is known as the Cathedral of the Peak.'},
 {name:'Pavilion Gardens',eventArea:true,reason:'There are seasonal activities in the gardens.'}
 ]){
 const text=L.narration(item);
 assert.match(text,/^We’re near /);
 assert.equal((text.match(/near /g)||[]).length,1);
 assert.doesNotMatch(text,/near Introducing/);
 assert.equal(L.nearbyIntroduction(item,text),text);
 }
});
test('saved plain text receives the introduction while Explore stays location neutral',()=>{
 const item={name:'Old Hall Hotel',reason:'The building has a long history.'};
 assert.equal(L.nearbyIntroduction(item,item.reason),'We’re near Old Hall Hotel. The building has a long history.');
 assert.equal(L.narration(item,{nearby:false}),item.reason);
});
