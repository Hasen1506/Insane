// WS-G e2e (PLAN-V09 §5.a F07 + F06, C52/C53/C54): INR pot → Pay by UPI (href asserted) → organiser confirms;
// a favor logged and both balances read. Local mode, Pixel 7, against the built app/index.html.
// Run: node test/e2e/ledger.js   (APP, CHROMIUM/CHROME, PW: see test/lib)
'use strict';
const BR = require('../lib/browser'), { run } = require('./ledger-flow');
(async () => {
  const browser = await BR.launch(); const res = [];
  try { await run(browser, { check: (n, c, x = '') => { res.push([!!c, n]); console.log(`${c ? 'PASS' : 'FAIL'} WS-G ${n}${c ? '' : ' ' + String(x).slice(0, 300)}`); } }); }
  catch (e) { res.push([false, 'threw']); console.log('FAIL WS-G threw: ' + (e && e.stack || e)); }
  finally { await browser.close(); }
  const pass = res.filter(r => r[0]).length;
  console.log(`${pass}/${res.length} passed`); process.exit(pass === res.length && res.length ? 0 : 1);
})();
