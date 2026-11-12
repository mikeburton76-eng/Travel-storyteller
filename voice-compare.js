'use strict';
const $ = id => document.getElementById(id);
const synth = window.speechSynthesis, player = $('audio');
let config, available = [], activeUtterance, controller, objectUrl, generation = 0, started = 0, began = false, googleReady = false, timer;
const readPref = () => { try {return localStorage.getItem('discover.voiceComparison.device');}catch{return null;} };
function report(message) { $('status').textContent = message; $('log').textContent = (new Date().toLocaleTimeString()+' '+message+'\n'+$('log').textContent).slice(0,10000); }
function stop(announce = true) {
  generation++; clearTimeout(timer); controller?.abort(); controller = null;
  if (activeUtterance) activeUtterance.onstart = activeUtterance.onend = activeUtterance.onerror = null;
  synth?.cancel(); activeUtterance = null;
  player.onplaying = player.onended = player.onerror = null; player.pause(); player.removeAttribute('src'); player.load();
  if(objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = null;
  $('googlePlay').disabled = !googleReady;
  if(announce) report('Stopped.');
}
function refresh() {
  if (!synth) { $('phoneInfo').textContent = 'This browser does not offer device speech. Try Safari on your iPhone.'; return; }
  const selected = $('phone').value || readPref();
  available = synth.getVoices().slice().sort((a,b) => {
    const rank = v => /^en[-_]GB$/i.test(v.lang)?0:/^en\b/i.test(v.lang)?1:2;
    return rank(a)-rank(b)||a.name.localeCompare(b.name);
  });
  $('phone').replaceChildren(...available.map((v,i)=>{
    const o = document.createElement('option'); o.value=String(i); o.textContent=`${v.name} · ${v.lang}${v.localService?' · on device':' · network voice'}`; return o;
  }));
  const saved = available.findIndex(v=>v.voiceURI === readPref());
  if(saved >= 0) $('phone').value=String(saved);
  else if(selected !== null && available[Number(selected)]) $('phone').value=selected;
  $('phonePlay').disabled = !config || !available.length;
  $('phoneInfo').textContent = available.length ? `${available.length} voices available. British English voices appear first. Only voices marked “on device” report local synthesis.` : 'No voices available yet. Wait a moment and tap Refresh voices.';
}
$('refresh').onclick = refresh;
$('stop').onclick = () => stop();
$('sample').onchange = () => { stop(false); $('words').textContent = config?.samples[$('sample').value] || ''; report('Sample changed. Choose a voice to listen.'); };
$('phone').onchange = () => stop(false);
$('google').onchange = () => stop(false);
$('phonePlay').onclick = () => {
  stop(false);
  const voice = available[Number($('phone').value)]; if(!voice || !config) return;
  try {localStorage.setItem('discover.voiceComparison.device',voice.voiceURI);}catch{}
  const id = generation, utterance = new SpeechSynthesisUtterance(config.samples[$('sample').value]);
  activeUtterance=utterance; utterance.voice=voice; utterance.lang=voice.lang; utterance.rate=1;
  const start=performance.now();
  report(`Starting device voice: ${voice.name} (${voice.lang})…`);
  utterance.onstart = () => {if(id===generation){clearTimeout(timer);report(`Device: ${voice.name}\nPlayback started after ${((performance.now()-start)/1000).toFixed(1)} seconds.`);}};
  utterance.onend = () => {if(id===generation){clearTimeout(timer);report(`Device: ${voice.name} · finished.`);}};
  utterance.onerror = e => {if(id===generation){clearTimeout(timer);report(`Device voice could not play (${e.error}). Try another listed voice.`);}};
  timer=setTimeout(()=>{if(id===generation)report('Device speech has not reported starting. Try Stop, then another voice.');},15000);
  synth.speak(utterance); // Keep directly in the tap handler for Safari.
};
$('googlePlay').onclick = async () => {
  stop(false); const id=generation; controller=new AbortController(); const request=controller;
  started=performance.now(); began=false; $('googlePlay').disabled=true;
  const voice=$('google').value;
  report(`Preparing Google ${voice}…`);
  timer=setTimeout(()=>request.abort(),50000);
  try {
    const response=await fetch('/api/voice-compare/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sample:$('sample').value,voice}),signal:request.signal});
    if(!response.ok){let data=await response.json();throw Error(data.error || 'Google request failed.');}
    const blob=await response.blob(); if(id!==generation)return;
    clearTimeout(timer);objectUrl=URL.createObjectURL(blob);player.src=objectUrl;
    const prep=((performance.now()-started)/1000).toFixed(1);
    report(`Google ${voice}\nAudio ready after ${prep} seconds.`);
    player.onplaying=()=>{if(id===generation && !began){began=true;report(`Google ${voice}\nAudio ready: ${prep} seconds. Playback started: ${((performance.now()-started)/1000).toFixed(1)} seconds after request.`);}};
    player.onended=()=>{if(id===generation)report(`Google ${voice} · finished. Use the player to replay without a new request.`);};
    player.onerror=()=>{if(id===generation)report('Google audio could not be played by this browser.');};
    try {await player.play();} catch {if(id===generation)report(`Google audio ready after ${prep} seconds. Tap play on the player above to hear it.`);}
  } catch(error) {if(id===generation)report(error.name==='AbortError'?'Google preparation timed out. Please retry when connected.':error.message);}
  finally {if(id===generation){clearTimeout(timer);$('googlePlay').disabled=!googleReady;}}
};
synth?.addEventListener('voiceschanged',refresh);
window.addEventListener('pagehide',()=>stop(false));
refresh();
fetch('/api/voice-compare/config').then(async r=>{if(!r.ok)throw Error('Could not load the test. Refresh the page.');return r.json();}).then(data=>{
  config=data;googleReady=data.configured;
  $('words').textContent=data.samples[$('sample').value];
  $('googleInfo').textContent=googleReady?'Google key configured. Choose a voice to test the connection.':'Google is not connected yet. The iPhone test is ready. Google needs its API key added securely in Render; never paste a key into this page.';
  $('googlePlay').disabled=!googleReady;refresh();
}).catch(e=>report(e.message));
