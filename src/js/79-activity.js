/* ---------- what's new, calm, presence, celebrations ---------- */
function activity(){
  if(!S.me)return [];const seen=(S.priv.seen||{}).act||0,out=[],t=now();
  for(const u of unreadThreads())out.push({title:u.title,sub:(u.last.name||'')+': '+u.last.text,at:u.last.at,act:'open',data:{type:u.type,v:u.id}});
  for(const m of S.midnight)if(m.releaseAt<=t&&m.releaseAt>t-2*DAY&&(m.flags||[]).length<2)out.push({title:'Midnight went out',sub:'An unsigned message in your circle',at:m.releaseAt,act:'cseg-go',data:{v:'midnight'}});
  for(const d of nearDrops())if(d.end>t&&d.start<t+6*HOUR)out.push({title:d.venue+(dropPhase(d)==='open'?' is open now':' opens '+when(d.start)),sub:(DK[d.kind]?.n||'Drop')+' · '+fmtKm(d._km)+' away',at:Math.min(t,d.start-HOUR),act:'sheet',data:{v:'drop',id:d.id}});
  for(const m of S.met)if(m.at>t-3*DAY)out.push({title:'You met '+nameOf(m.ids.find(x=>x!==S.uid)),sub:'You can message each other now',at:m.at,act:'open',data:{type:'dm',v:m.id}});
  for(const c of S.calls)if(c.circle===S.me.circle&&c.answered&&c.room)out.push({title:c.answered.name+' answered your call',sub:c.ask,at:c.answeredAt||c.at,act:'open',data:{type:'room',v:c.room}});
  for(const s of S.sealed)if(s.openAt<=t&&s.openAt>t-3*DAY)out.push({title:'A sealed message opened',sub:'From '+nameOf(s.by),at:s.openAt,act:'cseg-go',data:{v:'midnight'}});
  for(const c of S.cheers)if(c.to===S.uid&&c.at>t-3*DAY)out.push({title:nameOf(c.from)+' cheered you',sub:c.label,at:c.at,act:'cseg-go',data:{v:'pacts'}});
  for(const d of S.dares)if(d.to===S.uid&&(!d.status||d.status==='open')&&d.at>t-3*DAY)out.push({title:nameOf(d.by)+' dared you',sub:d.text,at:d.at,act:'tab',data:{v:'today'}});
  for(const f of S.favors){if(f.status==='done'&&f.asker===S.uid)out.push({title:nameOf(f.doer)+' did your favor',sub:f.what+' · confirm to log it',at:f.doneAt||f.at,act:'tab',data:{v:'ledger'}});if(f.status==='claimed'&&f.asker===S.uid&&f.claimedAt>t-3*DAY)out.push({title:nameOf(f.doer)+' will do your favor',sub:f.what,at:f.claimedAt,act:'tab',data:{v:'ledger'}})}
  for(const p of pots())if(p.by===S.uid)for(const [x,v] of Object.entries(p.paid||{}))if(v==='wait')out.push({title:nameOf(x)+' paid into '+p.title,sub:'Check it landed, then confirm',at:p.at,act:'pot-go',data:{v:p.id}});
  if(S.mole&&S.mole.revealed&&S.mole.revealed.at>t-2*DAY)out.push({title:'The Mole was '+nameOf(S.mole.revealed.uid),sub:S.mole.revealed.done+' of 3 tasks',at:S.mole.revealed.at,act:'cseg-go',data:{v:'mole'}});
  for(const m of S.missions)if(m.at>t-3*DAY&&m.cid!==S.me.circle)out.push({title:'New Mission: '+m.title,sub:'Proposed by '+m.cname+' · '+when(m.when),at:m.at,act:'sheet',data:{v:'mission',id:m.id}});
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
function celebrate(stamp,msg){
  sfx();try{if(navigator.vibrate)navigator.vibrate(20)}catch(e){}
  if(msg)toast(msg);
  if(calmNow()||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const el=document.createElement('div');el.className='celebrate';el.setAttribute('aria-hidden','true');
  el.innerHTML=`<div class="cstamp">${esc(stamp)}</div>`+Array.from({length:20},(_,i)=>`<i style="--x:${Math.round((Math.random()*2-1)*170)}px;--y:${Math.round(-70-Math.random()*170)}px;--r:${Math.round(Math.random()*540)}deg;--dl:${i*10}ms;background:${['var(--stamp)','var(--ball)','var(--haz)','var(--good)'][i%4]}"></i>`).join('');
  document.body.appendChild(el);setTimeout(()=>el.remove(),1600);
}
function runDraw(id){
  const d=S.drops.find(x=>x.id===id);const ins=S.dropIns;const names=[...new Set(ins.map(i=>i.circle))].map(c=>ins.find(i=>i.circle===c)?.cname||'a circle');const w=drawWinner(d,ins);const wn=ins.find(i=>i.circle===w)?.cname||'a circle';
  const el=$('#draw-name');if(!el||!names.length)return;let i=0,delay=50;const t0=now();
  const step=()=>{const elx=$('#draw-name');if(!elx)return;if(now()-t0>2400){elx.textContent=wn;elx.classList.add('won');S.ui.drawn=id;render();celebrate('DRAWN',wn+' wins the draw');return}elx.textContent=names[i++%names.length];delay*=1.12;setTimeout(step,delay)};step();
}
async function pushOn(){
  try{
    const perm=await Notification.requestPermission();S.pushState=perm;if(perm!=='granted'){render();return}
    const reg=await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;
    const key=Uint8Array.from(atob(S.hello.vapid.replace(/-/g,'+').replace(/_/g,'/')+'=='.slice(0,(4-S.hello.vapid.length%4)%4)),c=>c.charCodeAt(0));
    const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    await S.db.call('push/sub',{subscription:sub.toJSON()});S.pushOn=true;toast('Notifications are on.');
  }catch(e){console.warn(e);toast('Couldn’t turn notifications on in this browser.')}
  render();
}
async function checkPush(){if(S.backend!=='server'||!('serviceWorker' in navigator)||!('Notification' in window))return;try{const reg=await navigator.serviceWorker.getRegistration('/sw.js');const sub=reg&&await reg.pushManager.getSubscription();S.pushOn=!!sub;S.pushState=Notification.permission;render()}catch(e){}}

let toastT=null;
function toast(m){S.toast=m;clearTimeout(toastT);toastT=setTimeout(()=>{S.toast=null;render()},3200);render()}
const toastHtml=()=>S.toast?`<div class="toast" role="status">${esc(S.toast)}</div>`:'';

