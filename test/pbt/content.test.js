// WS-E properties (PLAN-V09 §5.b P10, C50, C91, C92): the drop draw and the content schedule.
//   the draw: reproducible from its seed in any order; uniform within tolerance; nobody drawn twice;
//             never outside the circles that checked in during the window; sealed until the seed is out
//   content:  nothing repeats before its pool is used up (puzzles, daily dares, Mole tasks), on the page
//             and on the server, including after the owner adds or pins a puzzle
'use strict';
const { DatabaseSync } = require('node:sqlite');
const { prop, G } = require('./runner');
const { loadV09 } = require('../lib/load');
const K = require('../lib/content'), C = K.C;
const makeContent = require('../../server/content');
const DAY = 864e5;

module.exports = async function (t) {
  const app = loadV09();
  const drawWinner = app.get('drawWinner'), drawOrder = app.get('drawOrder'), drawEligible = app.get('drawEligible');
  const check = r => t.ok(r.name + (r.ok ? ` (${r.runs} cases)` : ''), r.ok, r.message);
  const SEEDS = G.str({ min: 8, max: 32, alphabet: '0123456789abcdef' });
  const CIRCLE = G.pick(['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', '', null]);
  const T0 = Date.UTC(2026, 9, 12, 12);
  const DROP = G.map(G.tuple(SEEDS, G.pick([null, 'c1', 'c2'])), ([seed, hc]) => ({ id: 'd1', start: T0, end: T0 + 3600e3, seedHash: 'h', seed, hostCircle: hc }));
  const INS = G.array(G.record({ circle: CIRCLE, uid: G.uid(), at: G.oneOf(G.int(T0 - 3600e3, T0 + 7200e3), G.constant(undefined)) }), { max: 25 });

  /* ---------- the draw ---------- */
  check(prop('P10 draw: same seed and check-ins give the same winner, in any order and with duplicates', G.tuple(DROP, INS, G.int(0, 1e6)), ([d, ins, k]) => {
    const w = drawWinner(d, ins), sh = ins.map((x, i) => [((i + 1) * 2654435761 + k) % 4294967296, x]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    return w === drawWinner(d, sh) && w === drawWinner(d, [...ins, ...ins]) && w === drawWinner({ ...d }, ins.slice());
  }));
  check(prop('P10 draw: the winner is a circle that checked in during the window, never the host’s; none only when nobody eligible came', G.tuple(DROP, INS), ([d, ins]) => {
    const w = drawWinner(d, ins), el = ins.filter(i => i.circle && (i.at == null || (i.at >= d.start && i.at <= d.end)) && i.circle !== d.hostCircle).map(i => i.circle);
    return w === null ? el.length === 0 : el.includes(w);
  }));
  check(prop('draw: nobody is drawn twice (the full draw order is a permutation of the eligible circles)', G.tuple(SEEDS, G.array(G.pick(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), { max: 20 })), ([seed, xs]) => {
    const cs = [...new Set(xs)].sort(), o = drawOrder(seed, cs);
    return o.length === cs.length && new Set(o).size === o.length && o.every(x => cs.includes(x));
  }));
  check(prop('draw: sealed (seedHash, no seed yet) means no winner anyone can compute', G.tuple(DROP, INS), ([d, ins]) => drawWinner({ ...d, seed: undefined }, ins) === null));
  // uniform within tolerance: chi-square over 6,000 seeds for 2, 3, 5 and 8 circles (critical value at p = 0.001)
  const CRIT = { 1: 10.83, 2: 13.82, 4: 18.47, 7: 24.32 };
  for (const k of [2, 3, 5, 8]) {
    const cs = Array.from({ length: k }, (_, i) => 'circle_' + i), N = 6000, cnt = new Map(cs.map(c => [c, 0]));
    for (let i = 0; i < N; i++) { const w = drawWinner({ id: 'x', start: 0, end: 1, seedHash: 'h', seed: 'seed-' + i.toString(16) }, cs.map(c => ({ circle: c }))); cnt.set(w, cnt.get(w) + 1); }
    const e = N / k, chi = [...cnt.values()].reduce((s, o) => s + (o - e) ** 2 / e, 0);
    t.ok(`draw: uniform over ${k} circles (χ² = ${chi.toFixed(2)} < ${CRIT[k - 1]}, 6,000 seeds)`, chi < CRIT[k - 1], JSON.stringify([...cnt]));
  }
  // and each position of the order, not just first place (so a second prize is fair too)
  { const cs = ['a', 'b', 'c', 'd'], N = 4000, pos = cs.map(() => new Map(cs.map(c => [c, 0])));
    for (let i = 0; i < N; i++) drawOrder('s' + i, cs).forEach((c, j) => pos[j].set(c, pos[j].get(c) + 1));
    const chis = pos.map(m => [...m.values()].reduce((s, o) => s + (o - N / 4) ** 2 / (N / 4), 0));
    t.ok(`draw: every place in the order is uniform (χ² ${chis.map(x => x.toFixed(1)).join(', ')} < 16.27)`, chis.every(x => x < 16.27)); }
  check(prop('draw: a v0.8 drop (no seedHash) keeps v0.8’s formula exactly', G.tuple(G.str({ min: 1, max: 12, alphabet: 'abcdefghjkmnpqrstuvwxyz23456789' }), INS), ([id, ins]) => {
    const cs = [...new Set(ins.map(i => i.circle).filter(Boolean))].sort();
    return drawWinner({ id }, ins) === (cs.length ? cs[app.get('fnvN')(id + '|' + cs.join(',')) % cs.length] : null);
  }));

  /* ---------- no repeats until exhausted ---------- */
  check(prop('permAt: any n consecutive steps cover all n items once, and step k+n repeats step k', G.tuple(G.int(1, 80), G.str({ max: 16 }), G.int(-5000, 5000)), ([n, scope, k0]) => {
    const w = Array.from({ length: n }, (_, i) => C.permAt(n, scope, k0 + i));
    return new Set(w).size === n && w.every(x => x >= 0 && x < n) && C.permAt(n, scope, k0) === C.permAt(n, scope, k0 + n);
  }));
  check(prop('pickFresh: a run of picks with the kept history never repeats an item until every item has come up', G.tuple(G.int(1, 40), G.int(1, 4), G.int(1, 30), G.int(0, 1e9)), ([n, k, rounds, seed]) => {
    const pool = Array.from({ length: n }, (_, i) => i), r = C.mulberry(seed); let used = [], cycle = new Set();
    for (let i = 0; i < rounds; i++) {
      const res = C.pickFresh(pool, used, k, r); used = res.used;
      if (new Set(res.pick).size !== res.pick.length || res.pick.length !== Math.min(k, n)) return false;
      for (const x of res.pick) { if (cycle.has(x)) return false; cycle.add(x); if (cycle.size === n) cycle = new Set(); }
    }
    return true;
  }));
  // the daily dare (client): with the starters, no dare comes back within the list's length (60 days > 30)
  check(prop('C92 daily dare: no repeat for as many days as there are dares (≥ 30), per circle', G.tuple(G.pick(['c1', 'cA', 'x_9', 'Night Shift']), G.int(0, 2000)), ([circle, d0]) => {
    app.setState({ me: { circle }, dares: [] }); const seen = [];
    const n = app.get('STARTER_DARES').length;
    for (let i = 0; i < n; i++) { app.setNow(Date.UTC(2026, 0, 1, 12) + (d0 + i) * DAY); seen.push(app.run('dailyDare()').text); }
    return new Set(seen).size === n && n >= 30;
  }, { runs: 40 }));
  // the Decode, local mode: a city's weeks run through its whole pack before any puzzle comes back
  check(prop('C91 local Decode: a city gets no repeat until its pack is used up, and gets its own pack', G.tuple(G.pick(['IN-tamil_nadu-chennai', 'IN-karnataka-bengaluru', 'IN-maharashtra-mumbai', 'IN-delhi-delhi', 'IN-telangana-hyderabad', 'IN-west_bengal-kolkata', 'PT-lisbon-lisbon', 'JP-tokyo-tokyo']), G.int(0, 400)), ([city, w0]) => {
    const pack = C.packFor(K.P.packs, city), n = pack.puzzles.length, ids = [];
    for (let i = 0; i < n; i++) { const wk = C.isoWeekKeyUTC(Date.UTC(2024, 0, 3) + (w0 + i) * 7 * DAY); const p = app.run(`decodeLocal(${JSON.stringify(city)},${JSON.stringify(wk)})`); ids.push(p.id); }
    return new Set(ids).size === n && ids.every(id => pack.puzzles.some(z => z.id === id));
  }, { runs: 60 }));
  // the Mole: three tasks you haven't had, until you've had all 30
  check(prop('C92 Mole: your tasks never repeat until you have had every one', G.int(1, 25), weeks => {
    let used = []; const all = [];
    for (let w = 0; w < weeks; w++) { app.setState({ priv: { molehist: { used } } }); const r = app.run('moleDraw()'); used = r.used; all.push(...r.pick); }
    const n = app.get('MOLE_POOL').length;
    for (let i = 0; i + n <= all.length || i < all.length; i += n) { const chunk = all.slice(i, i + n); if (new Set(chunk).size !== chunk.length) return false; }
    return true;
  }, { runs: 60 }));

  /* ---------- the server's schedule ---------- */
  const fresh = (nowT) => { const db = new DatabaseSync(':memory:'); const clock = { t: nowT }; return { db, clock, c: makeContent({ db, now: () => clock.t, secret: 's' }) }; };
  check(prop('server Decode: consecutive weeks in a city never repeat until the pack is used up, then never back to back', G.tuple(G.pick(['IN-tamil_nadu-chennai', 'IN-delhi-delhi', 'PT-lisbon-lisbon']), G.int(0, 300)), ([city, w0]) => {
    const { c } = fresh(Date.UTC(2026, 9, 1)); const n = c.packFor(city).puzzles.length, ids = [];
    for (let i = 0; i < 2 * n + 3; i++) ids.push(c.puzzleFor(city, C.isoWeekKeyUTC(Date.UTC(2024, 0, 3) + (w0 + i) * 7 * DAY)).id);
    for (let i = 0; i + n <= ids.length; i += n) if (new Set(ids.slice(i, i + n)).size !== n) return false;
    return ids.every((x, i) => i === 0 || x !== ids[i - 1]);
  }, { runs: 30 }));
  check(prop('server Decode: the same week asked twice is the same puzzle, and a dry-run preview matches what then happens', G.tuple(G.pick(['IN-maharashtra-mumbai', 'JP-tokyo-tokyo']), G.int(0, 100)), ([city, w0]) => {
    const { c } = fresh(Date.UTC(2025, 0, 6) + w0 * 7 * DAY); const pv = c.preview(city, 5);
    return pv.every(({ week, puzzle }) => c.puzzleFor(city, week).id === puzzle.id && c.puzzleFor(city, week).id === puzzle.id);
  }, { runs: 30 }));
  { // C93: an owner-added puzzle pinned to next week is next week's; an unpinned one comes before any repeat
    const { c } = fresh(Date.UTC(2026, 9, 14)); const city = 'IN-tamil_nadu-chennai';
    const wk = d => C.isoWeekKeyUTC(Date.UTC(2026, 9, 14) + d * 7 * DAY);
    c.puzzleFor(city, wk(0));
    const pin = { id: 'chennai-owner-1', pack: 'chennai', kind: 'reverse', data: { text: 'RAMAGHCTAR' }, a: 'RATCHGAMAR'.split('').reverse().join('') === 'RAMAGHCTAR' ? 'RATCHGAMAR' : 'X', h: ['Read it the other way.', 'Ten letters.', 'A made-up word for the test.'], week: wk(1) };
    const sv = c.admin.save('puzzle', pin);
    t.ok('owner tool: a valid puzzle saves (clue written from its data)', sv.ok && /Read it backwards/.test(sv.item.q), JSON.stringify(sv.problems));
    t.ok('owner tool: the pinned puzzle is next week’s, and the preview says so', c.preview(city, 2)[1].puzzle.id === 'chennai-owner-1' && c.puzzleFor(city, wk(1)).id === 'chennai-owner-1');
    const bad = c.admin.save('puzzle', { ...pin, id: 'chennai-owner-2', h: ['It is RATCHGAMAR', 'x hint', 'y hint'] });
    t.ok('owner tool: a hint with the answer is refused', !bad.ok && bad.problems.some(x => /hint 1/.test(x)));
    const dup = c.admin.save('puzzle', { ...pin, id: 'chennai-owner-3', a: 'MARINA', kind: 'caesar', data: { shift: 3, text: 'PDULQD' }, q: '' });
    t.ok('owner tool: a second puzzle with an answer the pack already has is refused', !dup.ok && dup.problems.some(x => /already has/.test(x)), JSON.stringify(dup.problems));
    t.ok('owner tool: an unsafe dare is refused, a safe one saves', !c.admin.save('dare', { text: 'Climb the water tank at night', level: 3 }).ok && c.admin.save('dare', { text: 'Share your favourite street snack with the circle', level: 2 }).ok);
    t.ok('owner tool: a new Mole task gets the next free number', c.admin.save('mole', { text: 'Get someone to tell you their favourite tiffin', n: 1 }).item.i === 30);
    const { c: c2 } = fresh(Date.UTC(2026, 9, 14)); const ids = [];
    for (let i = 0; i < 6; i++) ids.push(c2.puzzleFor(city, wk(i)).id);
    c2.admin.save('puzzle', { ...pin, id: 'chennai-owner-9', week: undefined });
    for (let i = 6; i < 13; i++) ids.push(c2.puzzleFor(city, wk(i)).id);
    t.ok('owner tool: an unpinned new puzzle comes up before anything repeats', ids.indexOf('chennai-owner-9') > 5 && new Set(ids).size === ids.length, ids.join(' '));
    c2.admin.remove('puzzle', 'chennai-01'); t.ok('owner tool: a removed seed puzzle leaves the pack, restore brings it back', !c2.packFor(city).puzzles.some(z => z.id === 'chennai-01') && c2.admin.restore('puzzle', 'chennai-01').ok && c2.packFor(city).puzzles.some(z => z.id === 'chennai-01'));
  }
};
