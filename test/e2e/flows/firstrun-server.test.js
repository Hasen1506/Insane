// F03 (server mode), WS-B part: Arjun starts a circle (Pixel 7); Kavya opens his invite link signed out
// (iPhone 13) and sees who invited her before typing anything (C11), fixes an email typo (C12), gets the
// code by the DEV button (C13, C15), joins with one primary button (C22), and is asked about
// notifications only after her first plan (C58). Plus the invite preview API's contract.
'use strict';
const BR = require('../../lib/browser'), E = require('../../lib/e2e');
const L = require('./_b-lib');

module.exports = async function (t) {
  const port = 8900 + (process.pid % 90);
  const server = await E.startServer({ port, owner: 'owner@x.com' }), B = server.url;
  const browser = await BR.launch(); const errors = [];
  try {
    /* Arjun: a returning device (intro seen), signs in by typing the code: six digits submit on their own */
    const actx = await L.context(browser, 'Pixel 7', { init: () => { localStorage.setItem('insane_intro', '1'); localStorage.setItem('insane_tour', 'done'); } });
    const a = await L.page(actx, errors, 'arjun'); await a.goto(B + '/');
    await a.waitForSelector('#si-email');
    t.ok('C10 a device that saw the intro goes straight to sign-in', await a.locator('.wel, .intro').count() === 0);
    await a.fill('#si-email', 'arjun@gmail.com'); await L.tap(a, 'button:has-text("Email me a code")'); await a.waitForSelector('#si-code');
    t.ok('C13 code field: numeric keypad, one-time-code, 6 max', (await a.getAttribute('#si-code', 'inputmode')) === 'numeric' && (await a.getAttribute('#si-code', 'autocomplete')) === 'one-time-code' && (await a.getAttribute('#si-code', 'maxlength')) === '6');
    // C16 for sign-in: the tab is killed while she reads her mail; it comes back on the code step
    await a.reload(); await a.waitForSelector('#si-code');
    t.ok('R-C16 sign-in survives a reload on the code step, email kept', (await L.text(a)).includes('Code sent to arjun@gmail.com'));
    const code = await E.outboxCode(B, 'arjun@gmail.com');
    await a.locator('#si-code').pressSequentially(code.slice(0, 3) + ' ' + code.slice(3)); // as pasted from a mail app with a space
    await a.waitForSelector('#ob-name', { timeout: 15000 });
    t.ok('C13 six digits sign in without tapping Sign in (non-digits dropped)', true);
    await L.step1(a, 'Arjun Raman'); await L.pickPlace(a); await L.tap(a, '[data-act="ob-next"]');
    await a.fill('#ob-cname', 'Mylapore Mad Hatters'); await L.tap(a, '[data-act="ob-circle"][data-v="create"]');
    await L.tap(a, '[data-act="ob-finish"][data-v="skip"]'); await a.waitForSelector('nav.tabs');
    const cc = await E.until(() => a.evaluate(() => S.circle && S.circle.code), { what: 'circle code' });
    t.ok('C17 only the attestation is stored, never the birth date', await E.until(async () => { const d = await a.evaluate(() => S.priv.age); return d && d.adult === true && d.min === 18 && !('dobY' in d) && !('y' in d) ? d : null; }, { what: 'age record' }).then(() => true, () => false));

    /* the invite preview API (C11) */
    const r = await fetch(`${B}/api/invite/${cc}`), j = await r.json();
    t.ok('C11 GET /api/invite/:code, signed out: name, count, max, first name only', r.status === 200 && JSON.stringify(Object.keys(j).sort()) === '["by","count","max","name"]' && j.name === 'Mylapore Mad Hatters' && j.count === 1 && j.max === 8 && j.by === 'Arjun', JSON.stringify(j));
    t.ok('C11 no email, uid or code leaks from the preview', !/@|u_|cid/.test(JSON.stringify(j)));
    t.ok('C11 unknown code → 404', (await fetch(`${B}/api/invite/ZZZZZZ`)).status === 404);

    /* Kavya: a new iPhone, opens the link */
    const kctx = await L.context(browser, 'iPhone 13');
    const k = await L.page(kctx, errors, 'kavya'); await k.clock.install({ time: Date.now() });
    await k.goto(B + '/#c' + cc);
    await L.has(k, 'invited you to');
    const kw = await L.text(k);
    t.ok('R-C11 the invite preview shows before sign-in: "Arjun invited you to Mylapore Mad Hatters (1 of 8)"', kw.includes('Arjun invited you to Mylapore Mad Hatters (1 of 8)'), kw.slice(0, 200));
    const prim = await k.locator('#app .btn:not(.ghost):visible').allInnerTexts();
    t.ok('C22 one primary button: "Join Mylapore Mad Hatters"', prim.length === 1 && prim[0] === 'Join Mylapore Mad Hatters', prim.join(','));
    await L.tap(k, '[data-act="wel-go"][data-v="join"]'); await k.waitForSelector('#si-email');
    t.ok('C11 sign-in keeps the invite in view', (await L.text(k)).includes('Arjun invited you to Mylapore Mad Hatters'));
    // C12 typo
    await k.fill('#si-email', 'kavya@gmial.com'); await L.tap(k, 'button:has-text("Email me a code")');
    t.ok('C12 typo caught inline, with the fix offered', await k.locator('.err[role=alert]').count() === 1 && (await k.locator('.sug').innerText()).includes('kavya@gmail.com'));
    await L.tap(k, '[data-act="si-sug"]');
    t.ok('C12 "Use it" fixes the address', (await k.inputValue('#si-email')) === 'kavya@gmail.com');
    await k.fill('#si-email', 'not-an-email'); await L.tap(k, 'button:has-text("Email me a code")');
    t.ok('C12 a non-email gets an inline error, not a browser bubble', (await k.locator('.err').innerText()).includes('doesn’t look like an email') && await k.locator('#si-email[aria-invalid="true"]').count() === 1);
    await k.fill('#si-email', 'kavya@gmail.com'); await L.tap(k, 'button:has-text("Email me a code")'); await k.waitForSelector('#si-code');
    t.ok('C13 resend waits with a countdown', await k.locator('[data-act="si-resend"]').count() === 0 && /send another in \d:\d\d/.test(await L.text(k)));
    await k.clock.runFor(31000); await E.until(async () => (await k.locator('[data-act="si-resend"]').count()) === 1, { what: 'resend after 30 s' });
    t.ok('C13 after 30 s, "send another" is a button again', true);
    await L.tap(k, '[data-act="si-devcode"]'); // C15
    await k.waitForSelector('#ob-name', { timeout: 15000 });
    t.ok('C15 "Fill dev code" signs in on a DEV server', true);
    t.ok('C11 onboarding still knows the invite', await L.has(k, 'Mylapore Mad Hatters brought you in').then(() => true, () => false));
    await L.step1(k, 'كافيا Kavya'); await L.pickPlace(k); await L.tap(k, '[data-act="ob-next"]');
    const st3 = await L.text(k);
    t.ok('C22 the circle step leads with Join; Start is only a link', await k.locator('[data-act="ob-circle"][data-v="create"]').count() === 0 && await k.locator('[data-act="ob-own"]').count() === 1 && st3.includes('Join Mylapore Mad Hatters'));
    await L.tap(k, '[data-act="ob-circle"][data-v="join"]'); await k.waitForSelector('#ob-mind');
    t.ok('C58 no notification ask during onboarding', await k.locator('.softask').count() === 0);
    await L.tap(k, '[data-act="ob-finish"][data-v="skip"]'); await k.waitForSelector('nav.tabs');
    await E.until(() => k.evaluate(() => S.members.length === 2), { what: 'Kavya in the circle' });
    await k.waitForSelector('.tour'); await L.tap(k, '[data-act="tour-skip"]');
    t.ok('C58 nothing to ask about yet: no soft-ask on a fresh Home', await k.locator('.softask').count() === 0);
    // her first plan
    await L.tap(k, '[data-act="make"]'); await L.tap(k, '[data-act="mk"][data-v="plan"]'); await k.waitForSelector('#pl-what');
    await k.fill('#pl-what', 'Filter coffee at Saravana'); await L.tap(k, '[data-act="pl-create"]');
    await k.waitForSelector('.softask', { timeout: 8000 });
    t.ok('C58 right after her first plan: "Want to know when they answer?"', (await k.locator('.softask').innerText()).includes('Want to know when they answer?'));
    await L.tap(k, '[data-act="ask-later"]'); await E.gone(k, '.softask');
    await k.reload(); await k.waitForSelector('nav.tabs'); await E.stable(k, 'body');
    t.ok('C58 "Not now" is remembered', await k.locator('.softask').count() === 0);
    t.ok('the + menu now offers what the first plan unlocked (favor, pot)', await (async () => { await L.tap(k, '[data-act="make"]'); const s = await k.locator('.sheet').innerText(); await L.tap(k, '[data-act="sheet-close"]'); return s.includes('Ask a favor') && s.includes('Start a pot'); })());

    // C11 rate limit, last so it can't starve the flows above
    let st = 0; for (let i = 0; i < 32; i++) st = (await fetch(`${B}/api/invite/${cc}`)).status;
    t.ok('C11 the preview is rate-limited per address (429 after 30 a minute)', st === 429, st);
    t.ok('no script errors', errors.length === 0, errors.join(' | '));
  } finally { await browser.close(); await server.close(); }
};
