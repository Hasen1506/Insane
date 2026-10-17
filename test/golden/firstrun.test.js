// WS-B goldens (PLAN-V09 §5.d): welcome, intro, the age gate, the tour, the + sheet, Help, a locked
// segment, on Pixel 7 and iPhone 13, light and dark. Each screen is also audited: WCAG AA text contrast
// (4.5:1, 3:1 for large text; disabled controls are exempt), and every tap target WS-B added is ≥ 44 px.
'use strict';
const BR = require('../lib/browser'), E = require('../lib/e2e'), GD = require('../lib/golden');
const T0 = Date.UTC(2026, 9, 12, 3, 30); // Mon 12 Oct 2026, 09:00 in Chennai

// Runs in the page: every visible element with its own text, its colour and the colour actually behind it.
const AUDIT = () => {
  const rgb = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let c = { r: 255, g: 255, b: 255, a: 1 }; const root = rgb(getComputedStyle(document.documentElement).backgroundColor); if (root && root.a) c = root; for (const s of stack.reverse()) c = blend(s, c); return c; };
  // WS-B fails on its own screens and pieces; anything else it sees is reported for WS-H (tokens, components)
  const MINE = '.wel,.intro,.tour,.lockcard,.softask,.segx,.lk,.empty-l,.sheet,.obchip,fieldset.dob,.hprev', ob = !!document.querySelector('#app .steps');
  const bad = [], notes = [];
  const scope = document.querySelector('.sheet') || document.body;
  for (const el of scope.querySelectorAll('*')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
    if (el.closest('.rail,[aria-hidden="true"],svg')) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) continue;
    if (el.closest('button:disabled,[disabled]')) continue; // WCAG 1.4.3 exempts inactive controls
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || +st.opacity === 0) continue;
    let fg = rgb(st.color); if (!fg) continue; const bg = bgOf(el); fg = blend(fg, bg);
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity; if (op < 1) fg = blend({ ...fg, a: op }, bg);
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const px = parseFloat(st.fontSize), large = px >= 24 || (px >= 18.66 && +st.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) (el.closest(MINE) || ob ? bad : notes).push(`${el.tagName.toLowerCase()}.${el.className || ''} "${el.textContent.trim().slice(0, 30)}" ${ratio.toFixed(2)}`);
  }
  const small = [];
  for (const el of document.querySelectorAll('.wel .btn,.wel .link,.intro .btn,.intro .link,.qi,fieldset.dob select,.tour .btn,.tour .link,.sh-i,.lockcard .btn,.softask .btn')) {
    const r = el.getBoundingClientRect(); if (!r.width) continue; if (r.height < 44 || r.width < 44) small.push(`${el.className} "${el.textContent.trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return { bad, notes, small, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
};

async function shots(browser, profile, scheme) {
  const srv = await E.serveStatic({ port: 0 });
  const ctx = await browser.newContext(BR.profile(profile, { timezoneId: 'Asia/Kolkata', locale: 'en-IN', colorScheme: scheme, reducedMotion: 'reduce' }));
  await BR.blockExternal(ctx); await GD.seedRandom(ctx, 9); await E.actProbe(ctx);
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: T0 });
  const out = [];
  const snap = async name => { await E.gone(page, '.toast', { timeout: 6000 }); await E.stable(page, 'body'); out.push({ name, dom: await GD.domSnapshot(page, 'body'), img: await GD.pixelShot(page), audit: await page.evaluate(AUDIT) }); };
  const tap = async sel => { await E.tapOnce(page, sel); await E.idle(page); };
  await page.goto(srv.url + '/?as=meera'); await page.waitForSelector('.wel'); await GD.freeze(page);
  await snap('welcome');
  await tap('[data-act="wel-code"]'); await page.waitForSelector('#wel-code'); await snap('welcome-code');
  await tap('[data-act="wel-start"]'); await page.waitForSelector('.intro'); await snap('intro-1');
  await tap('[data-act="intro-go"]:has-text("Next")'); await tap('[data-act="intro-go"]:has-text("Next")'); await snap('intro-3');
  await tap('[data-act="intro-skip"]'); await page.waitForSelector('#ob-name');
  await page.fill('#ob-name', 'Meera'); await page.selectOption('#ob-dobm', '3'); await E.idle(page); await page.selectOption('#ob-doby', '2010'); await E.idle(page);
  await snap('ob-1-under18');
  await page.selectOption('#ob-doby', '1999'); await E.idle(page); await page.check('#ob-consent'); await E.idle(page); await snap('ob-1-ok');
  await tap('[data-act="ob-next"]'); await page.waitForSelector('#lp-q-home');
  await page.fill('#lp-q-home', 'Chennai'); await page.waitForSelector('.res'); await tap('.res');
  if (await page.locator('[data-act="lp-paste"]').count()) { await tap('[data-act="lp-paste"]'); await page.fill('#lp-p-home', '13.2790, 80.2619'); await tap('form[data-form="lp-use"] button'); }
  await E.until(async () => !(await page.isDisabled('[data-act="ob-next"]')), { what: 'place' });
  await tap('[data-act="ob-next"]'); await page.waitForSelector('#ob-cname'); await page.fill('#ob-cname', 'Third Floor'); await tap('[data-act="ob-circle"][data-v="create"]');
  await page.waitForSelector('#ob-mind'); await tap('.ex button >> nth=0'); await snap('ob-4-mind-chip');
  await tap('[data-act="ob-finish"][data-v="mind"]'); await page.waitForSelector('.tour'); await snap('home-tour');
  await tap('[data-act="tour-skip"]'); await E.gone(page, '.tour');
  await tap('[data-act="make"]'); await page.waitForSelector('.sheet'); await snap('sheet-make-day1');
  await tap('.sheet [data-act="sheet"][data-v="help"]'); await page.waitForSelector('#help-unlocks'); await snap('sheet-help');
  await page.keyboard.press('Escape'); await E.gone(page, '.sheet');
  await tap('[data-act="tab"][data-v="circle"]'); await tap('[data-act="cseg"][data-v="midnight"]'); await page.waitForSelector('.lockcard'); await snap('circle-midnight-locked');
  await ctx.close(); await srv.close();
  return { out, errors };
}

module.exports = async function (t) {
  const browser = await BR.launch();
  try {
    const helper = await browser.newPage();
    const runs = [];
    for (const profile of ['Pixel 7', 'iPhone 13']) for (const scheme of ['light', 'dark']) runs.push([profile, scheme]);
    const res = []; for (let i = 0; i < runs.length; i += 2) res.push(...await Promise.all(runs.slice(i, i + 2).map(([p, s]) => shots(browser, p, s)))); // two at a time: memory on small CI boxes
    for (let i = 0; i < runs.length; i++) {
      const [profile, scheme] = runs[i], { out, errors } = res[i], P = `${profile} ${scheme}: `, dir = `ws-b/${profile.replace(/\s/g, '')}-${scheme}`;
      t.ok(P + 'drove all 11 first-run screens, no script errors', out.length === 11 && !errors.length, out.map(s => s.name).join(',') + ' ' + errors.join(' | '));
      for (const s of out) {
        const g = GD.matchDom(`${dir}/${s.name}`, s.dom); t.ok(P + `${s.name}: DOM golden ${g.created ? 'written' : 'matches'}`, g.ok, g.diff);
        const px = await GD.matchPixels(helper, `${dir}/${s.name}`, s.img); t.ok(P + `${s.name}: pixel golden ${px.created ? 'written' : 'matches'}`, px.ok);
        t.ok(P + `${s.name}: text contrast WCAG AA`, s.audit.bad.length === 0, s.audit.bad.join(' | '));
        if (s.audit.notes.length && process.env.VERBOSE) console.log(`  note for WS-H, ${P}${s.name}: ${s.audit.notes.join(' | ')}`);
        t.ok(P + `${s.name}: WS-B tap targets ≥ 44 px, no sideways scroll`, s.audit.small.length === 0 && !s.audit.hscroll, s.audit.small.join(' | '));
      }
    }
  } finally { await browser.close(); }
};
