/* ---------- onboarding ---------- */
function onboarding(){
  const o=S.ui.ob,st=o.step;
  const steps=`<div class="steps" aria-label="Step ${st+1} of 4">${[0,1,2,3].map(i=>`<i class="${i<=st?'on':''}"></i>`).join('')}</div>`;
  if(S.deep&&S.deep.kind==='c'&&o.invFor!==S.deep.code){o.invFor=S.deep.code;o.code=S.deep.code;S.db.doc('codes/'+S.deep.code).get().then(x=>x.exists?S.db.doc('circles/'+x.data().cid).get():null).then(c=>{if(c&&c.exists){o.invName=c.data().name;render()}}).catch(()=>{})}
  let body='';
  if(st===0){
    if(o.name==null)o.name=(S.realName||'').split(' ')[0]||'';
    if(o.handle==null)o.handle=HANDLES[fnvN(S.uid||'x')%HANDLES.length];
    const hs=[...new Set([o.handle,...HANDLES])].filter(Boolean).slice(0,6);
    body=`${o.invName?`<div class="card stamp" style="margin-top:18px"><div class="meta">INVITE</div><p><b>${esc(o.invName)} brought you in.</b> You’ll join them in step 3.</p></div>`:''}
    <h1 class="v">Make plans, take dares, trade favours. With your five.</h1>
    <p class="lede">${S.backend==='claude'?`You’re signed in through Claude${S.realName?` as <b>${esc(S.realName)}</b>`:''}.`:S.backend==='server'?`You’re signed in as <b>${esc(S.email||'')}</b>.`:'This is the demo on this device.'}</p>
    <div class="card"><p style="margin:0"><b>What it’s for</b></p><ul class="rl"><li>Plans, pots and favors with the people you live and hang out with</li><li>Pacts: the things you keep saying you’ll do, with your circle checking in</li><li>The stupid stuff you’d never do alone: dares, Midnight, the Mole, Missions</li></ul></div>
    <label class="f" for="ob-name">Your name <small>your circle sees this</small></label><input class="in-t" id="ob-name" data-ob="name" maxlength="24" value="${esc(o.name)}" placeholder="Maya" autocomplete="nickname">
    <label class="f" for="ob-handle">Your handle <small>what the rest of the city sees</small></label><div class="chips">${hs.map(h=>`<button class="chip ${o.handle===h?'on':''}" data-act="ob-handle" data-v="${esc(h)}">${esc(h)}</button>`).join('')}</div>
    <input class="in-t" id="ob-handle" data-ob="handle" maxlength="16" value="${esc(o.handle)}" style="margin-top:6px;text-transform:uppercase;font-family:var(--f-mono);letter-spacing:.08em" aria-label="Or type your own handle">
    <label class="chk"><input type="checkbox" id="ob-age" data-ob="age" ${o.age?'checked':''}> <span>I’m 16 or over. INSANE is built for meeting people in real places, so it isn’t for under-16s.</span></label>
    ${consentRow(o)}
    <div class="btns"><button class="btn wide" data-act="ob-next" ${obReady(o)?'':'disabled'}>Next</button></div><p class="meta" id="ob-why" role="status">${esc(obMissing(o))}</p>`;
  }else if(st===1){
    body=`<h1 class="v">Where’s home?</h1><p class="lede">Anywhere on Earth. You choose how exact: a private pin, or just a square of 1 to 9 km².</p>${picker('home')}
    <div class="btns"><button class="btn ghost" data-act="ob-back">Back</button><button class="btn" style="flex:1" data-act="ob-next" ${lpState('home').lat!=null?'':'disabled'}>Next</button></div>`;
  }else if(st===2){
    body=`<h1 class="v">${o.invName?esc(o.invName):'Your circle'}</h1><p class="lede">Up to 8 people you actually see. Next time you’re in the same room, <b>scan each other’s phones</b>: that proves you’re real people who’ve met, which a bot farm can’t fake, and it unlocks posting in the City.</p>
    <div class="stack">
      <div class="card ${o.invName?'':'hot'}"><h3>Start a circle</h3><label class="f" for="ob-cname">Circle name</label><input class="in-t" id="ob-cname" data-ob="cname" maxlength="28" value="${esc(o.cname||'')}" placeholder="Third Floor"><div class="btns"><button class="btn ${o.invName?'ghost':''}" data-act="ob-circle" data-v="create" ${(o.cname||'').trim()?'':'disabled'}>Start it</button></div></div>
      <div class="card ${o.invName?'hot':''}"><h3>Join with a code</h3><label class="f" for="ob-code">6-letter code</label><input class="in-t" id="ob-code" data-ob="code" maxlength="6" value="${esc(o.code||'')}" placeholder="K7QF2M" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:.2em;font-family:var(--f-mono)"><div class="btns"><button class="btn" data-act="ob-circle" data-v="join" ${(o.code||'').trim().length===6?'':'disabled'}>Join</button></div></div>
    </div>
    <div class="btns"><button class="btn ghost" data-act="ob-back">Back</button><button class="link" data-act="ob-circle" data-v="skip" style="margin-left:auto">Look around first</button></div>`;
  }else{
    const lane=o.lane||'need',L=LANES[lane],r=readUrge(lane,o.mind),pk=r&&(r.kind==='Pact'||r.kind==='Ladder');
    body=`<h1 class="v">What’s on your mind?</h1><p class="lede">Say it the way you’d say it to a friend. Your circle sees progress, never these words.</p>
    <div class="seg" role="tablist" style="margin-top:0">${['need','want','urge'].map(k=>`<button role="tab" data-act="ob-lane" data-v="${k}" class="${lane===k?'on':''}" aria-selected="${lane===k}">${LANES[k].k}</button>`).join('')}</div>
    <label class="f" for="ob-mind">${esc(L.lead)} <small>${esc(L.hz)}</small></label><input class="in-t" id="ob-mind" data-ob="mind" data-read="mind" value="${esc(o.mind||'')}" placeholder="${esc(L.ph)}" maxlength="90" autocomplete="off">
    <div class="ex">${L.ex.map(e=>`<button data-act="ob-ex" data-k="mind" data-v="${esc(e)}">${esc(e)}</button>`).join('')}</div>
    <div id="read-mind">${readCard(r)}</div>
    <div id="ob-stake" ${pk?'':'hidden'}><label class="f">If I miss</label><div class="chips">${STAKES.map((x,i)=>`<button class="chip ${(o.stake||0)===i?'on':''}" data-act="ob-stake" data-v="${i}">${esc(x)}</button>`).join('')}</div></div>
    <div class="btns"><button class="btn ghost" data-act="ob-back">Back</button><button class="btn" style="flex:1" data-act="ob-finish" data-v="mind" ${r&&r.kind!=='No'&&r.kind!=='Support'?'':'disabled'}>${obLabel(r)}</button></div>
    <div class="btns" style="margin-top:4px"><button class="link" data-act="ob-finish" data-v="skip">Skip for now</button></div>
    <p class="meta">INSANE sorts it with simple rules on your phone; nobody reads it unless you send it. Needs become pacts, wants become plans (with a pot if money’s involved), urges become a ladder, a dare or a Midnight message.</p>`;
  }
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
  });
  if(!ok)return;
  mark('named');mark('city');if(withMind)mark('nwu');
  S.me=Object.assign({name:o.name.trim(),circle:null},f);
  if(how==='create')await createCircle(o.cname.trim());
  else if(how==='join')await joinCircle(o.code.trim().toUpperCase());
  S.ui.tab='today';render();
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

