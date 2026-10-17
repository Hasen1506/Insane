/* nav */
ACT["tab"]=async(d)=>{
  S.ui.tab=d.v;S.ui.open=null;try{localStorage.setItem('insane_tab',d.v)}catch(e){}if(d.v==='city'&&S.ui.sseg==='feed')setSeen('feed');wire2();render();scrollTo(0,0);return;
};
ACT["cseg"]=async(d)=>{
  S.ui.cseg=d.v;if(d.v==='midnight')setSeen('midnight');render();return;
};
ACT["sseg"]=async(d)=>{
  S.ui.sseg=d.v;if(d.v==='feed')setSeen('feed');render();return;
};
ACT["sheet"]=async(d)=>{
  openSheet(d.v,{id:d.id});return;
};
ACT["sheet-close"]=ACT["sheet-bg"]=async()=>{
  closeSheet();return;
};
ACT["open"]=async(d)=>{
  S.ui.tab='circle';S.ui.open={type:d.type,id:d.v};S.msgs=[];setSeen((d.type==='thread'?'t:':d.type==='room'?'r:':'d:')+d.v);S.ui.sheet=null;wire2();render(true);return;
};
ACT["close"]=async()=>{
  S.ui.open=null;drop('msgs');render();return;
};
ACT["copy"]=async(d)=>{
  try{await navigator.clipboard.writeText(d.v);toast('Copied '+d.v)}catch(e){toast('Code: '+d.v)}return;
};
ACT["zone"]=async(d)=>{
  S.ui.zoneFilter=S.ui.zoneFilter===+d.v?null:+d.v;render();return;
};
