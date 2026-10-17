/* decode */
ACT["decode"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const g=(F.deca||'').toUpperCase().replace(/[^A-Z]/g,'');if(!g)return;const k=weekKey();const dec=Object.assign({},S.priv.dec||{});dec[k]=(dec[k]||0)+1;
    try{await db.doc(`data/users/${uid}/dec`).set(dec)}catch(e){}mark('decodeTry');
    if(fnv(g)!==CLUES[clueIdx()].a){toast('Not it. Try again.');return}
    const st=decodeState(S.solves);if(st.revealed){toast('Right, but the answer is already out.');return}
    const sv={week:k,city:me.city,uid,name:pubName(),circle:me.circle||null,cname:S.circle?.name||null,at:now(),hints:st.nh};if(S.backend==='server')sv.answer=g;
    if(await W(()=>db.doc('solves/'+k+'_'+uid).set(sv))){mark('decodeSolve');F.deca='';const rank=S.solves.length+1;celebrate(ordinal(rank).toUpperCase(),'Solved. '+ordinal(rank)+' in '+me.cityName+', '+decPts(rank,st.nh)+' points.');logMine('Solved Decode week '+weekNum())}return}
};
