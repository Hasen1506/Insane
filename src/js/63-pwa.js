/* ---------- phone shell: service worker, updates, offline, Add to Home Screen (C02, C07, C08) ---------- */
// Server mode only: claude.ai and the local demo have no service worker.
const PWA={reg:null,ready:false,checking:false,reloading:false,net:typeof navigator!=='undefined'&&navigator.onLine===false?'off':'on'};
// This page's build, from the stamp tools/build.js writes after the head ("INSANE build <12 hex>").
let BUILD_ID=null;
function buildId(){
  if(BUILD_ID)return BUILD_ID;BUILD_ID='dev';
  try{for(const n of document.head.childNodes){if(n.nodeType!==8)continue;const m=/INSANE build ([0-9a-f]{12})/.exec(n.data);if(m){BUILD_ID=m[1];break}}}catch(e){}
  return BUILD_ID;
}
const swOK=()=>S.backend==='server'&&typeof navigator!=='undefined'&&'serviceWorker' in navigator;
// One registration for this build. 79-activity's push opt-in uses it too, so the script URL never flips.
async function swReg(){
  if(PWA.reg)return PWA.reg;
  const sw=navigator.serviceWorker;let reg=await sw.getRegistration('/');
  // A newer build already waiting (the bar was ignored, then reloaded): keep it, don't register ours back over it.
  if(!(reg&&(reg.waiting||reg.installing)&&reg.active))reg=await sw.register('/sw.js?b='+buildId());
  PWA.reg=reg;swWatch(reg);return reg;
}
function swWatch(reg){
  const upd=()=>{if(reg.waiting&&navigator.serviceWorker.controller&&!PWA.ready){PWA.ready=true;render()}};
  upd();reg.addEventListener('updatefound',()=>{const w=reg.installing;if(w)w.addEventListener('statechange',upd)});
}
async function swInit(){
  if(!swOK())return;
  try{
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(PWA.reloading)location.reload()});
    await swReg();await swCheck();
  }catch(e){}
}
// The worker installs (and precaches the shell) once the page is up and idle, so it never competes with sign-in.
function swLater(){if(!swOK())return;const go=()=>typeof requestIdleCallback==='function'?requestIdleCallback(()=>swInit(),{timeout:4000}):setTimeout(swInit,1500);if(document.readyState==='complete')go();else addEventListener('load',go,{once:true})}
// Is there a newer build on the server? Asks for "/" past the worker (the HTTP cache revalidates by
// ETag, so an unchanged build costs a 304). A newer one gets its own worker, which installs and waits.
async function swCheck(){
  if(!swOK()||!PWA.reg||PWA.ready||PWA.checking||PWA.net==='off')return;PWA.checking=true;
  try{
    const r=await fetch('/',{cache:'no-cache',credentials:'same-origin'});
    const id=r.ok&&(r.headers.get('x-insane-build')||(/INSANE build ([0-9a-f]{12})/.exec(await r.text())||[])[1]);
    if(id&&id!==buildId()){const reg=await navigator.serviceWorker.register('/sw.js?b='+id);if(reg!==PWA.reg){PWA.reg=reg;swWatch(reg)}}
  }catch(e){}
  PWA.checking=false;
}
function swUpdateNow(){const w=PWA.reg&&PWA.reg.waiting;if(!w){location.reload();return}PWA.reloading=true;w.postMessage({type:'skip'})}
function updateBar(){return PWA.ready?`<div class="updbar" role="status"><span>New version ready.</span><button class="btn s" data-act="app-update">Reload</button></div>`:''}

// Offline (C07): the browser's own signal, plus the live connection dropping (S.offline, 41-store-remote).
if(typeof addEventListener==='function'){
  addEventListener('offline',()=>{PWA.net='off';render()});
  addEventListener('online',()=>{PWA.net='on';if(S.mode==='offline'){location.reload();return}render();swCheck()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')swCheck()});
  setInterval(()=>swCheck(),30*MIN);
}
const isOffline=()=>PWA.net==='off';
function offlineBanner(){
  if(isOffline())return `<div class="banner net" role="status"><b>Offline.</b> You can read what’s here. Anything you post or change won’t send until you’re back online.</div>`;
  if(S.offline)return `<div class="banner net" role="status"><b>Reconnecting…</b> Changes will show when you’re back online.</div>`;
  return '';
}
// A cold start with no signal: the worker served the shell, but there is no account to load yet.
function offlineShell(){return `<div class="boot-off" style="padding-top:18px"><span class="mark">INSANE</span><h1 class="v">You’re offline</h1><p class="lede">INSANE needs a connection to load your circle. It opens by itself as soon as you’re back.</p><div class="btns"><button class="btn wide" data-act="app-retry">Try again</button></div></div>`}

// Add to Home Screen (C02): iOS Safari has no install prompt, and web push on iPhone only works from a
// Home Screen app. Shown on Home once the person is in a circle, until they dismiss it.
function iosA2HS(){
  try{
    const ua=navigator.userAgent||'';const ios=/iPhone|iPad|iPod/.test(ua)&&/Safari/.test(ua)&&!/CriOS|FxiOS|EdgiOS/.test(ua);
    const standalone=navigator.standalone===true||(matchMedia&&matchMedia('(display-mode: standalone)').matches);
    return ios&&!standalone&&S.backend==='server'&&!!(S.me&&S.me.circle)&&S.ui.tab==='today'&&localStorage.getItem('insane_a2hs')!=='hide';
  }catch(e){return false}
}
function a2hsCard(){return iosA2HS()?`<div class="banner a2hs" role="note"><b>Put INSANE on your Home Screen.</b> Tap Share <span aria-hidden="true">⬆︎</span>, then “Add to Home Screen”. That’s how an iPhone gets INSANE’s notifications. <button class="link" data-act="a2hs-hide">Not now</button></div>`:''}
