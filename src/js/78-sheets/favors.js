SHEETS["fvdone"]=(sh,close)=>{
  {const f=S.favors.find(x=>x.id===sh.id);if(!f)return close;const h=F.fvh2||f.h;
    return `<h2>${esc(f.what)}</h2><p class="meta">For ${esc(nameOf(f.asker))}. They guessed about ${hrs(f.h).slice(1)}. Adjust it if it took more or less; they confirm before it’s logged.</p><div class="chips">${FAVOR_H.map(([v,n])=>`<button class="chip ${h===v?'on':''}" data-act="fv-h2" data-v="${v}">${n}</button>`).join('')}</div><div class="btns"><button class="btn" data-act="fv-done-save" data-v="${f.id}">Done: ${hrs(h).slice(1)}</button><button class="btn ghost" data-act="sheet-close">Cancel</button></div>`}
};
