// WS-B unit checks: email typo suggestions (C12), lane examples (C24), the glossary (C108), copy (C18).
'use strict';
const fs = require('fs'), path = require('path');
const { loadV09 } = require('../lib/load');
const SRC = path.join(__dirname, '..', '..', 'src', 'js');

module.exports = async function (t) {
  const app = loadV09();
  const sd = app.get('suggestDomain');
  t.ok('suggestDomain: gmial.com → gmail.com', sd('a@gmial.com') === 'a@gmail.com');
  t.ok('suggestDomain: gnail.com, gmai.com, yaho.co.in, outlok.com', sd('x@gnail.com') === 'x@gmail.com' && sd('x@gmai.com') === 'x@gmail.com' && sd('x@yaho.co.in') === 'x@yahoo.co.in' && sd('x@outlok.com') === 'x@outlook.com');
  t.ok('suggestDomain: leaves right and unknown domains alone', ['a@gmail.com', 'a@iitm.ac.in', 'a@company.in', 'a@tcs.com', 'not-an-email', ''].every(e => sd(e) === null));
  const ok = app.get('emailOK');
  t.ok('emailOK: refuses "not-an-email" and "a@b", takes "meera@gmail.com"', !ok('not-an-email') && !ok('a@b') && !ok('a@b.c') && ok('meera@gmail.com'));

  // C24: every example a person can tap turns into something INSANE will start
  const readUrge = app.get('readUrge'), EX = app.get('OB_EX_IN'), LANES = app.get('LANES');
  const bad = [];
  for (const lane of ['need', 'want', 'urge']) for (const e of [...EX[lane], ...LANES[lane].ex]) { const r = readUrge(lane, e); if (!r || r.kind === 'No' || r.kind === 'Support') bad.push(lane + ': ' + e + ' → ' + (r && r.kind)); }
  t.ok('every lane example (India and default) parses into a pact, plan, ladder, dare or Midnight', bad.length === 0, bad.join(' | '));
  t.ok('India examples use ₹, not £', EX.want.some(e => e.includes('₹')) && !JSON.stringify(EX).includes('£'));
  const chip = app.get('obChip')(readUrge('need', 'run 3 times a week'), { stake: 1 });
  t.ok('the read becomes one plain chip: kind, what, how, stake', /Pact/.test(chip) && /if I miss: i cook for the circle/i.test(chip), chip);

  // C108: each invented noun from the audit has a two-line explainer
  const GLOSS = app.get('GLOSS'), names = Object.values(GLOSS).map(g => g.n.toLowerCase()).join('|');
  const nouns = ['pact', 'ladder', 'mole', 'midnight', 'decode', 'drop', 'two-key', 'trail', 'mission', 'call', 'league', 'pot', 'favor hours', 'passport', 'journey', 'go dark', 'handle'];
  t.ok('glossary covers all 17 nouns from the audit', nouns.every(n => names.includes(n)), nouns.filter(n => !names.includes(n)).join(','));
  t.ok('every glossary line is short (≤ 2 sentences, ≤ 160 chars)', Object.values(GLOSS).every(g => g.s.length <= 160 && (g.s.match(/[.!?](\s|$)/g) || []).length <= 2), Object.values(GLOSS).filter(g => g.s.length > 160).map(g => g.n).join(','));
  const hm = app.get('helpMarks');
  t.ok('helpMarks puts a ? on noun headings and leaves others alone', /data-act="gloss" data-v="drop"/.test(hm('<div class="eyebrow">Drops near you <b>2</b></div>')) && hm('<div class="eyebrow">Open</div>') === '<div class="eyebrow">Open</div>');
  t.ok('every ? has an accessible name', /aria-label="What’s Drop\?"/.test(hm('<div class="eyebrow">Drops near you</div>')));

  // C18: the copy says circles are 3–8, never "your five"
  const copy = ['68-welcome.js', '71-onboarding.js', '96-unlock.js', '97-help.js'].map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  t.ok('copy lint: no "your five" in first-run copy, and "3–8" is there', !/your five/i.test(copy) && /3–8/.test(copy));
  t.ok('the age gate is 18+ for India, 16+ elsewhere, and asks month and year only', app.get('ageMin')('IN') === 18 && app.get('ageMin')('XX') === 16 && /month and year/.test(copy) && !/day you were born/i.test(copy));
};
