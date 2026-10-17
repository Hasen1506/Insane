// WS-E end to end, against the real server (PLAN-V09 §5.a F11, C48, C91, C93):
// Meera in Minjur (Chennai) solves this week's Decode on a Pixel 7, and nothing her phone ever receives,
// the page, every API response and every live update, contains the answer before it's out. Then the
// owner adds a puzzle for next week in /admin/content, and a week later it's what Meera gets.
// Run: node test/e2e/decode-server.js   (SERVER_PORT, default 8793; CHROMIUM / PW: see test/lib/browser.js)
'use strict';
const BR = require('../lib/browser'), E = require('../lib/e2e'), api = require('../lib/api');
const C = require('../../server/content-core');
const { loadV09 } = require('../lib/load');
const DAY = 864e5, HOUR = 36e5;
const R = E.results('E2E-DEC ');
const ok = async (name, fn, extra = '', timeout = 8000) => R.ok(name, await E.until(fn, { timeout, what: name }).then(() => true, () => false), typeof extra === 'function' ? await extra() : extra);

(async () => {
  const A = await api.open({ port: +process.env.SERVER_PORT || 0, owner: 'owner@x.com' }); // 0: a free port picked at random
  let browser;
  try {
    // Wednesday 10:00 in Chennai
    const T = Date.UTC(2026, 9, 14, 4, 30), week = C.isoWeekKeyUTC(T + 5.5 * HOUR), next = C.isoWeekKeyUTC(T + 5.5 * HOUR + 7 * DAY);
    await A.clock(T);
    const city = 'IN-tamil_nadu-chennai', [lat, lon] = [13.2790, 80.2640];
    const cell = loadV09().get('cellOf')(lat, lon, 1);
    const meera = await A.user('meera@x.in');
    await meera.post('set', { path: 'people/' + meera.uid, data: { name: 'Meera', adult: true, consent: { v: '2026-10-draft' }, handle: null, circle: null, joined: T, seen: T, quiet: { from: 23, to: 8 }, tz: 'Asia/Kolkata', city, cityName: 'Chennai', cc: 'IN', areaLL: [13.088, 80.278], cell, prec: 'area', radius: 5, near: 'Minjur' } });
    const ans = (await A.answer(city, week)).answer, clue = (await meera.get('decode?week=' + week)).body;
    R.ok('Chennai gets its own pack this week', clue.pack === 'Chennai' && !!clue.q, JSON.stringify(clue).slice(0, 120));

    browser = await BR.launch();
    const ctx = await browser.newContext(BR.profile('Pixel 7', { timezoneId: 'Asia/Kolkata', locale: 'en-IN' }));
    await BR.blockExternal(ctx); await E.actProbe(ctx);
    await ctx.addCookies([{ name: 'insane_s', value: meera.cookie().split('=')[1], domain: 'localhost', path: '/' }]);
    // everything the phone receives: HTTP bodies (below) and every server-sent event (wrapped here, no app change)
    await ctx.addInitScript(() => { window.__sse = []; const ES = window.EventSource; window.EventSource = function (u, o) { const es = new ES(u, o); es.addEventListener('message', e => window.__sse.push(e.data)); return es; }; window.EventSource.prototype = ES.prototype; });
    const page = await ctx.newPage(), bodies = [];
    page.on('response', async r => { if (!/\/api\/(?!stream)/.test(r.url())) return; try { bodies.push([r.url(), await r.text()]); } catch (e) { } });
    await page.clock.setFixedTime(T);
    await page.goto(A.base + '/');
    await ok('Home shows this week’s Chennai Decode clue', async () => (await page.locator('#app').innerText()).includes(clue.q.slice(0, 40)));
    await page.screenshot({ path: require('path').join(E.REPO, 'test', 'out', 'e2e-decode-home.png') });
    await E.tapOnce(page, '[data-act=sheet][data-v=decode]'); await E.idle(page);
    const sh = () => page.locator('.sheet').innerText().catch(() => '');
    await ok('the sheet shows the clue and the hints that are out (Wednesday: the first)', async () => { const s = await sh(); return s.includes(clue.q.slice(0, 40)) && s.includes(clue.h[0]) && /Hint 2 unlocks/.test(s); });
    await page.fill('#dec-a', 'chennai'); await page.press('#dec-a', 'Enter'); await E.idle(page);
    await ok('a wrong guess: “Not it”, checked by the server', async () => /Not it/.test(await page.evaluate(() => S.toast || '')) && !(await sh()).includes('Solved'));
    await page.fill('#dec-a', ans.toLowerCase()); await page.press('#dec-a', 'Enter'); await E.idle(page);
    await ok('the right answer: Solved, 1st in Chennai', async () => (await sh()).includes('Solved, 1st in Chennai'));
    const doc = (await meera.post('query', { col: 'solves' })).body.docs[0];
    R.ok('the solve the server stored carries no answer, and the server set its hints and time', doc && !C.hasWord(JSON.stringify(doc), ans) && doc.data.hints === 1 && doc.data.city === city, JSON.stringify(doc));
    // C48: scan everything
    const html = await page.content(), scripts = await page.evaluate(() => [...document.scripts].map(s => s.text).join('\n')), sse = await page.evaluate(() => window.__sse);
    R.ok('the page has no local pack in server mode (DECODE_LOCAL is null, no hashes)', await page.evaluate(() => DECODE_LOCAL === null) && !/"x":"[0-9a-f]{32}"/.test(scripts));
    const where = [['page', html], ['scripts', scripts], ...bodies.map(([u, b]) => [u, b]), ...sse.map(s => ['sse', s])].filter(([, b]) => C.hasWord(b, ans));
    R.ok(`the answer is in none of: the page, ${bodies.length} API responses, ${sse.length} live updates`, !where.length && bodies.length > 3 && sse.length > 3, where.map(w => w[0]).join(', '));

    // Sunday 23:30: the answer is out, and only now does it reach the phone
    const late = T + 4 * DAY + 13.5 * HOUR; await A.clock(late); await page.clock.setFixedTime(late);
    await page.reload(); await E.idle(page); await E.tapOnce(page, '[data-act="tab"][data-v="city"]'); await E.idle(page); // Home goes quiet once you've solved; the City tab keeps the card
    await ok('after the reveal the City card shows the answer, which only now reached the phone', async () => (await page.locator('#app').innerText()).includes('Solved, 1st in Chennai') && (await page.evaluate(() => DEC.cur && DEC.cur.answer)) === ans);
    { const st = await meera.get('decode?week=' + week); R.ok('…and /api/decode now gives it', st.body.revealed && st.body.answer === ans); }

    // C93: the owner adds next week's puzzle in /admin/content
    await A.clock(T);
    const owner = await A.user('owner@x.com');
    const octx = await browser.newContext(BR.profile('Desktop 1280')); await BR.blockExternal(octx);
    await octx.addCookies([{ name: 'insane_s', value: owner.cookie().split('=')[1], domain: 'localhost', path: '/' }]);
    const op = await octx.newPage(); await op.goto(A.base + '/admin/content');
    await ok('owner tool opens with every pack', async () => (await op.locator('main').innerText()).includes('Chennai') && (await op.locator('main').innerText()).includes('Anywhere'));
    await op.selectOption('#p-pack', 'chennai'); await op.selectOption('#p-kind', 'acrostic');
    await op.fill('#p-a', 'Sloak'); await op.fill('#p-data', '{"text":"Some Light Over Ancient Kovalam"}');
    await op.fill('#p-h0', 'First letters only.'); await op.fill('#p-h1', 'Five letters.'); await op.fill('#p-h2', 'A made-up word, for the test.'); await op.fill('#p-week', next);
    await op.click('[data-do=check]');
    await ok('Check says it’s solvable and gives nothing away, and writes the clue', async () => /Solvable/.test(await op.locator('#msg').innerText()) && /first letters/i.test(await op.inputValue('#p-q')));
    await op.fill('#p-h1', 'It is SLOAK'); await op.click('[data-do=check]');
    await ok('…and refuses a hint that gives the answer', async () => /hint 2 gives the answer away/.test(await op.locator('#msg').innerText()));
    await op.fill('#p-h1', 'Five letters.'); await op.click('[data-save=puzzle]');
    await ok('the owner saves it', async () => /Saved/.test(await op.locator('#msg').innerText()) && (await op.locator('main').innerText()).includes('SLOAK'));
    await op.click('[data-tab=preview]'); await op.click('[data-do=preview]');
    await ok('the schedule shows it as next week’s Chennai puzzle', async () => new RegExp(next + '\\s+SLOAK').test(await op.locator('#pv').innerText()));
    // a week later, on Meera's phone
    const nt = T + 7 * DAY; await A.clock(nt); await page.clock.setFixedTime(nt);
    await page.reload(); await E.idle(page); await E.tapOnce(page, '[data-act="tab"][data-v="today"]'); await E.idle(page);
    await ok('a week later Meera’s Home shows the owner’s puzzle', async () => (await page.locator('#app').innerText()).includes('Some Light Over Ancient Kovalam'));
    // non-owners
    const mctx = await browser.newContext(BR.profile('Pixel 7')); await BR.blockExternal(mctx);
    await mctx.addCookies([{ name: 'insane_s', value: meera.cookie().split('=')[1], domain: 'localhost', path: '/' }]);
    const mp = await mctx.newPage(); await mp.goto(A.base + '/admin/content');
    await ok('a member opening /admin/content sees “owner only” and no content', async () => /owner only/i.test(await mp.locator('main').innerText()) && !(await mp.locator('main').innerText()).includes('SLOAK'));
  } catch (e) { R.ok('threw: ' + e.message, false, e.stack); }
  finally { if (browser) await browser.close().catch(() => { }); await A.close(); }
  console.log(`\n${R.passed()}/${R.list.length} passed`);
  process.exit(R.passed() === R.list.length ? 0 : 1);
})();
