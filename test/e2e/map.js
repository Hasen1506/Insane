#!/usr/bin/env node
// WS-F end to end, Pixel 7 (PLAN §5.a F14 + the picker): what a person in Chennai sees and what the network carries.
//   server mode (real server, temp DB, Protomaps fixture test/fixtures/chetput.pmtiles as the basemap):
//     R-C64 the picker opens over India for Asia/Kolkata · pick by search (towns first) · pick by GPS (mocked) ·
//     pick by pasted coordinates · Others see shows the square, never the pin · zone 1 km² is the default ·
//     R-C81 no town list is downloaded · the exact pin is unreadable by another member (server) ·
//     City: map first (≥55% of the viewport), R-C69 street basemap + attribution, R-C44 no member on the map,
//     List/Map toggle, distance chips, clusters; nothing repaints while idle or off screen ·
//     R-C49 with the basemap blocked: the bundled map and "Street map unavailable"
//   local mode (static app/, as on claude.ai): R-C81 a cold start loads the small index and one country, not 2.7 MB.
'use strict';
const path = require('path');
const BR = require('../lib/browser'), E = require('../lib/e2e');
const R = E.results('F-');
const FIX = path.join(__dirname, '..', 'fixtures', 'chetput.pmtiles');
const CHETPUT = { latitude: 13.0732, longitude: 80.2441, accuracy: 15 };
const IN_BB = [6.5, 68, 35.5, 97.5];

let browser, server;
async function phone(extra = {}) {
  const ctx = await browser.newContext(BR.profile('Pixel 7', { timezoneId: 'Asia/Kolkata', locale: 'en-IN', geolocation: CHETPUT, permissions: ['geolocation'], ...extra }));
  await BR.blockExternal(ctx); await E.actProbe(ctx);
  // the phone layout needs <meta name=viewport> (C01, WS-A); add it until that lands, so the map is measured as on a phone
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { if (!document.querySelector('meta[name=viewport]')) document.head.insertAdjacentHTML('afterbegin', '<meta name="viewport" content="width=device-width, initial-scale=1">'); }));
  // past WS-B's intro and tour (their own flows test them), as the other suites do
  await ctx.addInitScript(() => { try { localStorage.setItem('insane_intro', '1'); localStorage.setItem('insane_tour', 'done'); } catch (e) { } });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  const net = []; page.on('response', async r => { const h = r.headers(); net.push({ url: r.url(), status: r.status(), bytes: +(h['content-length'] || 0) }); });
  return { ctx, page, errors, net };
}
const tap = async (p, sel) => { await E.tapOnce(p, sel); await E.idle(p); };
async function signIn(p, email) {
  await p.goto(server.url);
  if (await p.locator('[data-act="wel-start"]').count()) await tap(p, '[data-act="wel-start"]'); // WS-B's welcome, once merged
  await p.waitForSelector('#si-email'); await p.fill('#si-email', email); await p.locator('button:has-text("Email me a code")').click();
  await p.waitForSelector('#si-code'); await p.fill('#si-code', await E.outboxCode(server.url, email)); // v0.9: six digits submit on their own (C13); tapping Sign in would race it
  await p.waitForSelector('#ob-name', { timeout: 15000 });
}
async function toPlace(p, name) {
  await p.fill('#ob-name', name); if (await p.locator('#ob-age').count()) await p.check('#ob-age'); if (await p.locator('#ob-dobm').count()) { await p.selectOption('#ob-dobm', '6'); await p.selectOption('#ob-doby', '1995'); } /* WS-B (C17) */ if (await p.locator('#ob-consent').count()) await p.check('#ob-consent');
  await tap(p, '[data-act="ob-next"]'); await p.waitForSelector('#lp-q-home');
}
async function finish(p, { create, join }) {
  await tap(p, '[data-act="ob-next"]'); await p.waitForSelector('#ob-cname, #ob-code');
  if (create) { await p.fill('#ob-cname', create); await tap(p, '[data-act="ob-circle"][data-v="create"]'); } else { await p.fill('#ob-code', join); await tap(p, '[data-act="ob-circle"][data-v="join"]'); }
  await p.waitForSelector('#ob-mind'); await tap(p, '[data-act="ob-finish"][data-v="skip"]'); await p.waitForSelector('nav.tabs'); await E.idle(p);
}
const mapState = (p, k) => p.evaluate(k => { const m = MAPS[k]; return m ? { center: m.center, z: m.z, items: (m.spec.items ? m.spec.items() : []).map(i => ({ type: i.type, label: i.label || '', b: i.b, km: i.km, ll: i.ll, drop: i.drop })) } : null; }, k);
const inIN = c => c && c[0] > IN_BB[0] && c[0] < IN_BB[2] && c[1] > IN_BB[1] && c[1] < IN_BB[3];

(async () => {
  server = await E.startServer({ port: +process.env.MAP_PORT || 0, env: { TILE_FILE: FIX } });
  browser = await BR.launch();
  /* ---------- Meera, Pixel 7, Chennai: the picker ---------- */
  const A = await phone(); const p = A.page;
  await signIn(p, 'meera@example.com'); await toPlace(p, 'Meera');
  await E.until(async () => !!(await mapState(p, 'pick-home')), { what: 'picker map' });
  { const m = await mapState(p, 'pick-home'); R.ok('R-C64 the picker opens over India for Asia/Kolkata, at country zoom', inIN(m.center) && m.z >= 3.5 && m.z <= 6, JSON.stringify(m)); }
  R.ok('C65 one primary "Use my location", with the search box beneath it', await p.locator('.lp-gps').count() === 1 && await p.locator('[data-act="lp-paste"]').count() === 0 && (await p.locator('#lp-q-home').getAttribute('placeholder')).includes('India'));
  // search: towns first, with a distance
  await p.fill('#lp-q-home', 'Minjur'); await p.waitForSelector('.res[data-src="search"]');
  { const first = await p.locator('.results > *').first().innerText(); const row = await p.locator('.res').first().innerText(); R.ok('C67 search: "Towns and cities" first, the town (no distance from a country-sized guess)', /towns and cities/i.test(first) && /M[iī]nj[uū]r/.test(row) && !/\d+ km/.test(row), first + ' | ' + row); }
  await tap(p, '.res[data-src="search"]');
  await E.until(() => p.evaluate(() => !!(lpState('home').geo)), { what: 'area from the server' });
  { const st = await p.evaluate(() => { const s = lpState('home'); return { lat: s.lat, src: s.src, area: s.geo.area.name, prec: s.prec, s: s.s }; }); R.ok('picked by search: pin on Minjur, city Chennai (from /api/place), zone 1 km² by default', Math.abs(st.lat - 13.28) < .02 && st.area === 'Chennai' && st.prec === 'zone' && st.s === 1, JSON.stringify(st)); }
  // GPS (mocked)
  await tap(p, '[data-act="lp-gps"]'); await E.textHas(p, 'from GPS');
  { const st = await p.evaluate(() => { const s = lpState('home'); return [s.lat, s.lon, s.acc, s.src]; }); R.ok('picked by GPS: the mocked fix, accuracy shown (±15 m)', Math.abs(st[0] - 13.0732) < 1e-6 && st[3] === 'gps' && (await p.locator('#app').innerText()).includes('±15 m'), JSON.stringify(st)); }
  // pasted coordinates and links go in the same box
  await p.fill('#lp-q-home', 'https://www.google.com/maps/@13.0850,80.2101,15z'); await p.waitForSelector('.res[data-src="link"]');
  await tap(p, '.res[data-src="link"]');
  { const st = await p.evaluate(() => { const s = lpState('home'); return [s.lat, s.lon, s.src]; }); R.ok('C65 a pasted maps link in the search box becomes "This spot"', st[0] === 13.085 && st[1] === 80.2101 && st[2] === 'link', JSON.stringify(st)); }
  await tap(p, '[data-act="lp-gps"]'); await E.textHas(p, 'from GPS');
  // Others see
  await tap(p, '[data-act="lp-view"][data-v="others"]');
  { const m = await mapState(p, 'pick-home'); const cell = await p.evaluate(() => publicCell(lpState('home')));
    R.ok('C66 Others see: the saved square with "near …", no pin, no accuracy ring', !m.items.some(i => i.type === 'pin' || i.type === 'acc') && m.items.some(i => i.type === 'cell' && JSON.stringify(i.b) === JSON.stringify(cell.b) && /^near /.test(i.label)), JSON.stringify(m.items));
    R.ok('C66 Others see says it in words', /Everyone else sees a 1 km² square near/.test(await p.locator('.lpsee').innerText())); }
  await tap(p, '[data-act="lp-prec"][data-v="exact"]'); await tap(p, '[data-act="lp-view"][data-v="you"]');
  { const m = await mapState(p, 'pick-home'); R.ok('C66 Exact, You see: the pin and no square around it', m.items.some(i => i.type === 'pin') && !m.items.some(i => i.type === 'cell'), JSON.stringify(m.items.map(i => i.type))); }
  await finish(p, { create: 'Third Floor' });
  R.ok('R-C81 server mode: no town list (places.tsv or chunks) was downloaded', !A.net.some(r => /\/data\/places(\.tsv|\/)/.test(r.url)), A.net.filter(r => /places/.test(r.url)).map(r => r.url).join(' '));
  const code = await p.evaluate(() => S.circle && S.circle.code);
  /* ---------- Ravi joins the circle; he must never see Meera's pin, nor appear on her map ---------- */
  const B = await phone({ geolocation: { latitude: 13.0800, longitude: 80.2500, accuracy: 20 } }); const q = B.page;
  await signIn(q, 'ravi@example.com'); await toPlace(q, 'Ravi'); await tap(q, '[data-act="lp-gps"]'); await E.textHas(q, 'from GPS'); await finish(q, { join: code });
  { const uid = await p.evaluate(() => S.uid);
    const r = await q.evaluate(async uid => { const x = await fetch('/api/get', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: `data/users/${uid}/loc` }) }); return { status: x.status, body: await x.text() }; }, uid);
    const pub = await q.evaluate(async uid => { const x = await fetch('/api/get', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: `people/${uid}` }) }); return x.json(); }, uid);
    const doc = JSON.stringify(pub);
    R.ok('Meera\'s exact pin is refused to Ravi by the server', r.status >= 400 || !/13\.073|80\.244/.test(r.body), r.status + ' ' + r.body.slice(0, 120));
    // WS-C (C44): a circle-mate gets her square only once she turns on "Show my square to my circle"
    R.ok('her public profile holds no pin anywhere, and no square until she opts in', !/"cell"/.test(doc) && !/13\.0732|80\.2441/.test(doc), doc.slice(0, 300)); }
  /* ---------- City, map first ---------- */
  await E.gone(p, '.toast', { timeout: 8000 }).catch(() => { });
  await tap(p, 'nav [data-v="city"]'); await p.waitForSelector('[data-map="city"] canvas');
  { const h = await p.evaluate(() => [document.querySelector('[data-map="city"]').getBoundingClientRect().height, innerHeight, document.querySelector('[data-map="city"]').getBoundingClientRect().top]);
    R.ok('C43 the City map comes first and takes ≥55% of the screen', h[0] >= .55 * h[1] && h[2] < .4 * h[1], JSON.stringify(h)); }
  await E.until(() => p.evaluate(() => MAPCFG.tilesOk === true), { what: 'basemap tiles', timeout: 15000 });
  R.ok('C69 the street basemap comes from the configured PMTiles file, with attribution', (await p.locator('[data-map="city"] .mapattr').innerText()).includes('OpenStreetMap') && A.net.some(r => /basemap\.pmtiles/.test(r.url) && r.status === 206));
  { const m = await mapState(p, 'city'); const rc = await q.evaluate(() => S.me.cell);
    R.ok('R-C44 no member on the City map: no dot, no name, no other square', !m.items.some(i => i.type === 'dot' || /Ravi/.test(i.label) || (i.type === 'cell' && JSON.stringify(i.b) === JSON.stringify(rc.b))), JSON.stringify(m.items.map(i => i.type + i.label))); }
  R.ok('C68 map controls are 44 px with names', await p.evaluate(() => [...document.querySelectorAll('[data-map="city"] .mapctl button')].every(b => b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44 && b.getAttribute('aria-label'))));
  // drops: three close together cluster; the chips filter; List / Map
  await p.evaluate(async () => { const t = now(); const ref = myRef(); for (const [i, d] of [[1, .004], [2, .0045], [3, .005], [4, .03]].entries()) await S.db.collection('drops').doc().set({ host: S.uid, venue: 'Shop ' + d[0], kind: 'offer', prize: 'chai', lat: ref[0] + d[1], lon: ref[1], g: gOf(ref[0] + d[1], ref[1]), city: S.me.city, start: t - 6e5, end: t + 36e5 * 3, at: t, code: 'ABC234' }); });
  await E.until(async () => (await p.locator('.drop').count()) >= 4, { what: 'four drops listed' });
  await p.evaluate(() => { const m = MAPS.city; m.z = 12; m.center = myRef(); m.redraw(); });
  await E.until(() => p.evaluate(() => (MAPS.city.clusters || []).some(c => c.members.length >= 3)), { what: 'a cluster bubble' });
  R.ok('C43 drops close together cluster into one bubble at low zoom', true);
  { const rows = await p.locator('.drop .meta').allInnerTexts(); const km = rows.map(r => parseFloat((/([\d.]+) (k?m) away/.exec(r) || [])[1]) * (/ m away/.test(r) ? .001 : 1)); R.ok('the list is sorted by distance', km.every((x, i) => i === 0 || km[i - 1] <= x), rows.join(' | ')); }
  await tap(p, '[data-act="city-r"][data-v="2"]');
  { const m = await mapState(p, 'city'); const n = await p.locator('.drop').count(); R.ok('distance chip 2 km: ring 2 km, the far drop gone from list and map', m.items.some(i => i.type === 'radius' && i.km === 2) && n === 3 && m.items.filter(i => i.drop).length === 3, n); }
  await tap(p, '[data-act="city-view"][data-v="list"]');
  R.ok('List view: no map, the list stays', await p.locator('[data-map="city"]').count() === 0 && await p.locator('.drop').count() === 3);
  await tap(p, '[data-act="city-view"][data-v="map"]'); await p.waitForSelector('[data-map="city"] canvas');
  // repaint efficiency: idle with nothing pulsing paints nothing; off screen, an open drop's pulse paints nothing
  await p.evaluate(() => { window.__paints = 0; const P = MapView.prototype.paint; MapView.prototype.paint = function () { window.__paints++; return P.apply(this, arguments); }; });
  await p.evaluate(() => { for (const d of S.drops) d.start = now() + 36e5; render(); }); // nothing open: no pulse
  await E.settled(p); await p.evaluate(() => { window.__paints = 0; }); await p.waitForFunction(() => new Promise(r => setTimeout(() => r(true), 1000)));
  const idle = await p.evaluate(() => window.__paints);
  R.ok('nothing repaints while the map is idle', idle === 0, idle);
  await p.evaluate(() => { for (const d of S.drops) d.start = now() - 6e5; render(); }); await E.settled(p);
  await p.evaluate(() => { window.__paints = 0; }); await p.waitForFunction(() => new Promise(r => setTimeout(() => r(true), 1000)));
  const hot = await p.evaluate(() => window.__paints);
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await E.settled(p); await p.waitForFunction(() => new Promise(r => setTimeout(() => r(true), 300)));
  await p.evaluate(() => { window.__paints = 0; }); await p.waitForFunction(() => new Promise(r => setTimeout(() => r(true), 1000)));
  const off = await p.evaluate(() => window.__paints);
  R.ok(`an open drop pulses at ≤15 fps while visible (${hot}/s), and not at all off screen (${off}/s)`, hot > 0 && hot <= 16 && off === 0, hot + ' ' + off);
  await p.evaluate(() => scrollTo(0, 0));
  R.ok('no script errors (Meera, Ravi)', !A.errors.length && !B.errors.length, [...A.errors, ...B.errors].join(' | '));
  /* ---------- the basemap blocked: bundled map and an honest note ---------- */
  const C = await phone(); await C.ctx.route(/basemap\.pmtiles/, r => r.abort('failed')); const c = C.page;
  await signIn(c, 'kavya@example.com'); await toPlace(c, 'Kavya'); await tap(c, '[data-act="lp-gps"]'); await E.textHas(c, 'from GPS');
  await E.until(async () => (await c.locator('[data-map="pick-home"] .mapnote').isVisible()), { what: 'tile failure note', timeout: 15000 });
  R.ok('R-C49 basemap blocked: "Street map unavailable", the bundled map underneath', /Street map unavailable/.test(await c.locator('[data-map="pick-home"] .mapnote').innerText()) && await c.evaluate(() => MAPCFG.tilesOk === false));
  await C.ctx.close(); await A.ctx.close(); await B.ctx.close();
  /* ---------- local mode (the artifact): a cold start loads the index and one country ---------- */
  const st = await E.serveStatic({ port: 0 });
  const L = await phone(); const l = L.page;
  await l.goto(st.url + '/?as=meera'); await l.waitForSelector('#ob-name'); await toPlace(l, 'Meera');
  await l.fill('#lp-q-home', 'Chennai'); await l.waitForSelector('.res'); await tap(l, '.res');
  await E.until(() => l.evaluate(() => !!lpState('home').geo), { what: 'local area' });
  const urls = L.net.filter(r => /\/data\/places/.test(r.url)).map(r => r.url.replace(st.url, ''));
  const kb = (await l.evaluate(() => performance.getEntriesByType('resource').filter(e => /\/data\/places/.test(e.name)).reduce((a, e) => a + (e.encodedBodySize || e.transferSize || 0), 0))) / 1024;
  R.ok(`R-C81 local cold start: index + India + the big-city list (${urls.length} files, ${kb.toFixed(0)} KB), never places.tsv`, !urls.some(u => /places\.tsv/.test(u)) && urls.some(u => /index\.json/.test(u)) && urls.some(u => /\/IN\.[0-9a-f]{10}\.tsv/.test(u)) && kb < 700, urls.join(' '));
  R.ok('local mode: the city is Chennai', (await l.evaluate(() => lpState('home').geo.area.name)) === 'Chennai');
  await L.ctx.close(); await st.close();
  await browser.close(); await server.close();
  console.log(R.list.map(r => r.join('  ')).join('\n'));
  console.log(`\n${R.passed()}/${R.list.length} passed`);
  process.exit(R.passed() === R.list.length ? 0 : 1);
})().catch(async e => { console.error(e); try { await browser.close(); } catch (x) { } try { await server.close(); } catch (x) { } console.log(R.list.map(r => r.join('  ')).join('\n')); process.exit(1); });
