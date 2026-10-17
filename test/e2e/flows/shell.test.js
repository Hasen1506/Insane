// WS-A flows (PLAN-V09 §5.a), Pixel 7 and iPhone 13.
//   F19  Back and history across tabs, segments, a thread and sheets; Close and Back agree; scroll kept
//        per entry when returning (C05, C06). Local mode and server mode.
//   C04  invite sheet draws its QR under CSP script-src 'self' 'unsafe-inline' with every outside host cut.
//   C02  manifest and icons are served 200 with the right types; iPhone gets the Add to Home Screen card.
//   F18  server mode: the worker takes control, an offline banner shows, a cold start offline opens the
//        shell, coming back online loads the app; a new deploy shows "New version ready" and Reload
//        brings up the new BUILD_ID (C07, C08).
'use strict';
const L = require('./_shell-lib');
const { E, BR } = L;

async function history(t, P, p, base) {
  await L.tap(p, '[data-act="tab"][data-v="today"]'); await L.tabOn(p, 'today');
  // sheet: Back closes it and stays on the tab
  await L.tap(p, '[data-act="make"]'); await p.waitForSelector('.sheet');
  t.ok(P + 'opening a sheet puts it in the URL', /#\/today\/sheet\/make$/.test(p.url()), p.url());
  await p.goBack(); await E.gone(p, '.sheet');
  t.ok(P + 'Back closes the sheet and stays on Home', (await L.onTab(p)) === 'today' && /#\/today$/.test(p.url()), p.url());
  // Close (Escape) then Back: the sheet doesn't come back, Back goes to the tab before
  await L.tap(p, '[data-act="tab"][data-v="circle"]'); await L.tabOn(p, 'circle');
  await L.tap(p, '[data-act="sheet"][data-v="activity"]'); await p.waitForSelector('.sheet');
  await p.keyboard.press('Escape'); await E.gone(p, '.sheet'); await E.until(() => p.evaluate(() => !ROUTE.pending), { what: 'route settled' });
  t.ok(P + 'closing a sheet in the app leaves its entry too', /#\/circle\/[a-z]+$/.test(p.url()), p.url());
  await p.goBack(); await L.tabOn(p, 'today');
  t.ok(P + 'then Back goes to the previous tab, not the closed sheet', (await L.onTab(p)) === 'today' && !(await p.locator('.sheet').count()), p.url());
  // segments
  await L.tap(p, '[data-act="tab"][data-v="circle"]'); await L.tabOn(p, 'circle');
  const segs = await p.$$eval('[data-act="cseg"]', b => b.filter(x => !x.disabled).map(x => x.dataset.v));
  const seg0 = await p.evaluate(() => S.ui.cseg), seg1 = segs.find(s => s !== seg0);
  if (seg1) {
    await L.tap(p, `[data-act="cseg"][data-v="${seg1}"]`); await E.until(() => p.evaluate(s => S.ui.cseg === s, seg1));
    t.ok(P + `segment ${seg1} has its own URL`, p.url().endsWith('#/circle/' + seg1), p.url());
    await p.goBack(); await E.until(() => p.evaluate(s => S.ui.cseg === s, seg0), { what: 'segment back' });
    t.ok(P + 'Back returns to the previous segment', (await p.evaluate(() => S.ui.cseg)) === seg0);
  }
  // scroll: a new tab starts at the top; Back restores where you were
  await L.tap(p, '[data-act="tab"][data-v="you"]'); await E.until(() => p.evaluate(() => S.ui.tab === 'you'));
  await E.stable(p, '#app');
  const room = await p.evaluate(() => document.body.scrollHeight - innerHeight);
  if (room > 120) {
    await p.evaluate(() => scrollTo(0, 100)); await E.until(() => p.evaluate(() => scrollY === 100));
    await L.tap(p, '[data-act="tab"][data-v="city"]'); await L.tabOn(p, 'city');
    t.ok(P + 'C06 a new tab opens at the top', (await p.evaluate(() => scrollY)) === 0);
    await p.goBack(); await E.until(() => p.evaluate(() => S.ui.tab === 'you'));
    await E.until(() => p.evaluate(() => scrollY === 100), { what: 'scroll restored', timeout: 4000 }).catch(() => { });
    t.ok(P + 'C06 Back to a tab restores its scroll position', (await p.evaluate(() => scrollY)) === 100, await p.evaluate(() => scrollY));
  } else t.ok(P + 'C06 (You tab too short to scroll on this profile)', true);
  t.ok(P + 'never left the app', p.url().startsWith(base), p.url());
  // a deep link into a tab
  await p.goto(p.url().split('#')[0] + '#/ledger'); await L.tabOn(p, 'ledger');
  t.ok(P + 'a #/ledger link opens the Ledger tab', (await L.onTab(p)) === 'ledger');
}

module.exports = async function (t) {
  const browser = await BR.launch();
  const srv = await E.serveStatic({ port: L.port(11) });
  let server = null, proxy = null;
  try {
    for (const prof of ['Pixel 7', 'iPhone 13']) {
      const P = prof + ' local: ';
      const ctx = await L.context(browser, prof);
      // C04: the strictest script policy the artifact can meet, on the page itself
      const violations = [];
      await ctx.route(u => new URL(u).pathname === '/' && new URL(u).port === String(new URL(srv.url).port), async route => {
        const r = await route.fetch(); route.fulfill({ response: r, headers: { ...r.headers(), 'content-security-policy': "script-src 'self' 'unsafe-inline'" } });
      });
      const p = await L.page(ctx);
      const scripts = []; p.on('request', q => { if (q.resourceType() === 'script') scripts.push(q.url()); });
      await p.addInitScript(() => addEventListener('securitypolicyviolation', e => (window.__csp = window.__csp || []).push(e.blockedURI + ' ' + e.violatedDirective)));
      await p.clock.install({ time: L.T0 });
      await p.goto(srv.url + '/?as=meera');
      await L.onboard(p);
      await p.evaluate(() => openSheet('invite')); await p.waitForSelector('.sheet');
      const qr = await p.evaluate(() => { const s = document.querySelector('.sheet .qr svg'); const d = s && s.querySelector('path') && s.querySelector('path').getAttribute('d'); return { svg: !!s, cells: d ? (d.match(/M/g) || []).length : 0, w: s ? Math.round(s.getBoundingClientRect().width) : 0 }; });
      t.ok(P + 'C04 invite QR renders as SVG with all outside hosts blocked', qr.svg && qr.cells > 100 && qr.w > 100, JSON.stringify(qr));
      violations.push(...(await p.evaluate(() => window.__csp || [])));
      t.ok(P + 'C04 no external script requested, no CSP violation', !scripts.length && !violations.length, scripts.concat(violations).join(' '));
      await p.keyboard.press('Escape'); await E.gone(p, '.sheet');
      await history(t, P, p, srv.url);
      t.ok(P + 'no script errors', !p.errors.length, p.errors.join(' | '));
      await ctx.close();
    }

    // ---- server mode ----
    server = await E.startServer({ port: L.port(12) });
    proxy = await L.deployProxy(server.url, { port: L.port(13) });
    const files = { '/manifest.webmanifest': /manifest\+json/, '/icon.svg': /svg/, '/icon-192.png': /png/, '/icon-512.png': /png/, '/icon-maskable-512.png': /png/, '/apple-touch-icon.png': /png/, '/apple-touch-icon-precomposed.png': /png/, '/sw.js': /javascript/ };
    const got = []; for (const [f, re] of Object.entries(files)) { const r = await fetch(server.url + f); got.push(`${f} ${r.status} ${r.headers.get('content-type')}`); t.ok(`C02 ${f} is served 200 (${re.source})`, r.ok && re.test(r.headers.get('content-type') || ''), got.at(-1)); }

    for (const prof of ['Pixel 7', 'iPhone 13']) {
      const P = prof + ' server: ', email = prof.replace(/\W/g, '').toLowerCase() + '@x.com';
      const ctx = await L.context(browser, prof), p = await L.page(ctx);
      await p.goto(proxy.url + '/');
      const head = await p.evaluate(async () => ({ man: await fetch(document.querySelector('link[rel=manifest]').href).then(r => r.status), ati: await fetch(document.querySelector('link[rel=apple-touch-icon]').href).then(r => r.status) }));
      t.ok(P + 'C02 link[rel=manifest] and apple-touch-icon resolve 200', head.man === 200 && head.ati === 200, JSON.stringify(head));
      await L.signIn(p, server.url, email); await L.onboard(p, { name: prof === 'iPhone 13' ? 'Kavya' : 'Arjun' });
      await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
      t.ok(P + 'C07 a service worker controls the page, versioned by this build', await p.evaluate(() => navigator.serviceWorker.controller.scriptURL.endsWith('/sw.js?b=' + buildId())), await p.evaluate(() => navigator.serviceWorker.controller.scriptURL));
      // A2HS coach card: iPhone Safari only
      const card = await p.locator('.banner.a2hs').count();
      if (prof === 'iPhone 13') {
        t.ok(P + 'C02 iPhone Safari gets the Add to Home Screen card on Home', card === 1);
        await L.tap(p, '[data-act="a2hs-hide"]');
        t.ok(P + 'C02 "Not now" hides it for good', (await p.locator('.banner.a2hs').count()) === 0 && await p.evaluate(() => localStorage.getItem('insane_a2hs')) === 'hide');
      } else t.ok(P + 'C02 no iPhone card on Android', card === 0);
      // F19 in server mode
      await history(t, P, p, proxy.url);
      await L.tap(p, '[data-act="tab"][data-v="today"]'); await L.tabOn(p, 'today');
      // offline banner
      await ctx.setOffline(true);
      await E.textHas(p, 'Offline.', '#app');
      t.ok(P + 'C07 going offline shows the offline banner', (await p.locator('.banner.net').innerText()).includes('Offline.'));
      await ctx.setOffline(false);
      await E.until(async () => !(await p.locator('.banner.net:has-text("Offline.")').count()), { what: 'offline banner gone' });
      t.ok(P + 'C07 back online: the banner goes', true);
      // cold start with no signal: the worker serves the shell
      await ctx.setOffline(true);
      await p.reload(); await E.textHas(p, 'You’re offline', '#app', { timeout: 15000 });
      t.ok(P + 'C07 cold start offline opens the INSANE shell, not the browser error page', (await p.locator('.mark').count()) > 0 && (await p.title()).includes('INSANE'));
      const back = p.waitForEvent('load', { timeout: 15000 });
      await ctx.setOffline(false); await back; await p.waitForSelector('nav.tabs', { timeout: 15000 });
      t.ok(P + 'C07 when the signal comes back it opens the app by itself', (await p.locator('nav.tabs').count()) === 1);
      // a new deploy
      if (prof === 'Pixel 7') {
        proxy.deploy(proxy.idB);
        await p.evaluate(() => swCheck());
        await p.waitForSelector('.updbar', { timeout: 20000 });
        t.ok(P + 'C08 a new deploy shows "New version ready" with Reload', (await p.locator('.updbar').innerText()).includes('New version ready') && await p.evaluate(() => buildId()) === proxy.idA);
        const nav = p.waitForEvent('load', { timeout: 15000 });
        await p.locator('.updbar button').click(); await nav; await p.waitForSelector('nav.tabs', { timeout: 15000 });
        t.ok(P + 'C08 Reload runs the new BUILD_ID, under its own worker', await p.evaluate(() => buildId()) === proxy.idB && await p.evaluate(() => navigator.serviceWorker.controller.scriptURL.endsWith('?b=' + buildId())), await p.evaluate(() => buildId()));
        const caches_ = await p.evaluate(() => caches.keys());
        t.ok(P + 'C08 the old build\'s cache is deleted', JSON.stringify(caches_) === JSON.stringify(['insane-' + proxy.idB]), JSON.stringify(caches_));
        t.ok(P + 'C08 no bar after the update', (await p.locator('.updbar').count()) === 0);
        proxy.deploy(proxy.idA); // the next profile starts on build A again
      }
      t.ok(P + 'no script errors', !p.errors.length, p.errors.join(' | '));
      await ctx.close();
    }
  } finally { if (proxy) await proxy.close(); if (server) await server.close(); await srv.close(); await browser.close(); }
};
