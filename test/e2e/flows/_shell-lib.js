// Shared steps for the WS-A shell flows (test/e2e/flows/shell.test.js, test/regression/shell.test.js).
// Condition waits only: every tap waits for its act() to finish and draw (E.idle).
'use strict';
const fs = require('fs'), http = require('http');
const BR = require('../../lib/browser'), E = require('../../lib/e2e');

const T0 = Date.UTC(2026, 9, 12, 3, 30); // Mon 12 Oct 2026, 09:00 in Chennai
// A port per process so parallel worktrees running these suites don't collide.
const port = off => 20000 + ((process.pid * 7 + off) % 20000);

async function context(browser, profile, extra = {}) {
  const ctx = await browser.newContext(BR.profile(profile, { timezoneId: 'Asia/Kolkata', locale: 'en-IN', reducedMotion: 'reduce', ...extra }));
  await BR.blockExternal(ctx); await E.actProbe(ctx);
  return ctx;
}
async function page(ctx) {
  const p = await ctx.newPage(); p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  return p;
}
const tap = async (p, sel) => { await E.tapOnce(p, sel); await E.idle(p); };
const fill = async (p, sel, v) => { await p.fill(sel, v); await E.idle(p); };

// Onboarding with a pasted pin (no network search), creating a circle. `beforeFinish` runs on the
// last step, e.g. to scroll the page down the way a thumb would.
async function onboard(p, { name = 'Meera', cname = 'Third Floor', beforeFinish } = {}) {
  await p.waitForSelector('#ob-name');
  await fill(p, '#ob-name', name); await p.check('#ob-age'); await E.idle(p); await tap(p, '[data-act="ob-next"]');
  await p.waitForSelector('#lp-q-home');
  await tap(p, '[data-act="lp-paste"]'); await p.waitForSelector('#lp-p-home'); await fill(p, '#lp-p-home', '13.2790, 80.2619'); await tap(p, 'form[data-form="lp-use"] button');
  await E.until(async () => (await p.locator('[data-act="lp-size"]').count()) > 0, { what: 'precision chips' });
  await tap(p, '[data-act="lp-size"][data-v="2"]'); await tap(p, '[data-act="lp-radius"][data-v="5"]');
  await tap(p, '[data-act="ob-next"]'); await p.waitForSelector('#ob-cname'); await fill(p, '#ob-cname', cname);
  await tap(p, '[data-act="ob-circle"][data-v="create"]'); await p.waitForSelector('#ob-mind');
  await tap(p, '[data-act="ob-lane"][data-v="need"]'); await fill(p, '#ob-mind', 'run 3 times a week'); await tap(p, '[data-act="ob-stake"][data-v="1"]');
  if (beforeFinish) await beforeFinish(p);
  await tap(p, '[data-act="ob-finish"][data-v="mind"]'); await p.waitForSelector('nav.tabs'); await E.idle(p);
}
async function signIn(p, base, email) {
  await p.waitForSelector('#si-email'); await fill(p, '#si-email', email); await tap(p, 'button:has-text("Email me a code")');
  await p.waitForSelector('#si-code'); await fill(p, '#si-code', await E.outboxCode(base, email)); await tap(p, 'button:has-text("Sign in")');
  await p.waitForSelector('#ob-name, nav.tabs', { timeout: 15000 });
}
const tabOn = (p, t) => E.until(async () => (await p.locator(`nav.tabs [data-act="tab"][data-v="${t}"].on`).count()) === 1, { what: t + ' tab on' });
const onTab = p => p.evaluate(() => S.ui.tab);

// A front for the INSANE server that can "deploy" a new build: GET / serves build A or build B (the same
// file with another build stamp), everything else is passed through, SSE included.
function deployProxy(target, { port: pt = 0 } = {}) {
  const html = fs.readFileSync(E.APP(), 'utf8');
  const idA = /INSANE build ([0-9a-f]{12})/.exec(html)[1], idB = 'b0b0b0b0b0b0';
  const builds = { [idA]: html, [idB]: html.replace(`INSANE build ${idA}`, `INSANE build ${idB}`) };
  let live = idA;
  const t = new URL(target);
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x');
    if (q.method === 'GET' && (u.pathname === '/' || u.pathname === '/index.html')) {
      const etag = `"${live}"`;
      if (q.headers['if-none-match'] === etag) { r.writeHead(304, { etag }); return r.end(); }
      r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache', etag }); return r.end(builds[live]);
    }
    const f = http.request({ host: t.hostname, port: t.port, path: q.url, method: q.method, headers: { ...q.headers, host: t.host } }, fr => { r.writeHead(fr.statusCode, fr.headers); fr.pipe(r); });
    f.on('error', () => { try { r.writeHead(502); r.end(); } catch (e) { } });
    q.pipe(f);
  });
  return new Promise(res => srv.listen(pt, '127.0.0.1', () => res({
    url: `http://localhost:${srv.address().port}`, idA, idB, deploy: id => { live = id; },
    close: () => new Promise(r => { srv.closeAllConnections && srv.closeAllConnections(); srv.close(r); }),
  })));
}

module.exports = { T0, port, context, page, tap, fill, onboard, signIn, tabOn, onTab, deployProxy, BR, E };
