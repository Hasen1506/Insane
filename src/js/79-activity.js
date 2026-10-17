/* ---------- what's new, calm, presence, celebrations ---------- */
function activity(){
  if(!S.me)return [];const seen=(S.priv.seen||{}).act||0,out=[],tn=now();
  for(const u of unreadThreads())out.push({title:u.title,sub:(u.last.name||'')+': '+u.last.text,at:u.last.at,act:'open',data:{type:u.type,v:u.id}});
  for(const m of S.midnight)if(m.releaseAt<=tn&&m.releaseAt>tn-2*DAY&&(m.flags||[]).length<2)out.push({title:t('midOut'),sub:t('midSub'),at:m.releaseAt,act:'cseg-go',data:{v:'midnight'}});
  for(const d of nearDrops())if(d.end>tn&&d.start<tn+6*HOUR)out.push({title:t(dropPhase(d)==='open'?'dropOpen':'dropOpens',{v:d.venue,w:when(d.start)}),sub:(DK[d.kind]?.n||t('drop'))+' · '+t('away',{d:fmtKm(d._km)}),at:Math.min(tn,d.start-HOUR),act:'sheet',data:{v:'drop',id:d.id}});
  for(const m of S.met)if(m.at>tn-3*DAY)out.push({title:t('met',{n:nameOf(m.ids.find(x=>x!==S.uid))}),sub:t('metSub'),at:m.at,act:'open',data:{type:'dm',v:m.id}});
  for(const c of S.calls)if(c.circle===S.me.circle&&c.answered&&c.room)out.push({title:t('answered',{n:bidi(c.answered.name)}),sub:c.ask,at:c.answeredAt||c.at,act:'open',data:{type:'room',v:c.room}});
  for(const s of S.sealed)if(s.openAt<=tn&&s.openAt>tn-3*DAY)out.push({title:t('sealed'),sub:t('from',{n:nameOf(s.by)}),at:s.openAt,act:'cseg-go',data:{v:'midnight'}});
  for(const c of S.cheers)if(c.to===S.uid&&c.at>tn-3*DAY)out.push({title:t('cheered',{n:nameOf(c.from)}),sub:c.label,at:c.at,act:'cseg-go',data:{v:'pacts'}});
  for(const d of S.dares)if(d.to===S.uid&&(!d.status||d.status==='open')&&d.at>tn-3*DAY)out.push({title:t('dared',{n:nameOf(d.by)}),sub:d.text,at:d.at,act:'tab',data:{v:'today'}});
  for(const f of S.favors){if(f.status==='done'&&f.asker===S.uid)out.push({title:t('fvDone',{n:nameOf(f.doer)}),sub:t('fvConfirm',{w:f.what}),at:f.doneAt||f.at,act:'tab',data:{v:'ledger'}});if(f.status==='claimed'&&f.asker===S.uid&&f.claimedAt>tn-3*DAY)out.push({title:t('fvClaimed',{n:nameOf(f.doer)}),sub:f.what,at:f.claimedAt,act:'tab',data:{v:'ledger'}})}
  for(const p of pots())if(p.by===S.uid)for(const [x,v] of Object.entries(p.paid||{}))if(v==='wait')out.push({title:t('paidInto',{n:nameOf(x),p:p.title}),sub:t('paidSub'),at:p.at,act:'pot-go',data:{v:p.id}});
  if(S.mole&&S.mole.revealed&&S.mole.revealed.at>tn-2*DAY)out.push({title:t('mole',{n:nameOf(S.mole.revealed.uid)}),sub:t('moleSub',{d:S.mole.revealed.done}),at:S.mole.revealed.at,act:'cseg-go',data:{v:'mole'}});
  for(const m of S.missions)if(m.at>tn-3*DAY&&m.cid!==S.me.circle)out.push({title:t('mission',{t:m.title}),sub:t('missionSub',{c:bidi(m.cname),w:when(m.when)}),at:m.at,act:'sheet',data:{v:'mission',id:m.id}});
  return out.sort((a,b)=>b.at-a.at).slice(0,30).map(x=>Object.assign(x,{fresh:x.at>seen}));
}
const prefs=()=>S.priv.prefs||{};
const tzName=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){return ''}};
function quietNow(){const q=S.me&&S.me.quiet;if(!q||q.off)return false;const h=new Date().getHours(),f=q.from??23,t=q.to??8;return f>t?(h>=f||h<t):(h>=f&&h<t)}
const calmNow=()=>!!prefs().calm||quietNow();
function hereNow(){const ids=S.backend==='server'?(S.live||[]):S.backend==='claude'?(S.roomPeers||[]):[];const mem=new Set(S.members.map(m=>m.id));return [...new Set(ids)].filter(id=>id!==S.uid&&mem.has(id))}
let AC=null;
function sfx(){if(!prefs().sound||calmNow())return;try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type='triangle';o.frequency.setValueAtTime(660,t);o.frequency.exponentialRampToValueAtTime(990,t+.09);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.12,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.28);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+.3)}catch(e){}}
// A rubber stamp and a burst of paper. Calm mode and reduced motion get the words only.
// C55: the stamp lands where the person tapped (the row that changed), never over the screen's buttons
// in the middle, and it can't be hit: .celebrate and everything in it is pointer-events:none.
let tapY=null;addEventListener('pointerdown',e=>{tapY=e.clientY},true);
function celebrate(stamp,msg){
  sfx();try{if(navigator.vibrate)navigator.vibrate(20)}catch(e){}
  if(msg)toast(msg);
  if(calmNow()||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const el=document.createElement('div');el.className='celebrate';el.setAttribute('aria-hidden','true');
  if(tapY!=null)el.style.setProperty('--cy',Math.round(Math.min(Math.max(tapY,90),innerHeight-120))+'px');
  el.innerHTML=`<div class="cstamp">${esc(stamp)}</div>`+Array.from({length:20},(_,i)=>`<i style="--x:${Math.round((Math.random()*2-1)*170)}px;--y:${Math.round(-70-Math.random()*170)}px;--r:${Math.round(Math.random()*540)}deg;--dl:${i*10}ms;background:${['var(--stamp)','var(--ball)','var(--haz)','var(--good)'][i%4]}"></i>`).join('');
  document.body.appendChild(el);setTimeout(()=>el.remove(),1600);
}
function runDraw(id){
  const d=S.drops.find(x=>x.id===id);const ins=S.dropIns;const names=[...new Set(ins.map(i=>i.circle))].map(c=>ins.find(i=>i.circle===c)?.cname||t('aCircle'));const w=drawWinner(d,ins);const wn=ins.find(i=>i.circle===w)?.cname||t('aCircle');
  const el=$('#draw-name');if(!el||!names.length)return;let i=0,delay=50;const t0=now();
  const step=()=>{const elx=$('#draw-name');if(!elx)return;if(now()-t0>2400){elx.textContent=wn;elx.classList.add('won');S.ui.drawn=id;render();celebrate(t('drawn'),t('wins',{c:bidi(wn)}));return}elx.textContent=names[i++%names.length];delay*=1.12;setTimeout(step,delay)};step();
}
async function pushOn(){
  try{
    const perm=await Notification.requestPermission();S.pushState=perm;if(perm!=='granted'){render();return}
    const reg=await swReg();await navigator.serviceWorker.ready;
    const key=Uint8Array.from(atob(S.hello.vapid.replace(/-/g,'+').replace(/_/g,'/')+'=='.slice(0,(4-S.hello.vapid.length%4)%4)),c=>c.charCodeAt(0));
    const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    await S.db.call('push/sub',{subscription:sub.toJSON()});S.pushOn=true;toast(t('pushOn'));
  }catch(e){console.warn(e);toast(t('pushNo'))}
  render();
}
async function checkPush(){if(S.backend!=='server'||!('serviceWorker' in navigator)||!('Notification' in window))return;try{const reg=await navigator.serviceWorker.getRegistration('/sw.js');const sub=reg&&await reg.pushManager.getSubscription();S.pushOn=!!sub;S.pushState=Notification.permission;render()}catch(e){}}

// C73: one snackbar above the tab bar, two lines at most, gone after 3 s or as soon as the person moves to
// another screen (a toast set by the tap that moved them stays). role=status, so it is read out once.
let toastT=null,toastAt=0,toastOn='';
const screenKey=()=>{const u=S.ui||{};return [u.tab,u.cseg,u.sseg,u.lseg,u.open&&u.open.id,u.sheet&&u.sheet.t].join('|')};
function toast(m){S.toast=m;toastAt=Date.now();toastOn=screenKey();clearTimeout(toastT);toastT=setTimeout(()=>{S.toast=null;render()},3000);render()}
function toastHtml(){if(S.toast&&screenKey()!==toastOn){if(Date.now()-toastAt>600)S.toast=null;else toastOn=screenKey()}return S.toast?`<div class="toast" role="status">${esc(S.toast)}</div>`:''}

/* ---------- C77/C78/C21: after every draw ---------- */
// Sheets: focus moves into a sheet when it opens (its heading, or the sheet), Tab and Shift+Tab stay inside
// it, and focus goes back to the control that opened it when it closes. Sheet openers say they open a dialog.
// User text fields take their own direction (dir=auto).
let a11ySheet='',a11yFrom=null;
function a11yAfter(){
  const sh=document.querySelector('#layer .sheet'),k=sh&&S.ui.sheet?S.ui.sheet.t+'/'+(S.ui.sheet.id||''):'';
  if(k!==a11ySheet){
    if(k&&sh){const ae=document.activeElement;if(!a11ySheet&&ae&&ae!==document.body&&!sh.contains(ae))a11yFrom=ae.dataset&&ae.dataset.act?{act:ae.dataset.act,v:ae.dataset.v}:null;
      const h=sh.querySelector('h2,h3');if(h){h.tabIndex=-1;if(!h.id)h.id='sheet-h';sh.setAttribute('aria-labelledby',h.id)}
      if(!sh.contains(document.activeElement))(h||sh).focus({preventScroll:true})}
    else if(!k&&a11yFrom){const el=document.querySelector(`#app [data-act="${a11yFrom.act}"]`+(a11yFrom.v?`[data-v="${CSS.escape(a11yFrom.v)}"]`:''));a11yFrom=null;if(el)el.focus({preventScroll:true})}
    a11ySheet=k}
  const o=S.ui.sheet&&S.ui.sheet.t;for(const el of document.querySelectorAll('[data-act="sheet"],[data-act="make"]')){el.ariaHasPopup='dialog';el.ariaExpanded=o===(el.dataset.v||'make')}
  for(const el of document.querySelectorAll('input:not([dir]),textarea:not([dir])'))el.dir='auto';
}
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;const sh=document.querySelector('#layer .sheet');if(!sh)return;
  const f=[...sh.querySelectorAll('button,[href],input,select,textarea,summary')].filter(x=>!x.disabled&&x.type!=='hidden'&&x.getClientRects().length);if(!f.length)return;
  const a=document.activeElement,i=f.indexOf(a);
  if(e.shiftKey&&(i<=0)){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&(i<0||i===f.length-1)){e.preventDefault();f[0].focus()}
});

