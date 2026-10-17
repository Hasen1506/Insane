/* profile and data */
ACT["pf-save"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const n=(F.pfname??me.name).trim();if(!n){toast('Name can’t be empty.');return}const st=lpState('home');if(st.lat==null){toast('Pick your place on the map.');return}
    if(await W(async()=>{await db.doc('people/'+uid).update({name:n.slice(0,24),handle:(F.pfhandle??me.handle??'').trim().toUpperCase().slice(0,16)||null});await saveHome(st)},'Saved.')){delete F.pfname;delete F.pfhandle;S.ui.loc=null;closeSheet();wire2()}return}
};
ACT["loc-save"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const st=lpState('home');if(st.lat==null)return;if(await W(()=>saveHome(st),'Saved. Welcome back.')){S.ui.loc=null;wire2();render()}return}
};
ACT["lp-pick"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const st=lpState(d.k);lpSet(st,d.lat,d.lon,d.src||'search',d.label,+d.z||13);return}
};
ACT["lp-gps"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  gps(lpState(d.k));return;
};
/* v0.8 had a "Paste a maps link" button; the search box takes links and coordinates now (C65). These stay for old callers. */
ACT["lp-paste"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const i=$('#lp-q-'+d.k);if(i)i.focus();return}
};
ACT["lp-use"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const st=lpState(d.k);const ll=parseLL(st.paste||st.q);if(!ll){st.err='No coordinates in that. Paste a full maps link (not a short goo.gl one) or numbers like 13.0827, 80.2707.';render();return}st.paste='';lpSet(st,ll[0],ll[1],'link','',15);return}
};
ACT["lp-view"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const st=lpState(d.k||'home');st.view=d.v==='others'?'others':'you';render();return}
};
ACT["lp-more"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const st=lpState(d.k);st.more=true;render();return}
};
ACT["lp-world"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {await loadPlaces();render();return}
};
ACT["lp-prec"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const st=lpState('home');st.prec=d.v;render();return}
};
ACT["lp-size"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const st=lpState('home');st.s=+d.v;render();return}
};
ACT["lp-radius"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const st=lpState('home');st.r=+d.v;render();return}
};
ACT["lp-area"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const st=lpState('home');try{st.area=JSON.parse(d.v)}catch(e){}render();return}
};
ACT["si-start"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const f=S.ui.si;f.err='';f.busy=true;render();try{await siCall('start',{email:f.email});f.step=1;f.code='';setTimeout(()=>{const i=$('#si-code');if(i)i.focus()},60)}catch(e){f.err=e.message}f.busy=false;render();return}
};
ACT["si-resend"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const f=S.ui.si;try{await siCall('start',{email:f.email});toast('Sent another code.')}catch(e){f.err=e.message;render()}return}
};
ACT["si-back"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.si.step=0;S.ui.si.err='';render();return;
};
ACT["si-verify"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const f=S.ui.si;f.err='';f.busy=true;render();try{await siCall('verify',{email:f.email,code:f.code});location.reload();return}catch(e){f.err=e.message}f.busy=false;render();return}
};
ACT["signout"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await signOut();return;
};
ACT["push-on"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await pushOn();return;
};
ACT["draw-run"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  runDraw(d.v);return;
};
ACT["cseg-go"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.tab='circle';S.ui.cseg=d.v;S.ui.open=null;S.ui.sheet=null;if(d.v==='midnight')setSeen('midnight');wire2();render();return;
};
ACT["export"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const out={profile:me,exactPin:S.priv.loc||null,journeys:journeys(),timeline:S.priv.log?.items||[],decodeTries:S.priv.dec||{},myPosts:S.posts.filter(p=>p.by===uid),myCheckins:S.myCheckins||[],steps:S.ev,exportedAt:new Date().toISOString()};
    if(S.backend==='server'){try{const r=await exportHtml();if(r){Object.assign(out,{messages:r.data.messages,ledger:r.data.ledger,pots:r.data.pots});S.exportHtml=true}}catch(e){}}
    const txt=JSON.stringify(out,null,2);
    if(downloads){try{await downloads.save({filename:'insane-my-data.json',data:txt});return}catch(e){}}S.exportText=txt;render();return}
};
ACT["del-ask"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.confirm='delete';render();return;
};
ACT["del-no"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.confirm=null;render();return;
};
ACT["del-yes"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  if(S.backend==='server'){S.ui.confirm=null;await deleteMe();return}
  {S.ui.confirm=null;logMem=[];await W(async()=>{for(const k of Object.keys(S.priv))await db.doc(`data/users/${uid}/${k}`).delete();for(const p of S.posts.filter(p=>p.by===uid))await db.doc('posts/'+p.id).delete();if(me.circle){await db.doc(`circles/${me.circle}/progress/${uid}`).delete().catch(()=>{});if(S.circle)await db.doc('circles/'+me.circle).update({members:(S.circle.members||[]).filter(x=>x!==uid)}).catch(()=>{})}await db.doc('ev/'+uid).delete();await db.doc('people/'+uid).delete()},'Deleted. Everything of yours is gone.');S.ui.ob={step:0,zone:4,cq:''};return}
};
ACT["stats"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {try{const r=await db.collection('ev').get();S.stats=docs(r)}catch(e){toast('Couldn’t load the results.')}render();return}
};
