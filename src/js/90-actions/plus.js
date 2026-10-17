/* the + sheet */
ACT["make"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  openSheet('make');return;
};
ACT["mk"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  {const k=d.v;if(UNLOCK_RULES[k]&&!isOpen(k)){openSheet('gloss',{id:k});return}S.ui.sheet=null;const go=(tab,extra)=>{S.ui.tab=tab;S.ui.open=null;Object.assign(S.ui,extra||{});wire2();render();scrollTo(0,0)};
    if(k==='check')go('today');else if(k==='dark'){F.darkSet=true;go('today')}else if(k==='seal'){F.mnmode='sealed';go('circle',{cseg:'midnight'})}else if(k==='midnight'){F.mnmode='unsigned';go('circle',{cseg:'midnight'})}
    else if(k==='favor'){F.fvForm='ask';go('ledger',{lseg:'favors'})}else if(k==='plan'){F.newPlan=true;go('circle',{cseg:'plans'})}else if(k==='pot'){F.newPot=true;go('ledger',{lseg:'pots'})}
    else if(k==='fpost')go('city',{sseg:'feed'});else if(k==='call')go('city',{sseg:'calls'});
    else openSheet({dare:'dare',mission:'propose',trail:'trail-new',drop:'host',meet:'meet',addj:'add-j'}[k]||'make');return}
};
ACT["lseg"]=async(d,el,a)=>{const db=S.db,uid=S.uid,me=S.me;
  S.ui.lseg=d.v;render();return;
};
