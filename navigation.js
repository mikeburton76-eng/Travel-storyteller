'use strict';
(()=>{
 const button=document.getElementById('app-menu-toggle'),menu=document.getElementById('app-menu'),close=document.getElementById('app-menu-close');
 if(!button||!menu||!close)return;
 let previousOverflow='';
 button.addEventListener('click',()=>{
  if(menu.open){menu.close();return;}
  previousOverflow=document.body.style.overflow;
  menu.showModal();document.body.style.overflow='hidden';button.setAttribute('aria-expanded','true');
 });
 close.addEventListener('click',()=>menu.close());
 menu.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');document.body.style.overflow=previousOverflow;button.focus();});
 // No separate browser window: every link stays within the existing app origin.
})();
