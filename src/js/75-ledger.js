/* pots and plans live in circle threads */
const pots=()=>S.threads.filter(t=>t.kind==='pot');
const plans=()=>S.threads.filter(t=>t.kind==='plan');
const nIn=t=>Object.values(t.pledges||{}).filter(Boolean).length;
const potOn=t=>t.mode==='split'||nIn(t)>=(t.min||2);
const potCur=t=>t.cur||'£';
function potState(t,u){const i=(t.pledges||{})[u],p=(t.paid||{})[u];if(!i)return 'out';if(!potOn(t))return 'pledged';if(u===t.by||p===true)return 'paid';if(p==='wait')return 'checking';return 'to pay'}
const potPaidN=t=>Object.entries(t.pledges||{}).filter(([u,v])=>v&&potState(t,u)==='paid').length;
/* favors: hours, logged when the person helped confirms */
function balance(u=S.uid){let b=0;for(const f of S.favors)if(f.status==='logged'){if(f.doer===u)b+=f.h;if(f.asker===u)b-=f.h}return Math.round(b*100)/100}
/* ---------- Ledger ---------- */
function vLedger(){
  const seg=S.ui.lseg||'favors';
  let out=`<h1 class="v">Ledger</h1><p class="lede">Favors in hours, pots in money. Everything inside ${esc(S.circle?.name||'your circle')}.</p>
  <div class="seg" role="tablist">${[['favors','Favors'],['pots','Pots']].map(([k,n])=>`<button role="tab" data-act="lseg" data-v="${k}" class="${seg===k?'on':''}" aria-selected="${seg===k}">${n}</button>`).join('')}</div>`;
  if(!S.me.circle)return out+soloLedger();
  out+=segHelp(seg);const lk=seg==='favors'?'favor':'pot';if(!isOpen(lk))return out+lockPanel(lk); // WS-B unlock hook
  return out+(seg==='favors'?ledgerFavors():ledgerPots());
}
function ledgerFavors(){
  const u=S.uid,b=balance();const mine=S.favors.filter(f=>f.status==='logged'&&(f.doer===u||f.asker===u)).sort((a,b)=>(b.loggedAt||b.at)-(a.loggedAt||a.at));
  const open=S.favors.filter(f=>f.status!=='logged').sort((a,b)=>b.at-a.at);
  let out=`<div class="money" style="margin-top:12px"><div class="meta">YOUR BALANCE</div><div class="bigh">${hrs(b)}</div><p class="formula" style="margin:0">1 favor = 1 hour of someone’s time, in 15-minute steps. Everyone’s hour is worth the same. Limit ${hrs(LIMIT)} · stays in the circle · can’t be bought or cashed out.</p></div>`;
  out+=`<div class="btns">${F.fvForm?'':`<button class="btn s" data-act="fv-form" data-v="ask">Ask a favor</button><button class="btn s ghost" data-act="fv-form" data-v="log">Someone helped me</button>`}</div>`;
  if(F.fvForm){const h=F.fvh||1,lg=F.fvForm==='log';
    out+=`<div class="card hot" style="margin-top:10px"><div class="km"><span class="kind l">${lg?'Log a favor someone did for you':'Ask a favor'}</span><button class="link" data-act="fv-form" data-v="">cancel</button></div>
    ${lg?`<label class="f">Who helped</label><div class="chips">${S.members.filter(m=>m.id!==u).map(m=>`<button class="chip ${F.fvwho===m.id?'on':''}" data-act="fv-who" data-v="${m.id}">${esc(m.name)}</button>`).join('')||'<span class="meta">Nobody else in the circle yet.</span>'}</div>`:''}
    <label class="f" for="fv-what">What</label><input class="in-t" id="fv-what" data-f="fvwhat" value="${esc(F.fvwhat||'')}" maxlength="60" placeholder="${lg?'Fixed my bike brakes':'Help me carry a wardrobe upstairs'}">
    <label class="f">How long, roughly</label><div class="chips">${FAVOR_H.map(([v,n])=>`<button class="chip ${h===v?'on':''}" data-act="fv-h" data-v="${v}">${n}</button>`).join('')}</div>
    <p class="meta">${lg?'Logged straight away: '+hrs(h).slice(1)+' to them, '+hrs(-h)+' to you.':'Whoever helps can adjust the hours before you confirm. Nothing is logged until you do.'}</p>
    <div class="btns"><button class="btn s" data-act="${lg?'fv-log':'fv-ask'}">${lg?'Log it':'Post to the circle'}</button></div></div>`}
  if(open.length)out+=`<div class="eyebrow">Open</div><div class="stack">${open.map(f=>{const who=f.asker===u?'You':nameOf(f.asker);
    const st=f.status==='open'?(f.asker===u?`<button class="link" data-act="fv-cancel" data-v="${f.id}">take it down</button>`:`<button class="btn s" data-act="fv-claim" data-v="${f.id}">I’ll do it</button>`)
      :f.status==='claimed'?(f.doer===u?`<button class="btn s" data-act="fv-done" data-v="${f.id}">Done it</button>`:`<span class="meta">${esc(nameOf(f.doer))} is on it</span>`)
      :f.asker===u?`<button class="btn s" data-act="fv-confirm" data-v="${f.id}">Confirm ${hrs(f.h).slice(1)}</button>`:`<span class="meta">Waiting for ${esc(nameOf(f.asker))} to confirm</span>`;
    return `<div class="card"><div class="km"><span class="kind l">${esc(who)} asked</span><span class="meta">about ${hrs(f.h).slice(1)} · ${esc(ago(f.at))}</span></div><p>${esc(f.what)}</p><div class="btns">${st}</div></div>`}).join('')}</div>`;
  out+=`<div class="eyebrow">Your favors</div>${mine.length?`<div class="card">${mine.slice(0,30).map(f=>{const plus=f.doer===u;return `<div class="tx"><span>${esc(f.what)}</span><span class="amt ${plus?'pos':'neg'}">${hrs(plus?f.h:-f.h)}</span><small>${plus?'You → '+esc(nameOf(f.asker)):esc(nameOf(f.doer))+' → you'} · ${esc(ago(f.loggedAt||f.at))}</small></div>`}).join('')}</div>`:'<p class="meta">Nothing logged yet.</p>'}`;
  out+=`<div class="eyebrow">The circle</div><div class="card">${S.members.map(m=>{const x=balance(m.id);return `<div class="tx"><span>${esc(m.id===u?'You':m.name)}</span><span class="amt ${x<0?'neg':x>0?'pos':''}">${hrs(x)}</span></div>`}).join('')}</div>`;
  return out+`<p class="formula">Money never goes in here. Groceries and trips are pots; favors are only time and effort, so nobody has to guess what a favor is worth.</p>`;
}
function ledgerPots(){
  const ps=pots().sort((a,b)=>(a.closed?1:0)-(b.closed?1:0)||b.at-a.at);
  let out=`<div class="safe"><b>INSANE never holds your money.</b> Pots track who’s in and who’s paid. You pay each other, or the shop, with whatever you already use.</div>`;
  out+=`<div class="btns">${F.newPot?'':'<button class="btn s" data-act="pot-new">+ New pot</button>'}</div>`;
  if(F.newPot){const m=F.npmode||'pledge';
    out+=`<div class="card hot" style="margin-top:10px"><div class="km"><span class="kind l">New pot</span><button class="link" data-act="pot-new">cancel</button></div>
    <label class="f" for="np-name">What for</label><input class="in-t" id="np-name" data-f="npname" value="${esc(F.npname||'')}" maxlength="40" placeholder="Festival tickets">
    <div class="row" style="gap:8px;align-items:flex-end"><div class="grow"><label class="f" for="np-each">${esc(cur())} each</label><input class="in-t" id="np-each" data-f="npeach" inputmode="numeric" value="${esc(F.npeach||'')}" placeholder="40"></div><div class="grow"><label class="f" for="np-by">By</label><input class="in-t" id="np-by" data-f="npby" value="${esc(F.npby||'')}" maxlength="30" placeholder="Friday"></div></div>
    <label class="f">How it works</label><div class="chips"><button class="chip ${m==='pledge'?'on':''}" data-act="np-mode" data-v="pledge">Pledge, then pay</button><button class="chip ${m==='split'?'on':''}" data-act="np-mode" data-v="split">Split pot</button></div>
    <p class="meta">${m==='pledge'?'Only goes ahead if enough of you commit. Nobody pays anything before then.':'Everyone who’s in pays you as they go. You confirm each one landed.'}</p>
    ${m==='pledge'?`<label class="f" for="np-min">Goes ahead if this many pledge</label><input class="in-t" id="np-min" data-f="npmin" inputmode="numeric" value="${esc(F.npmin||'')}" placeholder="4">`:''}
    <label class="f" for="np-pay">How to pay you <small>optional: a payment link or account details</small></label><input class="in-t" id="np-pay" data-f="nppay" value="${esc(F.nppay||'')}" maxlength="80" placeholder="paypal.me/you">
    <div class="btns"><button class="btn s" data-act="pot-create">Create pot</button></div></div>`}
  out+=`<div class="stack" style="margin-top:10px">${ps.length?ps.map(potCard).join(''):'<div class="card dash"><p class="meta">No pots yet. Flights, a PS5 for the flat, this week’s groceries.</p></div>'}</div>`;
  return out;
}
const PAYVIA=['Bank transfer','PayPal','Revolut','Cash in hand'];
function potCard(p){const u=S.uid,open=S.ui.pot===p.id,n=nIn(p),on=potOn(p),st=potState(p,u),c=potCur(p);
  const frac=p.mode==='split'?potPaidN(p)/Math.max(1,n):n/(p.min||2);
  let body='';
  if(open){
    body+=`<div class="ppl">${S.members.map(m=>{const s=potState(p,m.id);return `<span class="pp ${s.replace(' ','')}"><b>${esc(m.id===u?'You':m.name)}</b>${s}</span>`}).join('')}</div>`;
    if(p.closed)body+=`<p class="meta">Closed.</p>`;
    else if(!on){const ask=S.members.find(m=>!(p.pledges||{})[m.id]);
      body+=`<p class="meta">Nobody pays anything unless ${esc(p.min)} pledge${p.by_when?' by '+esc(p.by_when):''}. If it falls short the pot just closes: nothing moved, so nothing to refund.</p><div class="btns">${(p.pledges||{})[u]?`<button class="btn s ghost" data-act="pledge" data-v="${p.id}">Take back my pledge</button>${ask?`<button class="btn s ghost" data-act="pot-nudge" data-v="${p.id}" data-u="${ask.id}">Ask ${esc(ask.name)}</button>`:''}`:`<button class="btn s" data-act="pledge" data-v="${p.id}">Pledge ${esc(c)}${esc(p.per)}</button>`}</div>`}
    else if(st==='out')body+=`<div class="btns"><button class="btn s" data-act="pledge" data-v="${p.id}">I’m in: ${esc(c)}${esc(p.per)}</button></div>`;
    else if(st==='to pay')body+=`<p class="meta">${p.mode==='pledge'?'Goal met. ':''}Pay <b>${esc(nameOf(p.by))}</b> ${esc(c)}${esc(p.per)} with whatever you already use${p.pay?': <b>'+esc(p.pay)+'</b>':''}. They confirm it landed.</p>${S.ui.pay===p.id?`<div class="btns">${PAYVIA.map(v=>`<button class="btn s ghost" data-act="pot-paid" data-v="${p.id}" data-m="${v}">${v}</button>`).join('')}</div>`:`<div class="btns"><button class="btn s" data-act="pot-pay" data-v="${p.id}">I’ve paid ${esc(nameOf(p.by))} ${esc(c)}${esc(p.per)}</button></div>`}`;
    else if(st==='checking')body+=`<p class="meta">You marked it paid${(p.via||{})[u]?' ('+esc(p.via[u])+')':''}. Waiting for ${esc(nameOf(p.by))} to confirm it arrived.</p>`;
    else body+=`<p class="meta">${p.by===u?'You’re collecting this one.':'You’re paid up.'}</p>`;
    if(p.by===u&&!p.closed){const w=Object.entries(p.paid||{}).filter(([,v])=>v==='wait');
      if(w.length)body+=`<div class="panel"><div class="meta">Did it land?</div>${w.map(([x])=>`<div class="row" style="padding:4px 0"><span class="grow">${esc(nameOf(x))} · ${esc((p.via||{})[x]||'')}</span><button class="btn s" data-act="pot-confirm" data-v="${p.id}" data-u="${x}">Confirm</button></div>`).join('')}</div>`;
      body+=`<div class="btns"><button class="link" data-act="pot-close" data-v="${p.id}">Close the pot</button></div>`}
    body+=`<div class="btns"><button class="btn s ghost" data-act="open" data-type="thread" data-v="${p.id}">Thread</button></div>`;
  }
  return `<div class="card ${open?'hot':''}"><div class="potbtn" role="button" tabindex="0" data-act="pot-open" data-v="${p.id}" aria-expanded="${open}"><div class="km"><span class="kind l">${p.mode==='split'?'Split pot':'Pledge, then pay'} · ${esc(nameOf(p.by))}</span><span class="meta">${p.closed?'closed':p.by_when?'by '+esc(p.by_when):''}</span></div>
  <p><b>${esc(p.title)}</b> · ${esc(c)}${esc(p.per)} each</p><div class="bar"><i style="width:${Math.min(100,frac*100)}%;background:${on?'var(--good)':'var(--ball)'}"></i></div><div class="km" style="margin-top:4px"><span class="meta">${p.mode==='split'?potPaidN(p)+'/'+n+' paid':on?potPaidN(p)+'/'+n+' paid · goal met':n+'/'+esc(p.min)+' pledged'}</span><span class="meta">${open?'':'tap to open'}</span></div></div>${body}</div>`}

