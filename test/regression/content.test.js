// Regression tests for the WS-E live-test bugs (PLAN-V09 §5.e), against the BUILT app/index.html.
'use strict';
const fs = require('fs'), path = require('path');
const { loadBuilt } = require('../lib/load');
const K = require('../lib/content');
const HTML = fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'index.html'), 'utf8');

module.exports = async function (t) {
  const app = loadBuilt();
  // R-C48: "ANS in client source: True" (live run). The answers table is gone; no v0.8 answer is left as a literal.
  t.ok('R-C48 no ANS table and no v0.8 answer literal in the built page', !/\bconst ANS\b/.test(HTML) && !['WATERLOO', 'MARKET', 'CARD', 'MUSEUM', 'BRIDGE', 'STATION', 'GARDEN', 'TOWER'].some(a => HTML.includes(`'${a}'`) || HTML.includes(`"${a}"`)));
  t.ok('R-C48 the Decode action no longer compares fnv(guess) with a stored hash of the answer', !/fnv\(g\)!==/.test(HTML));
  // R-C86: honour-system mode keeps only a salted hash and a seal, and says so on the sheet
  t.ok('R-C86 local mode is labelled as checked on your phone, on your honour', /on your honour/.test(HTML));
  // R-C50: v0.8's drawWinner(d) = fnv(d.id + circles) was computable by anyone before the draw
  const d = { id: 'drop1', start: 0, end: 10, seedHash: 'abc' }, ins = [{ circle: 'a', at: 5 }, { circle: 'b', at: 5 }];
  t.ok('R-C50 a v0.9 drop has no winner anyone can compute until its seed is out', app.get('drawWinner')(d, ins) === null && app.get('drawWinner')({ ...d, seed: 'x' }, ins) !== null);
  t.ok('R-C50 a check-in after the drop closed doesn’t enter the draw', app.get('drawWinner')({ ...d, seed: 's' }, [{ circle: 'a', at: 50 }]) === null && app.get('drawWinner')({ ...d, seed: 's' }, [{ circle: 'a', at: 50 }, { circle: 'b', at: 5 }]) === 'b');
  // R-C91: Chennai got London's Waterloo and Big Ben. A Chennai person now gets the Chennai pack.
  const P = K.P.packs, chennai = P.find(p => p.id === 'chennai');
  t.ok('R-C91 a Minjur/Chennai city id gets the Chennai pack, in the page and on the server', app.run('packFor(DECODE_LOCAL.packs,"IN-tamil_nadu-chennai").id') === 'chennai' && K.C.packFor(P, 'IN-tamil_nadu-chennai').id === 'chennai' && chennai.puzzles.length >= 12);
  t.ok('R-C91 nothing London-flavoured in any pack', !/Waterloo|Big Ben|ravens|Napoleon|Thames/i.test(JSON.stringify(K.P)));
  // R-C92: 8 starters repeated within two weeks
  const seen = []; app.setState({ me: { circle: 'c1' }, dares: [] });
  for (let i = 0; i < 30; i++) { app.setNow(Date.UTC(2026, 9, 1, 12) + i * 864e5); seen.push(app.run('dailyDare()').text); }
  t.ok(`R-C92 30 days of daily dares, no repeat (${app.get('STARTER_DARES').length} starters, ${app.get('MOLE_POOL').length} Mole tasks)`, new Set(seen).size === 30 && app.get('STARTER_DARES').length >= 40 && app.get('MOLE_POOL').length >= 30);
};
