// WS-G goldens (PLAN-V09 §5.d, C52–C54): the Ledger after the WS-G flow (test/e2e/ledger-flow.js), Pixel 7,
// light and dark: the payer's pot with Pay by UPI and "who owes what", the organiser's view with what's owed,
// and both favor balances (+2 h / −2 h). DOM + pixel goldens under test/golden/{dom,img}/ws-g/.
'use strict';
const BR = require('../lib/browser'), GD = require('../lib/golden'), { run } = require('../e2e/ledger-flow');
module.exports = async function (t) {
  const browser = await BR.launch();
  try {
    const helper = await browser.newPage(), shots = [];
    await run(browser, {
      port: +process.env.GOLDEN_PORT_G || 8779, // fixed: the origin shows up in links
      check: (n, c, x) => { if (!c) t.ok('flow: ' + n, false, x); },
      snap: async (page, name) => {
        for (const scheme of ['light', 'dark']) {
          await page.emulateMedia({ colorScheme: scheme }); await GD.freeze(page);
          shots.push({ name: `${name}-${scheme}`, dom: await GD.domSnapshot(page, '#app'), img: await GD.pixelShot(page) });
        }
        await page.emulateMedia({ colorScheme: 'light' });
      },
    });
    t.ok('flow drove all 4 ledger screens × 2 themes', shots.length === 8, shots.map(s => s.name).join(','));
    for (const s of shots) {
      const g = GD.matchDom('ws-g/Pixel7/' + s.name, s.dom); t.ok(`${s.name}: DOM golden ${g.created ? 'written' : 'matches'}`, g.ok, g.diff);
      const p = await GD.matchPixels(helper, 'ws-g/Pixel7/' + s.name, s.img); t.ok(`${s.name}: pixel golden ${p.created ? 'written' : 'matches (' + (p.ratio * 100).toFixed(3) + '%)'}`, p.ok);
    }
    const a = shots.find(s => s.name === 'pots-payer-light'), b = shots.find(s => s.name === 'pots-payer-dark');
    t.ok('dark differs from light (the theme applied)', a && b && (await GD.pixelDiff(helper, a.img, b.img)) > 0.2);
  } finally { await browser.close(); }
};
