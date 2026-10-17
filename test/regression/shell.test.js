// Regression tests for the phone-shell bugs found in the v0.9 live test (PLAN-V09 §5.e), on the
// Pixel 7 and iPhone 13 profiles, in local mode (the claude.ai store) and, for C107, server mode.
//   R-C01   the page lays out at the phone's width, with no horizontal scroll and no build-notes rail
//   R-C03   doctype and lang (quirks mode, screen-reader voice)
//   R-C05   Back doesn't leave the app
//   R-C06   scrollY is 0 after onboarding, even when the last step was scrolled down
//   R-C31   the end of every tab clears the fixed tab bar
//   R-C107  no "Share menu" / claude.ai copy on the server version
'use strict';
const L = require('../e2e/flows/_shell-lib');
const { E, BR } = L;

module.exports = async function (t) {
  const browser = await BR.launch();
  const srv = await E.serveStatic({ port: L.port(1) });
  try {
    for (const prof of ['Pixel 7', 'iPhone 13']) {
      const P = prof + ': ', W = BR.profile(prof).viewport.width;
      const ctx = await L.context(browser, prof), p = await L.page(ctx);
      await p.clock.install({ time: L.T0 });
      await p.goto(srv.url + '/?as=meera'); await p.waitForSelector('#ob-name');
      const m = await p.evaluate(() => ({ iw: innerWidth, sw: document.documentElement.scrollWidth, rail: getComputedStyle(document.querySelector('.rail')).display, dt: document.doctype && document.doctype.name, lang: document.documentElement.lang, quirks: document.compatMode }));
      t.ok(P + 'R-C01 innerWidth is the device width (' + W + ')', m.iw === W, m.iw);
      t.ok(P + 'R-C01 no horizontal scroll, rail hidden', m.sw <= m.iw && m.rail === 'none', JSON.stringify(m));
      t.ok(P + 'R-C03 <!doctype html>, standards mode, lang="en"', m.dt === 'html' && m.quirks === 'CSS1Compat' && m.lang === 'en', JSON.stringify(m));

      await L.onboard(p, { beforeFinish: async q => { await q.evaluate(() => scrollTo(0, document.body.scrollHeight)); await E.until(() => q.evaluate(() => scrollY > 0), { what: 'scrolled down' }); } });
      t.ok(P + 'R-C06 Home opens at the top after onboarding', await p.evaluate(() => scrollY) === 0, await p.evaluate(() => scrollY));

      for (const tab of ['today', 'circle', 'city', 'ledger', 'you']) {
        await L.tap(p, `[data-act="tab"][data-v="${tab}"]`); await E.until(() => p.evaluate(x => S.ui.tab === x, tab));
        await E.stable(p, '#app');
        const r = await p.evaluate(async () => { scrollTo(0, document.body.scrollHeight); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const v = document.querySelector('#v').getBoundingClientRect(), n = document.querySelector('nav.tabs').getBoundingClientRect(); return { vb: Math.round(v.bottom), nt: Math.round(n.top), sw: document.documentElement.scrollWidth, iw: innerWidth }; });
        t.ok(P + `R-C31 ${tab}: the last line ends above the tab bar`, r.vb <= r.nt, JSON.stringify(r));
        t.ok(P + `R-C01 ${tab}: no horizontal scroll`, r.sw <= r.iw, JSON.stringify(r));
      }
      // R-C05: tabs push history; Back walks them back and never leaves INSANE
      await L.tap(p, '[data-act="tab"][data-v="today"]'); await L.tabOn(p, 'today');
      const depth0 = await p.evaluate(() => history.length);
      await L.tap(p, '[data-act="tab"][data-v="circle"]'); await L.tabOn(p, 'circle');
      await L.tap(p, '[data-act="tab"][data-v="city"]'); await L.tabOn(p, 'city');
      await p.goBack(); await L.tabOn(p, 'circle');
      t.ok(P + 'R-C05 Back from City returns to Circle', (await L.onTab(p)) === 'circle' && p.url().startsWith(srv.url) && p.url().includes('#/circle'), p.url());
      await p.goBack(); await L.tabOn(p, 'today');
      t.ok(P + 'R-C05 Back again returns to Home, still in INSANE', (await L.onTab(p)) === 'today' && p.url().startsWith(srv.url), p.url());
      t.ok(P + 'R-C05 no extra history entries from re-renders', (await p.evaluate(() => history.length)) === depth0 + 2, await p.evaluate(() => history.length));
      // R-C05 (int-2): a sheet opened after Back's popstate but before its hashchange stays open (the golden
      // suite's openSheet('invite') right after Escape closed the + sheet was closed again by that hashchange)
      await L.tap(p, '[data-act="make"]'); await p.waitForSelector('.sheet');
      await p.evaluate(() => new Promise(res => { addEventListener('popstate', () => { openSheet('invite'); res(); }, { once: true }); history.back(); }));
      await E.until(() => p.evaluate(() => !!document.querySelector('.sheet') && S.ui.sheet && S.ui.sheet.t === 'invite' && location.hash.includes('/sheet/invite')), { what: 'invite sheet after Back', timeout: 4000 }).catch(() => { });
      t.ok(P + 'R-C05 a sheet opened between Back\'s popstate and its hashchange is not closed by the hashchange', await p.evaluate(() => !!(S.ui.sheet && S.ui.sheet.t === 'invite' && document.querySelector('.sheet') && location.hash.includes('/sheet/invite'))), await p.evaluate(() => JSON.stringify({ sheet: S.ui.sheet, hash: location.hash })));
      await p.keyboard.press('Escape'); await E.gone(p, '.sheet');
      t.ok(P + 'no script errors', !p.errors.length, p.errors.join(' | '));
      await ctx.close();
    }
    // R-C107: the claude.ai rail copy stays in artifact/local mode, and is gone on the server version
    {
      const ctx = await L.context(browser, 'Desktop 1280'), p = await L.page(ctx);
      await p.goto(srv.url + '/?as=ravi'); await p.waitForSelector('#ob-name');
      t.ok('Desktop 1280 local: the build-notes rail shows (artifact mode keeps its copy)', await p.locator('.rail').isVisible() && (await p.locator('.rail').innerText()).includes('Share menu'));
      await ctx.close();
      const s = await E.startServer({ port: L.port(2) });
      try {
        const c2 = await L.context(browser, 'Desktop 1280'), q = await L.page(c2);
        await q.goto(s.url + '/'); await q.waitForSelector('#si-email');
        const rail = await q.locator('.rail').innerText().catch(() => '');
        t.ok('R-C107 server (dev): no "Share menu" or claude.ai copy anywhere', !/Share menu|claude\.ai/.test(await q.locator('body').innerText()), rail.slice(0, 200));
        t.ok('R-C107 server (dev): the rail is a short About / Help panel', /About/i.test(rail) && /Help/i.test(rail), rail.slice(0, 200));
        t.ok('R-C107 server: no script errors', !q.errors.length, q.errors.join(' | '));
        await c2.close();
      } finally { await s.close(); }
      const prod = await E.startServer({ port: L.port(3), env: { DEV: '0' } });
      try {
        const c3 = await L.context(browser, 'Desktop 1280'), q = await L.page(c3);
        await q.goto(prod.url + '/'); await q.waitForSelector('#si-email');
        const box = await q.evaluate(() => ({ rail: !!document.querySelector('.rail'), main: Math.round(document.querySelector('#app').getBoundingClientRect().width) }));
        t.ok('R-C107 server (production): no rail, and the app keeps its full column', !box.rail && box.main >= 420, JSON.stringify(box));
        await c3.close();
      } finally { await prod.close(); }
    }
  } finally { await srv.close(); await browser.close(); }
};
