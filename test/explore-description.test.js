'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateSelection,fallbackSelection,sourceCategories,sourceDescription,SYSTEM,specialistPrompt}=require('../explore-service');
const cfg=require('../explore-config.json');
const source="The public gardens have riverside paths and a collection of unusual trees. Visitors can explore the garden paths and learn about the collection of plants. The gardens have a children's playground and family activities. Local displays describe the development of the gardens and the people who planted them.";
const candidate={id:'gardens',name:'Town Gardens',text:source,theme:'nature',source:{title:'Garden reference',url:'https://example.test/gardens'},coord:{lat:1,lon:2},distanceKm:1};
const reason="The gardens bring together a collection of unusual trees, a riverside setting and paths that visitors can explore. The source describes both the planting and the garden paths, offering a sense of what there is to see. A children's playground and family activities are also mentioned. Local displays explain how the gardens developed and introduce the people who planted them, adding some background to the visit.";
const choice={id:'gardens',section:'attractions',reason,evidence:'The public gardens have riverside paths and a collection of unusual trees.',familySuitable:true,confidence:.9,visitorValue:5};
test('fuller primary descriptions pass validation without relaxing source evidence',()=>{
 assert.ok(reason.length>400);assert.equal(validateSelection({choices:[choice]},{candidates:[candidate]},cfg).items.length,1);
 assert.equal(validateSelection({choices:[{...choice,evidence:'A claim that is absent from the source material.'}]},{candidates:[candidate]},cfg).items.length,0);
});
test('extra categories accept the same fuller descriptions with specific evidence',()=>{
 const answer={choices:[{...choice,extraCategories:[{section:'family',reason,evidence:"The gardens have a children's playground and family activities."}]}]};
 assert.equal(validateSelection(answer,{candidates:[candidate]},cfg).items.filter(x=>x.section==='family').length,1);
});
test('overlong or unsuitable descriptions are still rejected',()=>{
 assert.equal(validateSelection({choices:[{...choice,reason:'x'.repeat(1001)}]},{candidates:[candidate]},cfg).items.length,0);
 assert.equal(validateSelection({choices:[{...choice,reason:reason+' A murder attraction.'}]},{candidates:[candidate]},cfg).items.length,0);
});
test('provisional source descriptions include several supported sentences',()=>{
 const result=fallbackSelection({candidates:[candidate]},cfg).items[0];
 assert.ok(result.reason.length>260);assert.ok(result.reason.includes('collection of plants'));assert.ok(source.includes(result.reason));assert.ok(result.reason.split(/\s+/).length<=100);
});
test('all source categories can expand descriptions and event dates stay unconfirmed',()=>{
 const result=sourceCategories({overview:'',items:[]},{candidates:[candidate]},cfg);
 const family=result.items.find(x=>x.section==='family');assert.ok(family);assert.ok(family.reason.includes('Local displays'));
 const event=sourceDescription('The festival celebrates local music. It takes place in June 2027. Performances include jazz and folk music.','',true);
 assert.ok(event.includes('jazz'));assert.ok(!event.includes('2027'));assert.ok(!event.includes('June'));
});
test('main and specialist instructions request useful depth without padding',()=>{
 assert.match(SYSTEM,/60–90 words/);assert.match(specialistPrompt('family'),/60–90 words/);assert.match(specialistPrompt('walks'),/60–90 words/);
 assert.ok(cfg.maxOutputTokens>=8000);assert.ok(cfg.version>8);
});
