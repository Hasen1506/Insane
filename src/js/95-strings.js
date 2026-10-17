/* ---------- strings and locale (C95) ---------- */
// English is the source. Tamil and Hindi (v1.0, with native review) add a table under their code with
// the same keys; t() falls back to English key by key, so a half-done table still works. {name} slots
// take values; a name passed in is already isolated (nameOf, bidi), so word order can change per language.
// Moved here so far: the activity feed and its notices (79-activity.js). The rest of the copy still sits
// in the screen templates; docs/WS-H.md lists what is left.
const STR={en:{
  dir:'ltr',
  midOut:'Midnight went out',midSub:'An unsigned message in your circle',
  dropOpen:'{v} is open now',dropOpens:'{v} opens {w}',drop:'Drop',away:'{d} away',
  met:'You met {n}',metSub:'You can message each other now',
  answered:'{n} answered your call',sealed:'A sealed message opened',from:'From {n}',
  cheered:'{n} cheered you',dared:'{n} dared you',
  fvDone:'{n} did your favor',fvConfirm:'{w} · confirm to log it',fvClaimed:'{n} will do your favor',
  paidInto:'{n} paid into {p}',paidSub:'Check it landed, then confirm',
  mole:'The Mole was {n}',moleSub:'{d} of 3 tasks',
  mission:'New Mission: {t}',missionSub:'Proposed by {c} · {w}',
  drawn:'DRAWN',wins:'{c} wins the draw',aCircle:'a circle',
  pushOn:'Notifications are on.',pushNo:'Couldn’t turn notifications on in this browser.',
}};
const LANG=(()=>{try{const l=localStorage.getItem('insane_lang');return l&&STR[l]?l:'en'}catch(e){return 'en'}})();
function t(k,v){const s=(STR[LANG]||STR.en)[k]??STR.en[k]??k;return v?s.replace(/\{(\w+)\}/g,(m,x)=>v[x]??m):s}
try{document.documentElement.lang=LANG;document.documentElement.dir=t('dir')}catch(e){}
