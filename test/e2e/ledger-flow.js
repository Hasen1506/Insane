// WS-G flow (PLAN-V09 §5.a F06/F07, local mode, Pixel 7): Meera starts a circle in Chennai, Arjun joins.
// Meera opens an INR split pot with her UPI ID; Arjun pledges, sees "Pay ₹1,500 by UPI" (a upi://pay link with
// the amount and note), says he paid by UPI, and Meera, the organiser, confirms it. Then Arjun logs a 2 h favor
// Meera did. Used by test/e2e/ledger.js (assertions) and test/golden/ledger.test.js (goldens, light and dark).
//   run(browser, { check(name, cond, extra), snap(page, name) })
'use strict';
const BR = require('../lib/browser'), E = require('../lib/e2e'), GD = require('../lib/golden');

const T0 = Date.UTC(2026, 9, 12, 3, 30); // Mon 12 Oct 2026, 09:00 in Chennai
const UPI = 'meera.k@okaxis';
const HREF = 'upi://pay?pa=meera.k@okaxis&pn=Meera&am=1500.00&cu=INR&tn=Festival%20tickets';

async function run(browser, { check, snap = async () => { }, port = 0, profile = 'Pixel 7' }) {
  const srv = await E.serveStatic({ port });
  const ctx = await browser.newContext(BR.profile(profile, { timezoneId: 'Asia/Kolkata', locale: 'en-GB', colorScheme: 'light', reducedMotion: 'reduce' }));
  await BR.blockExternal(ctx); await GD.seedRandom(ctx, 7); await E.actProbe(ctx);
  await ctx.addInitScript(() => { try { localStorage.setItem('insane_intro', '1'); localStorage.setItem('insane_tour', 'done'); } catch (e) { } }); // past WS-B's welcome/tour if present
  await ctx.clock.install({ time: T0 });
  const errors = [];
  const open = async who => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(who + ': ' + e.message)); await p.goto(srv.url + '/?as=' + who); await GD.freeze(p); return p; };
  const tap = async (p, sel) => { await p.bringToFront(); await E.tapOnce(p, sel, { timeout: 6000 }); await E.idle(p); await E.settled(p); };
  const has = (p, s) => E.until(async () => (await p.locator('#app').innerText()).includes(s), { what: `"${s}"`, timeout: 8000 }).then(() => true, () => false);
  const tab = (p, t) => tap(p, `[data-act="tab"][data-v="${t}"]`);
  async function onboard(p, name, ll, { create, join }) {
    await p.waitForSelector('#ob-name'); await p.fill('#ob-name', name);
    if (await p.locator('#ob-age').count()) await p.check('#ob-age');
    else { await p.selectOption('#ob-dobm', '6'); await p.selectOption('#ob-doby', '1999'); }
    if (await p.locator('#ob-consent').count()) await p.check('#ob-consent');
    await tap(p, '[data-act="ob-next"]');
    await p.waitForSelector('#lp-q-home'); await p.fill('#lp-q-home', 'Chennai'); await p.waitForSelector('.res'); await tap(p, '.res');
    await tap(p, '[data-act="lp-paste"]'); await p.waitForSelector('#lp-p-home'); await p.fill('#lp-p-home', ll); await tap(p, 'form[data-form="lp-use"] button');
    await E.until(async () => (await p.locator('[data-act="lp-size"]').count()) > 0, { what: 'precision chips' });
    await tap(p, '[data-act="lp-size"][data-v="2"]'); await tap(p, '[data-act="lp-radius"][data-v="5"]');
    await tap(p, '[data-act="ob-next"]');
    if (create) { await p.waitForSelector('#ob-cname'); await p.fill('#ob-cname', create); await tap(p, '[data-act="ob-circle"][data-v="create"]'); }
    else { await p.waitForSelector('#ob-code'); await p.fill('#ob-code', join); await tap(p, '[data-act="ob-circle"][data-v="join"]'); }
    await p.waitForSelector('#ob-mind'); await tap(p, '[data-act="ob-finish"][data-v="skip"]'); await p.waitForSelector('nav.tabs');
  }
  const shot = async (p, name) => { await p.bringToFront(); await E.gone(p, '.toast', { timeout: 8000 }).catch(() => { }); await E.gone(p, '.celebrate', { timeout: 8000 }).catch(() => { }); await E.stable(p, '#app').catch(() => { }); await snap(p, name); };
  try {
    const meera = await open('meera');
    await onboard(meera, 'Meera', '13.2790, 80.2619', { create: 'Third Floor' });
    const code = await meera.evaluate(() => Object.values(JSON.parse(localStorage.getItem('insane_local_db') || '{}')).find(v => v && v.name === 'Third Floor' && v.code).code);
    const arjun = await open('arjun');
    await onboard(arjun, 'Arjun', '13.0732, 80.2425', { join: code });

    // Meera: a split pot in rupees, with her UPI ID
    await tab(meera, 'ledger'); await tap(meera, '[data-act="lseg"][data-v="pots"]'); await tap(meera, '[data-act="pot-new"]');
    check('INR pot form asks for a UPI ID, no PayPal placeholder (R-C52)', (await meera.locator('#np-upi').count()) === 1 && (await meera.locator('#np-pay').count()) === 0 && !(await meera.locator('#app').innerHTML()).includes('paypal.me'));
    await meera.fill('#np-name', 'Festival tickets'); await tap(meera, '[data-act="np-mode"][data-v="split"]'); await meera.fill('#np-each', '1500');
    await meera.fill('#np-upi', 'meera k at okaxis'); await tap(meera, '[data-act="pot-create"]');
    check('a malformed UPI ID is refused', (await meera.locator('.toast').innerText().catch(() => '')).includes('UPI ID') && (await meera.locator('#np-upi').count()) === 1);
    await meera.fill('#np-upi', UPI); await tap(meera, '[data-act="pot-create"]');
    check('pot shows ₹1,500, Indian grouping (R-C53)', await has(meera, '₹1,500 each'));
    // a lakh-sized pledge pot
    await tap(meera, '[data-act="pot-new"]'); await meera.fill('#np-name', 'Goa trip'); await tap(meera, '[data-act="np-mode"][data-v="pledge"]'); await meera.fill('#np-each', '1,50,000'); await meera.fill('#np-min', '3'); await tap(meera, '[data-act="pot-create"]');
    check('₹1,50,000 typed with lakh commas is read and shown in lakhs', await has(meera, '₹1,50,000 each'));

    // Arjun: pledges, sees Pay by UPI with the exact link
    await tab(arjun, 'ledger'); await tap(arjun, '[data-act="lseg"][data-v="pots"]');
    await E.until(async () => (await arjun.locator('.potbtn:has-text("Festival")').count()) > 0, { what: 'pot reaches Arjun' });
    await tap(arjun, '.potbtn:has-text("Festival")'); await tap(arjun, '[data-act="pledge"]');
    await E.until(async () => (await arjun.locator('a.btn.upi').count()) > 0, { what: 'Pay by UPI' }).catch(() => { });
    const href = await arjun.locator('a.btn.upi').getAttribute('href').catch(() => null);
    check('Pay ₹1,500 by UPI opens upi://pay with payee, amount (2 dp), INR and the pot as note', href === HREF, href);
    check('the button says the amount', (await arjun.locator('a.btn.upi').innerText().catch(() => '')) === 'Pay ₹1,500 by UPI');
    check('who owes what: "You owe ₹1,500"', await has(arjun, 'You owe ₹1,500'));
    check('Arjun cannot confirm his own payment (no Confirm for him)', (await arjun.locator('[data-act="pot-confirm"]').count()) === 0);
    await shot(arjun, 'pots-payer');
    // tap it: on a phone the OS hands upi:// to a UPI app. Here the tap is caught just before the browser would
    // navigate, to check that a real tap opens exactly that link and that no app handler swallows it
    await arjun.evaluate(() => document.addEventListener('click', e => { const l = e.target.closest('a[href^="upi:"]'); if (l) { window.__opened = l.href; e.preventDefault(); } }, { once: true }));
    await arjun.locator('a.btn.upi').click(); await E.settled(arjun);
    check('tapping Pay by UPI opens that upi:// link, and the app stays put', (await arjun.evaluate(() => window.__opened)) === HREF && (await arjun.locator('nav.tabs').count()) === 1);
    await tap(arjun, '[data-act="pot-pay"]'); await tap(arjun, '[data-act="pot-paid"][data-m="UPI"]');
    check('Arjun’s share is waiting for Meera', await has(arjun, 'Waiting for Meera to confirm'));
    // a non-organiser forcing the confirm action does nothing
    await arjun.evaluate(id => act('pot-confirm', { v: id, u: 'local_arjun' }), await arjun.evaluate(() => S.threads.find(t => t.title === 'Festival tickets').id)); await E.idle(arjun);
    const st0 = await arjun.evaluate(() => S.threads.find(t => t.title === 'Festival tickets').paid);
    check('only the organiser confirms: Arjun calling pot-confirm leaves it waiting', st0 && st0.local_arjun === 'wait', JSON.stringify(st0));

    // Meera: owed to her, confirms
    await meera.bringToFront(); await tab(meera, 'circle'); await tab(meera, 'ledger');
    check('organiser sees "Owed to you ₹1,500" and "confirm it landed"', await has(meera, 'Owed to you ₹1,500') && await has(meera, 'confirm it landed'));
    await tap(meera, '.potbtn:has-text("Festival")');
    await shot(meera, 'pots-organiser');
    await tap(meera, '[data-act="pot-confirm"]');
    const paid = await meera.evaluate(() => JSON.parse(localStorage.getItem('insane_local_db')));
    const pot = Object.values(paid).find(v => v && v.title === 'Festival tickets');
    check('organiser confirms: Arjun is paid', pot && pot.paid.local_arjun === true, JSON.stringify(pot && pot.paid));
    check('the UPI ID is stored on the pot', pot && pot.upi === UPI);

    // favors: Arjun logs 2 h Meera did; balances read clearly on both sides
    await tab(arjun, 'today'); await tab(arjun, 'ledger'); await tap(arjun, '[data-act="lseg"][data-v="favors"]');
    await tap(arjun, '[data-act="fv-form"][data-v="log"]'); await tap(arjun, '[data-act="fv-who"]'); await arjun.fill('#fv-what', 'Carried the gas cylinder up'); await tap(arjun, '[data-act="fv-h"][data-v="2"]'); await tap(arjun, '[data-act="fv-log"]');
    check('Arjun: −2 h, "You owe the circle 2 h of help"', await has(arjun, 'You owe the circle 2 h of help'));
    await shot(arjun, 'favors-minus');
    await tab(meera, 'today'); await tab(meera, 'ledger'); await tap(meera, '[data-act="lseg"][data-v="favors"]');
    check('Meera: +2 h, "The circle owes you 2 h of help"', await has(meera, 'The circle owes you 2 h of help') && /YOUR BALANCE\s*\+2 h/.test(await meera.locator('#app').innerText()));
    await shot(meera, 'favors-plus');
    check('no script errors', !errors.length, errors.join(' | '));
  } catch (e) { // leave screenshots of every tab for the failure, then rethrow
    const out = require('path').join(E.REPO, 'test', 'out', 'ws-g'); require('fs').mkdirSync(out, { recursive: true });
    for (const [i, p] of ctx.pages().entries()) await p.screenshot({ path: require('path').join(out, `fail-${i}.png`) }).catch(() => { });
    throw e;
  } finally { await ctx.close(); await srv.close(); }
}
module.exports = { run, HREF };
