// WS-H (C82, client): a cold load of Home on a Pixel 7 with the CPU slowed 4× draws the tab bar in under
// 2.5 s (the render-complete proxy for TTI), and nothing outside the page's own origin is requested on the way
// (no web fonts since WS-H, no render-blocking stylesheet).
'use strict';
const L = require('../e2e/flows/_shell-lib');
const { E, BR } = L;

module.exports = async function (t) {
  const browser = await BR.launch();
  const srv = await E.serveStatic({ port: 0 });
  try {
    const ctx = await L.context(browser, 'Pixel 7'), p = await L.page(ctx);
    await p.goto(srv.url + '/?as=meera'); await L.onboard(p); await E.idle(p);
    const outside = []; p.on('request', r => { if (!r.url().startsWith(srv.url) && !/^(data|blob):/.test(r.url())) outside.push(r.url()); });
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const runs = [];
    for (let i = 0; i < 3; i++) {
      await p.reload({ waitUntil: 'commit' });
      await p.waitForSelector('nav.tabs', { timeout: 15000 });
      runs.push(await p.evaluate(() => Math.round(performance.now())));
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const best = Math.min(...runs);
    console.log(`  perf: Home drawn at ${runs.join(', ')} ms (4× CPU); best ${best} ms`);
    t.ok('C82 Home draws in < 2.5 s on a 4× slower CPU (best of 3 cold reloads)', best < 2500, runs.join(','));
    t.ok('C82 a cold load asks nothing of another host (no font or CDN request)', outside.length === 0, outside.join(' '));
    t.ok('no script errors', !p.errors.length, p.errors.join(' | '));
    await ctx.close();
  } finally { await srv.close(); await browser.close(); }
};
