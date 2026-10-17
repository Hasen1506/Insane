// Shared steps for the WS-B first-run flows. Condition waits only (test/lib/e2e), no fixed sleeps.
'use strict';
const BR = require('../../lib/browser'), E = require('../../lib/e2e');

async function context(browser, profile, { tz = 'Asia/Kolkata', locale = 'en-IN', scheme = 'light', init } = {}) {
  const ctx = await browser.newContext(BR.profile(profile, { timezoneId: tz, locale, colorScheme: scheme, reducedMotion: 'reduce' }));
  await BR.blockExternal(ctx); await E.actProbe(ctx);
  if (init) await ctx.addInitScript(init);
  return ctx;
}
async function page(ctx, errors, who = '') {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(who + ': ' + e.message));
  return p;
}
const tap = async (p, sel) => { await E.tapOnce(p, sel); await E.idle(p); };
const text = p => p.locator('#app').innerText();
const has = (p, s, sel) => E.textHas(p, s, sel);
// The place step, whichever picker is in: v0.8's "Paste a maps link", or WS-F's search box that takes
// plain coordinates. Either way the test only needs Next to light up.
async function pickPlace(p, ll = '13.0827, 80.2707') {
  await p.waitForSelector('#lp-q-home');
  if (await p.locator('[data-act="lp-paste"]').count()) {
    await tap(p, '[data-act="lp-paste"]'); await p.waitForSelector('#lp-p-home'); await p.fill('#lp-p-home', ll); await tap(p, 'form[data-form="lp-use"] button');
  } else { await p.fill('#lp-q-home', ll); await p.keyboard.press('Enter'); await E.idle(p); const r = p.locator('.res').first(); if (await r.count()) await tap(p, '.res'); }
  await E.until(async () => !(await p.isDisabled('[data-act="ob-next"]')), { what: 'place picked, Next enabled' });
}
async function step1(p, name, { m = '6', y = '1999' } = {}) {
  await p.waitForSelector('#ob-name'); await p.fill('#ob-name', name);
  await p.selectOption('#ob-dobm', m); await E.idle(p); await p.selectOption('#ob-doby', y); await E.idle(p);
  await tap(p, '[data-act="ob-next"]');
}
module.exports = { context, page, tap, text, has, pickPlace, step1 };
