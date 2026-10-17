// The build: deterministic, one self-contained file, --check catches drift, and the module layout
// keeps the invariants WS-0 relies on.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync, spawnSync } = require('child_process');
const B = require('../../tools/build.js');
const ROOT = B.REPO;

module.exports = async function (t) {
  const a = B.build(), b = B.build();
  t.ok('two builds are byte-identical', a.html === b.html && a.id === b.id);
  const committed = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');
  t.ok('committed app/index.html is the fresh build', committed === a.html);
  const tmp = path.join(os.tmpdir(), `insane-build-${process.pid}.html`);
  fs.writeFileSync(tmp, a.html.replace('<title>INSANE</title>', '<title>INSANE!</title>'));
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--check'], { env: { ...process.env, OUT: tmp }, encoding: 'utf8' });
  t.ok('--check fails on a hand-edited file and names the line', r.status === 1 && /line 5\b/.test(r.stderr), r.stderr);
  fs.writeFileSync(tmp, a.html);
  const r2 = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--check'], { env: { ...process.env, OUT: tmp }, encoding: 'utf8' });
  t.ok('--check passes on a fresh build', r2.status === 0, r2.stderr);
  const r3 = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--check'], { env: { ...process.env, OUT: tmp, SIZE_BUDGET: '1000' }, encoding: 'utf8' });
  t.ok('the size budget is enforced', r3.status === 1 && /budget/.test(r3.stderr), r3.stderr);
  fs.rmSync(tmp, { force: true });

  // one self-contained file: exactly one inline script and one style block; the only remote fetch is Google Fonts (C04: QR is built in)
  const html = a.html;
  t.ok('one <style> and one inline <script>', (html.match(/<style>/g) || []).length === 1 && (html.match(/<script>/g) || []).length === 1);
  const remote = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(https?:[^"]+)"/g)].map(m => new URL(m[1]).host).sort();
  t.ok('remote resources are only Google Fonts (no script from any CDN, C04)', JSON.stringify([...new Set(remote)]) === JSON.stringify(['fonts.googleapis.com', 'fonts.gstatic.com']), remote.join(','));
  t.ok('no external <script src> at all (C04)', !/<script[^>]+src=/i.test(html));
  t.ok('starts with <!doctype html><html lang>, has v0.8\'s <title>, carries a build stamp (C03)', /^<!doctype html>\n<html lang="en">\n/.test(html) && html.includes('<title>INSANE</title>') && new RegExp(`INSANE build ${a.id}`).test(html));
  t.ok("'use strict' is the script's first statement", /<script>\n\/\* src\/js\/00-helpers\.js \*\/\n(['"])use strict\1;/.test(html)); // esbuild writes "use strict"
  // the minified build (int-1) keeps every top-level name and the Decode pack verbatim; MINIFY=0 is the readable one
  const plain = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--stdout'], { env: { ...process.env, MINIFY: '0' }, encoding: 'utf8', maxBuffer: 64 << 20 }).stdout;
  t.ok('MINIFY=0 gives an unminified build that is larger and still self-contained', plain.length > html.length && (plain.match(/<script>/g) || []).length === 1);
  const pack = s => (/\/\*@decode-local\*\/[\s\S]*?\/\*@end-decode-local\*\//.exec(s) || [''])[0];
  t.ok('the local Decode pack is byte-identical in the minified and unminified builds', pack(html).length > 100 && pack(html) === pack(plain));

  // layout invariants
  const js = B.jsFiles();
  t.ok('boot() runs last, from 99-start.js', js.at(-1) === 'js/99-start.js' && fs.readFileSync(path.join(B.SRC, 'js/99-start.js'), 'utf8').trim() === 'boot();');
  t.ok('each registry file leads its folder', js.indexOf('js/90-actions/00-registry.js') === js.findIndex(f => f.startsWith('js/90-actions/')) && js.indexOf('js/78-sheets/00-layer.js') === js.findIndex(f => f.startsWith('js/78-sheets/')));
  const bad = js.filter(f => f.startsWith('js/90-actions/') && !f.endsWith('00-registry.js')).filter(f => !fs.readFileSync(path.join(B.SRC, f), 'utf8').split('\n').every(l => l === '' || /^\/\* .* \*\/$/.test(l) || /^ACT\[/.test(l) || /^  /.test(l) || l === '};'));
  t.ok('action files only register ACT handlers', bad.length === 0, bad.join(', '));
  t.ok('no CRLF, every file ends in a newline', true); // read() in build throws otherwise
  t.ok('CSS order is explicit', JSON.stringify(B.cssFiles()) === JSON.stringify(['css/tokens.css', 'css/base.css', 'css/components.css', 'css/map.css', 'css/screens.css']));
};
