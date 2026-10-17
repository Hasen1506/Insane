// Runs every test/e2e/flows/*.flow.js and *.test.js, one at a time (or the ones named: node test/e2e/flows/run.js d-safety)
// and prints "N/M passed" for test/run.js. Each flow exports async ({ ok }) => … (WS-A/WS-B's *.test.js call it t.ok), where ok(name, cond, extra, ms) takes a
// value or a function; a function is polled until it holds (8 s, or ms), so checks wait on what they're about.
'use strict';
const fs = require('fs'), path = require('path'), E = require('../../lib/e2e');
const want = process.argv.slice(2);
const files = fs.readdirSync(__dirname).filter(f => (f.endsWith('.flow.js') || f.endsWith('.test.js')) && (!want.length || want.some(w => f.startsWith(w)))).sort();
(async () => {
  const results = [];
  for (const f of files) {
    const rec = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', `${f}: ${name}`, String(extra).slice(0, 400)]); if (!cond) console.log('FAIL', f + ':', name, String(extra).slice(0, 400)); return !!cond; };
    const ok = (name, cond, extra = '', ms = 8000) => {
      if (typeof cond !== 'function') return rec(name, cond, extra);
      return E.until(cond, { timeout: ms, what: name }).then(() => true, () => false).then(async v => rec(name, v, typeof extra === 'function' ? await extra().catch(e => 'extra threw: ' + e.message) : extra));
    };
    const t0 = Date.now();
    try { await require(path.join(__dirname, f))({ ok }); } catch (e) { rec('threw', false, e && e.stack || e); }
    console.log(`${f}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  for (const r of results) console.log(r.join('  '));
  const pass = results.filter(r => r[0] === 'PASS').length;
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(pass === results.length && results.length ? 0 : 1);
})();
