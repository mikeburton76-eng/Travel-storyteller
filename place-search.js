'use strict';
globalThis.DiscoverPlaceSearch={attach({form,input,list,message,clearScope,onChoose,fetchImpl=fetch}){
 let timer,controller,epoch=0,results=[],lastQuery='',scope='',busy=null;
 function reset(){clearTimeout(timer);controller?.abort();epoch++;results=[];lastQuery='';list.replaceChildren();list.hidden=true;}
 function choose(place){reset();if(place.broad){scope=place.title;input.value='';input.placeholder='Town, neighbourhood or landmark in '+scope;clearScope.hidden=false;message.textContent='Choose a town, neighbourhood or landmark in '+scope+'.';input.focus();return;}input.value=place.title;message.textContent=place.description;onChoose(place);}
 async function lookup(submit=false){
  clearTimeout(timer);const typed=input.value.trim();if(typed.length<3){reset();message.textContent='Type at least three letters to find a place.';return;}
  const q=scope?typed+', '+scope:typed;if(q.length>100){message.textContent='Please shorten the place name.';return;}
  if(lastQuery===q&&results.length){if(submit&&results.length===1)choose(results[0]);else{list.hidden=false;message.textContent='Choose the place you mean below.';}return;}
  controller?.abort();const id=++epoch;controller=new AbortController();message.textContent='Finding place choices…';
  const task=(async()=>{try{const r=await fetchImpl('/api/place-matches?q='+encodeURIComponent(q),{signal:controller.signal});const data=await r.json();if(id!==epoch)return;if(!r.ok)throw Error(data.error||'Place choices could not be loaded.');results=data.choices||[];lastQuery=q;list.replaceChildren();
   for(const place of results){const b=document.createElement('button');b.type='button';b.className='place-choice';const title=document.createElement('strong');title.textContent=place.title;const detail=document.createElement('small');detail.textContent=place.description;b.append(title,detail);b.onclick=()=>choose(place);list.append(b);}list.hidden=!results.length;
   message.textContent=results.length?'Choose the place you mean. Region and country details help distinguish similar names.':'No clear place match found. Add a region or country, or try a nearby town.';if(submit&&results.length===1)choose(results[0]);
  }catch(error){if(id===epoch&&error.name!=='AbortError'){list.hidden=true;message.textContent=error.message||'Place choices are unavailable. Please try again.';}}})();busy=task;await task;
 }
 input.addEventListener('input',()=>{reset();message.textContent='';timer=setTimeout(()=>lookup(),700);});
 input.addEventListener('keydown',event=>{if(event.key==='Escape'){reset();message.textContent='';}else if(event.key==='ArrowDown'&&!list.hidden){event.preventDefault();list.querySelector('button')?.focus();}});
 form.addEventListener('submit',event=>{event.preventDefault();lookup(true);});
 clearScope.onclick=()=>{reset();scope='';input.value='';input.placeholder='Town, neighbourhood or landmark';clearScope.hidden=true;message.textContent='Search anywhere; add a region or country if you wish.';input.focus();};
 return {reset};
}};
