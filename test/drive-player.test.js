'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createDrivePlayer}=require('../drive-player');
function setup(play=()=>Promise.resolve()){
 const logs=[],errors=[],timers=new Map();let next=0,progress=0,ended=0;
 const element={currentTime:0,paused:true,ended:false,volume:0,muted:true,pause(){this.paused=true;this.onpause?.();},removeAttribute(name){delete this[name];},play(){this.paused=false;return play(this);}};
 const player=createDrivePlayer({element,log:x=>logs.push(x),url:{createObjectURL:()=> 'blob:clip',revokeObjectURL(){}},schedule:f=>{timers.set(++next,f);return next;},cancel:id=>timers.delete(id)});
 return {element,player,logs,errors,timers,get progress(){return progress;},get ended(){return ended;},start(){player.play(new Blob(['wave']),{onProgress(){progress++;},onEnd(){ended++;},onError:m=>errors.push(m)});}};
}
test('a successful play request does not establish playback progress or audibility',()=>{
 const a=setup();a.start();a.element.onplaying();assert.equal(a.progress,0);
 a.element.currentTime=1;a.element.ontimeupdate();assert.equal(a.progress,1);assert.equal(a.timers.size,0);
 assert.equal(a.element.volume,1);assert.equal(a.element.muted,false);
 assert.ok(a.logs.some(s=>s.includes('audibility still depends')));
 a.element.currentTime=20;a.element.onended();assert.equal(a.ended,1);
});
test('phone autoplay rejection leaves an actionable error instead of claiming playback',async()=>{
 const a=setup(()=>Promise.reject(Object.assign(Error('Blocked'),{name:'NotAllowedError'})));a.start();await Promise.resolve();
 assert.equal(a.progress,0);assert.match(a.errors[0],/phone blocked playback/);assert.equal(a.timers.size,0);
});
test('an accepted but stalled audio request is detected',()=>{
 const a=setup();a.start();[...a.timers.values()][0]();assert.match(a.errors[0],/clock did not advance/);assert.equal(a.progress,0);
});
test('stopping cancels old player callbacks and permits a new clip on the same native element',()=>{
 const a=setup();a.start();const oldProgress=a.element.ontimeupdate;a.player.stop();a.start();a.element.currentTime=1;oldProgress();assert.equal(a.progress,0);a.element.ontimeupdate();assert.equal(a.progress,1);
});
