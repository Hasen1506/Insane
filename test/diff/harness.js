// Differential harness: v0.8 (fac3720, via the .v08 git worktree) against v0.9 (src/ and the built
// app/index.html), fed the same seeded inputs. PLAN-V09 §5.c.
//
//   const H = require('./harness'); const h = await H.open();
//   h.same('distKm', G.tuple(G.latLon(), G.latLon()), ([a, b]) => app => app.get('distKm')(a, b));
//
// same(name, gen, call, {runs, seed, allow}) runs call(input)(app) on every side and compares a
// canonical form of the results (cross-realm safe: Sets, Maps, NaN, -0, undefined all kept).
// allow(v08Result, v09Result, input) may accept a documented difference; it must say why in its name.
'use strict';
const { loadV08, loadV09, loadBuilt } = require('../lib/load');
const { prop, show } = require('../pbt/runner');

function canon(v, seen = new Set()) {
  if (v === undefined) return { u: 1 };
  if (typeof v === 'number') return Number.isNaN(v) ? { nan: 1 } : Object.is(v, -0) ? { negz: 1 } : !isFinite(v) ? { inf: v > 0 ? 1 : -1 } : v;
  if (typeof v === 'bigint') return { big: String(v) };
  if (typeof v === 'function') return { fn: v.name || 'anon' };
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return { cycle: 1 }; seen.add(v);
  const tag = Object.prototype.toString.call(v);
  let out;
  if (tag === '[object Set]') out = { set: [...v].map(x => canon(x, seen)) };
  else if (tag === '[object Map]') out = { map: [...v].map(([k, x]) => [canon(k, seen), canon(x, seen)]) };
  else if (tag === '[object Date]') out = { date: v.getTime() };
  else if (Array.isArray(v)) out = v.map(x => canon(x, seen));
  else if (ArrayBuffer.isView(v)) out = { view: tag, data: Array.from(v) };
  else out = Object.fromEntries(Object.keys(v).map(k => [k, canon(v[k], seen)]));
  seen.delete(v); return out;
}
const key = v => JSON.stringify(canon(v));
const attempt = f => { try { return { ok: key(f()) }; } catch (e) { return { threw: e && e.constructor && e.constructor.name, msg: String(e && e.message) }; } };

async function open({ built = true } = {}) {
  const sides = { 'v0.8': loadV08(), 'v0.9 src': loadV09() };
  if (built) sides['v0.9 built'] = loadBuilt();
  const all = Object.values(sides);
  const report = [];
  const h = {
    sides, all,
    each: f => all.forEach(f),
    setNow: t => all.forEach(a => a.setNow(t)),
    setState: o => all.forEach(a => a.setState(o)),
    async loadPlaces() { await Promise.all(all.map(a => a.loadPlaces())); },
    // compare one call on every side
    compare(input, call) {
      const [base, ...rest] = Object.entries(sides).map(([n, a]) => [n, attempt(() => call(input)(a))]);
      // the built side drops the indentation after a newline inside template literals (tools/build.js, int-2):
      // HTML between tags renders the same, so that one difference is compared away for it, and nothing else
      const k = (n, v) => n === 'v0.9 built' ? key(v).replace(/\\n[ \t]+/g, '\\n') : key(v);
      for (const [n, r] of rest) if (k(n, r) !== k(n, base[1])) return { diff: true, a: base, b: [n, r] };
      return { diff: false };
    },
    same(name, gen, call, opts = {}) {
      const { allow, prepare } = opts;
      const res = prop('diff ' + name, gen, input => {
        if (prepare) prepare(input, h);
        const c = h.compare(input, call);
        if (!c.diff) return true;
        if (allow && allow(c.a[1], c.b[1], input)) return true;
        throw new Error(`${c.a[0]} → ${show(c.a[1]).slice(0, 200)} but ${c.b[0]} → ${show(c.b[1]).slice(0, 200)}`);
      }, { runs: opts.runs ?? (+process.env.DIFF_RUNS || 5000), seed: opts.seed });
      report.push(res);
      return res;
    },
    report,
  };
  return h;
}

module.exports = { open, canon, key };
