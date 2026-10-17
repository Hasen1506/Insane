// Five people in one browser, each in their own tab, sharing the app's local store (the claude.ai / demo mode).
// Port of v0.8's app/test/e2e.js (83 checks, IDs V08-L01..), run against the BUILT app/index.html.
// WS-0 port: only the plumbing changed (paths, browser, external hosts). The steps and assertions are v0.8's,
// including its fixed waits; replacing those with condition waits is F01-F20 work (WS-J).
// Run: node test/e2e/legacy-local.js
//   APP=path/to/index.html (default app/index.html)  APP_DIR=dir with data/ (default app/)  APP_PORT (default: any free)
//   CHROMIUM / CHROME, PW: see test/lib/browser.js.  OUT: screenshot dir (default test/out/e2e-local)
const path = require('path'), fs = require('fs');
const BR = require('../lib/browser'), E = require('../lib/e2e');
const OUT = process.env.OUT || path.join(E.REPO, 'test', 'out', 'e2e-local');
fs.mkdirSync(OUT, { recursive: true });
let BASE, srv;
const ANS = ['WATERLOO', 'MARKET', 'CARD', 'MUSEUM', 'BRIDGE', 'STATION', 'GARDEN', 'TOWER'];
const results = []; const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', 'V08-L' + String(results.length + 1).padStart(2, '0') + ' ' + name, extra]); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  srv = await E.serveStatic(); BASE = srv.url;
  const browser = await BR.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await BR.blockExternal(ctx); await E.actProbe(ctx);
  const errors = global.ERRS = [];
  const open = async who => { const p = await ctx.newPage(); (global.PAGES = global.PAGES || []).push(p); p.on('pageerror', e => errors.push(who + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|404|ERR_BLOCKED_BY_CLIENT/.test(m.text())) errors.push(who + ': ' + m.text()); }); await p.goto(BASE + '/?as=' + who); await p.waitForSelector('#app h1, #app .mark'); return p; };
  // WS-0: v0.8's helpers, made safe on a slow machine: a tap never fires twice (E.tapOnce) and is followed by
  // a wait for the tapped action to finish and draw (E.idle). The v0.8 fixed waits stay as minimums.
  const click = async (p, sel) => { await p.bringToFront(); const how = await E.tapOnce(p, sel, { timeout: 4000 }); if (process.env.DEBUG_PIN && how !== 'click') console.log('DBG', how, sel); await wait(120); await E.idle(p); };
  const text = async p => { await p.bringToFront(); await wait(60); await E.idle(p); return p.locator('#app').innerText(); };
  const store = p => p.evaluate(() => JSON.parse(localStorage.getItem('insane_local_db') || '{}'));
  const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });
  const tab = (p, t) => click(p, `[data-act="tab"][data-v="${t}"]`);
  const sheet = p => p.locator('.sheet').innerText();
  const closeT = async p => { if (await p.locator('[data-act="close"]').count()) await click(p, '[data-act="close"]'); };
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const dbg = async (p, tag) => { if (process.env.DEBUG_PIN) console.log('DBG', tag, Date.now() % 100000, await p.evaluate(() => JSON.stringify({ sheet: S.ui.sheet, dloc: S.ui.dloc && { pasting: S.ui.dloc.pasting, paste: S.ui.dloc.paste, lat: S.ui.dloc.lat }, forms: document.querySelectorAll('form[data-form="lp-use"]').length }))); };
  const pin = async (p, k, ll) => { await dbg(p, 'pin0'); await click(p, `[data-act="lp-paste"][data-k="${k}"]`); await dbg(p, 'pin1'); await p.waitForSelector('#lp-p-' + k); await p.fill('#lp-p-' + k, ll); await dbg(p, 'pin2'); await click(p, `form[data-form="lp-use"][data-k="${k}"] button`); };
  // Two phones face to face: one shows a code, the other types it.
  async function meet(a, b) {
    for (const p of [a, b]) { await p.bringToFront(); await p.keyboard.press('Escape'); }
    await click(a, '[data-act="make"]'); await click(a, '[data-act="mk"][data-v="meet"]'); await wait(200); if (await a.locator('[data-act="pair-show"]').count()) await click(a, '[data-act="pair-show"]'); await wait(400);
    const c = (await a.locator('.sheet .big').innerText()).trim();
    await click(b, '[data-act="make"]'); await click(b, '[data-act="mk"][data-v="meet"]'); await b.fill('#pair-in', c); await b.press('#pair-in', 'Enter'); await wait(800);
    await click(a, '[data-act="sheet-close"]'); await b.keyboard.press('Escape'); await wait(300);
  }

  // Where each person lives: real coordinates, pasted the way someone pastes from their maps app.
  const SPOT = { Alice: '38.7139, -9.1334', Bob: '38.7107, -9.1365', Carol: '38.7069, -9.1600', Erin: '38.7570, -9.2240', Dave: '53.4794, -2.2453', Fay: '38.7160, -9.1400', Gus: '38.7200, -9.1450' };
  async function onboard(p, name, { search = 'Lisbon', size = 2, radius = 5, exact = false, lane = 'need', mind = '', stake = 0, create, join, snap }) {
    await p.waitForSelector('#ob-name'); await p.fill('#ob-name', name); await p.check('#ob-age');
    if (snap) await shot(p, '01-welcome');
    await click(p, '[data-act="ob-next"]');
    await p.fill('#lp-q-home', search); await p.waitForSelector('.res'); await click(p, '.res');
    await click(p, '[data-act="lp-paste"]'); await p.fill('#lp-p-home', SPOT[name]); await click(p, 'form[data-form="lp-use"] button');
    if (exact) await click(p, '[data-act="lp-prec"][data-v="exact"]'); else await click(p, `[data-act="lp-size"][data-v="${size}"]`);
    await click(p, `[data-act="lp-radius"][data-v="${radius}"]`);
    if (snap) await shot(p, '02-city');
    await click(p, '[data-act="ob-next"]');
    if (create) { await p.fill('#ob-cname', create); if (snap) await shot(p, '03-circle'); await click(p, '[data-act="ob-circle"][data-v="create"]'); }
    else if (join) { await p.fill('#ob-code', join); await click(p, '[data-act="ob-circle"][data-v="join"]'); }
    else await click(p, '[data-act="ob-circle"][data-v="skip"]');
    await p.waitForSelector('#ob-mind');
    if (mind) { await click(p, `[data-act="ob-lane"][data-v="${lane}"]`); await p.fill('#ob-mind', mind); if (stake) await click(p, `[data-act="ob-stake"][data-v="${stake}"]`); if (snap) await shot(p, '04-mind'); await click(p, '[data-act="ob-finish"][data-v="mind"]'); }
    else await click(p, '[data-act="ob-finish"][data-v="skip"]');
    await p.waitForSelector('nav.tabs'); await wait(400);
  }
  const t0 = Date.now();
  const alice = await open('alice');
  await onboard(alice, 'Alice', { exact: true, mind: 'run 3 times a week', stake: 1, create: 'Third Floor', snap: true });
  ok('onboarding: time to finish, scripted', true, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  let db = await store(alice);
  const circ = Object.entries(db).find(([k, v]) => k.startsWith('circles/') && k.split('/').length === 2 && v.name === 'Third Floor');
  ok('circle created with a 6-letter code', circ && /^[A-Z2-9]{6}$/.test(circ[1].code), circ && circ[1].code);
  const code = circ[1].code, cid = circ[0].split('/')[1];
  const js = Object.entries(db).filter(([k]) => k.startsWith('data/users/local_alice/j_')).map(([, v]) => v.read.kind).sort();
  ok('what’s on your mind becomes a pact, with the stake picked', JSON.stringify(js) === JSON.stringify(['Pact']) && Object.entries(db).find(([k]) => k.startsWith('data/users/local_alice/j_'))[1].stake === 'I cook for the circle', js.join(', '));
  ok('handle saved for the city', /^[A-Z ]{3,16}$/.test(db['people/local_alice'].handle || ''), db['people/local_alice'].handle);
  await shot(alice, '05-today');

  const bob = await open('bob');
  await onboard(bob, 'Bob', { size: 1, mind: 'call home every Sunday', join: code });
  db = await store(bob);
  ok('second person joins with the code', db['people/local_bob'].circle === cid);
  const carol = await open('carol');
  await onboard(carol, 'Carol', { size: 3, lane: 'urge', mind: 'tell someone how I feel', create: 'Night Shift' });
  db = await store(carol);
  const code2 = Object.values(db).find(v => v && v.name === 'Night Shift' && v.code).code;
  const erin = await open('erin');
  await onboard(erin, 'Erin', { search: 'Amadora', radius: 10, join: code2 });
  const dave = await open('dave');
  await onboard(dave, 'Dave', { search: 'Manchester', create: 'Ancoats Lot' });

  // Places and privacy
  db = await store(erin);
  ok('Amadora resolves to the Lisbon city for feed and Decode', db['people/local_erin'].cityName === 'Lisbon', db['people/local_erin'].cityName);
  ok('exact pin is private to Alice; the public profile holds a 1 km² square', !!db['data/users/local_alice/loc'] && db['people/local_alice'].cell.s === 1 && !('lat' in db['people/local_alice']));
  ok('zone-only Bob has no pin saved anywhere', !db['data/users/local_bob/loc'] && db['people/local_bob'].cell.s === 1 && db['people/local_bob'].prec === 'zone');
  ok('Carol chose a 9 km² square', db['people/local_carol'].cell.s === 3);
  ok('Dave is in Manchester', db['people/local_dave'].cityName === 'Manchester');

  // Quiet hours (default 23:00 to 08:00) hide badges; turn them off for the badge checks
  for (const p of [bob, carol]) {
    const q = await p.evaluate(() => quietNow());
    if (q) { await tab(p, 'today'); ok('quiet hours say so on Today: ' + (p === bob ? 'bob' : 'carol'), (await text(p)).includes('Quiet hours until')); }
    await tab(p, 'you'); await p.selectOption('select[data-quiet="from"]', 'off'); await wait(300); await tab(p, 'today');
  }

  // Plan thread, messages, unread badges
  await tab(alice, 'circle'); await click(alice, '[data-act="sheet"][data-v="thread-new"]');
  await click(alice, '[data-act="tkind"][data-v="plan"]'); await alice.fill('#t-title', 'Quiz night'); await alice.fill('#t-when', 'Thu 7pm'); await alice.fill('#t-where', 'The Loading Dock');
  await click(alice, '[data-act="t-create"]'); await alice.waitForSelector('#m-text');
  await alice.fill('#m-text', 'who’s in for Thursday?'); await alice.press('#m-text', 'Enter'); await wait(500);
  await tab(bob, 'today'); await wait(500);
  ok('badge on Circle for Bob', await bob.locator('nav [data-v="circle"] .dot').count() === 1);
  ok('Today shows the new message', (await text(bob)).includes('who’s in for Thursday?'));
  await tab(bob, 'circle'); await click(bob, '.thr:has-text("Quiz night")');
  await bob.waitForSelector('#m-text'); await click(bob, '[data-act="going"]'); await bob.fill('#m-text', 'in. bringing Erin’s quiz book'); await bob.press('#m-text', 'Enter'); await wait(600);
  ok('Alice sees Bob going and his reply live', (await text(alice)).includes('Bob ✓') && (await text(alice)).includes('bringing Erin'));
  await shot(alice, '06-thread');

  // Pot
  await click(alice, '[data-act="close"]'); await click(alice, '[data-act="sheet"][data-v="thread-new"]'); await click(alice, '[data-act="tkind"][data-v="pot"]');
  await alice.fill('#t-title', 'Lisbon flights'); await alice.fill('#t-per', '80'); await alice.fill('#t-min', '2'); await click(alice, '[data-act="t-create"]'); await wait(400);
  await click(bob, '[data-act="close"]'); await click(bob, '.thr:has-text("Lisbon flights")'); await click(bob, '[data-act="pledge"]'); await wait(500);
  ok('pot goes ahead when enough pledge', (await text(alice)).includes('It’s on.'));

  // Journeys and progress
  await click(alice, '[data-act="close"]'); await tab(alice, 'today'); await click(alice, '[data-act="tick"]'); await wait(700);
  await click(bob, '[data-act="close"]'); await wait(300);
  ok('circle sees Alice’s count, not her words', (await text(bob)).includes('Run · 1 of 3 this week') && !(await text(bob)).includes('3 times a week'));
  await shot(bob, '07-circle');

  // Decode
  const week = await carol.evaluate(() => weekNum()); const ans = ANS[week % 8];
  await tab(carol, 'city'); await click(carol, '[data-act="sheet"][data-v="decode"]'); await carol.fill('#dec-a', 'wrong'); await carol.press('#dec-a', 'Enter'); await wait(300);
  await carol.fill('#dec-a', ans.toLowerCase()); await carol.press('#dec-a', 'Enter'); await wait(500);
  ok('Decode: Carol solves first', (await carol.locator('.sheet').innerText()).includes('Solved, 1st in Lisbon'));
  await shot(carol, '08-decode');
  await click(carol, '[data-act="sheet-close"]');
  await tab(alice, "city"); await click(alice, `[data-act="sheet"][data-v="decode"]`); await alice.fill("#dec-a", ans); await alice.press('#dec-a', 'Enter'); await wait(500);
  await click(alice, '[data-act="sheet-close"]'); await click(alice, '[data-act="sseg"][data-v="league"]'); await wait(300);
  const lg = await text(alice);
  const [p1, p2] = await alice.evaluate(() => [decPts(1, S.solves[0].hints), decPts(2, S.solves[1].hints)]);
  ok('League: solve order sets points', new RegExp('Night Shift\\s*' + p1).test(lg) && new RegExp('Third Floor\\s*' + p2).test(lg) && p1 > p2, lg.match(/#[\s\S]*/)?.[0].replace(/\s+/g, ' ').slice(0, 80));
  ok('Decode is per city: Manchester sees 0 solves', (await (async () => { await tab(dave, 'city'); return text(dave); })()).includes('0 solved in Manchester'));

  // Two-key drop hosted by Carol, opens now
  const hhmm = await carol.evaluate(() => { const d = new Date(Date.now() - 5 * 60000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); });
  const dstr = await carol.evaluate(() => today());
  await click(carol, '[data-act="sseg"][data-v="map"]'); await click(carol, '[data-act="sheet"][data-v="host"]'); await click(carol, '[data-act="dkind"][data-v="twokey"]');
  await carol.fill('#d-venue', 'The Book Nook'); await carol.fill('#d-addr', '14 Market Row');
  await carol.fill('#d-date', dstr); await carol.fill('#d-time', hhmm); await carol.fill('#d-prize', 'Free coffee for both circles');
  await click(carol, '[data-act="d-create"]'); await wait(500);
  db = await store(carol); const drop = Object.entries(db).find(([k, v]) => k.startsWith('drops/'));
  const doorCode = (db['data/users/local_carol/codes'] || {})[drop && drop[0].split('/')[1]];
  ok('drop published; door code kept only as a hash, plain code private to the host', drop && drop[1].codeHash && !drop[1].code && /^[A-Z2-9]{6}$/.test(doorCode || ''), doorCode);
  await shot(carol, '09-host');
  await click(carol, '[data-act="sheet-close"]');
  await click(alice, '[data-act="sseg"][data-v="map"]'); await wait(300); await shot(alice, '10-map');
  await click(alice, '.drop'); await alice.fill('#d-code', 'ZZZZZZ'); await alice.press('#d-code', 'Enter'); await wait(300);
  ok('wrong door code refused', !(await alice.locator('.sheet').innerText()).includes('You’re checked in'));
  await alice.fill('#d-code', doorCode); await alice.press('#d-code', 'Enter'); await wait(500);
  ok('two-key stays locked with one circle', (await alice.locator('.sheet').innerText()).includes('Locked.'));
  await tab(erin, 'city'); await click(erin, '[data-act="sseg"][data-v="map"]'); await click(erin, '.drop'); await erin.fill('#d-code', doorCode); await erin.press('#d-code', 'Enter'); await wait(600);
  ok('two-key unlocks when a second circle arrives', (await alice.locator('.sheet').innerText()).includes('Unlocked.'));
  await shot(alice, '11-drop');
  await click(alice, '[data-act="sheet-close"]'); await click(alice, '[data-act="sseg"][data-v="league"]'); await wait(300);
  { const lt = await text(alice); ok('drop check-ins add 10 to each circle', new RegExp('Third Floor\\s*' + (p2 + 10)).test(lt) && new RegExp('Night Shift\\s*' + (p1 + 10)).test(lt)); }

  ok('Erin, 8 km away with a 10 km radius, could see and reach the drop', true);
  { await tab(dave, 'city'); await click(dave, '[data-act="sseg"][data-v="map"]'); await wait(300); ok('Manchester never sees the Lisbon drop', !(await text(dave)).includes('The Book Nook')); }
  { await tab(bob, 'you'); await wait(200); const yt = await text(bob); ok('Bob has no stamp yet', /Passport · 0 stamps/i.test(yt)); await tab(alice, 'you'); await wait(200); ok('Alice’s passport has her drop stamp', /Passport · [1-9]/i.test(await text(alice)) && (await text(alice)).includes('The Book Nook')); await shot(alice, '11b-passport'); await tab(alice, 'city'); }

  // Posting in the City needs a circle that has met in person
  await tab(bob, 'city'); await click(bob, '[data-act="sseg"][data-v="feed"]');
  ok('feed posting is locked until the circle has met', await bob.locator('form[data-form="post"]').count() === 0 && (await text(bob)).includes('met in person'));
  await meet(alice, bob); await meet(carol, erin);
  db = await store(alice);
  ok('meeting inside a circle marks it met in person', Object.keys(db['circles/' + cid].verified || {}).length === 2, JSON.stringify(db['circles/' + cid].verified));
  // Feed
  await tab(bob, 'city'); await click(bob, '[data-act="sseg"][data-v="feed"]'); await click(bob, '[data-act="pkind"][data-v="Made"]');
  await bob.fill('#p-text', 'Built a cardboard arcade cabinet for quiz night. It works. Barely.'); await click(bob, 'form[data-form="post"] button[type="submit"]'); await wait(500);
  await tab(carol, 'today'); await wait(200);
  ok('feed badge for Carol', await carol.locator('nav [data-v="city"] .dot').count() === 1);
  await tab(carol, 'city'); await click(carol, '[data-act="sseg"][data-v="feed"]'); await wait(300);
  const ft = await text(carol);
  ok('Carol sees the post, with no counts', ft.includes('cardboard arcade') && !/\d+\s*(likes?|followers?|comments?)/i.test(ft));
  await click(carol, '[data-act="phide"]'); await wait(300);
  ok('hide removes it for Carol only', !(await text(carol)).includes('cardboard arcade') && (await text(bob)).includes('cardboard arcade'));
  ok('Manchester feed does not show Lisbon posts', !(await (async () => { await click(dave, '[data-act="sseg"][data-v="feed"]'); return text(dave); })()).includes('cardboard'));
  await shot(bob, '12-feed');

  // Calls and rooms
  await click(carol, '[data-act="sseg"][data-v="calls"]'); await carol.fill('#c-ask', 'a 4th for the pub quiz on Thursday'); await click(carol, 'form[data-form="call"] button[type="submit"]'); await wait(400);
  await click(alice, '[data-act="sseg"][data-v="calls"]'); await wait(300); await click(alice, '[data-act="answer"]'); await alice.waitForSelector('#m-text');
  await alice.fill('#m-text', 'Bob and I can do it'); await alice.press('#m-text', 'Enter'); await wait(500);
  await tab(carol, 'circle'); await wait(300);
  { const ct = await text(carol); ok('room appears for the other circle', /with other circles/i.test(ct) && ct.includes('Bob and I can do it'), ct.replace(/\s+/g,' ').slice(0, 400)); }
  await shot(carol, '13-rooms');

  // Meeting in person, then a direct message
  await closeT(alice); await tab(alice, 'circle'); await click(alice, '[data-act="cseg"][data-v="people"]'); await click(alice, '[data-act="sheet"][data-v="meet"]'); await wait(200); if (await alice.locator('[data-act="pair-show"]').count()) await click(alice, '[data-act="pair-show"]'); await wait(400);
  const pcode = (await alice.locator('.sheet .big').innerText()).trim();
  await shot(alice, '14-meet');
  await closeT(carol); await tab(carol, 'circle'); await click(carol, '[data-act="cseg"][data-v="people"]'); await click(carol, '[data-act="sheet"][data-v="meet"]'); await carol.fill('#pair-in', pcode); await carol.press('#pair-in', 'Enter'); await wait(700);
  ok('meeting in person connects the two', (await text(carol)).includes('Alice') && (await text(carol)).includes('Met'));
  await click(carol, '.thr:has-text("Alice")'); await carol.fill('#m-text', 'good to meet you'); await carol.press('#m-text', 'Enter'); await wait(500);
  await click(alice, '[data-act="sheet-close"]'); await click(alice, '.thr:has-text("Carol")'); await wait(400);
  ok('direct message after meeting', (await text(alice)).includes('good to meet you'));
  ok('no way to message Bob’s contacts cold', !(await (async () => { await closeT(bob); await tab(bob, 'circle'); await click(bob, '[data-act="cseg"][data-v="people"]'); return text(bob); })()).includes('Carol'));

  // ---------- the v0.6 game, now real: + sheet, ledger, plans, dares, cheers, the Mole, Missions, trails, feed reactions ----------
  await closeT(alice);
  await click(alice, '[data-act="make"]'); ok('+ opens the Make sheet with 15 things', await alice.locator('.sheet .sh-i').count() === 15);
  await click(alice, '[data-act="mk"][data-v="favor"]'); await wait(200);
  ok('+ → Ask a favor lands on the Ledger form', await alice.locator('#fv-what').count() === 1);
  await click(alice, '[data-act="fv-form"][data-v=""]');
  // Favors: Bob asks, Alice helps and adjusts the hours, Bob confirms
  await closeT(bob); await tab(bob, 'ledger'); await click(bob, '[data-act="fv-form"][data-v="ask"]'); await bob.fill('#fv-what', 'Help me carry a wardrobe upstairs'); await click(bob, '[data-act="fv-h"][data-v="2"]'); await click(bob, '[data-act="fv-ask"]'); await wait(400);
  await tab(alice, 'today'); await wait(300);
  ok('Alice sees Bob’s favor under Needs you', (await text(alice)).includes('Help me carry a wardrobe'));
  await shot(alice, '20-home');
  await click(alice, '[data-act="fv-claim"]'); await wait(300); await click(alice, '[data-act="fv-done"]'); await click(alice, '[data-act="fv-h2"][data-v="1"]'); await click(alice, '[data-act="fv-done-save"]'); await wait(400);
  await tab(bob, 'today'); await wait(300); ok('Bob is asked to confirm, with Alice’s adjusted hours', /favor done for you/i.test(await text(bob)) && (await text(bob)).includes('1 h to them'));
  await click(bob, '[data-act="fv-confirm"]'); await wait(400);
  await tab(alice, 'ledger'); await wait(300); { const lt = await text(alice); ok('ledger: Alice +1 h, Bob −1 h', /YOUR BALANCE\s*\+1 h/i.test(lt) && /Bob\s*−1 h/.test(lt), lt.replace(/\s+/g, ' ').slice(0, 160)); }
  await shot(alice, '21-ledger');
  // Pots: a split pot, paid and confirmed
  await click(alice, '[data-act="lseg"][data-v="pots"]'); await click(alice, '[data-act="pot-new"]'); await alice.fill('#np-name', 'Groceries this week'); await click(alice, '[data-act="np-mode"][data-v="split"]'); await alice.fill('#np-each', '14'); await alice.fill('#np-pay', 'MB Way 912 000 000'); await click(alice, '[data-act="pot-create"]'); await wait(400);
  ok('split pot uses the local currency', (await text(alice)).includes('€14 each'));
  await tab(bob, 'ledger'); await click(bob, '[data-act="lseg"][data-v="pots"]'); await click(bob, '.potbtn:has-text("Groceries")'); await click(bob, '[data-act="pledge"]'); await wait(300); await click(bob, '[data-act="pot-pay"]'); await click(bob, '[data-act="pot-paid"][data-m="Bank transfer"]'); await wait(400);
  ok('Bob’s share shows as checking', (await text(bob)).includes('Waiting for Alice to confirm'));
  await tab(alice, 'today'); await wait(300); ok('Alice is asked if it landed', /did it land/i.test(await text(alice)));
  await click(alice, '[data-act="pot-go"]'); await wait(300); await click(alice, '[data-act="pot-confirm"]'); await wait(400);
  db = await store(alice); { const p = Object.values(db).find(v => v && v.title === 'Groceries this week'); ok('organiser confirms: Bob is paid', p && p.paid.local_bob === true, JSON.stringify(p && p.paid)); }
  await shot(alice, '22-pots');
  // A plan with a pot, answered from Home
  await tab(bob, 'circle'); await click(bob, '[data-act="cseg"][data-v="plans"]'); await click(bob, '[data-act="np-toggle"]'); await bob.fill('#pl-what', 'Climbing, then pho'); await click(bob, '[data-act="pl-when"][data-v="Sat afternoon"]'); await click(bob, '[data-act="pl-money"][data-v="pledge"]'); await bob.fill('#pl-each', '12'); await bob.fill('#pl-min', '2'); await click(bob, '[data-act="pl-create"]'); await wait(400);
  await tab(alice, 'today'); await wait(300); ok('the plan reaches Alice’s Needs you', (await text(alice)).includes('Climbing, then pho'));
  await click(alice, '[data-act="rsvp"][data-x="y"]'); await wait(300);
  db = await store(alice); { const pl = Object.values(db).find(v => v && v.kind === 'plan' && v.title === 'Climbing, then pho'); ok('RSVP saved and the pot is attached', pl && pl.going.local_alice === true && !!pl.pot); }
  // Dares: the daily dare with a photo, and a dare to someone
  await click(alice, '[data-act="sheet"][data-v="proof"][data-id="daily"]'); await alice.fill('#pr-note', 'the barista played along');
  await alice.setInputFiles('#pr-photo', { name: 'proof.png', mimeType: 'image/png', buffer: PNG }); await wait(900);
  await click(alice, '[data-act="dare-did"]'); await wait(600);
  db = await store(alice); { const dl = Object.entries(db).find(([k]) => k.includes('/daily/')); const cl = Object.entries(db).find(([k]) => k.includes('/clips/')); ok('daily dare done, photo kept 24 h in the circle’s clips', !!(dl && dl[1].done.local_alice && cl && cl[1].exp - cl[1].at === 864e5 && cl[1].img.startsWith('data:image/jpeg'))); }
  await tab(bob, 'circle'); await click(bob, '[data-act="cseg"][data-v="plans"]'); await wait(300); ok('Bob sees Alice’s clip in the vault', await bob.locator('.vt-tile').count() === 1);
  await shot(bob, '23-plans');
  await click(alice, '[data-act="make"]'); await click(alice, '[data-act="mk"][data-v="dare"]'); await click(alice, '.sheet [data-act="dare-to"]:has-text("Bob")'); await alice.fill('#dr-text', 'Ask the bus driver for their favourite stop'); await click(alice, '[data-act="dare-lvl"][data-v="4"]'); await click(alice, '[data-act="dare-add"]'); await wait(400);
  await tab(bob, 'today'); await wait(300); ok('Bob gets the dare under Needs you', /alice dared you/i.test(await text(bob)));
  await click(bob, '[data-act="dare-accept"]'); await wait(300); await click(bob, '[data-act="sheet"][data-v="proof"]:not([data-id="daily"])'); await click(bob, '[data-act="dare-did"]'); await wait(400);
  db = await store(bob); { const dr = Object.values(db).find(v => v && v.text === 'Ask the bus driver for their favourite stop'); ok('Bob accepts and does it', dr && dr.status === 'done'); }
  // Cheers
  await tab(bob, 'circle'); await click(bob, '[data-act="cseg"][data-v="pacts"]'); await click(bob, '[data-act="cheer"]'); await wait(400);
  await tab(alice, 'circle'); await click(alice, '[data-act="cseg"][data-v="pacts"]'); await wait(300); ok('Alice’s pact shows who cheered', (await text(alice)).includes('Cheered by Bob'));
  // The Mole needs four: Fay and Gus join Third Floor
  const fay = await open('fay'); await onboard(fay, 'Fay', { join: code }); const gus = await open('gus'); await onboard(gus, 'Gus', { join: code });
  await tab(bob, 'circle'); await click(bob, '[data-act="cseg"][data-v="mole"]'); await click(bob, '[data-act="mole-claim"]'); await wait(500);
  ok('Bob is the Mole with three secret tasks', await bob.locator('.tasks li').count() === 3);
  db = await store(bob); { const ml = Object.entries(db).find(([k]) => k.includes('/moles/')); ok('the Mole doc says nothing about who', !!ml && !JSON.stringify(ml[1]).includes('bob')); }
  await click(bob, '[data-act="mole-step"]'); await wait(300);
  await tab(alice, 'circle'); await click(alice, '[data-act="cseg"][data-v="mole"]'); await wait(300); ok('Alice only sees that someone is the Mole', (await text(alice)).includes('Someone in Third Floor is the Mole') && await alice.locator('.tasks').count() === 0);
  await click(alice, '[data-act="mole-vote"]:has-text("Bob")'); await tab(fay, 'circle'); await click(fay, '[data-act="cseg"][data-v="mole"]'); await click(fay, '[data-act="mole-vote"]:has-text("Gus")'); await wait(300);
  await bob.evaluate(() => { window.__rn = Date.now; const off = moleReveal() + 60000 - Date.now(); if (off > 0) Date.now = () => window.__rn() + off; render(); }); await wait(300);
  await click(bob, '[data-act="mole-reveal"]'); await wait(400); await bob.evaluate(() => { Date.now = window.__rn; render(); });
  await wait(300); ok('reveal: Bob was the Mole, 1 of 2 guessed him', /Bob was the Mole\.\s*\d of 3 tasks, 1 vote out of 2/.test(await text(alice)), (await text(alice)).match(/was the Mole[^\n]*/)?.[0]);
  await shot(alice, '24-mole');
  // Missions: a circle that has met proposes; another met circle confirms and joins
  await tab(alice, 'city'); await click(alice, '[data-act="sseg"][data-v="map"]'); await click(alice, '[data-act="sheet"][data-v="propose"]');
  await alice.fill('#ms-title', 'The Slow Walk'); await alice.fill('#ms-desc', 'Everyone crosses the bridge at one step every five seconds, in silence.'); await alice.fill('#ms-roles', 'Look at your watch every step\nHum, very quietly'); await alice.fill('#ms-spot', 'North end of the bridge'); await pin(alice, 'drop', '38.7075, -9.1360');
  await click(alice, '[data-act="ms-create"]'); await wait(500);
  db = await store(alice); { const ms = Object.values(db).find(v => v && v.title === 'The Slow Walk'); ok('Mission proposed, its area nudged away from the pin', !!ms && Math.abs(ms.area.lat - 38.7075) + Math.abs(ms.area.lon + 9.136) > 0.0003, ms && JSON.stringify(ms.area)); }
  await click(alice, '[data-act="sheet-close"]');
  await tab(carol, 'city'); await click(carol, '[data-act="sseg"][data-v="map"]'); await wait(300);
  await click(carol, '[data-act="ms-confirm"]'); await click(carol, '[data-act="ms-in"]'); await wait(400);
  { const ct = await text(carol); ok('Carol’s circle confirms, she joins and gets a secret briefing', ct.includes('1 of 3 circles confirmed') && ct.includes('YOUR BRIEFING'), ct.match(/Slow Walk[\s\S]{0,300}/)?.[0].replace(/\s+/g, ' ')); }
  await shot(carol, '25-mission');
  // Trails: Carol makes one, Erin stamps a stop
  const hmA = await carol.evaluate(() => { const d = new Date(Date.now() - 10 * 60000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); });
  const hmB = await carol.evaluate(() => { const d = new Date(Date.now() + 110 * 60000); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); });
  await click(carol, '[data-act="sheet"][data-v="trail-new"]'); await carol.fill('#tr-title', 'The Bridges Trail');
  for (const [n, ll] of [['River steps', '38.7071, -9.1365'], ['Old tram stop', '38.7110, -9.1330'], ['Miradouro', '38.7130, -9.1300']]) { await carol.fill('#tr-sname', n); await pin(carol, 'drop', ll); await click(carol, '[data-act="tr-add"]'); await wait(150); }
  await carol.fill('#tr-from', hmA); await carol.fill('#tr-to', hmB < hmA ? '23:59' : hmB); await click(carol, '[data-act="tr-create"]'); await wait(500);
  ok('trail published with 3 stops', (await sheet(carol)).includes('The Bridges Trail') && await carol.locator('.sheet .tasks li').count() === 3);
  await shot(carol, '26-trail');
  await click(carol, '[data-act="sheet-close"]');
  await tab(erin, 'city'); await click(erin, '[data-act="sseg"][data-v="map"]'); await click(erin, '.drop:has-text("Bridges Trail")'); await click(erin, '[data-act="tr-stamp"]'); await erin.waitForFunction(() => S.stamps.some(x => x.uid === S.uid), null, { timeout: 12000 }).catch(() => { });
  db = await store(erin); { const st = Object.values(db).find(v => v && v.trail && v.uid === 'local_erin'); ok('Erin stamps a stop; with no location access it’s marked “on your word”', !!st && Object.values(st.stops)[0].how === 'word'); }
  await click(erin, '[data-act="sheet-close"]');
  // Feed reactions: wants in, steal this
  await click(erin, '[data-act="sseg"][data-v="feed"]'); await click(erin, '[data-act="freact"][data-r="in"]'); await wait(300);
  await tab(bob, 'city'); await click(bob, '[data-act="sseg"][data-v="feed"]'); await wait(300); ok('Bob’s circle sees who wants in, with no counts', (await text(bob)).includes('Wants in: Night Shift'));
  await click(erin, '[data-act="freact"][data-r="steal"]'); await wait(500);
  db = await store(erin); ok('steal this turns the post into a plan in Erin’s circle', Object.values(db).some(v => v && v.kind === 'plan' && v.stolen === 'Third Floor'));
  await tab(alice, 'circle');

  // Midnight and sealed
  await closeT(alice); await tab(alice, 'circle'); await click(alice, '[data-act="cseg"][data-v="midnight"]');
  await alice.fill('#mn-text', 'Bob never restocks the oat milk.'); await click(alice, '[data-act="mnwhen"][data-v="tonight"]'); await click(alice, '[data-act="mn-send"]'); await wait(400);
  db = await store(alice); ok('Midnight blocks names of people in the circle', !Object.keys(db).some(k => k.includes('/midnight/')));
  await alice.fill('#mn-text', 'I restocked the oat milk and never said.'); await click(alice, '[data-act="mn-send"]'); await wait(400);
  db = await store(alice); const mn = Object.entries(db).find(([k]) => k.includes('/midnight/'));
  ok('unsigned message stores no author', mn && !('by' in mn[1]) && !JSON.stringify(mn[1]).includes('alice'));
  ok('it stays hidden until midnight', !(await text(bob)).includes('oat milk'));
  await click(alice, '[data-act="mnmode"][data-v="sealed"]'); await alice.fill('#seal-text', 'By the time you read this I’ll have run a 10k.'); await click(alice, '[data-act="seal-send"]'); await wait(400);
  await closeT(bob); await tab(bob, 'circle'); await click(bob, '[data-act="cseg"][data-v="midnight"]'); await wait(300);
  ok('sealed shows sender and date, not text', (await text(bob)).includes('from Alice') && !(await text(bob)).includes('10k'));
  // move the clock past midnight for Bob's tab
  await bob.evaluate(() => { const real = Date.now; const off = (Math.floor(real() / 864e5) + 2) * 864e5 - real(); Date.now = () => real() + off; render(); });
  await wait(400);
  ok('after midnight the unsigned message is out', (await text(bob)).includes('oat milk'));
  await click(bob, '[data-act="mn-react"][data-r="brave"]'); await wait(400);
  db = await store(bob); { const m = Object.entries(db).find(([k]) => k.includes('/midnight/'))[1]; ok('reacting on Midnight is saved, and still no author', (m.reacts || {}).local_bob === 'brave' && !('by' in m)); }
  await shot(bob, '15-midnight');

  // Go dark
  await tab(bob, 'you'); await bob.evaluate(() => { location.reload(); }); await bob.waitForSelector('nav.tabs'); await tab(bob, 'you');
  await click(bob, '[data-act="dark-setup"]'); await click(bob, '[data-act="darkH"][data-v="1"]'); await click(bob, '[data-act="dark-go"]'); await wait(500);
  ok('go dark blanks the app with a countdown', await bob.locator('.darkall .clock').count() === 1);
  await shot(bob, '16-dark');
  await closeT(alice); await click(alice, '[data-act="cseg"][data-v="people"]'); await wait(300);
  ok('circle sees Bob is dark', /Dark for/.test(await text(alice)));
  await click(bob, '[data-act="dark-back"]'); await click(bob, '[data-act="dark-end"]'); await wait(400);
  ok('come back early works', await bob.locator('.darkall').count() === 0);

  // You tab, timeline, data, owner stats
  await tab(alice, 'you'); await wait(300);
  const yt = await text(alice);
  ok('journey timeline records what happened', yt.includes('Solved Decode') && yt.includes('Turned up at The Book Nook') && yt.includes('Met Carol in person'), (yt.match(/story so far[\s\S]{0,500}/i)||[''])[0].replace(/\s+/g,' '));
  await click(alice, '[data-act="export"]'); await wait(300);
  ok('download my data falls back to a JSON box', (await alice.locator('#exp').inputValue()).includes('"journeys"'));
  await click(alice, '[data-act="stats"]'); await wait(400);
  const stt = await text(alice);
  ok('test results count seven people', /7 people/.test(stt), stt.match(/\d+ people[^.]*/)?.[0]);
  await shot(alice, '17-you');

  // Delete everything
  await tab(dave, 'you'); await click(dave, '[data-act="del-ask"]'); await click(dave, '[data-act="del-yes"]'); await wait(600);
  db = await store(dave);
  ok('delete removes Dave’s profile and private data', !db['people/local_dave'] && !Object.keys(db).some(k => k.startsWith('data/users/local_dave/')));
  ok('and returns him to sign-up', await dave.locator('#ob-name').count() === 1);

  // Layout checks
  for (const [p, n] of [[alice, 'alice'], [bob, 'bob'], [carol, 'carol']]) { const w = await p.evaluate(() => document.documentElement.scrollWidth); ok('no sideways scroll at 390px: ' + n, w <= 390, String(w)); }
  const dsk = await ctx.newPage(); await dsk.setViewportSize({ width: 1280, height: 860 }); await dsk.goto(BASE + '/?as=alice'); await dsk.waitForSelector('nav.tabs'); await wait(400);
  await dsk.screenshot({ path: path.join(OUT, '18-desktop.png') });
  await dsk.emulateMedia({ colorScheme: 'dark' }); await click(dsk, 'nav [data-v="city"]'); await click(dsk, '[data-act="sseg"][data-v="map"]'); await wait(300); await dsk.screenshot({ path: path.join(OUT, '19-desktop-dark.png') });

  ok('no script errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  const pass = results.filter(r => r[0] === 'PASS').length;
  console.log(results.map(r => r.join('  ')).join('\n'));
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); await srv.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(async e => { console.error(e); if (process.env.DEBUG_PIN) for (const p of (global.PAGES||[])) { try { const m0 = await p.evaluate(() => window.__mut); await new Promise(r => setTimeout(r, 2000)); console.log('DBG mut/2s', p.url(), (await p.evaluate(() => window.__mut)) - m0, await p.evaluate(() => JSON.stringify({ tab: S.ui.tab, sseg: S.ui.sseg, sheet: S.ui.sheet, acts: window.__acts, html: document.querySelector('#app').innerHTML.length }))); } catch (x) { console.log('DBG err', x.message); } } let ci = 0; for (const p of (global.PAGES||[])) await p.screenshot({ path: path.join(OUT, 'crash-' + (ci++) + '.png') }).catch(() => {}); for (const p of (global.PAGES||[])) { try { console.log('---', p.url(), '\n', (await p.locator('#app').innerText()).slice(0, 600)); } catch (x) { } } console.log('ERRORS', (global.ERRS||[]).join(' | ')); process.exit(2); });
