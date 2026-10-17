// Place search and areas for server mode (C81): phones never download the 2.7 MB town list; the server
// answers from the same list, with the client's own code (src/js/10-places.js, run in a vm), so a phone in
// server mode resolves exactly the city it would have resolved by itself. No dependencies.
//   search(q, limit)       towns by name, the client's searchPlaces ranking
//   info(lat, lon)         { area, choices, near: {1,2,3} }, the client's placeInfoLocal
//   guess(tz, cc)          the picker's first view for a timezone (or a CDN country header)
'use strict';
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SRC = process.env.PLACES_JS || path.join(REPO, 'src', 'js', '10-places.js');
const DATA = path.join(REPO, 'app', 'data');
const HOT = ['Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 'Set', 'Map', 'RegExp', 'isFinite', 'parseInt', 'parseFloat'];

let api = null;
function load() {
  if (api) return api;
  const file = u => { const m = /^data\/(places\.tsv|places\/[A-Za-z0-9._-]+)$/.exec(String(u)); if (!m) return Promise.reject(new Error('no ' + u)); const f = path.join(DATA, m[1]); return Promise.resolve({ ok: true, status: 200, text: async () => fs.readFileSync(f, 'utf8'), json: async () => JSON.parse(fs.readFileSync(f, 'utf8')) }); };
  const ctx = vm.createContext({ console, Intl, Promise, fetch: file, S: { backend: 'server-geo' } });
  const code = fs.readFileSync(SRC, 'utf8');
  const wrapped = `(function(${HOT.join(',')}){${code}\n;return {GEO,parseChunk,searchPlaces,placeInfoLocal,tzGuess,cellOf,country};})(${HOT.join(',')})`;
  const a = vm.runInContext(wrapped, ctx, { filename: '10-places.js (server)' });
  // the whole world list, parsed the way the client parses it
  const t = fs.readFileSync(path.join(DATA, 'places.tsv'), 'utf8'); const c = a.parseChunk(t);
  a.GEO.cc = c.cc; a.GEO.places = c.P; a.GEO.full = true;
  try { a.GEO.ix = JSON.parse(fs.readFileSync(path.join(DATA, 'places', 'index.json'), 'utf8')); } catch (e) { a.GEO.ix = null; }
  api = a; return a;
}
const plain = x => JSON.parse(JSON.stringify(x));
function search(q, limit = 8) {
  const a = load(); q = String(q || '').slice(0, 80);
  return plain(a.searchPlaces(q, Math.max(1, Math.min(12, limit | 0))).map(p => ({ n: p.n, lat: p.lat, lon: p.lon, cc: p.cc, a: p.a, pop: p.pop, country: a.country(p.cc) })));
}
function info(lat, lon) { const a = load(); return plain(a.placeInfoLocal(+lat, +lon)); }
// Country centres for a CDN country header, from the index's per-country boxes.
function guess(tz, cc) {
  const a = load(); const g = plain(a.tzGuess(String(tz || '').slice(0, 64)));
  const ix = a.GEO.ix; cc = String(cc || '').toUpperCase();
  if ((!g.cc || g.cc !== cc) && ix && /^[A-Z]{2}$/.test(cc) && ix.files[cc]) {
    const b = ix.files[cc].bb, span = Math.max(b[2] - b[0], (b[3] - b[1]) * Math.cos((b[0] + b[2]) / 2 * Math.PI / 180), .3);
    return { v: [+((b[0] + b[2]) / 2).toFixed(2), +((b[1] + b[3]) / 2).toFixed(2), +Math.max(3, Math.min(10, Math.log2(360 / span * 1.3))).toFixed(1), cc], cc, from: 'ip' };
  }
  return { v: [g.lat, g.lon, g.z, g.cc], cc: g.cc, from: 'tz' };
}
module.exports = { search, info, guess, load };
