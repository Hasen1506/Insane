// WS-G differential (PLAN-V09 §5.c): potState/potOn/nIn/potPaidN and balance against v0.8 (fac3720), and the
// favor and pot actions run as whole sequences on both. Intended changes are listed, with why, in
// test/diff/changes/ws-g.json ("behaviour"); any other difference fails.
//   1. pure: identical on v0.8-shaped AND v0.9-shaped data (upi, paise amounts and via are ignored by the state)
//   2. actions: the same random op sequence on v0.8 and on v0.9 (src): after every op, every balance and every
//      pot state must match, unless v0.8 accepted an op that v0.9 refuses and the op is one of the documented
//      refusals. v0.9 must never accept what v0.8 refused.
'use strict';
const H = require('./harness');
const { prop, G, show } = require('../pbt/runner');
const CH = require('./changes/ws-g.json');

const U = ['ua', 'ub', 'uc', 'ud'];
const UID = G.pick([...U, 'ue']);
const POT9 = G.record({
  by: UID, mode: G.pick(['pledge', 'split', undefined]), min: G.pick([undefined, 2, 3, 4]), closed: G.pick([undefined, true]),
  cur: G.pick(['₹', '£', '€', undefined]), per: G.oneOf(G.int(1, 5000), G.map(G.int(1, 500000), p => p / 100)), upi: G.pick([undefined, '', 'meera.k@okaxis', 'not a vpa']),
  pledges: G.map(G.array(G.tuple(UID, G.bool()), { max: 6 }), Object.fromEntries),
  paid: G.map(G.array(G.tuple(UID, G.pick([true, false, 'wait', undefined])), { max: 6 }), Object.fromEntries),
  via: G.map(G.array(G.tuple(UID, G.pick(['UPI', 'Cash in hand'])), { max: 3 }), Object.fromEntries),
});
const FAV9 = G.array(G.record({ status: G.pick(['logged', 'open', 'claimed', 'done']), doer: UID, asker: UID, h: G.pick([.25, .5, 1, 2, 4]), at: G.int(0, 9), loggedAt: G.int(0, 9) }), { max: 40 });

module.exports = async function (t) {
  const h = await H.open();
  const same = (name, gen, call, opts) => { const r = h.same(name, gen, call, opts); t.ok(`${name}: ${r.ok ? 'identical on ' + r.runs + ' seeded inputs' : r.message}`, r.ok); };
  same('potOn/nIn/potState/potPaidN (v0.9-shaped pots)', G.tuple(POT9, UID), ([p, u]) => app => [app.get('potOn')(p), app.get('nIn')(p), app.get('potState')(p, u), app.get('potPaidN')(p)]);
  same('balance (v0.9-shaped favors)', G.tuple(FAV9, UID), ([f, u]) => app => app.get('balance')(u), { prepare: ([f]) => h.setState({ favors: f }) });

  // ---------- 2. actions, v0.8 vs v0.9 ----------
  const v08 = h.sides['v0.8'], v09 = h.sides['v0.9 src'];
  const DRIVER = `globalThis.__L={
    reset(){localStorage.clear();S.db=LocalDB();S.priv={};S.favors=[];S.threads=[];S.ui={};S.members=${JSON.stringify(U.map(id => ({ id, name: id.toUpperCase() })))}},
    as(u){S.uid=u;S.me={circle:'c1',name:u.toUpperCase(),cc:'IN'};for(const k of Object.keys(F))delete F[k]},
    async sync(){const g=async c=>(await S.db.collection('circles/c1/'+c).get()).docs.map(d=>({id:d.id,...d.data()}));S.favors=(await g('favors')).sort((a,b)=>a.what<b.what?-1:1);S.threads=(await g('threads')).sort((a,b)=>a.title<b.title?-1:1)},
    view(){return {b:${JSON.stringify(U)}.map(u=>balance(u)),p:S.threads.map(p=>[p.title,${JSON.stringify(U)}.map(u=>[potState(p,u),(p.paid||{})[u]??null,!!(p.pledges||{})[u]]),!!p.closed]),f:S.favors.map(f=>[f.what,f.status,f.h,f.asker,f.doer])}},
    async op(o,n){__L.as(o.u);const f=S.favors[o.i%Math.max(1,S.favors.length)],p=S.threads[o.i%Math.max(1,S.threads.length)];
      if(o.op==='ask'){F.fvwhat='f'+n;F.fvh=o.h;await act('fv-ask',{})}
      else if(o.op==='log'){F.fvwhat='f'+n;F.fvwho=o.w;F.fvh=o.h;await act('fv-log',{})}
      else if(o.op==='create'){F.newPot=true;F.npname='p'+n;F.npeach=String(o.per);F.npmode=o.mode;F.npmin=String(o.min);await act('pot-create',{})}
      else if(o.op.startsWith('fv-')){if(!f)return;if(o.op==='fv-done-save')F.fvh2=o.h;await act(o.op,{v:f.id})}
      else{if(!p)return;await act(o.op,{v:p.id,u:o.w,m:'Bank transfer'})}
      await __L.sync()},
  }`;
  v08.run(DRIVER); v09.run(DRIVER);
  const L8 = v08.get('__L'), L9 = v09.get('__L');
  // which documented refusal an op is, judged on the state before it (the two sides agree up to that point)
  const why = (o, st) => {
    const f = st.favors[o.i % Math.max(1, st.favors.length)], p = st.threads[o.i % Math.max(1, st.threads.length)];
    if (o.op === 'log' && o.w === o.u) return 'fv-log-self';
    if (o.op === 'fv-claim' && f && f.asker === o.u) return 'fv-claim-own';
    if (o.op === 'fv-done-save' && f && (f.doer !== o.u || f.status !== 'claimed')) return 'fv-done-not-yours';
    if (o.op === 'fv-confirm' && f && (f.asker !== o.u || f.status !== 'done' || f.doer === o.u)) return 'fv-confirm-not-yours';
    if (o.op === 'fv-cancel' && f && (f.asker !== o.u || f.status === 'logged')) return 'fv-cancel-not-yours';
    if (o.op === 'pot-confirm' && p && (p.by !== o.u || !(p.pledges || {})[o.w])) return 'pot-confirm-not-organiser';
    if (o.op === 'pot-paid' && p && (p.by === o.u || !(p.pledges || {})[o.u])) return 'pot-paid-not-in';
    return null;
  };
  const OP = G.record({ u: G.pick(U), op: G.pick(['ask', 'ask', 'log', 'fv-claim', 'fv-done-save', 'fv-confirm', 'fv-cancel', 'create', 'pledge', 'pot-paid', 'pot-confirm', 'pot-close']), i: G.int(0, 20), w: G.pick(U), h: G.pick([.25, .5, 1, 2, 4]), per: G.int(1, 5000), mode: G.pick(['pledge', 'split']), min: G.int(2, 4) });
  const seen = {};
  const r = await prop('diff ledger actions', G.array(OP, { min: 1, max: 24 }), async ops => {
    L8.reset(); L9.reset();
    for (let n = 0; n < ops.length; n++) {
      const o = ops[n];
      if (o.op === 'pledge' && !v08.get('S').threads.length) continue; // v0.8's pledge has no guard for a missing pot (both throw)
      const pre = JSON.parse(JSON.stringify({ favors: v08.get('S').favors, threads: v08.get('S').threads })), before = JSON.stringify(L8.view());
      await L8.op(o, n); await L9.op(o, n);
      const a = JSON.stringify(L8.view()), b = JSON.stringify(L9.view());
      if (a === b) continue;
      const k = why(o, pre);
      if (k && CH.behaviour[k] && b === before) { seen[k] = (seen[k] || 0) + 1; return true; } // v0.9 refused, on purpose; the sides now differ, so stop
      throw new Error(`op ${n} ${show(o)}: v0.8 → ${a.slice(0, 300)} but v0.9 → ${b.slice(0, 300)}${k ? ' (' + k + ')' : ''}`);
    }
    return true;
  }, { runs: +process.env.DIFF_RUNS ? Math.ceil(+process.env.DIFF_RUNS / 5) : 1000 });
  t.ok(`favor + pot actions: same balances and pot states as v0.8 after every op, except documented refusals (${r.runs} sequences; ${Object.entries(seen).map(([k, v]) => k + ' ×' + v).join(', ') || 'none hit'})`, r.ok, r.message || '');
  t.ok('every documented refusal was actually exercised', Object.keys(CH.behaviour).every(k => seen[k]), Object.keys(CH.behaviour).filter(k => !seen[k]).join(','));
};
