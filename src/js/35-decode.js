/* ---------- Decode: one city puzzle a week ---------- */
// The page never holds an answer (C48). In server mode the clue and the hints that are out come from
// /api/decode and a guess is checked by the server. In claude.ai and local mode the clue comes from the
// sealed local pack (34-packs.js): a guess is checked against a salted hash, and the answer is unsealed
// only once it's out. That second mode is an honour system, and says so on the sheet.
const HINT_AT=[3,8,15],HINT_DAY=[1,3,5];
function decodeState(solves){
  const ws=weekStart(),n=solves.length,t=now();
  const hints=HINT_AT.map((k,i)=>n>=k||t>=ws+HINT_DAY[i]*DAY);
  const reveal=Math.max(ws+4*DAY,ws+7*DAY-Math.min(n,24)*3*HOUR);
  return {n,hints,nh:hints.filter(Boolean).length,reveal,revealed:t>=reveal};
}
const decPts=(rank,nh)=>Math.max(5,Math.max(10,100-8*(rank-1))-15*nh);
// this week's puzzle in a city, local mode: a fixed shuffled cycle per city, so no repeats until the pack is used up
function decodeLocal(city,wk){const L=typeof DECODE_LOCAL!=='undefined'?DECODE_LOCAL:null;if(!L||!city)return null;const pk=packFor(L.packs,city);if(!pk||!pk.puzzles.length)return null;
  return pk.puzzles[permAt(pk.puzzles.length,'decode|'+city,isoWeekIdx(wk))]}
async function decHash(g,salt){const enc=new TextEncoder();const k=await crypto.subtle.importKey('raw',enc.encode(g),'PBKDF2',false,['deriveBits']);const b=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode('insane-decode|'+salt),iterations:(DECODE_LOCAL&&DECODE_LOCAL.iter)||10000},k,128);return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function decUnseal(p){const k=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('insane-seal|'+p.s+'|'+p.id)));const b=atob(p.z);let o='';for(let i=0;i<b.length;i++)o+=String.fromCharCode(b.charCodeAt(i)^k[i]);return o}
const DEC={cur:null,key:'',busy:false};
async function decodeFetch(city,wk,st){
  const none={week:wk,city,q:'No Decode in your town this week.',h:[null,null,null],none:true};
  if(S.backend==='server'){const j=await fetch('/api/decode?week='+encodeURIComponent(wk),{credentials:'same-origin'}).then(r=>r.json());
    return j.none?none:{week:wk,city,q:j.q,h:j.h,answer:j.answer||null,pack:j.pack,server:true}}
  const p=decodeLocal(city,wk);if(!p)return none;
  return {week:wk,city,q:p.q,h:p.h,answer:st.revealed?await decUnseal(p):null,local:p}
}
// The clue for this week and city: {q, h:[hint or null ×3], answer once out}, or a placeholder while it loads.
// Fetched again when the solve count, the hints out or the reveal change.
function decodeClue(){
  const city=S.me&&S.me.city,wk=weekKey(),st=decodeState(S.solves),key=[S.backend,city,wk,st.n,st.nh,st.revealed].join('|');
  if(DEC.key!==key&&!DEC.busy){DEC.busy=true;decodeFetch(city,wk,st).then(c=>{DEC.cur=c},()=>{}).finally(()=>{DEC.key=key;DEC.busy=false;render()})}
  return DEC.cur&&DEC.cur.week===wk&&DEC.cur.city===city?DEC.cur:{q:'This week’s puzzle is on its way…',h:[null,null,null],loading:true};
}
// local mode only: is this guess this week's answer?
async function decCheck(g){const c=DEC.cur;return !!(c&&c.local&&(await decHash(decNorm(g),c.local.s))===c.local.x)}
