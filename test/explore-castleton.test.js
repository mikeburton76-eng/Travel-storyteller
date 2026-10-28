'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createSourceProvider,tourismHighlights}=require('../explore-sources');
const {fallbackSelection,validateSelection}=require('../explore-service');
const config=require('../explore-config'),P=require('../explore-policy');
// Small synthetic source responses reproduce the real failure mechanisms without
// saving full downloaded articles or making paid/live requests in the test suite.
const wikiText='===Tourism===\nThe village is a walking centre, with paths to [[Mam Tor]] for views over the valley. Visitors explore show caves including [[Blue John Cavern]], [[Peak Cavern]], [[Speedwell Cavern]] and [[Treak Cliff Cavern]].\n===History===\nThis section is separate.';
const records={
 'Castleton, Derbyshire':{title:'Castleton, Derbyshire',description:'Village and civil parish in England',extract:'Castleton is a village in the Hope Valley in Derbyshire.',coordinates:[{lat:53.344,lon:-1.775}],pageprops:{wikibase_item:'Q100'}},
 'Mam Tor':{title:'Mam Tor',description:'Hill near Castleton, Derbyshire',extract:'Mam Tor is a hill near Castleton. Walking routes lead towards the summit, with views across the surrounding valley.',coordinates:[{lat:53.34914,lon:-1.81069}],pageprops:{wikibase_item:'Q101'}},
 'Blue John Cavern':{title:'Blue John Cavern',description:'Show cave in Derbyshire, England',extract:'Blue John Cavern is one of four show caves around Castleton. The cave is associated with the local Blue John mineral.',coordinates:[{lat:53.3456,lon:-1.8035}],pageprops:{wikibase_item:'Q102'}},
};
function fixtureFetch(){const seen=[];return {seen,fetchImpl:async input=>{const u=new URL(input);seen.push(u.toString());let data={query:{pages:{}}};
 if(u.hostname==='en.wikivoyage.org')data=u.searchParams.get('page')==='Castleton'?{parse:{title:'Castleton',wikitext:{'*':'A small place known for a hill and show caves.\n{{see|name=Mam Tor|lat=53.34914|long=-1.81069|wikipedia=Mam Tor|content=A hill reached by walking routes, with views of the valley.}}\n{{do|name=Blue John Cavern|lat=53.3456|long=-1.8035|wikipedia=Blue John Cavern|content=Explore a show cave associated with the local mineral.}}\n{{geo|53.3431|-1.7752}}'}}}:{error:{code:'missingtitle'}};
 else if(u.searchParams.get('action')==='parse')data={parse:{title:'Castleton, Derbyshire',wikitext:{'*':wikiText}}};
 else if(u.searchParams.get('generator')==='geosearch')data={query:{pages:{1:records['Mam Tor'],2:records['Blue John Cavern']}}};
 else if(u.searchParams.get('titles')){const names=u.searchParams.get('titles').split('|');data={query:{pages:Object.fromEntries(names.filter(n=>records[n]).map((n,i)=>[i+1,records[n]]))}};}
 else if(u.hostname==='www.wikidata.org')data={entities:{}};
 return {ok:true,json:async()=>data};}}}
function choice(c,extra={}){return {id:c.id,section:'attractions',reason:'Discover this locally listed sight and the features described in its source.',evidence:c.text.slice(0,70),familySuitable:true,confidence:.95,visitorValue:5,...extra}}
test('Castleton resolves its short travel-guide title and retains Mam Tor and Blue John as highlights',async()=>{
 const fixture=fixtureFetch(),provider=createSourceProvider(fixture),location=await provider.resolve({place:'Castleton, Derbyshire'}),pool=await provider.collect(location,config);
 assert.ok(fixture.seen.some(s=>s.includes('wikivoyage')&&new URL(s).searchParams.get('page')==='Castleton'));
 assert.ok(!pool.warnings.some(w=>w.includes('travel guide was not available')));
 for(const name of ['Mam Tor','Blue John Cavern']){const c=pool.candidates.find(c=>c.name===name);assert.ok(c,name);assert.equal(c.mustSee,true);assert.equal(c.theme,'nature');}
 const names=fallbackSelection(pool,config).items.map(c=>c.name);assert.ok(names.includes('Mam Tor'));assert.ok(names.includes('Blue John Cavern'));
});
test('local tourism headings seed missing sights and avoid unrelated sections',()=>{
 const highlights=tourismHighlights(wikiText+'\n==References==\n[[Unrelated Museum]]','Castleton, Derbyshire');
 assert.ok(highlights.some(x=>x.title==='Mam Tor'));assert.ok(highlights.some(x=>x.title==='Blue John Cavern'));assert.ok(!highlights.some(x=>x.title==='Unrelated Museum'));
 assert.ok(P.visitor.test('Mam Tor Hill near Castleton'));assert.equal(P.themeOf('Blue John Cavern','A show cave'),'nature');
});
test('walk and photo lenses require evidence; family suitability is not assumed',()=>{
 const c={id:'mam',name:'Mam Tor',text:records['Mam Tor'].extract,theme:'nature',mustSee:true,coord:{lat:53.34914,lon:-1.81069},distanceKm:2.4,source:{title:'Mam Tor',url:'https://en.wikipedia.org/wiki/Mam_Tor'}};
 const answer={choices:[choice(c,{extraCategories:[{section:'walks',reason:'Explore the walking routes described for this hill.',evidence:'Walking routes lead towards the summit'},{section:'photos',reason:'Look for the views across the surrounding valley.',evidence:'views across the surrounding valley'},{section:'family',reason:'This is definitely suitable for every family.',evidence:'Mam Tor is a hill near Castleton.'}]})]};
 const result=validateSelection(answer,{location:{overview:''},candidates:[c]},config);assert.deepEqual(result.items.map(x=>x.section),['attractions','walks','photos']);
});
test('known local highlights are not lost under the general architecture diversity ceiling',()=>{
 const candidates=Array.from({length:4},(_,i)=>({id:'b'+i,name:'Landmark '+i,text:'A well-known building designed by an architect and described in the local tourism guide.',theme:'architecture',mustSee:true,source:{title:'Guide'},coord:{lat:1,lon:2},distanceKm:1}));
 const result=validateSelection({choices:candidates.map(c=>choice(c))},{location:{overview:''},candidates},config);assert.equal(result.items.length,4);
});
