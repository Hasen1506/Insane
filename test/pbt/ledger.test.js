// WS-G (PLAN-V09 §5.b P01–P05, C52, C53): the ledger's rules as properties, on the real client code.
// Favor and pot sequences run the app's own ACT handlers (src/, in a vm) against its LocalDB, with random
// actors doing random things, including what the UI never offers (confirming someone else's favor, confirming
// a payment to a pot you don't run). The server enforces the same rules (server.js threads/favors blocks).
//   P01 nobody's favor balance goes below −5 h          P02 nobody logs hours for themselves
//   P03 hours are conserved (balances sum to 0)          P04/P05 only the organiser confirms a payment; you only mark your own
//   pot money is kept in paise: paid + due = total = per × pledged, exactly
//   ₹ formatting: Indian grouping, and parse(format(x)) = x;  UPI: the link carries exactly the VPA, amount, note
'use strict';
const { prop, G } = require('./runner');
const { loadV09 } = require('../lib/load');

const U = ['ua', 'ub', 'uc', 'ud'];
const RUNS = +process.env.PBT_RUNS || 1000;

module.exports = async function (t) {
  const app = loadV09();
  app.run(`globalThis.__L={
    reset(){localStorage.clear();S.db=LocalDB();S.priv={};S.favors=[];S.threads=[];S.ui={};S.members=${JSON.stringify(U.map(id => ({ id, name: id.toUpperCase() })))}},
    as(u){S.uid=u;S.me={circle:'c1',name:u.toUpperCase(),cc:'IN'};for(const k of Object.keys(F))delete F[k]},
    async sync(){const g=async c=>(await S.db.collection('circles/c1/'+c).get()).docs.map(d=>({id:d.id,...d.data()}));S.favors=await g('favors');S.threads=await g('threads')},
    bal:u=>balance(u),
  }`);
  const L = app.get('__L'), act = app.get('act');
  const ok = (name, r) => t.ok(`${name} (${r.runs} seeded cases)`, r.ok, r.message || '');

  // ---------- favors: P01, P02, P03 ----------
  const FOP = G.record({ u: G.pick(U), op: G.pick(['ask', 'ask', 'log', 'claim', 'done', 'confirm', 'cancel']), i: G.int(0, 30), w: G.pick(U), h: G.pick([.25, .5, 1, 2, 4]) });
  ok('P01–P03 favors: balance ≥ −5 h, never for yourself, hours conserved', await prop('ledger favors', G.array(FOP, { min: 1, max: 30 }), async ops => {
    L.reset();
    for (const o of ops) {
      L.as(o.u); const f = app.get('S').favors[o.i % Math.max(1, app.get('S').favors.length)], F = app.get('F'), id = f ? f.id : 'none';
      if (o.op === 'ask') { F.fvwhat = 'help'; F.fvh = o.h; await act('fv-ask', {}); }
      else if (o.op === 'log') { F.fvwhat = 'helped'; F.fvwho = o.w; F.fvh = o.h; await act('fv-log', {}); } // o.w can be yourself
      else if (o.op === 'claim') await act('fv-claim', { v: id });
      else if (o.op === 'done') { F.fvh2 = o.h; await act('fv-done-save', { v: id }); }
      else if (o.op === 'confirm') await act('fv-confirm', { v: id });
      else await act('fv-cancel', { v: id });
      await L.sync();
      const fs = app.get('S').favors, b = U.map(L.bal);
      if (b.some(x => x < -5)) throw new Error('balance below −5 h: ' + b);
      if (fs.some(x => x.status === 'logged' && (!x.doer || x.doer === x.asker))) throw new Error('logged for yourself');
      if (Math.abs(b.reduce((a, x) => a + x, 0)) > 1e-9) throw new Error('hours not conserved: ' + b);
    }
    return true;
  }, { runs: RUNS }));

  // ---------- pots: P04, P05, conservation in paise ----------
  const POP = G.record({ u: G.pick(U), op: G.pick(['create', 'pledge', 'pledge', 'pay', 'pay', 'confirm', 'confirm', 'close']), i: G.int(0, 9), w: G.pick(U), mode: G.pick(['pledge', 'split']), per: G.oneOf(G.int(1, 99999), G.int(1, 10000000)), min: G.int(2, 4), via: G.pick(['UPI', 'Cash in hand', 'Bank transfer']) });
  ok('P04/P05 pots: only the organiser confirms, you mark only your own share, paise conserved', await prop('ledger pots', G.array(POP, { min: 1, max: 24 }), async ops => {
    L.reset();
    for (const o of ops) {
      L.as(o.u); const S = app.get('S'), F = app.get('F'); const p = S.threads[o.i % Math.max(1, S.threads.length)], id = p ? p.id : 'none';
      const before = JSON.stringify(p ? p.paid || {} : {});
      if (o.op === 'create') { F.newPot = true; F.npname = 'Pot ' + o.i; F.npeach = (o.per / 100).toFixed(2); F.npmode = o.mode; F.npmin = String(o.min); F.npupi = 'meera.k@okaxis'; await act('pot-create', {}); }
      else if (!p) continue; // nothing to act on yet
      else if (o.op === 'pledge') await act('pledge', { v: id });
      else if (o.op === 'pay') await act('pot-paid', { v: id, m: o.via });
      else if (o.op === 'confirm') await act('pot-confirm', { v: id, u: o.w });
      else await act('pot-close', { v: id });
      await L.sync();
      if (p) {
        const q = app.get('S').threads.find(x => x.id === p.id), was = JSON.parse(before);
        for (const [k, v] of Object.entries(q.paid || {})) if (JSON.stringify(v) !== JSON.stringify(was[k])) {
          if (v === true && o.u !== q.by) throw new Error(`${o.u} confirmed ${k} in a pot run by ${q.by}`);
          if (v === 'wait' && k !== o.u) throw new Error(`${o.u} marked ${k} as paid`);
        }
      }
      for (const q of app.get('S').threads) {
        for (const x of U) if (app.get('potState')(q, x) === 'paid' && x !== q.by && (q.paid || {})[x] !== true) throw new Error('paid without the organiser confirming');
        const s = app.get('potSum')(q), per = app.get('perP')(q);
        if (!(Number.isInteger(s.paid) && Number.isInteger(s.due) && s.paid + s.due === s.total && s.total === per * s.n)) throw new Error('paise not conserved: ' + JSON.stringify(s));
        if (q.upi !== 'meera.k@okaxis') throw new Error('UPI ID not stored');
      }
    }
    return true;
  }, { runs: RUNS }));

  // ---------- money formatting ----------
  const money = app.get('money'), toP = app.get('toP');
  const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
  ok('₹ uses Indian grouping (Intl en-IN currency, ".00" dropped for whole rupees)', prop('inr', G.oneOf(G.int(0, 99999), G.int(0, 1e11)), p => money(p, '₹') === INR.format(p / 100).replace(/\.00$/, ''), { runs: RUNS * 5 }));
  ok('format → parse round-trips exactly, every currency', prop('roundtrip', G.tuple(G.oneOf(G.int(0, 99999), G.int(0, 1e11)), G.pick(['₹', '£', '€', '$', '¥', 'R$', 'KSh'])), ([p, c]) => toP(money(p, c)) === p, { runs: RUNS * 5 }));
  t.ok('fixed points: ₹1,500 · ₹1,50,000 · ₹1,00,00,000 · ₹1,500.50 · £1,500', money(150000, '₹') === '₹1,500' && money(15000000, '₹') === '₹1,50,000' && money(1e9, '₹') === '₹1,00,00,000' && money(150050, '₹') === '₹1,500.50' && money(150000, '£') === '£1,500');
  ok('typed amounts: "1,50,000" "₹1500.5" ".5" parse; junk is NaN, never a number', prop('toP', G.str({ max: 12 }), s => { const v = toP(s); return Number.isNaN(v) || (Number.isInteger(v) && v >= 0); }, { runs: RUNS * 5 }));
  t.ok('typed amounts, fixed points', toP('1,50,000') === 15000000 && toP('₹1500.5') === 150050 && toP('.5') === 50 && Number.isNaN(toP('')) && Number.isNaN(toP('1.2.3')) && Number.isNaN(toP('abc')));

  // ---------- UPI ----------
  const VPA = app.get('VPA'), upiUri = app.get('upiUri');
  const HANDLE = G.str({ min: 2, max: 20, alphabet: 'abcdefghijklmnopqrstuvwxyz0123456789._-' }), BANK = G.pick(['okaxis', 'okhdfcbank', 'oksbi', 'ybl', 'paytm', 'upi', 'ibl', 'axl']);
  const GOODVPA = G.map(G.tuple(G.pick(['a', 'm', '9']), HANDLE, BANK), ([a, h, b]) => a + h + '@' + b);
  ok('valid VPAs pass; anything with spaces, no @, two @ or a bad bank fails', prop('vpa', G.oneOf(GOODVPA, G.str({ max: 30 })), s => !VPA.test(s) || (/^[^@\s]+@[a-z][a-z0-9]*$/i.test(s) && s.length <= 96)));
  t.ok('VPA fixed points', VPA.test('meera.k@okaxis') && VPA.test('9876543210@ybl') && !VPA.test('meera k@okaxis') && !VPA.test('paypal.me/you') && !VPA.test('a@b@c') && !VPA.test('@okaxis') && !VPA.test('me@1bank'));
  ok('upi://pay carries exactly pa, pn, am (2 dp), cu=INR, tn; nothing unescaped', prop('upi', G.tuple(GOODVPA, G.str({ max: 60 }), G.int(1, 1e9), G.str({ max: 60 })), ([pa, pn, p, tn]) => {
    const u = upiUri(pa, pn, p, tn);
    if (!/^upi:\/\/pay\?[A-Za-z0-9\-_.!~*'()%&=@]*$/.test(u)) throw new Error('unescaped: ' + u);
    const q = new URLSearchParams(u.slice('upi://pay?'.length)), cut = s => Array.from(s).slice(0, 50).join('');
    const okText = (got, want) => got === cut(want) || got === cut(want).replace(/[\uD800-\uDFFF]/g, ''); // a lone surrogate is dropped
    return [...q.keys()].join() === 'pa,pn,am,cu,tn' && q.get('pa') === pa && /^\d+\.\d\d$/.test(q.get('am')) && toP(q.get('am')) === p && q.get('cu') === 'INR' && okText(q.get('pn'), pn) && okText(q.get('tn'), tn);
  }, { runs: RUNS * 3 }));
  t.ok('UPI fixed point', upiUri('meera.k@okaxis', 'Meera K', 150050, 'Festival & co') === 'upi://pay?pa=meera.k@okaxis&pn=Meera%20K&am=1500.50&cu=INR&tn=Festival%20%26%20co');
};
