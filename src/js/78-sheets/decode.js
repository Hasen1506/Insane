SHEETS["decode"]=(sh,close)=>{
  {const d=decodeCard(false);const st=d.st;const tried=(S.priv.dec&&S.priv.dec[weekKey()])||0;
    return `<div class="meta" style="color:var(--ball)">Decode · week ${weekNum()} · ${esc(S.me.cityName)}</div><h2>${esc(d.cl.q)}</h2>${d.info}
    <div style="margin-top:8px">${d.cl.h.map((h,i)=>`<div class="hint ${st.hints[i]?'on':''}">${st.hints[i]?(h?esc(h):'Hint on its way…'):`Hint ${i+1} unlocks at ${HINT_AT[i]} solves in the city, or on ${['Tuesday','Thursday','Saturday'][i]}`}</div>`).join('')}</div>
    ${d.status?`<p>${d.status}</p>`:''}
    ${!d.mine&&!st.revealed?`<form data-form="decode" class="row" style="margin-top:12px"><label class="sr" for="dec-a">Answer</label><input class="in-t grow" id="dec-a" data-f="deca" value="${esc(F.deca||'')}" placeholder="One word" autocomplete="off" autocapitalize="characters"><button class="btn" type="submit">Try</button></form><p class="meta">${tried?tried+' tr'+(tried>1?'ies':'y')+' so far. ':''}Points go by solve order and drop by 15 for each hint that’s out when you solve. Every solve brings the answer 3 hours closer for everyone, so waiting gets you the answer, not the points.${d.cl.local?' Here the answer is checked on your phone, on your honour.':''}</p>`:''}
    ${close}`}
};
