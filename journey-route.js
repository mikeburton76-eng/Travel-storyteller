'use strict';
// Geometry helpers shared by the route preview and driving test. Metres, WGS84 lon/lat.
(()=>{
 const R=6371000,rad=Math.PI/180;
 function project(coord,line){
  if(!coord||!Number.isFinite(coord.lat)||!Number.isFinite(coord.lon)||!Array.isArray(line)||line.length<2)return {metres:Infinity,along:0};
  let best={metres:Infinity,along:0},travelled=0;const scale=Math.cos(coord.lat*rad);
  for(let i=1;i<line.length;i++){
   const a=line[i-1],b=line[i];const ax=(a[0]-coord.lon)*rad*R*scale,ay=(a[1]-coord.lat)*rad*R,bx=(b[0]-coord.lon)*rad*R*scale,by=(b[1]-coord.lat)*rad*R;
   const dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy),t=length?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(length*length))):0,d=Math.hypot(ax+t*dx,ay+t*dy);
   if(d<best.metres)best={metres:d,along:travelled+t*length};travelled+=length;
  }
  return best;
 }
 function within(plan,metres){return (plan.items||[]).map(item=>({...item,route:project(item.coord,plan.coordinates)})).filter(item=>item.route.metres<=metres).sort((a,b)=>a.route.along-b.route.along);}
 function select(items,count){
  const n=Math.max(1,Math.min(20,Math.floor(Number(count)||8))),ordered=[...items].sort((a,b)=>a.route.along-b.route.along);
  if(ordered.length<=n)return ordered;
  if(n===1)return [ordered[Math.floor(ordered.length/2)]];
  const remaining=[...ordered],result=[],start=ordered[0].route.along,end=ordered.at(-1).route.along;
  for(let i=0;i<n;i++){const target=start+(end-start)*i/(n-1);let nearest=0;for(let j=1;j<remaining.length;j++)if(Math.abs(remaining[j].route.along-target)<Math.abs(remaining[nearest].route.along-target))nearest=j;result.push(remaining.splice(nearest,1)[0]);}
  return result.sort((a,b)=>a.route.along-b.route.along);
 }
 const api={project,within,select};if(typeof module!=='undefined')module.exports=api;else globalThis.JourneyRoute=api;
})();
