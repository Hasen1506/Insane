/* midnight and sealed */
ACT["mnwhen"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.mnwhen=d.v;render();return;
};
ACT["mn-send"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const text=(F.mntext||'').trim();if(!text){toast('Write something first.');return}const nm=S.members.filter(m=>m.id!==uid&&m.name&&m.name.length>1).find(m=>new RegExp('(^|[^\\p{L}])'+m.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^\\p{L}])','iu').test(text));if(nm){toast('Blocked. Midnight is about you: take out “'+nm.name+'” and say it about yourself.');return}const mid=dayStart(now())+DAY;const wn=F.mnwhen||'week';const k=wn==='tonight'?0:wn==='tomorrow'?1:crypto.getRandomValues(new Uint8Array(1))[0]%7;
    if(await W(()=>db.collection(`circles/${me.circle}/midnight`).add({text:text.slice(0,400),releaseAt:mid+k*DAY,flags:[]}),wn==='tonight'?'Queued for midnight. Unsigned.':wn==='tomorrow'?'Queued for tomorrow at midnight. Unsigned.':'Queued for a random night this week. Unsigned.')){F.mntext='';logMine('Midnight message queued');if(S.ui.sheet)closeSheet();else render()}return}
};
ACT["mflag"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const m=S.midnight.find(x=>x.id===d.v);if((m.flags||[]).includes(uid))return;await W(()=>db.doc(`circles/${me.circle}/midnight/${m.id}`).update({flags:[...(m.flags||[]),uid]}),'Flagged.');return}
};
ACT["sealw"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.sealw=+d.v;render();return;
};
ACT["seal-send"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const text=(F.sealtext||'').trim();if(!text){toast('Write something first.');return}const o=sealOpts()[F.sealw??0];
    if(await W(()=>db.collection(`circles/${me.circle}/sealed`).add({by:uid,text:text.slice(0,600),openAt:o[1],label:o[0],at:now()}),'Sealed. It opens '+when(o[1])+'.')){F.sealtext='';logMine('Sealed a message: opens '+o[0].toLowerCase());if(S.ui.sheet)closeSheet();else render()}return}
};
/* Midnight */
ACT["mnmode"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.mnmode=d.v;render();return;
};
ACT["mn-react"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const m=S.midnight.find(x=>x.id===d.v);const was=(m.reacts||{})[uid];if(await W(()=>db.doc(`circles/${me.circle}/midnight/${m.id}`).update({reacts:{[uid]:was===d.r?null:d.r}}))&&was!==d.r)sfx();return}
};
ACT["mn-remove"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {if(S.ui.confirm!=='mnrm'+d.v){S.ui.confirm='mnrm'+d.v;render();setTimeout(()=>{if(S.ui.confirm==='mnrm'+d.v){S.ui.confirm=null;render()}},4000);return}S.ui.confirm=null;await W(()=>db.doc(`circles/${me.circle}/midnight/${d.v}`).update({removed:true}),'Removed for everyone. Nobody sees who removed it.');return}
};
