SHEETS["circle-start"]=(sh,close)=>{
  return `<h2>Your circle</h2>${circleStartForm()}${close}`;
};
SHEETS["invite"]=(sh,close)=>{
  return inviteSheet()||close;
};
SHEETS["meet"]=(sh,close)=>{
  {const code=S.pair;const live=code&&code.exp>now();
    return `<h2>Meet someone</h2><p class="meta">Face to face: one of you shows this, the other scans it with their phone camera or types the 6 digits. It works for 2 minutes. Then you can message each other.</p>
    ${live?`<div class="panel" style="text-align:center"><div class="qr big-qr">${qrSvg(appLink()+'#m'+code.code)}</div><div class="big">${esc(code.code)}</div><div class="meta">Expires in <span data-until="${code.exp}">${left(code.exp-now())}</span></div></div>`:`<div class="btns"><button class="btn" data-act="pair-show">Show my code</button></div>`}
    <form data-form="pair" style="margin-top:14px"><label class="f" for="pair-in">Or type theirs</label><div class="row"><input class="in-t grow" id="pair-in" data-f="pairin" inputmode="numeric" maxlength="6" value="${esc(F.pairin||'')}" placeholder="6 digits" autocomplete="off"><button class="btn" type="submit">Connect</button></div></form>
    <p class="meta">${S.backend==='server'?'The server checks the code, so nobody can connect without being shown it.':'Scanning opens INSANE on their phone with the code filled in.'}</p>${close}`}
};
