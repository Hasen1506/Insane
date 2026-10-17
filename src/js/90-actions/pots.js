/* pots */
ACT["pot-go"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.tab='ledger';S.ui.lseg='pots';S.ui.pot=d.v;S.ui.open=null;S.ui.sheet=null;wire2();render();setTimeout(()=>{const x=document.querySelector(`[data-act="pot-open"][data-v="${d.v}"]`);if(x)x.scrollIntoView({block:'center'})},80);return;
};
ACT["pot-open"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.pot=S.ui.pot===d.v?null:d.v;S.ui.pay=null;render();return;
};
ACT["pot-new"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.newPot=!F.newPot;render();return;
};
ACT["np-mode"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.npmode=d.v;render();return;
};
ACT["pot-create"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const name=(F.npname||'').trim(),pp=toP(F.npeach),per=Math.min(pp,1e8)/100,m=F.npmode||'pledge',upi=cur()==='₹'?(F.npupi||'').trim():'';if(!name){toast('Say what the pot is for.');return}if(!(pp>0)){toast('Say how much each person puts in.');return}if(upi&&!VPA.test(upi)){toast('That UPI ID doesn’t look right. It’s like yourname@bank.');return}
    const t={kind:'pot',title:name.slice(0,40),by:uid,at:now(),mode:m,per,cur:cur(),min:m==='pledge'?Math.max(2,Math.round(+F.npmin||4)):1,by_when:(F.npby||'').trim().slice(0,30),pay:(F.nppay||'').trim().slice(0,80),pledges:{[uid]:true},paid:{},...(upi?{upi}:{})};
    const ref=db.collection(`circles/${me.circle}/threads`).doc();
    if(await W(()=>ref.set(t),m==='pledge'?`Pot created. It goes ahead if ${t.min} of you pledge.`:'Pot created. Everyone who’s in pays you as they go.')){Object.assign(F,{newPot:false,npname:'',npeach:'',npby:'',npmin:'',nppay:'',npupi:''});S.ui.pot=ref.id;logMine('Started a pot: '+name);render()}return}
};
ACT["pot-pay"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.pay=d.v;render();return;
};
ACT["pot-paid"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const p=S.threads.find(x=>x.id===d.v);if(!p||p.by===uid||!(p.pledges||{})[uid])return;if(await W(()=>db.doc(`circles/${me.circle}/threads/${p.id}`).update({paid:{[uid]:'wait'},via:{[uid]:d.m}}),d.m==='Cash in hand'?`Marked as cash to ${nameOf(p.by)}. They confirm when they have it.`:`Marked as paid by ${d.m}. ${nameOf(p.by)} confirms it landed. INSANE never sees the money.`)){S.ui.pay=null;logMine('Paid '+amt(p)+' into '+p.title)}return}
};
ACT["pot-confirm"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const p=S.threads.find(x=>x.id===d.v);if(!p||p.by!==uid||!(p.pledges||{})[d.u])return;if(await W(()=>db.doc(`circles/${me.circle}/threads/${p.id}`).update({paid:{[d.u]:true}}))){const rest=Object.entries(p.pledges||{}).filter(([x,v])=>v&&x!==p.by&&x!==d.u&&(p.paid||{})[x]!==true);if(!rest.length&&potOn(p))celebrate('ALL PAID',p.title+': everyone’s paid.');else{sfx();toast('Confirmed. '+nameOf(d.u)+' is paid up.')}logMine('Confirmed '+nameOf(d.u)+' paid into '+p.title)}return}
};
ACT["pot-nudge"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const p=S.threads.find(x=>x.id===d.v);const who=S.members.find(m=>m.id===d.u);if(!who)return;const txt=`@${who.name} you in? ${nIn(p)} of ${p.min} so far${p.by_when?', need it by '+p.by_when:''}.`;
    if(await W(async()=>{await db.collection(`circles/${me.circle}/threads/${p.id}/msgs`).add({by:uid,name:me.name,text:txt,at:now()});await db.doc(`circles/${me.circle}/threads/${p.id}`).update({last:{by:uid,name:me.name,text:txt.slice(0,80),at:now()}})},`Asked ${who.name} in the pot’s thread. It comes from you, not the app.`))logMine('Nudged '+who.name+' about '+p.title);return}
};
ACT["pot-close"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc(`circles/${me.circle}/threads/${d.v}`).update({closed:true}),'Pot closed.');return;
};
