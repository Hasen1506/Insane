// WS-E differential checks against v0.8 (PLAN-V09 §5.c): what is meant to match still matches, and what
// is meant to change changes only in the documented way.
//   same:     decodeState and decPts (ranking and points), the hint thresholds, drawWinner for drops made
//             before v0.9, moleDone and the first 8 dares and Mole tasks
//   allowed:  drawWinner for v0.9 drops (C50, commit-reveal: drawn from the published seed among the circles
//             that checked in during the window; sealed = no winner);
//             dailyDare starters (C92: a no-repeat cycle instead of v0.8's hash, which repeated)
'use strict';
const H = require('./harness');
const { G } = require('../pbt/runner');
const DAY = 864e5;

module.exports = async function (t) {
  const h = await H.open();
  const report = (r, what) => t.ok(`${r.name.replace(/^diff /, '')}: ${r.ok ? what + ' on ' + r.runs + ' seeded inputs' : r.message}`, r.ok);
  const T = G.int(Date.UTC(2024, 0, 1), Date.UTC(2028, 0, 1));
  const UID = G.uid();
  // v0.9 solves as the server writes them (city, week, hints) still rank and score as in v0.8
  const SOLVES9 = G.array(G.record({ uid: UID, at: T, hints: G.int(0, 3), city: G.pick(['IN-tamil_nadu-chennai', 'PT-lisbon-lisbon']), week: G.pick(['2026-W42', '2026-W43']), circle: G.pick(['c1', 'c2', null]) }), { max: 30 });
  report(h.same('decodeState on v0.9-shaped solves', G.tuple(T, SOLVES9), ([t0, s]) => app => app.get('decodeState')(s), { prepare: x => h.setNow(x[0]) }), 'identical');
  report(h.same('decPts (rank × hints)', G.tuple(G.int(1, 60), G.int(0, 3)), ([r, n]) => app => app.get('decPts')(r, n)), 'identical');
  report(h.same('HINT_AT / HINT_DAY', G.constant(0), () => app => [app.get('HINT_AT'), app.get('HINT_DAY')], { runs: 1 }), 'identical');
  report(h.same('first 8 starter dares, Mole tasks and counts', G.constant(0), () => app => [app.get('STARTER_DARES').slice(0, 8), app.get('MOLE_TASKS').slice(0, 8), app.get('MOLE_N').slice(0, 8)], { runs: 1 }), 'identical');
  const MOLE = G.record({ tasks: G.array(G.int(0, 7), { min: 3, max: 3 }), prog: G.array(G.int(0, 4), { min: 3, max: 3 }) });
  report(h.same('moleDone on v0.8 task numbers', MOLE, m => app => app.get('moleDone')(m)), 'identical');

  // drawWinner, v0.9 drops: intentionally different. Allowed only when v0.9's answer is what commit-reveal says.
  const DROP9 = G.record({ id: G.str({ min: 1, max: 12, alphabet: 'abcdefghijkmnpqrstuvwxyz23456789' }), start: G.constant(1000), end: G.constant(5000), seedHash: G.constant('h'), seed: G.oneOf(G.str({ min: 8, max: 32, alphabet: '0123456789abcdef' }), G.constant(undefined)), hostCircle: G.pick([null, 'c1', 'c3']) });
  const INS = G.array(G.record({ circle: G.pick(['c1', 'c2', 'c3', 'c4', 'c5', '', null]), uid: UID, at: G.oneOf(G.int(0, 8000), G.constant(undefined)) }), { max: 20 });
  let changed = 0, sameAnyway = 0;
  const v9 = h.sides['v0.9 src'];
  const dw = h.same('drawWinner on v0.9 drops (C50 commit-reveal, documented change)', G.tuple(DROP9, INS), ([d, ins]) => app => app.get('drawWinner')(d, ins), {
    allow: (a, b, [d, ins]) => {
      changed++;
      const w = b.ok !== undefined ? JSON.parse(b.ok) : 'threw';
      const el = [...new Set(ins.filter(i => i.circle && (i.at == null || (i.at >= d.start && i.at <= d.end))).map(i => i.circle))].sort();
      if (!d.seed) return w === null; // sealed: nobody can compute it yet
      if (!el.length) return w === null;
      return el.includes(w) && w === v9.get('drawOrder')(d.seed, el)[0];
    },
  });
  report(dw, `v0.9 = the seeded draw among eligible circles (${changed} cases differ from v0.8, each checked)`);
  // and v0.8 winners stay checkable: a v0.8 drop (no seedHash) still gets exactly v0.8's winner (also in pure.test.js)
  const DROP8 = G.record({ id: G.str({ min: 1, max: 12, alphabet: 'abcdefghijkmnpqrstuvwxyz23456789' }), start: G.constant(1000), end: G.constant(5000) });
  report(h.same('drawWinner on v0.8 drops (legacy path)', G.tuple(DROP8, INS), ([d, ins]) => app => app.get('drawWinner')(d, ins)), 'identical');

  // dailyDare with the starters: v0.8 hashed (circle + date) and repeated; v0.9 cycles with no repeats (C92)
  const days = G.tuple(G.pick(['c1', 'Third Floor', 'x_9']), G.int(0, 3000));
  let rep8 = 0, rep9 = 0, runs = 0;
  const dd = h.same('dailyDare starters over 30 days (C92, documented change)', days, ([circle, d0]) => app => {
    const out = []; for (let i = 0; i < 30; i++) { app.setNow(Date.UTC(2026, 0, 1, 12) + (d0 + i) * DAY); app.setState({ me: { circle }, dares: [] }); out.push(app.run('dailyDare()').text); }
    return out;
  }, {
    runs: 60,
    allow: (a, b) => { const x = JSON.parse(a.ok), y = JSON.parse(b.ok); runs++; rep8 += x.length - new Set(x).size; rep9 += y.length - new Set(y).size; return new Set(y).size === 30 && y.every(s => v9.get('STARTER_DARES').some(d => d[0] === s)); },
  });
  report(dd, `v0.9 never repeats within 30 days (${rep9} repeats; v0.8 had ${rep8} across the same ${runs} 30-day runs)`);
  t.ok('the documented dailyDare change is real: v0.8 repeated within 30 days', runs > 0 && rep8 > 0 && rep9 === 0, `${rep8} vs ${rep9}`);
};
