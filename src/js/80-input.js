/* ---------- ticking clocks ---------- */
function tick(){document.querySelectorAll('[data-until]').forEach(el=>{el.textContent=left(+el.dataset.until-now())})}
setInterval(tick,1000);
let lastMin=0;setInterval(()=>{const m=Math.floor(now()/MIN);if(m!==lastMin){lastMin=m;if(S.me&&S.me.darkUntil&&(S.me.darkUntil<now()+MIN||Math.abs((S.me.darkFrom||0)-now())<MIN))render();else if(!document.activeElement||!/INPUT|TEXTAREA/.test(document.activeElement.tagName))render()}},5000);

/* ---------- input ---------- */
document.addEventListener('input',e=>{
  const el=e.target;
  if(el.dataset.ob){const o=S.ui.ob,k=el.dataset.ob;o[k]=el.type==='checkbox'?el.checked:el.value;
    if(el.dataset.read){const r=readUrge(o.lane||'need',el.value);const box=document.getElementById('read-mind');if(box)box.innerHTML=readCard(r);const fb=$('[data-act="ob-finish"][data-v="mind"]');if(fb){fb.disabled=!(r&&r.kind!=='No'&&r.kind!=='Support');fb.textContent=obLabel(r)}const sk=$('#ob-stake');if(sk)sk.hidden=!(r&&(r.kind==='Pact'||r.kind==='Ladder'));return}
    if(k==='handle'){document.querySelectorAll('[data-act="ob-handle"]').forEach(b=>b.classList.toggle('on',b.dataset.v===el.value.toUpperCase()));}
    if(k==='cq'){render();return}
    const nb=$('[data-act="ob-next"]');if(nb&&o.step===0)nb.disabled=!((o.name||'').trim()&&o.age);
    const fb=document.querySelectorAll('[data-act="ob-circle"]');fb.forEach(b=>{if(b.dataset.v==='create')b.disabled=!(o.cname||'').trim();if(b.dataset.v==='join')b.disabled=(o.code||'').trim().length!==6});return}
  if(el.dataset.f){F[el.dataset.f]=el.type==='checkbox'?el.checked:el.value;if(el.dataset.read==='sheet'){const b=document.getElementById('read-sheet');if(b)b.innerHTML=readCard(readUrge(F.jlane||'need',el.value))}return}
  if(el.dataset.rung!=null)F['rung'+el.dataset.rung]=el.value;
  if(el.dataset.si){S.ui.si[el.dataset.si]=el.value;return}
  if(el.dataset.lp){const st=lpState(el.dataset.lp);st[el.dataset.lpf]=el.value;if(el.dataset.lpf==='q'){if(!GEO.places)loadPlaces();remoteSearch(st);render()}return}
});
document.addEventListener('change',e=>{const el=e.target;
  if(el.dataset.clip&&el.files&&el.files[0]){shrinkPhoto(el.files[0]).then(u=>{F.clipImg=u;render()}).catch(()=>toast('That file isn’t a photo INSANE can read.'));return}
  if(el.dataset.pref){const p=Object.assign({},prefs(),{[el.dataset.pref]:el.checked});S.priv.prefs=p;S.db.doc(`data/users/${S.uid}/prefs`).set(p).catch(()=>{});if(el.checked&&el.dataset.pref==='sound')sfx();render();return}
  if(el.dataset.quiet){const q=Object.assign({from:23,to:8},S.me.quiet||{});if(el.value==='off')q.off=true;else{q.off=false;q[el.dataset.quiet]=+el.value}W(()=>S.db.doc('people/'+S.uid).update({quiet:q}),'Quiet hours saved.');return}
if(el.type==='checkbox'&&el.dataset.ob){S.ui.ob[el.dataset.ob]=el.checked;const nb=$('[data-act="ob-next"]');if(nb)nb.disabled=!((S.ui.ob.name||'').trim()&&S.ui.ob.age)}});
document.addEventListener('submit',e=>{e.preventDefault();const f=e.target.dataset.form;if(f)act(f,e.target.dataset,e.target)});
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');if(!el)return;
  if(el.dataset.act==='sheet-bg'&&e.target!==el)return;
  e.preventDefault();act(el.dataset.act,el.dataset,el);
});
addEventListener('hashchange',()=>{const hm=/^#([mc])([A-Za-z0-9]{6})$/.exec(location.hash);if(!hm)return;S.deep={kind:hm[1],code:hm[2].toUpperCase()};try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}if(S.me)handleDeep();else render()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.ui.sheet){S.ui.sheet=null;wire2();render()}if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('potbtn')){e.preventDefault();e.target.click()}});

function openSheet(t,extra){S.ui.sheet=Object.assign({t},extra||{});if(t==='decode')mark('decodeOpen');if(t==='activity')setTimeout(()=>setSeen('act'),1200);if(t==='host'||t==='propose'||t==='trail-new')S.ui.dloc=null;if(t==='profile')S.ui.loc=null;if(t==='fvdone')F.fvh2=null;if(t==='proof'){F.clipImg='';F.prnote=''}if(t==='clip'){const c=S.clips.find(x=>x.id===extra?.id);if(c&&c.by!==S.uid&&!(c.seen||{})[S.uid])S.db.doc(`circles/${S.me.circle}/clips/${c.id}`).update({seen:{[S.uid]:true}}).catch(()=>{})}wire2();render();setTimeout(()=>{const i=$('.sheet input:not([type=checkbox]):not([type=file]),.sheet textarea');if(i&&!/drop|meet|decode|activity|host|make|invite|clip|mission|trail|propose|proof/.test(t))i.focus()},60)}
function closeSheet(){S.ui.sheet=null;wire2();render()}

