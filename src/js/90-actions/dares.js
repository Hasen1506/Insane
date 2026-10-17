/* dares and clips */
ACT["dare-to"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.dareto=d.v;render();return;
};
ACT["dare-lvl"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.darelvl=+d.v;render();return;
};
ACT["dare-add"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const text=(F.drtext||'').trim();if(!text){toast('Write the dare.');return}const r=readUrge('urge',text);if(r&&(r.kind==='No'||r.kind==='Support')){toast('Not that one. Nothing that could hurt anyone.');return}{const why=NAMES.unsafeDare(text);if(why){toast('Not that one. '+why);return}}const to=F.dareto||null;
    if(await W(()=>db.collection(`circles/${me.circle}/dares`).add({text:text.slice(0,100),level:Math.min(DARE_CAP,F.darelvl||3),by:uid,at:now(),to,status:to?'open':null}),to?`Dared ${nameOf(to)}. They can say no, no reason needed.`:'In the jar. It can come up as the daily dare from tomorrow.')){Object.assign(F,{drtext:'',dareto:''});closeSheet();logMine(to?'Dared '+nameOf(to):'Put a dare in the jar')}return}
};
ACT["dare-del"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc(`circles/${me.circle}/dares/${d.v}`).delete(),'Taken out of the jar.');return;
};
ACT["dare-accept"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc(`circles/${me.circle}/dares/${d.v}`).update({status:'accepted'}),'Accepted. Tap “I did it” when it’s done.');return;
};
ACT["dare-decline"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc(`circles/${me.circle}/dares/${d.v}`).update({status:'declined'}),'Passed. No reason needed.');return;
};
ACT["dare-did"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const daily=d.v==='daily';const dd=daily?dailyDare():S.dares.find(x=>x.id===d.v);if(!dd)return;const note=(F.prnote||'').trim().slice(0,120);const img=safeImg(F.clipImg);
    const ok=await W(async()=>{
      if(daily){const ref=db.doc(`circles/${me.circle}/daily/${today()}`);const x=await ref.get();const v={[uid]:{at:now(),note}};if(x.exists)await ref.update({done:v});else await ref.set({dare:dd.text,done:v})}
      else await db.doc(`circles/${me.circle}/dares/${dd.id}`).update({status:'done',doneAt:now(),note});
      if(img)await db.collection(`circles/${me.circle}/clips`).add({by:uid,what:dd.text.slice(0,80),note,img,at:now(),exp:now()+DAY,seen:{}});
    });
    if(ok){Object.assign(F,{prnote:'',clipImg:''});closeSheet();mark('dare');logMine('Did a dare: '+dd.text);celebrate('DARED',img?'Done. Your photo is in the circle’s clips for 24 hours.':'Done. Your circle can see it.')}return}
};
ACT["clip-del"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc(`circles/${me.circle}/clips/${d.v}`).delete(),'Deleted.');closeSheet();return;
};
ACT["cheer"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const id=cheerId(d.u,d.l);if(await W(()=>db.doc(`circles/${me.circle}/cheers/${id}`).set({to:d.u,from:uid,label:d.l,week:weekKey(),at:now()}))){sfx();toast('Cheered '+nameOf(d.u)+'. They see who cheered.')}return}
};
