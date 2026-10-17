// WS-H a11y audit (C75, C76, C77, C79, C70, C72): every screen on a Pixel 7, light and dark, in local mode.
// Two people: Meera starts a circle, "كافيا Kavya" (Arabic + Latin) joins by code; then a plan with a pot, a
// favor, a post and a dare, so lists, chips and avatars are drawn. Screens: welcome, intro, each onboarding
// step, the tour, every tab and every segment of it, and every sheet in the SHEETS registry that opens with
// no arguments. Each is audited by test/lib/a11y.js (contrast from the DOM, 44 px targets, accessible names,
// 12 px minimum font, card separation, isolated RTL text, no animation under reduced motion, no sideways scroll). A11Y_REPORT=path writes the full findings as JSON.
'use strict';
const fs = require('fs');
const BR = require('../lib/browser'), E = require('../lib/e2e'), A = require('../lib/a11y');
const T0 = Date.UTC(2026, 9, 12, 5, 30); // Mon 12 Oct 2026, 11:00 in Chennai (outside quiet hours)
const KAVYA = 'كافيا Kavya';

async function run(browser, scheme) {
  const srv = await E.serveStatic({ port: 0 });
  const ctx = await browser.newContext(BR.profile('Pixel 7', { timezoneId: 'Asia/Kolkata', locale: 'en-IN', colorScheme: scheme, reducedMotion: 'reduce' }));
  await BR.blockExternal(ctx); await E.actProbe(ctx);
  const errors = [], screens = [];
  const open = async who => { const p = await ctx.newPage(); p.on('pageerror', e => errors.push(who + ': ' + e.message)); await p.clock.install({ time: T0 }); return p; };
  const tap = async (p, sel) => { await E.tapOnce(p, sel); await E.idle(p); };
  const shot = async (p, name, opts) => { await E.stable(p, 'body', { timeout: 4000 }).catch(() => { }); screens.push({ name, r: await A.audit(p, opts) }); };
  async function onboard(p, name, circle) {
    await p.waitForSelector('#ob-name'); await p.fill('#ob-name', name);
    await p.selectOption('#ob-dobm', '6'); await p.selectOption('#ob-doby', '1996'); await p.check('#ob-consent'); await E.idle(p);
    if (circle.snap) await shot(p, 'ob-1-name');
    await tap(p, '[data-act="ob-next"]'); await p.waitForSelector('#lp-q-home');
    await p.fill('#lp-q-home', '13.2790, 80.2619'); await p.waitForSelector('.res[data-src="link"]'); await tap(p, '.res[data-src="link"]');
    await E.until(async () => !(await p.isDisabled('[data-act="ob-next"]')), { what: 'place' });
    if (circle.snap) await shot(p, 'ob-2-place');
    await tap(p, '[data-act="ob-next"]'); await p.waitForSelector('#ob-cname');
    if (circle.create) { await p.fill('#ob-cname', circle.create); if (circle.snap) await shot(p, 'ob-3-circle'); await tap(p, '[data-act="ob-circle"][data-v="create"]'); }
    else { await p.fill('#ob-code', circle.join); await E.idle(p); await tap(p, '[data-act="ob-circle"][data-v="join"]'); }
    await p.waitForSelector('#ob-mind');
    if (circle.snap) { await tap(p, '[data-act="ob-lane"][data-v="need"]'); await p.fill('#ob-mind', 'run 3 times a week'); await E.idle(p); await shot(p, 'ob-4-mind'); await tap(p, '[data-act="ob-finish"][data-v="mind"]'); }
    else await tap(p, '[data-act="ob-finish"][data-v="skip"]');
    await p.waitForSelector('nav.tabs');
  }

  // Meera: welcome, intro, onboarding, tour
  const a = await open('meera');
  await a.goto(srv.url + '/?as=meera'); await a.waitForSelector('.wel'); await shot(a, 'welcome');
  await tap(a, '[data-act="wel-code"]'); await a.waitForSelector('#wel-code'); await shot(a, 'welcome-code');
  await tap(a, '[data-act="wel-start"]'); await a.waitForSelector('.intro'); await shot(a, 'intro');
  await tap(a, '[data-act="intro-skip"]');
  await onboard(a, 'Meera', { create: 'Third Floor', snap: true });
  if (await a.locator('.tour').count()) { await shot(a, 'tour'); await tap(a, '[data-act="tour-skip"]'); }
  await a.evaluate(() => { localStorage.setItem('insane_unlock_all', '1'); render(); });
  const code = await a.evaluate(() => S.circle && S.circle.code);

  // Kavya joins by code
  const b = await open('kavya');
  await b.goto(srv.url + '/?as=kavya'); await b.waitForSelector('.wel, #ob-name');
  if (await b.locator('.wel').count()) { await tap(b, '[data-act="wel-start"]'); if (await b.locator('.intro').count()) await tap(b, '[data-act="intro-skip"]'); }
  await onboard(b, KAVYA, { join: code });
  if (await b.locator('.tour').count()) await tap(b, '[data-act="tour-skip"]');
  await b.evaluate(async () => { Object.assign(F, { fvwhat: 'Lift to the station' }); await act('fv-ask', {}); });
  await b.close();

  // Meera makes things so the lists are not empty
  await a.bringToFront(); await a.reload(); await a.waitForSelector('nav.tabs'); await E.idle(a);
  await a.evaluate(async () => {
    const run = async (k, f) => { Object.assign(F, f); try { await act(k, {}); } catch (e) { } };
    await run('pl-create', { plwhat: 'Dinner at Murugan Idli', plwhen: 'Fri 8 pm', plwhere: 'T Nagar', plmoney: 'split', pleach: '300' });
    await run('fv-ask', { fvwhat: 'Help me move a sofa' });
    await run('post', { ptext: 'Made filter coffee for the floor', pkind: 'Made' });
    toast(null); render();
  });
  await E.idle(a);
  const members = await a.evaluate(() => S.members.map(m => m.name));

  // every tab, every segment
  for (const t of ['today', 'circle', 'city', 'ledger', 'you']) {
    const has = await a.locator(`[data-act="tab"][data-v="${t}"]`).count(); if (!has) continue;
    await tap(a, `[data-act="tab"][data-v="${t}"]`); await shot(a, 'tab-' + t);
    const segs = await a.locator('#app .seg button[data-act]').evaluateAll(bs => bs.map(b => [b.dataset.act, b.dataset.v]));
    for (const [act, v] of segs.slice(1)) { await tap(a, `#app .seg button[data-act="${act}"][data-v="${v}"]`); await shot(a, `tab-${t}-${v}`); }
  }
  // every sheet that opens with no arguments
  const names = await a.evaluate(() => Object.keys(SHEETS));
  for (const n of names) {
    await a.evaluate(n => { try { toast(null); openSheet(n); } catch (e) { S.ui.sheet = null; render(); } }, n);
    await E.idle(a);
    const ok = await E.until(() => a.evaluate(() => { const s = document.querySelector('.sheet'); return !!s && s.innerText.replace(/\s*Close\s*$/, '').trim().length > 12; }), { timeout: 1500, what: 'sheet ' + n }).catch(() => false);
    if (ok) await shot(a, 'sheet-' + n);
    await a.evaluate(() => { S.ui.sheet = null; render(); }); await E.idle(a);
  }
  // states inside screens: forms open, a thread, a person, the toast, Go dark
  const kid = await a.evaluate(n => (S.members.find(m => m.name === n) || {}).id, KAVYA);
  const state = async (name, fn, arg) => { await a.evaluate(fn, arg); await E.idle(a); await shot(a, name); await a.evaluate(() => { S.ui.sheet = null; render(); }); await E.idle(a); };
  await state('person-kavya', id => openSheet('person', { id }), kid);
  await state('ledger-ask-form', () => { S.ui.tab = 'ledger'; S.ui.lseg = 'favors'; act('fv-form', { v: 'ask' }); });
  await state('circle-plan-form', () => { S.ui.tab = 'circle'; S.ui.cseg = 'plans'; act('np-toggle', {}); });
  await state('thread-general', () => act('open', { type: 'thread', v: 'general' }));
  await state('toast', () => { act('tab', { v: 'today' }); toast('Plan sent. Everyone taps in or out.'); }, null);
  await a.evaluate(() => { toast(null); act('tab', { v: 'you' }); }); await E.idle(a);
  await a.evaluate(async () => { Object.assign(F, { darkH: 1, darkAt: 0 }); await act('dark-go', {}); }); await E.idle(a);
  if (await a.locator('.darkall').count()) await shot(a, 'gone-dark', { scope: '.darkall' });
  await ctx.close(); await srv.close();
  return { screens, errors, members };
}

module.exports = async function (t) {
  const browser = await BR.launch();
  const report = {};
  try {
    for (const scheme of ['light', 'dark']) {
      const { screens, errors, members } = await run(browser, scheme), P = `Pixel 7 ${scheme}: `;
      t.ok(P + 'Meera and Kavya (RTL name) are both in the circle', members.includes(KAVYA) && members.length === 2, members.join(','));
      t.ok(P + `drove ${screens.length} screens without script errors`, screens.length >= 50 && !errors.length, screens.length + ' ' + errors.join(' | '));
      const sum = { contrast: 0, targets: 0, names: 0, fonts: 0, cards: 0, bidi: 0, anims: 0, hscroll: 0 };
      for (const s of screens) {
        report[`${scheme}/${s.name}`] = s.r;
        for (const k of Object.keys(sum)) sum[k] += k === 'hscroll' ? +s.r.hscroll : k === 'anims' ? +!!s.r.anims : s.r[k].length;
        t.ok(P + `${s.name}: text contrast WCAG AA`, !s.r.contrast.length, s.r.contrast.join(' | '));
        t.ok(P + `${s.name}: targets ≥ 44 px`, !s.r.targets.length, s.r.targets.join(' | '));
        t.ok(P + `${s.name}: every control has a name`, !s.r.names.length, s.r.names.join(' | '));
        t.ok(P + `${s.name}: no text under 12 px`, !s.r.fonts.length, s.r.fonts.join(' | '));
        t.ok(P + `${s.name}: cards stand off the page, no sideways scroll`, !s.r.cards.length && !s.r.hscroll, s.r.cards.join(' | '));
        t.ok(P + `${s.name}: R-C21 right-to-left text is isolated; R-C80 nothing animates under reduced motion`, !s.r.bidi.length && !s.r.anims, s.r.bidi.join(' | ') + ' anims=' + s.r.anims);
      }
      console.log(`  a11y ${scheme}: ${screens.length} screens; findings ${JSON.stringify(sum)}`);
    }
  } finally {
    await browser.close();
    if (process.env.A11Y_REPORT) fs.writeFileSync(process.env.A11Y_REPORT, JSON.stringify(report, null, 1));
  }
};
