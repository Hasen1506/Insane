/* ---------- safety, moderation, legal and account (WS-D) ---------- */
// The Midnight name screen and the dare keyword screen: a copy of server/names.js between the markers,
// for instant feedback. The server's copy is the one that counts. test/unit/safety.test.js keeps them identical.
const NAMES=(()=>{
// <names>
// Look-alike letters from other scripts that people use to dodge a filter (Cyrillic/Greek → Latin).
const CONF = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'м': 'm', 'т': 't', 'н': 'h', 'в': 'b', 'ν': 'v', 'ο': 'o', 'α': 'a', 'ρ': 'p', 'τ': 't', 'ι': 'i', 'κ': 'k', 'ε': 'e', 'υ': 'u', 'ı': 'i', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'đ': 'd', 'ł': 'l', 'ħ': 'h' };
// Case-fold, take accents and combining marks off, drop invisible format characters (zero-width
// space/joiners, bidi controls, soft hyphen) and fold compatibility forms (full-width, ligatures).
function fold(s) {
  let t = String(s == null ? '' : s).normalize('NFKD').toLowerCase().normalize('NFKD').replace(/[\p{M}\p{Cf}]/gu, '');
  t = t.replace(/[\u0430-\u045f\u0370-\u03ffıßæœøđłħ]/g, c => CONF[c] || c);
  return t;
}
// Scripts written without spaces between words: a name inside a longer run still counts.
const CONTINUA = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Arabic}\p{Script=Hebrew}]/u;
// Every piece of a name or handle with 2 or more letters: "كافيا Kavya" -> كافيا, kavya; "RAVI42" -> ravi, ravi42.
function nameTokens(s) {
  const f = fold(s), out = new Set();
  for (const m of f.matchAll(/\p{L}+/gu)) if ([...m[0]].length >= 2) out.add(m[0]);
  for (const m of f.matchAll(/[\p{L}\p{N}]+/gu)) if ([...m[0]].length >= 2 && /\p{L}/u.test(m[0])) out.add(m[0]);
  return out;
}
// A handle is matched whole: "RAVI42" -> ravi42, ravi; "LOW TIDE" -> the phrase "low tide" (its words
// alone, "low" and "tide", are everyday words, so they are not blocked on their own).
function handleTerms(h) {
  const words = [...fold(h).matchAll(/[\p{L}\p{N}]+/gu)].map(m => m[0]).filter(w => /\p{L}/u.test(w));
  if (words.length <= 1) return { tokens: nameTokens(h), phrase: null };
  return { tokens: new Set(), phrase: words.join(' ') };
}
function textTokens(f) {
  const out = new Set();
  for (const m of f.matchAll(/\p{L}+/gu)) out.add(m[0]);
  for (const m of f.matchAll(/[\p{L}\p{N}]+/gu)) out.add(m[0]);
  return out;
}
// The first token of another member's name or handle found in text, or null. people: the OTHER
// members, [{name, handle}]; the writer's own name is allowed unless someone else shares a piece of it.
function nameHit(text, people) {
  const f = fold(text), words = textTokens(f);
  const flat = ' ' + [...f.matchAll(/[\p{L}\p{N}]+/gu)].map(m => m[0]).join(' ') + ' ';
  const theirs = new Set(), phrases = new Set();
  for (const p of people || []) {
    if (!p) continue;
    for (const t of nameTokens(p.name)) theirs.add(t);
    const h = handleTerms(p.handle); for (const t of h.tokens) theirs.add(t); if (h.phrase) phrases.add(h.phrase);
  }
  for (const t of theirs) {
    if (words.has(t)) return t;
    if (CONTINUA.test(t) && f.includes(t)) return t;
  }
  for (const ph of phrases) if (flat.includes(' ' + ph + ' ')) return ph;
  return null;
}

// Dares: what INSANE refuses outright. Each entry: [pattern on folded text, the reason shown].
const UNSAFE = [
  [/\b(traffic|highway|motorway|railway|train tracks?|run (across|into) the road|cross the road|in the road|on the road|stop a (car|bus)|jaywalk)\b/, 'Nothing near traffic or trains.'],
  [/\b(fire|flames?|burn|lighter|petrol|gasoline|kerosene|fireworks?|firecrackers?)\b/, 'Nothing with fire.'],
  [/\b(roof|rooftop|ledge|cliff|balcony|climb (a|the|up) [a-z]+|jump (off|from)|heights?|parapet|terrace edge)\b/, 'Nothing at heights.'],
  [/\b(alcohol|drunk|drink (a|the|\d)|tequila shots?|vodka shots?|beer|vodka|whisk(e)?y|rum|tequila|wine|daru|booze|weed|drugs?|ganja|smoke|vape)\b/, 'Nothing with alcohol, drugs or smoking.'],
  [/\b(police|cops?|security guard|steal|shoplift|trespass|graffiti|vandal|break in|illegal)\b/, 'Nothing with the police or the law.'],
  [/\b(money|cash|rupees?|rs|inr|pay for|pay (me|us|them|someone|a stranger) (rs|inr|₹|\d)|bet|loan|gamble|wallet|upi|paytm|gpay)\b|[₹$€£]/, 'Nothing with money.'],
  [/\b(touch|kiss|hug|grab|lick|tickle|slap|hit|push|follow|film|photograph|record) (a |an |some )?(random )?(stranger|stranger's|strangers|someone you don't know|a girl|a guy|a woman|a man)\b|\bstrangers'? bod(y|ies)\b/, 'Nothing with strangers’ bodies, and no filming people who didn’t agree.'],
  [/\b(knife|blade|weapon|gun|naked|nude|strip naked|underwear|self ?harm|cut yourself|starve|fast for|hold your breath|choke|blackout|pills?)\b/, 'Nothing that could hurt anyone.'],
];
function unsafeDare(text) {
  const f = ' ' + fold(text).replace(/[^\p{L}\p{N}₹$€£' ]+/gu, ' ').replace(/\s+/g, ' ') + ' ';
  for (const [re, why] of UNSAFE) if (re.test(f)) return why;
  return null;
}
// </names>
return {fold,nameTokens,handleTerms,nameHit,unsafeDare};})();
/* ---------- legal and consent (C63, C17) ---------- */
const CONSENT_V='2026-10-draft'; // server/moderation.js CONSENT_VERSION; the server says which one it wants in /api/hello
const consentV=()=>(S.hello&&S.hello.consent)||CONSENT_V;
const legalHref=k=>S.backend==='server'?'/legal/'+k:'legal/'+k+'.html';
const legalLinks=()=>`<a href="${legalHref('terms')}" target="_blank" rel="noopener">Terms</a>, <a href="${legalHref('privacy')}" target="_blank" rel="noopener">Privacy notice</a> and <a href="${legalHref('rules')}" target="_blank" rel="noopener">Community rules</a>`;
function consentRow(o){return `<label class="chk"><input type="checkbox" id="ob-consent" data-ob="consent" ${o.consent?'checked':''}> <span>I agree to the ${legalLinks()}. <small class="meta">Version ${esc(consentV())}.</small></span></label>`}
// int-1: one rule for step 1, WS-B's obWhy (name, month+year of birth, then consent), shared with 80-input.js
const obMissing=o=>obWhy(o,ageCheck(o));
const obReady=o=>!obMissing(o);
const consentFields=()=>({adult:true,consent:{v:consentV()}});

/* ---------- blocks (C87) ---------- */
const blockedIds=()=>(S.priv.blocks&&S.priv.blocks.ids)||{};
const isBlocked=id=>!!blockedIds()[id];
async function setBlock(id,on){
  if(S.backend==='server')return S.db.call('block',{uid:id,on});
  const ids={...blockedIds()};if(on)ids[id]=now();else delete ids[id];return S.db.doc(`data/users/${S.uid}/blocks`).set({ids});
}
const REPORT_CATS=[['harassment','Harassment or bullying'],['hate','Hate'],['unsafe','Dangerous or unsafe'],['sexual','Sexual content'],['spam','Spam or scam'],['impersonation','Pretending to be someone'],['underage','Under age'],['other','Something else']];
async function sendReport(b){
  if(S.backend==='server')return S.db.call('report',b);
  return S.db.collection('reports').add({...b,by:S.uid,at:now(),status:'open'}); // demo/claude: the owner reads them from the store
}
const isCircleOwner=()=>!!S.circle&&(S.circle.owner||S.circle.by)===S.uid;
const circleOwnerId=()=>S.circle&&(S.circle.owner||S.circle.by);
async function adminCall(r,b){if(S.backend!=='server')throw {code:'unavailable',message:'Circle admin needs the INSANE server.'};return S.db.call(r,b)}

SHEETS["person"]=(sh,close)=>{
  const id=sh.id,p=S.people[id]||person(id)||{name:'Someone'},blk=isBlocked(id),f=S.ui.rep||{};
  const inCircle=S.members.some(m=>m.id===id),own=isCircleOwner()&&inCircle&&id!==S.uid;
  let out=`<h2><bdi>${esc(p.name||'Someone')}</bdi></h2>${p.handle?`<p class="meta">${esc(p.handle)}</p>`:''}`;
  if(id===S.uid)return out+`<p class="meta">That’s you.</p>${close}`;
  out+=`<div class="card"><h3 style="margin-top:0">${blk?'Blocked':'Block'}</h3><p class="meta" style="margin-top:0">${blk?'You don’t see each other’s posts, messages, dares or presence, and they can’t message, dare or cheer you. They aren’t told.':'You stop seeing each other’s posts, messages, dares and presence. They can’t message, dare or cheer you. They aren’t told.'}</p><div class="btns"><button class="btn s ${blk?'ghost':'red'}" data-act="block" data-v="${esc(id)}" data-on="${blk?'0':'1'}">${blk?'Unblock':'Block '+esc(bidi(p.name||'them'))}</button></div></div>`;
  out+=`<div class="card"><h3 style="margin-top:0">Report</h3><p class="meta" style="margin-top:0">Goes to whoever runs this INSANE. They aren’t told who reported them.</p><div class="chips">${REPORT_CATS.map(([k,n])=>`<button class="chip ${f.cat===k?'on':''}" data-act="rep-cat" data-v="${k}">${n}</button>`).join('')}</div>
    <label class="f" for="rep-note">What happened <small>optional</small></label><input class="in-t" id="rep-note" data-f="repnote" maxlength="300" value="${esc(F.repnote||'')}">
    <label class="chk"><input type="checkbox" data-rep="block" ${f.block?'checked':''}> <span>Block them too</span></label>
    <div class="btns"><button class="btn s" data-act="report" data-v="${esc(id)}" ${f.cat?'':'disabled'}>Send report</button></div>${f.cat?'':'<p class="meta">Pick what it’s about.</p>'}</div>`;
  if(own)out+=`<div class="card"><h3 style="margin-top:0">You run ${esc(bidi(S.circle.name))}</h3><div class="btns"><button class="btn s red" data-act="c-remove" data-v="${esc(id)}">${S.ui.confirm==='crm'+id?'Tap again to remove':'Remove from the circle'}</button><button class="btn s ghost" data-act="c-transfer" data-v="${esc(id)}">${S.ui.confirm==='ctr'+id?'Tap again to hand it over':'Make them the owner'}</button></div><p class="meta">Removed people can’t see the circle or rejoin with the code. You can undo it for 24 hours.</p></div>`;
  return out+close;
};
SHEETS["circle-admin"]=(sh,close)=>{
  const c=S.circle;if(!c)return close;if(!isCircleOwner())return `<h2>${esc(bidi(c.name))}</h2><p class="meta">Only the owner, ${esc(nameOf(circleOwnerId()))}, can change the circle.</p>${close}`;
  const rem=Object.entries(c.removed||{}).sort((a,b)=>b[1]-a[1]);
  return `<h2>Circle settings</h2>
  <label class="f" for="ca-name">Name</label><input class="in-t" id="ca-name" data-f="caname" maxlength="28" value="${esc(F.caname??c.name)}"><div class="btns"><button class="btn s" data-act="c-rename">Rename</button></div>
  <label class="f">Invite code</label><p style="margin:0"><b style="font-family:var(--f-mono);letter-spacing:.08em">${esc(c.code)}</b> <button class="link" data-act="c-code">New code</button></p><p class="meta">A new code stops the old one working. Nobody already in is affected.</p>
  <label class="f">People</label><p class="meta" style="margin-top:0">Tap someone in the circle list to remove them or hand the circle over.</p>
  ${rem.length?`<label class="f">Removed</label><div class="card">${rem.map(([id,at])=>`<div class="row" style="padding:4px 0"><span class="grow"><bdi>${esc(nameOf(id))}</bdi> <span class="meta">${esc(ago(at))}</span></span>${now()-at<DAY?`<button class="btn s ghost" data-act="c-unremove" data-v="${esc(id)}">Undo</button>`:`<button class="link" data-act="c-unremove" data-v="${esc(id)}">Let them rejoin</button>`}</div>`).join('')}</div>`:''}
  <label class="f" for="ca-close">Close the circle</label><p class="meta" style="margin-top:0">Deletes its chat, plans, pots, favors, dares and Midnight for everyone. Type <b>${esc(bidi(c.name))}</b> to confirm.</p><input class="in-t" id="ca-close" data-f="caclose" value="${esc(F.caclose||'')}" autocomplete="off"><div class="btns"><button class="btn s red" data-act="c-close">Close for everyone</button></div>${close}`;
};

/* ---------- unsafe dares (C88) ---------- */
const dareFlagged=d=>!!d&&(d.flags||[]).includes(S.uid);
const flagBtn=v=>`<button class="link flag" style="color:inherit;opacity:.9;margin-left:6px" data-act="dare-flag" data-v="${esc(v)}" aria-label="Flag this dare as not safe">⚑ Not safe</button>`;

/* ---------- the owner's queue (C89) ---------- */
SHEETS["mod"]=(sh,close)=>{
  const qd=S.modq;if(!qd)return `<h2>Moderation</h2><p class="meta">Loading…</p>${close}`;
  if(qd.error)return `<h2>Moderation</h2><p class="read warn">${esc(qd.error)}</p>${close}`;
  const it=(h,list,f)=>`<label class="f">${esc(h)} · ${list.length}</label>${list.length?`<div class="stack">${list.map(f).join('')}</div>`:'<p class="meta">Nothing.</p>'}`;
  const btn=(a,v,t,cls='ghost')=>`<button class="btn s ${cls}" data-act="${a}" data-v="${esc(v)}">${t}</button>`;
  return `<h2>Moderation</h2><p class="meta">Only you see this. Every action is logged.</p>
  ${it('Reports',qd.reports,r=>`<div class="card"><div class="meta">${esc(r.kind)} · ${esc(r.category)} · ${esc(ago(r.at))}</div><p style="margin:4px 0">${esc(r.targetName||r.path||r.target)}${r.note?': “'+esc(r.note)+'”':''}</p><div class="btns">${btn('mod-report',r.id+'|resolve-report','Resolved')}${btn('mod-report',r.id+'|dismiss-report','Dismiss')}</div></div>`)}
  ${it('Flagged posts',qd.posts,x=>`<div class="card"><div class="meta">${esc(bidi(x.name))} · ${x.flags} report${x.flags>1?'s':''}</div><p style="margin:4px 0">${esc(x.text)}</p><div class="btns">${btn('mod-act',x.path+'|remove','Remove','red')}${btn('mod-act',x.path+'|clear','Keep it')}</div></div>`)}
  ${it('Flagged dares',qd.dares,x=>`<div class="card"><div class="meta">${x.flags} flag${x.flags>1?'s':''}${x.pulled?' · pulled from the jar':''}</div><p style="margin:4px 0">${esc(x.text)}</p><div class="btns">${btn('mod-act',x.path+'|remove','Remove','red')}${btn('mod-act',x.path+'|clear','Put it back')}</div></div>`)}
  ${it('Midnight removals',qd.midnight,x=>`<div class="card"><div class="meta">${x.removed?'removed':x.flags+' flags'} · ${esc(when(x.at))}</div><p style="margin:4px 0">${esc(x.text||'(text removed)')}</p>${x.removed?'':`<div class="btns">${btn('mod-act',x.path+'|remove','Remove','red')}</div>`}</div>`)}
  ${it('Missions',qd.missions,x=>`<div class="card"><div class="meta">${esc(x.cname)} · ${esc(when(x.when))}${x.bad?' · '+x.bad+' said it was off':''}</div><p style="margin:4px 0">${esc(x.title)}</p><div class="btns">${btn('mod-act',x.path+'|remove','Take it down','red')}</div></div>`)}${close}`;
};
async function loadModq(){try{S.modq=await S.db.call('admin/queue',{})}catch(e){S.modq={error:e.message||'Couldn’t load it.'}}render()}

/* ---------- account (C59, C60, C62) ---------- */
function accountCard(){
  if(S.backend!=='server')return '';
  const ss=S.sessions,f=S.ui.chg||{};
  return `<div class="eyebrow">Account</div><div class="card"><p style="margin-top:0">Signed in as <b>${esc(S.email||'')}</b>.</p>
   ${f.step===1?`<form data-form="chg-verify"><label class="f" for="chg-code">Code sent to ${esc(f.email)}</label><input class="in-t" id="chg-code" data-chg="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" value="${esc(f.code||'')}"><div class="btns"><button class="btn s" type="submit">Change my email</button><button class="btn s ghost" type="button" data-act="chg-cancel">Cancel</button></div></form>`
   :f.open?`<form data-form="chg-start"><label class="f" for="chg-email">New email</label><input class="in-t" id="chg-email" data-chg="email" type="email" autocomplete="email" value="${esc(f.email||'')}"><div class="btns"><button class="btn s" type="submit">Email me a code</button><button class="btn s ghost" type="button" data-act="chg-cancel">Cancel</button></div></form>`
   :`<div class="btns"><button class="btn s ghost" data-act="chg-open">Change email</button></div>`}
   ${f.err?`<p class="read warn">${esc(f.err)}</p>`:''}
   <label class="f">Signed in on <button class="link" data-act="sess-load">${ss?'Refresh':'Show'}</button></label>
   ${ss?`<div>${ss.map(x=>`<div class="row sess" style="padding:4px 0"><span class="grow"><b>${esc(x.device)}</b>${x.current?' <span class="meta">this device</span>':''}<div class="meta">${x.seen?'last used '+esc(ago(x.seen)):''}${x.created?' · signed in '+esc(ago(x.created)):''}</div></span>${x.current?'':`<button class="btn s ghost" data-act="sess-revoke" data-v="${esc(x.id)}">Sign out</button>`}</div>`).join('')}</div>`:''}
   <div class="btns"><button class="btn s ghost" data-act="sess-all">Sign out everywhere</button></div></div>`;
}
function safetyCard(){
  const ids=Object.keys(blockedIds()),me=S.me||{};
  return `<div class="eyebrow">Safety</div><div class="card">
   <label class="chk"><input type="checkbox" data-safe="presence" ${me.presenceOff?'':'checked'}> <span><b>Show when I’m here.</b> Only your circle sees “Here now”. Never shown in the City.</span></label>
   <label class="chk"><input type="checkbox" data-safe="square" ${me.showSquare?'checked':''}> <span><b>Show my square to my circle.</b> Off unless you turn it on. Your circle sees your ${esc(cellText(me.cell))} square on their map, never a dot or a pin. Nobody else, ever.</span></label>
   <label class="f">Blocked</label>${ids.length?ids.map(id=>`<div class="row" style="padding:4px 0"><span class="grow"><bdi>${esc(nameOf(id))}</bdi></span><button class="btn s ghost" data-act="block" data-v="${esc(id)}" data-on="0">Unblock</button></div>`).join(''):'<p class="meta" style="margin:0">Nobody. To block or report someone, tap their name in your circle.</p>'}
   <p class="meta">${legalLinks()}. Grievance officer: <b>to be named (needs Vijay)</b>.</p>
   ${S.isOwner?`<div class="btns"><button class="btn s" data-act="mod-open">Moderation</button></div>`:''}</div>`;
}
function consentBanner(){const me=S.me;if(!me||(me.consent&&me.consent.v===consentV()))return '';
  return `<div class="card stamp"><h3>New Terms and Privacy notice</h3><p>INSANE now has written ${legalLinks()}. Please read and agree to keep going.</p><div class="btns"><button class="btn s" data-act="consent-yes">I agree</button></div></div>`}
async function exportHtml(){
  if(S.backend!=='server')return null;
  const r=await S.db.call('account/export',{});
  try{const u=URL.createObjectURL(new Blob([r.html],{type:'text/html'}));const a=document.createElement('a');a.href=u;a.download='insane-my-data.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}catch(e){}
  return r;
}
// After the account is deleted or this device signed out somewhere else, the sign-in screen says so.
const SIGNED_OUT=(()=>{let n=null;try{n=sessionStorage.getItem('insane_notice');sessionStorage.removeItem('insane_notice')}catch(e){}return n})(); // read once, kept for this page
function safetyNotice(){const n=SIGNED_OUT;if(!n)return '';
  return `<div class="card stamp" role="status"><p style="margin:0">${n==='deleted'?'<b>Your account is deleted.</b> Everything of yours is gone from INSANE, and you’re signed out. A confirmation is on its way to your email.':'<b>You were signed out.</b> Sign in again to carry on.'}</p></div>`}
const signedOutWith=n=>{try{sessionStorage.setItem('insane_notice',n)}catch(e){}location.reload()};
// Go dark, Midnight and every countdown run on the server's clock, so a phone set to the wrong day can't
// end dark early or stay dark (C61). Small differences are network noise and are ignored.
function setSkew(serverNow){if(!(+serverNow>0))return;const d=+serverNow-Date.now();CLOCK_SKEW=Math.abs(d)>5000?d:0}
// A session revoked from another device: the page notices within a minute and goes to sign-in.
setInterval(async()=>{if(S.backend!=='server'||S.mode!=='live'||document.hidden)return;try{const h=await fetch('/api/hello',{credentials:'same-origin'}).then(r=>r.json());if(h&&h.insane&&!h.signedIn)signedOutWith('revoked');else if(h&&h.now)setSkew(h.now)}catch(e){}},60000);

/* ---------- actions ---------- */
ACT["block"]=async(d)=>{const on=d.on!=='0',nm=nameOf(d.v);if(await W(()=>setBlock(d.v,on),on?`Blocked ${nm}. They aren’t told.`:`Unblocked ${nm}.`)){if(on)closeSheet();render()}};
ACT["rep-cat"]=async(d)=>{S.ui.rep={...(S.ui.rep||{}),cat:d.v};render()};
ACT["report"]=async(d)=>{const f=S.ui.rep||{};if(!f.cat)return;if(await W(()=>sendReport({kind:'person',uid:d.v,category:f.cat,note:(F.repnote||'').trim().slice(0,300),block:!!f.block}),'Reported. Thank you.'+(f.block?' They’re blocked too.':''))){S.ui.rep=null;F.repnote='';closeSheet()}};
const twice=(k,msg)=>{if(S.ui.confirm!==k){S.ui.confirm=k;render();setTimeout(()=>{if(S.ui.confirm===k){S.ui.confirm=null;render()}},4000);return false}S.ui.confirm=null;return true};
ACT["c-remove"]=async(d)=>{if(!twice('crm'+d.v))return;const nm=nameOf(d.v);if(await W(()=>adminCall('circle/remove',{cid:S.circle.id,uid:d.v}),`Removed ${nm}. You can undo it for 24 hours in Circle settings.`))closeSheet()};
ACT["c-unremove"]=async(d)=>{await W(()=>adminCall('circle/unremove',{cid:S.circle.id,uid:d.v}),'Done.');render()};
ACT["c-transfer"]=async(d)=>{if(!twice('ctr'+d.v))return;const nm=nameOf(d.v);if(await W(()=>adminCall('circle/transfer',{cid:S.circle.id,uid:d.v}),`${nm} runs the circle now.`))closeSheet()};
ACT["c-rename"]=async()=>{const n=(F.caname??'').trim();if(!n){toast('Give it a name.');return}if(await W(()=>adminCall('circle/rename',{cid:S.circle.id,name:n}),'Renamed.')){delete F.caname;render()}};
ACT["c-code"]=async()=>{await W(()=>adminCall('circle/code',{cid:S.circle.id}),'New code made. The old one no longer works.');render()};
ACT["c-close"]=async()=>{const c=S.circle;if((F.caclose||'').trim().toLowerCase()!==String(c.name).trim().toLowerCase()){toast('Type the circle’s name to close it.');return}
  if(await W(()=>adminCall('circle/close',{cid:c.id,confirm:F.caclose}),c.name+' is closed.')){F.caclose='';closeSheet()}};
ACT["dare-flag"]=async(d)=>{const db=S.db,me=S.me,uid=S.uid;
  if(d.v==='daily'){const dd=dailyDare();if(!dd)return;await W(async()=>{if(!dd.starter)await db.doc(`circles/${me.circle}/dares/${dd.id}`).update({flags:[...(dd.flags||[]),uid]});const ref=db.doc(`circles/${me.circle}/daily/${today()}`);const x=await ref.get();if(x.exists)await ref.update({flags:[uid]});else await ref.set({dare:dd.text,flags:[uid]})},'Flagged. It’s gone for you; two flags take it out of the jar for everyone.');render();return}
  const x=S.dares.find(z=>z.id===d.v);if(!x||dareFlagged(x))return;await W(()=>db.doc(`circles/${me.circle}/dares/${x.id}`).update({flags:[...(x.flags||[]),uid]}),'Flagged. It’s gone for you; two flags take it out of the jar for everyone.');render()};
ACT["mod-open"]=async()=>{S.modq=null;openSheet('mod',{});loadModq()};
ACT["mod-act"]=async(d)=>{const [path,action]=d.v.split('|');await W(()=>S.db.call('admin/act',{path,action}),'Done. Logged.');loadModq()};
ACT["mod-report"]=async(d)=>{const [id,action]=d.v.split('|');await W(()=>S.db.call('admin/act',{id,action}),'Done. Logged.');loadModq()};
ACT["sess-load"]=async()=>{try{S.sessions=(await S.db.call('account/sessions',{})).sessions}catch(e){toast('Couldn’t load your devices.')}render()};
ACT["sess-revoke"]=async(d)=>{if(await W(()=>S.db.call('account/revoke',{id:d.v}),'Signed out that device.'))ACT["sess-load"]()};
ACT["sess-all"]=async()=>{if(!twice('sessall')){toast('Tap again to sign out on every device, this one too.');return}try{await S.db.call('account/revoke',{all:true})}catch(e){}signedOutWith('revoked')};
ACT["chg-open"]=async()=>{S.ui.chg={open:true,email:''};render();setTimeout(()=>{const i=$('#chg-email');if(i)i.focus()},50)};
ACT["chg-cancel"]=async()=>{S.ui.chg=null;render()};
ACT["chg-start"]=async()=>{const f=S.ui.chg;f.err='';try{await S.db.call('account/email/start',{email:(f.email||'').trim()});f.step=1;f.code=''}catch(e){f.err=e.message}render()};
ACT["chg-verify"]=async()=>{const f=S.ui.chg;f.err='';try{const r=await S.db.call('account/email/verify',{email:f.email,code:f.code});S.email=r.email;S.ui.chg=null;toast('Your email is now '+r.email+'.')}catch(e){f.err=e.message}render()};
ACT["consent-yes"]=async()=>{if(S.backend==='server')await W(()=>S.db.call('account/consent',{v:consentV()}),'Thanks.');else await W(()=>S.db.doc('people/'+S.uid).update({consent:{v:consentV(),at:now()}}),'Thanks.')};
// Delete for good. On the server it's one transaction that also ends every session, then the sign-in screen
// says the account is gone (C59). In the demo store it stays the client-side delete, back to sign-up.
async function deleteMe(){
  if(S.backend==='server'){try{await S.db.call('account/delete',{confirm:'DELETE'})}catch(e){toast(e.message||'That didn’t go through. Nothing was deleted.');return false}for(const g of Object.keys(SUBS))drop(g);signedOutWith('deleted');return true}
  return null;
}
addEventListener('change',e=>{const el=e.target;if(!el||!el.dataset)return;
  if(el.dataset.rep==='block'){S.ui.rep={...(S.ui.rep||{}),block:el.checked}}
  if(el.dataset.safe==='square'&&S.me)W(()=>S.db.doc('people/'+S.uid).update({showSquare:el.checked}),el.checked?'Your circle can see your square on the map.':'Your square is hidden again.');
  if(el.dataset.safe==='presence'&&S.me)W(()=>S.db.doc('people/'+S.uid).update({presenceOff:!el.checked}),el.checked?'Your circle sees when you’re here.':'Nobody sees when you’re here.');
});
addEventListener('input',e=>{const el=e.target;if(el&&el.dataset&&el.dataset.chg&&S.ui.chg)S.ui.chg[el.dataset.chg]=el.value});
