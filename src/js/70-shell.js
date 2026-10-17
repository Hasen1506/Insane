/* ---------- rendering ---------- */
let rq=0,stick=false,lastV='',lastL='';
function render(scrollChat){if(scrollChat)stick=true;if(rq)return;rq=requestAnimationFrame(()=>{rq=0;draw()})}
function draw(){
  const a=document.activeElement,fid=a&&a.id,ss=a&&a.selectionStart,se=a&&a.selectionEnd;
  const chat=$('.chat'),nearBottom=chat?(innerHeight+scrollY>=document.body.scrollHeight-120):true;
  // Countdowns are filled by tick(), so an unchanged screen keeps its DOM and a tap mid-update isn't lost.
  const strip=h=>h.replace(/(data-until="\d+"[^>]*>)[^<]*/g,'$1');
  const hv=strip(helpMarks(view())),hl=strip(layer());
  if(hv!==lastV){$('#app').innerHTML=hv;lastV=hv}
  mountMaps();document.title=(()=>{const n=S.me&&S.me.cell&&!calmNow()?activity().filter(a=>a.fresh).length:0;return (n?'('+n+') ':'')+'INSANE'})();
  if(hl!==lastL){$('#layer').innerHTML=hl;lastL=hl;mountMaps()}
  if(fid){const el=document.getElementById(fid);if(el&&el!==document.activeElement){el.focus({preventScroll:true});try{if(ss!=null)el.setSelectionRange(ss,se)}catch(e){}}}
  if(stick&&nearBottom&&$('.chat'))scrollTo(0,document.body.scrollHeight);stick=false;
  tick();
  // C06: a new kind of screen (sign-in -> onboarding -> the app) starts at the top, not where the last one was scrolled.
  const k=viewKind();if(k!==lastK){if(lastK)scrollTo(0,0);lastK=k}
  a11yAfter();
  routeSync();
}
let lastK='';
function viewKind(){return S.mode==='offline'?'offline':S.mode==='signin'?'signin':(S.mode==='boot'||S.me===undefined)?'boot':S.me===null?'onboarding':!S.me.cell?'relocate':'app'}
function view(){
  if(S.mode==='offline')return offlineShell();
  if(S.mode==='signin')return welcomeGate()||signin()+updateBar();
  if(S.mode==='boot'||S.me===undefined)return `<div class="boot"><span class="mark">INSANE</span><span class="pulse">Signing you in…</span></div>`;
  if(S.me===null)return welcomeGate()||onboarding();
  if(!S.me.cell)return relocate();
  const t=S.ui.tab;
  return header()+softAskHtml()+`<div id="v">${t==='today'?vToday():t==='circle'?vCircle():t==='city'?vCity():t==='ledger'?vLedger():vYou()}</div>`+nav()+updateBar();
}
function relocate(){return `<div style="padding-top:18px"><span class="mark">INSANE</span><h1 class="v">Set your place again</h1><p class="lede">INSANE now works anywhere on Earth, down to the street. Pick your spot, how exact to be, and how far you’d go for a drop.</p>${picker('home')}<div class="btns"><button class="btn wide" data-act="loc-save" ${lpState('home').lat==null?'disabled':''}>Save my place</button></div></div>`}
// signin() and siCall() live in 68-welcome.js (WS-B).

function header(){
  const me=S.me,c=S.circle,n=activity().filter(a=>a.fresh).length;
  const where=esc(c?c.name:'No circle yet'); // C74: the circle in the header; place and square are on You
  return `<header class="top"><span class="mark">INSANE</span><button class="bell" data-act="sheet" data-v="activity" aria-label="What’s new${n?': '+n:''}">${ICON.bell}${n&&!calmNow()?`<span class="cnt">${n>9?'9+':n}</span>`:''}</button><span class="where"><span class="live ${S.mode==='demo'?'demo':''}" aria-hidden="true"></span>${where}</span><button class="me-btn ${S.ui.tab==='you'?'on':''}" data-act="tab" data-v="you" aria-label="You: profile, journeys, settings">${esc(initials(me.name))}</button></header>`+
   (S.mode==='demo'?`<div class="banner"><b>Demo on this device.</b> Nothing leaves this browser. Open the shared link signed in to play with other people.</div>`:'')+
   offlineBanner()+a2hsCard()+
   (S.ui.readonly?`<div class="banner"><b>Look-only access.</b> To post, check in or join a circle, ask the owner to invite you by email as an Editor.</div>`:'');
}
const ICON={
 today:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
 ledger:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
 circle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="4" r="1.6" fill="currentColor"/><circle cx="19" cy="15" r="1.6" fill="currentColor"/><circle cx="5" cy="15" r="1.6" fill="currentColor"/></svg>',
 city:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
 gps:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
 bell:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>',
 you:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>'};
function nav(){
  const b=badges();
  return `<nav class="tabs" aria-label="Sections"><div class="in">${[['today','Home'],['circle','Circle'],['plus',''],['city','City'],['ledger','Ledger']].map(([k,n])=>k==='plus'?`<button class="plus" data-act="make" aria-label="Make something"><span>+</span></button>`:`<button data-act="tab" data-v="${k}" class="${S.ui.tab===k?'on':''}" aria-current="${S.ui.tab===k?'page':'false'}">${ICON[k]}${n}${b[k]?'<span class="dot" aria-label="new"></span>':''}</button>`).join('')}</div></nav>`;
}
function unreadThreads(){
  const seen=S.priv.seen||{};const out=[];
  for(const t of S.threads)if(t.last&&t.last.by!==S.uid&&t.last.at>(seen['t:'+t.id]||0)&&!t.muted)out.push({type:'thread',id:t.id,title:t.title,last:t.last});
  for(const r of S.rooms)if(r.last&&r.last.by!==S.uid&&r.last.at>(seen['r:'+r.id]||0)&&r.closesAt>now())out.push({type:'room',id:r.id,title:roomTitle(r),last:r.last});
  return out;
}
function badges(){if(calmNow())return {};const seen=S.priv.seen||{};const midNew=S.midnight.some(m=>m.releaseAt<=now()&&m.releaseAt>(seen.midnight||0));
  const u=S.uid;const led=S.favors.some(f=>(f.status==='done'&&f.asker===u)||(f.status==='claimed'&&f.doer===u))||pots().some(p=>!p.closed&&(potState(p,u)==='to pay'||(p.by===u&&Object.values(p.paid||{}).includes('wait'))));
  return {circle:unreadThreads().length>0||midNew,city:S.posts.some(p=>p.at>(seen.feed||0)&&p.by!==S.uid)&&S.ui.tab!=='city',ledger:led&&S.ui.tab!=='ledger'}}


// The rail beside the app on wide screens (C107). Its build notes are about the claude.ai artifact, so they
// stay only there (and in the local demo, which is that same file opened on its own). The server version
// shows a short About panel on its development server and no rail in production.
function railFor(){
  const r=$('.rail');if(!r||S.backend==='claude'||S.backend==='local')return;
  if(!(S.hello&&S.hello.dev)){r.remove();document.documentElement.classList.add('norail');return}
  r.innerHTML=`<h2>INSANE <span style="font-family:var(--f-mono);font-size:12px;color:var(--muted)">v0.9</span></h2><p>Plans, favors, pacts and dares for the few people you actually see.</p><h3>About</h3><p>Start a circle, or join one with a code or an invite link. Whatever needs you shows first on Home.</p><h3>Help</h3><p>Questions or something wrong? Ask whoever invited you, or the person who runs this server.</p><p class="meta">Development server: sign-in codes are printed in the server log.</p>`;
}
