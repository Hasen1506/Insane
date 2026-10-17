/* shell (WS-A): update bar, offline retry, Add to Home Screen */
ACT["app-update"]=async()=>{
  swUpdateNow();return;
};
ACT["app-retry"]=async()=>{
  location.reload();return;
};
ACT["a2hs-hide"]=async()=>{
  try{localStorage.setItem('insane_a2hs','hide')}catch(e){}render();return;
};
