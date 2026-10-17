/* ---------- drops ---------- */
const DK={
 offer:{n:'Shop offer',s:'OFR',d:'Everyone who turns up in the hour gets the offer. One circle is drawn for the bigger prize.'},
 cash:{n:'Cash draw',s:'£',d:'A sponsor puts up the cash. It’s drawn among circles that turned up and split inside the winning circle. Free to enter, always.'},
 swap:{n:'Swap box',s:'SWP',d:'Bring something, take what’s in the box. The box keeps a log of every swap.'},
 twokey:{n:'Two-key',s:'2K',d:'Opens only when two different circles check in during the hour. Then everyone there gets the prize.'},
 dare:{n:'Counter dare',s:'DAR',d:'Do the dare at the counter, then check in with the door code to get the prize.'}};
function dropPhase(d,t=now()){return t<d.start?'soon':t<d.end?'open':'over'}
// The draw (C50). A drop made since v0.9 carries seedHash, the hash of a seed nobody can see while it's on
// (the server keeps it; in local mode the host's device does). When it closes the seed is published, and the
// draw is a seeded shuffle of the eligible circles: each circle once however many of it turned up, only
// check-ins inside the window, never the host's own circle. Same seed and check-ins, same order, anywhere.
// Drops from before v0.9 (no seedHash) keep v0.8's draw, so their winners still check out.
function drawEligible(d,ins){return [...new Set(ins.filter(i=>i.circle&&(i.at==null||(i.at>=d.start&&i.at<=d.end))&&i.circle!==d.hostCircle).map(i=>i.circle))].sort()}
function drawOrder(seed,cs){const r=mulberry(fnv32('draw|'+seed+'|'+cs.join(',')));const o=cs.slice();for(let i=o.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const x=o[i];o[i]=o[j];o[j]=x}return o}
function drawWinner(d,ins){
  if(!d.seedHash){const cs=[...new Set(ins.map(i=>i.circle).filter(Boolean))].sort();if(!cs.length)return null;return cs[fnvN(d.id+'|'+cs.join(','))%cs.length]}
  if(!d.seed)return null;const cs=drawEligible(d,ins);return cs.length?drawOrder(d.seed,cs)[0]:null;
}
const drawSealed=d=>!!(d&&d.seedHash&&!d.seed);
async function sha256hex(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(s))))].map(x=>x.toString(16).padStart(2,'0')).join('')}
// A closed drop whose seed hasn't reached this page yet: ask for it (the server adds it once the drop is
// over; in local mode the host's own device publishes it from its private store). Once per drop per page.
const SEEDASK={};
function drawSeedFetch(d){
  if(!drawSealed(d)||dropPhase(d)!=='over'||SEEDASK[d.id])return;SEEDASK[d.id]=1;
  const put=x=>{if(x&&x.seed){const o=S.drops.find(y=>y.id===d.id);if(o)o.seed=x.seed;render()}};
  if(S.backend==='server'){S.db.doc('drops/'+d.id).get().then(s=>put(s.exists&&s.data())).catch(()=>{SEEDASK[d.id]=0});return}
  const mine=d.host===S.uid&&(S.priv.seeds||{})[d.id];
  if(mine)S.db.doc('drops/'+d.id).update({seed:mine}).then(()=>put({seed:mine})).catch(()=>{SEEDASK[d.id]=0});
}
// Check a published seed against the hash that was out before anyone checked in.
const SEEDOK={};
function drawVerified(d){if(!d||!d.seed||!d.seedHash)return null;if(!(d.id in SEEDOK)){SEEDOK[d.id]=null;sha256hex(d.seed).then(h=>{SEEDOK[d.id]=h===d.seedHash;render()})}return SEEDOK[d.id]}
