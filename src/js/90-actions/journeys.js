/* journeys */
ACT["jlane"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.jlane=d.v;render();return;
};
ACT["j-ex"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.jtext=d.v;render();return;
};
ACT["j-add"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const lane=F.jlane||'need',r=readUrge(lane,F.jtext);if(!r){toast('Type a line first.');return}if(r.kind==='Support'||r.kind==='No'){toast(r.kind==='No'?'INSANE won’t turn that into anything.':(crisisGB()?'Please talk to someone today. Samaritans: 116 123.':'Please talk to someone today. Tele-MANAS: 14416.'));return}
    if(await W(()=>addJourney(lane,F.jtext),'Started: '+r.what)){mark('nwu');logMine('Started '+LANES[lane].k.toLowerCase()+': '+r.what);F.jtext='';closeSheet();setTimeout(pushProgress,300)}return}
};
ACT["tick"]=ACT["untick"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const j=journeys().find(x=>x.id===d.v);const t=today();const ticks=a==='tick'?[...new Set([...(j.ticks||[]),t])]:(j.ticks||[]).filter(x=>x!==t);
    if(await W(()=>db.doc(`data/users/${uid}/${j.id}`).update({ticks}))){if(a==='tick'){mark('tick');logMine('Ticked: '+j.read.what);const c=jCount(Object.assign({},j,{ticks})),g=jGoal(j);if(c===g)celebrate('WEEK DONE',`${c} of ${g}. That’s the week done.`);else{sfx();toast('Ticked. '+c+' of '+g+' this week.')}}setTimeout(pushProgress,300)}return}
};
ACT["rung"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const j=journeys().find(x=>x.id===d.v);const r=(j.rung||0)+1;const top=r>=jGoal(j);if(await W(()=>db.doc(`data/users/${uid}/${j.id}`).update(Object.assign({rung:r},top?{status:'done',ended:now()}:{})))){if(top)celebrate('TOP RUNG','Top rung. Done.');else celebrate('RUNG '+r,'Rung '+r+' climbed.');mark('tick');logMine('Climbed rung '+r+' of '+j.read.what);setTimeout(pushProgress,300)}return}
};
ACT["step"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const j=journeys().find(x=>x.id===d.v);const steps=(j.steps||[]).map(s=>Object.assign({},s));const nx=steps.find(s=>!s.done);if(!nx)return;nx.done=true;const all=steps.every(s=>s.done);
    if(await W(()=>db.doc(`data/users/${uid}/${j.id}`).update(Object.assign({steps},all?{status:'done',ended:now()}:{})))){if(all)celebrate('REACHED','All done. That’s a want reached.');else{sfx();toast('Done: '+nx.t)}mark('tick');logMine(nx.t+' for '+j.read.what);setTimeout(pushProgress,300)}return}
};
ACT["j-done"]=ACT["j-drop"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const j=journeys().find(x=>x.id===d.v);if(await W(()=>db.doc(`data/users/${uid}/${j.id}`).update({status:a==='j-done'?'done':'dropped',ended:now()}),a==='j-done'?'Done. It’s on your timeline.':'Dropped. No penalty.')){logMine((a==='j-done'?'Finished: ':'Dropped: ')+j.read.what);closeSheet();setTimeout(pushProgress,300)}return}
};
ACT["j-menu"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  openSheet('j-menu',{id:d.v});return;
};
ACT["rungs-save"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const j=journeys().find(x=>x.id===d.v);const rt=(j.rungsText||[]).map((r,i)=>(F['rung'+i]??r).slice(0,60));await W(()=>db.doc(`data/users/${uid}/${j.id}`).update({rungsText:rt}),'Rungs saved.');return}
};
ACT["j-plan"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const j=journeys().find(x=>x.id===d.v);const pot=j.read.kind==='Plan + pot';const ref=db.collection(`circles/${me.circle}/threads`).doc();
    const t={kind:pot?'pot':'plan',title:j.read.what.slice(0,40),by:uid,at:now()};if(pot){t.mode='pledge';t.cur=cur();t.paid={};t.per=20;t.min=3;t.pledges={[uid]:true}}else{t.going={[uid]:true};t.when=''}
    if(await W(async()=>{await ref.set(t);await db.doc(`data/users/${uid}/${j.id}`).update({thread:ref.id})},pot?'Pot started. Set the amount in the thread.':'Plan started.')){S.ui.tab='circle';S.ui.open={type:'thread',id:ref.id};wire2();render()}return}
};
