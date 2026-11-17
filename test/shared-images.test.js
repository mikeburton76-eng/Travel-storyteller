'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const L=require('../drive-logic');
const image={id:'File:Tower.jpg',url:'https://upload.wikimedia.org/tower.jpg',sourceUrl:'https://commons.wikimedia.org/wiki/File:Tower.jpg',caption:'A stone tower above the town.',creator:'Photographer',license:'CC BY 4.0'};
const item={id:'tower',name:'Tower',reason:'A stone tower overlooks the town.',coord:{lat:53,lon:-2},source:{url:'https://en.wikipedia.org/wiki/Tower'},image,theme:'architecture',section:'attractions'};
test('Explore and driving canonical records retain the same photo and credit',()=>{
 const explore=L.canonicalPlaces([item,{...item,section:'photos'}])[0];
 const drive=L.places([item,{...item,section:'photos'}])[0];
 assert.deepEqual(explore.image,image);assert.deepEqual(drive.image,explore.image);
 assert.equal(L.placeIcon(explore),L.placeIcon(drive));
});
test('ordinary tower photos stay visible; explicitly inappropriate metadata is blocked in saved guides too',()=>{
 assert.equal(L.placePhoto(item),image);
 for(const caption of ['Nude statue','Explicit sexual display','Phallic sculpture']){
  const cached={...item,displayCategory:'attractions',image:{...image,caption}};
  assert.equal(L.canonicalPlaces([cached])[0].image,null);
  assert.equal(L.places([cached])[0].image,null);
 }
});
test('food and stay entry tiles and trial notes are hidden without deleting trial code',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../explore.html'),'utf8');
 assert.doesNotMatch(html,/id="(?:foodTile|stayTile)"|Food and stays: Buxton/);
 const driving=fs.readFileSync(path.join(__dirname,'../drive-test.html'),'utf8');
 assert.doesNotMatch(driving,/Food and accommodation listings within this app still cover/);
});
