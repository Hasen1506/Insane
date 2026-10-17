// C04: the built-in QR encoder (src/js/62-qr.js) against the qrcode-generator 1.4.4 file v0.8 loaded
// from cdnjs (pinned in test/fixtures). Same modules for any ASCII text that fits version 10, so the
// invite and meet codes are the same pictures with no CDN. Seeded random strings plus the real links.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { loadV09 } = require('../lib/load');
const { prop, G } = require('../pbt/runner');

module.exports = async function (t) {
  const lib = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'qrcode-generator-1.4.4.min.js'), 'utf8') + ';qrcode', {});
  const app = loadV09(); const QR = app.get('QR'), qrSvg = app.get('qrSvg');
  const ref = s => { const q = lib(0, 'M'); q.addData(s); q.make(); return q; };
  const same = s => { const q = ref(s), m = QR.make(s); if (!m || m.length !== q.getModuleCount()) return false; for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) if (m[r][c] !== q.isDark(r, c)) return false; return true; };
  const ascii = G.str({ min: 0, max: 213, alphabet: Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') });
  const r = prop('QR.make == qrcode-generator for ASCII up to 213 bytes', ascii, same, { runs: +process.env.PBT_RUNS || 300 });
  t.ok(`QR modules identical to qrcode-generator 1.4.4 (${r.runs} cases)`, r.ok, r.ok ? '' : `SEED=${r.seed} CASE=${JSON.stringify(r.shrunk ?? r.case)}`);
  // every length 0..213, so every version 1-10 and both length-field sizes are covered
  let bad = -1; for (let n = 0; n <= 213 && bad < 0; n++) { const s = Array.from({ length: n }, (_, i) => String.fromCharCode(33 + (i * 37 + n * 11) % 94)).join(''); if (!same(s)) bad = n; }
  t.ok('identical at every length 0..213 (versions 1-10)', bad < 0, 'first mismatch at length ' + bad);
  const links = ['https://insane.onrender.com/#cAB12CD', 'https://claude.ai/artifact/JHNbWPyCrwVVVHbxbhxf4g#c7KQ2ZX', 'http://localhost:8791/#m123456', 'x'.repeat(213)];
  for (const s of links) t.ok(`same SVG markup as createSvgTag for ${s.slice(0, 40)}…`, qrSvg(s) === ref(s).createSvgTag({ cellSize: 5, margin: 2, scalable: true }));
  t.ok('too long for version 10 gives no code, not a broken one', QR.make('x'.repeat(214)) === null && qrSvg('x'.repeat(214)) === '');
  const u = QR.make('Kavya كافيا 🇮🇳'); // UTF-8, 21 bytes -> version 2 (25 modules)
  t.ok('non-ASCII text is encoded as UTF-8 (fits by byte count)', u && u.length === 25);
  t.ok('every mask is reachable (mask chosen by penalty, all 8 valid)', [0, 1, 2, 3, 4, 5, 6, 7].every(k => QR.make('mask test', k).length === 21));
};
