/* onboarding */
ACT["ob-next"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  if(S.ui.ob.step===0&&obWhy(S.ui.ob,ageCheck(S.ui.ob))){render();return}
  S.ui.ob.step++;render();scrollTo(0,0);return;
};
ACT["ob-back"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.ob.step--;render();return;
};
ACT["ob-ex"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.ob[d.k]=d.v;render();return;
};
ACT["ob-finish"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  el.disabled=true;await finishOnboarding(d.v);return;
};
ACT["ob-lane"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.ob.lane=d.v;render();return;
};
ACT["ob-stake"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.ob.stake=+d.v;render();return;
};
ACT["ob-handle"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.ob.handle=d.v;render();return;
};
ACT["ob-circle"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const o=S.ui.ob;if(d.v==='join'){const code=(o.code||'').trim().toUpperCase();const x=await db.doc('codes/'+code).get().catch(()=>null);if(!x||!x.exists){toast('No circle has the code '+code+'. Check it with whoever sent it.');return}}o.how=d.v;o.step++;render();scrollTo(0,0);return}
};
