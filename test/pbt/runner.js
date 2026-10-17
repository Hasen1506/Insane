// A tiny seeded property-based test runner. No dependencies.
//
//   const { prop, G } = require('./runner');
//   prop('distKm is symmetric', G.tuple(G.latLon(), G.latLon()), ([a, b]) => Math.abs(distKm(a, b) - distKm(b, a)) < 1e-9);
//
// prop(name, gen, predicate, { runs, seed }) -> { ok, runs, seed, case?, shrunk?, error? }
//   predicate returns false or throws to fail. Async predicates are fine (prop then returns a Promise).
//   runs: opts.runs, else $PBT_RUNS, else 1000.   seed: opts.seed, else $PBT_SEED, else derived from the name.
//   A failure is shrunk (ints halve toward 0, arrays drop items, strings shorten) and reported as
//   SEED=… CASE=…; replay with PBT_SEED=<seed>.
// A generator is { gen(rng, size) -> value, shrink(value) -> iterable of smaller values }.
'use strict';

// mulberry32: small, fast, good enough for test inputs, and identical everywhere.
function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), pick: xs => xs[Math.floor(next() * xs.length)], bool: (p = .5) => next() < p };
}
const hash = s => { let h = 0x811c9dc5; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };

const none = function* () { };
const G = {
  int: (lo = -1000, hi = 1000) => ({
    gen: r => r.int(lo, hi),
    shrink: function* (v) { const t = lo > 0 ? lo : hi < 0 ? hi : 0; if (v === t) return; yield t; let d = Math.trunc((v - t) / 2); while (d !== 0) { yield v - d; d = Math.trunc(d / 2); } },
  }),
  float: (lo = -1, hi = 1) => ({ gen: r => lo + r.next() * (hi - lo), shrink: function* (v) { const t = lo > 0 ? lo : hi < 0 ? hi : 0; if (v !== t) { yield t; yield t + (v - t) / 2; } if (v !== Math.round(v) && Math.round(v) >= lo && Math.round(v) <= hi) yield Math.round(v); } }),
  bool: () => ({ gen: r => r.bool(), shrink: function* (v) { if (v) yield false; } }),
  pick: xs => ({ gen: r => r.pick(xs), shrink: function* (v) { const i = xs.indexOf(v); for (let j = 0; j < i; j++) yield xs[j]; } }),
  constant: v => ({ gen: () => v, shrink: none }),
  // strings: ASCII, Latin accents, emoji (surrogate pairs, ZWJ), RTL Arabic/Hebrew, combining marks, zero-width, Tamil/Devanagari
  str: ({ min = 0, max = 24, alphabet } = {}) => {
    const POOLS = alphabet ? [alphabet] : [
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      ' .,;:!?-_\'"()/&@#%*+=<>',
      'àáâãäåçèéêëìíîïñòóôõöùúûüýÿß',
      ['😀', '👍🏽', '👨‍👩‍👧', '🇮🇳', '❤️', '🏃‍♀️'],
      'كافياأحمدمرحبا', 'שלוםעולם', ['\u0301', '\u0308', '\u0327'], ['\u200b', '\u200c', '\u200d', '\u2060', '\ufeff'],
      'தமிழ்சென்னை', 'हिन्दीमुंबई', '\n\t',
    ];
    const pools = POOLS.map(p => Array.isArray(p) ? p : [...p]);
    return {
      gen: (r, size = max) => { const n = r.int(min, Math.max(min, Math.min(max, size))); let s = ''; for (let i = 0; i < n; i++) s += r.pick(r.pick(pools)); return s; },
      shrink: function* (v) { const cs = [...v]; if (cs.length <= min) return; if (min === 0) yield ''; yield cs.slice(0, Math.max(min, cs.length >> 1)).join(''); for (let i = 0; i < cs.length && i < 32; i++) yield [...cs.slice(0, i), ...cs.slice(i + 1)].join(''); },
    };
  },
  array: (g, { min = 0, max = 12 } = {}) => ({
    gen: (r, size = max) => { const n = r.int(min, Math.max(min, Math.min(max, size))); return Array.from({ length: n }, () => g.gen(r, size)); },
    shrink: function* (v) {
      if (v.length > min) { if (min === 0) yield []; yield v.slice(0, Math.max(min, v.length >> 1)); for (let i = 0; i < v.length; i++) yield [...v.slice(0, i), ...v.slice(i + 1)]; }
      for (let i = 0; i < v.length; i++) for (const s of g.shrink(v[i])) yield [...v.slice(0, i), s, ...v.slice(i + 1)];
    },
  }),
  tuple: (...gs) => ({
    gen: (r, size) => gs.map(g => g.gen(r, size)),
    shrink: function* (v) { for (let i = 0; i < gs.length; i++) for (const s of gs[i].shrink(v[i])) yield [...v.slice(0, i), s, ...v.slice(i + 1)]; },
  }),
  record: shape => {
    const ks = Object.keys(shape);
    return {
      gen: (r, size) => Object.fromEntries(ks.map(k => [k, shape[k].gen(r, size)])),
      shrink: function* (v) { for (const k of ks) for (const s of shape[k].shrink(v[k])) yield { ...v, [k]: s }; },
    };
  },
  oneOf: (...gs) => ({ gen: (r, size) => r.pick(gs).gen(r, size), shrink: function* (v) { for (const g of gs) { try { yield* g.shrink(v); } catch (e) { } } } }),
  map: (g, f) => ({ gen: (r, size) => f(g.gen(r, size)), shrink: none }), // mapped values don't shrink (keep it simple)
  latLon: ({ lat = [-85, 85], lon = [-180, 180] } = {}) => G.tuple(G.float(lat[0], lat[1]), G.float(lon[0], lon[1])),
  email: () => G.map(G.tuple(G.str({ min: 1, max: 10, alphabet: 'abcdefghijklmnopqrstuvwxyz0123456789._+-' }), G.pick(['example.com', 'x.in', 'gmail.com', 'mail.co.uk'])), ([u, d]) => u + '@' + d),
};
G.uid = () => G.pick(['u_alice', 'u_bob', 'u_carol', 'u_dave', 'u_erin', 'u_meera', 'u_arjun', 'u_kavya']);

const show = v => { try { return JSON.stringify(v, (k, x) => typeof x === 'number' && !isFinite(x) ? String(x) : x); } catch (e) { return String(v); } };

function prop(name, gen, pred, opts = {}) {
  const runs = opts.runs ?? (+process.env.PBT_RUNS || 1000);
  const seed = (opts.seed ?? (process.env.PBT_SEED ? +process.env.PBT_SEED : hash(name))) >>> 0;
  const r = rng(seed);
  const check = v => { try { const out = pred(v); if (out && typeof out.then === 'function') return out.then(x => x !== false ? null : { error: 'returned false' }, e => ({ error: e && e.message || String(e) })); return out !== false ? null : { error: 'returned false' }; } catch (e) { return { error: e && e.message || String(e) }; } };
  const done = (v, best, err, i) => ({ ok: false, name, runs: i + 1, seed, case: v, shrunk: best, error: err, message: `${name}: failed after ${i + 1} runs. SEED=${seed} CASE=${show(best)} (${err}). Replay: PBT_SEED=${seed}` });
  const MAX_SHRINK = 500;
  const failSync = (v, f, i) => { // shrink greedily: take the first smaller value that still fails, repeat
    let best = v, err = f.error, steps = 0, moved = true;
    while (moved && steps < MAX_SHRINK) { moved = false; for (const s of gen.shrink(best)) { if (++steps > MAX_SHRINK) break; const g = check(s); if (g && typeof g.then === 'function') return failAsync(v, f, i); if (g) { best = s; err = g.error; moved = true; break; } } }
    return done(v, best, err, i);
  };
  const failAsync = async (v, f, i) => {
    let best = v, err = f.error, steps = 0, moved = true;
    while (moved && steps < MAX_SHRINK) { moved = false; for (const s of gen.shrink(best)) { if (++steps > MAX_SHRINK) break; const g = await check(s); if (g) { best = s; err = g.error; moved = true; break; } } }
    return done(v, best, err, i);
  };
  // sync fast path; switches to async on the first promise
  for (let i = 0; i < runs; i++) {
    const v = gen.gen(r, Math.min(100, 2 + Math.floor(i / 10)));
    const f = check(v);
    if (f && typeof f.then === 'function') return (async () => { let ff = await f; if (ff) return failAsync(v, ff, i); for (i++; i < runs; i++) { const v2 = gen.gen(r, Math.min(100, 2 + Math.floor(i / 10))); ff = await check(v2); if (ff) return failAsync(v2, ff, i); } return { ok: true, name, runs, seed }; })();
    if (f) return failSync(v, f, i);
  }
  return { ok: true, name, runs, seed };
}

module.exports = { prop, G, rng, hash, show };
