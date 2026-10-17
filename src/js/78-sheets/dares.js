SHEETS["proof"]=(sh,close)=>{
  {const daily=sh.id==='daily';const d=daily?dailyDare():S.dares.find(x=>x.id===sh.id);if(!d)return close;
    return `<div class="meta">${daily?'Today’s daily dare':esc(nameOf(d.by))+' dared you'} · ${esc(d.level)}/10</div><h2>${esc(d.text)}</h2><p class="meta">Add a line, a photo, both or neither. A photo goes in the circle’s clips for 24 hours, then it’s deleted.</p>
    <label class="f" for="pr-note">How did it go? <small>optional</small></label><input class="in-t" id="pr-note" data-f="prnote" value="${esc(F.prnote||'')}" maxlength="120" placeholder="The barista played along">
    <label class="f" for="pr-photo">Photo <small>optional</small></label><input class="in-t" type="file" accept="image/*" id="pr-photo" data-clip="1">${safeImg(F.clipImg)?`<img src="${safeImg(F.clipImg)}" alt="Your photo" style="max-width:100%;border-radius:10px;margin-top:8px;display:block">`:''}
    <div class="btns"><button class="btn red" data-act="dare-did" data-v="${esc(sh.id)}">Done it</button><button class="btn ghost" data-act="sheet-close">Cancel</button></div>`}
};
SHEETS["dare"]=(sh,close)=>{
  {const to=F.dareto||'';const lv=F.darelvl||3;
    return `<h2>Dare someone, or fill the jar</h2>
    <label class="f">Who</label><div class="chips"><button class="chip ${!to?'on':''}" data-act="dare-to" data-v="">The jar</button>${S.members.filter(m=>m.id!==S.uid).map(m=>`<button class="chip ${to===m.id?'on':''}" data-act="dare-to" data-v="${m.id}">${esc(m.name)}</button>`).join('')}</div>
    <label class="f" for="dr-text">The dare</label><input class="in-t" id="dr-text" data-f="drtext" value="${esc(F.drtext||'')}" maxlength="100" placeholder="Order your coffee in the voice of a movie trailer">
    <label class="f">How insane <small>out of 10</small></label><div class="chips">${[1,2,3,4,5,6].map(n=>`<button class="chip ${lv===n?'on':''}" data-act="dare-lvl" data-v="${n}">${n}</button>`).join('')}</div>
    <p class="meta">${to?esc(nameOf(to))+' can accept it or say “not this one”, no reason needed.':'The jar feeds the daily dare. Anything you add can come up from tomorrow.'} Nothing that could hurt anyone, nothing with strangers’ bodies, money or the law. The jar stops at 6: anything wilder needs a venue with staff.</p>
    <div class="btns"><button class="btn" data-act="dare-add">${to?'Send the dare':'Put it in the jar'}</button><button class="btn ghost" data-act="sheet-close">Cancel</button></div>`}
};
SHEETS["clip"]=(sh,close)=>{
  {const c=S.clips.find(x=>x.id===sh.id);if(!c||!safeImg(c.img))return `<p>This clip has gone.</p>${close}`;
    return `<div class="meta">${esc(nameOf(c.by))} · ${esc(ago(c.at))} · gone in <span data-until="${c.exp}">${left(c.exp-now())}</span></div><h2>${esc(c.what)}</h2>${c.note?`<p style="margin:0">${esc(c.note)}</p>`:''}<img src="${safeImg(c.img)}" alt="${esc(c.what)}" style="width:100%;border-radius:12px;margin-top:8px;display:block">${c.by===S.uid?`<div class="btns"><button class="link" data-act="clip-del" data-v="${c.id}">Delete it now</button></div>`:''}${close}`}
};
