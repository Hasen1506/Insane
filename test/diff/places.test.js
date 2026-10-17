// WS-F differential (PLAN §5.c): nearest-place resolution and cell/zone maths, v0.8 (fac3720) against v0.9's
// two new ways of getting the same answers, on seeded inputs over the real 69,818-town file:
//   1. server mode: server/geo.js (search and areas computed on the server, phones download no town list)
//   2. local mode: per-country chunks loaded on demand (placesNear) instead of the whole world list
// Both must give exactly v0.8's city (areaFor), city choices (areaChoices), "near X" name (nearName on the
// square's middle) and search ranking (searchPlaces), and the square (cellOf) for every zone size.
'use strict';
const { G, rng } = require('../pbt/runner');
const { loadV08, loadV09 } = require('../lib/load');
const geo = require('../../server/geo');
const canon = x => JSON.stringify(x);
module.exports = async function (t) {
  const v08 = loadV08(); await v08.loadPlaces();
  const P = v08.run('GEO.places'); geo.load();
  const R = rng(+process.env.DIFF_SEED || 20261017);
  const pick = () => P[Math.floor(R.next() * P.length)];
  const jitter = () => (R.next() - .5) * .6;
  const N = +process.env.DIFF_PLACES_RUNS || 40;
  // server: areas and the "near" name for each zone size
  let bad = [];
  for (let i = 0; i < N * 2; i++) {
    const p = pick(), lat = p.lat + jitter(), lon = p.lon + jitter();
    const g = geo.info(lat, lon); const near = {};
    for (const s of [1, 2, 3]) { const c = v08.get('cellOf')(lat, lon, s); near[s] = v08.get('nearName')(c.lat, c.lon); }
    const want = { area: v08.get('areaFor')(lat, lon), choices: v08.get('areaChoices')(lat, lon), near };
    if (canon(g) !== canon(JSON.parse(JSON.stringify(want)))) bad.push([lat, lon, canon(g).slice(0, 160), canon(want).slice(0, 160)]);
  }
  t.ok(`server /api/place: city, city choices and "near" names identical to v0.8 on ${N * 2} seeded points`, !bad.length, JSON.stringify(bad[0]));
  bad = [];
  for (let i = 0; i < N * 2; i++) {
    const p = pick(); const how = Math.floor(R.next() * 3); const q = how === 0 ? p.n : how === 1 ? p.n.slice(0, Math.max(1, p.n.length >> 1)) : p.n + ', ' + (p.a || p.cc);
    const a = geo.search(q).map(x => [x.n, x.cc, x.a]), b = v08.get('searchPlaces')(q).map(x => [x.n, x.cc, x.a]);
    if (canon(a) !== canon(b)) bad.push([q, a, b]);
  }
  t.ok(`server /api/places: search ranking identical to v0.8 on ${N * 2} seeded names`, !bad.length, JSON.stringify(bad[0]));
  // local mode: a fresh page each time, loading only the chunks near the point
  bad = []; let maxChunks = 0, full = 0;
  for (let i = 0; i < N; i++) {
    const p = pick(), lat = p.lat + jitter(), lon = p.lon + jitter();
    const app = loadV09(); app.setState({ backend: 'local' });
    await app.run(`placesNear(${lat},${lon})`);
    const got = app.run(`placeInfoLocal(${lat},${lon})`); const near = {};
    for (const s of [1, 2, 3]) { const c = v08.get('cellOf')(lat, lon, s); near[s] = v08.get('nearName')(c.lat, c.lon); }
    const want = { area: v08.get('areaFor')(lat, lon), choices: v08.get('areaChoices')(lat, lon), near };
    if (canon(JSON.parse(JSON.stringify(got))) !== canon(JSON.parse(JSON.stringify(want)))) bad.push([lat, lon, canon(got).slice(0, 200), canon(want).slice(0, 200)]);
    maxChunks = Math.max(maxChunks, app.run('GEO.have.size')); if (app.run('GEO.full')) full++;
  }
  t.ok(`local chunks: city, choices and "near" names identical to v0.8 on ${N} seeded points (at most ${maxChunks} chunks per page; whole list needed ${full}×)`, !bad.length, JSON.stringify(bad[0]));
  // cell / zone maths: the picker's square is v0.8's cellOf, for each zone size and for Exact
  const v09 = loadV09(); v09.setState({ uid: 'me', me: { name: 'Me' }, priv: {}, ui: {} });
  bad = [];
  for (let i = 0; i < 5000; i++) {
    const lat = (R.next() - .5) * 170, lon = (R.next() - .5) * 359.8, s = [1, 2, 3][i % 3], prec = i % 4 ? 'zone' : 'exact';
    v09.run('S.ui.loc=null'); const st = v09.run('lpState("home")'); Object.assign(st, { lat, lon, s, prec });
    const a = v09.get('publicCell')(st), b = v08.get('cellOf')(lat, lon, prec === 'exact' ? 1 : s);
    if (canon(a) !== canon(b)) bad.push([lat, lon, s, prec]);
  }
  t.ok('publicCell (the picker\'s square) equals v0.8 cellOf on 5,000 seeded pins', !bad.length, JSON.stringify(bad[0]));
};
