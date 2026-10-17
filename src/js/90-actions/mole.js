/* the Mole */
ACT["mole-claim"]=async()=>{const db=S.db,uid=S.uid,me=S.me;
  {const wk=weekKey();const ref=db.doc(`circles/${me.circle}/moles/${wk}`);const x=await ref.get().catch(()=>null);if(x&&x.exists){toast('Someone got there first. Watch them.');return}
    const {pick:pool,used}=moleDraw(); // WS-E: three you haven't had, until you've had them all
    if(await W(async()=>{await db.doc(`data/users/${uid}/mole`).set({week:wk,tasks:pool,prog:[0,0,0],at:now()});await ref.set({at:now(),n:3});await db.doc(`data/users/${uid}/molehist`).set({used,at:now()}).catch(()=>{})})){celebrate('MOLE','You’re the Mole. Only you can see your tasks.');logMine('Became the Mole for week '+weekNum())}return}
};
ACT["mole-step"]=async(d)=>{const db=S.db,uid=S.uid;
  {const m=myMole();if(!m)return;const i=+d.i;const prog=m.prog.slice();prog[i]=(prog[i]||0)+1;if(await W(()=>db.doc(`data/users/${uid}/mole`).update({prog}))){if(moleDone(Object.assign({},m,{prog}))===3)celebrate('3 OF 3','All three done. Act normal until Sunday.');else sfx()}return}
};
ACT["mole-vote"]=async(d)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc(`circles/${me.circle}/molevotes/${weekKey()}_${uid}`).set({week:weekKey(),by:uid,vote:d.v,at:now()}),'Vote in. You can change it until the reveal.');return;
};
ACT["mole-reveal"]=async()=>{const db=S.db,uid=S.uid,me=S.me;
  {const m=myMole();if(!m)return;const n=moleDone(m);if(await W(()=>db.doc(`circles/${me.circle}/moles/${weekKey()}`).update({revealed:{uid,done:n,at:now()}}))){const vs=S.votes.filter(v=>v.week===weekKey());const got=vs.filter(v=>v.vote===uid).length;if(got<vs.length/2)celebrate('GOT AWAY',`Got away with it. ${got} of ${vs.length} guessed you.`);else toast(`Caught: ${got} of ${vs.length} guessed you.`);logMine('Revealed as the Mole: '+n+' of 3 tasks')}return}
};
