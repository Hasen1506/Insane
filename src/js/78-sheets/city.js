// A 3-step wizard header (C51): What → Where → When.
const wizBar=(n,names)=>`<div class="wiz" aria-hidden="true">${names.map((_,i)=>`<span class="${i<n?'on':''}"></span>`).join('')}</div><div class="wizlbl">Step ${n} of ${names.length}: ${names[n-1]}</div>`;
SHEETS["mission"]=(sh,close)=>{
  {const m=S.missions.find(x=>x.id===sh.id);if(!m)return `<p>This Mission has gone.</p>${close}`;
    return `<h2>${esc(m.title)}</h2>${missionCard(m)}<div class="mapslot short" data-map="mission"></div><p class="meta" style="margin-top:4px">The green circle is the area. ${msSpot(m)?'The exact spot: <b>'+esc(msSpot(m))+'</b>':'The exact spot goes to people who said yes, 2 hours before.'}</p>${m.cid===S.me.circle?`<div class="btns"><button class="link" data-act="ms-del" data-v="${m.id}">Withdraw it</button></div>`:''}${close}`}
};
SHEETS["propose"]=(sh,close)=>{
  {if(!S.me.circle||!verified())return `<h2>Propose a Mission</h2><div class="lock">Only circles that have met in person can propose: two of you scan each other’s phones and it unlocks. Anyone can join a Mission.</div><div class="btns"><button class="btn" data-act="sheet" data-v="meet">Meet someone</button><button class="btn ghost" data-act="sheet-close">Close</button></div>`;
    return `<h2>Propose a Mission</h2><ul class="rl"><li>A public place, in daylight</li><li>Nobody is the target and nobody pays</li><li>Your circle stakes 3 Reliability, lost if it doesn’t happen as described</li><li>Goes live when 3 other circles confirm</li><li>The exact spot only goes to people who said yes, 2 hours before</li></ul>
    ${wizBar(F.msStep||1,['What','Where','When'])}
    ${(F.msStep||1)===1?`<label class="f" for="ms-title">Name it</label><input class="in-t" id="ms-title" data-f="mstitle" value="${esc(F.mstitle||'')}" maxlength="40" placeholder="The Slow Walk">
    <label class="f" for="ms-desc">What happens</label><textarea class="in-t" id="ms-desc" data-f="msdesc" maxlength="240" placeholder="Everyone crosses the bridge at one step every five seconds, in total silence.">${esc(F.msdesc||'')}</textarea>
    <label class="f" for="ms-roles">Secret briefings <small>optional, one per line: each person gets one</small></label><textarea class="in-t" id="ms-roles" data-f="msroles" maxlength="600" placeholder="Freeze mid-laugh&#10;Freeze pointing at the sky">${esc(F.msroles||'')}</textarea>
    <div class="btns"><button class="btn" data-act="ms-step" data-v="2">Next: where</button>${CANCEL}</div>`
    :(F.msStep||1)===2?`<div class="sub">${picker('drop')}</div><p class="meta">People see a 350 m circle around your pin, nudged so it doesn’t give the spot away. The pin and the line below go only to people who said yes, 2 hours before.</p>
    <label class="f" for="ms-spot">Exact spot, in words <small>hidden until 2 h before</small></label><input class="in-t" id="ms-spot" data-f="msspot" value="${esc(F.msspot||'')}" maxlength="80" placeholder="The steps under the clock">
    <div class="btns"><button class="btn" data-act="ms-step" data-v="3">Next: when</button><button class="btn ghost" data-act="ms-step" data-v="1">Back</button></div>`
    :`<div class="row" style="gap:8px"><div class="grow"><label class="f" for="ms-date">Day</label><input class="in-t" type="date" id="ms-date" data-f="msdate" value="${esc(F.msdate||ymd(now()+3*DAY))}"></div><div class="grow"><label class="f" for="ms-time">Time</label><input class="in-t" type="time" id="ms-time" data-f="mstime" value="${esc(F.mstime||'13:00')}"></div></div>
    <p class="meta">At least two hours from now. It goes live when 3 other circles confirm.</p>
    <div class="btns"><button class="btn" data-act="ms-create">Send it to the city</button><button class="btn ghost" data-act="ms-step" data-v="2">Back</button></div>`}`}
};
SHEETS["trail-new"]=(sh,close)=>{
  {const stops=F.trstops||[];if(!S.me.circle)return `<h2>Make a trail</h2><p class="meta">Join a circle first: trails go out under a circle’s name.</p>${close}`;
    return `<h2>Make a trail</h2><p class="meta">3 to 6 stops your circle likes, walked in any order inside a window, with a short dare at each. Circles that finish them all go in the draw.</p>
    ${wizBar(F.trStep||1,['What','Where','When'])}
    ${(F.trStep||1)===1?`<label class="f" for="tr-title">Name</label><input class="in-t" id="tr-title" data-f="trtitle" value="${esc(F.trtitle||'')}" maxlength="40" placeholder="The Bridges Trail">
    <div class="btns"><button class="btn" data-act="tr-step" data-v="2">Next: the stops</button>${CANCEL}</div>`
    :(F.trStep||1)===2?`<div class="eyebrow">Stops · ${stops.length} of 6</div>${stops.length?`<ol class="tasks">${stops.map((x,i)=>`<li><span><b>${i+1}. ${esc(x.name)}</b>${x.dare?' · '+esc(x.dare):''}</span><button class="link" data-act="tr-rm" data-i="${i}">remove</button></li>`).join('')}</ol>`:''}
    ${stops.length<6?`<div class="card" style="margin-top:8px"><label class="f" for="tr-sname" style="margin-top:0">Stop ${stops.length+1}</label><input class="in-t" id="tr-sname" data-f="trsname" value="${esc(F.trsname||'')}" maxlength="40" placeholder="The river steps"><label class="f" for="tr-sdare">Dare at this stop <small>optional</small></label><input class="in-t" id="tr-sdare" data-f="trsdare" value="${esc(F.trsdare||'')}" maxlength="80" placeholder="Count the arches out loud">${picker('drop')}<div class="btns"><button class="btn s" data-act="tr-add">Add this stop</button></div></div>`:''}
    <div class="btns"><button class="btn" data-act="tr-step" data-v="3" ${stops.length<3?'disabled':''}>${stops.length<3?`Add ${3-stops.length} more stop${3-stops.length>1?'s':''}`:'Next: when'}</button><button class="btn ghost" data-act="tr-step" data-v="1">Back</button></div>`
    :`<div class="row" style="gap:8px"><div class="grow"><label class="f" for="tr-date">Day</label><input class="in-t" type="date" id="tr-date" data-f="trdate" value="${esc(F.trdate||today())}"></div><div class="grow"><label class="f" for="tr-from">From</label><input class="in-t" type="time" id="tr-from" data-f="trfrom" value="${esc(F.trfrom||'12:00')}"></div><div class="grow"><label class="f" for="tr-to">Until</label><input class="in-t" type="time" id="tr-to" data-f="trto" value="${esc(F.trto||'14:00')}"></div></div>
    <div class="btns"><button class="btn" data-act="tr-create" ${stops.length<3?'disabled':''}>Publish the trail</button><button class="btn ghost" data-act="tr-step" data-v="2">Back</button></div>`}`}
};
SHEETS["trail"]=(sh,close)=>{
  {const tr=S.trails.find(x=>x.id===sh.id);if(!tr)return `<p>This trail has gone.</p>${close}`;const st=myStamp(tr),t=now(),open=t>=tr.start&&t<tr.end;const fin=S.stamps.filter(x=>x.trail===tr.id&&x.done);const w=t>=tr.end?drawWinner(tr,fin):null;
    return `<div class="meta"><span class="tag k">Trail</span>by ${esc(tr.cname)} · ${esc(when(tr.start))} to ${esc(new Date(tr.end).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))}</div><h2>${esc(tr.title)}</h2><div class="mapslot short" data-map="trail"></div>
    <ol class="tasks">${tr.stops.map((x,i)=>{const got=st&&(st.stops||{})[i];return `<li class="${got?'done':''}"><span><b>${i+1}. ${esc(x.name)}</b>${x.dare?`<br><span class="meta">Dare: ${esc(x.dare)}</span>`:''}</span>${got?`<b>${got.how==='gps'?'stamped':'on your word'}</b>`:open&&S.me.circle?`<button class="btn s" data-act="tr-stamp" data-v="${tr.id}" data-i="${i}">Stamp</button>`:''}</li>`}).join('')}</ol>
    <p class="meta">${open?'No clock between stops: walking pace wins the same as running. Stamping checks your phone’s location: you need to be within 60 m of the stop. Where the page can’t read your location, the stamp is <b>on your word</b> and marked that way for everyone.':t<tr.start?'Opens '+esc(when(tr.start))+'.':'Over.'}</p>
    <p class="meta">${fin.length} finished${fin.length?': '+esc([...new Set(fin.map(f=>f.cname))].join(', ')):''}.</p>
    ${w?`<div class="drawbox"><div class="meta">The draw</div><div class="drawname won">${esc(fin.find(f=>f.circle===w)?.cname||'a circle')}</div><p class="meta">Worked out in the open from the circles that finished, the same way as drops.</p></div>`:''}${close}`}
};
