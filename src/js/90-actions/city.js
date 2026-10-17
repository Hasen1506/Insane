/* feed */
ACT["pkind"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.pkind=d.v;render();return;
};
ACT["post"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const text=(F.ptext||'').trim();if(!text)return;if(await W(()=>db.collection('posts').add({city:me.city,circle:me.circle,cname:S.circle?.name||'',by:uid,name:pubName(),kind:F.pkind||'Made',text:text.slice(0,400),at:now(),flags:[]}),'Posted.')){F.ptext='';mark('post');logMine('Posted to the '+me.cityName+' feed');render()}return}
};
ACT["pdel"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc('posts/'+d.v).delete(),'Deleted.');return;
};
ACT["phide"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const ids=[...new Set([...(S.priv.hidden?.ids||[]),d.v])];await W(()=>db.doc(`data/users/${uid}/hidden`).set({ids}),'Hidden for you.');return}
};
ACT["pflag"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const p=S.posts.find(x=>x.id===d.v);if((p.flags||[]).includes(uid))return;await W(()=>db.doc('posts/'+p.id).update({flags:[...(p.flags||[]),uid]}),'Reported. Three reports hide it for everyone.');return}
};
/* calls */
ACT["call"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const ask=(F.cask||'').trim();if(!ask)return;if(await W(()=>db.collection('calls').add({city:me.city,circle:me.circle,cname:S.circle?.name||'',by:uid,ask:ask.slice(0,140),at:now(),answered:null,room:null}),'Call sent to '+me.cityName+'.')){F.cask='';logMine('Sent a call: '+ask);render()}return}
};
ACT["cdel"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc('calls/'+d.v).delete(),'Withdrawn.');return;
};
ACT["answer"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const c=S.calls.find(x=>x.id===d.v);if(c.answered){toast('Someone got there first.');return}const rref=db.collection('rooms').doc();
    if(await W(async()=>{await rref.set({circles:[c.circle,me.circle],names:{[c.circle]:c.cname,[me.circle]:S.circle?.name||''},title:c.ask.slice(0,40),ask:c.ask,at:now(),closesAt:now()+3*DAY,callId:c.id});await db.doc('calls/'+c.id).update({answered:{circle:me.circle,name:S.circle?.name||''},answeredAt:now(),room:rref.id})},'Room open with '+c.cname+' for 3 days.')){logMine('Answered '+c.cname+'’s call');S.ui.tab='circle';S.ui.open={type:'room',id:rref.id};wire2();render()}return}
};
/* Missions */
ACT["ms-create"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {if(!verified()){toast('Only circles that have met in person can propose.');return}const title=(F.mstitle||'').trim(),desc=(F.msdesc||'').trim();const loc=lpState('drop');if(!title||!desc){toast('Name it and say what happens.');return}if(loc.lat==null){toast('Put the area on the map.');return}
    const w=new Date((F.msdate||ymd(now()+3*DAY))+'T'+(F.mstime||'13:00')).getTime();if(!w||isNaN(w)||w<now()+2*HOUR){toast('Give it at least two hours’ notice.');return}
    const roles=(F.msroles||'').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,12).map(x=>x.slice(0,120));
    const r_=crypto.getRandomValues(new Uint32Array(2));const ang=r_[0]/2**32*2*Math.PI,off=.05+r_[1]/2**32*.12;const area={lat:+(loc.lat+off*Math.cos(ang)/KM_LAT).toFixed(4),lon:+(loc.lon+off*Math.sin(ang)/(KM_LAT*Math.cos(rad(loc.lat)))).toFixed(4)};
    const ref=db.collection('missions').doc();
    if(await W(()=>ref.set({city:me.city,cid:me.circle,cname:S.circle?.name||'',by:uid,title:title.slice(0,40),desc:desc.slice(0,240),roles,spot:(F.msspot||'').trim().slice(0,80),area,when:w,at:now(),confirms:{},ins:{[uid]:{circle:me.circle,cname:S.circle?.name||''}},verdict:{}}),'Sent to '+me.cityName+'. It goes live when three other circles confirm.')){Object.assign(F,{mstitle:'',msdesc:'',msroles:'',msspot:''});S.ui.dloc=null;S.ui.sheet={t:'mission',id:ref.id};wire2();render();logMine('Proposed a Mission: '+title)}return}
};
ACT["ms-confirm"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const m=S.missions.find(x=>x.id===d.v);if(await W(()=>db.doc('missions/'+m.id).update({confirms:{[me.circle]:S.circle?.name||''}}))){const n=Object.keys(Object.assign({},m.confirms,{[me.circle]:1})).filter(c=>c!==m.cid).length;if(n===3)celebrate('LIVE',m.title+' is live.');else toast('Confirmed for '+(S.circle?.name||'your circle')+'. '+n+' of 3.');logMine('Confirmed the Mission '+m.title)}return}
};
ACT["ms-in"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const m=S.missions.find(x=>x.id===d.v);if(await W(()=>db.doc('missions/'+m.id).update({ins:{[uid]:{circle:me.circle||null,cname:S.circle?.name||''}}}))){celebrate('IN',(m.roles||[]).length?'You’re in. Your briefing is on the card: keep it secret.':'You’re in. The exact spot comes 2 hours before.');logMine('In for '+m.title)}return}
};
ACT["ms-out"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc('missions/'+d.v).update({ins:{[uid]:null}}),'Out, no penalty. Missions are never owed.');return;
};
ACT["ms-verdict"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc('missions/'+d.v).update({verdict:{[uid]:d.x==='y'}}),'Thanks. If most people say it didn’t happen, the hosts lose their stake.');return;
};
ACT["ms-del"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  await W(()=>db.doc('missions/'+d.v).delete(),'Withdrawn.');closeSheet();return;
};
/* trails */
ACT["tr-add"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const loc=lpState('drop');const name=(F.trsname||'').trim();if(!name){toast('Name the stop.');return}if(loc.lat==null){toast('Put the stop on the map.');return}F.trstops=[...(F.trstops||[]),{name:name.slice(0,40),dare:(F.trsdare||'').trim().slice(0,80),lat:+loc.lat.toFixed(5),lon:+loc.lon.toFixed(5)}];F.trsname='';F.trsdare='';S.ui.dloc=null;render();return}
};
ACT["tr-rm"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  F.trstops=(F.trstops||[]).filter((_,i)=>i!==+d.i);render();return;
};
ACT["tr-create"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const title=(F.trtitle||'').trim(),stops=F.trstops||[];if(!title){toast('Name the trail.');return}if(stops.length<3){toast('Add at least 3 stops.');return}const day=F.trdate||today();const start=new Date(day+'T'+(F.trfrom||'12:00')).getTime(),end=new Date(day+'T'+(F.trto||'14:00')).getTime();if(!(end>start)){toast('The end has to be after the start.');return}if(end<now()){toast('That window has passed.');return}
    const ref=db.collection('trails').doc();if(await W(()=>ref.set({city:me.city,cid:me.circle,cname:S.circle?.name||'',by:uid,title:title.slice(0,40),stops,start,end,at:now()}),'Trail published.')){Object.assign(F,{trtitle:'',trstops:[]});S.ui.sheet={t:'trail',id:ref.id};wire2();render();logMine('Made a trail: '+title)}return}
};
ACT["tr-stamp"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const tr=S.trails.find(x=>x.id===d.v);const i=+d.i;const st=tr.stops[i];let how='word';
    // A pending permission prompt never times out on its own, so give up after 8 s and stamp on your word.
    const perm=await (navigator.permissions?.query({name:'geolocation'}).then(r=>r.state).catch(()=>'')??'');
    if(perm!=='denied'&&navigator.geolocation)toast('Checking where you are…');
    const pos=perm==='denied'?null:await new Promise(ok=>{if(!navigator.geolocation)return ok(null);const t=setTimeout(()=>ok(null),8000);try{navigator.geolocation.getCurrentPosition(p=>{clearTimeout(t);ok(p)},()=>{clearTimeout(t);ok(null)},{enableHighAccuracy:true,timeout:8000,maximumAge:30000})}catch(e){clearTimeout(t);ok(null)}});
    if(pos){const km=distKm([pos.coords.latitude,pos.coords.longitude],[st.lat,st.lon]);if(km>.15){toast(`Your phone says you’re ${fmtKm(km)} from ${st.name}. Get within 150 m.`);return}how='gps'}
    const s0=myStamp(tr);const stops=Object.assign({},s0?.stops||{},{[i]:{at:now(),how}});const done=Object.keys(stops).length>=tr.stops.length;
    if(await W(()=>db.doc('stamps/'+tr.id+'_'+uid).set({trail:tr.id,uid,name:pubName(),circle:me.circle,cname:S.circle?.name||'',city:me.city,week:weekKey(),stops,done:done?now():null}))){if(done){celebrate('TRAIL DONE','All '+tr.stops.length+' stops. '+(S.circle?.name||'Your circle')+' is in the draw.');logMine('Finished '+tr.title)}else celebrate(String(i+1),'Stamped '+st.name+(how==='word'?', on your word: this page can’t read your location.':'.'))}return}
};
/* feed reactions */
ACT["freact"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const p=S.posts.find(x=>x.id===d.v);if(!me.circle){toast('Join a circle first.');return}const was=(p.reacts||{})[uid]?.r;const v=was===d.r?null:{r:d.r,circle:me.circle,cname:S.circle?.name||''};
    if(await W(()=>db.doc('posts/'+p.id).update({reacts:{[uid]:v}}))){if(v&&d.r==='steal'){const ref=db.collection(`circles/${me.circle}/threads`).doc();if(await W(()=>ref.set({kind:'plan',title:p.text.slice(0,40),by:uid,at:now(),when:'',where:'',going:{[uid]:true},stolen:p.cname}),'Stolen: it’s a plan in your circle now. '+p.cname+' can see you stole it.'))logMine('Stole an idea from '+p.cname)}else if(v&&d.r==='in')toast(p.cname+' can see '+(S.circle?.name||'your circle')+' wants in. If they post a Call, answer it.');else if(v)sfx()}return}
};
