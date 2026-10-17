SHEETS["add-j"]=(sh,close)=>{
  {const lane=F.jlane||'need';const L=LANES[lane];
    return `<h2>Add a need, want or urge</h2><div class="chips" style="margin:8px 0">${['need','want','urge'].map(k=>`<button class="chip ${lane===k?'on':''}" data-act="jlane" data-v="${k}">${LANES[k].k}: ${LANES[k].hz}</button>`).join('')}</div>
    <label class="f" for="j-text">${esc(L.lead)}</label><input class="in-t" id="j-text" data-f="jtext" data-read="sheet" value="${esc(F.jtext||'')}" placeholder="${esc(L.ph)}" maxlength="90">
    <div class="ex">${L.ex.map(e=>`<button data-act="j-ex" data-v="${esc(e)}">${esc(e)}</button>`).join('')}</div><div id="read-sheet">${readCard(readUrge(lane,F.jtext))}</div>
    <div class="btns"><button class="btn" data-act="j-add">Start it</button>${CANCEL}</div>`}
};
SHEETS["j-menu"]=(sh,close)=>{
  {const j=journeys().find(x=>x.id===sh.id);if(!j)return close;
    return `<h2>${esc(j.read.what)}</h2><p class="meta">You wrote: “${esc(j.text)}”</p>
    ${j.read.kind==='Ladder'?`<label class="f">Your rungs <small>only you see these</small></label>${(j.rungsText||[]).map((r,i)=>`<input class="in-t" style="margin-top:6px" id="rung-${i}" data-rung="${i}" value="${esc(F['rung'+i]??r)}" placeholder="Rung ${i+1}" maxlength="60">`).join('')}<div class="btns"><button class="btn s" data-act="rungs-save" data-v="${j.id}">Save rungs</button></div>`:''}
    <div class="btns"><button class="btn" data-act="j-done" data-v="${j.id}">Mark as done</button><button class="btn ghost" data-act="j-drop" data-v="${j.id}">Drop it</button></div>${close}`}
};
