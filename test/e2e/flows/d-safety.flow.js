// WS-D flows on Pixel 7 against the real server (DEV, temp DB, codes from the dev outbox):
//   F15 block and report a person; Midnight refuses “Kavya” (R-C37); unsafe dare refused; ⚑ flags pull a dare;
//       the owner's moderation queue (and a non-owner gets 403)
//   F16 circle admin: rename, remove (they lose the circle, can't get back), undo, transfer, close
//   F17 account: consent recorded at sign-up, devices list, revoke, change email, sign out everywhere,
//       delete for good → signed out with a notice (R-C59), same email starts fresh
// Every check polls for what the person would see; nothing sleeps.
'use strict';
const BR = require('../../lib/browser'), E = require('../../lib/e2e');

module.exports = async function run({ ok }) {
  const server = await E.startServer({ port: +process.env.FLOW_PORT || 0, owner: 'arjun@insane.test' }), B = server.url;
  const browser = await BR.launch();
  const P = {
    arjun: { name: 'Arjun', email: 'arjun@insane.test' },
    kavya: { name: 'كافيا Kavya', email: 'kavya@insane.test' },
    ravi: { name: 'Ravi', email: 'ravi@insane.test' },
  };
  const errors = [];
  async function open(who, key = 'page') {
    const p = P[who];
    const ctx = await browser.newContext(BR.profile('Pixel 7', { geolocation: { latitude: 13.0827, longitude: 80.2707, accuracy: 15 }, permissions: ['geolocation'], timezoneId: 'Asia/Kolkata', locale: 'en-IN' }));
    await BR.blockExternal(ctx); await E.actProbe(ctx);
    // past WS-B's intro and tour (their own flows test them)
    await ctx.addInitScript(() => { try { localStorage.setItem('insane_intro', '1'); localStorage.setItem('insane_tour', 'done'); } catch (e) { } });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(who + ': ' + e.message));
    await page.goto(B + '/'); p[key] = page; p[key + 'Ctx'] = ctx; return page;
  }
  const pg = who => P[who].page;
  const tap = async (who, sel, page = pg(who)) => { await E.idle(page); await E.tapOnce(page, sel); await E.idle(page); };
  const screen = async (who, page = pg(who)) => { await E.idle(page); return page.locator('body').innerText(); };
  const sees = (who, text, page) => async () => (await screen(who, page)).includes(text);
  const api = (who, route, body, page = pg(who)) => page.evaluate(async ([r, b]) => { const x = await fetch('/api/' + r, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: x.status, body: await x.json().catch(() => null) }; }, [route, body]);
  const evalIn = (who, fn, arg, page = pg(who)) => page.evaluate(fn, arg);
  const uid = who => evalIn(who, () => S.uid);
  async function signIn(who, page = pg(who), email = P[who].email) {
    await page.waitForSelector('#si-email'); await page.fill('#si-email', email); await tap(who, 'button:has-text("Email me a code")', page);
    await page.waitForSelector('#si-code'); await page.fill('#si-code', await E.outboxCode(B, email)); // v0.9: six digits submit on their own (C13); tapping Sign in would race it
    await page.waitForSelector('#ob-name, nav.tabs', { timeout: 15000 });
  }
  async function onboard(who, { create, join } = {}) {
    const page = pg(who);
    await page.fill('#ob-name', P[who].name); await page.selectOption('#ob-dobm', '6'); await E.idle(page); await page.selectOption('#ob-doby', '1995'); await E.idle(page); // WS-B: month + year (C17)
    if (who === 'arjun') {
      await ok('F17 consent: Next stays off and says why until the Terms are agreed', async () => (await page.locator('[data-act=ob-next]').isDisabled()) && /Agree to the Terms/.test(await page.locator('#ob-why').innerText()));
      await ok('F17 consent: the Terms, Privacy notice and Community rules are linked and open', async () => { const r = await page.evaluate(async () => Promise.all(['terms', 'privacy', 'rules'].map(k => fetch(document.querySelector(`a[href="/legal/${k}"]`).href).then(x => x.status)))); return r.every(s => s === 200); });
    }
    await page.check('#ob-consent'); await tap(who, '[data-act=ob-next]');
    await page.waitForSelector('#lp-q-home'); await tap(who, '[data-act=lp-gps]'); await E.until(sees(who, 'from GPS'), { what: who + ' GPS' });
    await tap(who, '[data-act=lp-size][data-v="2"]'); await tap(who, '[data-act=lp-radius][data-v="5"]'); await tap(who, '[data-act=ob-next]');
    if (create) { await page.fill('#ob-cname', create); await tap(who, '[data-act=ob-circle][data-v=create]'); }
    else if (join) { await page.fill('#ob-code', join); await tap(who, '[data-act=ob-circle][data-v=join]'); }
    else await tap(who, '[data-act=ob-circle][data-v=skip]');
    await page.waitForSelector('#ob-mind', { timeout: 8000 }); await tap(who, '[data-act=ob-finish][data-v=skip]');
    await page.waitForSelector('nav.tabs', { timeout: 15000 }); await E.idle(page);
  }
  const tab = (who, t, page) => tap(who, `[data-act="tab"][data-v="${t}"]`, page);
  const cseg = (who, s) => tap(who, `[data-act="cseg"][data-v="${s}"]`);
  const toastHas = (who, s, page = pg(who)) => E.until(async () => ((await page.locator('.toast').innerText().catch(() => '')) || '').includes(s), { what: `toast "${s}" for ${who}`, timeout: 8000 }).then(() => true, () => false);

  try {
    /* ---------- sign-up: three people, one circle ---------- */
    for (const w of ['arjun', 'kavya', 'ravi']) { await open(w); await signIn(w); }
    await onboard('arjun', { create: 'Third Floor' });
    const code = await E.until(() => evalIn('arjun', () => S.circle && S.circle.code), { what: 'circle code' });
    await onboard('kavya', { join: code }); await onboard('ravi', { join: code });
    const cid = await evalIn('arjun', () => S.me.circle), U = { arjun: await uid('arjun'), kavya: await uid('kavya'), ravi: await uid('ravi') };
    { const me = (await api('arjun', 'get', { path: 'people/' + U.arjun })).body.doc, other = (await api('kavya', 'get', { path: 'people/' + U.arjun })).body.doc;
      ok('F17 consent: sign-up stored the consent version and time, and the age attestation, server-side', me.consent && me.consent.v === '2026-10-draft' && me.consent.at > 0 && me.adult === true && me.adultAt > 0, JSON.stringify(me.consent));
      ok('F17 consent: nobody else can read your consent record', other && !('consent' in other) && !('adultAt' in other)); }

    /* ---------- F15: Midnight names (R-C37) ---------- */
    await tab('arjun', 'circle'); await cseg('arjun', 'midnight');
    await pg('arjun').fill('#mn-text', 'Kavya, you are the funniest person here'); await tap('arjun', '[data-act=mn-send]');
    ok('F15 R-C37 Midnight: “Kavya” is blocked in the page when her name is “كافيا Kavya”', await toastHas('arjun', 'Blocked'));
    { const r = await api('arjun', 'set', { path: `circles/${cid}/midnight/hand1`, data: { text: 'Kavya, you are the funniest person here', releaseAt: 0 } });
      ok('F15 R-C37 Midnight: and by the server, for a hand-made call (names_blocked)', r.status === 400 && r.body.reason === 'names_blocked', JSON.stringify(r.body)); }
    { const r = await api('arjun', 'set', { path: `circles/${cid}/midnight/hand2`, data: { text: 'k\u200bav\u200cya is brave', releaseAt: 0 } }); ok('F15 Midnight: zero-width letters don’t get it past', r.body && r.body.reason === 'names_blocked'); }

    /* ---------- F15: block ---------- */
    const city = await evalIn('ravi', () => S.me.city);
    await api('ravi', 'set', { path: 'posts/rp1', data: { city, circle: cid, cname: 'Third Floor', by: U.ravi, name: 'NEON', kind: 'Made', text: 'Ravi’s post about chai', at: Date.now(), flags: [] } });
    await api('ravi', 'set', { path: `circles/${cid}/threads/general/msgs/rm1`, data: { by: U.ravi, name: 'Ravi', text: 'Ravi says hi in General', at: Date.now() } });
    await ok('F15 before blocking, Kavya sees Ravi’s post in the City', async () => (await evalIn('kavya', () => S.posts.map(p => p.text))).includes('Ravi’s post about chai'));
    await tab('kavya', 'circle'); await tap('kavya', '[data-act="cseg"][data-v="people"]');
    await tap('kavya', `[data-act=sheet][data-v=person][data-id="${U.ravi}"]`);
    await ok('F15 tapping Ravi opens Block and Report', async () => /Block Ravi/.test(await pg('kavya').locator('.sheet').innerText()));
    await tap('kavya', '[data-act=block][data-on="1"]');
    ok('F15 block: “They aren’t told.”', await toastHas('kavya', 'Blocked Ravi'));
    await ok('F15 block: Ravi’s post disappears from Kavya’s City, live', async () => !(await evalIn('kavya', () => S.posts.map(p => p.text))).includes('Ravi’s post about chai'));
    { const r = await api('kavya', 'query', { col: `circles/${cid}/threads/general/msgs` }); ok('F15 block: the server leaves Ravi’s messages out of what Kavya reads', r.body.docs.every(d => d.data.by !== U.ravi), JSON.stringify(r.body.docs.map(d => d.data.by))); }
    { const r = await api('ravi', 'set', { path: `circles/${cid}/dares/rd1`, data: { text: 'Sing in the lift', level: 2, to: U.kavya } }); ok('F15 block: Ravi can’t dare Kavya', r.status === 403, r.status); }
    { const r = await api('ravi', 'query', { col: 'posts', where: [['city', '==', city]] }); const k = await api('kavya', 'set', { path: 'posts/kp1', data: { city, by: U.kavya, name: 'KITE', kind: 'Made', text: 'Kavya’s post', at: Date.now(), flags: [] } }); const r2 = await api('ravi', 'query', { col: 'posts', where: [['city', '==', city]] });
      ok('F15 block: and Ravi doesn’t see Kavya’s posts either', k.status === 200 && r2.body.docs.every(d => d.data.by !== U.kavya), JSON.stringify(r.body.docs.length)); }
    await ok('F15 block: Ravi shows as blocked in Kavya’s circle list', sees('kavya', 'blocked'));

    /* ---------- F15: report → the owner's queue ---------- */
    await tap('kavya', `[data-act=sheet][data-v=person][data-id="${U.ravi}"]`); await tap('kavya', '[data-act=rep-cat][data-v=harassment]');
    await pg('kavya').fill('#rep-note', 'Keeps messaging after I said stop'); await tap('kavya', '[data-act=report]');
    ok('F15 report: sent', await toastHas('kavya', 'Reported'));
    { const r = await api('kavya', 'admin/queue', {}); ok('F15 moderation: a non-owner gets 403 from the queue', r.status === 403, r.status); }
    await tab('arjun', 'you'); await tap('arjun', '[data-act=mod-open]');
    await ok('F15 moderation: the owner sees the report about Ravi', async () => { const s = await pg('arjun').locator('.sheet').innerText(); return /Reports · 1/i.test(s) && s.includes('Ravi') && s.includes('Keeps messaging'); }, async () => pg('arjun').locator('.sheet').innerText());
    await tap('arjun', '[data-act=mod-report]');
    await ok('F15 moderation: resolving it clears the queue', async () => /Reports · 0/i.test(await pg('arjun').locator('.sheet').innerText()));
    await pg('arjun').keyboard.press('Escape');

    /* ---------- F15: unsafe dares ---------- */
    await tab('arjun', 'circle'); await cseg('arjun', 'plans'); await tap('arjun', '.btns [data-act=sheet][data-v=dare]');
    await ok('F15 dares: the scale reads “How bold, 1 to 6”', async () => /How bold/.test(await pg('arjun').locator('.sheet').innerText()));
    await pg('arjun').fill('#dr-text', 'Drink a beer in one go'); await tap('arjun', '[data-act=dare-add]');
    ok('F15 dares: an alcohol dare is refused with a reason', await toastHas('arjun', 'Nothing with alcohol'));
    await pg('arjun').keyboard.press('Escape');
    { const r = await api('ravi', 'set', { path: `circles/${cid}/dares/x9`, data: { text: 'Run across the road at rush hour', level: 3 } }); ok('F15 dares: the server refuses it too (unsafe_dare)', r.status === 400 && r.body.reason === 'unsafe_dare', JSON.stringify(r.body)); }
    await api('ravi', 'set', { path: `circles/${cid}/dares/jar1`, data: { text: 'Sing in the lift', level: 2 } });
    await ok('F15 dares: Arjun sees the jar dare with ⚑ Not safe', async () => (await screen('arjun')).includes('Sing in the lift') && (await pg('arjun').locator('[data-act=dare-flag][data-v=jar1]').count()) === 1);
    await tap('arjun', '[data-act=dare-flag][data-v=jar1]');
    await ok('F15 dares: one flag hides it for Arjun', async () => !(await screen('arjun')).includes('Sing in the lift'));
    { const before = (await api('ravi', 'query', { col: `circles/${cid}/dares` })).body.docs.some(d => d.id === 'jar1');
      await api('ravi', 'update', { path: `circles/${cid}/dares/jar1`, data: { flags: [U.ravi] } });
      const after = (await api('ravi', 'query', { col: `circles/${cid}/dares` })).body.docs.some(d => d.id === 'jar1');
      ok('F15 dares: two flags pull it from the jar for the whole circle', before && !after); }
    { const r = await api('arjun', 'admin/queue', {}); ok('F15 moderation: the pulled dare is in the owner’s queue', r.body.dares.some(d => d.text === 'Sing in the lift' && d.pulled), JSON.stringify(r.body.dares)); }

    /* ---------- F16: circle admin ---------- */
    await cseg('arjun', 'people');
    await ok('F16 the owner has Settings; nobody else does', async () => (await pg('arjun').locator('[data-act=sheet][data-v=circle-admin]').count()) === 1 && (await pg('kavya').locator('[data-act=sheet][data-v=circle-admin]').count()) === 0);
    await tap('arjun', '[data-act=sheet][data-v=circle-admin]'); await pg('arjun').fill('#ca-name', 'Fourth Floor'); await tap('arjun', '[data-act=c-rename]');
    await ok('F16 rename: everyone sees “Fourth Floor”, live', async () => (await evalIn('kavya', () => S.circle && S.circle.name)) === 'Fourth Floor');
    { const r = await api('kavya', 'circle/rename', { cid, name: 'Kavya’s now' }); const r2 = await api('kavya', 'update', { path: 'circles/' + cid, data: { name: 'Sneaky', owner: U.kavya } });
      ok('F16 rename: a member can’t, by route or by a raw update', r.status === 403 && (await api('arjun', 'get', { path: 'circles/' + cid })).body.doc.name === 'Fourth Floor' && r2.status === 200 && (await api('arjun', 'get', { path: 'circles/' + cid })).body.doc.owner === U.arjun); }
    await pg('arjun').keyboard.press('Escape');
    await tap('arjun', `[data-act=sheet][data-v=person][data-id="${U.ravi}"]`); await tap('arjun', `[data-act=c-remove][data-v="${U.ravi}"]`); await tap('arjun', `[data-act=c-remove][data-v="${U.ravi}"]`);
    ok('F16 remove: confirmed with a 24 h undo', await toastHas('arjun', 'undo it for 24 hours'));
    await ok('F16 remove: Ravi’s phone drops the circle, live', async () => (await evalIn('ravi', () => S.me && S.me.circle)) === null && (await screen('ravi')).includes('Start a circle, or join one'));
    { const r1 = await api('ravi', 'query', { col: `circles/${cid}/threads` }), r2 = await api('ravi', 'get', { path: 'circles/' + cid }), r3 = await api('ravi', 'update', { path: 'people/' + U.ravi, data: { circle: cid } });
      ok('F16 remove: Ravi can’t read the circle, and can’t put himself back', r1.status === 403 && r2.body.doc === null && r3.status === 403, [r1.status, JSON.stringify(r2.body), r3.status].join(' ')); }
    await tap('arjun', '[data-act=sheet][data-v=circle-admin]'); await tap('arjun', `[data-act=c-unremove][data-v="${U.ravi}"]`);
    await ok('F16 undo: Ravi is back in, live', async () => (await evalIn('ravi', () => S.me && S.me.circle)) === cid);
    await pg('arjun').keyboard.press('Escape');
    await tap('arjun', `[data-act=sheet][data-v=person][data-id="${U.kavya}"]`); await tap('arjun', `[data-act=c-transfer][data-v="${U.kavya}"]`); await tap('arjun', `[data-act=c-transfer][data-v="${U.kavya}"]`);
    await ok('F16 transfer: Kavya runs the circle now, and gets Settings', async () => { await tab('kavya', 'circle'); await tap('kavya', '[data-act="cseg"][data-v="people"]'); return (await pg('kavya').locator('[data-act=sheet][data-v=circle-admin]').count()) === 1; });
    { const r = await api('arjun', 'circle/remove', { cid, uid: U.ravi }); ok('F16 transfer: Arjun can’t remove people any more', r.status === 403, r.status); }
    await tap('kavya', '[data-act=sheet][data-v=circle-admin]'); await pg('kavya').fill('#ca-close', 'Fourth Floor'); await tap('kavya', '[data-act=c-close]');
    await ok('F16 close: the circle is gone for all three, live', async () => { for (const w of ['arjun', 'kavya', 'ravi']) if ((await evalIn(w, () => S.me && S.me.circle)) !== null) return false; return true; });
    { const r = await api('ravi', 'get', { path: 'codes/' + code }); ok('F16 close: the old invite code no longer works', r.body.doc === null); }

    /* ---------- F17: devices, revoke, change email ---------- */
    const laptop = await open('kavya', 'laptop'); await signIn('kavya', laptop);
    await tab('kavya', 'you'); await tap('kavya', '[data-act=sess-load]');
    await ok('F17 devices: Kavya sees two signed-in devices, this one marked', async () => (await pg('kavya').locator('.sess').count()) === 2 && (await screen('kavya')).includes('this device'));
    await tap('kavya', '[data-act=sess-revoke]');
    await ok('F17 revoke: the other device is signed out on the server', async () => (await laptop.evaluate(() => fetch('/api/hello').then(r => r.json()))).signedIn === false);
    await ok('F17 revoke: one device left', async () => (await pg('kavya').locator('.sess').count()) === 1);
    await tap('kavya', '[data-act=chg-open]'); await pg('kavya').fill('#chg-email', 'kavya.new@insane.test'); await tap('kavya', 'form[data-form=chg-start] button[type=submit]');
    await pg('kavya').waitForSelector('#chg-code'); await pg('kavya').fill('#chg-code', await E.outboxCode(B, 'kavya.new@insane.test')); await tap('kavya', 'form[data-form=chg-verify] button[type=submit]');
    await ok('F17 change email: the account now signs in as the new address', async () => (await evalIn('kavya', () => fetch('/api/hello').then(r => r.json()))).email === 'kavya.new@insane.test');

    /* ---------- F17: sign out everywhere ---------- */
    await tab('arjun', 'you'); await tap('arjun', '[data-act=sess-all]'); await tap('arjun', '[data-act=sess-all]');
    await ok('F17 sign out everywhere: Arjun lands on sign-in, told why', async () => (await pg('arjun').locator('#si-email').count()) === 1 && (await screen('arjun')).includes('You were signed out'));

    /* ---------- F17: delete for good (R-C59) ---------- */
    await tab('ravi', 'you'); await tap('ravi', '[data-act=del-ask]');
    await ok('F17 delete: the confirmation says messages stay as “Former member”', sees('ravi', 'Former member'));
    await tap('ravi', '[data-act=del-yes]');
    await ok('F17 R-C59 delete signs Ravi out: the sign-in screen, not onboarding, says the account is deleted', async () => (await pg('ravi').locator('#si-email').count()) === 1 && (await pg('ravi').locator('#ob-name').count()) === 0 && (await screen('ravi')).includes('Your account is deleted'), '', 15000);
    { const h = await evalIn('ravi', () => fetch('/api/hello').then(r => r.json())); ok('F17 R-C59 the server agrees: signed out', h.signedIn === false); }
    { const r = await api('kavya', 'get', { path: 'people/' + U.ravi }); ok('F17 delete: Ravi’s profile is gone', r.body.doc === null); }
    await signIn('ravi');
    await ok('F17 delete: the same email later starts a brand-new account', async () => (await pg('ravi').locator('#ob-name').count()) === 1 && (await uid('ravi')) !== U.ravi);
    ok('F15–F17 no script errors on any phone', errors.length === 0, errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); await server.close(); }
};
