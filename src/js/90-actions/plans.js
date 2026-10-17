/* plans */
ACT["np-toggle"]=async()=>{
  F.newPlan=!F.newPlan;render();if(F.newPlan)setTimeout(()=>{const x=$('#pl-what');if(x)x.focus()},50);return;
};
ACT["pl-when"]=async(d)=>{
  F.plwhen=d.v;render();return;
};
ACT["pl-money"]=async(d)=>{
  F.plmoney=d.v;render();return;
};
ACT["pl-create"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const what=(F.plwhat||'').trim();if(!what){toast('Say what the plan is.');return}const m=F.plmoney||'';const per=Math.round(+F.pleach||0);if(m&&!(per>0)){toast('Say how much each person puts in.');return}
    const tref=db.collection(`circles/${me.circle}/threads`).doc();const t={kind:'plan',title:what.slice(0,40),by:uid,at:now(),when:(F.plwhen||'').trim().slice(0,40),where:(F.plwhere||'').trim().slice(0,60),going:{[uid]:true}};
    let pref=null;if(m){pref=db.collection(`circles/${me.circle}/threads`).doc();t.pot=pref.id}
    if(await W(async()=>{await tref.set(t);if(pref)await pref.set({kind:'pot',title:what.slice(0,40),by:uid,at:now(),mode:m,per:Math.min(per,100000),cur:cur(),min:m==='pledge'?Math.max(2,Math.round(+F.plmin||3)):1,by_when:'',pay:'',pledges:{[uid]:true},paid:{},plan:tref.id})},m?'Plan sent with a pot attached. One message to the circle.':'Plan sent. Everyone taps in or out.')){Object.assign(F,{newPlan:false,plwhat:'',plwhen:'',plwhere:'',plmoney:'',pleach:'',plmin:''});logMine('Started a plan: '+what);render()}return}
};
ACT["rsvp"]=async(d)=>{const db=S.db,uid=S.uid,me=S.me;
  {const t=S.threads.find(x=>x.id===d.v);const v=d.x==='y';if(await W(()=>db.doc(`circles/${me.circle}/threads/${t.id}`).update({going:{[uid]:v}}),v?'You’re in. Only people going get pinged in its thread.':'Marked as can’t make it.')){if(v){sfx();logMine('Said yes to '+t.title)}}return}
};
