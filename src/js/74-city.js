/* ---------- City ---------- */
function vCity(){
  const seg=S.ui.sseg;
  let out=`<h1 class="v">${esc(S.me.cityName)}</h1><p class="meta" style="margin-top:2px">Drops, Missions and trails within ${S.me.radius||5} km · the feed · calls · league</p>
  <div class="seg" role="tablist">${[['map','Map'],['feed','Feed'],['calls','Calls'],['league','League']].map(([k,n])=>`<button role="tab" data-act="sseg" data-v="${k}" class="${seg===k?'on':''}" aria-selected="${seg===k}">${n}</button>`).join('')}</div>`+segHelp(seg);
  if(seg==='map')out+=cityMap();else if(seg==='feed')out+=cityFeed();else if(seg==='calls')out+=cityCalls()+callsExtra();else out+=cityLeague();
  return out;
}
function decodeCard(compact){
  const st=decodeState(S.solves),cl=decodeClue();const mine=S.solves.find(s=>s.uid===S.uid);
  const circ=S.me.circle&&S.solves.find(s=>s.circle===S.me.circle);
  let status=mine?`<b>Solved, ${ordinal(S.solves.indexOf(mine)+1)} in ${esc(S.me.cityName)}</b> · ${decPts(S.solves.indexOf(mine)+1,mine.hints)} points`:st.revealed?(cl.answer?`The answer was <b>${esc(cl.answer)}</b>`:'The answer is out.'):circ?`${esc(nameOf(circ.uid))} solved it for your circle. You can still solve it yourself.`:'';
  const info=`<div class="meta">${st.n} solved in ${esc(S.me.cityName)} · ${st.revealed?'answer is out':`answer out in <span data-until="${st.reveal}">${left(st.reveal-now())}</span>`}</div>`;
  // C33: a one-line teaser; the clue itself is in the sheet, so it never outshouts what needs you
  if(compact)return `<button class="card ball dtz" data-act="sheet" data-v="decode"><b>Decode · week ${weekNum()}</b><span class="meta">${status||`${st.n} solved in ${esc(S.me.cityName)}`}</span><span aria-hidden="true">›</span></button>`;
  return {st,cl,mine,status,info};
}
/* ---------- City, map first (C43, C44): the map at the top, List / Map toggle, distance chips, clusters ---------- */
// The distance filter: any of the chips up to your own radius (your radius is the ceiling: P11).
const cityR=()=>{const R=S.me.radius||5;const v=S.ui.cityR;return v&&v<=R?v:R};
const cityView=()=>S.ui.cityView||(()=>{try{return localStorage.getItem('insane.cityView')||'map'}catch(e){return 'map'}})();
function cityDrops(){const r=cityR(),t=now();return nearDrops().filter(d=>d._km<=r&&d.end>t-6*HOUR).sort((a,b)=>a._km-b._km||a.start-b.start)}
function cityMap(){
  const t=now(),R=S.me.radius||5,r=cityR(),view=cityView();const near=cityDrops();
  const further=S.drops.filter(d=>d.end>t&&isFinite(d.lat)&&!near.includes(d)).length;
  const chips=RADII.filter(x=>x<=R);if(!chips.includes(R))chips.push(R);
  const ms=S.missions.filter(m=>m.when>t-2*DAY).sort((a,b)=>a.when-b.when),ts=S.trails.filter(x=>x.end>t-DAY).sort((a,b)=>a.start-b.start);
  return `<div class="citybar"><div class="ctog" role="group" aria-label="Show as"><button data-act="city-view" data-v="map" class="${view==='map'?'on':''}" aria-pressed="${view==='map'}">Map</button><button data-act="city-view" data-v="list" class="${view==='list'?'on':''}" aria-pressed="${view==='list'}">List</button></div>
   <div class="chips mapchips" role="group" aria-label="How far">${chips.map(x=>`<button class="chip ${x===r?'on':''}" data-act="city-r" data-v="${x}" aria-pressed="${x===r}">${x} km</button>`).join('')}</div></div>
   ${view==='map'?`<div class="mapslot city" data-map="city"></div><div class="maplegend"><span><i class="sq"></i>Your square</span><span><i style="background:var(--paper)"></i>Drop</span><span><i style="background:rgba(31,122,77,.3);border-color:var(--good)"></i>Mission area</span><span><i style="background:var(--ball);border-color:var(--ball)"></i>Trail</span></div>`:''}
   <div class="eyebrow">Drops near you<button data-act="sheet" data-v="host">+ Host a drop</button></div>
   <div class="stack">${near.length?near.map(dropRow).join(''):`<div class="card dash"><p class="meta">No drops within ${r} km yet. Shops, stalls, clubs and circles can host one: a swap box, a counter dare, an offer for whoever turns up, or a two-key that only opens when two circles arrive together.</p></div>`}</div>
   ${further?`<p class="meta" style="margin-top:8px">${further} more drop${further>1?'s':''} within ${G} km, further than ${r<R?r:'your '+R} km. ${r<R?`<button class="link" data-act="city-r" data-v="${R}">Show up to ${R} km</button>`:`<button class="link" data-act="sheet" data-v="profile">Widen it</button>`}</p>`:''}
   <div class="eyebrow">Missions<button data-act="sheet" data-v="propose">+ Propose</button></div>
   <div class="stack">${ms.length?ms.map(missionCard).join(''):'<div class="card dash"><p class="meta">No Missions in '+esc(S.me.cityName)+' yet. A Mission is a harmless bit of public theatre: forty people freezing mid-step in a square for a minute. A circle that has met in person proposes one; three other circles confirm it.</p></div>'}</div>
   <div class="eyebrow">Trails<button data-act="sheet" data-v="trail-new">+ Make a trail</button></div>
   <div class="stack">${ts.length?ts.map(trailRow).join(''):'<div class="card dash"><p class="meta">No trails yet. A trail is 3 to 6 stops your circle likes, walked in any order inside a window, with a 10-second dare at each.</p></div>'}</div>
   <div style="margin-top:14px">${decodeCard(true)}</div>
   <p class="formula">The map never shows people, only your own square. Missions show an area until two hours before.</p>`;
}
// What the City map draws. Never people (C44): no member is plotted, not even as a square; your own place is your
// square (or, if you chose Exact, your pin, which only this phone has).
function myMapMark(){const me=S.me;const l=S.priv.loc;if(me.prec==='exact'&&l&&isFinite(l.lat))return {type:'pin',ll:[l.lat,l.lon]};return me.cell?{type:'cell',b:me.cell.b,style:'me'}:null}
MAPSPEC.city=()=>{const ref=myRef();if(!ref)return null;const r=cityR();return {home:ref,zoom:fitZoom(ref[0],r),follow:true,coop:true,v:S.me.cell.id+'|'+r,label:`Map of drops, Missions and trails within ${r} km. Your square is in the middle.`,
  items:()=>{const it=[{type:'radius',ll:ref,km:r}];const mk=myMapMark();if(mk)it.push(mk);for(const m of S.members)if(m.id!==S.uid&&m.showSquare&&m.cell&&m.cell.b)it.push({type:'cell',b:m.cell.b,style:'others'});
    for(const d of cityDrops())it.push({type:'stamp',ll:[d.lat,d.lon],text:DK[d.kind]?.s||'?',hot:dropPhase(d)==='open',pick:true,cluster:true,drop:d.id});
    for(const m of S.missions)if(m.area&&m.when>now()-2*HOUR){const pin=m.pin&&isFinite(m.pin.lat)&&msSpot(m)?m.pin:null;if(pin)it.push({type:'stamp',ll:[pin.lat,pin.lon],text:'MSN',pick:true,cluster:true,ms:m.id});else{it.push({type:'area',ll:[m.area.lat,m.area.lon],km:.35});it.push({type:'stamp',ll:[m.area.lat,m.area.lon],text:'MSN',pick:true,cluster:true,ms:m.id})}}
    for(const tr of S.trails)if(tr.end>now()&&(tr.stops||[]).length){it.push({type:'line',pts:tr.stops.map(x=>[x.lat,x.lon])});it.push({type:'stamp',ll:[tr.stops[0].lat,tr.stops[0].lon],text:'TRL',pick:true,cluster:true,tr:tr.id,hot:now()>=tr.start})}
    return it},
  onPick:it=>{if(it.drop)openSheet('drop',{id:it.drop});else if(it.ms)openSheet('mission',{id:it.ms});else if(it.tr)openSheet('trail',{id:it.tr})}}};
// Missions: a 350 m circle nudged off the spot until T-2h; then, for people who said yes, the exact pin (the server strips it for everyone else).
MAPSPEC.mission=()=>{const m=S.missions.find(x=>x.id===(S.ui.sheet&&S.ui.sheet.id));if(!m||!m.area)return null;const pin=m.pin&&isFinite(m.pin.lat)&&msSpot(m)?m.pin:null;const c=pin?[pin.lat,pin.lon]:[m.area.lat,m.area.lon];
  return {home:c,zoom:15,follow:true,v:m.id+(pin?'p':''),label:pin?'Mission: the exact spot':'Mission area, 350 m across',items:()=>[pin?{type:'pin',ll:c}:{type:'area',ll:c,km:.35},myMapMark()].filter(Boolean)}};
// Trails: numbered stops on a dashed path; a stop you stamped is filled.
MAPSPEC.trail=()=>{const tr=S.trails.find(x=>x.id===(S.ui.sheet&&S.ui.sheet.id));if(!tr||!(tr.stops||[]).length)return null;const pts=tr.stops.map(x=>[x.lat,x.lon]);const c=[pts.reduce((a,p)=>a+p[0],0)/pts.length,pts.reduce((a,p)=>a+p[1],0)/pts.length];const span=Math.max(.3,...pts.map(p=>distKm(c,p)));
  return {home:c,zoom:fitZoom(c[0],span*2.2),follow:true,v:tr.id,label:'Trail map',items:()=>[{type:'line',pts},...tr.stops.map((x,i)=>({type:'stamp',ll:[x.lat,x.lon],text:String(i+1),hot:!!(myStamp(tr)?.stops||{})[i]}))]}};
MAPSPEC.drop=()=>{const d=S.drops.find(x=>x.id===(S.ui.sheet&&S.ui.sheet.id));if(!d||!isFinite(d.lat))return null;return {home:[d.lat,d.lon],zoom:15,follow:true,v:d.id,label:'Where the drop is',
  items:()=>[myMapMark(),{type:'pin',ll:[d.lat,d.lon]}].filter(Boolean)}};
function nearDrops(){const ref=myRef();if(!ref)return [];const R=S.me.radius||5;return S.drops.filter(d=>isFinite(d.lat)).map(d=>Object.assign(d,{_km:distKm(ref,[d.lat,d.lon])})).filter(d=>d._km<=R)}
function dropRow(d){const ph=dropPhase(d);const k=DK[d.kind]||DK.offer;const km=d._km!=null?d._km:myRef()&&isFinite(d.lat)?distKm(myRef(),[d.lat,d.lon]):null;
  const w=ph==='soon'?`${when(d.start)} · opens in <span data-until="${d.start}">${left(d.start-now())}</span>`:ph==='open'?`Open now · <span data-until="${d.end}">${left(d.end-now())}</span> left`:'Over · '+when(d.end);
  return `<button class="drop ${ph==='open'?'open':''}" data-act="sheet" data-v="drop" data-id="${esc(d.id)}"><span class="dk k-${d.kind}">${k.s}</span><span class="grow"><span class="when">${w}</span><b style="display:block">${esc(d.venue)}</b><span class="meta">${esc(k.n)}${km!=null?' · '+fmtKm(km)+' away':''} · ${esc(d.prize)}</span></span></button>`}
function cityFeed(){
  const canPost=!!S.me.circle&&verified();const hidden=new Set((S.priv.hidden?.ids)||[]);
  const ps=S.posts.filter(p=>!hidden.has(p.id)&&(p.flags||[]).length<3);
  const kinds=['Made','Did','Found','Ask'];const fk=F.pkind||'Made';
  return `<p class="lede" style="margin-top:12px">What circles in ${esc(S.me.cityName)} are up to. No likes, no follower counts, no comments from strangers. If you want to talk to someone, answer a call or meet them.</p>
  ${canPost?`<form class="card" data-form="post"><div class="chips">${kinds.map(k=>`<button type="button" class="chip ${fk===k?'on':''}" data-act="pkind" data-v="${k}">${k}</button>`).join('')}</div><label class="sr" for="p-text">Post</label><textarea class="in-t" id="p-text" data-f="ptext" maxlength="400" style="margin-top:8px" placeholder="Built a cardboard arcade cabinet. It works. Barely.">${esc(F.ptext||'')}</textarea><div class="btns"><button class="btn s" type="submit">Post as ${esc(S.circle?.name||'your circle')}</button></div></form>`:S.me.circle?`<div class="lock">Anyone can read and react. Posting needs your circle to have met in person: two of you scan each other’s phones. <button class="link" data-act="sheet" data-v="meet">Meet someone</button></div>`:`<div class="card dash"><p class="meta">Join a circle to post. Posts go out under the circle’s name.</p></div>`}
  <div class="stack" style="margin-top:12px">${ps.length?ps.map(p=>`<div class="post"><div class="meta"><span class="tag k">${esc(p.kind)}</span>${esc(p.cname)} · ${esc(p.by===S.uid?'you':p.name)} · ${esc(ago(p.at))}</div><p class="txt">${esc(p.text)}</p>${feedReacts(p)}<div class="act">${p.by===S.uid||S.isOwner?`<button data-act="pdel" data-v="${p.id}">Delete</button>`:`<button data-act="phide" data-v="${p.id}">Hide</button><button data-act="pflag" data-v="${p.id}">${(p.flags||[]).includes(S.uid)?'Reported':'Report'}</button>`}</div></div>`).join(''):`<div class="card dash"><p class="meta">Nothing posted in ${esc(S.me.cityName)} yet. Be first.</p></div>`}</div>${ps.length?`<p class="meta end">That’s everything from ${esc(S.me.cityName)} lately. No more to scroll.</p>`:''}`;
}
function feedReacts(p){const rs=p.reacts||{};
  if(p.circle&&p.circle===S.me.circle){const wants=[...new Set(Object.values(rs).filter(x=>x&&x.r==='in'&&x.circle!==S.me.circle).map(x=>x.cname))],stole=[...new Set(Object.values(rs).filter(x=>x&&x.r==='steal').map(x=>x.cname))];
    return `<p class="meta" style="margin-top:6px">${wants.length?'Wants in: '+esc(wants.join(', '))+'. ':''}${stole.length?'Stolen by: '+esc(stole.join(', '))+'. ':''}${!wants.length&&!stole.length?'Posted. Nobody sees a number on it, including you.':''}</p>`}
  const mine=rs[S.uid]?.r;return `<div class="reacts lt">${[['love','❤'],['in','we’re in'],['steal','steal this']].map(([k,n])=>`<button data-act="freact" data-v="${p.id}" data-r="${k}" class="${mine===k?'on':''}" aria-pressed="${mine===k}">${n}</button>`).join('')}</div>`}
function cityCalls(){
  const t=now(),cid=S.me.circle,all=S.calls.filter(c=>c.at>t-3*DAY||(c.circle===cid&&!c.answered)).sort((a,b)=>b.at-a.at),ours=all.filter(c=>c.circle===cid),open=all.filter(c=>c.circle!==cid);
  return `<p class="lede" style="margin-top:12px">Ask the city for a hand: a 4th for quiz night, someone to trade a bike pump. Another circle answers and you get a room together for 3 days.</p>
  ${S.me.circle&&!verified()?`<div class="lock">Anyone can answer a Call. Posting one needs your circle to have met in person. <button class="link" data-act="sheet" data-v="meet">Meet someone</button></div>`:''}
  ${S.me.circle&&verified()?`<form class="card" data-form="call"><label class="f" for="c-ask" style="margin-top:0">Your circle needs…</label><input class="in-t" id="c-ask" data-f="cask" value="${esc(F.cask||'')}" maxlength="140" placeholder="a 4th for the pub quiz on Thursday"><div class="btns"><button class="btn s" type="submit">Send the call</button></div></form>`:''}
  ${ours.length?`<div class="eyebrow">Your circle’s calls</div><div class="stack">${ours.map(callCard).join('')}</div><div class="eyebrow">Open in ${esc(S.me.cityName)}</div>`:''}<div class="stack" style="margin-top:12px">${open.length?open.map(callCard).join(''):`<div class="card dash"><p class="meta">No open calls${ours.length?' from other circles':''} in ${esc(S.me.cityName)}.</p></div>`}</div>`;
}
function callCard(c){const mine=c.circle===S.me.circle;return `<div class="post"><div class="meta">${esc(c.cname)} · ${esc(ago(c.at))}</div><p class="txt">${esc(c.ask)}</p><div class="btns">${c.answered?`<span class="meta">Answered by ${esc(c.answered.name)}</span>${(mine||c.answered.circle===S.me.circle)&&c.room?`<button class="btn s" data-act="open" data-type="room" data-v="${esc(c.room)}">Open the room</button>`:''}`:mine?`<span class="meta">Open · waiting for another circle</span><button class="btn s ghost" data-act="cdel" data-v="${c.id}">Close it</button>`:S.me.circle?`<button class="btn s" data-act="answer" data-v="${c.id}">We can help</button>`:''}</div></div>`}function callsExtra(){
  const rooms=S.rooms.filter(r=>r.closesAt>now());
  return `<div class="eyebrow">Rooms with other circles</div>${rooms.length?`<div class="stack">${rooms.map(r=>`<button class="thr" data-act="open" data-type="room" data-v="${esc(r.id)}"><span class="grow"><b>${esc(roomTitle(r))}</b><span class="meta">Closes in <span data-until="${r.closesAt}">${left(r.closesAt-now())}</span></span></span></button>`).join('')}</div>`:'<p class="meta">Answer a Call, or have yours answered, and a room opens for the two circles. It closes after 3 days.</p>'}
  <div class="eyebrow">People you’ve met <button data-act="sheet" data-v="meet">Meet someone</button></div>${S.met.length?`<div class="stack">${S.met.map(m=>{const o=m.ids.find(x=>x!==S.uid);return `<button class="thr" data-act="open" data-type="dm" data-v="${esc(m.id)}"><span class="av">${initials(nameOf(o))}</span><span class="grow"><b>${esc(nameOf(o))}</b><span class="meta">Scanned phones ${m.near?'near '+esc(m.near)+', ':''}${esc(ago(m.at))}</span></span></button>`}).join('')}</div>`:''}
  <p class="formula">No cold DMs. You can message someone from another circle only after you’ve scanned phones in person.</p>`}
function cityLeague(){
  const pts={},names={};
  const firstByCircle={};S.solves.forEach((s,i)=>{if(s.circle&&!firstByCircle[s.circle]){firstByCircle[s.circle]=1;pts[s.circle]=(pts[s.circle]||0)+decPts(i+1,s.hints);names[s.circle]=s.cname}});
  const seen=new Set();for(const c of S.checkins){const k=c.circle+'|'+c.drop;if(!c.circle||seen.has(k))continue;seen.add(k);pts[c.circle]=(pts[c.circle]||0)+10;names[c.circle]=c.cname}
  const ws=weekStart();for(const m of S.missions)if(m.when>=ws&&m.when<now())for(const x of new Map(Object.values(m.ins||{}).filter(v=>v&&v.circle).map(v=>[v.circle,v])).values()){pts[x.circle]=(pts[x.circle]||0)+15;names[x.circle]=x.cname}
  const td=new Set();for(const st of S.stamps)if(st.done&&st.done>=ws&&st.circle&&!td.has(st.circle+st.trail)){td.add(st.circle+st.trail);pts[st.circle]=(pts[st.circle]||0)+10;names[st.circle]=st.cname}
  const rows=Object.entries(pts).sort((a,b)=>b[1]-a[1]);
  const mine=pts[S.me.circle]||0,solved=S.solves.some(x=>x.circle===S.me.circle);
  const next=!S.me.circle?'join a circle to score':!solved?'solve the Decode, up to +10':cityDrops().length?'turn up to a drop, +10':'finish a trail, +10';
  return `<div class="card hot" style="margin-top:12px"><b>${S.me.circle?esc(S.circle?.name||'Your circle')+': '+mine+' point'+(mine===1?'':'s'):'No circle yet'}</b><p class="meta">Next: ${next}. Week ${weekNum()}, resets Monday.</p></div>
  ${rows.length?`<div class="card"><table class="lg"><thead><tr><th>#</th><th>Circle</th><th class="n">Points</th></tr></thead><tbody>${rows.map(([c,p],i)=>`<tr class="${c===S.me.circle?'me':''}"><td>${i+1}</td><td>${esc(names[c]||'A circle')}</td><td class="n">${p}</td></tr>`).join('')}</tbody></table></div>`:`<div class="card dash"><p class="meta">No points yet this week. Solve the Decode or turn up to a drop.</p></div>`}
  <details class="rules"><summary>How points work</summary><p class="meta">🧩 First Decode solve in each circle: up to 10, by solve order. 📍 Each drop a circle turns up to: 10. 🎯 Each Mission it shows up for: 15. 🥾 Each trail it finishes: 10.</p></details>`;
}

/* ---------- City: Missions and trails ---------- */
function missionCard(m){const t=now(),mine=m.cid===S.me.circle,live=msLive(m),in_=(m.ins||{})[S.uid],rec=msRecord(m.cid),nc_=Object.keys(m.confirms||{}).filter(c=>c!==m.cid).length,ni=Object.values(m.ins||{}).filter(Boolean).length;
  const past=m.when<t;const myV=(m.verdict||{})[S.uid];
  return `<div class="card" style="border-color:var(--good)"><div class="km"><span class="kind m">${mine?'Your circle’s Mission':'Proposed by '+esc(m.cname)} · ${esc(when(m.when))}</span><span class="meta">${ni} in</span></div>
  <p><b>${esc(m.title)}.</b> ${esc(m.desc)}</p>
  <div class="trust"><span>${esc(m.cname)}: hosted ${rec.hosted}, flagged ${rec.bad}</span><span>3 Reliability staked</span><span>${live?'live: '+nc_+' circles confirmed':nc_+' of 3 circles confirmed'}</span>${msSpot(m)?'<span>spot: '+esc(msSpot(m))+'</span>':m.when-2*HOUR>t?`<span class="cdchip">${in_?'spot revealed in':'spot goes to yes-sayers in'} <span data-until="${m.when-2*HOUR}">${left(m.when-2*HOUR-t)}</span></span>`:'<span>area only</span>'}</div>
  ${in_&&msRole(m)?`<div class="brief"><small>YOUR BRIEFING · ONLY YOU SEE THIS ONE</small>${esc(msRole(m))}</div>`:''}
  <div class="btns">${past?(in_&&myV===undefined?`<span class="meta" style="align-self:center">Did it happen as described?</span><button class="btn s" data-act="ms-verdict" data-v="${m.id}" data-x="y">Yes</button><button class="btn s ghost" data-act="ms-verdict" data-v="${m.id}" data-x="n">No</button>`:`<span class="meta">${myV===undefined?'Over.':'You said '+(myV?'it happened.':'it didn’t.')}</span>`)
    :`${!mine&&verified()&&!(m.confirms||{})[S.me.circle]&&S.me.circle?`<button class="btn s" data-act="ms-confirm" data-v="${m.id}">Confirm for ${esc(S.circle?.name||'us')}</button>`:''}${in_?`<button class="btn s ghost" data-act="ms-out" data-v="${m.id}">Can’t make it</button>`:`<button class="btn s ${live?'':'ghost'}" data-act="ms-in" data-v="${m.id}">I’m in</button>`}<button class="btn s ghost" data-act="sheet" data-v="mission" data-id="${m.id}">Map</button>`}</div></div>`}
function trailRow(tr){const s=myStamp(tr),n=(tr.stops||[]).length,t=now();const open=t>=tr.start&&t<tr.end;
  return `<button class="drop ${open?'open':''}" data-act="sheet" data-v="trail" data-id="${tr.id}"><span class="dk k-swap">TRL</span><span class="grow"><span class="when">${open?'On now · <span data-until="'+tr.end+'">'+left(tr.end-t)+'</span> left':t<tr.start?esc(when(tr.start)):'Over · '+esc(when(tr.end))}</span><b style="display:block">${esc(tr.title)}</b><span class="meta">By ${esc(tr.cname)} · ${n} stops, any order${s?` · you: ${stampN(s)} of ${n}`:''}</span></span></button>`}

