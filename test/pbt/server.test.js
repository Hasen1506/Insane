// WS-I properties (PLAN-V09 §5.b): P19 rate limits, P20 unlocks never go backwards, P23 Midnight lands on
// 00:00 in the circle's zone across DST, P24 the v0.8 → v0.9 store migration is idempotent and loses nothing.
'use strict';
const { prop, G, rng } = require('./runner');
const { Limiter, writeClasses } = require('../../server/ratelimit');
const { unlocks, FEATURES } = require('../../server/unlocks');
const TZ = require('../../server/tz');
const { migrateStore, memoryStore } = require('../../server/migrate');

const report = (t, name, r) => t.ok(name, r.ok, r.message || '');

module.exports = async function (t) {
  /* ---------- P19: no bucket lets more than cap + rate·d through in any stretch of d ms ---------- */
  report(t, 'P19 token bucket: accepted in any window ≤ cap + rate·window, and a burst of cap+1 refuses the last', prop('P19',
    G.tuple(G.int(1, 40), G.int(1000, 120000), G.array(G.int(0, 3000), { min: 1, max: 120 })),
    ([cap, per, gaps]) => {
      let t0 = 1e12; const clock = () => t0, L = new Limiter({ clock, limits: { x: { cap, per } } }), ok = [];
      for (const g of gaps) { t0 += g; if (L.take('x', 'u').ok) ok.push(t0); }
      for (let i = 0; i < ok.length; i++) for (let j = i; j < ok.length; j++) if (j - i + 1 > cap + (ok[j] - ok[i]) * cap / per + 1e-9) return false;
      const B = new Limiter({ clock, limits: { x: { cap, per } } }); for (let i = 0; i < cap; i++) if (!B.take('x', 'v').ok) return false;
      const last = B.take('x', 'v'); return !last.ok && last.retryMs > 0 && last.retryMs <= Math.ceil(per / cap) + 1;
    }, { runs: 400 }));
  report(t, 'P19 buckets are per key: one user flooding never spends another’s tokens', prop('P19 keys',
    G.tuple(G.int(1, 20), G.int(1, 200)),
    ([cap, flood]) => { const L = new Limiter({ clock: () => 0, limits: { x: { cap, per: 6e4 } } }); for (let i = 0; i < flood; i++) L.take('x', 'a'); return L.take('x', 'b').ok; }, { runs: 300 }));
  { const L = new Limiter({ clock: () => 0, limits: { x: { cap: 3, per: 1000 } } }); for (let i = 0; i < 3; i++) L.take('x', String(i)); let t1 = 5000; L.clock = () => t1; L.prune(); t.ok('prune drops refilled buckets only', L.b.size === 0); }
  t.ok('content caps apply to new docs only: a msg, a post, a call, a dare with a target, Midnight, a clip',
    JSON.stringify(['circles/c/threads/t/msgs/m', 'posts/p', 'calls/x', 'circles/c/dares/d', 'circles/c/midnight/m', 'circles/c/clips/k'].map(p => writeClasses('set', p, { to: 'u' }, false))) === JSON.stringify([['msg'], ['post'], ['call'], ['dare'], ['midnight'], ['clip']])
    && writeClasses('set', 'posts/p', {}, true).length === 0 && writeClasses('update', 'posts/p', {}, false).length === 0 && writeClasses('set', 'circles/c/dares/d', {}, false).length === 0);

  /* ---------- P20: unlocks are monotonic in (members, days, met, plans) ---------- */
  const st = G.record({ members: G.int(0, 9), days: G.int(0, 30), met: G.bool(), plans: G.int(0, 4) });
  report(t, 'P20 unlocks never go backwards as members/days/met/plans grow', prop('P20', G.tuple(st, G.int(0, 3), G.int(0, 5), G.bool(), G.int(0, 2)), ([a, dm, dd, dmet, dp]) => {
    const b = { members: a.members + dm, days: a.days + dd, met: a.met || dmet, plans: a.plans + dp };
    const A = new Set(unlocks(a).on), Bs = new Set(unlocks(b).on);
    return [...A].every(f => Bs.has(f));
  }));
  report(t, 'P20 a feature unlocked by size stays unlocked when someone leaves (peak members)', prop('P20 peak', G.tuple(st, G.int(0, 9)), ([a, leave]) => {
    const now = unlocks({ ...a, maxMembers: a.members }), later = unlocks({ ...a, members: Math.max(0, a.members - leave), maxMembers: a.members });
    return now.on.every(f => later.on.includes(f));
  }));
  { const d0 = unlocks({ members: 1, days: 0 }); t.ok('day 0 solo: plans, chat, pacts, daily dare, Decode only; locked rows say why', JSON.stringify(d0.on) === '["plans","chat","pacts","daily","decode"]' && Object.keys(d0.locked).length === FEATURES.length - 5 && Object.values(d0.locked).every(Boolean)); }
  t.ok('Midnight at 3, Mole at 4', unlocks({ members: 3 }).on.includes('midnight') && !unlocks({ members: 3 }).on.includes('mole') && unlocks({ members: 4 }).on.includes('mole'));

  /* ---------- P23: Midnight release == next 00:00 in the circle zone, across DST ---------- */
  const ZONES = ['Asia/Kolkata', 'Europe/Lisbon', 'America/Sao_Paulo', 'America/New_York', 'Australia/Lord_Howe', 'America/Santiago', 'Asia/Tehran', 'Pacific/Chatham', 'Africa/Lagos', 'Asia/Tokyo', 'America/Havana', 'Europe/London'];
  const sameDay = (a, b) => a.y === b.y && a.mo === b.mo && a.d === b.d;
  report(t, 'P23 nextMidnight(t, tz) is the first instant of the next local day (DST gaps and overlaps included)', prop('P23', G.tuple(G.int(0, 3 * 365 * 24 * 60), G.pick(ZONES)), ([m, tz]) => {
    const t0 = Date.UTC(2026, 0, 1) + m * 6e4 + 17e3, r = TZ.nextMidnight(t0, tz), pt = TZ.parts(t0, tz), pr = TZ.parts(r, tz), pb = TZ.parts(r - 6e4, tz);
    return r > t0 && r - t0 <= 25 * 36e5 && !sameDay(pr, pt) && sameDay(pb, pt) && (pr.h === 0 && pr.mi === 0 || pr.h <= 1) && r % 6e4 === 0;
  }, { runs: 1500 }));
  report(t, 'P23 a release the client asked for at its own 00:00 is snapped to the circle’s nearest 00:00', prop('P23 snap', G.tuple(G.int(0, 365 * 24), G.pick(ZONES)), ([hr, tz]) => {
    const t0 = Date.UTC(2026, 0, 1) + hr * 36e5, mid = TZ.nextMidnight(t0, tz), near = TZ.nearestMidnight(mid + 37 * 6e4, tz);
    return near === mid && TZ.nearestMidnight(mid, tz) === mid;
  }));
  t.ok('Asia/Kolkata 00:00 is 18:30 UTC the day before', TZ.nextMidnight(Date.UTC(2026, 9, 17, 10), 'Asia/Kolkata') === Date.UTC(2026, 9, 17, 18, 30));
  t.ok('Lisbon on the spring-forward day: 00:00 WET', TZ.nextMidnight(Date.UTC(2026, 2, 28, 10), 'Europe/Lisbon') === Date.UTC(2026, 2, 29, 0) && TZ.nextMidnight(Date.UTC(2026, 2, 29, 10), 'Europe/Lisbon') === Date.UTC(2026, 2, 29, 23));
  t.ok('Santiago skips 00:00 on 6 Sep 2026: release at the first real minute, 01:00 -03', TZ.nextMidnight(Date.UTC(2026, 8, 5, 12), 'America/Santiago') === Date.UTC(2026, 8, 6, 4));
  t.ok('quiet hours read the zone, never the server clock; an unknown zone falls back to DEFAULT_TZ', TZ.localHour(Date.UTC(2026, 9, 17, 18, 0), 'Asia/Kolkata') === 23 && TZ.localHour(Date.UTC(2026, 9, 17, 18, 0), 'Not/AZone') === TZ.localHour(Date.UTC(2026, 9, 17, 18, 0), TZ.DEFAULT_TZ));

  /* ---------- P24: the store migration is idempotent and loses no doc ---------- */
  const v08 = seed => {
    const r = rng(seed), docs = {}, uids = Array.from({ length: r.int(0, 8) }, (_, i) => 'u_' + i + seed), cids = Array.from({ length: r.int(0, 3) }, (_, i) => 'c' + i);
    for (const u of uids) docs['people/' + u] = { name: 'N' + u, circle: r.bool(.7) && cids.length ? r.pick(cids) : null, ...(r.bool() ? { tz: r.pick(['Asia/Kolkata', 'Europe/Lisbon', 'Bad/Zone', '']) } : {}), seen: r.int(0, 1e6) };
    for (const c of cids) {
      const mem = uids.filter(u => docs['people/' + u].circle === c);
      docs['circles/' + c] = { name: c, code: 'C' + c, members: mem, ...(r.bool(.8) && mem.length ? { by: mem[0] } : {}) };
      for (let i = r.int(0, 3); i-- > 0;) docs[`circles/${c}/threads/t${i}`] = { kind: r.pick(['plan', 'pot', 'chat']), title: 't' };
      for (let i = r.int(0, 2); i-- > 0;) docs[`circles/${c}/decode/w${i}`] = { clue: 'x', ...(r.bool() ? { answer: 'TOWER' } : {}) };
    }
    for (let i = r.int(0, 3); i-- > 0;) docs['drops/d' + i] = { venue: 'v', ...(r.bool(.2) ? { drawVersion: 2 } : {}) };
    for (let i = r.int(0, 2); i-- > 0;) docs['solves/w' + i] = { week: 'w', ...(r.bool() ? { answer: 'CARD' } : {}) };
    if (r.bool(.2) && uids.length) docs['people/' + uids[0]].circles = [cids[0] || 'cx'];
    return { docs, uids };
  };
  const cols = d => { const m = {}; for (const p of Object.keys(d)) { const c = p.split('/').slice(0, -1).join('/'); m[c] = (m[c] || 0) + 1; } return m; };
  report(t, 'P24 migrating a v0.8 store twice equals migrating once, and every doc and collection survives', prop('P24', G.int(1, 1e9), seed => {
    const { docs, uids } = v08(seed), orig = JSON.parse(JSON.stringify(docs)), before = cols(docs);
    const st = memoryStore(docs, uids), r1 = migrateStore(st, { at: 1 });
    const once = JSON.stringify(docs), r2 = migrateStore(st, { at: 2 });
    if (JSON.stringify(docs) !== once || r2.from !== 9 || Object.keys(r2.changed).length) return false;
    if (Object.keys(orig).some(p => !(p in docs))) return false;
    const after = cols(docs);
    for (const c in before) if (!/^data\/users/.test(c) && after[c] !== before[c]) return false;
    // answers moved out of client-visible docs, into server content, value intact
    for (const p in orig) if ('answer' in orig[p]) { if ('answer' in docs[p] || st.contentMap['answer:' + p] !== orig[p].answer) return false; }
    // every v0.8 member is still in the circle they were in, and admin is the creator
    for (const u of uids) { const d = docs['people/' + u]; if (orig['people/' + u].circle && !d.circles.includes(orig['people/' + u].circle)) return false; }
    for (const p in docs) if (/^circles\/[^/]+$/.test(p)) { const c = docs[p]; if (!c.roles || (orig[p].by && c.roles[orig[p].by] !== 'admin') || !TZ.validTz(c.tz)) return false; }
    return r1.to === 9 && uids.every(u => docs[`data/users/${u}/consent`].version === 0);
  }, { runs: 500 }));
};
