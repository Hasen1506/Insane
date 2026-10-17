// WS-C flows, server mode, MAX_CIRCLES=2 (so the limit the page shows is the server's, not a constant):
// F02 Arjun (Pixel 7) starts a circle: the invite card is Home's top card, Share goes to navigator.share,
//     then to WhatsApp, then to the clipboard (C27, C28); the toast never carries the code and leaves with the tab (C73).
// F16 Kavya (iPhone 13, "كافيا Kavya") has her own circle, opens Arjun's invite link and is in two; she
//     switches between them and nothing from one is ever on screen under the other's name (C36); at the
//     server's limit she can't join a third, in the page or by a raw write.
// F05 chat: a double send stores one message; offline, it stays as "Not sent · Retry" and Retry sends it once;
//     messages are dir=auto (C38). F08 pacts: this week as M T W T F S S (C40). C20 long names. C34 no dots.
// Condition waits only (E.until / ok(name, fn)); the toast's own 3.2 s timer is waited on, never slept.
'use strict';
const BR = require('../../lib/browser'), E = require('../../lib/e2e');
const L = require('./_b-lib');

const LONG = 'Meera Krishnamurthy-Venkataraghavan 🌶️🔥 Iyer';
module.exports = async function ({ ok }) {
  const port = await L.freePort();
  const server = await E.startServer({ port, owner: 'owner@x.com', env: { MAX_CIRCLES: '2' } }), B = server.url;
  const browser = await BR.launch(); const errors = [];
  const init = () => {
    localStorage.setItem('insane_intro', '1'); localStorage.setItem('insane_tour', 'done'); localStorage.setItem('insane_unlock_all', '1');
    window.__shared = []; window.__opened = [];
    Object.defineProperty(navigator, 'share', { configurable: true, writable: true, value: async d => { window.__shared.push(d); } });
    window.open = u => { window.__opened.push(String(u)); return window.__openOk ? {} : null; };
  };
  const signIn = async (p, email) => {
    await p.goto(B + '/'); await p.waitForSelector('#si-email'); await p.fill('#si-email', email);
    await L.tap(p, 'button:has-text("Email me a code")'); await p.waitForSelector('#si-code');
    await p.fill('#si-code', await E.outboxCode(B, email)); await p.waitForSelector('#ob-name, nav.tabs', { timeout: 15000 });
  };
  const onboard = async (p, name, cname, mind) => {
    await L.step1(p, name); await L.pickPlace(p); await L.tap(p, '[data-act="ob-next"]');
    await p.fill('#ob-cname', cname); await E.idle(p); await L.tap(p, '[data-act="ob-circle"][data-v="create"]');
    if (mind) { await p.waitForSelector('#ob-mind'); await L.tap(p, '[data-act="ob-lane"][data-v="need"]'); await p.fill('#ob-mind', mind); await E.idle(p); await L.tap(p, '[data-act="ob-finish"][data-v="mind"]'); }
    else await L.tap(p, '[data-act="ob-finish"][data-v="skip"]');
    await p.waitForSelector('nav.tabs');
  };
  const tab = (p, t) => L.tap(p, `nav.tabs [data-act="tab"][data-v="${t}"]`);
  const app = p => p.locator('#app').innerText();
  const st = (p, f, arg) => p.evaluate(f, arg);
  try {
    /* ---------- Arjun, Pixel 7: starts a circle; the invite card ---------- */
    const actx = await L.context(browser, 'Pixel 7', { init });
    const a = await L.page(actx, errors, 'arjun');
    await signIn(a, 'arjun@gmail.com');
    await a.waitForSelector('#ob-name'); await a.fill('#ob-name', LONG + ' and more words here');
    ok('C20 the name box stops at 40 characters', (await a.inputValue('#ob-name')).length <= 40);
    await a.fill('#ob-name', '');
    await onboard(a, LONG, 'Mylapore Mad Hatters', 'run 3 times a week');
    const code = await E.until(() => st(a, () => S.circle && S.circle.code), { what: 'circle code' });
    await ok('C20 a 41+ character name is kept whole up to a word, never cut mid-emoji', async () => { const n = await st(a, () => S.me.name); return n && n.length <= 40 && !/[\uD800-\uDBFF]$/.test(n) && LONG.startsWith(n); }, async () => st(a, () => S.me.name));
    ok('C73 the toast never carries the invite code', !(await st(a, () => S.toast || '')).includes(code), await st(a, () => S.toast));
    await ok('C27 Home: the top card is "Bring your people in" with the code', async () => (await a.locator('#v .card').first().innerText()).includes('Bring your people in') && (await a.locator('#v .card').first().innerText()).includes(code));
    ok('C27 the card says how many more unlock Midnight', (await a.locator('#v .card.invite').innerText()).includes('2 more to unlock Midnight'));
    const wa = await a.locator('#v .card.invite a[href^="https://wa.me/"]').getAttribute('href');
    ok('C28 WhatsApp is one tap: wa.me with the link and the code', !!wa && decodeURIComponent(wa).includes('#c' + code) && decodeURIComponent(wa).includes('(code ' + code + ')'), wa);
    await L.tap(a, '#v .card.invite [data-act="share"]');
    await ok('C28 Share opens the phone’s share sheet (navigator.share) with the invite URL', async () => { const s = await st(a, () => window.__shared); return s.length === 1 && s[0].url.endsWith('/#c' + code) && s[0].text.includes(code); }, async () => JSON.stringify(await st(a, () => window.__shared)));
    await st(a, () => { delete navigator.share; window.__openOk = true; });
    await L.tap(a, '#v .card.invite [data-act="share"]');
    await ok('C28 no share sheet: WhatsApp opens instead', async () => { const o = await st(a, () => window.__opened); return o.length === 1 && o[0].startsWith('https://wa.me/?text='); });
    await st(a, () => { window.__openOk = false; });
    await actx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: B });
    await L.tap(a, '#v .card.invite [data-act="share"]');
    await ok('C28 popups blocked too: the link is copied', async () => (await st(a, () => S.toast || '')).startsWith('Copied') || (await st(a, () => S.toast || '')).startsWith('Code:'));
    ok('C73 one toast region, aria-live, outside the redrawn screen', await a.locator('#toasts[aria-live="polite"]').count() === 1 && await a.locator('#app .toast, #layer .toast').count() === 0 && await a.locator('.toast').count() === 1);
    await tab(a, 'circle');
    ok('C73 the toast does not follow you to another tab', await a.locator('.toast').count() === 0);
    await L.tap(a, '[data-act="cseg"][data-v="pacts"]');
    await ok('C40 pacts: this week as M T W T F S S, with what’s left in words', async () => (await a.locator('.days.wk i').count()) === 7 && (await a.locator('.days.wk').first().innerText()).replace(/\s/g, '') === 'MTWTFSS' && /more by Sunday/.test(await app(a)));
    await L.tap(a, '.days.wk ~ .btns [data-act="tick"], [data-act="tick"]');
    await ok('C40 a tick fills today in the strip', async () => (await a.locator('.days.wk i.y.t').count()) >= 1);
    await tab(a, 'today');
    ok('C34 a brand-new person has no dots', await a.locator('nav .dot').count() === 0);

    /* ---------- Kavya, iPhone 13: her own circle, then Arjun's link ---------- */
    const kctx = await L.context(browser, 'iPhone 13', { init });
    const k = await L.page(kctx, errors, 'kavya');
    await signIn(k, 'kavya@gmail.com'); await onboard(k, 'كافيا Kavya', 'Family', null);
    const famId = await E.until(() => st(k, () => S.circle && S.circle.id), { what: 'Family id' });
    await L.tap(k, '[data-act="tab"][data-v="circle"]');
    await L.tap(k, '[data-act="open"][data-type="thread"][data-v="general"]'); await k.waitForSelector('#m-text');
    await k.fill('#m-text', 'family secret: amma’s birthday'); await E.idle(k);
    await k.locator('#m-text').press('Enter'); await k.locator('form[data-form="send"] button').click({ force: true }).catch(() => { }); await E.idle(k);
    await ok('C38 a double send (Enter, then the button) stores one message', async () => (await st(k, () => S.msgs.filter(m => m.text.startsWith('family secret')).length)) === 1, async () => JSON.stringify(await st(k, () => S.msgs.map(m => m.text))));
    ok('C38 messages read in their own direction (dir=auto)', await k.locator('.msg .mt[dir="auto"]').count() >= 1 && (await k.getAttribute('#m-text', 'dir')) === 'auto');
    await kctx.setOffline(true);
    await k.fill('#m-text', 'سلام from the train'); await E.idle(k); await k.locator('#m-text').press('Enter'); await E.idle(k);
    await ok('C38 offline: the message stays, marked Not sent, with Retry', async () => (await k.locator('.msg.no').count()) === 1 && (await k.locator('.msg.no').innerText()).includes('سلام from the train'));
    await kctx.setOffline(false);
    await L.tap(k, '[data-act="send-retry"]');
    await ok('C38 Retry sends it, once', async () => (await k.locator('.msg.no, .msg.sending').count()) === 0 && (await st(k, () => S.msgs.filter(m => m.text === 'سلام from the train').length)) === 1);
    await L.tap(k, '[data-act="close"]');

    await k.goto(B + '/#c' + code); await k.waitForSelector('nav.tabs');
    await ok('C36 the invite link adds a second circle and puts it on screen', async () => (await st(k, () => [S.me.circle, (S.me.circles || []).length, S.circle && S.circle.name].join('|'))) === (await st(a, () => S.circle.id)) + '|2|Mylapore Mad Hatters', async () => st(k, () => JSON.stringify([S.me.circle, S.me.circles, S.circle && S.circle.name])));
    ok('C36 the header names the circle on screen', (await k.locator('header .where').innerText()).includes('Mylapore Mad Hatters'));

    /* Arjun plans something in his circle; it must only ever show in it */
    await tab(a, 'circle'); await L.tap(a, '[data-act="cseg"][data-v="plans"]'); await L.tap(a, '[data-act="np-toggle"]');
    await a.fill('#pl-what', 'Climbing at Mylapore wall'); await a.fill('#pl-when', 'Sat afternoon'); await E.idle(a); await L.tap(a, '[data-act="pl-create"]');
    await tab(k, 'today');
    await ok('C30 Kavya: the plan she must answer is under Needs you, and counted', async () => { const t = await app(k); const n = await st(k, () => homeItems().filter(i => i.n).length); return t.includes('Climbing at Mylapore wall') && n >= 1 && t.includes(n + (n > 1 ? ' things need you' : ' thing needs you')); }, async () => (await app(k)).slice(0, 300));
    const order = await st(k, () => homeItems().map(i => i.k));
    ok('C30 Home order: needs before the daily dare, the Decode and circle news', order.indexOf('needs') > -1 && ['dare', 'decode', 'news', 'drops'].every(x => order.indexOf(x) === -1 || order.lastIndexOf('needs') < order.indexOf(x)), order.join(','));
    await tab(k, 'circle');
    ok('C36 the Circle tab offers the switch', (await app(k)).includes('2 circles · switch'));

    /* switch to Family: nothing of Arjun's circle on screen, on any tab */
    await L.tap(k, 'header .where'); await k.waitForSelector('.sheet [data-act="c-switch"]');
    ok('C36 the switcher lists both circles, the one on screen marked', (await k.locator('.sheet [data-act="c-switch"]').count()) === 2 && (await k.locator('.sheet .thr.on').innerText()).includes('Mylapore'));
    ok('C36 at the server’s limit (MAX_CIRCLES=2) there is no "join another", and it says so', (await k.locator('.sheet').innerText()).includes('That’s 2, the most there is') && await k.locator('.sheet [data-v="circle-start"]').count() === 0);
    await L.tap(k, `.sheet [data-act="c-switch"][data-v="${famId}"]`);
    const isolated = async (p, mustNot, must) => { for (const t of ['today', 'circle', 'ledger']) { await tab(p, t); await E.stable(p); const x = await app(p); if (mustNot.some(s => x.includes(s)) || (t === 'circle' && !must.every(s => x.includes(s)))) return false; } return true; };
    await ok('C36 in Family: header, Home, Circle and Ledger show nothing of Mylapore Mad Hatters', async () => (await k.locator('header .where').innerText()).includes('Family') && isolated(k, ['Climbing at Mylapore wall', 'Mylapore Mad Hatters', 'Krishnamurthy'], ['Family']), async () => (await app(k)).slice(0, 300), 15000);
    await ok('C36 in Family the state holds only Family: members and threads', async () => st(k, cid => S.members.every(m => (m.circles || []).includes(cid)) && S.members.length === 1 && S.threads.every(t => !/Climbing/.test(t.title)), famId), async () => st(k, () => JSON.stringify({ me: [S.me.circle, S.me.circles], m: S.members.map(m => [m.name, m.circles]), t: S.threads.map(t => t.title) })));
    await tab(k, 'circle'); await L.tap(k, '[data-act="cseg"][data-v="chat"]');
    ok('C36 Family’s own thread is there, with its last message', (await app(k)).includes('from the train'));
    await L.tap(k, 'header .where'); await L.tap(k, '.sheet [data-act="c-switch"]:not([data-v="' + famId + '"])');
    await ok('C36 back in Mylapore Mad Hatters: the plan is there, Family’s message is not', async () => { await tab(k, 'circle'); await L.tap(k, '[data-act="cseg"][data-v="plans"]'); const x = await app(k); await L.tap(k, '[data-act="cseg"][data-v="chat"]'); return x.includes('Climbing at Mylapore wall') && !(await app(k)).includes('from the train'); }, '', 15000);

    /* the server's limit: a third circle is refused in the page and by a raw write */
    await tab(a, 'circle'); await L.tap(a, 'header .where'); await L.tap(a, '.sheet [data-v="circle-start"]');
    await a.fill('#cs-name', 'Flatmates'); await E.idle(a); await L.tap(a, '[data-act="cs-create"]');
    const flat = await E.until(() => st(a, () => S.me.circle !== S.circle?.id ? null : (S.me.circles || []).length === 2 && S.circle.name === 'Flatmates' && S.circle.code), { what: 'Arjun in Flatmates' });
    ok('C36 Arjun starts a second circle; it is on screen, the first kept', !!flat);
    await k.goto(B + '/#c' + flat); await k.waitForSelector('nav.tabs');
    await ok('C36 Kavya at 2 of 2: the page refuses a third, saying the limit', async () => (await st(k, () => S.toast || '')).includes('You’re in 2 circles, the most there is'), async () => st(k, () => S.toast));
    const raw = await st(k, async (c3) => { try { await S.db.doc('people/' + S.uid).update({ circles: [...S.me.circles, c3] }); return 'accepted'; } catch (e) { return e.code + ' ' + e.message; } }, await st(a, () => S.circle.id));
    ok('C36 the server refuses a raw third circle too', /up to 2 circles/.test(raw), raw + ' ' + await st(k, () => JSON.stringify([S.me.circle, S.me.circles])));
    ok('no page errors', errors.length === 0, errors.join(' | '));
  } finally { await browser.close(); await server.close(); }
};
