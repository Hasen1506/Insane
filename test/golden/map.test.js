// WS-F goldens: the place picker and the City map on Pixel 7, light and dark (DOM + pixels, test/golden/*/ws-f/).
// Local mode (bundled world map, no third-party tiles), frozen clock, seeded randomness, Chennai.
// The phone viewport meta is added by the test until WS-A's C01 lands, so these are the real phone layout.
'use strict';
const BR = require('../lib/browser'), E = require('../lib/e2e'), GD = require('../lib/golden');
const T0 = Date.UTC(2026, 9, 12, 3, 30); // Mon 12 Oct 2026, 09:00 in Chennai

async function run(browser, scheme) {
  const srv = await E.serveStatic({ port: 0 });
  const ctx = await browser.newContext(BR.profile('Pixel 7', { timezoneId: 'Asia/Kolkata', locale: 'en-GB', colorScheme: scheme, reducedMotion: 'reduce' }));
  await BR.blockExternal(ctx); await GD.seedRandom(ctx, 11); await E.actProbe(ctx);
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { if (!document.querySelector('meta[name=viewport]')) document.head.insertAdjacentHTML('afterbegin', '<meta name="viewport" content="width=device-width, initial-scale=1">'); }));
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: T0 });
  const out = [];
  const quiet = () => page.evaluate(() => new Promise(r => { const t0 = performance.now(); (function f() { const busy = Object.values(MAPS).some(m => m.q || m.dirty && m.vis); if (!busy && performance.now() - t0 > 300) r(); else requestAnimationFrame(f); })(); }));
  const snap = async name => { await E.gone(page, '.toast', { timeout: 8000 }); await E.stable(page, 'body'); await quiet(); out.push({ name, dom: await GD.domSnapshot(page, 'body'), img: await GD.pixelShot(page) }); };
  const tap = async sel => { await page.locator(sel).first().click(); await E.idle(page); };
  await page.goto(srv.url + '/?as=meera'); await page.waitForSelector('#ob-name'); await GD.freeze(page);
  await page.fill('#ob-name', 'Meera'); await page.selectOption('#ob-dobm', '6'); await page.selectOption('#ob-doby', '1999'); await E.settled(page); if (await page.locator('#ob-consent').count()) await page.check('#ob-consent'); /* WS-B C17 + WS-D C63 */ await tap('[data-act="ob-next"]');
  await page.waitForSelector('#lp-q-home'); await E.until(() => page.evaluate(() => !!(GEO.places && GEO.places.length)), { what: 'places' });
  await snap('picker-open');
  await page.fill('#lp-q-home', 'Chennai'); await page.waitForSelector('.res'); await snap('picker-search');
  await page.fill('#lp-q-home', '13.0732, 80.2441'); await page.waitForSelector('.res[data-src="link"]'); await tap('.res[data-src="link"]');
  await E.until(() => page.evaluate(() => !!lpState('home').geo), { what: 'area' });
  await snap('picker-you');
  await tap('[data-act="lp-view"][data-v="others"]'); await snap('picker-others');
  await tap('[data-act="lp-view"][data-v="you"]');
  await tap('[data-act="ob-next"]'); await page.waitForSelector('#ob-cname'); await page.fill('#ob-cname', 'Third Floor'); await tap('[data-act="ob-circle"][data-v="create"]');
  await page.waitForSelector('#ob-mind'); await tap('[data-act="ob-finish"][data-v="skip"]'); await page.waitForSelector('nav.tabs');
  await tap('[data-act="tab"][data-v="city"]'); await page.waitForSelector('[data-map="city"] canvas');
  await snap('city-map');
  await tap('[data-act="city-view"][data-v="list"]'); await snap('city-list'); await tap('[data-act="city-view"][data-v="map"]');
  await tap('[data-act="sheet"][data-v="trail-new"]'); await page.fill('#tr-title', 'The Marina Walk'); await tap('[data-act="tr-step"][data-v="2"]'); await page.waitForSelector('[data-map="pick-drop"] canvas');
  await snap('trail-step2');
  await ctx.close(); await srv.close();
  return { out, errors };
}

module.exports = async function (t) {
  const browser = await BR.launch();
  try {
    for (const scheme of ['light', 'dark']) {
      const r = await run(browser, scheme);
      t.ok(`${scheme}: no script errors`, !r.errors.length, r.errors.join(' | '));
      const helper = await browser.newPage();
      for (const s of r.out) {
        const g = GD.matchDom(`ws-f/Pixel7-${scheme}/${s.name}`, s.dom); t.ok(`${scheme} ${s.name}: DOM golden ${g.created ? 'written' : 'matches'}`, g.ok, g.diff);
        const p = await GD.matchPixels(helper, `ws-f/Pixel7-${scheme}/${s.name}`, s.img, { tolerance: 0.004 }); t.ok(`${scheme} ${s.name}: pixel golden ${p.created ? 'written' : 'matches (' + (p.ratio * 100).toFixed(3) + '%)'}`, p.ok);
      }
      await helper.close();
    }
  } finally { await browser.close(); }
};
