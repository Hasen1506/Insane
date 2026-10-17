// WS-B properties: gradual unlock (P20, C25), the age gate (C17), and the pure first-run helpers.
'use strict';
const { prop, G } = require('./runner');
const { loadV09 } = require('../lib/load');
const RUNS = +process.env.PBT_RUNS || 1000;

module.exports = async function (t) {
  const app = loadV09();
  const unlocks = app.get('unlocks'), ruleHolds = app.get('ruleHolds'), KEYS = app.get('UNLOCK_KEYS'), lockReason = app.get('lockReason');
  const ageOK = app.get('ageOK'), adultFrom = app.get('adultFrom'), ageMin = app.get('ageMin');
  const report = (name, r) => t.ok(name, r.ok, r.message);

  const ctxG = G.record({ circle: G.bool(), members: G.int(0, 8), days: G.int(0, 30), met: G.bool(), plans: G.int(0, 5) });
  // P20: walk a person's first month (circles grow and shrink, people meet, days pass). The unlocked set
  // never loses a key, never holds a key whose rule hasn't held at some point so far, and always holds
  // every key whose rule holds right now.
  report('P20 unlocks never go backwards, never come early, never lag', prop('unlock walk', G.array(ctxG, 0, 25), walk => {
    let set = []; const seen = [];
    for (const c of walk) {
      seen.push(c);
      const next = [...unlocks(c, set)];
      if (!set.every(k => next.includes(k))) return false;                               // never re-locked
      if (!next.every(k => seen.some(s => ruleHolds(k, s)))) return false;              // never before its condition
      if (!KEYS.every(k => !ruleHolds(k, c) || next.includes(k))) return false;         // open as soon as it holds
      set = next;
    }
    return true;
  }, { runs: RUNS }));
  // monotone in each input from scratch: more members / days / plans, or meeting, never hides anything
  report('unlocks(ctx) ⊆ unlocks(ctx′) whenever ctx′ ≥ ctx', prop('unlock monotone', G.tuple(ctxG, G.record({ members: G.int(0, 4), days: G.int(0, 5), plans: G.int(0, 2), met: G.bool(), circle: G.bool() })), ([a, d]) => {
    const b = { circle: a.circle || d.circle, members: a.members + d.members, days: a.days + d.days, plans: a.plans + d.plans, met: a.met || d.met };
    const A = [...unlocks(a, [])], B = [...unlocks(b, [])]; return A.every(k => B.includes(k));
  }, { runs: RUNS }));
  report('every locked key says why, and points somewhere unless it is time-based', prop('lock reasons', ctxG, c => KEYS.every(k => ruleHolds(k, c) || (lockReason(k, c).why && (lockReason(k, c).go || /day/.test(lockReason(k, c).why)))), { runs: RUNS }));

  // C25's table, at its edges
  const at = c => [...unlocks(Object.assign({ circle: true, members: 1, days: 0, met: false, plans: 0 }, c), [])];
  const solo = [...unlocks({ circle: false, members: 0, days: 0, met: false, plans: 0 }, [])];
  t.ok('day 0 solo: pacts, daily dare, Decode, check-in, go dark, meet; no Midnight, Mole, drops, feed', ['pacts', 'daily', 'decode', 'check', 'dark', 'meet', 'addj'].every(k => solo.includes(k)) && ['midnight', 'mole', 'drop', 'trail', 'fpost', 'call', 'mission', 'favor', 'pot', 'plan'].every(k => !solo.includes(k)), solo.join(','));
  t.ok('in a circle on day 0: plans and chat open; favors and pots wait for the first plan', at({}).includes('plan') && at({}).includes('chat') && !at({}).includes('favor') && at({ plans: 1 }).includes('favor') && at({ plans: 1 }).includes('pot'));
  t.ok('Midnight at exactly 3 people, the Mole at exactly 4', !at({ members: 2 }).includes('midnight') && at({ members: 3 }).includes('midnight') && !at({ members: 3 }).includes('mole') && at({ members: 4 }).includes('mole'));
  t.ok('feed posts, Calls and Missions after meeting in person', !at({ members: 8 }).includes('fpost') && ['fpost', 'call', 'mission'].every(k => at({ met: true }).includes(k)));
  t.ok('drops and trails on day 3', !at({ days: 2 }).includes('drop') && at({ days: 3 }).includes('drop') && at({ days: 3 }).includes('trail'));
  t.ok('a circle shrinking from 4 to 3 keeps the Mole', [...unlocks({ circle: true, members: 3 }, unlocks({ circle: true, members: 4 }, []))].includes('mole'));
  t.ok('lock text names the count: "Needs 3 people", 2 more to go', lockReason('midnight', { circle: true, members: 1 }).why === 'Needs 3 people' && /2 more/.test(lockReason('midnight', { circle: true, members: 1 }).long));

  // the + menu on day 1, solo: at most about 6 rows (C25/C57), and none of them locked
  app.setState({ uid: 'u_meera', me: { name: 'Meera', circle: null, joined: Date.UTC(2026, 9, 12), cell: { s: 2 } }, members: [], threads: [], circle: null });
  const rows = app.run('makeRows()'); const n = rows.reduce((a, g) => a + g.items.length, 0);
  t.ok('+ menu, solo day 1: ≤ 6 rows, grouped, only unlocked ones', n <= 6 && n > 0 && rows.every(g => g.items.every(k => app.run(`isOpen(${JSON.stringify(k)})`))), JSON.stringify(rows));
  const sheet = app.run('makeSheetV09()');
  t.ok('+ menu, solo: offers "Start or join a circle" and says more unlock later', /Start or join a circle/.test(sheet) && /more unlock as your circle grows/.test(sheet));
  t.ok('+ menu never lists a locked row (no Midnight, Mole task, pot or drop for a solo day-1 user)', !/Write for Midnight|Start a pot|Host a drop|Make a trail/.test(sheet));

  // C17: the age gate. Month + year only, so it's conservative: you count as N from the first day of the
  // month after your Nth birthday month. Never allowed early, always allowed from that instant on.
  const dobG = G.record({ m: G.int(1, 12), y: G.int(1930, 2025) });
  report('age: boundary-exact (false 1 ms before, true at the first allowed instant)', prop('age boundary', G.tuple(dobG, G.pick(['IN', 'XX'])), ([d, cc]) => {
    const t0 = adultFrom(d.m, d.y, ageMin(cc)); return ageOK(d, cc, t0 - 1) === false && ageOK(d, cc, t0) === true;
  }, { runs: RUNS }));
  report('age: monotonic in time (once old enough, never not)', prop('age monotone', G.tuple(dobG, G.pick(['IN', 'XX']), G.int(0, 2e9), G.int(0, 2e9)), ([d, cc, a, b]) => {
    const t1 = Date.UTC(1990, 0, 1) + a * 1000, t2 = t1 + b * 1000; return !(ageOK(d, cc, t1) && !ageOK(d, cc, t2));
  }, { runs: RUNS }));
  report('age: India is 18+, elsewhere 16+, and a 17-year-old in India is always refused', prop('age rule', dobG, d => {
    const t17 = adultFrom(d.m, d.y, 17); return ageOK(d, 'IN', t17) === false && ageOK(d, 'XX', t17) === true;
  }, { runs: RUNS }));
  t.ok('age: missing or junk month/year is "not answered", not a yes', [null, {}, { m: 0, y: 2000 }, { m: 13, y: 2000 }, { m: 5, y: '' }, { m: 'x', y: 'y' }].every(d => ageOK(d, 'IN', Date.now()) == null));
  t.ok('age: born Oct 2008, India: refused all of Oct 2026, allowed from 1 Nov 2026', ageOK({ m: 10, y: 2008 }, 'IN', new Date(2026, 9, 31, 23, 59).getTime()) === false && ageOK({ m: 10, y: 2008 }, 'IN', new Date(2026, 10, 1).getTime()) === true);
};
