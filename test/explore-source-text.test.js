'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {parseListings,stripWiki}=require('../explore-sources'),P=require('../explore-policy');
const {fallbackSelection,validateSelection}=require('../explore-service'),config=require('../explore-config.json');
test('empty stained-glass description cannot inherit neighbouring fields or content',()=>{
 const source=`{{see|name=Solomon's Temple|lat=53.24|long=-1.92|phone=|image=Temple.jpg|content=A Victorian tower on a hill with views across the surrounding countryside.}}
{{see|name=Stained glass barrel vault of the Cavendish Arcade|lat=53.258|long=-1.915|phone=|content=}}
{{do|name=Opera House|lat=53.25|long=-1.91|content=A theatre with concerts and touring productions throughout the year.}}`;
 const items=parseListings(source,'Buxton');assert.equal(items.length,2);assert.ok(!items.some(x=>/Stained/.test(x.name)));assert.ok(items.every(x=>!P.sourceMarkup.test(x.text)));assert.match(items[1].text,/theatre/);
});
test('balanced template cleanup and final selection reject stray listing code',()=>{
 assert.equal(stripWiki('A garden {{listing|name=X|content={{lang|en|Nested}}}} with trees.'),'A garden  with trees.');
 const c={id:'bad',name:'Stained glass',text:'920701 | directions= | phone= | wikipedia=Other place | image=Other.jpg',coord:{lat:1,lon:1},theme:'architecture'};
 const pool={location:{overview:''},candidates:[c]};assert.equal(fallbackSelection(pool,config).items.length,0);
 assert.equal(validateSelection({choices:[{id:'bad',section:'attractions',reason:'An interesting glass window for visitors to see.',evidence:c.text.slice(0,60),familySuitable:true,confidence:.9,visitorValue:4}]},pool,config).items.length,0);
});
test('distinctive bookshops enter hidden gems while ordinary retail and chain-like listings are omitted',()=>{
 const source=`{{buy|name=Local Books and Bookbinding|lat=53.25|long=-1.91|content=An unusual bookshop with second-hand books over five floors and local craft items.}}
{{buy|name=Shopping Centre|lat=53.25|long=-1.91|content=A large shopping centre with the usual national chain shops and supermarkets.}}
{{buy|name=General Bookstore|lat=53.25|long=-1.91|content=A bookshop with a wide range of general titles at standard prices.}}`;
 const parsed=parseListings(source,'Town');assert.equal(parsed.length,1);assert.equal(parsed[0].shop,true);assert.equal(P.themeOf(parsed[0].name,"An Aladdin's cave of second-hand books with local craft items."),'culture');
 const c={...parsed[0],id:'books',distanceKm:1,theme:'culture'};const r=fallbackSelection({location:{overview:''},candidates:[c]},config);assert.equal(r.items.length,1);assert.equal(r.items[0].section,'gems');assert.match(r.items[0].reason,/second-hand books/);
 assert.equal(P.shopGem('General Bookstore','Stocks local-interest titles as well as general-interest titles at bargain prices.'),false);
 assert.equal(P.shopGem('Town Museum','A museum with a collection of rare books and local crafts.'),false);
});
