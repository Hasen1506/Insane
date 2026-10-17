// int-1: WS-D's membership and read checks over WS-I's multi-circle people/{uid}.circles (MAX_CIRCLES = 3).
//   M01  over any sequence of joins (through `circles` or `circle`), leaves, primary switches and owner removals,
//        a person reads and writes circle B's docs if and only if B is in their people.circles; a member of
//        circle A never reads B unless they are in B too, and B's own doc shows them only the invite preview
//   M02  people.circles and circles/{cid}.members always agree, and nobody is ever in more than MAX_CIRCLES
//   M03  a removed member can't put the circle back in their own circles[]
// Against the real server rules, in process (test/lib/inproc.js). PBT_RUNS scales the case count; PBT_SEED replays.
'use strict';
const { prop } = require('./runner');
const I = require('../lib/inproc');

const RUNS = k => Math.max(20, Math.round((+process.env.PBT_RUNS || 1000) * k));
const none = function* () { };
const gen = f => ({ gen: r => f(r), shrink: none });
const MAX = Math.max(1, +process.env.MAX_CIRCLES || 3);
let WHY = ''; const fail = w => { WHY = w; return false; };

const circlesOf = u => { const d = I.S.getDoc('people/' + u.uid) || {}; return Array.isArray(d.circles) ? d.circles : d.circle ? [d.circle] : []; };
const canReadCircle = (u, cid) => {
  const g = I.get(`circles/${cid}/threads/general`, u), q = I.query(`circles/${cid}/threads`, u);
  return { get: !!g.doc, query: !!q.docs };
};

module.exports = async function (t) {
  const report = async (name, res) => { WHY = ''; res = await res; t.ok(`${name} (${res.runs} cases, seed ${res.seed})`, res.ok, (WHY ? WHY + ': ' : '') + (res.message || '')); };

  await report('M01+M02 a member of circle A can never read circle B unless they are in B (every circle, not just the primary)', prop('M01 multi-circle reads', gen(r => {
    const nc = r.int(2, 4), np = r.int(2, 6), ops = [];
    for (let i = 0, n = r.int(4, 18); i < n; i++) ops.push({ k: r.pick(['add', 'add', 'add', 'primary', 'drop', 'leaveAll', 'remove', 'set']), p: r.int(0, np - 1), c: r.int(0, nc - 1), c2: r.int(0, nc - 1) });
    return { nc, np, ops };
  }), c => {
    I.reset();
    const owners = Array.from({ length: c.nc }, (_, i) => I.person('Owner' + i));
    const cids = owners.map((o, i) => I.circle(o, 'Circle ' + i).cid);
    const ppl = Array.from({ length: c.np }, (_, i) => I.person('P' + i));
    const everyone = [...owners, ...ppl];
    const removed = new Set();
    for (const op of c.ops) {
      const u = ppl[op.p], cid = cids[op.c], mine = circlesOf(u);
      if (op.k === 'add') { const r = I.wr('update', 'people/' + u.uid, { circles: [...mine, cid] }, u); if (!r.ok && mine.length < MAX && !mine.includes(cid) && !removed.has(u.uid + cid)) return fail(`add refused: ${JSON.stringify(r)}`); if (r.ok && removed.has(u.uid + cid)) return fail('M03 a removed member re-added the circle'); }
      if (op.k === 'primary') I.wr('update', 'people/' + u.uid, { circle: cid }, u);
      if (op.k === 'drop') I.wr('update', 'people/' + u.uid, { circles: mine.filter(x => x !== cid) }, u);
      if (op.k === 'leaveAll') I.wr('update', 'people/' + u.uid, { circles: [], circle: null }, u);
      if (op.k === 'set') I.wr('update', 'people/' + u.uid, { circles: [cids[op.c], cids[op.c2]] }, u);
      if (op.k === 'remove' && mine.includes(cid)) { const r = I.route('circle/remove', { cid, uid: u.uid }, owners[op.c]); if (!r.ok) return fail('owner remove refused: ' + JSON.stringify(r)); removed.add(u.uid + cid); }
      // after every step, for every person and every circle
      for (const p of everyone) {
        const cs = circlesOf(p);
        if (cs.length > MAX) return fail(`M02 ${p.name} is in ${cs.length} circles`);
        const pd = I.S.getDoc('people/' + p.uid) || {};
        if (pd.circle && !cs.includes(pd.circle)) return fail(`M02 ${p.name}'s primary ${pd.circle} is not in circles[]`);
        for (const b of cids) {
          const inB = cs.includes(b), listed = ((I.S.getDoc('circles/' + b) || {}).members || []).includes(p.uid);
          if (inB !== listed) return fail(`M02 ${p.name}: circles[] says ${inB}, circles/${b}.members says ${listed}`);
          const rd = canReadCircle(p, b);
          if (rd.get !== inB || rd.query !== inB) return fail(`M01 ${p.name} in ${JSON.stringify(cs)}: read of ${b} get=${rd.get} query=${rd.query}`);
          const w = I.wr('set', `circles/${b}/clips/x${p.uid}`, { by: p.uid, text: 'hi', at: Date.now() }, p);
          if (!inB && w.ok) return fail(`M01 ${p.name} wrote to ${b} without being in it`);
          if (!inB) { const root = I.get('circles/' + b, p).doc; if (root && (root.members || []).length) return fail(`M01 ${p.name} saw ${b}'s member list`); }
          if (!inB && I.S.getDoc(`circles/${b}/clips/x${p.uid}`)) return fail('M01 a non-member write landed');
          if (w.ok) I.wr('delete', `circles/${b}/clips/x${p.uid}`, null, p);
        }
      }
    }
    return true;
  }, { runs: RUNS(0.3) }));

  await report('M02 joining past MAX_CIRCLES is refused and changes nothing', prop('M02 cap', gen(r => ({ extra: r.int(1, 3) })), c => {
    I.reset();
    const os = Array.from({ length: MAX + c.extra }, (_, i) => I.person('O' + i)), cids = os.map(o => I.circle(o).cid), p = I.person('P');
    const ok = I.wr('update', 'people/' + p.uid, { circles: cids.slice(0, MAX) }, p);
    if (!ok.ok) return fail('joining exactly MAX refused: ' + JSON.stringify(ok));
    const r = I.wr('update', 'people/' + p.uid, { circles: cids }, p);
    if (r.ok) return fail('joined more than MAX');
    return cids.slice(MAX).every(b => !((I.S.getDoc('circles/' + b) || {}).members || []).includes(p.uid) && !I.get(`circles/${b}/threads/general`, p).doc)
      && cids.slice(0, MAX).every(b => !!I.get(`circles/${b}/threads/general`, p).doc) || fail('state changed after a refused join');
  }, { runs: RUNS(0.1) }));
};
