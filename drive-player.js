'use strict';
// Use the same native media element for the parked sound check and journey clips.
// Browser progress is observable; sound reaching the listener is not.
(()=>{
 function createDrivePlayer({element,log=()=>{},url=URL,schedule=setTimeout,cancel=clearTimeout}){
  let active=null,objectURL=null,epoch=0;
  const unbind=()=>{for(const name of ['playing','timeupdate','ended','error','pause'])element['on'+name]=null;};
  function stop(){epoch++;if(active)cancel(active.timer);active=null;unbind();element.pause();element.removeAttribute('src');if(objectURL)url.revokeObjectURL(objectURL);objectURL=null;}
  function play(blob,{onProgress=()=>{},onEnd=()=>{},onError=()=>{},onPaused=()=>{}}={}){
   stop();const id=epoch,session=active={progress:false,timer:null};
   objectURL=url.createObjectURL(blob);element.src=objectURL;element.hidden=false;element.muted=false;element.volume=1;
   const current=()=>active===session&&id===epoch;
   function fail(message){if(!current())return;cancel(session.timer);active=null;unbind();element.pause();log('Audio player problem: '+message);onError(message);}
   function progress(){if(!current()||session.progress||!(element.currentTime>0))return;session.progress=true;cancel(session.timer);log('Audio clock advancing; audibility still depends on phone volume and output.');onProgress();}
   function watchdog(){cancel(session.timer);session.timer=schedule(()=>{if(current()&&!session.progress)fail('The audio clock did not advance. Stop safely and tap Play prepared clip.');},10000);}
   element.onplaying=()=>{if(current()){log('Native player reports playing.');progress();}};
   element.ontimeupdate=progress;
   element.onended=()=>{if(!current())return;progress();if(!session.progress){fail('The clip ended without audio progress.');return;}cancel(session.timer);active=null;unbind();log('Native player reached the end of the clip.');onEnd();};
   element.onerror=()=>fail('The phone could not play this clip (media error '+(element.error?.code||'unknown')+').');
   element.onpause=()=>{if(current()&&!element.ended){log('Native audio paused or interrupted.');onPaused();}};
   function request(){try{const result=element.play();Promise.resolve(result).catch(error=>fail(error.name==='NotAllowedError'?'The phone blocked playback. Stop safely and tap Play prepared clip.':'Playback failed: '+error.message));}catch(error){fail(error.message);}}
   session.resume=()=>{watchdog();request();};watchdog();request();
  }
  function resume(){if(active){active.resume();return true;}return false;}
  return {play,stop,resume};
 }
 if(typeof module!=='undefined')module.exports={createDrivePlayer};else globalThis.createDrivePlayer=createDrivePlayer;
})();
