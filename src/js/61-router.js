/* ---------- history routing (C05, C06) ---------- */
// Tabs, segments, an open thread and sheets each get a history entry, so the phone's Back button
// closes a sheet, leaves a thread, then goes back a tab, instead of leaving INSANE.
//   #/today   #/circle/plans   #/circle/thread/<id>   #/city/feed   #/ledger/pots   #/you
//   + /sheet/<name>[/<id>]    e.g. #/today/sheet/pot-new
// The route is read from S.ui after every draw (routeSync), so every way of changing screens is
// covered without touching the screens. A change pushes an entry, or, when the new route is the
// entry Back would land on (closing a sheet with its Close button), goes back to it, so Close and
// Back leave the same history. A sheet replacing another sheet replaces its entry. Back (popstate)
// puts S.ui back and restores that entry's scroll position. #c/#m invite and meet links still work.
const ROUTE={on:false,pending:false};
function routeOf(ui){
  if(!routeLive())return '';
  const t=ui.tab||'today';let r='#/'+t;
  if(ui.open&&ui.open.id)r+='/'+(ui.open.type||'thread')+'/'+encodeURIComponent(ui.open.id);
  else if(t==='circle'&&ui.cseg)r+='/'+ui.cseg;
  else if(t==='city'&&ui.sseg)r+='/'+ui.sseg;
  else if(t==='ledger'&&ui.lseg)r+='/'+ui.lseg;
  if(ui.sheet&&ui.sheet.t)r+='/sheet/'+encodeURIComponent(ui.sheet.t)+(ui.sheet.id?'/'+encodeURIComponent(ui.sheet.id):'');
  return r;
}
// Only the signed-in app has screens to route; sign-in, onboarding and Go dark keep one entry.
function routeLive(){return !!(S.me&&S.me.cell&&S.mode!=='signin'&&S.mode!=='boot'&&!isDark(S.me))}
const ROUTE_KEYS=['tab','cseg','sseg','lseg','open','sheet'];
function routeSnap(){const o={};for(const k of ROUTE_KEYS){const v=S.ui[k];o[k]=v&&typeof v==='object'?JSON.parse(JSON.stringify(v)):v}return o}
// '#/circle/plans' -> {tab:'circle',cseg:'plans'}: deep links into a tab (sheets aren't reopened from a bare URL).
function routeParse(h){
  const m=/^#\/(today|circle|city|ledger|you)(?:\/([^/]+)(?:\/([^/]+))?)?/.exec(h||'');if(!m)return null;
  const o={tab:m[1]},a=m[2]&&decodeURIComponent(m[2]);
  if(a&&a!=='sheet'){if(/^(thread|room|dm)$/.test(a)&&m[3])o.open={type:a,id:decodeURIComponent(m[3])};else if(m[1]==='circle')o.cseg=a;else if(m[1]==='city')o.sseg=a;else if(m[1]==='ledger')o.lseg=a}
  return o;
}
function routeState(r,prev){return {insane:1,r,prev,ui:routeSnap(),y:0}}
function routeSync(){
  if(ROUTE.pending)return;
  const r=routeOf(S.ui);if(!r){ROUTE.on=false;return}
  let st=null;try{st=history.state}catch(e){}
  try{
    if(!ROUTE.on||!st||!st.insane){ROUTE.on=true;history.replaceState(routeState(r,st&&st.insane?st.prev:null),'',location.pathname+location.search+r);return}
    if(st.r===r){if(JSON.stringify(st.ui)!==JSON.stringify(routeSnap()))history.replaceState(Object.assign({},st,{ui:routeSnap()}),'');return}
    if(st.prev&&st.prev.r===r){ROUTE.pending=true;history.back();return}
    const sheetSwap=st.ui&&st.ui.sheet&&S.ui.sheet&&st.r.split('/sheet/')[0]===r.split('/sheet/')[0];
    if(sheetSwap){history.replaceState(Object.assign(routeState(r,st.prev)),'',location.pathname+location.search+r);return}
    history.replaceState(Object.assign({},st,{y:scrollY}),'');
    history.pushState(routeState(r,{r:st.r,prev:null}),'',location.pathname+location.search+r);
  }catch(e){}
}
function routeApply(st){
  const ui=st.ui||{};const was=routeOf(S.ui);
  const openChanged=JSON.stringify(S.ui.open||null)!==JSON.stringify(ui.open||null);
  for(const k of ROUTE_KEYS)S.ui[k]=ui[k]===undefined?(k==='open'||k==='sheet'?null:S.ui[k]):ui[k];
  if(openChanged){S.msgs=[];if(typeof drop==='function'&&!S.ui.open)drop('msgs')}
  if(S.ui.tab)try{localStorage.setItem('insane_tab',S.ui.tab)}catch(e){}
  if(was!==routeOf(S.ui)){wire2();draw()}
  const y=st.y||0;requestAnimationFrame(()=>scrollTo(0,y));
}
addEventListener('popstate',e=>{
  const st=e.state;
  if(ROUTE.pending){ROUTE.pending=false;if(st&&st.insane&&st.r!==routeOf(S.ui))routeSync();return}
  if(!st||!st.insane||!routeLive())return;
  routeApply(st);
});
// At boot: a #/ route in the URL picks the tab and segment (a shared or bookmarked link, or a reload).
function routeBoot(){const o=routeParse(location.hash);if(!o)return;for(const k of Object.keys(o))S.ui[k]=o[k]}
try{if('scrollRestoration' in history)history.scrollRestoration='manual'}catch(e){}
