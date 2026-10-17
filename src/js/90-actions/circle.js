/* circle */
ACT["cs-create"]=async(d,el,a)=>{
  {const n=(F.csname||'').trim();if(!n){toast('Give the circle a name.');return}closeSheet();await createCircle(n);F.csname='';return}
};
ACT["cs-join"]=async()=>{
  {const c=(F.cscode||'').trim().toUpperCase();if(c.length!==6){toast('Codes are 6 letters.');return}closeSheet();await joinCircle(c);F.cscode='';return}
};
ACT["leave"]=async()=>{const db=S.db,uid=S.uid;
  if(S.ui.confirm!=='leave'){S.ui.confirm='leave';toast('Tap “Leave” again to leave '+S.circle.name+'.');setTimeout(()=>{S.ui.confirm=null},4000);return}
    S.ui.confirm=null;{const c=S.circle,rest=myCircles().filter(x=>x!==c.id);await W(async()=>{await db.doc('people/'+uid).update({circle:rest[0]||null,circles:rest});await db.doc('circles/'+c.id).update({members:(c.members||[]).filter(x=>x!==uid)});await db.doc(`circles/${c.id}/progress/${uid}`).delete()},'You left '+c.name+'.');logMine('Left '+c.name)}return;
};
ACT["tkind"]=async(d)=>{
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
/* C38: a message shows at once as "Sending…", "Not sent · Retry" if it fails (the text is kept), and the */
/* same text can't go twice while the first is still on its way (a double tap, Enter + the button). */
ACT["send"]=async()=>{const text=(F.msg||'').trim(),o=S.ui.open;if(!text||!o)return;const p=openPath(o);
  if((S.outbox||[]).some(x=>x.p===p&&x.text===text&&x.st==='sending'))return;
  F.msg='';const inp=$('#m-text');if(inp)inp.value='';
  const ob={id:rnd(8),p,o,text,st:'sending'};S.outbox=[...(S.outbox||[]),ob];render(true);await sendOut(ob)};
ACT["send-retry"]=async d=>{const ob=(S.outbox||[]).find(x=>x.id===d.v);if(ob&&ob.st!=='sending'){ob.st='sending';render();await sendOut(ob)}};
ACT["going"]=async(d)=>{const db=S.db,uid=S.uid,me=S.me;
  {const t=S.threads.find(x=>x.id===d.v);const v=!(t.going||{})[uid];await W(()=>db.doc(`circles/${me.circle}/threads/${t.id}`).update({going:{[uid]:v}}),v?'You’re in.':'Marked as can’t make it.');if(v)logMine('Said yes to '+t.title);return}
};
ACT["pledge"]=async(d)=>{const db=S.db,uid=S.uid,me=S.me;
  {const t=S.threads.find(x=>x.id===d.v);const v=!(t.pledges||{})[uid];if(await W(()=>db.doc(`circles/${me.circle}/threads/${t.id}`).update({pledges:{[uid]:v}}))){if(v){logMine('Pledged '+amt(t)+' to '+t.title);if(t.mode!=='split'&&nIn(t)+1===(t.min||2))celebrate('GOAL MET',t.title+': '+(nIn(t)+1)+' of '+t.min+'. Everyone now pays '+nameOf(t.by)+' directly.');else toast(t.mode==='split'?'You’re in. Pay '+nameOf(t.by)+' '+amt(t)+' when you can.':'Pledged '+amt(t)+'. '+(nIn(t)+1)+' of '+t.min+'. Nothing is charged unless it goes ahead.')}else toast('Pledge taken back. Nothing was charged, so there’s nothing to refund.')}return}
};
ACT["pay-save"]=async(d)=>{const db=S.db,uid=S.uid,me=S.me;
  {const t=S.threads.find(x=>x.id===d.v);if(t&&t.by!==uid)return;if(t&&potCur(t)==='₹'){const v=(F.upi??t.upi??'').trim();if(v&&!VPA.test(v)){toast('That UPI ID doesn’t look right. It’s like yourname@bank.');return}if(await W(()=>db.doc(`circles/${me.circle}/threads/${d.v}`).update({upi:v}),'Saved.')){F.upi=undefined;closeSheet()}return}}
  await W(()=>db.doc(`circles/${me.circle}/threads/${d.v}`).update({pay:(F.pay||'').trim().slice(0,80)}),'Saved.');closeSheet();return;
};
ACT["c-switch"]=async d=>switchCircle(d.v);
/* C28: the phone's own share sheet, then WhatsApp, then the clipboard */
ACT["share"]=async()=>{const c=S.circle;if(!c)return;const url=inviteUrl(c);
  if(navigator.share){try{await navigator.share({title:'INSANE',text:`Join my circle “${c.name}” on INSANE (code ${c.code})`,url});return}catch(e){if(e&&e.name==='AbortError')return}}
  const w=window.open(waLink(c),'_blank');if(w){try{w.opener=null}catch(e){}return}
  await act('copy',{v:url})};
