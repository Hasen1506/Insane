// WS-E content checks (C48, C86, C91, C92): the packs are big enough, every puzzle is solvable from its own
// clue and gives nothing away, dares and Mole tasks are safe, and the page carries no answer.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const K = require('../lib/content'), C = K.C;
const TOOL = require('../../tools/content');
const REPO = path.resolve(__dirname, '..', '..');
const BUILT = path.join(REPO, 'app', 'index.html');

module.exports = async function (t) {
  const P = K.P.packs, all = P.flatMap(p => p.puzzles);
  const D = JSON.parse(fs.readFileSync(path.join(K.DIR, 'dares.json'), 'utf8')).dares;
  const M = JSON.parse(fs.readFileSync(path.join(K.DIR, 'mole.json'), 'utf8')).tasks;

  /* ---------- packs ---------- */
  t.ok(`at least 30 puzzles (${all.length})`, all.length >= 30);
  for (const id of ['chennai', 'bengaluru', 'mumbai', 'delhi', 'generic']) { const p = P.find(x => x.id === id); t.ok(`${id}: at least 12 puzzles (${p && p.puzzles.length})`, p && p.puzzles.length >= 12); }
  for (const id of ['hyderabad', 'kolkata']) t.ok(`${id} pack exists`, P.some(p => p.id === id && p.puzzles.length >= 6));
  t.ok('Chennai is the first pack', P[0].id === 'chennai' && P[0].cities.includes('IN-tamil_nadu-chennai'));
  t.ok('a generic pack catches every other city', C.packFor(P, 'PT-lisbon-lisbon').id === 'generic' && C.packFor(P, 'xx-1:2:3').id === 'generic');
  const bad = all.map(z => [z.id, C.checkPuzzle(z)]).filter(([, b]) => b.length);
  t.ok('every puzzle passes the checker (solvable from its data, data shown in the clue, nothing gives it away)', !bad.length, JSON.stringify(bad));
  t.ok('puzzle ids are unique', new Set(all.map(z => z.id)).size === all.length);
  for (const p of P) t.ok(`${p.id}: no duplicate answers`, new Set(p.puzzles.map(z => z.a)).size === p.puzzles.length);
  for (const p of P.filter(p => p.puzzles.length >= 12)) t.ok(`${p.id}: varied (≥6 kinds of puzzle)`, new Set(p.puzzles.map(z => z.kind)).size >= 6, [...new Set(p.puzzles.map(z => z.kind))].join(','));
  t.ok(`every kind is used (${C.KINDS.length})`, C.KINDS.every(k => all.some(z => z.kind === k)));
  t.ok('no London answers left (C91)', !all.some(z => ['WATERLOO', 'TOWER', 'BIGBEN'].includes(z.a)));
  // the checker really checks: break each kind one way and it says so
  const mk = (kind, data, a, q) => ({ id: 'x-test', kind, data, a, q: q || C.ASK[kind](data), h: ['one hint', 'two hint', 'three hint'] });
  t.ok('checker: a wrong answer fails', C.checkPuzzle(mk('caesar', { shift: 3, text: C.shift('MARINA', 3) }, 'MARINE')).some(x => /not solvable/.test(x)));
  t.ok('checker: a clue that hides its data fails', C.checkPuzzle(mk('morse', { code: '-- .-' }, 'MA', 'Morse it')).length > 0);
  t.ok('checker: a hint with the answer fails', C.checkPuzzle({ ...mk('reverse', { text: 'ANIRAM' }, 'MARINA'), h: ['It is Marina beach', 'b hint', 'c hint'] }).some(x => /hint 1/.test(x)));
  t.ok('checker: an anagram that is its own answer fails', C.checkPuzzle(mk('anagram', { letters: 'MARINA' }, 'MARINA')).some(x => /not solvable/.test(x)));
  t.ok('checker: a hidden word that is just a word in the line fails', C.checkPuzzle(mk('hidden', { text: 'Walk along the marina at dusk' }, 'MARINA')).length > 0);
  t.ok('checker: keypad and anagram accept every fitting answer', C.solves(mk('keypad', { digits: '227' }, 'CAR'), 'BAR') && C.solves(mk('anagram', { letters: 'DANGER' }, 'GARDEN'), 'GANDER'));

  /* ---------- dares and Mole tasks ---------- */
  t.ok(`at least 40 dares (${D.length})`, D.length >= 40);
  t.ok(`at least 30 Mole tasks (${M.length})`, M.length >= 30);
  const badD = D.map(d => [d.id, C.checkDare(d)]).filter(([, b]) => b.length), badM = M.map(m => [m.i, C.checkMole(m)]).filter(([, b]) => b.length);
  t.ok('every dare passes the safety floor', !badD.length, JSON.stringify(badD));
  t.ok('every Mole task passes the safety floor', !badM.length, JSON.stringify(badM));
  t.ok('dares cover every level 1–6, none above the jar cap', [1, 2, 3, 4, 5, 6].every(l => D.some(d => d.level === l)) && D.every(d => d.level <= 6));
  t.ok('dare texts are unique', new Set(D.map(d => d.text.toLowerCase())).size === D.length);
  t.ok('Mole indices are dense and permanent (0..n-1)', M.every((m, i) => m.i === i));
  const v08 = require('../lib/load').loadV08();
  t.ok('the first 8 dares and Mole tasks are v0.8’s, unchanged (a v0.8 Mole’s task numbers still mean the same)', JSON.stringify(v08.get('STARTER_DARES')) === JSON.stringify(D.slice(0, 8).map(d => [d.text, d.level])) && JSON.stringify(v08.get('MOLE_TASKS')) === JSON.stringify(M.slice(0, 8).map(m => m.text)) && JSON.stringify(v08.get('MOLE_N')) === JSON.stringify(M.slice(0, 8).map(m => m.n)));
  const unsafe = ['Run across the road when the light is red', 'Climb onto the roof of the bus shelter', 'Down a beer in one', 'Light a fire in the park', 'Prank call the police', 'Pay a stranger to sing', 'Kiss someone you don’t know', 'Swim out past the flags at Marina', 'Steal a sugar packet'];
  const safe = ['Sit in a different seat at every plan', 'Give the auto driver a compliment', 'Hum the same tune all morning', 'Ask a bookseller for their favourite book'];
  t.ok('the screen refuses unsafe dares', unsafe.every(x => C.screenText(x).length), unsafe.filter(x => !C.screenText(x).length).join(' | '));
  t.ok('the screen lets ordinary dares through', safe.every(x => !C.screenText(x).length), safe.filter(x => C.screenText(x).length).map(x => x + ':' + C.screenText(x)).join(' | '));

  /* ---------- the page (C48, C86) ---------- */
  t.ok('src/js/34-packs.js is a fresh build of server/content (node tools/content.js)', fs.readFileSync(TOOL.OUT, 'utf8') === TOOL.build());
  const html = fs.readFileSync(BUILT, 'utf8');
  t.ok('built page: no ANS or CLUES table', !/\bANS\s*=|\bCLUES\s*=/.test(html));
  const leaks = K.allAnswers().filter(a => new RegExp('\\b' + a + '\\b').test(html) || new RegExp('["\'`]' + a + '["\'`]', 'i').test(html));
  t.ok(`built page: none of the ${K.allAnswers().length} answers appears as a word in upper case or as a quoted string`, !leaks.length, leaks.join(','));
  const js = html.slice(html.indexOf('/*@decode-local*/'), html.indexOf('/*@end-decode-local*/'));
  const lowLeaks = K.allAnswers().filter(a => new RegExp('\\b' + a + '\\b', 'i').test(js.replace(/"q":"[^"]*"|"h":\[[^\]]*\]/g, '')));
  t.ok('built page: the local pack holds no answer in any case outside its clue text', !lowLeaks.length, lowLeaks.join(','));
  // the sealed pack works: each hash matches its answer, and each seal opens to it
  const L = JSON.parse(/const DECODE_LOCAL=(\{[\s\S]*?\});\/\*@end-decode-local/.exec(html)[1]);
  const byId = new Map(all.map(z => [z.id, z]));
  let okHash = 0, okSeal = 0, n = 0;
  for (const p of L.packs) for (const z of p.puzzles) {
    n++; const a = byId.get(z.id).a;
    if (crypto.pbkdf2Sync(a, 'insane-decode|' + z.s, L.iter, 16, 'sha256').toString('hex') === z.x) okHash++;
    const k = crypto.createHash('sha256').update('insane-seal|' + z.s + '|' + z.id).digest();
    if (Buffer.from(z.z, 'base64').map((b, i) => b ^ k[i]).toString('latin1') === a) okSeal++;
  }
  t.ok(`local pack: all ${n} hashes check and all seals open to the answer`, n === all.length && okHash === n && okSeal === n, `${okHash}/${okSeal}/${n}`);
  t.ok('local pack: every salt is different', new Set(L.packs.flatMap(p => p.puzzles.map(z => z.s))).size === n);
  t.ok('local pack sits between the markers the server strips', (html.match(/\/\*@decode-local\*\//g) || []).length === 1 && (html.match(/\/\*@end-decode-local\*\//g) || []).length === 1);
  // int-1: app/index.html is minified, so the byte-for-byte check is on src/ (which the build carries) and on the MINIFY=0 build
  const CLIENT = /\/\* CLIENT-BEGIN \*\/\n([\s\S]*?)\/\* CLIENT-END \*\//.exec(fs.readFileSync(path.join(REPO, 'server', 'content-core.js'), 'utf8'))[1];
  const plain = require('child_process').spawnSync(process.execPath, [path.join(REPO, 'tools', 'build.js'), '--stdout'], { env: { ...process.env, MINIFY: '0' }, encoding: 'utf8', maxBuffer: 64 << 20 }).stdout;
  t.ok('the page’s schedule helpers are the server’s, byte for byte', fs.readFileSync(TOOL.OUT, 'utf8').includes(CLIENT) && plain.includes(CLIENT));
};
