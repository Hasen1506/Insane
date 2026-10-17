/* go dark */
ACT["darkH"]=async(d)=>{
  F.darkH=+d.v;render();return;
};
ACT["dark-go"]=async()=>{const db=S.db,uid=S.uid,me=S.me;
  {const h=F.darkH||3;const st=darkStarts()[F.darkAt||0]||['Now',now()];const from=Math.max(now(),st[1]);const later=from>now()+MIN;
    if(await W(()=>db.doc('people/'+uid).update({darkUntil:from+h*HOUR,darkFrom:later?from:now(),darkH:h,darkWith:!!F.darkWith}),later?'Set. INSANE goes dark '+when(from)+' for '+h+' h.':'')){mark('dark');logMine(later?'Planned to go dark '+when(from)+' for '+h+' h':'Went dark for '+h+' h');const wth=!!F.darkWith;F.darkSet=false;F.darkAt=0;
      if(wth&&me.circle){const g=S.threads.find(t=>t.id==='general');const txt=later?`Going dark ${when(from)} for ${h} h. Join me? It’s on your Home.`:`Going dark for ${h} h from now. Join me? It’s on your Home.`;if(g)db.collection(`circles/${me.circle}/threads/general/msgs`).add({by:uid,name:me.name,text:txt,at:now()}).then(()=>db.doc(`circles/${me.circle}/threads/general`).update({last:{by:uid,name:me.name,text:txt.slice(0,80),at:now()}})).catch(()=>{})}render()}return}
};
ACT["dark-setup"]=async()=>{
  F.darkSet=true;S.ui.tab='today';S.ui.open=null;S.ui.sheet=null;render();scrollTo(0,0);return;
};
ACT["dark-cancel"]=async()=>{
  F.darkSet=false;render();return;
};
ACT["dark-at"]=async(d)=>{
  F.darkAt=+d.v;render();return;
};
ACT["dark-unplan"]=async()=>{const db=S.db,uid=S.uid;
  await W(()=>db.doc('people/'+uid).update({darkUntil:0,darkFrom:0}),'Cancelled.');return;
};
ACT["dark-join"]=async(d)=>{const db=S.db,uid=S.uid;
  {const m=S.members.find(x=>x.id===d.v);if(!m)return;const h=m.darkH||Math.round((m.darkUntil-m.darkFrom)/HOUR);if(await W(()=>db.doc('people/'+uid).update({darkUntil:m.darkUntil,darkFrom:m.darkFrom,darkH:h,darkWith:true}),`You’re going dark with ${m.name}, ${when(m.darkFrom)}.`)){mark('dark');logMine('Going dark with '+m.name)}return}
};
ACT["dark-back"]=async()=>{
  F.darkBack=true;render();return;
};
ACT["dark-stay"]=async()=>{
  F.darkBack=false;render();return;
};
ACT["dark-end"]=async()=>{const db=S.db,uid=S.uid,me=S.me;
  {const h=me.darkH,spent=now()-(me.darkFrom||now());F.darkBack=false;if(await W(()=>db.doc('people/'+uid).update({darkUntil:0,darkBack:{planned:h,after:Math.round(spent/MIN)}}))){logMine(`Came back after ${left(spent)} of ${h} h dark`)}return}
};
