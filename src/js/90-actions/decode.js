/* decode */
ACT["decode"]=async()=>{const db=S.db,uid=S.uid,me=S.me;
  {const g=decNorm(F.deca);if(!g)return;const k=weekKey();const dec=Object.assign({},S.priv.dec||{});dec[k]=(dec[k]||0)+1;
    try{await db.doc(`data/users/${uid}/dec`).set(dec)}catch(e){}mark('decodeTry');
    const st=decodeState(S.solves);const won=()=>{mark('decodeSolve');F.deca='';const rank=S.solves.length+1;celebrate(ordinal(rank).toUpperCase(),'Solved. '+ordinal(rank)+' in '+me.cityName+', '+decPts(rank,st.nh)+' points.');logMine('Solved Decode week '+weekNum())};
    // server mode: the server has the answer and checks it (WS-E, C48); the page only learns right or wrong
    if(S.backend==='server'){if(st.revealed){toast('Right or not, the answer is already out.');return}if(await W(()=>db.call('decode/solve',{week:k,answer:g,name:pubName()})))won();return}
    if(!(await decCheck(g))){toast('Not it. Try again.');return}
    if(st.revealed){toast('Right, but the answer is already out.');return}
    const sv={week:k,city:me.city,uid,name:pubName(),circle:me.circle||null,cname:S.circle?.name||null,at:now(),hints:st.nh};
    if(await W(()=>db.doc('solves/'+k+'_'+uid).set(sv)))won();return}
};
