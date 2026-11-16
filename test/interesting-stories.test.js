const test=require('node:test'),assert=require('node:assert/strict'),L=require('../drive-logic.js');
test('Explore and driving share the same interesting factual body, with only a proximity introduction added',()=>{
 const item={name:'Sample Hall',reason:'Sample Hall is a stone building beside the river. It was built in 1800. The building is listed.',
 background:'The hall originally housed a school for local craft workers. A poet lived here while writing a collection inspired by the river. The hall has three storeys.'};
 const explore=L.narration(item,{nearby:false}),drive=L.narration(item);
 assert.equal(drive,'We’re near Sample Hall. '+explore);
 assert.match(explore,/school for local craft workers/);
 assert.match(explore,/poet lived here/);
 assert.ok(explore.split(/\s+/).length<=115);
 assert.doesNotMatch(explore,/did you know/i);
 const more=L.followUp(item,explore);
 assert.doesNotMatch(more,/school for local craft workers|poet lived here/);
});
test('thin evidence stays short and qualified unusual claims retain their uncertainty',()=>{
 const thin={name:'Small Garden',reason:'A small garden beside the village.'};
 assert.equal(L.narration(thin,{nearby:false}),thin.reason);
 const item={name:'Old Inn',reason:'The inn stands beside the market.',
 background:'Local tradition holds that a royal visitor stayed here, although this is unconfirmed.'};
 const result=L.narration(item,{nearby:false});
 assert.match(result,/Local tradition holds/);
 assert.match(result,/although this is unconfirmed/);
});
