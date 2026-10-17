// Regression tests for the first-run bugs from the v0.9 live test (PLAN-V09 §5.e), one per bug.
'use strict';
const BR = require('../lib/browser'), E = require('../lib/e2e');

async function phone(browser, extra = {}) {
  const ctx = await browser.newContext(BR.profile('Pixel 7', { timezoneId: 'Asia/Kolkata', locale: 'en-IN', reducedMotion: 'reduce', ...extra }));
  await BR.blockExternal(ctx); await E.actProbe(ctx); return ctx;
}
const tap = async (p, s) => { await E.tapOnce(p, s); await E.idle(p); };

module.exports = async function (t) {
  const browser = await BR.launch(), srv = await E.serveStatic({});
  const port = await require('../e2e/flows/_b-lib').freePort(), server = await E.startServer({ port });
  try {
    // R-C16: Meera typed her name, reloaded, and was back at step 1 with an empty name
    {
      const ctx = await phone(browser); await ctx.addInitScript(() => localStorage.setItem('insane_intro', '1'));
      const p = await ctx.newPage(); await p.goto(srv.url + '/?as=meera'); await p.waitForSelector('#ob-name');
      await p.fill('#ob-name', 'Meera Krishnamurthy-Venkataraghavan'.slice(0, 24));
      await p.reload(); await p.waitForSelector('#ob-name');
      t.ok('R-C16 onboarding draft survives reload', (await p.inputValue('#ob-name')) === 'Meera Krishnamurthy-Venk');
      // R-C17: a 13 px checkbox and a grey Next with no reason
      t.ok('R-C17 no age checkbox; Next says what is missing', await p.locator('input[type=checkbox]#ob-age').count() === 0 && await p.isDisabled('[data-act="ob-next"]') && /month and year/.test(await p.locator('#ob-why').innerText()));
      await ctx.close();
    }
    // R-C57: a solo user could tap "Start a pot" and land on a dead end
    {
      const ctx = await phone(browser); await ctx.addInitScript(() => { localStorage.setItem('insane_intro', '1'); localStorage.setItem('insane_tour', 'done'); });
      const p = await ctx.newPage(); await p.goto(srv.url + '/?as=ravi'); await p.waitForFunction(() => S.db && S.me === null);
      await p.evaluate(async () => { await S.db.doc('people/' + S.uid).set({ name: 'Ravi', handle: 'KITE', circle: null, joined: Date.now(), seen: Date.now(), quiet: { from: 23, to: 8 }, tz: 'Asia/Kolkata', cell: cellOf(13.08, 80.27, 2), prec: 'zone', radius: 5, city: 'x', cityName: 'Chennai', cc: 'IN' }); });
      await p.waitForSelector('nav.tabs'); await tap(p, '[data-act="make"]'); await p.waitForSelector('.sheet');
      const sh = await p.locator('.sheet').innerText();
      t.ok('R-C57 solo + menu has no pot, Mission or Midnight rows to dead-end on', !/Start a pot|Propose a Mission|Write for Midnight|Ask a favor/.test(sh) && /Start or join a circle/.test(sh));
      await ctx.close();
    }
    // R-C11: Kavya opened /#cCODE and the sign-in screen never mentioned the circle
    {
      const B = server.url, email = 'arjun@x.com';
      await fetch(B + '/api/auth/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const code = await E.outboxCode(B, email);
      const v = await fetch(B + '/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) });
      const cookie = v.headers.get('set-cookie').split(';')[0], uid = (await v.json()).uid;
      const set = (path, data) => fetch(B + '/api/set', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ path, data }) });
      // int-1: WS-D's server wants age + consent on sign-up and a circle to exist before anyone joins it
      await set('people/' + uid, { name: 'Arjun Raman', circle: null, joined: Date.now(), adult: true, consent: { v: '2026-10-draft' } });
      await set('circles/c1', { name: 'Mylapore Mad Hatters', code: 'K7QF2M', members: [uid], by: uid, createdAt: Date.now() });
      await set('codes/K7QF2M', { cid: 'c1', at: Date.now() });
      await fetch(B + '/api/update', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ path: 'people/' + uid, data: { circle: 'c1' } }) });
      const ctx = await phone(browser); const p = await ctx.newPage(); await p.goto(B + '/#cK7QF2M');
      await E.textHas(p, 'invited you to');
      t.ok('R-C11 invite preview before sign-in', (await p.locator('#app').innerText()).includes('Arjun invited you to Mylapore Mad Hatters (1 of 8)'));
      await ctx.close();
    }
  } finally { await browser.close(); await srv.close(); await server.close(); }
};
