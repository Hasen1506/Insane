SHEETS["midnight"]=(sh,close)=>{
  return `<h2>Write it unsigned</h2><p class="meta">Goes to ${esc(S.circle?.name||'your circle')} at midnight. Your name isn’t saved anywhere, not even by INSANE. Two flags from the circle hide it.</p>
    <label class="sr" for="mn-text">Message</label><textarea class="in-t" id="mn-text" data-f="mntext" maxlength="400" placeholder="Whoever keeps doing the washing up at 2am: thank you.">${esc(F.mntext||'')}</textarea>
    <label class="f">When</label><div class="chips">${[['tonight','Tonight at midnight'],['week','Some night this week']].map(([v,n])=>`<button class="chip ${(F.mnwhen||'week')===v?'on':''}" data-act="mnwhen" data-v="${v}">${n}</button>`).join('')}</div>
    <p class="meta">“Some night this week” picks the night at random, so nobody can match the timing to you.</p>
    <div class="btns"><button class="btn" data-act="mn-send">Queue it</button><button class="btn ghost" data-act="sheet-close">Cancel</button></div>`;
};
SHEETS["seal"]=(sh,close)=>{
  {const opts=sealOpts();const sel=F.sealw??0;
    return `<h2>Seal a message</h2><p class="meta">Signed with your name. Nobody can read it before it opens, you included.</p>
    <label class="sr" for="seal-text">Message</label><textarea class="in-t" id="seal-text" data-f="sealtext" maxlength="600" placeholder="By the time you read this, I’ll have run my first 10k.">${esc(F.sealtext||'')}</textarea>
    <label class="f">Opens</label><div class="chips">${opts.map((o,i)=>`<button class="chip ${sel===i?'on':''}" data-act="sealw" data-v="${i}">${esc(o[0])}</button>`).join('')}</div><p class="meta">${esc(when(opts[sel][1]))}</p>
    <div class="btns"><button class="btn" data-act="seal-send">Seal it</button><button class="btn ghost" data-act="sheet-close">Cancel</button></div>`}
};
function sealOpts(){const t=now();const ny=new Date(new Date().getFullYear()+(new Date().getMonth()===11&&new Date().getDate()===31?1:0),11,31,23,59).getTime();
  const c=S.circle?.createdAt||t;let bd=new Date(c);bd.setFullYear(bd.getFullYear()+1);
  return [['In 3 months',t+91*DAY],['New Year’s Eve',ny],['A year from now',t+365*DAY],['Our circle’s first birthday',Math.max(bd.getTime(),t+DAY)]]}
