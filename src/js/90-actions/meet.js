/* meeting in person */
ACT["pair-show"]=async()=>{const db=S.db,uid=S.uid;
  {const code=String(100000+(crypto.getRandomValues(new Uint32Array(1))[0]%900000));const p={code,exp:now()+2*MIN,at:now()};if(await W(()=>db.doc('pair/'+uid).set(p))){S.pair=p;render()}return}
};
ACT["pair"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const code=(F.pairin||'').replace(/\D/g,'');if(code.length!==6){toast('Codes are 6 digits.');return}
    const r=await db.collection('pair').where('code','==',code).get().catch(()=>null);const hit=r&&r.docs.map(x=>Object.assign({id:x.id},x.data())).find(x=>x.exp>now()&&x.id!==uid);
    if(!hit){toast('That code has expired or doesn’t exist. Ask for a fresh one.');return}
    const id=pairId(uid,hit.id);person(hit.id);const mt={ids:[uid,hit.id].sort(),at:now(),near:me.near||'',city:me.city};if(S.backend==='server')mt.code=code;
    if(await W(()=>db.doc('met/'+id).set(mt))){F.pairin='';if(S.ui.sheet)closeSheet()}return}
};
