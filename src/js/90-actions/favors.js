/* favors */
ACT["fv-form"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.fvForm=d.v||'';render();if(d.v)setTimeout(()=>{const x=$('#fv-what');if(x)x.focus()},50);return;
};
ACT["fv-h"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.fvh=+d.v;render();return;
};
ACT["fv-h2"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.fvh2=+d.v;render();return;
};
ACT["fv-who"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.fvwho=d.v;render();return;
};
ACT["fv-ask"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const what=(F.fvwhat||'').trim();if(!what){toast('Say what you need.');return}if(balance()<=LIMIT){toast(`You’re at ${hrs(balance())}. Help someone first: the limit is ${hrs(LIMIT)}.`);return}
    if(await W(()=>db.collection(`circles/${me.circle}/favors`).add({what:what.slice(0,60),h:F.fvh||1,asker:uid,doer:null,status:'open',at:now()}),'Posted. It’s logged when someone does it and you confirm.')){Object.assign(F,{fvForm:'',fvwhat:''});logMine('Asked a favor: '+what);render()}return}
};
ACT["fv-log"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const what=(F.fvwhat||'').trim(),who=F.fvwho,h=F.fvh||1;if(!who||who===uid){toast('Pick who helped.');return}if(!what){toast('Say what they did.');return}if(balance()-h<LIMIT){toast(`That would take you below ${hrs(LIMIT)}. Help someone first.`);return}
    if(await W(()=>db.collection(`circles/${me.circle}/favors`).add({what:what.slice(0,60),h,asker:uid,doer:who,status:'logged',at:now(),loggedAt:now()}))){Object.assign(F,{fvForm:'',fvwhat:'',fvwho:''});celebrate('THANKS',`Logged: ${hrs(h).slice(1)} to ${nameOf(who)}.`);logMine(nameOf(who)+' helped: '+what);render()}return}
};
ACT["fv-claim"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const f=S.favors.find(x=>x.id===d.v);if(!f||f.status!=='open'){toast('Someone’s already on it.');return}if(f.asker===uid)return;if(await W(()=>db.doc(`circles/${me.circle}/favors/${f.id}`).update({doer:uid,status:'claimed',claimedAt:now()}),`You’re on it. ${nameOf(f.asker)} can see you said yes.`))logMine('Said I’d help '+nameOf(f.asker)+': '+f.what);return}
};
ACT["fv-done"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  openSheet('fvdone',{id:d.v});return;
};
ACT["fv-done-save"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const f=S.favors.find(x=>x.id===d.v);if(!f||f.doer!==uid||f.status!=='claimed')return;const h=F.fvh2||f.h;if(await W(()=>db.doc(`circles/${me.circle}/favors/${f.id}`).update({status:'done',h,doneAt:now()}),`Sent. When ${nameOf(f.asker)} confirms, it’s logged.`)){closeSheet();logMine('Did a favor for '+nameOf(f.asker)+': '+f.what)}return}
};
ACT["fv-confirm"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const f=S.favors.find(x=>x.id===d.v);if(!f||f.asker!==uid||f.status!=='done'||f.doer===uid)return;if(balance()-f.h<LIMIT){toast(`That would take you below ${hrs(LIMIT)}. Help someone first, then confirm.`);return}if(await W(()=>db.doc(`circles/${me.circle}/favors/${f.id}`).update({status:'logged',loggedAt:now()}))){celebrate('LOGGED',`${hrs(f.h).slice(1)} to ${nameOf(f.doer)}. Thanks logged.`);logMine(nameOf(f.doer)+' helped: '+f.what)}return}
};
ACT["fv-cancel"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const f=S.favors.find(x=>x.id===d.v);if(!f||f.asker!==uid||f.status==='logged')return}
  await W(()=>db.doc(`circles/${me.circle}/favors/${d.v}`).delete(),'Taken down.');return;
};
