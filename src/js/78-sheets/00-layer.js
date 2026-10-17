/* ---------- sheets ---------- */
function layer(){
  let h='';
  if(isDark(S.me)){const back=F.darkBack;const wth=S.members.filter(m=>m.id!==S.uid&&isDark(m)).map(m=>m.name);h+=`<div class="darkall" role="dialog" aria-label="Gone dark"><div class="dk2">GONE DARK</div><div class="breath" aria-hidden="true"></div><div class="clock" data-until="${S.me.darkUntil}">${left(S.me.darkUntil-now())}</div><p>INSANE is blank until then. Go and do the thing.</p>${wth.length?`<p>Dark with you: <b>${esc(wth.join(' · '))}</b></p>`:''}<p style="font-size:13px;opacity:.75">${S.me.darkWith&&!wth.length?'You asked your circle to go dark with you.':''} Calls and emergency numbers always work. This screen is all INSANE shows while you’re dark: no feed, no badges.</p>${back?`<p>Come back early? Your circle will see you came back after ${esc(left(now()-(S.me.darkFrom||now())))} of ${S.me.darkH||'?'} h. No penalty.</p><div class="btns" style="justify-content:center"><button class="btn" data-act="dark-end">Come back now</button><button class="btn" data-act="dark-stay">Stay dark</button></div>`:`<div class="btns" style="justify-content:center"><button class="btn" data-act="dark-back">Come back early</button></div>`}</div>`}
  const sh=S.ui.sheet;if(!sh)return h+tourHtml()+toastHtml();
  return h+`<div class="sheet-bg" data-act="sheet-bg"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${sheetBody(sh)}</div></div>`+toastHtml();
}
// v0.8's sheetBody() switch, as a registry: SHEETS['name']=(sh,close)=>html, bodies unchanged.
const SHEETS=Object.create(null);
function sheetBody(sh){
  const close=`<div class="btns"><button class="btn ghost wide" data-act="sheet-close">Close</button></div>`;
  const f=SHEETS[sh.t];if(f)return f(sh,close);
  return close;
}
