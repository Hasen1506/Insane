/* ---------- the + sheet ---------- */
// The + sheet is grouped and gated by unlocks: MAKE_ITEM, MAKE_GROUPS and makeSheetV09() are in 96-unlock.js.
function makeSheet(){return makeSheetV09()}
function inviteSheet(){const c=S.circle;if(!c)return '';return `<h2>Bring someone in</h2><p class="meta">They scan this with their phone camera, or type the code. Circles stop at 8.</p><div class="panel" style="text-align:center"><div class="qr big-qr">${qrSvg(appLink()+'#c'+c.code)}</div><div class="big">${esc(c.code)}</div><div class="btns" style="justify-content:center"><button class="btn s ghost" data-act="copy" data-v="${esc(appLink()+'#c'+c.code)}">Copy invite link</button></div></div><p class="meta">Next time you’re together, scan each other’s phones (Meet someone). Two of you meeting in person unlocks posting in the City.</p><div class="btns"><button class="btn ghost wide" data-act="sheet-close">Close</button></div>`}

/* photos for dares and rungs: shrunk on the phone to about 50 KB, kept 24 hours */
function shrinkPhoto(file){return new Promise((ok,bad)=>{const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{const k=Math.min(1,640/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);let q=.72,out=c.toDataURL('image/jpeg',q);while(out.length>110000&&q>.3){q-=.12;out=c.toDataURL('image/jpeg',q)}ok(out)};
  img.onerror=()=>{URL.revokeObjectURL(url);bad(new Error('not an image'))};img.src=url})}
let clipSweep=0;
function sweepClips(){if(now()-clipSweep<5*MIN||!S.me?.circle)return;clipSweep=now();for(const c of S.clips)if(c.exp<now())S.db.doc(`circles/${S.me.circle}/clips/${c.id}`).delete().catch(()=>{})}

