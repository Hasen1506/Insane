// Five people in one browser, each in their own tab, sharing the app's local store.
// Run: node app/test/e2e.js   (serves app/ on :8765, needs Playwright and Chromium)
const path = require('path'), http = require('http'), fs = require('fs');
const PW = process.env.PW || '/opt/node22/lib/node_modules/playwright';
const { chromium } = require(PW);
const ROOT = path.join(__dirname, '..');
const OUT = process.env.OUT || path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const srv = http.createServer((q, r) => { const f = path.join(ROOT, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(b); } }); });
const ANS = ['WATERLOO', 'MARKET', 'CARD', 'MUSEUM', 'BRIDGE', 'STATION', 'GARDEN', 'TOWER'];
const results = []; const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await new Promise(r => srv.listen(8765, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = global.ERRS = [];
  const open = async who => { const p = await ctx.newPage(); (global.PAGES = global.PAGES || []).push(p); p.on('pageerror', e => errors.push(who + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(who + ': ' + m.text()); }); await p.goto('http://localhost:8765/?as=' + who); await p.waitForSelector('#app h1, #app .mark'); return p; };
  const click = async (p, sel) => { await p.bringToFront(); const l = p.locator(sel).first(); try { await l.click({ timeout: 4000 }); } catch (e) { await l.click({ force: true }); } await wait(120); };
  const text = async p => { await p.bringToFront(); await wait(60); return p.locator('#app').innerText(); };
  const store = p => p.evaluate(() => JSON.parse(localStorage.getItem('insane_local_db') || '{}'));
  const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });
  const tab = (p, t) => click(p, `nav [data-v="${t}"]`);

  async function onboard(p, name, { city = 'Lisbon', zone = 4, need = '', want = '', urge = '', create, join, snap }) {
    await p.waitForSelector('#ob-name'); await p.fill('#ob-name', name); await p.check('#ob-age');
    if (snap) await shot(p, '01-welcome');
    await click(p, '[data-act="ob-next"]');
    await p.fill('#ob-cq', city.slice(0, 3)); await click(p, `[data-act="ob-city"][data-v="${city}"]`); await click(p, `[data-act="ob-zone"][data-v="${zone}"]`);
    if (snap) await shot(p, '02-city');
    await click(p, '[data-act="ob-next"]');
    if (need) await p.fill('#ob-need', need); if (want) await p.fill('#ob-want', want); if (urge) await p.fill('#ob-urge', urge);
    if (snap) await shot(p, '03-nwu');
    await click(p, '[data-act="ob-next"]');
    if (create) { await p.fill('#ob-cname', create); if (snap) await shot(p, '04-circle'); await click(p, '[data-act="ob-finish"][data-v="create"]'); }
    else if (join) { await p.fill('#ob-code', join); await click(p, '[data-act="ob-finish"][data-v="join"]'); }
    else await click(p, '[data-act="ob-finish"][data-v="skip"]');
    await p.waitForSelector('nav.tabs'); await wait(400);
  }
  const t0 = Date.now();
  const alice = await open('alice');
  await onboard(alice, 'Alice', { need: 'run 3 times a week', want: 'go to Lisbon in May', urge: 'sing karaoke in public', create: 'Third Floor', snap: true });
  ok('onboarding: time to finish, scripted', true, ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  let db = await store(alice);
  const circ = Object.entries(db).find(([k, v]) => k.startsWith('circles/') && k.split('/').length === 2 && v.name === 'Third Floor');
  ok('circle created with a 6-letter code', circ && /^[A-Z2-9]{6}$/.test(circ[1].code), circ && circ[1].code);
  const code = circ[1].code, cid = circ[0].split('/')[1];
  const js = Object.entries(db).filter(([k]) => k.startsWith('data/users/local_alice/j_')).map(([, v]) => v.read.kind).sort();
  ok('need/want/urge read into journeys', JSON.stringify(js) === JSON.stringify(['Ladder', 'Pact', 'Plan + pot']), js.join(', '));
  await shot(alice, '05-today');

  const bob = await open('bob');
  await onboard(bob, 'Bob', { zone: 1, need: 'call home every Sunday', join: code });
  db = await store(bob);
  ok('second person joins with the code', db['people/local_bob'].circle === cid);
  const carol = await open('carol');
  await onboard(carol, 'Carol', { zone: 8, urge: 'tell someone how I feel', create: 'Night Shift' });
  db = await store(carol);
  const code2 = Object.values(db).find(v => v && v.name === 'Night Shift' && v.code).code;
  const erin = await open('erin');
  await onboard(erin, 'Erin', { zone: 7, join: code2 });
  const dave = await open('dave');
  await onboard(dave, 'Dave', { city: 'Manchester', create: 'Ancoats Lot' });

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
  ok('circle sees Alice’s count, not her words', (await text(bob)).includes('Run · 1 of 3 this week') && !(await text(bob)).includes('sing karaoke'));
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
  await carol.fill('#d-venue', 'The Book Nook'); await carol.fill('#d-addr', '14 Market Row'); await click(carol, '[data-act="dzone"][data-v="4"]');
  await carol.fill('#d-date', dstr); await carol.fill('#d-time', hhmm); await carol.fill('#d-prize', 'Free coffee for both circles');
  await click(carol, '[data-act="d-create"]'); await wait(500);
  db = await store(carol); const drop = Object.entries(db).find(([k, v]) => k.startsWith('drops/'));
  ok('drop published with a door code', drop && /^\d{6}$/.test(drop[1].code));
  await shot(carol, '09-host');
  await click(carol, '[data-act="sheet-close"]');
  await click(alice, '[data-act="sseg"][data-v="map"]'); await wait(300); await shot(alice, '10-map');
  await click(alice, '.drop'); await alice.fill('#d-code', '000000'); await alice.press('#d-code', 'Enter'); await wait(300);
  ok('wrong door code refused', !(await alice.locator('.sheet').innerText()).includes('You’re checked in'));
  await alice.fill('#d-code', drop[1].code); await alice.press('#d-code', 'Enter'); await wait(500);
  ok('two-key stays locked with one circle', (await alice.locator('.sheet').innerText()).includes('Locked.'));
  await tab(erin, 'city'); await click(erin, '[data-act="sseg"][data-v="map"]'); await click(erin, '.drop'); await erin.fill('#d-code', drop[1].code); await erin.press('#d-code', 'Enter'); await wait(600);
  ok('two-key unlocks when a second circle arrives', (await alice.locator('.sheet').innerText()).includes('Unlocked.'));
  await shot(alice, '11-drop');
  await click(alice, '[data-act="sheet-close"]'); await click(alice, '[data-act="sseg"][data-v="league"]'); await wait(300);
  { const lt = await text(alice); ok('drop check-ins add 10 to each circle', new RegExp('Third Floor\\s*' + (p2 + 10)).test(lt) && new RegExp('Night Shift\\s*' + (p1 + 10)).test(lt)); }

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
  await click(alice, '[data-act="close"]'); await click(alice, '[data-act="cseg"][data-v="people"]'); await click(alice, '[data-act="sheet"][data-v="meet"]'); await click(alice, '[data-act="pair-show"]'); await wait(400);
  const pcode = (await alice.locator('.sheet .big').innerText()).trim();
  await shot(alice, '14-meet');
  await click(carol, '[data-act="cseg"][data-v="people"]'); await click(carol, '[data-act="sheet"][data-v="meet"]'); await carol.fill('#pair-in', pcode); await carol.press('#pair-in', 'Enter'); await wait(700);
  ok('meeting in person connects the two', (await text(carol)).includes('Alice') && (await text(carol)).includes('Met'));
  await click(carol, '.thr:has-text("Alice")'); await carol.fill('#m-text', 'good to meet you'); await carol.press('#m-text', 'Enter'); await wait(500);
  await click(alice, '[data-act="sheet-close"]'); await click(alice, '.thr:has-text("Carol")'); await wait(400);
  ok('direct message after meeting', (await text(alice)).includes('good to meet you'));
  ok('no way to message Bob’s contacts cold', !(await (async () => { await click(bob, '[data-act="close"]').catch(() => { }); await tab(bob, 'circle'); await click(bob, '[data-act="cseg"][data-v="people"]'); return text(bob); })()).includes('Carol'));

  // Midnight and sealed
  await click(alice, '[data-act="close"]'); await click(alice, '[data-act="cseg"][data-v="midnight"]'); await click(alice, '[data-act="sheet"][data-v="midnight"]');
  await alice.fill('#mn-text', 'Whoever restocked the oat milk: legend.'); await click(alice, '[data-act="mnwhen"][data-v="tonight"]'); await click(alice, '[data-act="mn-send"]'); await wait(400);
  db = await store(alice); const mn = Object.entries(db).find(([k]) => k.includes('/midnight/'));
  ok('unsigned message stores no author', mn && !('by' in mn[1]) && !JSON.stringify(mn[1]).includes('alice'));
  ok('it stays hidden until midnight', !(await text(bob)).includes('oat milk'));
  await click(alice, '[data-act="sheet"][data-v="seal"]'); await alice.fill('#seal-text', 'By the time you read this I’ll have run a 10k.'); await click(alice, '[data-act="seal-send"]'); await wait(400);
  await click(bob, '[data-act="cseg"][data-v="midnight"]'); await wait(300);
  ok('sealed shows sender and date, not text', (await text(bob)).includes('Sealed by Alice') && !(await text(bob)).includes('10k'));
  // move the clock past midnight for Bob's tab
  await bob.evaluate(() => { const real = Date.now; const off = (Math.floor(real() / 864e5) + 2) * 864e5 - real(); Date.now = () => real() + off; render(); });
  await wait(400);
  ok('after midnight the unsigned message is out', (await text(bob)).includes('oat milk'));
  await shot(bob, '15-midnight');

  // Go dark
  await tab(bob, 'you'); await bob.evaluate(() => { location.reload(); }); await bob.waitForSelector('nav.tabs'); await tab(bob, 'you');
  await click(bob, '[data-act="darkH"][data-v="1"]'); await click(bob, '[data-act="dark-go"]'); await wait(500);
  ok('go dark blanks the app with a countdown', await bob.locator('.darkall .clock').count() === 1);
  await shot(bob, '16-dark');
  await click(alice, '[data-act="close"]').catch(() => { }); await click(alice, '[data-act="cseg"][data-v="people"]'); await wait(300);
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
  ok('test results count five people', /5 people/.test(stt), stt.match(/\d+ people[^.]*/)?.[0]);
  await shot(alice, '17-you');

  // Delete everything
  await click(dave, 'nav [data-v="you"]'); await click(dave, '[data-act="del-ask"]'); await click(dave, '[data-act="del-yes"]'); await wait(600);
  db = await store(dave);
  ok('delete removes Dave’s profile and private data', !db['people/local_dave'] && !Object.keys(db).some(k => k.startsWith('data/users/local_dave/')));
  ok('and returns him to sign-up', await dave.locator('#ob-name').count() === 1);

  // Layout checks
  for (const [p, n] of [[alice, 'alice'], [bob, 'bob'], [carol, 'carol']]) { const w = await p.evaluate(() => document.documentElement.scrollWidth); ok('no sideways scroll at 390px: ' + n, w <= 390, String(w)); }
  const dsk = await ctx.newPage(); await dsk.setViewportSize({ width: 1280, height: 860 }); await dsk.goto('http://localhost:8765/?as=alice'); await dsk.waitForSelector('nav.tabs'); await wait(400);
  await dsk.screenshot({ path: path.join(OUT, '18-desktop.png') });
  await dsk.emulateMedia({ colorScheme: 'dark' }); await click(dsk, 'nav [data-v="city"]'); await click(dsk, '[data-act="sseg"][data-v="map"]'); await wait(300); await dsk.screenshot({ path: path.join(OUT, '19-desktop-dark.png') });

  ok('no script errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  const pass = results.filter(r => r[0] === 'PASS').length;
  console.log(results.map(r => r.join('  ')).join('\n'));
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); srv.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(async e => { console.error(e); for (const p of (global.PAGES||[])) { try { console.log('---', p.url(), '\n', (await p.locator('#app').innerText()).slice(0, 600)); } catch (x) { } } console.log('ERRORS', (global.ERRS||[]).join(' | ')); process.exit(2); });
