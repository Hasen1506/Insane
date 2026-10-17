// C02: installable. The manifest is valid and linked, every icon it or the head names exists with the
// size it claims (PNG header), there is a maskable icon and a 180 px apple-touch-icon (served 200 is
// checked in test/e2e/shell.e2e.js). C03: doctype and lang. C01: the viewport meta.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..'), PUB = path.join(ROOT, 'server', 'public');
const png = f => { const b = fs.readFileSync(f); return b.slice(1, 4).toString() === 'PNG' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20), alpha: b[25] === 6 } : null; };

module.exports = async function (t) {
  let m = null; try { m = JSON.parse(fs.readFileSync(path.join(PUB, 'manifest.webmanifest'), 'utf8')); } catch (e) { }
  t.ok('manifest is valid JSON', !!m);
  if (!m) return;
  t.ok('manifest has name, short_name, start_url, scope, display standalone, colours', m.name && m.short_name && m.start_url === '/' && m.scope === '/' && m.display === 'standalone' && /^#[0-9A-F]{6}$/i.test(m.theme_color) && /^#[0-9A-F]{6}$/i.test(m.background_color));
  for (const i of m.icons) {
    const f = path.join(PUB, i.src.replace(/^\//, ''));
    if (!fs.existsSync(f)) { t.ok(`icon ${i.src} exists`, false); continue; }
    if (i.type === 'image/png') { const p = png(f), [w, h] = i.sizes.split('x').map(Number); t.ok(`icon ${i.src} is a ${i.sizes} PNG`, p && p.w === w && p.h === h, JSON.stringify(p)); }
    else t.ok(`icon ${i.src} exists`, true);
  }
  const has = (sz, purpose) => m.icons.some(i => i.type === 'image/png' && i.sizes === sz && (i.purpose || 'any').split(' ').includes(purpose));
  t.ok('PNG 192 and 512 "any" icons, and a 512 maskable one (Chrome install criteria)', has('192x192', 'any') && has('512x512', 'any') && has('512x512', 'maskable'));
  const ati = png(path.join(PUB, 'apple-touch-icon.png'));
  t.ok('apple-touch-icon.png is 180x180 (iOS Home Screen)', ati && ati.w === 180 && ati.h === 180);
  const mask = png(path.join(PUB, 'icon-maskable-512.png'));
  t.ok('maskable and apple-touch icons are opaque (full bleed)', mask && !mask.alpha && !ati.alpha);

  const html = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');
  t.ok('starts with <!doctype html> and <html lang="en"> (C03)', /^<!doctype html>\s*<html lang="en">/i.test(html));
  t.ok('viewport meta: device width, scale 1, viewport-fit=cover (C01)', /<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover(,interactive-widget=resizes-content)?">/.test(html));
  t.ok('manifest, apple-touch-icon and theme-color (light + dark) are linked (C02)', /<link rel="manifest" href="\/manifest\.webmanifest">/.test(html) && /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/.test(html) && (html.match(/<meta name="theme-color"/g) || []).length === 2 && /apple-mobile-web-app-capable/.test(html));
  const linked = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon|manifest)" href="\/([^"]+)"/g)].map(x => x[1]);
  t.ok('every icon the head links is in server/public', linked.every(f => fs.existsSync(path.join(PUB, f))), linked.join(','));
  // that the server answers 200 for each is checked over HTTP in test/e2e/shell.e2e.js
};
