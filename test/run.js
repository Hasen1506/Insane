#!/usr/bin/env node
// One command for every suite:  node test/run.js [suite ...]   (npm test = all, in this order)
//   build       tools/build.js --check: the committed app/index.html is a fresh build of src/
//   unit        test/unit/*.test.js
//   pbt         test/pbt/*.test.js        (PBT_RUNS, PBT_SEED)
//   diff        test/diff/*.test.js       v0.8 (fac3720) vs v0.9 on seeded inputs (DIFF_RUNS)
//   e2e:local   test/e2e/legacy-local.js  v0.8's 83 local-mode checks against the built file
//   e2e:server  test/e2e/legacy-server.js v0.8's 92 server checks against the built file
//   golden      test/golden/*.test.js     DOM + pixel goldens (GOLDEN_UPDATE=1 rewrites)
// In-process suites export `async t => { t.ok(name, cond, extra) }`. Script suites are run as child
// processes and pass when they exit 0. Time budgets (PLAN-V09 §5.0) are reported per suite; set
// BUDGETS=strict to fail a suite that runs over 1.5x its budget. The two legacy e2e ports keep
// v0.8's fixed waits until WS-J's F01–F20 replace them, so their budgets are informational for now.
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const SUITES = {
  build: { budget: 2, files: () => ['tools/build.js'], script: ['tools/build.js', '--check'] },
  unit: { budget: 10, dir: 'test/unit' },
  pbt: { budget: 10, dir: 'test/pbt' },
  diff: { budget: 10, dir: 'test/diff' },
  'e2e:local': { budget: 60, script: ['test/e2e/legacy-local.js'], legacy: true },
  'e2e:server': { budget: 90, script: ['test/e2e/legacy-server.js'], legacy: true },
  golden: { budget: 30, dir: 'test/golden' },
};

function runScript(args) {
  return new Promise(res => {
    const p = spawn(process.execPath, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let out = '';
    p.stdout.on('data', d => { out += d; if (process.env.VERBOSE) process.stdout.write(d); });
    p.stderr.on('data', d => { out += d; if (process.env.VERBOSE) process.stderr.write(d); });
    p.on('exit', code => res({ code, out }));
  });
}

async function runDir(dir) {
  const abs = path.join(ROOT, dir);
  const files = fs.existsSync(abs) ? fs.readdirSync(abs).filter(f => f.endsWith('.test.js')).sort() : [];
  const results = [];
  for (const f of files) {
    const t = { ok: (name, cond = true, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', `${f}: ${name}`, extra]); if (!cond) console.log(`  FAIL ${f}: ${name} ${String(extra).slice(0, 400)}`); return !!cond; } };
    try { await require(path.join(abs, f))(t); } catch (e) { results.push(['FAIL', `${f}: threw`, e && e.stack || e]); console.log(`  FAIL ${f} threw: ${e && e.stack || e}`); }
  }
  return results;
}

(async () => {
  const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SUITES);
  for (const w of want) if (!SUITES[w]) { console.error('unknown suite ' + w + '; have ' + Object.keys(SUITES).join(', ')); process.exit(2); }
  const summary = []; let failed = false;
  for (const name of want) {
    const s = SUITES[name], t0 = Date.now();
    let pass = 0, total = 0, ok, detail = '';
    if (s.script) {
      const r = await runScript(s.script);
      const m = /(\d+)\/(\d+) passed/.exec(r.out); if (m) { pass = +m[1]; total = +m[2]; } else { total = 1; pass = r.code === 0 ? 1 : 0; }
      ok = r.code === 0;
      if (!ok) detail = r.out.split('\n').filter(l => /FAIL|Error|error|check:/.test(l)).slice(0, 15).join('\n');
    } else {
      const res = await runDir(s.dir); total = res.length; pass = res.filter(r => r[0] === 'PASS').length; ok = pass === total;
    }
    const secs = (Date.now() - t0) / 1000;
    const over = secs > s.budget * 1.5;
    const budgetFail = over && process.env.BUDGETS === 'strict';
    if (!ok || budgetFail) failed = true;
    summary.push(`${ok && !budgetFail ? 'ok  ' : 'FAIL'} ${name.padEnd(11)} ${String(pass).padStart(3)}/${String(total).padEnd(3)} ${secs.toFixed(1).padStart(6)} s  (budget ${s.budget} s${over ? ', OVER' + (s.legacy ? ': v0.8 fixed waits, see run.js' : '') : ''})`);
    console.log(summary.at(-1)); if (detail) console.log(detail.replace(/^/gm, '    '));
  }
  console.log('\n' + summary.join('\n'));
  process.exit(failed ? 1 : 0);
})();
