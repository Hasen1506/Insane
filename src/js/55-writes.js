/* ---------- writes ---------- */
async function W(fn,okMsg){
  if(S.ui.readonly){toast('You can look around, but you need Contributor or Editor access to take part.');return false}
  try{await fn();if(okMsg)toast(okMsg);return true}
  catch(e){console.warn(e);const c=e&&e.code;
    if(c==='failed_precondition'){const M={wrong_code:'That’s not the door code. Ask at the counter.',wrong_answer:'Not it. Try again.',expired_code:'That code has expired or doesn’t exist. Ask for a fresh one.'};toast(M[e.message]||e.message||'That didn’t go through.')}
    else if(c==='permission_denied'&&S.backend==='server')toast(e.message||'That isn’t yours to change.');
    else if(c==='unauthenticated'){toast('Your session ended. Sign in again.');setTimeout(()=>location.reload(),1500)}
    else if(c==='invalid_argument'&&S.backend==='claude'){S.ui.readonly=true;toast('This link lets you look, not post. Ask the owner to invite you as an Editor.')}
    else if(c==='quota_exceeded')toast('The app’s storage is full. The owner needs to clear old messages.');
    else if(c==='resource_exhausted')toast('Too fast. Give it a few seconds and try again.');
    else toast('That didn’t save. Check your connection and try again.');
    render();return false}
}
async function mark(step){
  if(!S.evLoaded||!S.ev||(S.ev.first&&S.ev.first[step]))return;
  S.ev.first=Object.assign({},S.ev.first,{[step]:now()});
  try{await S.db.doc('ev/'+S.uid).set({first:S.ev.first,days:S.ev.days||[]})}catch(e){}
}
let visited=false;
async function dailyVisit(){
  if(visited||!S.evLoaded)return;visited=true;const d=today();const days=S.ev.days||[];
  if(!days.includes(d)){S.ev.days=[...days,d].slice(-90);S.ev.first=Object.assign({signedIn:now()},S.ev.first||{});try{await S.db.doc('ev/'+S.uid).set({first:S.ev.first,days:S.ev.days})}catch(e){}}
  if(S.me&&(!S.me.seen||now()-S.me.seen>HOUR||S.me.tz!==tzName())){try{await S.db.doc('people/'+S.uid).update({seen:now(),tz:tzName()})}catch(e){}}
}
// Timeline writes go one at a time and merge with what this tab already wrote, so two quick events can't overwrite each other.
let logQ=Promise.resolve(),logMem=[];
function logMine(text){
  const entry={t:text,at:now()};
  logQ=logQ.then(async()=>{
    const seen=new Set();const items=[entry,...logMem,...(S.priv.log?.items||[])].filter(i=>{const k=i.at+'|'+i.t;if(seen.has(k))return false;seen.add(k);return true}).sort((a,b)=>b.at-a.at).slice(0,300);
    logMem=items;try{await S.db.doc(`data/users/${S.uid}/log`).set({items})}catch(e){}
  });
  return logQ;
}
async function setSeen(key){
  const cur=S.priv.seen||{};if(cur[key]&&now()-cur[key]<3000)return;
  try{await S.db.doc(`data/users/${S.uid}/seen`).set(Object.assign({},cur,{[key]:now()}))}catch(e){}
}
async function pushProgress(){
  if(!S.me?.circle)return;
  const items=journeys().filter(j=>j.status==='active').map(j=>({kind:j.read.kind,lane:j.lane,label:j.read.kind==='Ladder'?'Ladder':j.read.kind==='Midnight'?'Something to say':j.read.what,count:jCount(j),goal:jGoal(j),today:j.read.kind==='Pact'&&(j.ticks||[]).includes(today())}));
  try{await S.db.doc(`circles/${S.me.circle}/progress/${S.uid}`).set({items,at:now()})}catch(e){}
}

/* ---------- journeys ---------- */
const journeys=()=>Object.entries(S.priv).filter(([k])=>k.startsWith('j_')).map(([id,v])=>Object.assign({id},v)).sort((a,b)=>b.created-a.created);
function jCount(j){const k=j.read.kind;if(k==='Pact'){const ws=weekStart();return (j.ticks||[]).filter(d=>new Date(d+'T12:00').getTime()>=ws).length}if(k==='Ladder')return j.rung||0;if(k==='Plan'||k==='Plan + pot')return (j.steps||[]).filter(s=>s.done).length;return j.status==='done'?1:0}
function jGoal(j){const k=j.read.kind;if(k==='Pact')return j.read.goal||3;if(k==='Ladder')return j.read.rungs||5;if(k==='Plan'||k==='Plan + pot')return (j.steps||[]).length||3;return 1}
async function addJourney(lane,text,stake){
  const r=readUrge(lane,text);if(!r||r.kind==='Support'||r.kind==='No')return false;
  const id='j_'+rnd(10);
  const d={lane,text:text.trim(),read:r,created:now(),status:'active',ticks:[],rung:0};if(stake&&(r.kind==='Pact'||r.kind==='Ladder'))d.stake=stake;
  if(r.kind==='Plan'||r.kind==='Plan + pot')d.steps=(r.kind==='Plan + pot'?['Pick a date','Get two people in','Everyone pledges','Book it']:['Pick a date','Get two people in','Do it']).map(t=>({t,done:false}));
  if(r.kind==='Ladder')d.rungsText=['','','','',''];
  await S.db.doc(`data/users/${S.uid}/${id}`).set(d);
  return true;
}

