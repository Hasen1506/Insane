// Determinism rules for tests (PLAN-V09 §5.0): no fixed sleeps, no hardcoded browser or Playwright paths.
// This covers the two v0.8 ports in test/e2e/legacy-*.js too: since WS-0 they wait on conditions only.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'out' || e.name === 'fixtures' || e.name === 'golden' && false ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);

module.exports = async function (t) {
  const files = walk(ROOT).filter(f => f.endsWith('.js') && !f.includes(`${path.sep}fixtures${path.sep}`) && !f.includes(`${path.sep}out${path.sep}`));
  const sleeps = [], paths = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8'), rel = path.relative(ROOT, f);
    if (rel === path.join('unit', 'lint.test.js')) continue;
    src.split('\n').forEach((l, i) => { if (/\bwait\(\s*\d+\s*\)|waitForTimeout\(|setTimeout\(\s*r\w*\s*,\s*[1-9]\d{2,}|\{\s*after:\s*\d{3,}/.test(l)) sleeps.push(`${rel}:${i + 1}`); });
    src.split('\n').forEach((l, i) => { if (/\/opt\/pw-browsers|\/opt\/node22/.test(l)) paths.push(`${rel}:${i + 1}`); });
  }
  t.ok(`no fixed sleeps in ${files.length} test files, the legacy e2e ports included`, sleeps.length === 0, sleeps.join(', '));
  t.ok('no hardcoded /opt browser or Playwright paths anywhere in test/', paths.length === 0, paths.join(', '));
};
