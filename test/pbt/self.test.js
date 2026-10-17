// The PBT runner tests itself: it finds a planted bug, shrinks it to the minimal case, and replays by seed.
'use strict';
const assert = require('assert');
const { prop, G, rng } = require('./runner');
module.exports = async function (t) {
  // determinism: same seed, same stream
  const a = rng(42), b = rng(42); for (let i = 0; i < 100; i++) assert.strictEqual(a.next(), b.next());
  t.ok('rng(seed) is deterministic');
  // a true property passes
  const r1 = prop('int add commutes', G.tuple(G.int(), G.int()), ([x, y]) => x + y === y + x, { runs: 500 });
  assert(r1.ok); t.ok('true property passes');
  // a planted bug is found and shrunk to the boundary
  const r2 = prop('ints below 100', G.int(0, 1000), x => x < 100, { runs: 500, seed: 7 });
  assert(!r2.ok && r2.shrunk === 100, JSON.stringify(r2)); t.ok('finds x>=100 and shrinks to exactly 100');
  const r3 = prop('arrays shorter than 3', G.array(G.int(0, 9)), xs => xs.length < 3, { runs: 500, seed: 9 });
  assert(!r3.ok && r3.shrunk.length === 3 && r3.shrunk.every(x => x === 0), JSON.stringify(r3.shrunk)); t.ok('shrinks arrays to minimal length and values');
  const r4 = prop('no emoji', G.str(), s => !/\p{Extended_Pictographic}/u.test(s), { runs: 2000, seed: 3 });
  assert(!r4.ok && [...r4.shrunk].length <= 2, JSON.stringify(r4.shrunk)); t.ok('string generator reaches emoji, and shrinks the string');
  // replay: the reported seed reproduces the same first failing case
  const r5 = prop('ints below 100', G.int(0, 1000), x => x < 100, { runs: 500, seed: r2.seed });
  assert.deepStrictEqual(r5.case, r2.case); t.ok('SEED replays the same case');
  // async predicates
  const r6 = await prop('async false on 13', G.int(0, 50), async x => x !== 13, { runs: 2000, seed: 1 });
  assert(!r6.ok && r6.shrunk === 13); t.ok('async predicates work and shrink');
  assert(/SEED=\d+ CASE=/.test(r2.message)); t.ok('failure message carries SEED and CASE');
};
