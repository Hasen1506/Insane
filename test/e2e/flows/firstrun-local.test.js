// F01 (local mode, as on claude.ai), WS-B part: cold open → welcome → intro (full on Pixel 7, skipped on
// iPhone 13) → onboarding with the DOB gate → reload mid-way → Home → tour → + menu → locks → Help.
// Then visit 2 on the same phone: no intro. Then a solo person: the Ledger explains itself.
'use strict';
const BR = require('../../lib/browser'), E = require('../../lib/e2e');
const L = require('./_b-lib');

async function run(t, browser, srv, profile) {
  const P = s => `${profile}: ${s}`, errors = [];
  const ctx = await L.context(browser, profile);
  const p = await L.page(ctx, errors, 'meera');
  await p.goto(srv.url + '/?as=meera');

  // C09 welcome
  await p.waitForSelector('.wel');
  const w = await L.text(p);
  t.ok(P('C09 welcome says what INSANE is and who it is for'), /Plans, dares and favours with the 3–8 people you actually see/.test(w) && /Get started/.test(w) && /I have an invite/.test(w), w.slice(0, 200));
  t.ok(P('C09 welcome has one filled primary button'), await p.locator('.wel .btn:not(.ghost)').count() === 1);

  // C10 intro: four cards, in order, skippable
  await L.tap(p, '[data-act="wel-start"]'); await p.waitForSelector('.intro');
  const heads = [];
  if (profile === 'Pixel 7') {
    for (let i = 0; i < 4; i++) { heads.push(await p.locator('.intro h1').innerText()); await L.tap(p, i < 3 ? '[data-act="intro-go"]:has-text("Next")' : '[data-act="intro-done"]'); }
    t.ok(P('C10 intro: circles → pacts and the dare → Midnight and the Mole → City'), JSON.stringify(heads) === JSON.stringify(['Circles of up to 8', 'Pacts and the daily dare', 'Midnight and the Mole', 'The City']), heads.join(' | '));
  } else {
    t.ok(P('C10 intro starts on "Circles of up to 8" with a Skip'), (await p.locator('.intro h1').innerText()) === 'Circles of up to 8' && await p.locator('[data-act="intro-skip"]').count() === 1);
    await L.tap(p, '[data-act="intro-skip"]');
  }
  await p.waitForSelector('#ob-name');
  t.ok(P('C10 intro marked seen on this device'), await p.evaluate(() => localStorage.getItem('insane_intro')) === '1');

  // C17 age gate, C18 copy, C19 handle
  t.ok(P('C18 step 1 says "your people (3–8)"'), (await L.text(p)).includes('With your people (3–8)'));
  t.ok(P('C17 no 13 px checkbox any more'), await p.locator('#ob-age').count() === 0);
  t.ok(P('C17 Next disabled says why: name first'), await p.isDisabled('[data-act="ob-next"]') && (await p.locator('#ob-why').innerText()).includes('Add your name'));
  await p.fill('#ob-name', 'Meera Krishnamurthy');
  await E.until(async () => (await p.locator('#ob-why').innerText()).includes('month and year'), { what: 'DOB reason' });
  t.ok(P('C17 then the birth month and year'), true);
  const sel = await p.locator('#ob-dobm').boundingBox();
  t.ok(P('C17 the age control is at least 44 px tall'), sel && sel.height >= 44, sel && sel.height);
  await p.selectOption('#ob-dobm', '3'); await E.idle(p); await p.selectOption('#ob-doby', '2010'); await E.idle(p);
  t.ok(P('C17 under 18 in India: refused with the reason, Next stays off'), (await L.text(p)).includes('INSANE is for 18 and over in India') && await p.isDisabled('[data-act="ob-next"]') && (await p.locator('#ob-why').innerText()).includes('18 or over'));
  t.ok(P('C17 nothing about the birth date is stored'), await p.evaluate(() => !JSON.stringify(Object.assign({}, localStorage, sessionStorage)).includes('2010')));
  await p.selectOption('#ob-doby', '1999'); await E.idle(p);
  t.ok(P('C17 18+ → the age is answered; the Terms are what is left (WS-D C63)'), (await p.locator('#ob-why').innerText()).includes('Agree to the Terms'));
  await p.check('#ob-consent'); await E.idle(p);
  t.ok(P('C17 18+ → Next on, no reason left'), !(await p.isDisabled('[data-act="ob-next"]')) && (await p.locator('#ob-why').innerText()).trim() === '');
  const h0 = await p.inputValue('#ob-handle'); await L.tap(p, '[data-act="ob-shuffle"]'); const h1 = await p.inputValue('#ob-handle');
  t.ok(P('C19 Shuffle changes the handle'), h0 !== h1 && h1.length > 0, h0 + ' → ' + h1);
  const prev = await p.locator('.hprev').innerText();
  t.ok(P('C19 the preview shows the handle, never the name'), prev.includes(h1) && !prev.includes('Meera'), prev);
  t.ok(P('C19 the handle is explained as public'), (await L.text(p)).includes('Strangers in the City see this, never your name'));
  t.ok(P('C20 the name has a live counter'), (await p.locator('#ob-name-n').innerText()) === '19/40');
  await L.tap(p, '[data-act="ob-next"]');

  // C16 reload mid-onboarding: step and draft survive
  await L.pickPlace(p);
  await p.reload(); await p.waitForSelector('#app .steps');
  t.ok(P('R-C16 reload keeps the step (place, 2 of 4) and the picked place'), (await L.text(p)).includes('Where’s home?') && !(await p.isDisabled('[data-act="ob-next"]')));
  await L.tap(p, '[data-act="ob-back"]'); await p.waitForSelector('#ob-name');
  t.ok(P('R-C16 reload keeps the name, the handle and the age answer'), (await p.inputValue('#ob-name')) === 'Meera Krishnamurthy' && (await p.inputValue('#ob-handle')) === h1 && (await L.text(p)).includes('You confirmed you’re 18 or over'));
  // WS-D (C63): the consent tick is not part of the saved draft (OB_KEYS), so after a reload it is asked again,
  // and Next says why until it is ticked
  if (!(await p.isChecked('#ob-consent'))) {
    t.ok(P('C63 after a reload, consent is asked again and Next says why'), (await p.isDisabled('[data-act="ob-next"]')) && /Agree to the Terms/.test(await p.locator('#ob-why').innerText()));
    await p.check('#ob-consent'); await E.idle(p);
  }
  await L.tap(p, '[data-act="ob-next"]'); await L.tap(p, '[data-act="ob-next"]');

  // circle step, then C24 lane examples
  await p.waitForSelector('#ob-cname'); await p.fill('#ob-cname', 'Third Floor'); await L.tap(p, '[data-act="ob-circle"][data-v="create"]');
  await p.waitForSelector('#ob-mind');
  const ex = await p.locator('.ex button').allInnerTexts();
  t.ok(P('C24 India-friendly examples per lane'), ex.includes('walk 30 minutes every day'), ex.join(' | '));
  await L.tap(p, '.ex button >> nth=0');
  t.ok(P('C24 the read shows as one plain chip'), /Pact/.test(await p.locator('#ob-chip').innerText()), await p.locator('#ob-chip').innerText());
  await L.tap(p, '[data-act="ob-finish"][data-v="mind"]'); await p.waitForSelector('nav.tabs');
  t.ok(P('R-C16 the draft is cleared after finishing'), await p.evaluate(() => !Object.keys(localStorage).some(k => k.startsWith('insane_ob_')) && !Object.keys(sessionStorage).some(k => k.startsWith('insane_ob_'))));
  t.ok(P('R-C06 onboarding ends at the top of Home'), await p.evaluate(() => scrollY) === 0);

  // C26 tour: Home, Circle, +, City; dismissal persists
  const tourHeads = [];
  for (let i = 0; i < 4; i++) { await p.waitForSelector('.tour'); tourHeads.push(await p.locator('.tour h3').innerText()); await L.tap(p, '[data-act="tour-next"]'); }
  t.ok(P('C26 four-step tour after onboarding'), JSON.stringify(tourHeads) === JSON.stringify(['Home', 'Circle', 'The + button', 'City']), tourHeads.join(','));
  await E.gone(p, '.tour');
  await p.reload(); await p.waitForSelector('nav.tabs'); await E.stable(p, 'body');
  t.ok(P('C26 the finished tour stays dismissed after a reload'), await p.locator('.tour').count() === 0);

  // C57 + menu: grouped, icons, only unlocked rows (1 person in the circle, day 0)
  await L.tap(p, '[data-act="make"]'); await p.waitForSelector('.sheet');
  const rows = await p.locator('.sheet .sh-i[data-act="mk"]').allInnerTexts(), sh = await p.locator('.sheet').innerText();
  t.ok(P('C57 + menu is grouped'), /With your circle/i.test(sh) && /For you/i.test(sh) && /In the city/i.test(sh), sh.slice(0, 300));
  t.ok(P('C25 day 1: at most 6 rows'), rows.length <= 6 && rows.length >= 4, rows.length);
  t.ok(P('C57 only unlocked rows: no Midnight, pot, Mole, drop or Mission yet'), !/Write for Midnight|Start a pot|Host a drop|Propose a Mission|Make a trail/.test(sh));
  t.ok(P('C57 every row has an icon'), await p.locator('.sheet .sh-i[data-act="mk"] .ic').count() === rows.length);
  t.ok(P('C25 the + menu says more unlock later'), /more unlock as your circle grows/.test(sh));
  await L.tap(p, '[data-act="sheet-close"]');

  // C25 locked Circle segments explain themselves
  await L.tap(p, '[data-act="tab"][data-v="circle"]');
  t.ok(P('C25 Midnight and Mole tabs show "3+" and "4+"'), (await p.locator('[data-act="cseg"][data-v="midnight"]').innerText()).includes('3+') && (await p.locator('[data-act="cseg"][data-v="mole"]').innerText()).includes('4+'));
  await L.tap(p, '[data-act="cseg"][data-v="midnight"]');
  const lk = await p.locator('.lockcard').innerText().catch(() => '');
  t.ok(P('C25 locked Midnight: "Opens when your circle has 3 people. You have 1"'), lk.includes('Opens when your circle has 3 people. You have 1') && await p.locator('.lockcard [data-v="invite"]').count() === 1, lk);

  // C108 ? explainers and Help
  await L.tap(p, '[data-act="cseg"][data-v="pacts"]');
  t.ok(P('C108 the Pacts segment has a one-line explainer with a ?'), await p.locator('.segx .qi[data-v="pacts"]').count() === 1);
  await L.tap(p, '.segx .qi'); await p.waitForSelector('.sheet h2');
  t.ok(P('C108 ? opens a two-line explainer'), (await p.locator('.sheet h2').innerText()) === 'Pact');
  await L.tap(p, '.sheet [data-v="help"]'); await p.waitForSelector('#help-unlocks');
  const help = await p.locator('.sheet').innerText();
  t.ok(P('C108 Help lists every term, how unlocks work, safety and contact'), ['Mole', 'Midnight', 'Decode', 'Two-key drop', 'Trail', 'Mission', 'Call', 'League', 'Pot', 'Favor hours', 'Passport', 'Journey', 'Go dark', 'Handle', 'Ladder'].every(n => help.includes(n)) && /How unlocks work/i.test(help) && /Staying safe/i.test(help) && /Contact/i.test(help));
  t.ok(P('C25 Help shows each lock with its rule'), help.includes('Needs 3 people') && help.includes('After you meet'));
  await L.tap(p, '.sheet [data-act="tour-start"]');
  t.ok(P('C26 the tour replays from Help'), await p.locator('.tour').count() === 1);
  await L.tap(p, '[data-act="tour-skip"]'); await E.gone(p, '.tour');

  // C10 visit 2 on the same phone: straight to onboarding, no intro
  const p2 = await L.page(ctx, errors, 'ravi');
  await p2.goto(srv.url + '/?as=ravi'); await p2.waitForSelector('#ob-name');
  t.ok(P('C10 second visit skips the welcome and intro'), await p2.locator('.wel, .intro').count() === 0);
  // C23, C56 solo
  await L.step1(p2, 'Ravi'); await L.pickPlace(p2); await L.tap(p2, '[data-act="ob-next"]');
  t.ok(P('C23 "Look around first" says what you miss'), (await L.text(p2)).includes('You can join later from Circle. Most things need a circle.'));
  await L.tap(p2, '[data-act="ob-circle"][data-v="skip"]'); await L.tap(p2, '[data-act="ob-finish"][data-v="skip"]'); await p2.waitForSelector('nav.tabs');
  await p2.evaluate(() => localStorage.setItem('insane_tour', 'done')); await L.tap(p2, '[data-act="tab"][data-v="ledger"]');
  t.ok(P('C56 solo Ledger explains favours and pots and offers a circle'), (await L.text(p2)).includes('Favours and pots live in a circle') && await p2.locator('.empty-l [data-v="circle"]').count() === 1);

  t.ok(P('no script errors'), errors.length === 0, errors.join(' | '));
  await ctx.close();
}

module.exports = async function (t) {
  const browser = await BR.launch(), srv = await E.serveStatic({});
  try { await Promise.all(['Pixel 7', 'iPhone 13'].map(prof => run(t, browser, srv, prof))); } // two phones side by side, separate contexts
  finally { await browser.close(); await srv.close(); }
};
