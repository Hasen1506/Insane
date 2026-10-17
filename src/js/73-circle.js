/* ---------- Circle ---------- */
function vCircle(){
  const c=S.circle;
  if(!S.me.circle||!c)return `<h1 class="v">No circle yet</h1><p class="lede">A circle is up to 8 people you actually see. Threads, plans, pots and Midnight all happen inside it.</p>${circleStartForm()}`;
  const seen=S.priv.seen||{};const midNew=S.midnight.some(m=>m.releaseAt<=now()&&m.releaseAt>(seen.midnight||0));
  if(S.ui.open)return vThread();
  const seg=S.ui.cseg;
  const live=new Set(hereNow());
  let out=`<h1 class="v">${esc(c.name)}</h1><p class="lede">${S.members.length} of 8 · ${verified()?'<span style="color:var(--good);font-weight:600">met in person ✓</span>':'not met in person yet'} · code <b style="font-family:var(--f-mono);letter-spacing:.1em">${esc(c.code)}</b></p>
  <div class="avs">${S.members.map(m=>`<button class="av ${m.id===S.uid?'me':''} ${live.has(m.id)?'on':''}" data-act="cseg" data-v="people" title="${esc(m.name)}" aria-label="${esc(m.name)}${isDark(m)?', dark':''}">${esc(initials(m.name))}</button>`).join('')}<button class="av add" data-act="sheet" data-v="invite" aria-label="Bring someone in">+</button></div>
  <div class="seg n5" role="tablist">${[['chat','Chat',unreadThreads().length],['plans','Plans',0],['pacts','Pacts',0],['midnight','Midnight',midNew],['mole','Mole',0]].map(([k,n,d])=>`<button role="tab" data-act="cseg" data-v="${k}" class="${seg===k?'on':''}" aria-selected="${seg===k}">${n}${d?'<span class="dot"></span>':''}</button>`).join('')}</div>`;
  if(seg==='chat')out+=circleChat();else if(seg==='plans')out+=circlePlans();else if(seg==='pacts')out+=circlePacts();else if(seg==='midnight')out+=circleMidnight();else if(seg==='mole')out+=circleMole();else out+=circlePeople();
  return out;
}
function circleStartForm(){return `<div class="stack"><div class="card hot"><h3>Start a circle</h3><label class="f" for="cs-name">Circle name</label><input class="in-t" id="cs-name" data-f="csname" value="${esc(F.csname||'')}" maxlength="28" placeholder="Third Floor"><div class="btns"><button class="btn" data-act="cs-create">Start it</button></div></div>
  <div class="card"><h3>Join with a code</h3><label class="f" for="cs-code">6-letter code</label><input class="in-t" id="cs-code" data-f="cscode" value="${esc(F.cscode||'')}" maxlength="6" style="text-transform:uppercase;letter-spacing:.2em;font-family:var(--f-mono)" placeholder="K7QF2M"><div class="btns"><button class="btn" data-act="cs-join">Join</button></div></div></div>`}
const roomTitle=r=>{const other=r.circles.find(x=>x!==S.me.circle);return (r.names&&r.names[other]||'Another circle')+' · '+(r.title||'room')};
function circleChat(){
  const seen=S.priv.seen||{};const order={talk:0,plan:1,pot:2};
  const th=[...S.threads].sort((a,b)=>(b.last?.at||b.at)-(a.last?.at||a.at));
  const row=(type,id,title,sub,last,un,extra='')=>`<button class="thr" data-act="open" data-type="${type}" data-v="${esc(id)}"><span class="grow"><b>${esc(title)}</b><span class="meta">${sub}</span>${last?`<span class="last">${esc(last.by===S.uid?'You':last.name)}: ${esc(last.text)}</span>`:''}${extra}</span>${un?'<span class="un" aria-label="unread"></span>':''}</button>`;
  let out=`<div class="eyebrow">Threads <button data-act="sheet" data-v="thread-new">+ New</button></div><div class="stack">`;
  for(const t of th){const un=t.last&&t.last.by!==S.uid&&t.last.at>(seen['t:'+t.id]||0)&&!t.muted;
    const pings=!t.muted&&(t.kind!=='plan'||(t.going||{})[S.uid]);
    const sub=(t.kind==='plan'?`Plan · ${esc(t.when||'date to pick')} · ${Object.values(t.going||{}).filter(Boolean).length} going`:t.kind==='pot'?`Pot · ${esc(potCur(t))}${esc(t.per)} each · ${t.mode==='split'?potPaidN(t)+' paid':nIn(t)+' of '+esc(t.min)+' pledged'}`:t.muted?'Muted unless someone @s you':'Talk')+` · ${pings?'pings you':'muted'}`;
    out+=row('thread',t.id,t.title,sub,t.last,un)}
  out+='</div>';
  const rooms=S.rooms.filter(r=>r.closesAt>now());
  if(rooms.length){out+=`<div class="eyebrow">With other circles</div><div class="stack">${rooms.map(r=>row('room',r.id,roomTitle(r),`Closes in <span data-until="${r.closesAt}">${left(r.closesAt-now())}</span>`,r.last,r.last&&r.last.by!==S.uid&&r.last.at>(seen['r:'+r.id]||0))).join('')}</div>`}
  const pr=Object.entries(S.progress).filter(([u])=>S.members.some(m=>m.id===u));
  if(pr.length){out+=`<div class="eyebrow">What everyone’s on</div><div class="card">${pr.map(([u,p])=>`<div class="row" style="padding:5px 0;border-bottom:1px dashed var(--line)"><span class="av">${initials(nameOf(u))}</span><span class="grow"><b style="font-size:14px">${esc(nameOf(u))}</b>${(p.items||[]).length?(p.items||[]).map(i=>`<div class="meta">${esc(i.label)} · ${i.count} of ${i.goal}${i.kind==='Pact'?' this week':i.kind==='Ladder'?' rungs':''}</div>`).join(''):'<div class="meta">Nothing on right now</div>'}</span></div>`).join('')}</div>`}
  return out+`<p class="formula">Every plan, pot and pact has its own thread and only pings the people in it. General is muted unless someone @s you.</p>`;
}
function vThread(){
  const o=S.ui.open;let title='',panel='',sub='';
  if(o.type==='thread'){const t=S.threads.find(x=>x.id===o.id);if(!t)return `<button class="link" data-act="close">← Back</button><p>Loading…</p>`;title=t.title;sub=t.kind==='talk'?(t.muted?'Muted thread. It never badges.':'Only the people in it get badges.'):'';panel=threadPanel(t)}
  else if(o.type==='room'){const r=S.rooms.find(x=>x.id===o.id);if(!r)return `<button class="link" data-act="close">← Back</button><p>This room has closed.</p>`;title=roomTitle(r);sub=`A room for both circles. It closes in <span data-until="${r.closesAt}">${left(r.closesAt-now())}</span>, and people who meet in person can keep talking.`;if(r.ask)panel=`<div class="panel"><div class="meta">The call</div>${esc(r.ask)}</div>`}
  else{const m=S.met.find(x=>x.id===o.id);const other=m?m.ids.find(x=>x!==S.uid):null;title=other?nameOf(other):'Message';sub=m?`You met ${m.near?'near '+esc(m.near)+', ':''}${esc(ago(m.at))}. Only the two of you see this.`:''}
  const closed=o.type==='room'&&(S.rooms.find(x=>x.id===o.id)?.closesAt||0)<now();
  const msgs=S.msgs.map(m=>`<div class="msg ${m.by===S.uid?'me':''}"><small>${m.by===S.uid?'You':m.by&&m.by!=='former'&&o.type!=='room'?`<button class="link pname" data-act="sheet" data-v="person" data-id="${esc(m.by)}">${esc(m.name)}</button>`:esc(m.name)}${m.cname&&o.type==='room'?' · '+esc(m.cname):''} · ${esc(ago(m.at))}</small>${esc(m.text)}</div>`).join('');
  return `<div style="padding-top:14px"><button class="link" data-act="close">← ${o.type==='dm'?'People':'Threads'}</button></div><h1 class="v" style="margin-top:10px">${esc(title)}</h1>${sub?`<p class="lede" style="margin:0">${sub}</p>`:''}${panel}
  <div class="chat" aria-label="Messages">${msgs||'<p class="meta" style="text-align:center;padding:30px 0">No messages yet. Say something.</p>'}</div>
  ${closed?'<p class="meta">This room has closed.</p>':`<form class="compose" data-form="send"><label class="sr" for="m-text">Message</label><input class="in-t" id="m-text" data-f="msg" value="${esc(F.msg||'')}" placeholder="Message" maxlength="600" autocomplete="off"><button class="btn" type="submit">Send</button></form>`}`;
}
function threadPanel(t){
  if(t.kind==='plan'){const g=t.going||{};const ids=S.members.map(m=>m.id);const me=g[S.uid];
    return `<div class="panel"><div class="meta">Plan</div><b>${esc(t.when||'Date to pick')}${t.where?' · '+esc(t.where):''}</b><div class="who">${ids.map(u=>`<span class="${g[u]?'':'no'}">${esc(nameOf(u))}${g[u]?' ✓':''}</span>`).join('')}</div><div class="btns"><button class="btn s ${me?'ghost':''}" data-act="going" data-v="${t.id}">${me?'Can’t make it':'I’m in'}</button></div></div>`}
  if(t.kind==='pot'){const p=t.pledges||{};const n=Object.values(p).filter(Boolean).length;const on=n>=(t.min||2);const mine=p[S.uid];
    return `<div class="panel"><div class="meta">${t.mode==='split'?'Split pot · pay as you go':'Pot · nobody pays unless '+esc(t.min)+' pledge'+(t.by_when?' by '+esc(t.by_when):'')}</div><b>${esc(potCur(t))}${esc(t.per)} each · ${t.mode==='split'?potPaidN(t)+' paid':n+' of '+esc(t.min)+' pledged'}</b><div class="bar"><i style="width:${Math.min(100,n/(t.min||2)*100)}%;background:${on?'var(--good)':'var(--ball)'}"></i></div>
    ${on?`<p><b>It’s on.</b> Pay ${esc(nameOf(t.by))} directly${t.pay?': '+esc(t.pay):'. They’ll post how.'} INSANE never holds the money.</p>`:''}
    <div class="btns"><button class="btn s ${mine?'ghost':''}" data-act="pledge" data-v="${t.id}">${mine?'Take back my pledge':'Pledge '+esc(potCur(t))+esc(t.per)}</button><button class="btn s ghost" data-act="pot-go" data-v="${t.id}">Who’s paid</button>${t.by===S.uid?`<button class="btn s ghost" data-act="sheet" data-v="pay-note" data-id="${t.id}">How to pay you</button>`:''}</div></div>`}
  return '';
}
function circleMidnight(){
  const t=now();const rel=S.midnight.filter(m=>m.releaseAt<=t&&!m.removed&&(m.flags||[]).length<2).sort((a,b)=>b.releaseAt-a.releaseAt);
  const lastAt=rel[0]?.releaseAt;const batch=lastAt?rel.filter(m=>m.releaseAt===lastAt).sort((a,b)=>fnvN(a.id)-fnvN(b.id)):[];const older=rel.filter(m=>m.releaseAt!==lastAt);
  const pend=S.midnight.filter(m=>m.releaseAt>t).length;const mode=F.mnmode||'unsigned';
  let out=`<div class="mnhead"><b>${!lastAt?'Midnight':lastAt===dayStart(t)?'Last night at 00:00':esc(when(lastAt))}</b><span>${batch.length?batch.length+' unsigned · shuffled':''}${pend?(batch.length?' · ':'')+pend+' waiting for midnight':''}</span></div>`;
  out+=batch.length?`<div class="stack">${batch.map(mnMsg).join('')}</div>`:`<div class="card dash"><p class="meta">Nothing has gone out yet. Unsigned messages go out at 00:00, all at once, in random order.</p></div>`;
  const se=[...S.sealed].sort((a,b)=>a.openAt-b.openAt);const shut=se.filter(x=>x.openAt>t),opened=se.filter(x=>x.openAt<=t).reverse();
  if(shut.length)out+=`<div class="card mn" style="margin-top:10px"><div class="km"><span class="kind mnk">Sealed</span><span class="meta">${shut.length} waiting</span></div><p>Next one opens <b>${esc(when(shut[0].openAt))}</b>, from ${esc(nameOf(shut[0].by))}. Signed, so nobody has to guess. <span class="meta" data-until="${shut[0].openAt}">${left(shut[0].openAt-t)}</span></p></div>`;
  if(opened.length)out+=`<div class="stack" style="margin-top:10px">${opened.slice(0,6).map(x=>`<div class="post"><div class="meta">From ${esc(nameOf(x.by))}, sealed ${esc(ago(x.at))}, opened ${esc(when(x.openAt))}</div><p class="txt">${esc(x.text)}</p></div>`).join('')}</div>`;
  out+=`<div class="eyebrow">Write for Midnight</div><div class="seg" role="tablist" style="margin-top:0">${[['unsigned','Unsigned'],['sealed','Sealed, opens later']].map(([k,n])=>`<button role="tab" data-act="mnmode" data-v="${k}" class="${mode===k?'on':''}" aria-selected="${mode===k}">${n}</button>`).join('')}</div>`;
  if(mode==='sealed'){const opts=sealOpts();const sel=F.sealw??0;
    out+=`<div class="card"><label class="f" for="seal-text" style="margin-top:0">Signed with your name</label><textarea class="in-t" id="seal-text" data-f="sealtext" maxlength="600" placeholder="By the time you read this, I’ll have run my first 10k.">${esc(F.sealtext||'')}</textarea>
    <label class="f">Opens</label><div class="chips">${opts.map((o,i)=>`<button class="chip ${sel===i?'on':''}" data-act="sealw" data-v="${i}">${esc(o[0])}</button>`).join('')}</div>
    <p class="meta">${esc(when(opts[sel][1]))}. Nobody can read it before then, you included. The circle sees “1 sealed message from you”.</p><div class="btns"><button class="btn s" data-act="seal-send">Seal it</button></div></div>`}
  else out+=`<div class="card"><label class="f" for="mn-text" style="margin-top:0">About you, unsigned</label><textarea class="in-t" id="mn-text" data-f="mntext" maxlength="400" placeholder="Something you’ve never said out loud">${esc(F.mntext||'')}</textarea>
    <label class="f">Which night</label><div class="chips">${[['tonight','Tonight'],['tomorrow','Tomorrow'],['week','Some night this week']].map(([v,n])=>`<button class="chip ${(F.mnwhen||'week')===v?'on':''}" data-act="mnwhen" data-v="${v}">${n}</button>`).join('')}</div>
    <p class="meta">Goes out at 00:00 with everyone else’s, shuffled. You pick the night; nobody can match it to when you were on your phone. Your name isn’t saved anywhere, not even by INSANE.</p><div class="btns"><button class="btn s" data-act="mn-send">Queue it</button></div></div>`;
  if(older.length)out+=`<div class="eyebrow">Earlier</div><div class="stack">${older.slice(0,20).map(mnMsg).join('')}</div>`;
  return out+`<p class="formula">Rules: only about yourself. Names of people in the circle are blocked before sending. Anyone in the circle can remove a message for everyone, no reason needed.</p>`;
}
function mnMsg(m){const mine=(m.reacts||{})[S.uid];return `<div class="card mnmsg"><div class="meta">${esc(when(m.releaseAt))}</div><p>${esc(m.text)}</p><div class="reacts">${['same','brave','❤'].map(r=>`<button data-act="mn-react" data-v="${m.id}" data-r="${r}" class="${mine===r?'on':''}" aria-pressed="${mine===r}">${r}</button>`).join('')}<button class="rm" data-act="mn-remove" data-v="${m.id}">${S.ui.confirm==='mnrm'+m.id?'tap again to remove':'remove'}</button></div></div>`}
function circlePeople(){
  const c=S.circle,ref=myRef(),live=new Set(hereNow());
  let out=`<div class="eyebrow">In ${esc(c.name)} · ${verifiedN()} of ${S.members.length} met in person${isCircleOwner()&&S.backend==='server'?' <button data-act="sheet" data-v="circle-admin">Settings</button>':''}</div><div class="card">${S.members.map(m=>{const dark=isDark(m);const d=ref&&m.cell&&m.id!==S.uid?distKm(ref,[m.cell.lat,m.cell.lon]):null;return `<div class="row" style="padding:6px 0"><span class="av ${live.has(m.id)?'on':''}">${initials(m.name)}</span><span class="grow">${m.id===S.uid?`<b>${esc(m.name+' (you)')}</b>`:`<button class="link pname" data-act="sheet" data-v="person" data-id="${esc(m.id)}"><b>${esc(m.name)}</b></button>`}${m.id===circleOwnerId()?' <span class="meta">· owner</span>':''}${isBlocked(m.id)?' <span class="meta">· blocked</span>':''}<div class="meta">${dark?`Dark for <span data-until="${m.darkUntil}">${left(m.darkUntil-now())}</span>`:live.has(m.id)?'Here now':m.seen&&now()-m.seen<DAY?'Here today':m.seen?'Last here '+esc(ago(m.seen)):''}${d!=null?' · about '+fmtKm(d)+' away':''}${(c.verified||{})[m.id]?' · met in person ✓':''}${m.darkBack&&!dark?` · came back after ${esc(left(m.darkBack.after*MIN))} of ${esc(m.darkBack.planned)} h`:''}</div></span></div>`}).join('')}</div>
  <div class="card invite"><div class="row"><div class="grow"><h3>Bring someone in</h3><p class="meta">They scan this with their phone camera, or type the code.</p><div class="big" style="font-size:26px;text-align:left">${esc(c.code)}</div><div class="btns"><button class="btn ghost s" data-act="copy" data-v="${esc(appLink()+'#c'+c.code)}">Copy invite link</button></div></div><div class="qr">${qrSvg(appLink()+'#c'+c.code)}</div></div></div>`;
  out+=`<div class="eyebrow">People you’ve met <button data-act="sheet" data-v="meet">Meet someone</button></div>`;
  out+=S.met.length?`<div class="stack">${S.met.map(m=>{const o=m.ids.find(x=>x!==S.uid);return `<button class="thr" data-act="open" data-type="dm" data-v="${esc(m.id)}"><span class="av">${initials(nameOf(o))}</span><span class="grow"><b>${esc(nameOf(o))}</b><span class="meta">Met ${m.near?'near '+esc(m.near)+', ':''}${esc(ago(m.at))}</span></span></button>`}).join('')}</div>`:`<div class="card dash"><p class="meta">Message someone from another circle after you’ve met in person: one of you shows a QR code or a 6-digit code, the other scans or types it. No cold messages from strangers.</p></div>`;
  out+=`<div class="btns" style="margin-top:22px"><button class="link" data-act="leave">Leave ${esc(c.name)}</button></div>`;
  return out;
}
/* ---------- Circle: plans, pacts, Mole ---------- */
function circlePlans(){
  const ps=plans().sort((a,b)=>b.at-a.at);
  let out=`<div class="btns" style="margin-top:12px">${F.newPlan?'':'<button class="btn s" data-act="np-toggle">Plan something</button>'}<button class="btn s ghost" data-act="sheet" data-v="dare">Dare someone</button></div>`;
  if(F.newPlan)out+=planForm();
  out+=`<div class="stack" style="margin-top:10px">${ps.length?ps.map(planCard).join(''):'<div class="card dash"><p class="meta">No plans yet. Climbing, a film, Sunday lunch: one card, everyone taps in or out, and only the people going get pinged.</p></div>'}</div>`;
  out+=vault();
  const jar=S.dares.filter(d=>!d.to&&!d.pulled&&!dareFlagged(d)).sort((a,b)=>b.at-a.at);
  out+=`<div class="eyebrow">The dare jar · ${jar.length||'starter'} <button data-act="sheet" data-v="dare">+ Add</button></div>${jar.length?`<div class="card">${jar.slice(0,12).map(d=>`<div class="tx"><span>${esc(d.text)}</span><span class="amt">bold ${esc(d.level)}/6</span><small>${esc(nameOf(d.by))} · ${esc(ago(d.at))}${d.by===S.uid?` · <button class="link" data-act="dare-del" data-v="${d.id}">take it out</button>`:` · ${flagBtn(d.id)}`}</small></div>`).join('')}</div>`:'<p class="meta">Empty, so the daily dare comes from INSANE’s starter jar. Anything you add goes in from tomorrow.</p>'}`;
  return out+`<p class="formula">Each plan has its own thread in Chat. INSANE holds the date, who’s in and the money tracking; the money itself goes between you.</p>`;
}
function planCard(t){const g=t.going||{};const n=Object.values(g).filter(Boolean).length;const me=g[S.uid];const pot=t.pot&&S.threads.find(x=>x.id===t.pot);
  return `<div class="card"><div class="km"><span class="kind l">${esc(t.when||'Date to pick')}</span><span class="meta">${n} going</span></div><p><b>${esc(t.title)}</b>${t.where?' · '+esc(t.where):''}</p>${t.stolen?`<p class="meta">Stolen from ${esc(t.stolen)}’s post. They can see you stole it.</p>`:''}
  ${pot?`<p class="meta">Pot: ${esc(potCur(pot))}${esc(pot.per)} each · ${pot.mode==='split'?potPaidN(pot)+' paid':nIn(pot)+' of '+esc(pot.min)+' pledged'}</p>`:''}
  <div class="who">${S.members.map(m=>`<span class="${g[m.id]?'':'no'}">${esc(m.id===S.uid?'You':m.name)}${g[m.id]?' ✓':g[m.id]===false?' ✗':''}</span>`).join('')}</div>
  <div class="btns">${me?`<button class="btn s ghost" data-act="rsvp" data-v="${t.id}" data-x="n">Can’t make it</button>`:`<button class="btn s" data-act="rsvp" data-v="${t.id}" data-x="y">I’m in</button>`}<button class="btn s ghost" data-act="open" data-type="thread" data-v="${t.id}">Thread</button>${pot?`<button class="btn s ghost" data-act="pot-go" data-v="${pot.id}">Pot</button>`:''}</div></div>`}
function planForm(){const m=F.plmoney||'';
  return `<div class="card hot" style="margin-top:10px"><div class="km"><span class="kind l">Plan something</span><button class="link" data-act="np-toggle">cancel</button></div>
  <label class="f" for="pl-what">What</label><input class="in-t" id="pl-what" data-f="plwhat" value="${esc(F.plwhat||'')}" maxlength="40" placeholder="Climbing, then pho">
  <label class="f" for="pl-when">When</label><input class="in-t" id="pl-when" data-f="plwhen" value="${esc(F.plwhen||'')}" maxlength="40" placeholder="Sat afternoon"><div class="ex">${['Tonight','Sat afternoon','Sun 11:00','Next Fri night'].map(x=>`<button data-act="pl-when" data-v="${x}">${x}</button>`).join('')}</div>
  <label class="f" for="pl-where">Where <small>optional</small></label><input class="in-t" id="pl-where" data-f="plwhere" value="${esc(F.plwhere||'')}" maxlength="60" placeholder="The climbing wall on Mill Lane">
  <label class="f">Money?</label><div class="chips">${[['','No pot'],['pledge','Pledge pot'],['split','Split pot']].map(([v,n])=>`<button class="chip ${m===v?'on':''}" data-act="pl-money" data-v="${v}">${n}</button>`).join('')}</div>
  ${m?`<div class="row" style="gap:8px;align-items:flex-end"><div class="grow"><label class="f" for="pl-each">${esc(cur())} each</label><input class="in-t" id="pl-each" data-f="pleach" inputmode="numeric" value="${esc(F.pleach||'')}" placeholder="40"></div>${m==='pledge'?`<div class="grow"><label class="f" for="pl-min">Goes ahead at</label><input class="in-t" id="pl-min" data-f="plmin" inputmode="numeric" value="${esc(F.plmin||'')}" placeholder="4 people"></div>`:''}</div>`:''}
  <div class="btns"><button class="btn s" data-act="pl-create">Send to the circle</button></div></div>`}
function vault(){const cs=S.clips.filter(c=>c.exp>now()&&safeImg(c.img)).sort((a,b)=>b.at-a.at);
  return `<div class="eyebrow">This week’s clips <span style="text-transform:none;letter-spacing:0">circle only · gone after 24 h</span></div>${cs.length?`<div class="vault">${cs.map(c=>`<button class="vt-tile" data-act="sheet" data-v="clip" data-id="${c.id}" style="background-image:url(${safeImg(c.img)})"><span class="left" data-until="${c.exp}">${left(c.exp-now())}</span><b>${esc(c.what)}</b><small>${esc(nameOf(c.by))}${(c.seen||{})[S.uid]?' · seen':''}</small></button>`).join('')}</div>`:'<div class="card dash"><p class="meta">Photos from dares and rungs land here for 24 hours, then they’re deleted. No downloads, no sharing outside the circle.</p></div>'}`}
function circlePacts(){
  const mine=journeys().filter(j=>j.status==='active'&&(j.read.kind==='Pact'||j.read.kind==='Ladder'));
  let out=`<div class="eyebrow">Yours <button data-act="sheet" data-v="add-j">+ Start one</button></div><div class="stack">${mine.length?mine.map(j=>jCard(j,false)).join(''):'<div class="card dash"><p class="meta">No pact yet. Start one: the thing you keep saying you’ll do.</p></div>'}</div>`;
  out+=`<div class="eyebrow">Everyone’s pacts</div><div class="stack">`;
  const others=S.members.filter(m=>m.id!==S.uid);
  if(!others.length)out+='<div class="card dash"><p class="meta">Bring people in and their pacts show here. You see counts, never the details of a ladder.</p></div>';
  for(const m of others){const items=(S.progress[m.id]?.items||[]).filter(i=>i.kind==='Pact'||i.kind==='Ladder');
    if(!items.length){out+=`<div class="card"><div class="km"><span class="meta">${esc(m.name)}</span><span class="meta">no pact</span></div><p class="meta">${esc(m.name)} hasn’t started one. Nobody gets nudged about that.</p></div>`;continue}
    for(const i of items){const did=S.cheers.some(c=>c.id===cheerId(m.id,i.label));const by=cheersFor(m.id,i.label).map(c=>nameOf(c.from));
      out+=`<div class="card"><div class="km"><span class="meta">${esc(m.name)}</span><span class="meta">${i.kind==='Ladder'?`rung ${i.count} of ${i.goal}`:`${i.count} of ${i.goal} this week`}</span></div><p><b>${esc(i.label)}</b>${i.today?' <span style="color:var(--good);font-weight:600">✓ today</span>':''}</p>${i.kind==='Ladder'?'<p class="meta">The circle sees the rung number, not what the rungs are.</p>':''}
      <div class="btns"><button class="btn s ghost" data-act="cheer" data-u="${m.id}" data-l="${esc(i.label)}" ${did?'disabled':''}>${did?'Cheered':'Cheer'}</button>${by.length?`<span class="meta" style="align-self:center">Cheered by ${esc(by.join(', '))}</span>`:''}</div></div>`}}
  return out+`</div><p class="formula">Two free misses a week. Stakes are dares or cooking, never money. Physical ladder rungs (heights, cold water) only count somewhere with staff.</p>`;
}
function circleMole(){
  const wk=weekKey(),m=S.mole,mine=myMole(),rv=moleReveal(),t=now();let out='';
  if(mine){const n=moleDone(mine);
    out+=`<div class="card mole" style="margin-top:12px"><div class="km"><span class="kind mk">Week ${weekNum()} · you’re the Mole</span><span class="meta">reveal ${esc(when(rv))}</span></div><p>Do three things without getting caught. On Sunday everyone votes. If fewer than half guess you, you got away with it.</p>
    <ol class="tasks">${mine.tasks.map((ti,i)=>{const need=MOLE_N[ti],have=mine.prog[i]||0,dn=have>=need;return `<li class="${dn?'done':''}"><span>${esc(MOLE_TASKS[ti])}${need>1?` <span class="meta">(${have}/${need})</span>`:''}</span>${dn?'<b>done</b>':`<button class="btn s ghost" data-act="mole-step" data-i="${i}">${need>1?'+1':'Done'}</button>`}</li>`}).join('')}</ol>
    <p class="meta">${n===3?'All three done. Now act normal until Sunday.':'Only you can see this card. Your circle sees “someone is the Mole”.'}</p>${t>=rv&&!m.revealed?`<div class="btns"><button class="btn s red" data-act="mole-reveal">Reveal yourself</button></div>`:''}</div>`}
  else if(m&&!m.revealed){const mv=S.votes.find(v=>v.week===wk&&v.by===S.uid);const nv=S.votes.filter(v=>v.week===wk).length;
    out+=`<div class="card mole" style="margin-top:12px"><div class="km"><span class="kind mk">Week ${weekNum()}</span><span class="meta">reveal ${esc(when(rv))}</span></div><p><b>Someone in ${esc(S.circle.name)} is the Mole this week.</b> Three secret tasks. Who’s been acting strange?</p>
    ${t<rv?`<label class="f">Your guess <small>change it any time before the reveal</small></label><div class="chips">${S.members.filter(x=>x.id!==S.uid).map(x=>`<button class="chip ${mv?.vote===x.id?'on':''}" data-act="mole-vote" data-v="${x.id}">${esc(x.name)}</button>`).join('')}</div>`:'<p class="meta">Voting’s closed. Waiting for the Mole to reveal themselves.</p>'}<p class="meta">${nv} vote${nv===1?'':'s'} in.</p></div>`}
  else if(m&&m.revealed)out+=`<div style="margin-top:12px">${moleResult(m,wk)}</div>`;
  else out+=S.members.length>=4?nc('The Mole','mk','week '+weekNum(),`<p><b>Nobody’s the Mole this week.</b> Be it: you get three harmless tasks from INSANE’s list, and on Sunday at 21:00 everyone guesses. Only you will know.</p>`,`<button class="btn s" data-act="mole-claim">I’ll be the Mole</button>`,'mole'):`<div class="card dash" style="margin-top:12px"><p class="meta">The Mole starts once four of you are in the circle. ${S.members.length} so far.</p></div>`;
  if(S.moleLast&&S.moleLast.revealed)out+=`<div class="eyebrow">Last week</div>${moleResult(S.moleLast,weekKey(now()-7*DAY))}`;
  return out+`<p class="formula">Tasks come from the app’s list, never made up. Nothing involving phones, money, bedrooms or anyone outside the circle. Anyone can sit a week out: just don’t pick it up.</p>`;
}
function moleResult(m,wk){const vs=S.votes.filter(v=>v.week===wk);const got=vs.filter(v=>v.vote===m.revealed.uid).length;const away=got<vs.length/2;
  return `<div class="card"><p><b>${esc(m.revealed.uid===S.uid?'You were':nameOf(m.revealed.uid)+' was')} the Mole.</b> ${esc(m.revealed.done)} of 3 tasks, ${got} vote${got===1?'':'s'} out of ${vs.length}. ${away?'Got away with it.':'Caught.'}</p></div>`}

