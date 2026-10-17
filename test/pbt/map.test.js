// WS-F properties (PLAN §5.b P09, P11, P15 and the map design in §7): what the map and the place picker must never do.
//   - an exact pin is never in anything other members can read: the public profile fields carry nothing finer than the
//     square (two pins in the same square give identical public fields), and "Others see" never draws the pin
//   - the square always contains the pin, and the preview square is the one that gets saved
//   - a drop is never listed or drawn outside the viewer's radius, nor outside the City distance filter
//   - clustering never loses or duplicates a point
//   - search results put towns before neighbourhoods before streets
//   - every timezone opens the picker over its own country (C64)
// The server half of "never readable" (other members can't read data/users/{uid}/loc) is in test/e2e/map.js.
'use strict';
const { prop, G } = require('./runner');
const { loadV09 } = require('../lib/load');

const LAT = G.float(-80, 80), LON = G.float(-179.9, 179.9);
const ZONE = G.pick([1, 2, 3]);
module.exports = async function (t) {
  const app = loadV09();
  const ok = (r) => t.ok(r.ok ? `${r.name} (${r.runs} cases)` : r.message, r.ok);
  const cellOf = app.get('cellOf'), distKm = app.get('distKm');
  app.setState({ uid: 'me', me: { name: 'Me', circle: 'c1' }, priv: {}, ui: {}, drops: [], missions: [], trails: [], members: [] });
  const fields = (lat, lon, prec, s) => { app.run('S.ui.loc=null'); const st = app.run('lpState("home")'); Object.assign(st, { lat, lon, prec, s, r: 5, src: 'map', area: null, geo: null }); return { st, f: app.get('homeFields')(st) }; };
  const inside = (c, lat, lon) => lat >= c.b[0] - 1e-9 && lat <= c.b[2] + 1e-9 && lon >= c.b[1] - 1e-9 && lon <= c.b[3] + 1e-9;

  // the square contains the pin, for every zone size and for Exact (whose public square is 1 km)
  ok(prop('the public square always contains the pin', G.tuple(LAT, LON, ZONE, G.pick(['zone', 'exact'])), ([lat, lon, s, prec]) => {
    const { st, f } = fields(lat, lon, prec, s); const c = app.get('publicCell')(st);
    return inside(f.cell, lat, lon) && JSON.stringify(f.cell) === JSON.stringify(c) && f.cell.s === (prec === 'exact' ? 1 : s);
  }));
  // no information finer than the square: any two pins in one square give the same public fields
  ok(prop('two pins in the same square publish identical fields (nothing finer leaks)', G.tuple(LAT, LON, ZONE, G.pick(['zone', 'exact']), G.float(.001, .999), G.float(.001, .999)), ([lat, lon, s, prec, u, v]) => {
    const a = fields(lat, lon, prec, s).f; const b0 = a.cell.b; const lat2 = b0[0] + (b0[2] - b0[0]) * u, lon2 = b0[1] + (b0[3] - b0[1]) * v;
    const b = fields(lat2, lon2, prec, s).f;
    const flat = JSON.stringify(a);
    return flat === JSON.stringify(b) && !/"(lat|lon)":/.test(JSON.stringify({ ...a, cell: undefined, areaLL: undefined }));
  }));
  // "Others see" draws the saved square and never the pin; "You see" in Exact shows the pin without a square
  ok(prop('"Others see" never draws the pin, and draws exactly the square that is saved', G.tuple(LAT, LON, ZONE, G.pick(['zone', 'exact'])), ([lat, lon, s, prec]) => {
    const { st } = fields(lat, lon, prec, s); st.view = 'others';
    const items = app.get('pickSpec')('home').items(); const c = app.get('publicCell')(st);
    const cells = items.filter(i => i.type === 'cell');
    st.view = 'you'; const mine = app.get('pickSpec')('home').items();
    return !items.some(i => i.type === 'pin' || i.type === 'acc') && cells.length === 1 && JSON.stringify(cells[0].b) === JSON.stringify(c.b)
      && mine.some(i => i.type === 'pin') && (prec === 'exact' ? !mine.some(i => i.type === 'cell') : true);
  }));

  // drops: never listed or drawn outside your radius (P11), nor outside the distance chip you picked
  const DROPS = G.array(G.record({ dlat: G.float(-.4, .4), dlon: G.float(-.4, .4), start: G.int(-5, 30), len: G.int(1, 20), kind: G.pick(['swap', 'dare', 'offer', 'twokey']) }), { max: 25 });
  ok(prop('a drop is never shown outside the radius (list, map, distance filter)', G.tuple(G.float(-60, 60), LON, ZONE, G.pick(['zone', 'exact']), G.pick([2, 5, 10, 25]), G.pick([null, 2, 5, 10, 25]), DROPS), ([lat, lon, s, prec, R, chip, ds]) => {
    const H = 36e5, t0 = Date.UTC(2026, 9, 12, 9); app.setNow(t0);
    const cell = cellOf(lat, lon, prec === 'exact' ? 1 : s);
    const drops = ds.map((d, i) => ({ id: 'd' + i, lat: lat + d.dlat, lon: lon + d.dlon, start: t0 + d.start * H, end: t0 + (d.start + d.len) * H, kind: d.kind, venue: 'V' + i, prize: 'p' }));
    app.setState({ me: { name: 'Me', circle: 'c1', cell, prec, radius: R, city: 'x', cityName: 'X' }, priv: prec === 'exact' ? { loc: { lat, lon } } : {}, drops, ui: { cityR: chip } });
    const ref = app.run('myRef()'); const r = app.run('cityR()');
    const listed = app.run('cityDrops()'); const near = app.run('nearDrops()');
    const drawn = app.run('MAPSPEC.city().items()').filter(i => i.drop);
    const far = d => distKm(ref, [d.lat, d.lon]);
    return r <= R && near.every(d => far(d) <= R + 1e-9) && listed.every(d => far(d) <= r + 1e-9)
      && drawn.every(i => far(drops.find(d => d.id === i.drop)) <= r + 1e-9) && drawn.length === listed.length;
  }));
  ok(prop('the City map never plots another person', G.array(G.tuple(G.float(-60, 60), LON), { min: 1, max: 8 }), ms => {
    const cell = cellOf(ms[0][0], ms[0][1], 1);
    app.setState({ me: { name: 'Me', circle: 'c1', cell, prec: 'zone', radius: 25 }, priv: {}, drops: [], members: ms.map(([a, b], i) => ({ id: 'u' + i, name: 'Ravi' + i, cell: cellOf(a, b, 1), circle: 'c1' })), ui: {} });
    const items = app.run('MAPSPEC.city().items()');
    return !items.some(i => i.type === 'dot' || /Ravi/.test(i.label || '') || (i.type === 'cell' && i.b !== cell.b));
  }));

  // clustering
  ok(prop('clustering never loses or duplicates a point', G.tuple(G.array(G.tuple(G.float(0, 400), G.float(0, 400)), { max: 80 }), G.pick([10, 24, 30, 60])), ([pts, r]) => {
    const cl = app.get('clusterPx')(pts, r); const all = cl.flatMap(c => c.members).sort((a, b) => a - b);
    return all.length === pts.length && all.every((x, i) => x === i) && cl.every(c => c.members.length >= 1 && isFinite(c.x) && isFinite(c.y));
  }));
  ok(prop('points farther apart than r never share a cluster with their seed', G.tuple(G.array(G.tuple(G.float(0, 400), G.float(0, 400)), { max: 40 }), G.pick([12, 30])), ([pts, r]) => {
    const cl = app.get('clusterPx')(pts, r);
    // every member is within r of some other member of its cluster (single-link from the seed)
    return cl.every(c => c.members.length === 1 || c.members.every(i => c.members.some(j => j !== i && Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < r)));
  }));

  // search grouping (C67)
  const KIND = G.pick(['road', 'suburb', 'neighbourhood', 'building', 'cafe', 'village', 'house', 'quarter', 'hamlet', 'footway']);
  ok(prop('search results: towns, then neighbourhoods, then streets', G.tuple(G.array(G.record({ n: G.str({ min: 1, max: 10, alphabet: 'abcdefgh' }), lat: LAT, lon: LON, pop: G.int(5000, 9e6), cc: G.pick(['IN', 'PT']), a: G.pick(['', 'Tamil Nadu']) }), { max: 6 }), G.array(G.record({ name: G.str({ min: 1, max: 20, alphabet: 'abcdefgh, ' }), lat: LAT, lon: LON, kind: KIND }), { max: 6 })), ([loc, rem]) => {
    const R = app.get('groupResults')(loc, rem, [13, 80]); const order = { town: 0, nbh: 1, street: 2 };
    return R.all.every((x, i) => i === 0 || order[R.all[i - 1].g] <= order[x.g]) && R.towns.length === loc.length && R.all.every(x => x.km != null && x.km >= 0) && app.get('groupResults')(loc, rem, null).all.every(x => x.km === null);
  }));

  // first view from the timezone (C64): the bundled shortcuts, and every zone in the index table, land in their own country
  const fs = require('fs'), path = require('path');
  const ix = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'data', 'places', 'index.json'), 'utf8'));
  const g = app.get('tzGuess')('Asia/Kolkata'); const IN = ix.files.IN.bb;
  t.ok('Asia/Kolkata opens on India, not Africa', g.cc === 'IN' && g.lat > IN[0] && g.lat < IN[2] && g.lon > IN[1] && g.lon < IN[3] && g.z >= 4 && g.z <= 6, JSON.stringify(g));
  const g2 = app.get('tzGuess')('Asia/Calcutta'); t.ok('the old Asia/Calcutta name too', g2.cc === 'IN', JSON.stringify(g2));
  const TZ0 = app.run('TZ0'); const bad0 = Object.entries(TZ0).filter(([tz, v]) => { const b = ix.files[v[3]].bb; return !(v[0] >= b[0] - 1 && v[0] <= b[2] + 1 && v[1] >= b[1] - 1 && v[1] <= b[3] + 1); });
  t.ok(`the ${Object.keys(TZ0).length} built-in timezone shortcuts each centre on their country`, bad0.length === 0, bad0.map(x => x[0]).join(','));
  // a country with one zone is framed whole (its view centre must be inside it); a multi-zone country opens on the
  // zone's own city from tzdata at zoom 5 (Adak, Thule… are real, if remote)
  const framed = Object.entries(ix.tz).filter(([, v]) => v[2] !== 5 && ix.files[v[3]]);
  const badIx = framed.filter(([tz, v]) => { const b = ix.files[v[3]].bb; const e = .05; return !(v[0] >= b[0] - e && v[0] <= b[2] + e && v[1] >= b[1] - e && v[1] <= b[3] + e); });
  t.ok(`all ${framed.length} single-zone countries in the place index are framed over themselves`, framed.length > 150 && badIx.length === 0, badIx.slice(0, 8).map(x => x[0]).join(','));
  t.ok('an unknown timezone falls back to its continent, never 0,0', (() => { const x = app.get('tzGuess')('Asia/Nowhere'); const y = app.get('tzGuess')('Etc/UTC'); return x.lat === 25 && x.lon === 90 && isFinite(y.lat); })());

  // PMTiles tile ids (spec v3 examples)
  const id = app.get('pmTileId');
  t.ok('PMTiles tile ids follow the v3 Hilbert numbering', id(0, 0, 0) === 0 && id(1, 0, 0) === 1 && id(1, 0, 1) === 2 && id(1, 1, 1) === 3 && id(1, 1, 0) === 4 && id(2, 0, 0) === 5 && id(12, 3423, 1763) === 19078479, [id(1, 0, 1), id(1, 1, 0), id(12, 3423, 1763)].join(','));
};
