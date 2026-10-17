// WS-0 proof, part 1: every extracted pure function gives the same answer in v0.8 (fac3720),
// in v0.9's src/ modules and in the built app/index.html, on the same seeded inputs.
// 5,000 cases per function by default (DIFF_RUNS), fewer for the place-file scans, which walk 69,818 towns per call
// on three sides (searchPlaces with a region costs ~80 ms a call, as in the browser): DIFF_PLACES_RUNS (40),
// DIFF_AREA_RUNS (60, areaFor + areaChoices) and DIFF_NEAR_RUNS (40, nearName) raise them for a soak.
'use strict';
const H = require('./harness');
const { G } = require('../pbt/runner');

const DAY = 864e5;
const T = G.int(Date.UTC(2024, 0, 1), Date.UTC(2028, 0, 1));           // any instant 2024–2027
const LAT = G.float(-85, 85), LON = G.float(-180, 180);
const S_KM = G.pick([1, 2, 3, 25]);
const UID = G.uid();
const LANE = G.pick(['need', 'want', 'urge']);
// lines people type: templates plus noise
const URGE = G.oneOf(G.str({ max: 80 }), G.map(G.tuple(G.pick(['run', 'read', 'call mum', 'swim', 'learn Tamil', 'cook', 'paint', 'meditate', 'write', 'gym']), G.pick(['', ' 3 times a week', ' twice a week', ' every day', ' on monday', ' five times', ' 20 minutes', ' by friday', ' once', ' this week', ' for 10 days', ' 4x']), G.str({ max: 8 })), ([a, b, c]) => a + b + c), G.str({ min: 200, max: 400 }));
const LINK = G.oneOf(G.str({ max: 60 }),
  G.map(G.tuple(LAT, LON, G.pick(['google', 'google3d', 'apple', 'osm', 'osmhash', 'geo', 'plain', 'space', 'dms', 'enc'])), ([a, b, k]) => {
    const x = a.toFixed(5), y = b.toFixed(5);
    return { google: `https://www.google.com/maps/@${x},${y},15z`, google3d: `https://www.google.com/maps/place/X/data=!3d${x}!4d${y}`, apple: `https://maps.apple.com/?ll=${x},${y}&q=Pin`, osm: `https://www.openstreetmap.org/?mlat=${x}&mlon=${y}#map=17/${x}/${y}`, osmhash: `https://www.openstreetmap.org/#map=12/${x}/${y}`, geo: `geo:${x},${y}`, plain: `${x}, ${y}`, space: `${x} ${y}`, dms: `${Math.abs(a).toFixed(3)}° ${a < 0 ? 'S' : 'N'}, ${Math.abs(b).toFixed(3)}° ${b < 0 ? 'W' : 'E'}`, enc: encodeURIComponent(`https://maps.google.com/?q=${x},${y}`) }[k];
  }));
const SOLVES = G.array(G.record({ uid: UID, at: T, nh: G.int(0, 3) }), { max: 30 });
const POT = G.record({ by: UID, mode: G.pick(['pledge', 'split', undefined]), min: G.pick([undefined, 2, 3, 4]), pledges: G.map(G.array(G.tuple(UID, G.bool()), { max: 8 }), Object.fromEntries), paid: G.map(G.array(G.tuple(UID, G.pick([true, false, 'wait', undefined])), { max: 8 }), Object.fromEntries) });
const FAVORS = G.array(G.record({ status: G.pick(['logged', 'asked', 'claimed', 'done', 'cancelled']), doer: UID, asker: UID, h: G.pick([.25, .5, 1, 2, 4]) }), { max: 40 });
const DROP = G.record({ id: G.str({ min: 1, max: 12, alphabet: 'abcdefghijkmnpqrstuvwxyz23456789' }), start: T, len: G.int(0, 3 * DAY) });
const INS = G.array(G.record({ circle: G.pick(['c1', 'c2', 'c3', 'c4', 'c5', '', null, undefined]), uid: UID }), { max: 20 });

module.exports = async function (t) {
  const h = await H.open();
  const same = (name, gen, call, opts) => { const r = h.same(name, gen, call, opts); t.ok(`${name}: ${r.ok ? 'identical on ' + r.runs + ' seeded inputs' : r.message}`, r.ok); };

  // geometry
  same('distKm', G.tuple(LAT, LON, LAT, LON), ([a, b, c, d]) => app => app.get('distKm')([a, b], [c, d]));
  same('cellOf', G.tuple(LAT, LON, S_KM), ([a, b, s]) => app => app.get('cellOf')(a, b, s));
  same('nearCells', G.tuple(LAT, LON, S_KM), ([a, b, s]) => app => app.get('nearCells')(a, b, s));
  same('gOf', G.tuple(LAT, LON), ([a, b]) => app => app.get('gOf')(a, b));
  same('fmtKm', G.float(0, 500), d => app => app.get('fmtKm')(d));
  same('mUnit/mInv', G.tuple(LAT, LON), ([a, b]) => app => { const u = app.get('mUnit')(a, b); return [u, app.get('mInv')(u[0], u[1])]; });
  same('fitZoom', G.tuple(LAT, G.pick([1, 2, 5, 10, 25, 100])), ([a, r]) => app => app.get('fitZoom')(a, r));
  same('parseLL', LINK, s => app => app.get('parseLL')(s));
  // text
  same('norm', G.str({ max: 40 }), s => app => app.get('norm')(s));
  same('slug', G.str({ max: 40 }), s => app => app.get('slug')(s));
  same('esc', G.str({ max: 40 }), s => app => app.get('esc')(s));
  same('fnv/fnvN', G.str({ max: 40 }), s => app => [app.get('fnv')(s), app.get('fnvN')(s)]);
  same('initials', G.str({ max: 12 }), s => app => app.get('initials')(s));
  same('pairId', G.tuple(UID, UID), ([a, b]) => app => app.get('pairId')(a, b));
  same('ordinal', G.int(0, 400), n => app => app.get('ordinal')(n));
  same('hrs', G.float(-12, 12), x => app => app.get('hrs')(Math.round(x * 4) / 4));
  // urges -> what they become
  same('readUrge', G.tuple(LANE, URGE), ([l, s]) => app => app.get('readUrge')(l, s));
  same('readCard(readUrge)', G.tuple(LANE, URGE), ([l, s]) => app => app.get('readCard')(app.get('readUrge')(l, s)));
  // time (the clock is set per case on every side)
  const at = (f) => ({ prepare: x => h.setNow(Array.isArray(x) ? x[0] : x), ...f });
  same('ymd/weekStart/weekKey/dayStart', T, x => app => [app.get('ymd')(x), app.get('weekStart')(x), app.get('weekKey')(x), app.get('dayStart')(x)]);
  same('left', G.int(-5000, 40 * DAY), ms => app => app.get('left')(ms));
  same('ago', G.tuple(T, G.int(0, 400 * DAY)), ([t0, d]) => app => app.get('ago')(t0 - d), at());
  same('decodeState', G.tuple(T, SOLVES), ([t0, s]) => app => app.get('decodeState')(s), at());
  same('decPts', G.tuple(G.int(1, 40), G.int(0, 3)), ([r, n]) => app => app.get('decPts')(r, n));
  same('dropPhase', G.tuple(DROP, T), ([d, t0]) => app => app.get('dropPhase')({ ...d, end: d.start + d.len }, t0));
  same('drawWinner', G.tuple(DROP, INS), ([d, ins]) => app => app.get('drawWinner')(d, ins));
  // money and hours
  same('potOn/nIn/potState/potPaidN', G.tuple(POT, UID), ([p, u]) => app => [app.get('potOn')(p), app.get('nIn')(p), app.get('potState')(p, u), app.get('potPaidN')(p)]);
  same('balance', G.tuple(FAVORS, UID), ([f, u]) => app => app.get('balance')(u), { prepare: ([f]) => h.setState({ favors: f }) });

  // places: the real 69,818-town file, loaded the way the app loads it
  await h.loadPlaces();
  const P = h.sides['v0.8'].run('GEO.places');
  t.ok('places.tsv loaded on every side (' + P.length + ' towns)', P.length > 60000 && h.all.every(a => a.run('GEO.places.length') === P.length));
  const NAMES = G.map(G.tuple(G.int(0, P.length - 1), G.pick(['', 'prefix', 'lower', 'region'])), ([i, how]) => { const p = P[i]; return how === 'prefix' ? p.n.slice(0, Math.max(1, p.n.length >> 1)) : how === 'lower' ? p.n.toLowerCase() : how === 'region' ? p.n + ', ' + (p.a || p.cc) : p.n; });
  same('searchPlaces', NAMES, q => app => app.get('searchPlaces')(q).map(p => [p.n, p.cc, p.a]), { runs: +process.env.DIFF_PLACES_RUNS || 40 });
  const NEAR = G.map(G.tuple(G.int(0, P.length - 1), G.float(-.3, .3), G.float(-.3, .3)), ([i, a, b]) => [P[i].lat + a, P[i].lon + b]);
  same('areaFor', NEAR, ([a, b]) => app => app.get('areaFor')(a, b), { runs: +process.env.DIFF_AREA_RUNS || 60 });
  same('nearName', NEAR, ([a, b]) => app => app.get('nearName')(a, b), { runs: +process.env.DIFF_NEAR_RUNS || 40 });
  same('areaChoices', NEAR, ([a, b]) => app => app.get('areaChoices')(a, b), { runs: +process.env.DIFF_AREA_RUNS || 60 });

  // the registries: every v0.8 action name and sheet still resolves, and nothing new appeared
  const v08 = require('fs').readFileSync(require('../lib/load').v08Dir() + '/app/index.html', 'utf8');
  const actNames = [...v08.slice(v08.indexOf('async function act(')).matchAll(/case '([^']+)':/g)].map(m => m[1]);
  const sheetFn = v08.slice(v08.indexOf('function sheetBody('), v08.indexOf('function sealOpts('));
  const sheetNames = [...sheetFn.matchAll(/case '([^']+)':/g)].map(m => m[1]);
  for (const [n, a] of Object.entries(h.sides).slice(1)) {
    const acts = Object.keys(a.run('ACT')).sort(), sheets = Object.keys(a.run('SHEETS')).sort();
    t.ok(`${n}: ACT registry has exactly v0.8's ${actNames.length} action names`, JSON.stringify(acts) === JSON.stringify([...actNames].sort()), acts.length);
    t.ok(`${n}: SHEETS registry has exactly v0.8's ${sheetNames.length} sheets`, JSON.stringify(sheets) === JSON.stringify([...sheetNames].sort()), sheets.length);
  }
  // sheets render the same HTML for the same state (the switch → registry change, checked end to end)
  const bad = [];
  for (const name of [...sheetNames, 'no-such-sheet']) {
    const c = h.compare(name, n => app => { try { return app.run(`sheetBody({t:${JSON.stringify(n)}})`); } catch (e) { return 'threw ' + e.constructor.name; } });
    if (c.diff) bad.push(name + ': ' + JSON.stringify(c).slice(0, 200));
  }
  t.ok(`sheetBody: ${sheetNames.length + 1} sheet types render identically on an empty state`, bad.length === 0, bad.join(' | '));
};
