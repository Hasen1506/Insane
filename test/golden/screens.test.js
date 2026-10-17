// Golden screens (PLAN-V09 §5.d): the same ten-plus screens, driven the same way with a frozen start
// clock and seeded randomness, compared with the DOM and pixel goldens in test/golden/ (GOLDEN_UPDATE=1
// rewrites them after a reviewed change). Local mode (the claude.ai store), Pixel 7 and iPhone 13.
// WS-0 proved these screens identical to v0.8 (fac3720) at 888f1fd. Since WS-A (C01: the viewport meta)
// phones lay out at their real width, so v0.8 is no longer a pixel reference; GOLDEN_V08=1 still drives
// v0.8 alongside and reports how far each screen has moved from it, without failing.
'use strict';
const fs = require('fs'), path = require('path');
const BR = require('../lib/browser'), E = require('../lib/e2e'), GD = require('../lib/golden');
const { v08Dir } = require('../lib/load');

const T0 = Date.UTC(2026, 9, 12, 3, 30); // Mon 12 Oct 2026, 09:00 in Chennai
const PROFILES = (process.env.GOLDEN_PROFILE || 'Pixel 7,iPhone 13').split(',').map(s => s.trim());

let GPORT = +process.env.GOLDEN_PORT || 0;
const goldenPort = async () => GPORT || (GPORT = await E.freePort());
async function screens(browser, file, PROFILE) {
  const srv = await E.serveStatic({ file, port: await goldenPort() }); // same origin every run (links carry it): one free port per process
  const ctx = await browser.newContext(BR.profile(PROFILE, { timezoneId: 'Asia/Kolkata', locale: 'en-GB', colorScheme: 'light', reducedMotion: 'reduce' }));
  await BR.blockExternal(ctx); await GD.seedRandom(ctx, 9);
  // WS-B's welcome, intro and tour have their own goldens (firstrun.test.js); these screens start past them
  await ctx.addInitScript(() => { try { localStorage.setItem('insane_intro', '1'); localStorage.setItem('insane_tour', 'done'); } catch (e) { } });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: T0 });
  const out = [];
  const snap = async name => { await E.gone(page, '.toast', { timeout: 6000 }); /* toasts run on a wall-clock timer, so wait them out */ await E.stable(page, 'body'); out.push({ name, dom: await GD.domSnapshot(page, 'body'), img: await GD.pixelShot(page) }); };
  const tap = async sel => { await page.locator(sel).first().click(); await E.settled(page); };
  await page.goto(srv.url + '/?as=meera'); await page.waitForSelector('#ob-name'); await GD.freeze(page);
  await snap('ob-1-name');
  await page.fill('#ob-name', 'Meera');
  if (await page.locator('#ob-age').count()) await page.check('#ob-age'); // v0.8
  else { await page.selectOption('#ob-dobm', '6'); await page.selectOption('#ob-doby', '1999'); await E.settled(page); } // v0.9 (C17)
  if (await page.locator('#ob-consent').count()) await page.check('#ob-consent'); // v0.9 WS-D (C63)
  await tap('[data-act="ob-next"]');
  await page.waitForSelector('#lp-q-home'); await page.fill('#lp-q-home', 'Chennai'); await page.waitForSelector('.res'); await tap('.res');
  if (await page.locator('[data-act="lp-paste"]').count()) { await tap('[data-act="lp-paste"]'); await page.waitForSelector('#lp-p-home'); await page.fill('#lp-p-home', '13.2790, 80.2619'); await tap('form[data-form="lp-use"] button'); } // v0.8
  else { await page.fill('#lp-q-home', '13.2790, 80.2619'); await page.waitForSelector('.res[data-src="link"]'); await tap('.res[data-src="link"]'); } // WS-F (C65): links go in the search box
  await E.until(async () => (await page.locator('[data-act="lp-size"]').count()) > 0, { what: 'precision chips' });
  await tap('[data-act="lp-size"][data-v="2"]'); await tap('[data-act="lp-radius"][data-v="5"]');
  await snap('ob-2-place');
  await tap('[data-act="ob-next"]'); await page.waitForSelector('#ob-cname'); await page.fill('#ob-cname', 'Third Floor');
  await snap('ob-3-circle');
  await tap('[data-act="ob-circle"][data-v="create"]'); await page.waitForSelector('#ob-mind');
  await tap('[data-act="ob-lane"][data-v="need"]'); await page.fill('#ob-mind', 'run 3 times a week'); await tap('[data-act="ob-stake"][data-v="1"]');
  await snap('ob-4-mind');
  await tap('[data-act="ob-finish"][data-v="mind"]'); await page.waitForSelector('nav.tabs');
  await snap('home');
  for (const t of ['circle', 'city', 'ledger', 'you']) { await tap(`[data-act="tab"][data-v="${t}"]`); await E.until(async () => (await page.locator(`[data-act="tab"][data-v="${t}"].on`).count()) === 1, { what: t + ' tab' }); await snap('tab-' + t); }
  await tap('[data-act="make"]'); await page.waitForSelector('.sheet'); await snap('sheet-make');
  await page.keyboard.press('Escape'); await E.gone(page, '.sheet');
  await page.evaluate(() => openSheet('invite')); await page.waitForSelector('.sheet'); await snap('sheet-invite');
  await ctx.close(); await srv.close();
  return { out, errors };
}

module.exports = async function (t) {
  const browser = await BR.launch();
  try {
    const helper = await browser.newPage();
    for (const PROFILE of PROFILES) {
      const dir = `ws0/${PROFILE.replace(/\s/g, '')}`, P = PROFILE + ': ';
      const v09 = await screens(browser, E.APP(), PROFILE);
      t.ok(P + 'drove all 11 screens', v09.out.length === 11, v09.out.map(s => s.name).join(','));
      t.ok(P + 'no script errors', !v09.errors.length, v09.errors.join(' | '));
      const v08 = process.env.GOLDEN_V08 ? await screens(browser, path.join(v08Dir(), 'app', 'index.html'), PROFILE) : null;
      for (let i = 0; i < v09.out.length; i++) {
        const b = v09.out[i];
        const g = GD.matchDom(`${dir}/${b.name}`, b.dom); t.ok(P + `${b.name}: DOM golden ${g.created ? 'written' : 'matches'}`, g.ok, g.diff);
        const p = await GD.matchPixels(helper, `${dir}/${b.name}`, b.img); t.ok(P + `${b.name}: pixel golden ${p.created ? 'written' : 'matches (' + (p.ratio * 100).toFixed(3) + '%)'}`, p.ok);
        if (v08) console.log(`  ${P}${b.name}: ${v08.out[i].dom === b.dom ? 'DOM same as v0.8' : 'DOM differs from v0.8'}, ${((await GD.pixelDiff(helper, v08.out[i].img, b.img)) * 100).toFixed(1)}% pixels differ`);
      }
      // the snapshot helper must actually see a difference when there is one
      const home = v09.out.find(s => s.name === 'home').dom;
      t.ok(P + 'DOM snapshot detects a one-word change', home.replace('Third Floor', 'Fourth Floor') !== home);
      t.ok(P + 'pixel diff detects a different screen', (await GD.pixelDiff(helper, v09.out[0].img, v09.out[4].img)) > 0.01);
    }
  } finally { await browser.close(); }
};
