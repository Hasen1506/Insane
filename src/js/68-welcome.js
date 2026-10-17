/* ---------- first run: welcome, intro, invite preview, sign-in (C09–C13, C15, C22) ---------- */
// Device flags: insane_intro (intro seen or skipped, so it shows once). Session: insane_wel (welcome
// passed in this tab) and insane_si (sign-in step and email, so a tab killed while you read the code
// comes back on the code step).
const ss={get:k=>{try{return sessionStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{v==null?sessionStorage.removeItem(k):sessionStorage.setItem(k,v)}catch(e){}}};
const ls={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}};
// Handlers for these screens are collected in ACT_B and joined into the ACT registry by 97-help.js
// (ACT itself is declared later in the build order).
const ACT_B=Object.create(null);
const introSeen=()=>ls.get('insane_intro')==='1';
let INV={code:null,state:null};
// The invite code this visit came with: S.deep once booted signed-in, or the #cCODE still in the URL
// while signed out (kept there so the reload after sign-in still carries it).
function invCode(){if(S.deep&&S.deep.kind==='c')return S.deep.code;const m=/^#c([A-Za-z0-9]{6})$/.exec(location.hash||'');return m?m[1].toUpperCase():null}
function loadInvite(code){
  if(!code||INV.code===code)return;INV={code,state:'loading'};
  const get=S.mode==='signin'||!S.db
    ?fetch('/api/invite/'+encodeURIComponent(code),{credentials:'same-origin'}).then(r=>r.ok?r.json():r.status===404?{none:true}:null)
    :S.db.doc('codes/'+code).get().then(x=>x.exists?S.db.doc('circles/'+x.data().cid).get():null).then(async c=>{if(!c||!c.exists)return {none:true};const d=c.data();let by='';try{const p=await S.db.doc('people/'+d.by).get();by=p.exists?String(p.data().name||'').split(' ')[0]:''}catch(e){}return {name:d.name,count:(d.members||[]).length,by,max:8}});
  get.then(j=>{INV=Object.assign({code},!j?{state:'err'}:j.none?{state:'none'}:{state:'ok',name:String(j.name||''),count:+j.count||0,by:String(j.by||''),max:+j.max||8});render()}).catch(()=>{INV={code,state:'err'};render()});
}
const invLine=()=>INV.state==='ok'?`${INV.by?`<b>${esc(INV.by)}</b> invited you to `:'You’re invited to '}<b>${esc(INV.name)}</b> <span class="cnt-of">(${INV.count} of ${INV.max})</span>`:'';

// What to show before sign-in or onboarding, or '' to go straight on.
function welcomeGate(){
  if(S.ui.intro!=null)return introView();
  if(S.ui.wel==null)S.ui.wel=ss.get('insane_wel')||'';
  if(S.ui.wel==='done')return '';
  const code=invCode();if(code)loadInvite(code);
  if(code||!introSeen())return welcomeView(code);
  return '';
}
function welcomeView(code){
  const inv=code&&INV.code===code?INV:null;
  const top=`<div class="wel"><span class="mark">INSANE</span>`;
  if(inv){
    if(inv.state==='loading'||inv.state==null)return top+`<p class="lede" style="margin-top:28px">Opening your invite…</p></div>`;
    if(inv.state==='ok')return top+`<div class="card stamp inv"><div class="meta">INVITE · CODE ${esc(code)}</div><p class="inv-l">${invLine()}</p></div>
      <h1 class="v">Plans, dares and favours with the people you actually see.</h1>
      <p class="lede">A circle is 3 to 8 friends. You’ll be in ${esc(inv.name)} in under two minutes.</p>
      <div class="btns"><button class="btn wide" data-act="wel-go" data-v="join">Join ${esc(inv.name)}</button></div>
      <p class="wel-alt"><button class="link" data-act="wel-intro">What’s INSANE?</button></p></div>`;
    return top+`<h1 class="v">That invite didn’t open</h1><p class="lede">${inv.state==='none'?`No circle has the code <b>${esc(code)}</b>. Check it with whoever sent it.`:'We couldn’t reach INSANE just now. Check your connection.'}</p>
      <div class="btns"><button class="btn wide" data-act="wel-go">Get started anyway</button></div></div>`;
  }
  return top+`<h1 class="v wel-h">Plans, dares and favours with the 3–8 people you actually see.</h1>
    <ul class="wel-b"><li><span aria-hidden="true">🗓️</span><span><b>Plans that happen.</b> Everyone taps in or out, no endless group chat.</span></li>
    <li><span aria-hidden="true">🎲</span><span><b>Pacts and a daily dare.</b> Your circle keeps you honest, kindly.</span></li>
    <li><span aria-hidden="true">🤝</span><span><b>Favours in hours.</b> Help each other out and keep it fair.</span></li></ul>
    <div class="btns"><button class="btn wide" data-act="wel-start">Get started</button></div>
    ${S.ui.welCode!=null?`<form class="wel-code" data-form="wel-open"><label class="f" for="wel-code">Invite code <small>6 letters, from a friend</small></label><div class="row2"><input class="in-t" id="wel-code" data-wel="code" maxlength="6" value="${esc(S.ui.welCode)}" placeholder="K7QF2M" autocapitalize="characters" autocomplete="off"><button class="btn" type="submit">Open</button></div>${S.ui.welErr?`<p class="err" role="alert">${esc(S.ui.welErr)}</p>`:''}</form>`
      :`<div class="btns"><button class="btn ghost wide" data-act="wel-code">I have an invite</button></div>`}
    ${S.mode==='signin'?`<p class="wel-alt">Already on INSANE? <button class="link" data-act="wel-go">Sign in</button></p>`:''}</div>`;
}
/* the intro: four cards, swipe or tap, skippable, once per device */
const INTRO=[
  {i:'👥',h:'Circles of up to 8',p:'Your people, not followers. Start a circle, or join one with a code from a friend.'},
  {i:'✅',h:'Pacts and the daily dare',p:'Say what you keep meaning to do. Your circle sees your ticks, never your words. Plus one small dare a day.'},
  {i:'🌙',h:'Midnight and the Mole',p:'Unsigned messages that land at 00:00. And each week, someone might secretly be the Mole. These open as your circle grows.'},
  {i:'🗺️',h:'The City',p:'Drops, trails and a weekly puzzle near you. Your exact spot stays yours: others only ever see a square.'},
];
function introView(){const i=Math.max(0,Math.min(INTRO.length-1,S.ui.intro|0)),c=INTRO[i],last=i===INTRO.length-1;
  return `<div class="intro" data-intro="${i}"><div class="intro-top"><span class="mark">INSANE</span><button class="link" data-act="intro-skip">Skip</button></div>
  <div class="intro-card" aria-live="polite"><div class="intro-i" aria-hidden="true">${c.i}</div><h1 class="v">${esc(c.h)}</h1><p class="lede">${esc(c.p)}</p></div>
  <div class="intro-dots" aria-label="Card ${i+1} of ${INTRO.length}">${INTRO.map((_,k)=>`<i class="${k===i?'on':''}"></i>`).join('')}</div>
  <div class="btns">${i?`<button class="btn ghost" data-act="intro-go" data-v="${i-1}">Back</button>`:''}<button class="btn" style="flex:1" data-act="${last?'intro-done':'intro-go'}" data-v="${i+1}">${last?'Let’s go':'Next'}</button></div></div>`}
function welDone(){S.ui.wel='done';ss.set('insane_wel','done');S.ui.intro=null;render();scrollTo(0,0)}
ACT_B['wel-start']=async()=>{if(introSeen())return welDone();S.ui.intro=0;render();scrollTo(0,0)};
ACT_B['wel-intro']=async()=>{S.ui.intro=0;render();scrollTo(0,0)};
ACT_B['wel-go']=async()=>welDone();
ACT_B['wel-code']=async()=>{S.ui.welCode='';S.ui.welErr='';render();setTimeout(()=>{const x=$('#wel-code');if(x)x.focus()},40)};
ACT_B['intro-go']=async(d)=>{S.ui.intro=+d.v;render()};
ACT_B['intro-skip']=ACT_B['intro-done']=async()=>{ls.set('insane_intro','1');welDone()};
// "I have an invite": the code opens the same preview a link would.
ACT_B['wel-open']=async()=>welCodeSubmit();
async function welCodeSubmit(){const c=String(S.ui.welCode||'').trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(c)){S.ui.welErr='Invite codes are 6 letters and numbers, like K7QF2M.';render();return}
  S.ui.welErr='';S.ui.welCode=null;if(S.mode==='signin'){try{history.replaceState(null,'',location.pathname+location.search+'#c'+c)}catch(e){location.hash='c'+c}}else S.deep={kind:'c',code:c};render()}
// swipe between intro cards
let swX=null;
addEventListener('touchstart',e=>{swX=e.target.closest&&e.target.closest('.intro')?e.touches[0].clientX:null},{passive:true});
addEventListener('touchend',e=>{if(swX==null||S.ui.intro==null)return;const dx=e.changedTouches[0].clientX-swX;swX=null;if(Math.abs(dx)<50)return;const n=(S.ui.intro|0)+(dx<0?1:-1);if(n<0)return;if(n>=INTRO.length){ACT_B['intro-done']();return}S.ui.intro=n;render()},{passive:true});

/* ---------- sign-in (server mode) ---------- */
// gmial.com → gmail.com. Only well-known domains, and only within two edits, so real domains are left alone.
const MAIL_DOMAINS=['gmail.com','yahoo.com','yahoo.co.in','outlook.com','hotmail.com','icloud.com','rediffmail.com','live.com','proton.me','protonmail.com','zoho.com'];
function editDist(a,b){if(a===b)return 0;const m=a.length,n=b.length;if(Math.abs(m-n)>2)return 3;let p=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]}
function suggestDomain(email){const m=/^([^@\s]+)@([^@\s]+)$/.exec(String(email||'').trim().toLowerCase());if(!m)return null;const d=m[2];if(MAIL_DOMAINS.includes(d))return null;
  let best=null,bd=3;for(const k of MAIL_DOMAINS){const x=editDist(d,k);if(x<bd){bd=x;best=k}}return best&&bd<=2?m[1]+'@'+best:null}
const emailOK=e=>/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(e||'').trim());
const RESEND_MS=30000;
function siState(){if(!S.ui.si){let r=null;try{r=JSON.parse(ss.get('insane_si')||'null')}catch(e){}S.ui.si=Object.assign({step:0,email:'',code:''},r&&typeof r==='object'?{step:r.step===1?1:0,email:String(r.email||''),sentAt:+r.sentAt||0}:{})}return S.ui.si}
function siSave(){const f=S.ui.si;if(f)ss.set('insane_si',JSON.stringify({step:f.step,email:f.email,sentAt:f.sentAt||0}))}
function signin(){
  const f=siState();
  if(f.step===1&&S.ui.wel!=='done'){S.ui.wel='done';ss.set('insane_wel','done')}
  const code=invCode();if(code)loadInvite(code);
  const inv=code&&INV.state==='ok'?`<div class="card stamp inv"><p class="inv-l">${invLine()}</p><p class="meta" style="margin-top:2px">Sign in and you’ll join them next.</p></div>`:'';
  const sug=f.step===0&&f.sug?`<p class="sug">Did you mean <b>${esc(f.sug)}</b>? <button type="button" class="link" data-act="si-sug">Use it</button></p>`:'';
  const wait=f.sentAt&&now()<f.sentAt+RESEND_MS;
  return `<div style="padding-top:18px"><span class="mark">INSANE</span>${inv}<h1 class="v">Sign in with your email</h1><p class="lede">We email you a 6-digit code. No password. New here? The same code makes your account.</p>
  ${f.step===0?`<form data-form="si-start" novalidate><label class="f" for="si-email">Email</label><input class="in-t" id="si-email" data-si="email" type="email" autocomplete="email" inputmode="email" value="${esc(f.email)}" placeholder="you@gmail.com" aria-invalid="${f.err?'true':'false'}" aria-describedby="si-err">${f.err?`<p class="err" id="si-err" role="alert">${esc(f.err)}</p>`:''}${sug}<div class="btns"><button class="btn wide" type="submit" ${f.busy?'disabled':''}>Email me a code</button></div></form>`
  :`<form data-form="si-verify" novalidate><p>Code sent to <b>${esc(f.email)}</b>. <button type="button" class="link" data-act="si-back">Change</button></p><label class="f" for="si-code">6-digit code</label><input class="in-t otp" id="si-code" data-si="code" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" value="${esc(f.code)}" aria-describedby="si-err">${f.err?`<p class="err" id="si-err" role="alert">${esc(f.err)}</p>`:''}<div class="btns"><button class="btn wide" type="submit" ${f.busy?'disabled':''}>Sign in</button></div>
    <p class="meta">Nothing yet? Check spam, or ${wait?`<span class="resend-wait">send another in <span data-until="${f.sentAt+RESEND_MS}">${left(f.sentAt+RESEND_MS-now())}</span></span>`:`<button type="button" class="link" data-act="si-resend">send another</button>`}.</p>
    ${S.hello&&S.hello.dev?`<div class="btns"><button type="button" class="btn s ghost" data-act="si-devcode">Fill dev code</button></div>`:''}</form>`}
  ${S.hello&&S.hello.dev?'<p class="meta">Development server: codes are printed in the server log.</p>':''}
  <p class="wel-alt"><button class="link" data-act="wel-back">What’s INSANE?</button></p></div>`;
}
async function siCall(r,b){const x=await fetch('/api/auth/'+r,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(b)});const j=await x.json().catch(()=>({}));if(!x.ok)throw new Error(j.message||'That didn’t work. Try again.');return j}
let resendT=0;
function armResend(){clearTimeout(resendT);resendT=setTimeout(render,RESEND_MS+50)}
ACT_B['si-start']=async()=>{const f=siState();f.err='';f.sug=null;f.email=String(f.email||'').trim();
  if(!emailOK(f.email)){f.err='That doesn’t look like an email address. Check for a typo.';f.sug=suggestDomain(f.email);render();return}
  const s=suggestDomain(f.email);if(s&&f.sugFor!==f.email){f.sug=s;f.sugFor=f.email;f.err='Check the spelling of your email.';render();return}
  f.busy=true;render();try{await siCall('start',{email:f.email});f.step=1;f.code='';f.sentAt=now();armResend();siSave();setTimeout(()=>{const i=$('#si-code');if(i)i.focus()},60)}catch(e){f.err=e.message}f.busy=false;render()};
ACT_B['si-sug']=async()=>{const f=siState();if(f.sug){f.email=f.sug;f.sug=null;f.err='';f.sugFor=f.email}render()};
ACT_B['si-resend']=async()=>{const f=siState();if(f.sentAt&&now()<f.sentAt+RESEND_MS)return;try{await siCall('start',{email:f.email});f.sentAt=now();armResend();siSave();toast('Sent another code.')}catch(e){f.err=e.message}render()};
ACT_B['si-back']=async()=>{const f=siState();f.step=0;f.err='';f.code='';siSave();render()};
ACT_B['si-verify']=async()=>{const f=siState();if(f.busy)return;f.err='';const code=String(f.code||'').replace(/\D/g,'');if(code.length!==6){f.err='The code is 6 digits.';render();return}
  f.busy=true;render();try{await siCall('verify',{email:f.email,code});ss.set('insane_si',null);location.reload();return}catch(e){f.err=e.message;f.code=''}f.busy=false;render()};
ACT_B['si-devcode']=async()=>{const f=siState();try{const j=await (await fetch('/api/dev/outbox?email='+encodeURIComponent(f.email),{credentials:'same-origin'})).json();const m=j.mail&&/code is (\d{6})/.exec(j.mail.text);if(!m){toast('No code in the dev outbox yet.');return}f.code=m[1];render();await ACT_B['si-verify']()}catch(e){toast('Couldn’t read the dev outbox.')}};
ACT_B['wel-back']=async()=>{S.ui.wel='';ss.set('insane_wel',null);render();scrollTo(0,0)};
// The code box: digits only (paste "123 456" and it fills), and six digits submit on their own.
document.addEventListener('input',e=>{const el=e.target;
  if(el.dataset&&el.dataset.wel==='code'){S.ui.welCode=el.value;return}
  if(el.id!=='si-code')return;const f=siState();const v=el.value.replace(/\D/g,'').slice(0,6);if(v!==el.value)el.value=v;f.code=v;
  if(v.length===6&&!f.busy)act('si-verify',{},el)});
