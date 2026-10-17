/* ---------- help, glossary, tour, and the notification soft-ask (C26, C58, C108) ---------- */
// The welcome, sign-in and onboarding handlers (68-welcome.js, 71-onboarding.js) join the registry here,
// after 90-actions/00-registry.js has declared ACT.
Object.assign(ACT,ACT_B);
// Every invented noun, in two lines: what it is, and how you use it.
const GLOSS={
  circle:{n:'Circle',s:'Your people: 3 to 8 you actually see. Plans, pacts, pots and Midnight all happen inside it.'},
  pacts:{n:'Pact',s:'Something you keep saying you’ll do, like “run 3 times a week”. Your circle sees your ticks, never your words.'},
  ladder:{n:'Ladder',s:'A scary thing broken into small rungs. You climb one rung at a time and the circle cheers each step.'},
  daily:{n:'Daily dare',s:'One dare for the whole circle each day, drawn from the jar. Do it, post proof, done.'},
  dare:{n:'Dare jar',s:'Where tomorrow’s daily dare comes from. Anyone in the circle can drop one in, or dare one person directly.'},
  midnight:{n:'Midnight',s:'Unsigned messages that go out to your circle at 00:00. Nobody, not even the server, keeps who wrote them.'},
  seal:{n:'Sealed message',s:'A signed note that stays locked until a date you pick. Good for birthdays and “told you so”.'},
  mole:{n:'Mole',s:'Each week one of you can secretly take three harmless tasks. On Sunday at 21:00 everyone guesses who it was.'},
  decode:{n:'Decode',s:'A weekly city puzzle. Every circle gets the same clue; the first to solve it climbs the League.'},
  drop:{n:'Drop',s:'A short-lived event at a real place: a swap box, a counter dare, an offer for whoever turns up. Only shown within your distance.'},
  twokey:{n:'Two-key drop',s:'A drop that only opens when people from two circles arrive together.'},
  trail:{n:'Trail',s:'Stops on the map, walked in any order. Your phone stamps each stop when you’re close.'},
  mission:{n:'Mission',s:'A plan big enough for several circles. The exact spot stays hidden until two hours before.'},
  call:{n:'Call',s:'Your circle asks other circles for a hand: a 4th for quiz night, someone with a drill.'},
  feed:{n:'Feed',s:'What circles in your city did or made. Posting opens once your circle has met in person.'},
  league:{n:'League',s:'This week’s points by circle, from Decode solves and drops you turned up to.'},
  pot:{n:'Pot',s:'Money for a shared plan. People pledge, then pay, and the organiser ticks who’s paid.'},
  favor:{n:'Favor hours',s:'Help is paid back in hours, not money. Nobody can go below −5 h, so it stays fair.'},
  passport:{n:'Passport',s:'Stamps for drops you turned up to, people you met and things you finished.'},
  journey:{n:'Journey',s:'Your needs, wants and urges, turned into pacts, plans or ladders. Private words, shared progress.'},
  dark:{n:'Go dark',s:'INSANE goes blank for 1 to 24 hours so you can actually do the thing. Alone or with the circle.'},
  handle:{n:'Handle',s:'Your public nickname. Strangers in the City see this, never your name.'},
  meet:{n:'Meet',s:'Scan each other’s phones when you’re together. It proves you’re real people, and unlocks City posting.'},
};
const GLOSS_ALIAS={chat:'circle',plan:'circle',plans:'circle',fpost:'feed',calls:'call',favors:'favor',pots:'pot',check:'pacts',addj:'journey'};
const glossOf=k=>GLOSS[k]?k:GLOSS_ALIAS[k]&&GLOSS[GLOSS_ALIAS[k]]?GLOSS_ALIAS[k]:null;
// A small "?" next to a noun. Unseen ones carry a dot until opened once (the one-time tip).
function seenGloss(){try{return new Set(JSON.parse(localStorage.getItem('insane_gloss')||'[]'))}catch(e){return new Set()}}
function qi(k){k=glossOf(k);if(!k)return '';const fresh=!seenGloss().has(k);return `<button class="qi${fresh?' new':''}" data-act="gloss" data-v="${k}" aria-label="What’s ${esc(GLOSS[k].n)}?"><span aria-hidden="true">?</span></button>`}
// The explainer line under a segment row: one sentence on the noun you're looking at.
function segHelp(seg){const k=glossOf(seg);if(!k||k==='circle')return '';return `<p class="segx"><span>${esc(GLOSS[k].s)}</span>${qi(k)}</p>`}
// Headings that name a noun get their "?" (eyebrows and the daily-dare label). A string pass over the
// view's HTML, so the screens that own those headings stay as they are.
const HELP_HEADS=[[/^Drops near you/,'drop'],[/^Missions/,'mission'],[/^Trails/,'trail'],[/^Passport/,'passport'],[/^Your journeys/,'journey'],[/^Go dark/,'dark'],[/^The dare jar/,'dare'],[/^DAILY DARE/,'daily']];
function helpMarks(html){
  return html.replace(/(<div class="(?:eyebrow|k)">)([^<]*)/g,(m,open,txt)=>{for(const [re,k] of HELP_HEADS)if(re.test(txt))return open+txt+qi(k);return m});
}

SHEETS['gloss']=(sh,close)=>{const k=glossOf(sh.id)||'circle',g=GLOSS[k];
  return `<h2>${esc(g.n)}</h2><p class="gl-s">${esc(g.s)}</p>${UNLOCK_RULES[k]&&!isOpen(k)?`<div class="lock">${esc(lockReason(k,unlockCtx()).long)}</div>`:''}<div class="btns"><button class="btn ghost" data-act="sheet" data-v="help">All terms</button><button class="btn" style="flex:1" data-act="sheet-close">Got it</button></div>`};
SHEETS['help']=(sh,close)=>{
  const terms=Object.entries(GLOSS).map(([k,g])=>`<div class="gl" id="gl-${k}"><b>${esc(g.n)}</b><span>${esc(g.s)}</span></div>`).join('');
  return `<h2>Help</h2><p class="lede" style="margin-bottom:6px">INSANE is plans, dares and favours with the 3–8 people you actually see.</p>
  <div class="eyebrow" id="help-unlocks">How unlocks work</div><p class="gl-s">Things open as your circle grows, so day one isn’t a wall of buttons. Once something opens, it stays open.</p><div class="card ullist">${S.me?unlockList():''}</div>
  <div class="eyebrow">What the words mean</div><div class="card">${terms}</div>
  <div class="eyebrow">Staying safe</div><div class="card"><p class="gl-s" style="margin:0">Meet in public places first. Your exact pin is only ever yours; others see a square. Midnight is unsigned, so keep it kind. Dares from the jar should be fun, never risky. If someone makes you uneasy, leave the circle.</p></div>
  <div class="eyebrow">Contact</div><div class="card"><p class="gl-s" style="margin:0">Stuck, or something feels wrong? Write to the person who runs your INSANE${S.backend==='server'?' server':''}. A named grievance contact comes with the full Terms.</p></div>
  <div class="btns">${S.me&&S.me.cell?`<button class="btn ghost" data-act="tour-start">Replay the tour</button>`:''}<button class="btn" style="flex:1" data-act="sheet-close">Close</button></div>`};
ACT['gloss']=async(d)=>{const k=glossOf(d.v);if(k){const s=seenGloss();s.add(k);try{localStorage.setItem('insane_gloss',JSON.stringify([...s]))}catch(e){}}openSheet('gloss',{id:k})};
// A Help row for Profile.
function helpEntry(){return `<div class="eyebrow">Help</div><div class="card"><p style="margin:0">What the words mean, how unlocks work, and staying safe.</p><div class="btns"><button class="btn s ghost" data-act="sheet" data-v="help">Open Help</button><button class="btn s ghost" data-act="tour-start">Replay the tour</button></div></div>`}

/* ---------- the tour (C26): four coach marks after onboarding, never over the main button ---------- */
const TOUR=[
  {tab:'today',at:'today',h:'Home',p:'What needs you today: plans to answer, your pact ticks, the daily dare.'},
  {tab:'circle',at:'circle',h:'Circle',p:'Your people. Chat, plans, pacts, and later Midnight and the Mole.'},
  {tab:null,at:'plus',h:'The + button',p:'Make anything: a plan, a pot, a dare. More options unlock as your circle grows.'},
  {tab:'city',at:'city',h:'City',p:'Drops near you, the weekly Decode, and other circles. Tap any ? to learn a word.'},
];
const tourKey='insane_tour';
function tourStep(){try{const v=localStorage.getItem(tourKey);return v==null||v==='done'?null:+v}catch(e){return null}}
function tourSet(v){try{localStorage.setItem(tourKey,String(v))}catch(e){}}
// Called when onboarding finishes. A device that already saw the tour doesn't see it again.
function tourBegin(){try{if(localStorage.getItem(tourKey)==='done')return}catch(e){}tourSet(0)}
function tourHtml(){const st=tourStep();if(st==null||!S.me||!S.me.cell||S.ui.sheet||S.mode!=='live'&&S.mode!=='demo')return '';const t=TOUR[st];if(!t)return '';
  const pos={today:'10%',circle:'30%',plus:'50%',city:'70%'}[t.at];
  return `<div class="tour" role="dialog" aria-label="Tour: ${esc(t.h)}" style="--x:${pos}"><div class="meta">${st+1} OF ${TOUR.length}</div><h3>${esc(t.h)}</h3><p>${esc(t.p)}</p><div class="btns"><button class="link" data-act="tour-skip">Skip tour</button><button class="btn s" style="margin-left:auto" data-act="tour-next">${st===TOUR.length-1?'Done':'Next'}</button></div></div>`}
ACT['tour-next']=async()=>{const st=tourStep();const n=(st==null?0:st)+1;if(n>=TOUR.length){tourSet('done');S.ui.tab='today'}else{tourSet(n);const t=TOUR[n];if(t.tab){S.ui.tab=t.tab;S.ui.open=null;wire2()}}render();scrollTo(0,0)};
ACT['tour-skip']=async()=>{tourSet('done');render()};
ACT['tour-start']=async()=>{tourSet(0);S.ui.sheet=null;S.ui.tab='today';S.ui.open=null;wire2();render();scrollTo(0,0)};

/* ---------- notification soft-ask (C58): after the first plan, pact or favor, never in onboarding ---------- */
function askKey(){return 'insane_ask_'+(S.uid||'anon')}
function pushPossible(){return S.backend==='server'&&typeof navigator!=='undefined'&&'serviceWorker' in navigator&&typeof Notification!=='undefined'}
function isIOS(){return /iPhone|iPad|iPod/.test(navigator.userAgent||'')}
function standalone(){try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}catch(e){return false}}
// The first meaningful thing: a plan they made, a pact or ladder started after onboarding, or a favor they asked.
function firstMeaningful(){if(!S.me)return null;const u=S.uid,j0=(S.me.joined||0)+MIN;
  if(S.threads.some(t=>t.kind==='plan'&&t.by===u))return 'plan';
  if(S.favors.some(f=>f.asker===u))return 'favor';
  if(typeof journeys==='function'&&journeys().some(j=>(j.created||0)>j0))return 'pact';
  return null}
function softAskHtml(){
  if(!pushPossible()||!S.me||!S.me.cell)return '';
  let st=null;try{st=localStorage.getItem(askKey())}catch(e){}if(st)return '';
  const perm=S.pushState||Notification.permission;if(perm!=='default'||S.pushOn)return '';
  const why=firstMeaningful();if(!why)return '';
  const q={plan:'Want to know when they answer?',favor:'Want to know when someone takes it?',pact:'Want a nudge when your circle cheers you?'}[why];
  if(isIOS()&&!standalone())return `<div class="softask" role="status"><p><b>${q}</b> On iPhone, notifications need INSANE on your Home Screen first: tap Share, then “Add to Home Screen”.</p><div class="btns"><button class="btn s ghost" data-act="ask-later">Not now</button></div></div>`;
  return `<div class="softask" role="status"><p><b>${q}</b> We’ll only ping you for things that need you. Never in quiet hours.</p><div class="btns"><button class="btn s" data-act="ask-yes">Turn on</button><button class="btn s ghost" data-act="ask-later">Not now</button></div></div>`}
ACT['ask-yes']=async()=>{try{localStorage.setItem(askKey(),'yes:'+now())}catch(e){}await pushOn();render()};
ACT['ask-later']=async()=>{try{localStorage.setItem(askKey(),'later:'+now())}catch(e){}render()};
