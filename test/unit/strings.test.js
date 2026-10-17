// WS-H (C95): the strings table. t() fills slots and falls back to English per key; every t('key') in src/js
// exists in the English table; the files moved to the table so far hold no raw English copy.
'use strict';
const fs = require('fs'), path = require('path');
const { loadV09 } = require('../lib/load');
const SRC = path.join(__dirname, '..', '..', 'src', 'js');
const MOVED = ['79-activity.js']; // files whose user-facing copy lives in 95-strings.js

module.exports = async function (t) {
  const app = loadV09();
  const r = app.run(`(()=>{const a=t('met',{n:'Ravi'}),b=t('nope'),c=t('moleSub',{d:2});STR.ta={met:'நீங்கள் {n} ஐ சந்தித்தீர்கள்'};return [a,b,c,STR.en.dir]})()`);
  t.ok('t() fills {slots}, returns the key when there is no string', r[0] === 'You met Ravi' && r[1] === 'nope' && r[2] === '2 of 3 tasks' && r[3] === 'ltr', JSON.stringify(r));
  const ta = app.run(`(()=>{const f=new Function('STR','LANG','k','v','const s=(STR[LANG]||STR.en)[k]??STR.en[k]??k;return v?s.replace(/\\\\{(\\\\w+)\\\\}/g,(m,x)=>v[x]??m):s');return [f(STR,'ta','met',{n:'ரவி'}),f(STR,'ta','metSub')]})()`);
  t.ok('a partial Tamil table is used where it has the key and falls back to English where it does not', ta[0] === 'நீங்கள் ரவி ஐ சந்தித்தீர்கள்' && ta[1] === 'You can message each other now', JSON.stringify(ta));

  const keys = new Set(Object.keys(app.run('STR.en')));
  const files = fs.readdirSync(SRC, { recursive: true }).filter(f => f.endsWith('.js'));
  const missing = [];
  for (const f of files) for (const m of fs.readFileSync(path.join(SRC, f), 'utf8').matchAll(/[^\w.$]t\('(\w+)'/g)) if (!keys.has(m[1])) missing.push(`${f}: ${m[1]}`);
  t.ok('every t(\'key\') used in src/js is in the English table', !missing.length, missing.join(', '));

  const raw = [];
  for (const f of MOVED) {
    const s = fs.readFileSync(path.join(SRC, f), 'utf8');
    for (const m of s.matchAll(/'([^'\n]*)'|`([^`\n]*)`/g)) { const v = (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, ''); if (/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(v) && !/[<>=]|\(|^\s*(var|--)/.test(v)) raw.push(`${f}: "${v.slice(0, 50)}"`); }
  }
  t.ok(`no raw English sentences left in ${MOVED.join(', ')} (C95 lint)`, !raw.length, raw.join(' | '));
  t.ok('the page declares its language and direction from the table', /document\.documentElement\.dir=t\('dir'\)/.test(fs.readFileSync(path.join(SRC, '95-strings.js'), 'utf8')));
};
