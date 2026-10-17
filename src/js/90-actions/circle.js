/* circle */
ACT["cs-create"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const n=(F.csname||'').trim();if(!n){toast('Give the circle a name.');return}closeSheet();await createCircle(n);F.csname='';return}
};
ACT["cs-join"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const c=(F.cscode||'').trim().toUpperCase();if(c.length!==6){toast('Codes are 6 letters.');return}closeSheet();await joinCircle(c);F.cscode='';return}
};
ACT["leave"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  if(S.ui.confirm!=='leave'){S.ui.confirm='leave';toast('Tap “Leave” again to leave '+S.circle.name+'.');setTimeout(()=>{S.ui.confirm=null},4000);return}
    S.ui.confirm=null;{const c=S.circle;await W(async()=>{await db.doc('people/'+uid).update({circle:null});await db.doc('circles/'+c.id).update({members:(c.members||[]).filter(x=>x!==uid)});await db.doc(`circles/${c.id}/progress/${uid}`).delete()},'You left '+c.name+'.');logMine('Left '+c.name)}return;
};
ACT["tkind"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.tkind=d.v;render();return;
};
ACT["t-create"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const k=F.tkind||'plan',title=(F.ttitle||'').trim();if(!title){toast('Give it a title.');return}
    const t={kind:k,title:title.slice(0,40),by:uid,at:now()};
    if(k==='plan'){t.when=(F.twhen||'').trim();t.where=(F.twhere||'').trim();t.going={[uid]:true}}
    if(k==='pot'){t.mode='pledge';t.cur=cur();t.paid={};t.per=Math.max(1,Math.round(+F.tper||0));t.min=Math.max(2,Math.round(+F.tmin||2));t.by_when=(F.tby||'').trim();t.pledges={[uid]:true};if(!F.tper){toast('Say how much each person puts in.');return}}
    const ref=db.collection(`circles/${me.circle}/threads`).doc();
    if(await W(()=>ref.set(t))){Object.assign(F,{ttitle:'',twhen:'',twhere:'',tper:'',tmin:'',tby:''});S.ui.sheet=null;S.ui.open={type:'thread',id:ref.id};S.ui.tab='circle';wire2();render();logMine('Started '+(k==='pot'?'a pot':k==='plan'?'a plan':'a thread')+': '+title)}return}
};
ACT["send"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const text=(F.msg||'').trim();if(!text)return;const o=S.ui.open,p=openPath(o);const m={by:uid,name:me.name,text:text.slice(0,600),at:now()};if(o.type==='room')Object.assign(m,{circle:me.circle,cname:S.circle?.name||''});
    F.msg='';const inp=$('#m-text');if(inp)inp.value='';
    if(await W(async()=>{await db.collection(p+'/msgs').add(m);const last={by:uid,name:me.name,text:text.slice(0,80),at:m.at};
      if(o.type==='thread')await db.doc(p).update({last});else if(o.type==='room')await db.doc(p).update({last});else{const ref=db.doc(p);const s=await ref.get();if(s.exists)await ref.update({last});else await ref.set({ids:S.met.find(x=>x.id===o.id)?.ids||[uid],last})}})){mark('msg');setSeen((o.type==='thread'?'t:':o.type==='room'?'r:':'d:')+o.id);render(true)}return}
};
ACT["going"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const t=S.threads.find(x=>x.id===d.v);const v=!(t.going||{})[uid];await W(()=>db.doc(`circles/${me.circle}/threads/${t.id}`).update({going:{[uid]:v}}),v?'You’re in.':'Marked as can’t make it.');if(v)logMine('Said yes to '+t.title);return}
};
ACT["pledge"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const t=S.threads.find(x=>x.id===d.v);const v=!(t.pledges||{})[uid];const c=potCur(t);if(await W(()=>db.doc(`circles/${me.circle}/threads/${t.id}`).update({pledges:{[uid]:v}}))){if(v){logMine('Pledged '+c+t.per+' to '+t.title);if(t.mode!=='split'&&nIn(t)+1===(t.min||2))celebrate('GOAL MET',t.title+': '+(nIn(t)+1)+' of '+t.min+'. Everyone now pays '+nameOf(t.by)+' directly.');else toast(t.mode==='split'?'You’re in. Pay '+nameOf(t.by)+' '+c+t.per+' when you can.':'Pledged '+c+t.per+'. '+(nIn(t)+1)+' of '+t.min+'. Nothing is charged unless it goes ahead.')}else toast('Pledge taken back. Nothing was charged, so there’s nothing to refund.')}return}
};
ACT["pay-save"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc(`circles/${me.circle}/threads/${d.v}`).update({pay:(F.pay||'').trim().slice(0,80)}),'Saved.');closeSheet();return;
};
