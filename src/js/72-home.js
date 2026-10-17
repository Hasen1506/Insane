/* ---------- Today ---------- */
// C29/C30: Home is one ordered list (HOME_ORDER). The lede counts the rows that need you, from the same list
// that is drawn (P21), and nothing that needs you sits below the daily dare, the Decode or circle news.
const HOME_ORDER=['note','invite','needs','own','dare','decode','news','drops','end'];
function homeItems(){
  const me=S.me,calm=calmNow(),out=[],add=(k,html,n)=>{if(html)out.push({k,html,n:!!n})};
  const act=journeys().filter(j=>j.status==='active');
  const due=act.filter(j=>!(j.read.kind==='Pact'&&(j.ticks||[]).includes(today())));
  const dd=me.circle?dailyDare():null,ddDone=dd&&(S.daily.done||{})[S.uid];
  if(quietNow())add('note',`<div class="card dash"><p class="meta">Quiet hours until ${String(me.quiet?.to??8).padStart(2,'0')}:00. No badges, no notifications. Everything waits for the morning.</p></div>`);
  if(F.darkSet)add('note',darkSetup());
  if(me.darkFrom>now()&&me.darkUntil>now())add('note',nc('Going dark','','',`<p>INSANE goes dark <b>${esc(when(me.darkFrom))}</b> for ${esc(me.darkH)} h.</p>`,`<button class="btn s ghost" data-act="dark-unplan">Cancel it</button>`));
  if(!me.circle)add('invite',`<div class="card stamp"><h3>Start a circle, or join one</h3><p>Most of INSANE happens with the people you actually see.</p><div class="btns"><button class="btn" data-act="sheet" data-v="circle-start">Start or join</button></div></div>`);
  else if(S.circle&&S.members.length&&S.members.length<3)add('invite',inviteCard(S.circle)); // C27: until there are 3 of you
  for(const h of needsYou())add('needs',h,1);
  for(const j of (calm?due.slice(0,2):due.slice(0,3)))add('own',jCard(j,true),1);
  if(!act.length)add('own',`<div class="card dash"><h3>Nothing on the go</h3><p class="meta">Add a need, want or urge and it shows up here.</p><div class="btns"><button class="btn s ghost" data-act="sheet" data-v="add-j">Add one</button></div></div>`);
  if(dd&&(!ddDone||!calm))add('dare',dareCard(dd),!ddDone);
  const solvedMine=S.solves.some(s=>s.uid===S.uid);
  if(!solvedMine||!calm)add('decode',decodeCard(true));
  const un=unreadThreads();
  if(un.length)add('news',`<div class="card hot"><div class="meta">New in your circle</div>${un.slice(0,3).map(u=>`<button class="thr" style="border:0;padding:6px 0;background:none" data-act="open" data-type="${u.type}" data-v="${esc(u.id)}"><span class="av">${initials(u.last.name)}</span><span class="grow"><b>${esc(u.title)}</b><span class="last">${esc(bidi(u.last.name))}: ${esc(u.last.text)}</span></span><span class="un"></span></button>`).join('')}</div>`);
  if(me.circle)for(const h of circleCards())add('news',h);
  const nd=nearDrops().filter(x=>x.end>now()).sort((a,b)=>a.start-b.start)[0];
  if(nd)add('drops',dropRow(nd));
  else if(!calm)add('drops',`<p class="meta drops0">No drops within ${me.radius||5} km · <button class="link" data-act="sheet" data-v="host">Host one</button></p>`); // C32: one line, not a disabled-looking card
  const soon=S.sealed.filter(x=>x.openAt>now()).sort((a,b)=>a.openAt-b.openAt)[0];
  if(soon&&!calm)add('end',`<div class="card" style="background:var(--ink);color:var(--paper);border-color:var(--ink)"><div class="meta" style="color:inherit;opacity:.7">Sealed by ${esc(nameOf(soon.by))}</div><h3>Opens ${esc(when(soon.openAt))}</h3><p style="opacity:.8">Nobody can read it before then.</p></div>`);
  add('end',recap());
  if(!out.some(i=>i.n)&&!un.length&&(solvedMine||decodeState(S.solves).revealed))add('end',`<div class="card caught"><svg viewBox="0 0 120 44" aria-hidden="true"><path d="M0 38h120" stroke="currentColor" stroke-width="1.5"/><circle cx="60" cy="38" r="16" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M60 12v-8M38 20l-6-5M82 20l6-5" stroke="currentColor" stroke-width="1.5"/></svg><h3>You’re all caught up</h3><p class="meta">That’s everything for today. Nothing else is waiting in here. Go outside, or <button class="link" data-act="dark-setup">go dark</button> for a bit.</p></div>`);
  return out;
}
function vToday(){
  const me=S.me,it=homeItems(),n=it.filter(i=>i.n).length,hn=hereNow().length;let out='',g='';
  for(const i of it){const e=i.k==='needs'?'Needs you':i.k==='news'?'In '+esc(bidi(S.circle?.name||'your circle')):'',k=e||'-';if(k!==g){out+=(g?'</div>':'')+(e?`<div class="eyebrow">${e}</div>`:'')+'<div class="stack">';g=k}out+=i.html}
  return `<h1 class="v">${new Date(now()).toLocaleDateString([],{weekday:'long'})}</h1><p class="lede">${n?`<b style="color:var(--ink)">${n} thing${n>1?'s need':' needs'} you</b>`:'All done for today'} · ${esc(me.cityName)}${hn?` · <span class="herenow">${hn} of your circle here now</span>`:''}</p>${out}${g?'</div>':''}<p class="formula">One list. Whatever needs you today is here; everything else waits in Circle, City and Ledger.</p>`;
}
function recap(){
  const d=new Date();if(d.getDay()!==0&&d.getDay()!==1)return '';
  const since=now()-7*DAY,items=(S.priv.log?.items||[]).filter(i=>i.at>since);if(items.length<3)return '';
  const c=re=>items.filter(i=>re.test(i.t)).length;
  const bits=[[c(/^Ticked|^Climbed|for /),'ticks'],[c(/^Said yes|^Started a plan|^Pledged/),'plans joined'],[c(/^Met /),'people met'],[c(/^Turned up/),'drops'],[c(/^Solved/),'Decode solved']].filter(b=>b[0]);
  return `<div class="card recap"><div class="meta">Your week</div><div class="rcp">${bits.map(([n,l])=>`<span><b>${n}</b>${l}</span>`).join('')}</div><p class="meta">From your private timeline. Only you see this.</p></div>`;
}
function jCard(j,compact){
  const k=j.read.kind,c=jCount(j),g=jGoal(j);let body='',btn='';
  const ring=`<svg class="ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--cell)" stroke-width="4"/> ${c?`<circle cx="18" cy="18" r="15" fill="none" stroke="${c>=g?'var(--good)':'var(--ink)'}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${(Math.min(1,g?c/g:0)*94.2).toFixed(1)} 94.2" transform="rotate(-90 18 18)"/>`:''}<text x="18" y="22" text-anchor="middle" font-size="11" font-weight="700" fill="var(--ink)">${c}/${g}</text></svg>`;
  if(k==='Pact'){const done=(j.ticks||[]).includes(today());const st=streak(j);body=`<div class="meta">${c} of ${g} this week · ${esc(j.read.how)}${st>0?` · <b class="streak">${st}-week streak</b>`:''}</div>${weekStrip(j)}`;btn=done?`<button class="btn s ghost" data-act="untick" data-v="${j.id}">Done today ✓ (undo)</button>`:`<button class="btn s" data-act="tick" data-v="${j.id}">Done today</button>`}
  else if(k==='Ladder'){body=`<div class="meta">Rung ${c} of ${g}</div><div class="bar"><i style="width:${c/g*100}%"></i></div>${j.rungsText&&j.rungsText[c]?`<p class="meta">Next: ${esc(j.rungsText[c])}</p>`:''}`;btn=c<g?`<button class="btn s" data-act="rung" data-v="${j.id}">Climbed rung ${c+1}</button>`:''}
  else if(k==='Plan'||k==='Plan + pot'){const steps=j.steps||[];const nx=steps.find(s=>!s.done);body=`<div class="meta">${c} of ${g} steps${nx?' · next: '+esc(nx.t):''}</div><div class="bar"><i style="width:${g?c/g*100:0}%"></i></div>`;btn=nx?`<button class="btn s" data-act="step" data-v="${j.id}">Done: ${esc(nx.t)}</button>`:'';if(S.me.circle&&!j.thread)btn+=`<button class="btn s ghost" data-act="j-plan" data-v="${j.id}">Make it a circle ${k==='Plan + pot'?'pot':'plan'}</button>`}
  else if(k==='Midnight'){body=`<div class="meta">Say it unsigned at midnight, or sealed with your name.</div>`;btn=S.me.circle?`<button class="btn s" data-act="sheet" data-v="midnight">Write it</button>`:''}
  else{body=`<div class="meta">${esc(j.read.how)} · ${esc(j.read.note)}</div>`;btn=`<button class="btn s" data-act="j-done" data-v="${j.id}">Done it</button>`}
  const ch=(k==='Pact'||k==='Ladder')?cheersFor(S.uid,jLabel(j)).map(c=>nameOf(c.from)):[];
  if(j.stake&&(k==='Pact'||k==='Ladder'))body+=`<p class="meta">If you miss: ${esc(j.stake.toLowerCase())}</p>`;
  if(ch.length)body+=`<p class="meta" style="color:var(--good)">Cheered by ${esc(ch.join(', '))}</p>`;
  if(k==='Midnight')btn=S.me.circle?`<button class="btn s" data-act="cseg-go" data-v="midnight">Write it</button>`:'';
  return `<div class="card"><div class="row"><span class="grow"><span class="tag ${j.lane}">${LANES[j.lane].k}</span><span class="meta">${esc(k)}</span><h3 style="margin-top:3px">${esc(j.read.what)}</h3></span>${k!=='Midnight'?ring:''}</div>${body}<div class="btns">${btn}${compact?'':`<button class="btn s ghost" data-act="j-menu" data-v="${j.id}">More</button>`}</div></div>`;
}
// Weeks in a row the pact hit its goal: last week backwards, plus this week once it's hit.
function streak(j){const set=new Set(j.ticks||[]),g=j.read.goal||3;const wk=w=>{let n=0;for(let i=0;i<7;i++)if(set.has(ymd(w+i*DAY+12*HOUR)))n++;return n};let s=0,w=weekStart()-7*DAY;while(w>=weekStart(j.created)&&wk(w)>=g){s++;w-=7*DAY}if(wk(weekStart())>=g)s++;return s}
// C40: this week as M T W T F S S, ticked days filled and today outlined; the goal and what's left in words
function weekStrip(j){const set=new Set(j.ticks||[]),ws=weekStart(),g=jGoal(j),c=jCount(j);let h='';for(let i=0;i<7;i++){const d=ymd(ws+i*DAY+12*HOUR);h+=`<i class="${set.has(d)?'y':''}${d===today()?' t':''}">${'MTWTFSS'[i]}</i>`}
  return `<div class="days wk" role="img" aria-label="This week: ${c} of ${g} days done" title="Any ${g} days by Sunday. The other days are free misses.">${h}</div><p class="meta">${c>=g?'Done for this week.':`${g-c} more by Sunday. ${7-g} days are free misses.`}</p>`}

/* ---------- Home ---------- */
function needsYou(){
  if(!S.me.circle)return [];const u=S.uid,out=[],t=now();
  for(const d of S.dares)if(d.to===u&&(!d.status||d.status==='open'||d.status==='accepted'))
    out.push(nc(`${esc(nameOf(d.by))} dared you · bold ${d.level}/6`,'z',esc(ago(d.at)),`<p><b>${esc(d.text)}</b></p>`,(d.status==='accepted'?`<button class="btn s red" data-act="sheet" data-v="proof" data-id="${d.id}">I did it</button>`:`<button class="btn s red" data-act="dare-accept" data-v="${d.id}">Accept</button><button class="btn s ghost" data-act="dare-decline" data-v="${d.id}">Not this one</button>`)+flagBtn(d.id),'stamp'));
  for(const f of S.favors){
    if(f.status==='done'&&f.asker===u)out.push(nc('Favor done for you','l',hrs(f.h).slice(1),`<p><b>${esc(nameOf(f.doer))}</b> did “${esc(f.what)}”. Confirm and it’s logged: ${hrs(f.h).slice(1)} to them, ${hrs(-f.h)} to you.</p>`,`<button class="btn s" data-act="fv-confirm" data-v="${f.id}">Confirm</button>`));
    else if(f.status==='claimed'&&f.doer===u)out.push(nc('You said you’d help','l',esc(nameOf(f.asker)),`<p>${esc(f.what)}</p>`,`<button class="btn s" data-act="fv-done" data-v="${f.id}">Done it</button>`));
    else if(f.status==='open'&&f.asker!==u&&f.at>t-7*DAY)out.push(nc(`${esc(nameOf(f.asker))} asks a favor`,'l','about '+hrs(f.h).slice(1),`<p>${esc(f.what)}</p>`,`<button class="btn s" data-act="fv-claim" data-v="${f.id}">I’ll do it</button>`));
  }
  for(const p of pots()){if(p.closed)continue;const st=potState(p,u);
    if(!potOn(p)&&!(p.pledges||{})[u])out.push(nc(`Pledge pot · ${esc(nameOf(p.by))}`,'l',`${nIn(p)}/${p.min}`,`<p><b>${esc(p.title)}</b>, ${esc(amt(p))} each. Nobody pays unless ${esc(p.min)} pledge${p.by_when?' by '+esc(p.by_when):''}.</p>`,`<button class="btn s" data-act="pot-go" data-v="${p.id}">See the pot</button>`));
    else if(st==='to pay')out.push(nc('Pot · time to pay','d',esc(amt(p)),`<p><b>${esc(p.title)}</b>: pay ${esc(nameOf(p.by))} directly.</p>`,`<button class="btn s" data-act="pot-go" data-v="${p.id}">Pay</button>`));
    if(p.by===u){const w=Object.entries(p.paid||{}).filter(([,v])=>v==='wait').map(([x])=>nameOf(x));if(w.length)out.push(nc('Pot · did it land?','d',esc(p.title),`<p>${esc(w.join(', '))} marked as paid. Check it arrived, then confirm.</p>`,`<button class="btn s" data-act="pot-go" data-v="${p.id}">Check</button>`))}}
  for(const p of plans())if((p.going||{})[u]===undefined&&p.at>t-7*DAY&&p.by!==u)
    out.push(nc(`Plan · ${esc(p.when||'date to pick')}`,'l',Object.values(p.going||{}).filter(Boolean).length+' going',`<p><b>${esc(p.title)}</b>${p.where?' · '+esc(p.where):''}</p>`,`<button class="btn s" data-act="rsvp" data-v="${p.id}" data-x="y">I’m in</button><button class="btn s ghost" data-act="rsvp" data-v="${p.id}" data-x="n">Can’t</button>`));
  if(S.mole&&!S.mole.revealed&&!myMole()&&t>=weekStart()+5*DAY&&!S.votes.some(v=>v.week===weekKey()&&v.by===u))
    out.push(nc('The Mole · vote','mk','reveal '+esc(when(moleReveal())),'<p>Someone has been the Mole all week. Who?</p>',`<button class="btn s" data-act="cseg-go" data-v="mole">Vote</button>`,'mole'));
  if(verified())for(const m of S.missions)if(m.cid!==S.me.circle&&m.when>t&&!(m.confirms||{})[S.me.circle])
    out.push(nc(`Mission proposed by ${esc(bidi(m.cname))}`,'m',esc(when(m.when)),`<p><b>${esc(m.title)}</b>. It goes ahead when three other circles confirm.</p>`,`<button class="btn s" data-act="sheet" data-v="mission" data-id="${m.id}">Look at it</button>`));
  return out;
}
function dareCard(dd){const done=(S.daily.done||{});const mine=done[S.uid];const n=Object.keys(done).length;
  return `<div class="dd"><div class="k">DAILY DARE · ${dd.starter?'FROM THE STARTER JAR':'BY '+esc(nameOf(dd.by).toUpperCase())} · BOLD ${esc(dd.level)}/6</div><div class="q">${esc(dd.text)}</div>
  ${mine?`<span class="meta">Done${mine.note?': “'+esc(mine.note)+'”':''} · ${n} of ${S.members.length} today</span>`:`<button class="btn s" data-act="sheet" data-v="proof" data-id="daily">I did it</button>`}
  <button class="btn s ghost" data-act="sheet" data-v="dare">${n&&!mine?n+' did it · ':''}Add to the jar</button>${mine?'':flagBtn('daily')}</div>`}
function circleCards(){
  const t=now(),u=S.uid,out=[];
  const rel=S.midnight.filter(m=>m.releaseAt<=t&&m.releaseAt>t-DAY&&!m.removed&&(m.flags||[]).length<2).length,pend=S.midnight.filter(m=>m.releaseAt>t).length;
  if(rel||pend)out.push(`<div class="card mn"><div class="km"><span class="kind mnk">Midnight</span><span class="meta">${pend?pend+' waiting for tonight':''}</span></div><p>${rel?rel+' new from last night, unsigned.':'Nothing out yet tonight.'}</p><div class="btns"><button class="btn s" style="background:#ECEEE7;color:#151D36;border-color:#ECEEE7" data-act="cseg-go" data-v="midnight">Read</button></div></div>`);
  const mm=myMole();
  if(mm)out.push(nc('The Mole · only you see this','mk',moleDone(mm)+'/3 tasks',`<p>You’re the Mole this week. Reveal ${esc(when(moleReveal()))}.</p>`,`<button class="btn s ghost" data-act="cseg-go" data-v="mole">Tasks</button>`,'mole'));
  else if(S.mole&&!S.mole.revealed)out.push(nc('The Mole','mk','reveal '+esc(when(moleReveal())),`<p>Someone in ${esc(bidi(S.circle?.name||'the circle'))} is the Mole this week.</p>`,`<button class="btn s ghost" data-act="cseg-go" data-v="mole">Who?</button>`,'mole'));
  else if(!S.mole&&S.members.length>=4&&!calmNow())out.push(nc('The Mole','mk','',`<p>Nobody’s the Mole this week. Three secret tasks, and Sunday’s vote.</p>`,`<button class="btn s ghost" data-act="cseg-go" data-v="mole">Be the Mole</button>`,'mole'));
  for(const m of S.members)if(m.id!==u&&m.darkFrom>t&&m.darkUntil>t)out.push(nc('Going dark','',`${esc(m.darkH||'')} h`,`<p><b>${esc(bidi(m.name))}</b> goes dark ${esc(when(m.darkFrom))} for ${esc(m.darkH)} h.</p>`,S.me.darkUntil>t?'':`<button class="btn s ghost" data-act="dark-join" data-v="${m.id}">Join them</button>`));
  return out;
}
function darkSetup(){const h=F.darkH||3,st=F.darkAt||0;const starts=darkStarts();
  return `<div class="card hot"><div class="km"><span class="kind">Go dark</span><button class="link" data-act="dark-cancel">cancel</button></div>
  <label class="f">How long</label><div class="chips">${[1,3,6,12,24].map(x=>`<button class="chip ${h===x?'on':''}" data-act="darkH" data-v="${x}">${x} h</button>`).join('')}</div>
  <label class="f">Starting</label><div class="chips">${starts.map(([n],i)=>`<button class="chip ${st===i?'on':''}" data-act="dark-at" data-v="${i}">${n}</button>`).join('')}</div>
  ${S.me.circle?`<label class="chk"><input type="checkbox" id="dark-with" data-f="darkWith" ${F.darkWith?'checked':''}> <span><b>With the circle.</b> They get one message with your start time and a Join button.</span></label>`:''}
  <p class="meta">INSANE goes blank with a countdown and holds every notification. A web app can’t switch off other apps, so for the rest of the phone set a Focus (iPhone: Settings → Focus) or Digital Wellbeing’s Focus mode (Android) for the same hours. Calls always work.</p>
  <div class="btns"><button class="btn" data-act="dark-go">Go dark ${st?'at '+esc(starts[st][0].toLowerCase()):'now'} for ${h} h</button></div></div>`}
function darkStarts(){const t=now(),d0=dayStart(t);const eve=d0+19*HOUR,tm=d0+DAY+10*HOUR;const sun=weekStart(t)+6*DAY+10*HOUR;
  const o=[['Now',t]];if(eve>t+10*MIN)o.push(['Tonight 19:00',eve]);o.push(['Tomorrow 10:00',tm]);if(sun>tm)o.push(['Sunday 10:00',sun]);return o}

