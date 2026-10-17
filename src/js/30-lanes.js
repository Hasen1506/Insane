/* ---------- needs, wants, urges ---------- */
// The crisis line for the person's locale (int-1): India's Tele-MANAS by default (INSANE launches in India);
// the UK's Samaritans only when the phone's locale is GB, which is what v0.8 always showed.
const crisisGB=()=>{try{return /-GB$/i.test(navigator.language||'')}catch(e){return false}};
const crisisLine=()=>crisisGB()?'In the UK and Ireland, Samaritans answer any time on <b>116 123</b>.':'In India, Tele-MANAS answers any time, free, on <b>14416</b> (or 1-800-891-4416).';
const LANES={
 need:{k:'Need',lead:'I need to…',hz:'keep doing · this month',ph:'run three times a week',ex:['run 3 times a week','call home every Sunday','be in bed by 1 every night','read 10 pages a day']},
 want:{k:'Want',lead:'I want to…',hz:'reach · this season',ph:'go to Lisbon with the flat',ex:['go to Lisbon in May','learn to cook one proper dish','see a gig every month','save £300 for a bike']},
 urge:{k:'Urge',lead:'I’ve got an urge to…',hz:'do once · this week',ph:'sing karaoke in public',ex:['sing karaoke in public','tell someone how I feel','swim in the sea in winter','pull a harmless prank']}};
const NUM={one:1,once:1,two:2,twice:2,three:3,four:4,five:5,six:6,seven:7};
const DAYS=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
// Rules, not AI: your words never leave the page to be read. Returns what the line becomes and how it's checked.
function readUrge(lane,raw){
  let t=String(raw||'').trim().replace(/^(i\s+(really\s+)?(need|want|have|’ve got|'ve got|got)\s+(an\s+urge\s+)?to\s+|to\s+)/i,'').replace(/[.!]+$/,'');
  if(!t)return null;const l=t.toLowerCase();
  if(/suicid|kill myself|hurt myself|harm myself|cut myself|end it all|self.?harm|not be here/.test(l))return {kind:'Support',what:t};
  if(/\b(hurt|beat|kill|stab|steal|rob|revenge|stalk|weapon|drunk driv|drive drunk|fight someone|break in)\b/.test(l))return {kind:'No',what:t};
  let how='',goal=3;const m=l.match(/\b(\d+|one|two|three|four|five|six|seven|once|twice)\s*(x|times?)?\s*(a|per|each)\s*(week|wk)/);
  if(m){goal=Math.min(7,NUM[m[1]]||+m[1]||3);how=goal+' a week'}else if(/every\s*(day|night|morning)|daily|each day|a day\b/.test(l)){how='every day';goal=7}
  else{const d=DAYS.find(x=>l.includes(x));if(d){how='every '+d[0].toUpperCase()+d.slice(1,3);goal=1}else if(/month/.test(l)){how='once a month';goal=1}}
  const clean=t.replace(/\s*(\d+|one|two|three|four|five|six|seven|once|twice)\s*(x|times?)?\s*(a|per|each)\s*(week|wk)/i,'').replace(/\s*(every\s*(day|night|morning)|daily|each day)/i,'').trim()||t;
  const what=clean.charAt(0).toUpperCase()+clean.slice(1);
  if(lane==='urge'){
    if(/tell|confess|admit|how i feel|say (it|sorry)|apologi/.test(l))return {kind:'Midnight',what,how:'a night you pick',proof:'nothing to prove',note:'Send it unsigned at Midnight, or sealed with your name to open later.'};
    if(/scared|afraid|fear|nervous|terrif|heights|cold|sea|swim|jump|public|karaoke|sing|stage|speak|dance|ask (her|him|them|someone) out/.test(l))
      return {kind:'Ladder',what,how:'5 rungs, one a week',rungs:5,proof:'your circle’s tick',note:'You write the rungs. Your circle only sees “rung 2 of 5”.'};
    return {kind:'Dare',what,how:'this week',proof:'your circle’s tick',note:/prank/.test(l)?'Harmless only: nothing with money, phones, bedrooms or strangers.':'One go. Start small and climb.'}}
  if(lane==='want'){
    if(/£|\$|€|\bbuy\b|\bsave\b|tickets?|trip|holiday|flight|festival|\bgo to [a-z]/i.test(t))return {kind:'Plan + pot',what,how:'3 steps, the circle picks a date',proof:'pledge, then pay',note:'Nobody pays unless enough of you pledge. INSANE never holds the money.'};
    if(how)return {kind:'Pact',what,how,goal,proof:'a tick a time',note:'21 days, two free misses a week.'};
    return {kind:'Plan',what,how:'3 steps, the circle picks a date',proof:'who turns up',note:'Becomes a plan with its own thread when you’re ready.'}}
  return {kind:'Pact',what,how:how||'3 a week',goal:how?goal:3,proof:'a tick a time',note:'21 days, two free misses a week. Your circle sees the count, not the details.'};
}
function readCard(r){
  if(!r)return '<div class="read empty">Type a line, or tap an example. You’ll see what it turns into before anything starts.</div>';
  if(r.kind==='Support')return `<div class="read warn"><div class="rk">This one needs a person, not a pact</div>If you’re thinking about hurting yourself, talk to someone today. ${crisisLine()} Elsewhere, findahelpline.com lists free lines near you. This line won’t be saved.</div>`;
  if(r.kind==='No')return `<div class="read warn"><div class="rk">INSANE won’t turn this into anything</div>Nothing that could hurt someone, break the law or follow a person. Try it another way.</div>`;
  return `<div class="read"><div class="rk">How INSANE reads it</div><div class="rr"><span>Becomes</span><b>${esc(r.kind)}</b></div><div class="rr"><span>What</span><b>${esc(r.what)}</b></div><div class="rr"><span>How</span><b>${esc(r.how)}</b></div><div class="rr"><span>Proof</span><b>${esc(r.proof)}</b></div><div class="meta" style="margin-top:5px">${esc(r.note)}</div></div>`;
}

