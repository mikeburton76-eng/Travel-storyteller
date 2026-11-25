'use strict';
const P=require('./explore-policy');
const {completeSentences}=require('./drive-logic');
const rules=[
 ['Deserted medieval villages',/\bdeserted (?:medieval|mediaeval) (?:village|settlement)\b/i],
 ['Hidden waterways',/\b(?:subterranean river|culverted (?:river|stream)|flows? (?:in a culvert|underground|beneath))\b/i],
 ['Street features',/\b(?:mounting block|market cross|mercat cross|milepost|milestone|drinking fountain|horse trough|cabmen.s shelter)\b/i],
 ['Filming locations',/\b(?:filming location|filmed (?:here|at)|used as a (?:film set|location for filming))\b/i],
 ['Former uses of buildings',/\b(?:converted (?:into|from)|housed in (?:a|the) former|originally (?:a|an|built as))\b/i],
 ['Old railways',/\b(?:former railway|rail trail|heritage railway|disused railway|railway viaduct)\b/i],
 ['Mines and quarries',/\b(?:lead|copper|coal|slate|salt|tin|iron|gold) (?:mine|quarry|colliery)\b/i],
 ['Mills',/\b(?:cotton mill|textile mill|watermill|water mill|flour mill|spinning mill|windmill)\b/i],
 ['Geology',/\b(?:limestone cave|basalt columns|volcanic plug|limestone gorge|geological formation)\b/i],
 ['Animal stories',/\b(?:seabird colony|breeding colony|breeding seabirds|wildlife sanctuary|zoological garden|safari park|puffins|gannets)\b/i],
 ['Woods and nature reserves',/\b(?:ancient woodland|temperate rainforest|nature reserve|national wildlife refuge)\b/i],
 ['Rivers and bridges',/\b(?:packhorse bridge|suspension bridge|aqueduct|stone arch bridge|tidal river)\b/i],
 ['Walking',/\b(?:long-distance footpath|walking trail|rail trail|walking route)\b/i],
 ['Famous people',/\b(?:birthplace museum|writer.s house museum|former home of|birthplace of)\b/i],
 ['Important buildings',/\b(?:listed building|national historic landmark|world heritage site|opera house)\b/i]
];
function fields(subject){
 const walking=subject==='Walking';
 const nature=['Animal stories','Woods and nature reserves','Geology','Hidden waterways','Rivers and bridges'].includes(subject);
 return {subject,section:walking?'walks':nature?'attractions':'history',theme:walking||nature?'nature':'history',displayCategory:walking?'walks':'attractions'};
}
const stored=require('./local-stories.json').map(row=>({
 ...fields(row.subject),id:row.pageId?'wiki-'+row.pageId:row.id,name:row.name,title:row.name,coord:{lat:row.lat,lon:row.lon},
 reason:row.text,background:row.text,selectionBasis:'source',
 source:row.source||{kind:'wikipedia',title:row.name,url:'https://en.wikipedia.org/?curid='+row.pageId}
}));
function fromPage(page){
 const name=page.title,coord=page.coordinates?.[0],intro=P.plain(page.extract);
 if(!name||!page.pageid||!P.coordinate(coord?.lat,coord?.lon)||page.pageprops?.disambiguation!==undefined||
  !P.allowed(name,intro)||P.sourceMarkup.test(intro)||/^(?:List of|History of|Timeline of) /i.test(name))return null;
 const sentences=completeSentences(intro),first=sentences[0];
 if(!first||first.length>450||/\b(?:is|was) an? (?:[\w-]+ ){0,3}(?:film|actor|novelist|politician|singer|footballer)\b/i.test(first))return null;
 let subject,hook;
 for(const sentence of sentences){
  if(sentence.length>430)continue;
  const era=sentence.match(/\b(Neolithic|Bronze Age|Iron Age|Roman) (?:auxiliary |military |chambered |long |round |burial )?(?:settlement|hillfort|fort|stone circle|henge|barrow|tomb|villa|amphitheatre)\b/i);
  if(era&&sentence===first){
   subject=era[1]+' archaeology';hook=sentence;break;
  }
  if(/\b(?:King|Queen)\s+[A-Z]/.test(sentence)&&/\b(?:stayed|visited|lodged|took refuge)\b/i.test(sentence)&&/\b[1-2]\d{3}\b/.test(sentence)){
   subject='Royal visits';hook=sentence;break;
  }
  const match=rules.find(([,pattern])=>pattern.test(sentence));
  if(match){
   const label=match[0];
   if(['Deserted medieval villages','Important buildings'].includes(label)&&sentence!==first)continue;
   if(label==='Important buildings'&&/\b(?:village|parish|market town|spa town|district)\b/i.test(first))continue;
   subject=label;hook=sentence;break;
  }
 }
 if(!hook)return null;
 const detail=hook===first?sentences[1]:hook;
 const reason=detail&&detail.length<=430?[first,detail].join(' '):first;
 return {...fields(subject),id:'wiki-'+page.pageid,name,title:name,reason,background:intro.slice(0,1800),coord:{lat:coord.lat,lon:coord.lon},source:{kind:'wikipedia',title:name,url:'https://en.wikipedia.org/?curid='+page.pageid},selectionBasis:'source'};
}
function mergeStories(items,stories){
 const result=items.slice();
 for(const story of stories){
  const i=result.findIndex(item=>item.id===story.id||item.source?.url===story.source.url||
   (item.name.toLowerCase()===story.name.toLowerCase()&&P.distanceKm(item.coord,story.coord)<1));
  if(i<0){result.push(story);continue;}
  const old=result[i];
  if(old.subject===story.subject&&old.reason===story.reason)continue;
  if(old.romanRoad||old.eventArea||old.historyOnly||old.source?.kind==='route-publisher')continue;
  result[i]={...old,subject:story.subject,reason:story.reason,source:story.source,
   background:[story.background,old.background].filter((v,i,a)=>v&&a.indexOf(v)===i).join(' '),
   supportingSources:[...new Map([old.source,...old.supportingSources||[]].filter(s=>s&&s.url!==story.source.url).map(s=>[s.url,s])).values()]};
 }
 return result;
}
function forGuide(items,pool){
 const radius=pool.location.mode==='nearby'?Math.min(pool.radiusKm,3):pool.radiusKm;
 const nearby=[...(pool.subjectStories||[]),...stored].filter(s=>P.distanceKm(pool.location,s.coord)<=radius)
  .map(s=>({...s,distanceKm:Number(P.distanceKm(pool.location,s.coord).toFixed(2))}));
 return mergeStories(items,nearby);
}
module.exports={stored,fromPage,forGuide,mergeStories};
