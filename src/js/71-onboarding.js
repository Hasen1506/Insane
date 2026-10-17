/* ---------- onboarding ---------- */
function onboarding(){
  obRestore();const o=S.ui.ob,st=o.step;
  const steps=`<div class="steps" aria-label="Step ${st+1} of 4">${[0,1,2,3].map(i=>`<i class="${i<=st?'on':''}"></i>`).join('')}</div>`;
  if(S.deep&&S.deep.kind==='c'&&o.invFor!==S.deep.code){o.invFor=S.deep.code;o.code=S.deep.code;S.db.doc('codes/'+S.deep.code).get().then(x=>x.exists?S.db.doc('circles/'+x.data().cid).get():null).then(c=>{if(c&&c.exists){o.invName=c.data().name;render()}}).catch(()=>{})}
  let body='';
  if(st===0){
    if(o.name==null)o.name=(S.realName||'').split(' ')[0]||'';
    if(o.handle==null)o.handle=HANDLES[fnvN(S.uid||'x')%HANDLES.length];
    const hs=[...new Set([o.handle,...HANDLES])].filter(Boolean).slice(0,6);
    const ag=ageCheck(o),why=obWhy(o,ag);
    body=`${o.invName?`<div class="card stamp" style="margin-top:18px"><div class="meta">INVITE</div><p><b>${esc(o.invName)} brought you in.</b> You’ll join them in step 3.</p></div>`:''}
    <h1 class="v">Make plans, take dares, trade favours. With your people (3–8).</h1>
    <p class="lede">${S.backend==='claude'?`You’re signed in through Claude${S.realName?` as <b>${esc(S.realName)}</b>`:''}.`:S.backend==='server'?`You’re signed in as <b>${esc(S.email||'')}</b>.`:'This is the demo on this device.'}</p>
    <label class="f" for="ob-name">Your name <small>your circle sees this</small></label><input class="in-t" id="ob-name" data-ob="name" maxlength="24" value="${esc(o.name)}" placeholder="Meera" autocomplete="nickname"><p class="cnt-n" id="ob-name-n" aria-live="polite">${[...(o.name||'')].length}/24</p>
    <label class="f" for="ob-handle">Your handle <small>public</small></label><p class="ob-hint">Strangers in the City see this, never your name. Pick one or make your own.</p><div class="chips">${hs.map(h=>`<button class="chip ${o.handle===h?'on':''}" data-act="ob-handle" data-v="${esc(h)}">${esc(h)}</button>`).join('')}<button class="chip shuf" data-act="ob-shuffle" aria-label="Shuffle handles">🔀 Shuffle</button></div>
    <input class="in-t" id="ob-handle" data-ob="handle" maxlength="16" value="${esc(o.handle)}" style="margin-top:6px;text-transform:uppercase;font-family:var(--f-mono);letter-spacing:.08em" aria-label="Or type your own handle">
    <div class="hprev" aria-label="How a City post looks"><div class="meta">HOW A CITY POST LOOKS</div><p><b id="ob-hprev">${esc((o.handle||'').toUpperCase()||'YOUR HANDLE')}</b> <span class="meta">· made</span><br>First dosa that didn’t stick to the pan.</p></div>
    ${ageBlock(o,ag)}
    ${consentRow(o)}
    <div class="btns"><button class="btn wide" data-act="ob-next" ${why?'disabled':''}>Next</button></div><p class="why" id="ob-why" aria-live="polite">${esc(why)}</p>`;
  }else if(st===1){
    body=`<h1 class="v">Where’s home?</h1><p class="lede">Anywhere on Earth. You choose how exact: a private pin, or just a square of 1 to 9 km².</p>${picker('home')}
    <div class="btns"><button class="btn ghost" data-act="ob-back">Back</button><button class="btn" style="flex:1" data-act="ob-next" ${lpState('home').lat!=null?'':'disabled'}>Next</button></div>`;
  }else if(st===2){
    const inv=o.invName&&!o.own;
    body=`<h1 class="v">${o.invName?esc(o.invName):'Your circle'}</h1><p class="lede">Up to 8 people you actually see. Next time you’re in the same room, <b>scan each other’s phones</b>: that proves you’re real people who’ve met, which a bot farm can’t fake, and it unlocks posting in the City.</p>
    ${inv?`<div class="stack"><div class="card hot"><h3>Join ${esc(o.invName)}</h3><p class="meta">Code ${esc(o.code||'')}</p><div class="btns"><button class="btn wide" data-act="ob-circle" data-v="join" ${(o.code||'').trim().length===6?'':'disabled'}>Join ${esc(o.invName)}</button></div></div></div>
    <div class="btns"><button class="btn ghost" data-act="ob-back">Back</button><button class="link" data-act="ob-own" style="margin-left:auto">Start my own instead</button></div>`
    :`<div class="stack">
      <div class="card hot"><h3>Start a circle</h3><label class="f" for="ob-cname">Circle name</label><input class="in-t" id="ob-cname" data-ob="cname" maxlength="28" value="${esc(o.cname||'')}" placeholder="Third Floor"><p class="cnt-n" id="ob-cname-n">${[...(o.cname||'')].length}/28</p><div class="btns"><button class="btn" data-act="ob-circle" data-v="create" ${(o.cname||'').trim()?'':'disabled'}>Start it</button></div></div>
      <div class="card"><h3>Join with a code</h3><label class="f" for="ob-code">6-letter code</label><input class="in-t" id="ob-code" data-ob="code" maxlength="6" value="${esc(o.code||'')}" placeholder="K7QF2M" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.2em;font-family:var(--f-mono)"><div class="btns"><button class="btn ${o.invName?'':'ghost'}" data-act="ob-circle" data-v="join" ${(o.code||'').trim().length===6?'':'disabled'}>Join</button></div></div>
    </div>
    <div class="btns"><button class="btn ghost" data-act="ob-back">Back</button><button class="link" data-act="ob-circle" data-v="skip" style="margin-left:auto">Look around first</button></div><p class="why" style="text-align:right">You can join later from Circle. Most things need a circle.</p>`}`;
  }else{
    const lane=o.lane||'need',L=LANES[lane],r=readUrge(lane,o.mind),pk=r&&(r.kind==='Pact'||r.kind==='Ladder');
    body=`<h1 class="v">What’s on your mind?</h1><p class="lede">Say it the way you’d say it to a friend. Your circle sees progress, never these words.</p>
    <div class="seg" role="tablist" style="margin-top:0">${['need','want','urge'].map(k=>`<button role="tab" data-act="ob-lane" data-v="${k}" class="${lane===k?'on':''}" aria-selected="${lane===k}">${LANES[k].k}</button>`).join('')}</div>
    <label class="f" for="ob-mind">${esc(L.lead)} <small>${esc(L.hz)}</small></label><input class="in-t" id="ob-mind" data-ob="mind" data-read="mind" value="${esc(o.mind||'')}" placeholder="${esc(L.ph)}" maxlength="90" autocomplete="off">
    <div class="ex">${obEx(lane).map(e=>`<button data-act="ob-ex" data-k="mind" data-v="${esc(e)}">${esc(e)}</button>`).join('')}</div>
    <div class="obchip" id="ob-chip" aria-live="polite">${obChip(r,o)}</div><div id="read-mind">${readCard(r)}</div>
    <div id="ob-stake" ${pk?'':'hidden'}><label class="f">If I miss</label><div class="chips">${STAKES.map((x,i)=>`<button class="chip ${(o.stake||0)===i?'on':''}" data-act="ob-stake" data-v="${i}">${esc(x)}</button>`).join('')}</div></div>
    <div class="btns"><button class="btn ghost" data-act="ob-back">Back</button><button class="btn" style="flex:1" data-act="ob-finish" data-v="mind" ${r&&r.kind!=='No'&&r.kind!=='Support'?'':'disabled'}>${obLabel(r)}</button></div>
    <div class="btns" style="margin-top:4px"><button class="link" data-act="ob-finish" data-v="skip">Skip for now</button></div>
    <p class="meta">INSANE sorts it with simple rules on your phone; nobody reads it unless you send it. Needs become pacts, wants become plans (with a pot if money’s involved), urges become a ladder, a dare or a Midnight message.</p>`;
  }
  obSave();
  return `<div style="padding-top:18px"><span class="mark">INSANE</span>${steps}${body}</div>`;
}
const obLabel=r=>!r?'Start':r.kind==='Pact'||r.kind==='Ladder'?'Start the '+r.kind.toLowerCase():r.kind==='Midnight'?'Save it for Midnight':r.kind==='Dare'?'Take the dare':r.kind.startsWith('Plan')?'Make it a plan':'Start';
async function finishOnboarding(mode){
  const o=S.ui.ob,st=lpState('home');if(S.deep&&S.deep.kind==='c')S.deep=null;
  await lpReady(st);const f=homeFields(st);const how=o.how||'skip';const withMind=mode!=='skip'&&(o.mind||'').trim();
  const ok=await W(async()=>{
    await S.db.doc('people/'+S.uid).set(Object.assign({name:o.name.trim().slice(0,24),handle:(o.handle||'').trim().toUpperCase().slice(0,16)||null,circle:null,joined:now(),seen:now(),quiet:{from:23,to:8},tz:tzName()},f,consentFields()));
    if(st.prec==='exact')await S.db.doc(`data/users/${S.uid}/loc`).set({lat:+st.lat.toFixed(6),lon:+st.lon.toFixed(6),src:st.src,acc:st.acc||null,at:now()});
    if(withMind)await addJourney(o.lane||'need',o.mind,STAKES[o.stake||0]);
    await S.db.doc(`data/users/${S.uid}/age`).set({adult:true,min:ageMin(ageCountry()),at:o.ageAt||now()}); // C17: the attestation only, never the date of birth
  });
  if(!ok)return;
  mark('named');mark('city');if(withMind)mark('nwu');
  S.me=Object.assign({name:o.name.trim(),circle:null},f);
  if(how==='create')await createCircle(o.cname.trim());
  else if(how==='join')await joinCircle(o.code.trim().toUpperCase());
  obClear();tourBegin();
  S.ui.tab='today';render();scrollTo(0,0);
}
async function createCircle(name){
  const cid=rnd(10);let code='';
  for(let i=0;i<5;i++){code=rnd(6,CODEA);const s=await S.db.doc('codes/'+code).get();if(!s.exists)break}
  const ok=await W(async()=>{
    await S.db.doc('circles/'+cid).set({name:name.slice(0,28),code,city:S.me.city,members:[S.uid],createdAt:now(),by:S.uid});
    await S.db.doc('codes/'+code).set({cid,at:now()});
    await S.db.doc(`circles/${cid}/threads/general`).set({kind:'talk',title:'General',by:S.uid,at:now(),muted:true});
    await S.db.doc('people/'+S.uid).update({circle:cid});
  },'Circle started. Send your friends the code '+code);
  if(ok){mark('circle');logMine('Started '+name);pushProgress()}
}
async function joinCircle(code){
  const s=await S.db.doc('codes/'+code).get().catch(()=>null);
  if(!s||!s.exists){toast('No circle has the code '+code+'. Check it with whoever sent it.');return}
  const cid=s.data().cid;const c=await S.db.doc('circles/'+cid).get();
  if(!c.exists){toast('That circle has closed.');return}
  const cd=c.data();const mem=(await S.db.collection('people').where('circle','==',cid).get()).size;
  if(mem>=8){toast(cd.name+' is full. Circles stop at 8.');return}
  const ok=await W(async()=>{
    await S.db.doc('people/'+S.uid).update({circle:cid});
    await S.db.doc('circles/'+cid).update({members:[...new Set([...(cd.members||[]),S.uid])]});
  },'You’re in '+cd.name+'.');
  if(ok){mark('circle');logMine('Joined '+cd.name);setTimeout(pushProgress,400)}
}


/* ---------- v0.9 onboarding pieces (WS-B) ---------- */
// C17: age from month and year of birth. India: 18+ (DPDP Act: a child is under 18 and needs verifiable
// parental consent, which INSANE can't do yet). Elsewhere: 16+. Without the day we're conservative: you
// count as N from the first day of the month after your Nth birthday month.
function ageCountry(){try{const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';if(/^Asia\/(Kolkata|Calcutta)$/.test(tz))return 'IN';if(/-IN$/i.test(navigator.language||''))return 'IN'}catch(e){}return 'XX'}
const ageMin=cc=>cc==='IN'?18:16;
const adultFrom=(m,y,min)=>new Date(y+min,m,1).getTime(); // m is 1–12, so month index m is the month after
function ageOK(dob,cc,t){if(!dob)return null;const m=+dob.m,y=+dob.y;if(!(m>=1&&m<=12)||!(y>=1900&&y<=9999))return null;return t>=adultFrom(m,y,ageMin(cc))}
function ageCheck(o){if(o.age&&!o.dobY)return true;return ageOK({m:o.dobM,y:o.dobY},ageCountry(),now())}
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function ageBlock(o,ag){const cc=ageCountry(),min=ageMin(cc),yr=new Date(now()).getFullYear();
  if(o.age&&!o.dobY)return `<div class="agerow ok"><span>✓ You confirmed you’re ${min} or over.</span><button class="link" data-act="ob-age-redo">Change</button></div>`;
  return `<fieldset class="dob"><legend class="f">When were you born? <small>month and year, never shown to anyone</small></legend><div class="row2">
  <select class="in-t" id="ob-dobm" data-ob="dobM" aria-label="Birth month"><option value="">Month</option>${MONTHS.map((m,i)=>`<option value="${i+1}" ${+o.dobM===i+1?'selected':''}>${m}</option>`).join('')}</select>
  <select class="in-t" id="ob-doby" data-ob="dobY" aria-label="Birth year"><option value="">Year</option>${Array.from({length:91},(_,i)=>yr-10-i).map(y=>`<option value="${y}" ${+o.dobY===y?'selected':''}>${y}</option>`).join('')}</select></div>
  ${ag===false?`<div class="card under" role="alert"><p><b>INSANE is for ${min} and over${cc==='IN'?' in India':''}.</b> ${cc==='IN'?'India’s data law (DPDP) needs a parent’s verified consent for anyone under 18, and we can’t do that properly yet.':'It’s built for meeting people in real places, so it isn’t for under-16s.'} Nothing you typed has been saved.</p></div>`:''}</fieldset>`}
// What's stopping Next on step 1, in words (C17: never a grey button with no reason).
function obWhy(o,ag){if(!(o.name||'').trim())return 'Add your name to go on.';if(ag==null)return 'Add the month and year you were born.';if(ag===false)return 'You need to be '+ageMin(ageCountry())+' or over to use INSANE.';if(!o.consent)return 'Agree to the Terms to go on.';return ''} // the consent line is WS-D's (C63)
// C24: examples people here would actually say, and the result as one chip in plain type.
const OB_EX_IN={need:['walk 30 minutes every day','call home every Sunday','be in bed by 12 every night','read 10 pages a day'],want:['go to Pondicherry in December','learn to cook one proper dish','see a gig every month','save ₹5000 for a bike'],urge:['sing karaoke in public','tell someone how I feel','try a street food I’ve never had','pull a harmless prank']};
const obEx=lane=>ageCountry()==='IN'?OB_EX_IN[lane]:LANES[lane].ex;
function obChip(r,o){if(!r||r.kind==='No'||r.kind==='Support')return '';const pk=r.kind==='Pact'||r.kind==='Ladder';return `<span class="chip on">${esc(r.kind)}</span> <span>${esc(r.what)}${r.how?' · '+esc(r.how):''}${pk?' · if I miss: '+esc(STAKES[o.stake||0].replace(/^./,c=>c.toLowerCase())):''}</span>`}
// C16: the draft survives a reload or the OS killing the tab. Name, handle, step and words go to
// localStorage and sessionStorage; the place (it can be an exact pin) to sessionStorage only. No birth date is kept.
const OB_KEYS=['step','name','handle','age','ageAt','lane','mind','stake','cname','code','how','own'];
const LOC_KEYS=['lat','lon','src','label','prec','s','r','area','home','zoom','acc'];
const obKey=()=>'insane_ob_'+(S.uid||'anon');
let obRestored=null;
function obSave(){if(!S.uid||S.me!==null)return;const o=S.ui.ob,d={};for(const k of OB_KEYS)if(o[k]!=null)d[k]=o[k];const j=JSON.stringify(d);
  try{localStorage.setItem(obKey(),j)}catch(e){}try{sessionStorage.setItem(obKey(),j);const l=S.ui.loc;if(l&&l.lat!=null){const x={};for(const k of LOC_KEYS)if(l[k]!=null)x[k]=l[k];sessionStorage.setItem(obKey()+'_loc',JSON.stringify(x))}}catch(e){}}
function obRestore(){if(obRestored===S.uid||!S.uid)return;obRestored=S.uid;let d=null,l=null;
  try{d=JSON.parse(sessionStorage.getItem(obKey())||localStorage.getItem(obKey())||'null')}catch(e){}
  try{l=JSON.parse(sessionStorage.getItem(obKey()+'_loc')||'null')}catch(e){}
  if(!d||typeof d!=='object')return;const o=S.ui.ob;for(const k of OB_KEYS)if(d[k]!=null)o[k]=d[k];
  if(l&&typeof l==='object'&&l.lat!=null){const st=lpState('home');for(const k of LOC_KEYS)if(l[k]!=null)st[k]=l[k];st.v=(st.v||0)+1}
  o.step=Math.max(0,Math.min(3,o.step|0));if(o.step>0&&!(o.name||'').trim()||o.step>0&&!o.age)o.step=0;else if(o.step>1&&lpState('home').lat==null)o.step=1;
  if(o.step>0){S.ui.wel='done'}}
function obClear(){try{localStorage.removeItem(obKey());sessionStorage.removeItem(obKey());sessionStorage.removeItem(obKey()+'_loc')}catch(e){}}
ACT_B['ob-shuffle']=async()=>{const o=S.ui.ob;const pool=HANDLES.filter(h=>h!==o.handle);o.handle=pool[crypto.getRandomValues(new Uint8Array(1))[0]%pool.length];render()};
ACT_B['ob-own']=async()=>{S.ui.ob.own=true;render()};
ACT_B['ob-age-redo']=async()=>{const o=S.ui.ob;o.age=false;o.ageAt=null;render()};
document.addEventListener('input',e=>{const el=e.target;if(!el.dataset||!el.dataset.ob)return;const o=S.ui.ob,k=el.dataset.ob;
  if(k==='dobM'||k==='dobY'){o[k]=el.value;const ok=ageOK({m:o.dobM,y:o.dobY},ageCountry(),now())===true;if(ok&&!o.age)o.ageAt=now();o.age=ok;render();return}
  if(k==='name'||k==='cname'){const n=document.getElementById('ob-'+k+'-n');if(n)n.textContent=[...el.value].length+'/'+(k==='name'?24:28)}
  if(k==='handle'){const p=document.getElementById('ob-hprev');if(p)p.textContent=el.value.toUpperCase()||'YOUR HANDLE'}
  if(k==='mind'){o.mind=el.value;const c=document.getElementById('ob-chip');if(c)c.innerHTML=obChip(readUrge(o.lane||'need',el.value),o)}
  o[k]=el.type==='checkbox'?el.checked:el.value;
  if(o.step===0){const w=document.getElementById('ob-why');if(w)w.textContent=obWhy(o,ageCheck(o))}
  obSave()});
