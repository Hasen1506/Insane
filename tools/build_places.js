#!/usr/bin/env node
// Splits app/data/places.tsv (every town of 5,000+, 2.7 MB) into what a phone actually needs (C81):
//   app/data/places/index.json        small, revalidated: version, file per country, bounding boxes, country names,
//                                     and the timezone -> first map view table (C64)
//   app/data/places/<CC>.<hash>.tsv   one per country, content-hashed so it can be cached forever (immutable)
//   app/data/places/big.<hash>.tsv    every place of 100,000+ worldwide, so search finds other countries' cities
// Each chunk keeps places.tsv's format (line 1: #CC=Name, line 2: #admin list, then rows sorted by population),
// so the client parses chunks with the same code and merges them by population.
//   node tools/build_places.js [--check]
// The timezone table comes from the system tzdata (zone.tab and tzdata.zi links); --check rebuilds in memory
// and fails if the committed files differ.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..');
const SRC = path.join(REPO, 'app', 'data', 'places.tsv');
const OUT = path.join(REPO, 'app', 'data', 'places');
const ZONE = process.env.ZONE_TAB || '/usr/share/zoneinfo/zone.tab';
const ZI = process.env.TZDATA_ZI || '/usr/share/zoneinfo/tzdata.zi';
const BIG = 300000;

function build() {
  const L = fs.readFileSync(SRC, 'utf8').split('\n');
  const ccName = Object.fromEntries(L[0].slice(1).split('|').map(x => x.split('=')));
  const adm = L[1].slice(1).split('|');
  const by = {}, big = [];
  for (let i = 2; i < L.length; i++) {
    const p = L[i].split('\t'); if (p.length < 6) continue;
    (by[p[3]] = by[p[3]] || []).push(p);
    if (+p[5] >= BIG) big.push(p);
  }
  const files = {}, out = {};
  const chunk = (rows) => {
    const ccs = [...new Set(rows.map(p => p[3]))].sort();
    const admins = [...new Set(rows.map(p => p[4] === '' ? null : adm[+p[4]]).filter(x => x != null))].sort();
    const ai = new Map(admins.map((a, i) => [a, i]));
    const body = '#' + ccs.map(c => c + '=' + (ccName[c] || c)).join('|') + '\n#' + admins.join('|') + '\n' +
      rows.map(p => [p[0], p[1], p[2], p[3], p[4] === '' ? '' : ai.get(adm[+p[4]]), p[5]].join('\t')).join('\n') + '\n';
    return body;
  };
  const put = (key, body) => { const h = crypto.createHash('sha256').update(body).digest('hex').slice(0, 10); const f = `${key}.${h}.tsv`; out[f] = body; return { f, h, bytes: Buffer.byteLength(body) }; };
  for (const cc of Object.keys(by).sort()) {
    const rows = by[cc]; let a = 90, b = 180, c = -90, d = -180;
    for (const p of rows) { a = Math.min(a, +p[1]); b = Math.min(b, +p[2]); c = Math.max(c, +p[1]); d = Math.max(d, +p[2]); }
    const r = put(cc, chunk(rows));
    files[cc] = { f: r.f, n: rows.length, kb: Math.round(r.bytes / 1024), bb: [a, b, c, d] };
  }
  const bigR = put('big', chunk(big));
  const index = { v: 1, src: crypto.createHash('sha256').update(fs.readFileSync(SRC)).digest('hex').slice(0, 10), big: bigR.f, bigN: big.length, files, tz: tzTable(by) };
  out['index.json'] = JSON.stringify(index) + '\n';
  return out;
}

// Timezone -> [lat, lon, zoom] for the picker's first view. A country with one zone (and not huge) is framed whole;
// otherwise the zone's own city at zoom 5.
function tzTable(by) {
  if (!fs.existsSync(ZONE)) throw new Error('no ' + ZONE + ' (set ZONE_TAB)');
  const rows = fs.readFileSync(ZONE, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split('\t'));
  const nz = {}; for (const r of rows) nz[r[0]] = (nz[r[0]] || 0) + 1;
  const coord = s => { const m = /^([+-])(\d{2})(\d{2})(\d{2})?([+-])(\d{3})(\d{2})(\d{2})?$/.exec(s); const la = +m[2] + m[3] / 60, lo = +m[6] + m[7] / 60; return [m[1] === '+' ? la : -la, m[5] === '+' ? lo : -lo]; };
  const q = (a, f) => a[Math.min(a.length - 1, Math.floor(f * a.length))];
  const out = {};
  for (const [cc, c, tz] of rows) {
    const [la, lo] = coord(c); const pts = by[cc] || [];
    let v = [la, lo, 5];
    if (pts.length && nz[cc] === 1) {
      const lat = pts.map(p => +p[1]).sort((x, y) => x - y), lon = pts.map(p => +p[2]).sort((x, y) => x - y);
      const b = [q(lat, .02), q(lon, .02), q(lat, .98), q(lon, .98)];
      const cl = (b[0] + b[2]) / 2, cn = (b[1] + b[3]) / 2, span = Math.max(b[2] - b[0], (b[3] - b[1]) * Math.cos(cl * Math.PI / 180), .3);
      if (b[2] - b[0] < 30 && b[3] - b[1] < 40) v = [cl, cn, Math.max(3, Math.min(10, Math.log2(360 / span * 1.3)))];
    }
    out[tz] = [+v[0].toFixed(2), +v[1].toFixed(2), +v[2].toFixed(1), cc];
  }
  if (fs.existsSync(ZI)) for (const l of fs.readFileSync(ZI, 'utf8').split('\n')) { const m = /^L (\S+) (\S+)$/.exec(l); if (m && out[m[1]] && !out[m[2]] && m[2].includes('/')) out[m[2]] = out[m[1]]; }
  return Object.fromEntries(Object.entries(out).sort());
}

if (require.main === module) {
  const out = build();
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(OUT) ? fs.readdirSync(OUT).sort() : [];
    const want = Object.keys(out).sort();
    const bad = JSON.stringify(have) !== JSON.stringify(want) || want.some(f => fs.readFileSync(path.join(OUT, f), 'utf8') !== out[f]);
    if (bad) { console.error('build_places: app/data/places/ is stale; run node tools/build_places.js'); process.exit(1); }
    console.log('build_places: up to date (' + want.length + ' files)');
  } else {
    fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
    for (const [f, b] of Object.entries(out)) fs.writeFileSync(path.join(OUT, f), b);
    const ix = JSON.parse(out['index.json']);
    console.log(`build_places: ${Object.keys(ix.files).length} countries, big list ${ix.bigN} places, index ${(Buffer.byteLength(out['index.json']) / 1024).toFixed(1)} KB, IN ${ix.files.IN.kb} KB, ${Object.keys(ix.tz).length} timezones`);
  }
}
module.exports = { build };
