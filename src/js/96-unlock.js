/* ---------- gradual unlock (C25, V05/V06) ----------
   What a person can see grows with their circle. Day 0: plans, chat, pacts, the daily dare, Decode.
   Favors and pots after the first plan. Midnight at 3 people, the Mole at 4. Feed posts, Calls and
   Missions once the circle has met in person. Drops and trails from day 3.
   unlocks(ctx, prev) is pure. Once something unlocks it stays unlocked (prev is the set already seen),
   so a circle shrinking from 4 to 3 never takes the Mole away. The set is kept per person on this
   device; the server-computed copy (PLAN WS-I) can replace unlockCtx() later without touching callers. */
// need: what the rule waits for. circle = in a circle; members = at least n people; plans = n plans made;
// met = the circle has met in person; days = n days since joining.
const UNLOCK_RULES={
  check:{},dark:{},addj:{},meet:{},decode:{},pacts:{},daily:{},
  chat:{circle:1},plan:{circle:1},invite:{circle:1},
  dare:{circle:1,members:2},
  favor:{circle:1,plans:1},pot:{circle:1,plans:1},
  midnight:{circle:1,members:3},seal:{circle:1,members:3},
  mole:{circle:1,members:4},
  fpost:{circle:1,met:1},call:{circle:1,met:1},mission:{circle:1,met:1},
  drop:{days:3},trail:{days:3},
};
const UNLOCK_KEYS=Object.keys(UNLOCK_RULES);
function ruleHolds(k,c){const r=UNLOCK_RULES[k];if(!r)return false;c=c||{};
  if(r.circle&&!c.circle)return false;if(r.members&&!((c.members|0)>=r.members))return false;
  if(r.plans&&!((c.plans|0)>=r.plans))return false;if(r.met&&!c.met)return false;if(r.days&&!((c.days|0)>=r.days))return false;return true}
// The set of unlocked keys: everything that was unlocked before, plus everything whose rule holds now.
function unlocks(ctx,prev){const out=new Set([...(prev||[])].filter(k=>UNLOCK_RULES[k]));if(ctx&&ctx.all)return new Set(UNLOCK_KEYS);for(const k of UNLOCK_KEYS)if(ruleHolds(k,ctx))out.add(k);return out}
// Why something is still locked, in words, plus where to go about it. Pure.
function lockReason(k,c){const r=UNLOCK_RULES[k]||{};c=c||{};
  if(r.circle&&!c.circle)return {why:'Needs a circle',long:'Start a circle or join one with a code first.',go:'circle'};
  if(r.members&&(c.members|0)<r.members){const n=r.members-(c.members|0);return {why:'Needs '+r.members+' people',long:`Opens when your circle has ${r.members} people. You have ${c.members|0}, so ${n} more to go.`,go:'invite',n}}
  if(r.plans&&(c.plans|0)<r.plans)return {why:'After your first plan',long:'Opens after your circle makes its first plan.',go:'plan'};
  if(r.met&&!c.met)return {why:'After you meet',long:'Opens once two of you have met in person and scanned each other’s phones.',go:'meet'};
  if(r.days&&(c.days|0)<r.days){const n=r.days-(c.days|0);return {why:'In '+n+' day'+(n>1?'s':''),long:`Opens on your day ${r.days}, so you get to know the basics first.`,go:null,n}}
  return {why:'',long:'',go:null}}

// The live context, read from state. Days count from when the person joined INSANE.
function unlockCtx(){const me=S.me||{};const inC=!!(me.circle&&S.circle);
  let plans=0;if(inC)plans=S.threads.filter(t=>t.kind==='plan'||t.kind==='pot').length;
  return {circle:inC,members:inC?S.members.length:0,plans,met:inC&&typeof verified==='function'&&verified(),days:me.joined?Math.floor((now()-me.joined)/DAY):0,all:unlockAll()}}
function unlockAll(){try{return localStorage.getItem('insane_unlock_all')==='1'||/[?&]unlock=all\b/.test(location.search)}catch(e){return false}}
const UNL={uid:null,set:new Set()};
function unlockKey(){return 'insane_unl_'+(S.uid||'anon')}
function unlockedSet(){
  if(UNL.uid!==S.uid){UNL.uid=S.uid;let prev=[];try{prev=JSON.parse(localStorage.getItem(unlockKey())||'[]')}catch(e){}UNL.set=new Set(Array.isArray(prev)?prev:[])}
  if(!S.me)return UNL.set;
  const next=unlocks(unlockCtx(),[...UNL.set]);
  if(next.size!==UNL.set.size&&!unlockAll()){UNL.set=next;try{localStorage.setItem(unlockKey(),JSON.stringify([...next]))}catch(e){}}
  return unlockAll()?next:UNL.set}
const isOpen=k=>unlockedSet().has(k);

/* Hooks the screens call. Each is one line where it's used, so the owners of those screens keep their code. */
// A tab label with its lock: "Midnight 🔒3".
function segLockTag(k){if(!UNLOCK_RULES[k]||isOpen(k))return '';const r=lockReason(k,unlockCtx());return `<span class="lk" aria-label="locked: ${esc(r.why)}">${r.n&&r.go==='invite'?UNLOCK_RULES[k].members+'+':'🔒'}</span>`}
// The panel shown in place of a locked section.
function lockPanel(k,title){const r=lockReason(k,unlockCtx());const btn=r.go==='invite'?`<button class="btn s" data-act="sheet" data-v="invite">Bring someone in</button>`:r.go==='meet'?`<button class="btn s" data-act="sheet" data-v="meet">Meet someone</button>`:r.go==='plan'?`<button class="btn s" data-act="mk" data-v="plan">Plan something</button>`:r.go==='circle'?`<button class="btn s" data-act="tab" data-v="circle">Start or join a circle</button>`:'';
  return `<div class="card lockcard" data-locked="${esc(k)}"><div class="meta">LOCKED · ${esc(r.why.toUpperCase())}</div><h3>${esc(title||GLOSS[k]?.n||k)}</h3><p>${esc(r.long)}</p>${GLOSS[k]?`<p class="meta" style="font-family:var(--f-body);font-size:13px">${esc(GLOSS[k].s)}</p>`:''}<div class="btns">${btn}<button class="btn s ghost" data-act="sheet" data-v="help" data-id="unlocks">How unlocks work</button></div></div>`}
// Each locked item, with its rule and how close the circle is. For Help.
function unlockList(){const c=unlockCtx(),set=unlockedSet();const rows=MAKE_GROUPS.flatMap(g=>g.items).filter(k=>UNLOCK_RULES[k]).map(k=>{const m=MAKE_ITEM[k];const open=set.has(k);return `<div class="row ul ${open?'open':''}"><span class="grow"><b>${esc(m.n)}</b><small>${open?'Unlocked':esc(lockReason(k,c).why)}</small></span><span aria-hidden="true">${open?'✓':'🔒'}</span></div>`});return rows.join('')}

/* ---------- the + menu (C57): grouped, icons, only what's unlocked ---------- */
const MAKE_ITEM={
 plan:{n:'Plan something',s:'Everyone taps in or out',i:'🗓️'},pot:{n:'Start a pot',s:'Pledge, then pay',i:'🪙'},favor:{n:'Ask a favor',s:'Paid back in hours',i:'🤝'},
 dare:{n:'Dare someone, or fill the jar',s:'Tomorrow’s daily dare comes from the jar',i:'🎲'},midnight:{n:'Write for Midnight',s:'Unsigned, out at 00:00',i:'🌙'},seal:{n:'Seal a message for later',s:'Signed, opens on a date you pick',i:'✉️'},
 check:{n:'Check in on a pact',s:'Your ticks for today',i:'✅'},dark:{n:'Go dark for a while',s:'1 to 24 hours, alone or with the circle',i:'🌑'},addj:{n:'Add a need, want or urge',s:'Say it in your own words',i:'💭'},
 fpost:{n:'Post to the City feed',s:'What your circle did or made',i:'📣'},call:{n:'Post a Call',s:'Ask other circles for a hand',i:'🙋'},drop:{n:'Host a drop',s:'For a shop, stall, club or circle',i:'📦'},
 mission:{n:'Propose a Mission',s:'Needs three other circles to confirm',i:'🧭'},trail:{n:'Make a trail',s:'Stops on the map, walked in any order',i:'🥾'},meet:{n:'Meet someone',s:'Scan each other’s phones',i:'📱'},
};
const MAKE_GROUPS=[{t:'With your circle',items:['plan','pot','favor','dare','midnight','seal']},{t:'For you',items:['check','dark','addj']},{t:'In the city',items:['fpost','call','drop','mission','trail','meet']}];
function makeRows(){const set=unlockedSet();return MAKE_GROUPS.map(g=>({t:g.t,items:g.items.filter(k=>set.has(k))})).filter(g=>g.items.length)}
function makeSheetV09(){
  const groups=makeRows(),locked=MAKE_GROUPS.flatMap(g=>g.items).filter(k=>!isOpen(k)).length;
  const solo=!(S.me&&S.me.circle);
  return `<h2>Make something</h2>${solo?`<button class="sh-i" data-act="tab" data-v="circle"><span class="ic" aria-hidden="true">👥</span><span class="grow">Start or join a circle<small>Most things here need your people (3–8)</small></span></button>`:''}
  ${groups.map(g=>`<div class="eyebrow">${esc(g.t)}</div><div>${g.items.map(k=>{const m=MAKE_ITEM[k];return `<button class="sh-i" data-act="mk" data-v="${k}"><span class="ic" aria-hidden="true">${m.i}</span><span class="grow">${esc(m.n)}<small>${esc(m.s)}</small></span></button>`}).join('')}</div>`).join('')}
  ${locked?`<p class="meta mk-more">${locked} more unlock as your circle grows. <button class="link" data-act="sheet" data-v="help" data-id="unlocks">How unlocks work</button></p>`:''}
  <div class="btns"><button class="btn ghost" data-act="sheet" data-v="help">Help</button><button class="btn ghost" style="flex:1" data-act="sheet-close">Close</button></div>`}
// Circle segments → the unlock that gates them.
const CSEG_UNLOCK={chat:'chat',plans:'plan',pacts:'pacts',midnight:'midnight',mole:'mole'};
// C56: the solo Ledger explains what it's for and where to start.
function soloLedger(){return `<div class="card empty-l"><div class="empty-i" aria-hidden="true">🤝 🪙</div><h3>Favours and pots live in a circle</h3><p><b>Favours</b> are paid back in hours, not money: you help with a move, you earn 2 h to spend on someone else’s help.</p><p><b>Pots</b> are for shared money, like a trip or a dinner: people pledge, then pay, and the organiser ticks it off.</p><div class="btns"><button class="btn s" data-act="tab" data-v="circle">Start or join a circle</button><button class="btn s ghost" data-act="gloss" data-v="favor">How hours work</button></div></div>`}
