SHEETS["activity"]=(sh,close)=>{
  {const a=activity();
    return `<h2>What’s new</h2>${a.length?`<div class="stack">${a.map(x=>`<button class="act-row ${x.fresh?'fresh':''}" data-act="${x.act}" ${Object.entries(x.data||{}).map(([k,v])=>`data-${k}="${esc(v)}"`).join(' ')}><span class="grow"><b>${esc(x.title)}</b><span class="meta">${esc(x.sub||'')}${x.at?' · '+esc(ago(x.at)):''}</span></span></button>`).join('')}</div>`:'<div class="card caught"><h3>Nothing new</h3><p class="meta">You’re up to date.</p></div>'}${close}`}
};
SHEETS["profile"]=(sh,close)=>{
  return `<h2>Edit profile</h2><label class="f" for="pf-name">Name</label><input class="in-t" id="pf-name" data-f="pfname" value="${esc(F.pfname??S.me.name)}" maxlength="24"><label class="f" for="pf-handle">Handle <small>what the city sees</small></label><input class="in-t" id="pf-handle" data-f="pfhandle" value="${esc(F.pfhandle??(S.me.handle||''))}" maxlength="16" style="text-transform:uppercase;font-family:var(--f-mono)">
    <div class="eyebrow">Your place</div>${picker('home')}
    <p class="meta">Changing city changes your feed, Decode and league. Your circle stays as it is.</p>
    <div class="btns"><button class="btn" data-act="pf-save">Save</button><button class="btn ghost" data-act="sheet-close">Cancel</button></div>`;
};
