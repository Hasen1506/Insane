/* ---------- You ---------- */
function vYou(){
  const me=S.me;const js=journeys();const act=js.filter(j=>j.status==='active'),past=js.filter(j=>j.status!=='active');
  const log=(S.priv.log?.items||[]).slice(0,30);const pr=prefs();
  let out=consentBanner()+`<h1 class="v">${esc(me.name)}</h1><p class="lede">${me.handle?`<b style="font-family:var(--f-mono);letter-spacing:.06em">${esc(me.handle)}</b> in the city · `:''}${esc(me.cityName)} · ${esc(cellText(me.cell))}${me.near?' near '+esc(me.near):''}${S.circle?' · '+esc(S.circle.name):''} <button class="link" data-act="sheet" data-v="profile">Edit</button></p>`;
  out+=`<div class="eyebrow">Your journeys <button data-act="sheet" data-v="add-j">+ Add</button></div><p class="meta" style="margin:-4px 0 8px">Needs you keep doing, wants you reach over weeks, urges you do once. Your circle sees the counts, never your words.</p><div class="stack">${act.length?act.map(j=>jCard(j,false)).join(''):'<div class="card dash"><p class="meta">Nothing on the go.</p></div>'}</div>`;
  if(past.length)out+=`<div class="eyebrow">Finished and dropped</div><div class="stack">${past.slice(0,12).map(j=>`<div class="card"><span class="tag ${j.lane}">${LANES[j.lane].k}</span><span class="meta">${esc(j.status==='done'?'Done':'Dropped')} · ${esc(ago(j.ended||j.created))}</span><h3 style="margin-top:3px">${esc(j.read.what)}</h3></div>`).join('')}</div>`;
  out+=passport();
  out+=`<div class="eyebrow">Your story so far</div>${log.length?`<ul class="tl">${log.map(i=>`<li>${esc(i.t)}<small>${esc(ago(i.at))}</small></li>`).join('')}</ul>`:'<p class="meta">Everything you do here lands on this timeline: ticks, rungs, drops, Decode, things you said. Only you see it.</p>'}`;
  out+=`<div class="eyebrow">Go dark</div><div class="card"><p style="margin:0">1 to 24 hours, now or later, alone or with the circle. INSANE goes blank and holds every notification.</p><div class="btns"><button class="btn s" data-act="dark-setup">Set it up</button></div></div>`;
  out+=`<div class="eyebrow">Calm</div><div class="card"><label class="chk"><input type="checkbox" data-pref="calm" ${pr.calm?'checked':''}> <span><b>Calm mode.</b> No red dots or counts, no confetti or sounds, and Today shows less.</span></label>
   <label class="chk"><input type="checkbox" data-pref="sound" ${pr.sound?'checked':''}> <span><b>Sounds.</b> A soft click when you tick, solve or check in.</span></label>
   <label class="f">Quiet hours <small>no badges, no notifications</small></label><div class="row" style="gap:8px"><select class="in-t" data-quiet="from" aria-label="Quiet from"><option value="off" ${me.quiet?.off?'selected':''}>Off</option>${[20,21,22,23,0].map(h=>`<option value="${h}" ${!me.quiet?.off&&(me.quiet?.from??23)===h?'selected':''}>${String(h).padStart(2,'0')}:00</option>`).join('')}</select><span class="meta">to</span><select class="in-t" data-quiet="to" aria-label="Quiet until">${[6,7,8,9,10].map(h=>`<option value="${h}" ${(me.quiet?.to??8)===h?'selected':''}>${String(h).padStart(2,'0')}:00</option>`).join('')}</select></div></div>`;
  out+=`<div class="eyebrow">Notifications</div><div class="card">${notifCard()}</div>`;
  out+=helpEntry(); // WS-B
  out+=accountCard()+safetyCard();
  out+=`<div class="eyebrow">Your data</div><div class="card"><p style="margin-top:0">Saved: your name, a ${esc(cellText(me.cell))} and your city, your journeys and timeline (private to you)${me.prec==='exact'?', your exact pin (private to you)':''}, what you post, and the steps you’ve reached (for example, “joined a circle”) with the days you opened the app, to learn what works. No location history. No contacts.</p>
   <div class="btns"><button class="btn s ghost" data-act="export">Download my data</button><button class="btn s ghost" data-act="del-ask">Delete everything</button>${S.backend==='server'?'<button class="btn s ghost" data-act="signout">Sign out</button>':''}</div>
   ${S.ui.confirm==='delete'?`<div class="panel" style="border-color:var(--stamp)"><b>Delete everything?</b><p class="meta">${S.backend==='server'?'Your profile, journeys, timeline, posts, progress, memberships and every signed-in device go for good, and you’re signed out. Messages you sent stay in their threads, signed “Former member”. We email you to confirm.':'Your journeys, timeline, profile and posts go for good. Messages you sent stay in their threads, signed with your name.'}</p><div class="btns"><button class="btn s red" data-act="del-yes">Delete for good</button><button class="btn s ghost" data-act="del-no">Keep it</button></div></div>`:''}
   ${S.exportHtml?'<p class="meta">Saved <b>insane-my-data.html</b>: your messages, ledger and posts in a page you can read.</p>':''}${S.exportText?`<label class="f" for="exp">Your data as JSON</label><textarea class="in-t" id="exp" readonly style="min-height:140px;font-family:var(--f-mono);font-size:12px">${esc(S.exportText)}</textarea>`:''}</div>`;
  out+=`<div class="eyebrow">How this copy works</div><div class="card">${howItWorks()}</div>`;
  if(S.isOwner)out+=`<div class="eyebrow">Test results <button data-act="stats">${S.stats?'Refresh':'Load'}</button></div>${S.stats?statsView():'<p class="meta">Only you see this. It counts how far each person got, from the step records above.</p>'}`;
  return out;
}
function howItWorks(){
  const rows=S.backend==='server'?[['Sign-in','Email and a 6-digit code. A session lasts 60 days.'],['Data','Live through your INSANE server, with storage rules on every path.'],['Checks','Door codes, Decode answers and meeting codes are checked on the server. Midnight and sealed messages stay on it until they open.'],['Map','OpenStreetMap streets. GPS when you allow it.'],['Notifications','Real push to this phone or computer once you turn it on.']]
   :S.backend==='claude'?[['Sign-in','Your Claude account. Friends join when you invite them by email as Editors.'],['Data','Live between everyone invited, with storage rules on every path.'],['Checks','Door codes are stored only as a slow hash. Decode answers, unopened Midnight messages and a Mission’s exact spot are only hidden by the page, so someone determined could dig them out. The INSANE server version checks and hides them itself.'],['Trails','claude.ai pages can’t read your location, so trail stamps here are on your word and marked that way. On the server version they’re checked by GPS.'],['Map','The world map is bundled with the app: coastlines, borders, roads, towns. claude.ai pages can’t load street tiles or read GPS, so each place links out to OpenStreetMap.'],['Notifications','claude.ai pages can’t send them. The bell and red dots show what’s new while you’re here.']]
   :[['Demo','Everything stays in this browser. Open the shared link, or run the INSANE server, to play with other people.']];
  return `<div class="real" style="font-size:13px">${rows.map(([a,b])=>`<b class="y">${a}</b><span>${b}</span>`).join('')}</div>`;
}
function notifCard(){
  if(S.backend!=='server')return `<p class="meta" style="margin:0">${S.backend==='claude'?'Pages inside claude.ai can’t send notifications. Use the bell at the top. On the INSANE server version, notifications go to your phone.':'Notifications need the INSANE server.'}</p>`;
  const st=S.pushState||('Notification' in window?Notification.permission:'unsupported');
  if(st==='unsupported')return `<p class="meta" style="margin:0">This browser can’t take notifications. On iPhone, add INSANE to your Home Screen first (Share → Add to Home Screen), then open it from there.</p>`;
  if(st==='granted'&&S.pushOn)return `<p style="margin:0"><b>On.</b> You hear about messages in threads you’re in, drops opening near you, and Midnight. Never during quiet hours or while you’re dark.</p>`;
  if(st==='denied')return `<p class="meta" style="margin:0">Notifications are blocked for this site. Allow them in your browser’s site settings.</p>`;
  return `<p style="margin:0">Hear about messages in your threads, drops opening near you, and Midnight. Nothing during quiet hours.</p><div class="btns"><button class="btn s" data-act="push-on">Turn on notifications</button></div>`;
}
// A stamp for everything you did out in the world. Collecting them is the point.
function passport(){
  const st=[];
  for(const c of S.myCheckins||[])st.push({k:'drop',t:c.venue||'A drop',s:new Date(c.at).toLocaleDateString([],{day:'numeric',month:'short'}),c:'k-'+(c.kind||'offer')});
  for(const m of S.met)st.push({k:'met',t:nameOf(m.ids.find(x=>x!==S.uid)),s:'met '+new Date(m.at).toLocaleDateString([],{day:'numeric',month:'short'}),c:'k-swap'});
  for(const s of S.mySolves||[])st.push({k:'dec',t:'Decode',s:'week '+String(s.week).split('W')[1],c:'k-dare'});
  for(const j of journeys().filter(j=>j.status==='done'))st.push({k:'done',t:j.read.what,s:LANES[j.lane].k.toLowerCase()+' done',c:'k-offer'});
  return `<div class="eyebrow">Passport · ${st.length} stamp${st.length===1?'':'s'}</div>${st.length?`<div class="passport">${st.slice(0,24).map((x,i)=>`<div class="pstamp ${x.c}" style="transform:rotate(${((fnvN(x.t+i)%11)-5)}deg)"><span>${esc(x.k==='drop'?'DROP':x.k==='met'?'MET':x.k==='dec'?'SOLVED':'DONE')}</span><b>${esc(x.t)}</b><small>${esc(x.s)}</small></div>`).join('')}</div>`:'<p class="meta">Check in at a drop, meet someone, solve a Decode or finish a journey, and it gets stamped here.</p>'}`;
}
function statsView(){
  const st=S.stats;const steps=[['signedIn','Opened the app'],['named','Picked a name'],['nwu','Typed a need, want or urge'],['circle','In a circle'],['msg','Sent a message'],['tick','Ticked a journey'],['decodeTry','Tried the Decode'],['decodeSolve','Solved the Decode'],['checkin','Checked in at a drop'],['post','Posted to the feed'],['met','Met someone in person'],['dark','Went dark']];
  const n=st.length||1;
  const ret=k=>st.filter(e=>{const f=e.first?.signedIn;if(!f)return false;const d0=dayStart(f);return (e.days||[]).some(d=>{const t=new Date(d+'T12:00').getTime();return t>=d0+k*DAY&&t<d0+(k+1)*DAY})}).length;
  const old=k=>st.filter(e=>e.first?.signedIn&&now()-e.first.signedIn>(k+1)*DAY).length;
  const med=arr=>{if(!arr.length)return '–';arr.sort((a,b)=>a-b);const m=arr[Math.floor(arr.length/2)];return m<HOUR?Math.round(m/MIN)+' min':(m/HOUR).toFixed(1)+' h'};
  const tCircle=med(st.filter(e=>e.first?.circle&&e.first?.signedIn).map(e=>e.first.circle-e.first.signedIn));
  return `<div class="card"><div class="stat"><span class="h">Step</span><span class="h">People</span><span class="h">Share</span>${steps.map(([k,l])=>{const c=st.filter(e=>e.first&&e.first[k]).length;return `<span>${l}</span><span>${c}</span><span>${Math.round(c/n*100)}%</span>`}).join('')}</div>
  <p class="meta" style="margin-top:10px">${st.length} people. Typical time from opening to joining a circle: ${tCircle}. Came back the next day: ${ret(1)} of ${old(1)} who’ve had a day. Came back on day 7: ${ret(7)} of ${old(7)}.</p></div>`;
}

