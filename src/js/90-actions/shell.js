/* shell (WS-A): update bar, offline retry, Add to Home Screen */
ACT["app-update"]=async(d,el,a)=>{
  swUpdateNow();return;
};
ACT["app-retry"]=async(d,el,a)=>{
  location.reload();return;
};
ACT["a2hs-hide"]=async(d,el,a)=>{
  try{localStorage.setItem('insane_a2hs','hide')}catch(e){}render();return;
};
