// WS-H regression tests (PLAN-V09 §5.e), Pixel 7, local mode.
//   R-C21  a right-to-left name is isolated wherever INSANE writes it into a sentence (nameOf, the timeline)
//   R-C55  the celebration stamp lands where the person tapped, can't be hit, and is skipped under reduced motion
//   R-C73  the snackbar sits above the tab bar, is role=status, and is cleared when the person changes screen
//          (a toast set by the tap that moved them stays)
//   R-C78  keyboard: a sheet takes focus when it opens, Tab and Shift+Tab stay inside it, Escape closes it
//          and focus returns to the button that opened it; the opener says aria-expanded (C77)
//   R-C80  with reduced motion, nothing animates (document.getAnimations() is empty) after a celebration
//   R-C74  the header carries the circle name only, and the avatar is a 44 px target
'use strict';
const L = require('../e2e/flows/_shell-lib');
const { E, BR } = L;
const { loadV09 } = require('../lib/load');

module.exports = async function (t) {
  // R-C21, pure: nameOf isolates RTL names and leaves others alone
  {
    const app = loadV09();
    const r = app.run(`(()=>{S.uid='me';S.people={a:{name:'كافيا Kavya'},b:{name:'Meera'},c:{name:'שלום'}};return [nameOf('a'),nameOf('b'),nameOf('c'),nameOf('me'),bidi('Ravi 🙂')]})()`);
    t.ok('R-C21 nameOf wraps an Arabic/Latin name in FSI…PDI', r[0] === '\u2068كافيا Kavya\u2069', JSON.stringify(r[0]));
    t.ok('R-C21 a Hebrew name too; Latin names, "You" and emoji are untouched', r[2] === '\u2068שלום\u2069' && r[1] === 'Meera' && r[3] === 'You' && r[4] === 'Ravi 🙂', JSON.stringify(r));
  }

  const browser = await BR.launch();
  const srv = await E.serveStatic({ port: 0 });
  try {
    for (const motion of ['no-preference', 'reduce']) {
      const ctx = await L.context(browser, 'Pixel 7', { reducedMotion: motion }), p = await L.page(ctx);
      await p.clock.install({ time: L.T0 + 2 * 3600e3 });
      await p.goto(srv.url + '/?as=meera'); await L.onboard(p);
      await E.idle(p);
      const P = `Pixel 7 (${motion}): `;
      if (motion === 'no-preference') {
        // R-C74
        const h = await p.evaluate(() => { const w = document.querySelector('header.top .where'), b = document.querySelector('header.top .me-btn').getBoundingClientRect(); return { text: w.innerText.trim(), w: b.width, h: b.height }; });
        t.ok(P + 'R-C74 the header shows the circle name only; avatar 44×44', h.text === 'Third Floor' && h.w >= 44 && h.h >= 44, JSON.stringify(h));

        // R-C55: tap a button near the bottom of the screen, then celebrate
        await p.evaluate(() => act('tab', { v: 'ledger' })); await E.idle(p);
        const btn = p.locator('#app .btn').first(); const bb = await btn.boundingBox();
        await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.mouse.up(); await E.idle(p);
        await p.evaluate(() => { S.ui.sheet = null; render(); celebrate('LOGGED'); }); await E.idle(p);
        const st = await p.evaluate(() => { const s = document.querySelector('.celebrate .cstamp'); if (!s) return null; const r = s.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; const hit = document.elementFromPoint(cx, cy); return { cy, hitInStamp: !!(hit && hit.closest('.celebrate')), pe: getComputedStyle(document.querySelector('.celebrate')).pointerEvents }; });
        t.ok(P + 'R-C55 the stamp is drawn at the tap (±60 px), not mid-screen', st && Math.abs(st.cy - (bb.y + bb.height / 2)) < 60, JSON.stringify({ st, tapY: bb.y + bb.height / 2 }));
        t.ok(P + 'R-C55 a tap where the stamp is reaches the page underneath (pointer-events:none)', st && !st.hitInStamp && st.pe === 'none', JSON.stringify(st));

        // R-C73
        await p.evaluate(() => act('tab', { v: 'today' })); await E.idle(p);
        await p.evaluate(() => toast('Plan sent. Everyone taps in or out.')); await E.idle(p);
        const tb = await p.evaluate(() => { const x = document.querySelector('.toast'), n = document.querySelector('nav.tabs'); return x && { role: x.getAttribute('role'), bottom: x.getBoundingClientRect().bottom, navTop: n.getBoundingClientRect().top, lines: Math.round(x.scrollHeight / parseFloat(getComputedStyle(x).lineHeight)) }; });
        t.ok(P + 'R-C73 the snackbar is role=status and sits above the tab bar', tb && tb.role === 'status' && tb.bottom <= tb.navTop, JSON.stringify(tb));
        await p.evaluate(() => { toastAt -= 1000; act('tab', { v: 'circle' }); }); await E.idle(p);
        t.ok(P + 'R-C73 changing tab clears a toast from the last screen', await p.locator('.toast').count() === 0);
        await p.evaluate(() => { act('tab', { v: 'city' }); toast('Posted.'); }); await E.idle(p);
        t.ok(P + 'R-C73 a toast set by the tap that changed screen stays', await p.locator('.toast').count() === 1);
        await p.evaluate(() => { S.toast = null; render(); }); await E.idle(p);

        // R-C78 keyboard
        await p.evaluate(() => act('tab', { v: 'today' })); await E.idle(p);
        await p.focus('nav.tabs [data-act="make"]'); await p.keyboard.press('Enter'); await p.waitForSelector('#layer .sheet'); await E.idle(p);
        const k1 = await p.evaluate(() => ({ inside: !!document.activeElement.closest('.sheet'), exp: document.querySelector('nav.tabs [data-act="make"]').getAttribute('aria-expanded'), pop: document.querySelector('nav.tabs [data-act="make"]').getAttribute('aria-haspopup'), lbl: document.querySelector('.sheet').getAttribute('aria-labelledby') }));
        t.ok(P + 'R-C78 the sheet takes focus when it opens; it is labelled by its heading', k1.inside && !!k1.lbl, JSON.stringify(k1));
        t.ok(P + 'R-C77 the + button says it opens a dialog and that it is open', k1.exp === 'true' && k1.pop === 'dialog', JSON.stringify(k1));
        let out = 0; for (let i = 0; i < 25; i++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => !!document.activeElement.closest('.sheet')))) out++; }
        for (let i = 0; i < 5; i++) { await p.keyboard.press('Shift+Tab'); if (!(await p.evaluate(() => !!document.activeElement.closest('.sheet')))) out++; }
        t.ok(P + 'R-C78 25 Tabs and 5 Shift+Tabs never leave the sheet', out === 0, out);
        const fv = await p.evaluate(() => { const a = document.activeElement, s = getComputedStyle(a); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
        t.ok(P + 'R-C78 the focused control shows a focus ring', fv);
        await p.keyboard.press('Escape'); await E.gone(p, '#layer .sheet'); await E.idle(p);
        const k2 = await p.evaluate(() => ({ back: document.activeElement && document.activeElement.dataset.act, exp: document.querySelector('nav.tabs [data-act="make"]').getAttribute('aria-expanded') }));
        t.ok(P + 'R-C78 Escape closes it and focus goes back to the + button', k2.back === 'make' && k2.exp === 'false', JSON.stringify(k2));
      } else {
        await p.evaluate(() => celebrate('LOGGED', 'Logged.')); await E.idle(p);
        const r = await p.evaluate(() => ({ stamp: !!document.querySelector('.celebrate'), running: document.getAnimations().length, toast: !!document.querySelector('.toast') }));
        t.ok(P + 'R-C80 no stamp and no running animation; the words still come as a toast', !r.stamp && r.running === 0 && r.toast, JSON.stringify(r));
      }
      await ctx.close();
    }
  } finally { await srv.close(); await browser.close(); }
};
