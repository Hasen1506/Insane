/* drops */
ACT["dkind"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.dkind=d.v;render();return;
};
ACT["dlen"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.dlen=+d.v;render();return;
};
ACT["d-create"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const k=F.dkind||'swap';const venue=(F.dvenue||'').trim(),prize=(F.dprize||'').trim();const loc=lpState('drop');if(!venue||!prize){toast('Add the place and the prize.');return}if(loc.lat==null){toast('Put the drop on the map.');return}if(k==='dare'&&!(F.ddare||'').trim()){toast('Write the dare.');return}
    const start=new Date((F.ddate||today())+'T'+(F.dtime||'18:00')).getTime();if(!start||isNaN(start)){toast('Check the day and time.');return}if(start<now()-30*MIN){toast('That time has passed.');return}
    const ref=db.collection('drops').doc();const code=rnd(6,CODEA);const ch=await codeHash(code,ref.id);
    const seed=S.backend==='server'?null:rnd(32);const seedHash=seed?await sha256hex(seed):null; // WS-E: the server makes its own
    const dd={city:me.city,lat:+loc.lat.toFixed(6),lon:+loc.lon.toFixed(6),g:gOf(loc.lat,loc.lon),venue:venue.slice(0,40),addr:(F.daddr||'').trim().slice(0,80),kind:k,prize:prize.slice(0,60),dare:k==='dare'?(F.ddare||'').trim().slice(0,80):'',item:k==='swap'?prize.slice(0,60):'',swaps:[],start,end:start+(F.dlen||60)*MIN,host:uid,hostName:me.name,codeHash:ch,at:now()};
    if(S.backend==='server')dd.code=code;else{dd.seedHash=seedHash;dd.hostCircle=me.circle||null}
    if(await W(async()=>{if(S.backend!=='server'){await db.doc(`data/users/${uid}/codes`).set(Object.assign({},S.priv.codes||{},{[ref.id]:code}));await db.doc(`data/users/${uid}/seeds`).set(Object.assign({},S.priv.seeds||{},{[ref.id]:seed}))}await ref.set(dd)},'Drop published. Your door code is in the drop.')){Object.assign(F,{dvenue:'',daddr:'',dprize:'',ddare:''});S.ui.dloc=null;S.ui.sheet={t:'drop',id:ref.id};wire2();render();logMine('Hosted a drop at '+venue)}return}
};
ACT["d-del"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc('drops/'+d.v).delete(),'Drop cancelled.');closeSheet();return;
};
ACT["checkin"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const dr=S.drops.find(x=>x.id===d.id);const code=(F.dcode||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length!==6){toast('Door codes are 6 letters and numbers.');return}if(dropPhase(dr)!=='open'){toast('This drop isn’t open right now.');return}
    if(S.backend!=='server'&&await codeHash(code,dr.id)!==dr.codeHash){toast('That’s not the door code. Ask at the counter.');return}
    const ci={drop:dr.id,city:me.city,week:weekKey(),uid,name:pubName(),circle:me.circle,cname:S.circle?.name||'',venue:dr.venue,kind:dr.kind,at:now()};if(S.backend==='server')ci.code=code;
    if(await W(()=>db.doc('checkins/'+dr.id+'_'+uid).set(ci))){F.dcode='';mark('checkin');logMine('Turned up at '+dr.venue);celebrate('HERE','Checked in. +10 for '+(S.circle?.name||'your circle'))}return}
};
ACT["swap"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const dr=S.drops.find(x=>x.id===d.id);const left_=(F.sleft||'').trim();if(!left_){toast('Say what you left.');return}const took=dr.item||'nothing';
    if(await W(async()=>{await db.doc('drops/'+dr.id).update({item:left_.slice(0,60),swaps:[...(dr.swaps||[]),{took,left:left_.slice(0,60),cname:S.circle?.name||'',at:now()}].slice(-30)});await db.doc('checkins/'+dr.id+'_'+uid).update({swapped:true})},'Swapped. You took '+took+'.')){F.sleft='';logMine('Swapped '+left_+' for '+took)}return}
};
