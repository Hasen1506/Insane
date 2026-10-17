// WS-0 acceptance (PLAN-V09 §2): the same ten-plus screens, driven the same way with a frozen start
// clock and seeded randomness, give an identical DOM snapshot and the same pixels in v0.8 (fac3720)
// and in the built v0.9 app/index.html. The v0.9 snapshots are also kept as goldens for later work.
// Local mode (the claude.ai store), Pixel 7 profile.
'use strict';
const fs = require('fs'), path = require('path');
const BR = require('../lib/browser'), E = require('../lib/e2e'), GD = require('../lib/golden');
const { v08Dir } = require('../lib/load');

const T0 = Date.UTC(2026, 9, 12, 3, 30); // Mon 12 Oct 2026, 09:00 in Chennai
const PROFILE = process.env.GOLDEN_PROFILE || 'Pixel 7';

async function screens(browser, file) {
  const srv = await E.serveStatic({ file, port: +process.env.GOLDEN_PORT || 8777 }); // same origin both runs: links carry it
  const ctx = await browser.newContext(BR.profile(PROFILE, { timezoneId: 'Asia/Kolkata', locale: 'en-GB', colorScheme: 'light', reducedMotion: 'reduce' }));
  await BR.blockExternal(ctx); await GD.seedRandom(ctx, 9);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: T0 });
  const out = [];
  const snap = async name => { await E.gone(page, '.toast', { timeout: 6000 }); /* toasts run on a wall-clock timer, so wait them out */ await E.stable(page, 'body'); out.push({ name, dom: await GD.domSnapshot(page, 'body'), img: await GD.pixelShot(page) }); };
  const tap = async sel => { await page.locator(sel).first().click(); await E.settled(page); };
  await page.goto(srv.url + '/?as=meera'); await page.waitForSelector('#ob-name'); await GD.freeze(page);
  await snap('ob-1-name');
  await page.fill('#ob-name', 'Meera'); await page.check('#ob-age'); if (await page.locator('#ob-consent').count()) await page.check('#ob-consent'); /* v0.9 WS-D (C63) */ await tap('[data-act="ob-next"]');
  await page.waitForSelector('#lp-q-home'); await page.fill('#lp-q-home', 'Chennai'); await page.waitForSelector('.res'); await tap('.res');
  await tap('[data-act="lp-paste"]'); await page.waitForSelector('#lp-p-home'); await page.fill('#lp-p-home', '13.2790, 80.2619'); await tap('form[data-form="lp-use"] button');
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
    const v08 = await screens(browser, path.join(v08Dir(), 'app', 'index.html'));
    const v09 = await screens(browser, E.APP());
    t.ok('both runs drove the same screens', JSON.stringify(v08.out.map(s => s.name)) === JSON.stringify(v09.out.map(s => s.name)), v09.out.map(s => s.name).join(','));
    t.ok('no script errors in either', !v08.errors.length && !v09.errors.length, [...v08.errors, ...v09.errors].join(' | '));
    const helper = await browser.newPage();
    for (let i = 0; i < v09.out.length; i++) {
      const a = v08.out[i], b = v09.out[i];
      t.ok(`${b.name}: DOM identical to v0.8`, a.dom === b.dom, a.dom === b.dom ? '' : GD.lineDiff(a.dom, b.dom));
      const r = await GD.pixelDiff(helper, a.img, b.img);
      t.ok(`${b.name}: pixels match v0.8 (${(r * 100).toFixed(3)}% differ, tolerance 0.1%)`, r <= 0.001);
      const g = GD.matchDom(`ws0/${PROFILE.replace(/\s/g, '')}/${b.name}`, b.dom); t.ok(`${b.name}: DOM golden ${g.created ? 'written' : 'matches'}`, g.ok, g.diff);
      const p = await GD.matchPixels(helper, `ws0/${PROFILE.replace(/\s/g, '')}/${b.name}`, b.img); t.ok(`${b.name}: pixel golden ${p.created ? 'written' : 'matches (' + (p.ratio * 100).toFixed(3) + '%)'}`, p.ok);
    }
    // the snapshot helper must actually see a difference when there is one
    const tweak = v09.out.find(s => s.name === 'home').dom.replace('Third Floor', 'Fourth Floor');
    t.ok('DOM snapshot detects a one-word change', tweak !== v09.out.find(s => s.name === 'home').dom);
    t.ok('pixel diff detects a different screen', (await GD.pixelDiff(helper, v09.out[0].img, v09.out[4].img)) > 0.01);
  } finally { await browser.close(); }
};
