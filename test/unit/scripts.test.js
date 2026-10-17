// package.json "scripts" are the source of truth for how to build and test. Every `node <file>` they
// name exists, test/run.js takes its build check from `scripts.check`, and the docs only name commands
// that exist (a stale `node tools/check.js` once sat in someone's notes; there is no such file).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const nodeFiles = s => [...s.matchAll(/\bnode\s+((?:tools|test|server|app)\/[\w./-]+\.m?js)/g)].map(m => m[1]);

module.exports = async function (t) {
  const S = pkg.scripts || {};
  for (const k of ['build', 'check', 'test', 'test:quick', 'test:e2e', 'golden:update']) t.ok(`package.json has scripts.${k}`, typeof S[k] === 'string');
  const missing = Object.entries(S).flatMap(([k, v]) => nodeFiles(v).filter(f => !fs.existsSync(path.join(ROOT, f))).map(f => `${k}: ${f}`));
  t.ok('every file a package.json script runs exists', missing.length === 0, missing.join(', '));
  const { SUITES } = require('../run.js');
  t.ok('test/run.js runs the build suite from scripts.check', S.check && SUITES.build.script.join(' ') === S.check.replace(/^node\s+/, ''), SUITES.build.script.join(' '));
  const suites = Object.values(S).filter(v => /test\/run\.js/.test(v)).flatMap(v => v.replace(/^.*test\/run\.js/, '').trim().split(/\s+/).filter(Boolean));
  t.ok('every suite a script names is a test/run.js suite', suites.every(s => SUITES[s]), suites.filter(s => !SUITES[s]).join(','));
  // docs that tell people what to type (PLAN-V09 is the plan as written, with .mjs names; WS0.md notes the change)
  const docs = ['README.md', 'docs/WS0.md', 'docs/BUILD.md', 'tools/livetest/README.md'].filter(f => fs.existsSync(path.join(ROOT, f)));
  const stale = docs.flatMap(d => nodeFiles(fs.readFileSync(path.join(ROOT, d), 'utf8')).filter(f => !fs.existsSync(path.join(ROOT, f))).map(f => `${d}: ${f}`));
  t.ok(`docs name only commands that exist (${docs.length} files)`, stale.length === 0, stale.join(', '));
  t.ok('no tools/check.js (the check is `npm run check` = tools/build.js --check)', !fs.existsSync(path.join(ROOT, 'tools', 'check.js')));
};
