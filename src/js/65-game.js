/* ---------- the v0.6 game, now real: favors, pots, dares, clips, the Mole, Missions, trails ---------- */
const CURS={GB:'£',US:'$',CA:'$',AU:'$',NZ:'$',MX:'$',SG:'$',JP:'¥',CN:'¥',IN:'₹',NG:'₦',GH:'₵',KE:'KSh',ZA:'R',BR:'R$',CH:'CHF',SE:'kr',NO:'kr',DK:'kr',PL:'zł',TR:'₺',KR:'₩',PH:'₱',AR:'$',CO:'$',CL:'$'};
const EURO='AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ');
const cur=()=>{const cc=S.me&&S.me.cc;return EURO.includes(cc)?'€':CURS[cc]||'$'};
const HANDLES=['STATIC','LOW TIDE','PAPERCUT','NIGHT BUS','SLOW HAND','PIGEON','NEON','DRIZZLE','TIN CAN','LATE CAB','GHOST NOTE','KITE'];
const pubName=()=>S.me?.handle||S.me?.name||'Someone';
const STAKES=['My circle picks a dare from the jar','I cook for the circle','No stake, just the check-ins'];
const FAVOR_H=[[.25,'15 min'],[.5,'30 min'],[1,'1 hour'],[2,'2 hours'],[4,'Half a day']];
const hrs=h=>{const a=Math.abs(h),s=h>0?'+':h<0?'−':'';return s+(a%1===0?a:a.toFixed(2).replace(/0$/,''))+' h'};
const LIMIT=-5; // favors: nobody goes more than five hours into the red
const DARE_CAP=6; // dares go up to 6 out of 10 in the jar; nothing above that outside a venue with staff
const nc=(k,kc,r,body,btns,cls='')=>`<div class="card ${cls}"><div class="km"><span class="kind ${kc}">${k}</span><span class="meta">${r||''}</span></div>${body}${btns?`<div class="btns">${btns}</div>`:''}</div>`;
const safeImg=s=>typeof s==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)&&s.length<200000?s:'';
const isDark=m=>m&&m.darkUntil>now()&&(m.darkFrom||0)<=now();

/* a circle counts as met in person once two of its members have scanned each other */
const verifiedN=()=>{const v=(S.circle&&S.circle.verified)||{};return S.members.filter(m=>v[m.id]).length};
const verified=()=>verifiedN()>=2;
const cheerId=(to,label)=>`${to}_${S.uid}_${weekKey()}_${fnv(label)}`;
const jLabel=j=>j.read.kind==='Ladder'?'Ladder':j.read.what;
function cheersFor(u,label){return S.cheers.filter(c=>c.to===u&&c.label===label&&c.week===weekKey())}
/* the daily dare: one a day from the circle's jar (or the starters), from dares that were in it before today began */
function dailyDare(){const t0=dayStart(now());const j=S.dares.filter(d=>!d.to&&d.at<t0);
  const list=j.length?j:STARTER_DARES.map(([text,level],i)=>({id:'starter'+i,text,level,starter:true}));contentLoad();
  // a fixed shuffled cycle per circle (WS-E, C92): no dare comes round again until the whole list has
  return list[permAt(list.length,'dare|'+(S.me.circle||''),dayIdx(today()))]}
const moleReveal=(t=now())=>weekStart(t)+6*DAY+21*HOUR;
const myMole=()=>{const m=S.priv.mole;return m&&m.week===weekKey()&&S.mole?m:null};
const moleDone=m=>m.tasks.filter((ti,i)=>(m.prog[i]||0)>=MOLE_N[ti]).length;
/* Missions: a circle proposes, three other circles confirm, the exact spot goes out two hours before */
const msLive=m=>Object.keys(m.confirms||{}).filter(c=>c!==m.cid).length>=3;
function msRecord(cid){const done=S.missions.filter(m=>m.cid===cid&&m.when<now());let ok=0,bad=0;for(const m of done){const v=Object.values(m.verdict||{});if(!v.length)continue;if(v.filter(Boolean).length>=v.length/2)ok++;else bad++}return {hosted:done.length,ok,bad}}
const msSpot=m=>m.spot&&(m.cid===S.me.circle||((m.ins||{})[S.uid]&&now()>=m.when-2*HOUR))?m.spot:'';
function msRole(m){const r=(m.roles||[]).filter(Boolean);return r.length?r[fnvN(m.id+S.uid)%r.length]:''}
/* trails: stops on the map, stamped in any order inside the window */
const myStamp=tr=>S.stamps.find(s=>s.trail===tr.id&&s.uid===S.uid);
const stampN=s=>s?Object.keys(s.stops||{}).length:0;

