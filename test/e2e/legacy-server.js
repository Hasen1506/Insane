// Two simulated weeks of INSANE with eleven people in four cities, against the real server:
// real email sign-in (codes read from the dev outbox, the way a person reads their inbox), real GPS
// (emulated per person), real OpenStreetMap search and tiles, and the server's own clock moved day by day.
// Writes a diary (what each person saw and did, and how long it took) plus screenshots.
// Port of v0.8's server/test/playtest.js (92 checks, IDs V08-S..), run against the BUILT app/index.html
// as served by server/server.js. WS-0 port: only the plumbing changed (paths, browser, external hosts,
// server start) and v0.8's fixed waits are gone: a check that depends on something arriving (an SSE push,
// the server's 20 s sweep) polls for it (E.until), and every tap waits for its act() to finish and draw.
// The two 21 s sweep waits are now polls that end as soon as the sweep has run; POST /api/dev/tick
// (PLAN-V09 §5.0, WS-I/J) would make them instant, but that is a server change, out of scope for WS-0.
// Run: node test/e2e/legacy-server.js
//   SERVER_PORT (default 8791). SERVER_URL=http://localhost:8099 attaches to a running DEV server instead,
//   which must be fresh (empty DB) and started with OWNER_EMAIL=alice@example.com for the owner checks.
//   CHROMIUM / CHROME, PW: see test/lib/browser.js.  OUT: output dir (default test/out/playtest)
'use strict';
const path = require('path'), fs = require('fs');
const BR = require('../lib/browser'), E = require('../lib/e2e');
let B;
const OUT = process.env.OUT || path.join(E.REPO, 'test', 'out', 'playtest');
fs.mkdirSync(OUT, { recursive: true });
const ANS = ['WATERLOO', 'MARKET', 'CARD', 'MUSEUM', 'BRIDGE', 'STATION', 'GARDEN', 'TOWER'];
const DAY = 864e5, HOUR = 36e5, MIN = 6e4;
const results = [], diary = [], errors = [], timings = {};
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const record = (name, cond, extra = '') => { name = 'V08-S' + String(results.length + 1).padStart(2, '0') + ' ' + name; results.push([cond ? 'PASS' : 'FAIL', name, String(extra).slice(0, 300)]); if (!cond) console.log('FAIL', name, extra); };
// ok(name, cond, extra): when cond is a function it is polled until it holds (8 s; `ms` for a sweep), so a
// check waits for the push or write it is about instead of sleeping first. extra may be a function too.
const ok = (name, cond, extra = '', ms = 8000) => {
  if (typeof cond !== 'function') return record(name, cond, extra);
  return E.until(cond, { timeout: ms, what: name }).then(() => true, () => false)
    .then(async v => record(name, v, typeof extra === 'function' ? await extra().catch(e => 'extra threw: ' + e.message) : extra));
};

// Day 0 is next Monday, 09:00 UTC. Everyone's clock and the server's move together.
const T0 = (() => { const d = new Date(); d.setUTCHours(9, 0, 0, 0); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7)); return d.getTime(); })();
let NOW = T0;
const DOWN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const stamp = () => { const d = new Date(NOW); return `D${Math.floor(NOW / DAY) - Math.floor(T0 / DAY)} ${DOWN[d.getUTCDay()]} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`; };
const log = (who, what) => { diary.push({ t: NOW, at: stamp(), who, what }); };

const PEOPLE = {
  alice: { name: 'Alice', email: 'alice@example.com', geo: [38.7139, -9.1334], tz: 'Europe/Lisbon', city: 'Lisbon' },
  bob: { name: 'Bob', email: 'bob@example.com', geo: [38.7107, -9.1365], tz: 'Europe/Lisbon', city: 'Lisbon' },
  carol: { name: 'Carol', email: 'carol@example.com', geo: [38.7069, -9.1600], tz: 'Europe/Lisbon', city: 'Lisbon' },
  erin: { name: 'Erin', email: 'erin@example.com', geo: [38.7570, -9.2240], tz: 'Europe/Lisbon', city: 'Lisbon' },
  kenji: { name: 'Kenji', email: 'kenji@example.jp', geo: [35.7056, 139.6497], tz: 'Asia/Tokyo', city: 'Tokyo' },
  yui: { name: 'Yui', email: 'yui@example.jp', geo: [35.7003, 139.6380], tz: 'Asia/Tokyo', city: 'Tokyo' },
  tunde: { name: 'Tunde', email: 'tunde@example.ng', geo: [6.6018, 3.3515], tz: 'Africa/Lagos', city: 'Lagos' },
  ada: { name: 'Ada', email: 'ada@example.ng', geo: [6.5960, 3.3420], tz: 'Africa/Lagos', city: 'Lagos' },
  mariana: { name: 'Mariana', email: 'mariana@example.br', geo: [-23.5614, -46.6559], tz: 'America/Sao_Paulo', city: 'São Paulo' },
  dani: { name: 'Dani', email: 'dani@example.pt', geo: [38.7200, -9.1450], tz: 'Europe/Lisbon', city: 'Lisbon' },
  rui: { name: 'Rui', email: 'rui@example.pt', geo: [38.7160, -9.1400], tz: 'Europe/Lisbon', city: 'Lisbon' },
};

let server, browser;
async function setClock(t) {
  NOW = t;
  await fetch(B + '/api/dev/clock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ offset: t - Date.now() }) });
  for (const k in PEOPLE) { const p = PEOPLE[k].page; if (p) await p.clock.setSystemTime(t).catch(() => { }); }
}
const at = (day, h, m = 0) => T0 + day * DAY + (h - 9) * HOUR + m * MIN; // h in UTC

// ---- helpers that act like a person: tap, type, read the screen
// Eleven people means eleven browser windows, all visible to Chromium. A map with an open drop or a live
// trail pulses its stamp every frame (v0.8 behaviour), so a few Lisbon phones on the City tab used to
// starve a 2-core machine until taps timed out. Like phones in pockets, the people the test isn't using
// draw at 4 frames a second: rAF is paced by the harness (init script below) for every page but the one
// in front. Timers, SSE and the app itself are untouched.
let FRONT = null;
async function front(who) {
  const p = PEOPLE[who].page;
  if (FRONT !== who) { const prev = FRONT && PEOPLE[FRONT] && PEOPLE[FRONT].page; FRONT = who; if (prev && !prev.isClosed()) await prev.evaluate(() => { window.__bg = true; }).catch(() => { }); }
  await p.evaluate(() => { window.__bg = false; }).catch(() => { });
  await p.bringToFront();
}
async function tap(who, sel, opt = {}) {
  const p = PEOPLE[who].page; PEOPLE[who].taps = (PEOPLE[who].taps || 0) + 1;
  await front(who);
  await E.tapOnce(p, sel, { timeout: opt.timeout || 5000, forceTimeout: 3000 }); // WS-0: never fires twice
  await E.idle(p); // WS-0: then wait for the tapped action to finish and draw
}
async function type(who, sel, v) { const p = PEOPLE[who].page; await front(who); await p.fill(sel, v); }
async function enter(who, sel) { const p = PEOPLE[who].page; await front(who); await p.press(sel, 'Enter'); await E.idle(p); }
async function screen(who) { const p = PEOPLE[who].page; await front(who); await E.idle(p); await E.stable(p); return p.locator('#app').innerText(); }
async function sheet(who) { const p = PEOPLE[who].page; await front(who); await E.idle(p); return p.locator('.sheet').innerText().catch(() => ''); }
async function until(who, fn, ms = 8000) { return E.until(fn, { timeout: ms, what: who }).then(() => true, () => false); }
async function shot(who, name) { const p = PEOPLE[who].page; await front(who); await E.idle(p); await E.stable(p); await p.screenshot({ path: path.join(OUT, name + '.png') }); }
async function tab(who, t) { await tap(who, `[data-act="tab"][data-v="${t}"]`); }
async function esc(who) { await front(who); await PEOPLE[who].page.keyboard.press('Escape'); await E.idle(PEOPLE[who].page); }
async function meet(a, b) { // face to face: one shows the code, the other types it
  await esc(a); await esc(b);
  await tap(a, '[data-act=make]'); await tap(a, '[data-act=mk][data-v=meet]'); if (await PEOPLE[a].page.locator('[data-act=pair-show]').count()) await tap(a, '[data-act=pair-show]'); await PEOPLE[a].page.waitForSelector('.sheet .big');
  const c = (await PEOPLE[a].page.locator('.sheet .big').innerText()).trim();
  await tap(b, '[data-act=make]'); await tap(b, '[data-act=mk][data-v=meet]'); await type(b, '#pair-in', c); await enter(b, '#pair-in');
  await until(b, () => PEOPLE[b].page.evaluate(() => S.met.length > 0 || !!(S.circle && Object.keys(S.circle.verified || {}).length)));
  await esc(a); await esc(b);
}
async function pin(who, k, ll) { await tap(who, `[data-act=lp-paste][data-k=${k}]`); await type(who, '#lp-p-' + k, ll); await tap(who, `form[data-form=lp-use][data-k=${k}] button`); }
const ymdIn = (who, t) => evalIn(who, t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }, t);
const hmIn = (who, t) => evalIn(who, t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }, t);
async function db(who, path) { const r = await api(who, 'get', { path }); return r.body && r.body.doc; }
async function evalIn(who, fn, arg) { return PEOPLE[who].page.evaluate(fn, arg); }
async function api(who, route, body) { // a request with this person's session, as a hand-crafted client would send it
  return PEOPLE[who].page.evaluate(async ([r, b]) => { const x = await fetch('/api/' + r, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: x.status, body: await x.json().catch(() => null) }; }, [route, body]);
}
async function code(email) { const j = await (await fetch(`${B}/api/dev/outbox?email=${encodeURIComponent(email)}`)).json(); return /code is (\d{6})/.exec(j.mail.text)[1]; }

async function open(who) {
  const P = PEOPLE[who];
  P.ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2, geolocation: { latitude: P.geo[0], longitude: P.geo[1], accuracy: 12 }, permissions: ['geolocation'], timezoneId: P.tz, locale: 'en-GB' });
  await BR.blockExternal(P.ctx); await E.actProbe(P.ctx);
  await P.ctx.addInitScript(() => { // rAF pacing for pages not in front (see front()); installed after the page's own scripts set up
    window.__bg = true;
    addEventListener('DOMContentLoaded', () => {
      const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window), T = new Map(); let n = 0;
      window.requestAnimationFrame = cb => { if (!window.__bg) return raf(cb); const id = -(++n); T.set(id, setTimeout(() => { T.delete(id); cb(performance.now()); }, 250)); return id; };
      window.cancelAnimationFrame = id => { if (T.has(id)) { clearTimeout(T.get(id)); T.delete(id); } else caf(id); };
    });
  });
  P.page = await P.ctx.newPage();
  await P.page.clock.install({ time: NOW });
  P.page.on('pageerror', e => errors.push(who + ': ' + e.message));
  P.page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(who + ': ' + m.text()); });
  await P.page.goto(B + (P.deep || ''));
}
async function signIn(who) {
  const P = PEOPLE[who], t = Date.now(); P.taps = 0;
  await P.page.waitForSelector('#si-email'); await type(who, '#si-email', P.email); await tap(who, 'button:has-text("Email me a code")');
  await P.page.waitForSelector('#si-code'); await type(who, '#si-code', await code(P.email)); await tap(who, 'button:has-text("Sign in")');
  await P.page.waitForSelector('#ob-name, nav.tabs', { timeout: 15000 });
  P.signin = Date.now() - t;
}
async function onboard(who, { how = 'gps', search, pick, paste, exact = false, size = 2, radius = 5, area, lane = 'need', mind, stake, create, join, skip, snap }) {
  const P = PEOPLE[who], t = Date.now();
  await type(who, '#ob-name', P.name); await tap(who, '#ob-age'); await tap(who, '[data-act=ob-next]');
  if (snap) await shot(who, snap + '-1-name');
  await P.page.waitForSelector('#lp-q-home');
  if (how === 'gps') { await tap(who, '[data-act=lp-gps]'); await until(who, async () => (await screen(who)).includes('from GPS')); }
  if (how === 'search') { await type(who, '#lp-q-home', search); await P.page.waitForSelector(`.res:has-text("${pick || search}")`, { timeout: 15000 }); if (snap) await shot(who, snap + '-2-search'); await tap(who, `.res:has-text("${pick || search}")`); }
  if (how === 'paste') { await tap(who, '[data-act=lp-paste]'); await type(who, '#lp-p-home', paste); await tap(who, 'form[data-form=lp-use] button'); }
  if (exact) await tap(who, '[data-act=lp-prec][data-v=exact]'); else await tap(who, `[data-act=lp-size][data-v="${size}"]`);
  await tap(who, `[data-act=lp-radius][data-v="${radius}"]`);
  if (area) await tap(who, `[data-act=lp-area]:has-text("${area}")`);
  if (snap) await shot(who, snap + '-3-place');
  await tap(who, '[data-act=ob-next]');
  if (create) { await type(who, '#ob-cname', create); await tap(who, '[data-act=ob-circle][data-v=create]'); }
  else if (join) { if (join !== true) await type(who, '#ob-code', join); await tap(who, '[data-act=ob-circle][data-v=join]'); }
  else await tap(who, '[data-act=ob-circle][data-v=skip]');
  await P.page.waitForSelector('#ob-mind', { timeout: 8000 });
  if (mind) { await tap(who, `[data-act=ob-lane][data-v=${lane}]`); await type(who, '#ob-mind', mind); if (stake != null) await tap(who, `[data-act=ob-stake][data-v="${stake}"]`); if (snap) await shot(who, snap + '-4-mind'); await tap(who, '[data-act=ob-finish][data-v=mind]'); }
  else await tap(who, '[data-act=ob-finish][data-v=skip]');
  await P.page.waitForSelector('nav.tabs', { timeout: 15000 }); await E.idle(P.page);
  P.onboard = Date.now() - t; P.onboardTaps = P.taps;
}
async function me(who) { return evalIn(who, () => S.me); }
async function circleCode(who) { return evalIn(who, () => S.circle && S.circle.code); }

(async () => {
  server = await E.startServer({ owner: 'alice@example.com' }); B = server.url;
  browser = await BR.launch();
  await setClock(at(0, 9));

  /* ===== Day 0, Monday: everyone signs up ===== */
  await open('alice');
  // a wrong code first, the way people mistype
  await type('alice', '#si-email', PEOPLE.alice.email); await tap('alice', 'button:has-text("Email me a code")'); await PEOPLE.alice.page.waitForSelector('#si-code');
  await type('alice', '#si-code', '000000'); await tap('alice', 'button:has-text("Sign in")');
  await ok('sign-in: a wrong code is refused with a clear message', async () => ((await screen('alice')).includes('isn’t right')));
  const real = await code(PEOPLE.alice.email); await type('alice', '#si-code', real); await tap('alice', 'button:has-text("Sign in")');
  await PEOPLE.alice.page.waitForSelector('#ob-name');
  ok('sign-in: the right code signs Alice in and starts onboarding', true);
  await onboard('alice', { how: 'gps', exact: true, mind: 'run 3 times a week', stake: 1, create: 'Third Floor', snap: 'p01-alice' });
  log('Alice', `Signed in with an emailed code, picked a handle, used GPS (exact pin, kept private), started Third Floor, then typed “run 3 times a week”: it became a pact with “I cook for the circle” as the stake. ${(PEOPLE.alice.onboard / 1000).toFixed(1)} s, ${PEOPLE.alice.onboardTaps} taps after sign-in.`);
  await shot('alice', 'p02-alice-today');
  const tf = await circleCode('alice');
  await PEOPLE.alice.page.reload(); await PEOPLE.alice.page.waitForSelector('nav.tabs');
  await ok('session survives a reload (cookie, 60 days)', async () => ((await evalIn('alice', () => S.me && S.me.name)) === 'Alice'));

  await open('bob'); await signIn('bob');
  await onboard('bob', { how: 'search', search: 'Lisbon', size: 1, mind: 'call home every Sunday', join: tf });
  // Bob then nudges his pin to his street by tapping the map
  log('Bob', `Searched "Lisbon", kept a 1 km² zone only, joined Third Floor with Alice's code. Sign-in ${(PEOPLE.bob.signin / 1000).toFixed(1)} s; onboarding ${(PEOPLE.bob.onboard / 1000).toFixed(1)} s.`);

  await open('carol'); await signIn('carol');
  await onboard('carol', { how: 'gps', size: 3, lane: 'urge', mind: 'tell someone how I feel', create: 'Night Shift' });
  const ns = await circleCode('carol');
  log('Carol', 'GPS, then a 9 km² zone (the biggest). Started Night Shift.');

  PEOPLE.erin.deep = '/#c' + ns; // she scanned Carol's invite QR with her phone camera
  await open('erin'); await signIn('erin');
  await onboard('erin', { how: 'gps', radius: 10, join: true });
  { const m = await me('erin'); await ok('invite QR link fills the code: Erin lands in Night Shift', async () => (!!m.circle && (await evalIn('erin', () => S.circle && S.circle.name)) === 'Night Shift')); ok('Amadora resolves to Lisbon for the feed and Decode', m.cityName === 'Lisbon', m.cityName); }
  log('Erin', 'Scanned Carol’s invite QR, which opened INSANE with the code filled in. GPS in Amadora, 8 km out; set drops to 10 km.');

  await setClock(at(0, 10));
  await open('kenji'); await signIn('kenji');
  await onboard('kenji', { how: 'gps', exact: true, mind: 'read 10 pages a day', create: 'Koenji Six', snap: 'p03-kenji' });
  await open('yui'); await signIn('yui');
  await onboard('yui', { how: 'search', search: 'Koenji', pick: 'Koenji', size: 1, lane: 'want', mind: 'see a gig every month', join: await circleCode('kenji'), snap: 'p04-yui' });
  { const m = await me('yui'); ok('street-level search (OpenStreetMap) finds Kōenji; Yui’s city is Tokyo', m.cityName === 'Tokyo', m.cityName + ' near ' + m.near); }
  log('Yui', 'Typed "Koenji": not a town in the place list, so the server asked OpenStreetMap and found the neighbourhood. 1 km² zone.');

  await open('tunde'); await signIn('tunde');
  await onboard('tunde', { how: 'gps', mind: 'be in bed by 1 every night', create: 'Ikeja Crew' });
  await open('ada'); await signIn('ada');
  await onboard('ada', { how: 'search', search: 'Ikeja', join: await circleCode('tunde') });
  { const m = await me('ada'); ok('Ikeja resolves to Lagos', m.cityName === 'Lagos', m.cityName); }

  await open('mariana'); await signIn('mariana');
  await onboard('mariana', { how: 'paste', paste: 'https://www.google.com/maps/place/Av.+Paulista/@-23.5614,-46.6559,17z', size: 2, skip: true, snap: 'p05-mariana' });
  { const m = await me('mariana'); ok('a pasted Google Maps link places Mariana on Av. Paulista, São Paulo', m.cityName === 'São Paulo' && Math.abs(m.cell.lat + 23.56) < 0.03, m.cityName); }
  log('Mariana', 'Pasted a Google Maps link instead of GPS. Looked around without a circle.');
  for (const who of ['dani', 'rui']) { await open(who); await signIn(who); await onboard(who, { how: 'gps', join: tf }); }
  log('Dani, Rui', 'Joined Third Floor with Alice’s code and skipped “what’s on your mind”. Third Floor is now four, enough for the Mole.');

  // privacy, checked the way an attacker would: straight at the server with a real session
  { const r = await api('bob', 'get', { path: `data/users/${(await evalIn('alice', () => S.uid))}/loc` });
    ok('privacy: Bob can’t read Alice’s exact pin, even asking the server directly', r.status === 403, r.status);
    const a = await api('bob', 'get', { path: 'people/' + (await evalIn('alice', () => S.uid)) });
    ok('privacy: Alice’s public profile has a 1 km² square, no coordinates', a.body.doc.cell.s === 1 && !('lat' in a.body.doc) && !('loc' in a.body.doc));
    const own = await api('alice', 'get', { path: `data/users/${(await evalIn('alice', () => S.uid))}/loc` });
    ok('privacy: Alice can read her own pin', own.status === 200 && Math.abs(own.body.doc.lat - 38.7139) < 1e-3);
    const b = await api('alice', 'get', { path: `data/users/${(await evalIn('bob', () => S.uid))}/loc` });
    ok('privacy: zone-only Bob has no pin stored at all', b.status === 403 || !b.body.doc);
    const bp = await api('alice', 'query', { col: `data/users/${(await evalIn('bob', () => S.uid))}` });
    ok('privacy: nobody can list someone else’s private space', bp.status === 403, bp.status);
  }
  ok('each person’s sign-in took under 4 s', Object.values(PEOPLE).every(p => !p.signin || p.signin < 4000), Object.entries(PEOPLE).map(([k, p]) => k + ' ' + p.signin + 'ms').join(', '));

  /* ===== Day 0 evening: a plan, messages, notifications ===== */
  await setClock(at(0, 18));
  await tab('alice', 'circle'); await tap('alice', '[data-act=sheet][data-v=thread-new]'); await tap('alice', '[data-act=tkind][data-v=plan]');
  await type('alice', '#t-title', 'Quiz night'); await type('alice', '#t-when', 'Thu 8pm'); await type('alice', '#t-where', 'Duque Bar');
  await tap('alice', '[data-act=t-create]'); await PEOPLE.alice.page.waitForSelector('#m-text');
  await type('alice', '#m-text', 'Thursday quiz, who’s in?'); await enter('alice', '#m-text');
  await until('bob', async () => (await evalIn('bob', () => (S.priv.inbox?.items || []).length)) > 0, 4000);
  // Bob is in quiet hours? 18:00 UTC is 19:00 in Lisbon: no. The plan pings only people going, so Bob isn't pinged yet.
  await tab('bob', 'today');
  await ok('Bob sees the new plan message on Today', async () => ((await screen('bob')).includes('Thursday quiz')));
  await ok('the bell counts it', async () => ((await PEOPLE.bob.page.locator('.bell .cnt').count()) === 1));
  await tap('bob', '.thr:has-text("Quiz night")'); await tap('bob', '[data-act=going]');
  await type('bob', '#m-text', 'in, I’ll bring snacks'); await enter('bob', '#m-text');
  await ok('Alice sees Bob going, live', async () => (await until('alice', async () => (await screen('alice')).includes('Bob ✓'))));
  { const inbox = () => evalIn('alice', () => S.priv.inbox?.items || []); await ok('server notified Alice (going) of Bob’s reply, nobody else', async () => (await inbox()).some(i => /Bob in Quiz night/.test(i.title)), async () => JSON.stringify((await inbox())[0] || {})); }
  log('Alice', 'Made "Quiz night, Thu 8pm". Bob tapped I’m in and replied; the server queued a notification to Alice only, because plans ping the people going.');
  await shot('alice', 'p06-plan');

  /* ===== Day 1, Tuesday: ticks, meeting in the kitchen, the feed, the daily dare, the Decode ===== */
  await setClock(at(1, 8));
  await tab('alice', 'today'); await tap('alice', '[data-act=tick]'); log('Alice', 'Ticked her run (1 of 3).');
  await tab('bob', 'city'); await tap('bob', '[data-act=sseg][data-v=feed]');
  await ok('City feed posting is locked until the circle has met in person', async () => ((await PEOPLE.bob.page.locator('form[data-form=post]').count()) === 0));
  await meet('alice', 'bob'); await meet('carol', 'erin');
  { const c = async () => db('alice', 'circles/' + (await evalIn('alice', () => S.me.circle))); await ok('scanning phones in the kitchen marks Third Floor as met in person', async () => Object.keys((await c()).verified || {}).length === 2, async () => JSON.stringify((await c()).verified)); }
  await tab('bob', 'city'); await tap('bob', '[data-act=sseg][data-v=feed]'); await tap('bob', '[data-act=pkind][data-v=Made]');
  await type('bob', '#p-text', 'Built a cardboard arcade cabinet for quiz night. It works. Barely.'); await tap('bob', 'form[data-form=post] button[type=submit]');
  await tab('erin', 'city'); await tap('erin', '[data-act=sseg][data-v=feed]'); await tap('erin', '[data-act=freact][data-r=in]');
  await tab('bob', 'city'); await tap('bob', '[data-act=sseg][data-v=feed]');
  await ok('Bob’s circle sees which circle wants in, no counts anywhere', async () => (await until('bob', async () => (await screen('bob')).includes('Wants in: Night Shift'))));
  { const postId = await evalIn('bob', () => S.posts[0].id); const r = await api('mariana', 'update', { path: 'posts/' + postId, data: { text: 'hacked', reacts: { someoneelse: { r: 'love' } } } });
    const d = await db('bob', 'posts/' + postId); ok('a stranger can’t edit a post or react for someone else', d.text.includes('cardboard') && !('someoneelse' in (d.reacts || {})), JSON.stringify(r.body)); }
  await tab('kenji', 'city'); await tap('kenji', '[data-act=sseg][data-v=feed]'); await ok('Tokyo’s feed doesn’t show Lisbon posts', async () => (!(await screen('kenji')).includes('cardboard')));
  log('Bob', 'Tried to post to the City feed: locked until his circle had met. He and Alice scanned phones in the kitchen, then the post went up. Erin (Night Shift) tapped “we’re in”; Bob sees “Wants in: Night Shift”, never a number.');
  await tab('bob', 'today'); await tap('bob', '[data-act=sheet][data-v=proof][data-id=daily]'); await type('bob', '#pr-note', 'the barista did the voice back');
  await PEOPLE.bob.page.setInputFiles('#pr-photo', { name: 'coffee.png', mimeType: 'image/png', buffer: PNG }); await PEOPLE.bob.page.waitForSelector('.sheet img[alt="Your photo"]'); await tap('bob', '[data-act=dare-did]');
  { const cid = await evalIn('bob', () => S.me.circle); const r = await api('alice', 'query', { col: `circles/${cid}/clips` }); ok('daily dare done with a photo; it sits in the circle’s clips for 24 h', r.body.docs.length === 1 && r.body.docs[0].data.exp - r.body.docs[0].data.at === DAY, JSON.stringify(r.body.docs.map(d => d.data.exp - d.data.at)));
    const bad = await api('mariana', 'set', { path: `circles/${cid}/clips/x1`, data: { by: await evalIn('mariana', () => S.uid), img: 'javascript:alert(1)', what: 'x' } }); ok('the server refuses a “clip” that isn’t a photo', bad.status === 400, bad.status); }
  await tab('alice', 'circle'); await tap('alice', '[data-act=cseg][data-v=plans]'); await ok('Alice sees Bob’s dare photo in the clips', async () => ((await PEOPLE.alice.page.locator('.vt-tile').count()) === 1));
  await tab('bob', 'circle'); await tap('bob', '[data-act=cseg][data-v=pacts]'); await tap('bob', '[data-act=cheer]');
  await tab('alice', 'circle'); await tap('alice', '[data-act=cseg][data-v=pacts]'); await ok('Alice sees Bob cheered her run', async () => (await until('alice', async () => (await screen('alice')).includes('Cheered by Bob'))));
  log('Bob', 'Did the daily dare (“order your coffee in the voice of a movie trailer”), added a photo: it’s in Third Floor’s clips for 24 hours. Then cheered Alice’s run.');
  const wk = await evalIn('carol', () => weekNum()); const ans = ANS[wk % 8];
  await tab('carol', 'city'); await tap('carol', '[data-act=sheet][data-v=decode]');
  await evalIn('carol', () => { window.__c = 0; new MutationObserver(() => { if (document.querySelector('.celebrate')) window.__c++; }).observe(document.body, { childList: true }); });
  const tDec = Date.now();
  await type('carol', '#dec-a', 'river'); await enter('carol', '#dec-a');
  await type('carol', '#dec-a', ans.toLowerCase()); await enter('carol', '#dec-a');
  await ok('Decode: Carol solves first in Lisbon', async () => (await until('carol', async () => (await sheet('carol')).includes('Solved, 1st in Lisbon'))));
  await ok('the solve gets a stamp-and-confetti moment', async () => ((await evalIn('carol', () => window.__c)) > 0));
  timings.decode = Date.now() - tDec;
  await shot('carol', 'p07-decode'); await tap('carol', '[data-act=sheet-close]');
  { // a hand-made client trying to post a solve without knowing the answer
    const wkKey = await evalIn('mariana', () => weekKey()); const uid = await evalIn('mariana', () => S.uid);
    const r = await api('mariana', 'set', { path: `solves/${wkKey}_${uid}`, data: { week: wkKey, city: 'BR-sao_paulo-sao_paulo', uid, name: 'Mariana', at: Date.now(), hints: 0, answer: 'GUESS' } });
    ok('server refuses a forged Decode solve with the wrong answer', r.status === 400 && r.body.message === 'wrong_answer', JSON.stringify(r));
    const r2 = await api('mariana', 'set', { path: `solves/${wkKey}_${await evalIn('alice', () => S.uid)}`, data: { week: wkKey, answer: ans } });
    ok('server refuses a solve filed under someone else’s name', r2.status === 403, r2.status);
  }
  await tab('kenji', 'city'); await tap('kenji', '[data-act=sseg][data-v=map]'); await tap('kenji', '[data-act=sheet][data-v=decode]'); await type('kenji', '#dec-a', ans); await enter('kenji', '#dec-a');
  await ok('Decode is per city: Kenji is 1st in Tokyo, not 2nd', async () => (await until('kenji', async () => (await sheet('kenji')).includes('Solved, 1st in Tokyo'))));
  await tap('kenji', '[data-act=sheet-close]');
  await tab('alice', 'city'); await tap('alice', '[data-act=sheet][data-v=decode]'); await type('alice', '#dec-a', ans); await enter('alice', '#dec-a'); await tap('alice', '[data-act=sheet-close]');
  log('Carol', `Solved the Decode on the second try, 1st in Lisbon (${(timings.decode / 1000).toFixed(1)} s with a wrong guess). Kenji solved it in Tokyo the same morning and was 1st there.`);

  /* ===== Day 1 evening: favors and pots ===== */
  await setClock(at(1, 19));
  await tab('bob', 'ledger'); await tap('bob', '[data-act=fv-form][data-v=ask]'); await type('bob', '#fv-what', 'Help me carry a wardrobe upstairs'); await tap('bob', '[data-act=fv-h][data-v="2"]'); await tap('bob', '[data-act=fv-ask]');
  await ok('the circle is notified of a favor ask', async () => (await evalIn('rui', () => S.priv.inbox?.items || [])).some(i => /asks a favor/.test(i.title)));
  await tab('alice', 'today'); await until('alice', async () => (await screen('alice')).includes('wardrobe'));
  await tap('alice', '[data-act=fv-claim]'); await tap('alice', '[data-act=fv-done]'); await tap('alice', '[data-act=fv-h2][data-v="1"]'); await tap('alice', '[data-act=fv-done-save]');
  { const cid = await evalIn('alice', () => S.me.circle); const fid = await evalIn('alice', () => S.favors[0].id);
    const r = await api('alice', 'update', { path: `circles/${cid}/favors/${fid}`, data: { status: 'logged' } }); ok('only the person helped can log a favor (Alice can’t confirm her own work)', r.status === 403, r.status); }
  await tab('bob', 'today'); await until('bob', async () => /favor done for you/i.test(await screen('bob'))); await tap('bob', '[data-act=fv-confirm]');
  await tab('alice', 'ledger'); await ok('ledger after one favor: Alice +1 h, Bob −1 h', async () => (await until('alice', async () => { const t = await screen('alice'); return /YOUR BALANCE\s*\+1 h/i.test(t) && /Bob\s*−1 h/.test(t); })));
  await shot('alice', 'p06b-ledger');
  { const cid = await evalIn('bob', () => S.me.circle); const auid = await evalIn('alice', () => S.uid);
    const r1 = await api('bob', 'set', { path: `circles/${cid}/favors/f1`, data: { what: 'Lifts to the airport', h: 4, asker: await evalIn('bob', () => S.uid), doer: auid, status: 'logged' } });
    const r2 = await api('bob', 'set', { path: `circles/${cid}/favors/f2`, data: { what: 'Moving day', h: 4, asker: await evalIn('bob', () => S.uid), doer: auid, status: 'logged' } });
    ok('mutual credit limit: Bob can log favors received down to −5 h, not past it', r1.status === 200 && r2.status === 400, r1.status + ' then ' + r2.status + ' ' + JSON.stringify(r2.body));
    const r3 = await api('bob', 'set', { path: `circles/${cid}/favors/f3`, data: { what: 'Fake', h: 4, asker: auid, doer: await evalIn('bob', () => S.uid), status: 'logged' } });
    ok('nobody can log a favor in someone else’s name to pay themselves', r3.status === 403, r3.status); }
  log('Alice', 'Bob asked for help carrying a wardrobe (2 h). Alice said she’d do it, did it in an hour and adjusted it; Bob confirmed. Ledger: Alice +1 h, Bob −1 h. The server keeps the −5 h limit and won’t let anyone log hours for themselves.');
  await tab('alice', 'ledger'); await tap('alice', '[data-act=lseg][data-v=pots]'); await tap('alice', '[data-act=pot-new]');
  await type('alice', '#np-name', 'Porto weekend'); await type('alice', '#np-each', '60'); await type('alice', '#np-by', 'Friday'); await type('alice', '#np-min', '3'); await type('alice', '#np-pay', 'MB Way 912 000 000'); await tap('alice', '[data-act=pot-create]');
  await ok('the pot is in euros because Alice is in Portugal', async () => ((await screen('alice')).includes('€60 each')));
  for (const who of ['bob', 'dani']) { await tab(who, 'today'); await until(who, async () => (await screen(who)).includes('Porto weekend')); await tap(who, '[data-act=pot-go]'); await tap(who, '[data-act=pledge]'); }
  await ok('third pledge meets the goal', async () => (await until('alice', async () => (await evalIn('alice', () => { const p = S.threads.find(t => t.title === 'Porto weekend'); return p && Object.values(p.pledges).filter(Boolean).length; })) === 3)));
  await tab('bob', 'ledger'); await tap('bob', '[data-act=lseg][data-v=pots]'); await tap('bob', '[data-act=pot-pay]'); await tap('bob', '[data-act=pot-paid][data-m="Bank transfer"]');
  { const cid = await evalIn('bob', () => S.me.circle); const pid = await evalIn('bob', () => S.threads.find(t => t.title === 'Porto weekend').id); const buid = await evalIn('bob', () => S.uid);
    await api('bob', 'update', { path: `circles/${cid}/threads/${pid}`, data: { paid: { [buid]: true } } }); const p = await db('alice', `circles/${cid}/threads/${pid}`);
    ok('Bob can’t confirm his own payment; only the organiser can', p.paid[buid] === 'wait', JSON.stringify(p.paid)); }
  await tab('alice', 'today'); await until('alice', async () => /did it land/i.test(await screen('alice'))); await tap('alice', '[data-act=pot-go]'); await tap('alice', '[data-act=pot-confirm]');
  await shot('alice', 'p06c-pot');
  log('Alice', 'Started “Porto weekend”, pledge-then-pay, €60 each, goes ahead at 3. Bob and Dani pledged from their Home screens; Bob paid by bank transfer and Alice confirmed it landed. INSANE never touched the money.');

  /* ===== Day 2, Wednesday: Carol hosts a two-key drop for Thursday 18:00 Lisbon (17:00 UTC) ===== */
  await setClock(at(2, 12));
  await tab('carol', 'city'); await tap('carol', '[data-act=sseg][data-v=map]'); await tap('carol', '[data-act=sheet][data-v=host]');
  await tap('carol', '[data-act=dkind][data-v=twokey]'); await type('carol', '#d-venue', 'Ler Devagar'); await type('carol', '#d-addr', 'LX Factory, Alcântara');
  await type('carol', '#lp-q-drop', 'Lisbon'); await PEOPLE.carol.page.waitForSelector('.res'); await tap('carol', '.res >> nth=0');
  await PEOPLE.carol.page.locator('[data-map="pick-drop"] canvas').click({ position: { x: 120, y: 150 } }); // tap the exact spot
  const dday = await evalIn('carol', t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }, at(3, 17));
  await type('carol', '#d-date', dday); await type('carol', '#d-time', '18:00'); await type('carol', '#d-prize', 'A free drink for everyone there');
  await tap('carol', '[data-act=d-create]');
  const doorCode = (await PEOPLE.carol.page.locator('.sheet .big').innerText()).trim();
  ok('host sees a 6-character door code', /^[A-Z2-9]{6}$/.test(doorCode), doorCode);
  await shot('carol', 'p08-host');
  const dropId = await evalIn('carol', () => S.ui.sheet.id);
  { const r = await api('bob', 'get', { path: 'drops/' + dropId }); ok('server hides the door code from everyone but the host', r.status === 200 && !('code' in r.body.doc) && r.body.doc.venue === 'Ler Devagar'); }
  await tap('carol', '[data-act=sheet-close]');
  for (const who of ['alice', 'bob', 'erin', 'kenji', 'mariana']) { await tab(who, 'city'); await tap(who, '[data-act=sseg][data-v=map]'); }
  await ok('Alice (exact, 5 km) sees the drop', async () => ((await screen('alice')).includes('Ler Devagar')));
  await ok('Erin (8 km away, 10 km radius) sees it', async () => ((await screen('erin')).includes('Ler Devagar')));
  await ok('Tokyo never sees a Lisbon drop', async () => (!(await screen('kenji')).includes('Ler Devagar')));
  await shot('alice', 'p09-city-map');
  log('Carol', 'Hosted a two-key drop at Ler Devagar for Thursday 18:00, tapped the exact door on the map. Alice, Bob and Erin (10 km radius) see it; Tokyo and São Paulo don’t.');

  // Tokyo: Kenji's shop offer and the draw anyone can check
  await setClock(at(3, 10)); // 19:00 in Tokyo
  await tab('kenji', 'city'); await tap('kenji', '[data-act=sseg][data-v=map]'); await tap('kenji', '[data-act=sheet][data-v=host]');
  await tap('kenji', '[data-act=dkind][data-v=offer]'); await type('kenji', '#d-venue', 'Kōenji Record Bar'); await type('kenji', '#d-prize', '10% off for everyone, a ¥3000 voucher drawn');
  const kd = await evalIn('kenji', t => { const d = new Date(t); return [d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')]; }, at(3, 10) - 5 * MIN);
  await type('kenji', '#d-date', kd[0]); await type('kenji', '#d-time', kd[1]); await tap('kenji', '[data-act=dlen][data-v="30"]');
  await tap('kenji', '[data-act=d-create]');
  const kcode = (await PEOPLE.kenji.page.locator('.sheet .big').innerText()).trim(); await tap('kenji', '[data-act=sheet-close]');
  await tab('yui', 'city'); await tap('yui', '[data-act=sseg][data-v=map]'); await tap('yui', '.drop:has-text("Record Bar")'); await type('yui', '#d-code', kcode); await enter('yui', '#d-code');
  await setClock(at(3, 10, 40));
  await tab('yui', 'today'); await tab('yui', 'city'); await tap('yui', '[data-act=sseg][data-v=map]'); await tap('yui', '.drop:has-text("Record Bar")');
  await tap('yui', '[data-act=draw-run]');
  await ok('the draw runs, lands, and explains how anyone can check it', async () => (/Anyone can check it/.test(await sheet('yui')) && (await sheet('yui')).includes('Koenji Six')));
  await shot('yui', 'p12-draw');
  await tap('yui', '[data-act=sheet-close]');
  log('Yui', 'Checked in at Kenji’s record-bar offer. After it closed she ran the draw: it spun through the circles and landed on Koenji Six, with how to check it.');

  /* ===== Day 3, Thursday: the drop ===== */
  await setClock(at(3, 16, 50)); // the server's sweep (every 20 s) sends "opens in 15 min": the check below polls for it
  { await ok('15 minutes before, people within their distance get a notification', async () => (await evalIn('erin', () => S.priv.inbox?.items || [])).some(i => /Ler Devagar opens in 15 min/.test(i.title)), async () => JSON.stringify((await evalIn('erin', () => S.priv.inbox?.items || [])).slice(0, 2)), 45000);
    const kinbox = await evalIn('kenji', () => S.priv.inbox?.items || []); ok('…and people in Tokyo don’t', !kinbox.some(i => /Ler Devagar/.test(i.title))); }
  await setClock(at(3, 17, 10));
  await tab('bob', 'city'); await tap('bob', '[data-act=sseg][data-v=map]'); await tap('bob', '.drop:has-text("Ler Devagar")');
  await type('bob', '#d-code', 'ZZZZZZ'); await enter('bob', '#d-code');
  await ok('wrong door code is refused (checked by the server)', async () => (!(await sheet('bob')).includes('You’re checked in')));
  { const uid = await evalIn('mariana', () => S.uid); const r = await api('mariana', 'set', { path: `checkins/${dropId}_${uid}`, data: { drop: dropId, city: 'x', week: 'x', uid, circle: null, code: 'AAAAAA' } });
    ok('a hand-made client can’t check in without the code', r.status === 400 && r.body.message === 'wrong_code', JSON.stringify(r.body)); }
  const tCheck = Date.now();
  await type('bob', '#d-code', doorCode.toLowerCase()); await enter('bob', '#d-code');
  await ok('right code checks Bob in; the server stamps it verified', async () => (await until('bob', async () => /checked in[\s\S]*checked by the server/.test(await sheet('bob')))));
  timings.checkin = Date.now() - tCheck;
  await ok('two-key stays locked with one circle', async () => ((await sheet('bob')).includes('Locked.')));
  await tab('erin', 'city'); await tap('erin', '[data-act=sseg][data-v=map]'); await tap('erin', '.drop:has-text("Ler Devagar")');
  await type('erin', '#d-code', doorCode); await enter('erin', '#d-code');
  await ok('two-key unlocks when a second circle arrives, live for Bob', async () => (await until('bob', async () => (await sheet('bob')).includes('Unlocked.'))));
  await shot('bob', 'p10-twokey');
  await tap('bob', '[data-act=sheet-close]'); await tab('bob', 'you');
  await ok('Bob’s passport gets a DROP stamp', async () => (/Passport · [1-9] stamps?/i.test(await screen('bob')) && (await screen('bob')).includes('Ler Devagar')));
  await shot('bob', 'p11-passport');
  log('Bob', `Got the 15-minute notice, typed the wrong code first (refused), then the right one: checked in ${(timings.checkin / 1000).toFixed(1)} s after typing. Locked until Erin from Night Shift arrived, then it opened for both. A DROP stamp went into his passport.`);

  /* ===== Day 4, Friday: Midnight and sealed ===== */
  await setClock(at(4, 20));
  await tab('bob', 'circle'); await tap('bob', '[data-act=cseg][data-v=midnight]');
  await type('bob', '#mn-text', 'Whoever fixed the boiler on Tuesday: you are a legend.'); await tap('bob', '[data-act=mnwhen][data-v=tonight]'); await tap('bob', '[data-act=mn-send]');
  await tab('alice', 'circle'); await tap('alice', '[data-act=cseg][data-v=midnight]'); await tap('alice', '[data-act=mnmode][data-v=sealed]');
  await type('alice', '#seal-text', 'By the time you read this I’ll have run a 10k.'); await tap('alice', '[data-act=seal-send]');
  // Alice proposes a Mission for Saturday 15:00 Lisbon (14:00 UTC)
  await tab('alice', 'city'); await tap('alice', '[data-act=sseg][data-v=map]'); await tap('alice', '[data-act=sheet][data-v=propose]');
  await type('alice', '#ms-title', 'The Slow Walk'); await type('alice', '#ms-desc', 'Everyone crosses the square at one step every five seconds, in silence, then walks off as if nothing happened.');
  await type('alice', '#ms-roles', 'Look at your watch on every step\nHum one note, very quietly\nCarry something orange'); await type('alice', '#ms-spot', 'Under the arch on the river side');
  await type('alice', '#ms-date', await ymdIn('alice', at(5, 14))); await type('alice', '#ms-time', await hmIn('alice', at(5, 14))); await pin('alice', 'drop', '38.7077, -9.1365');
  await tap('alice', '[data-act=ms-create]'); await shot('alice', 'p10b-mission'); await esc('alice');
  const msId = await evalIn('alice', () => S.missions[0] && S.missions[0].id);
  await tab('carol', 'city'); await tap('carol', '[data-act=sseg][data-v=map]'); await tap('carol', '[data-act=ms-confirm]'); await tap('carol', '[data-act=ms-in]');
  { const m = await db('carol', 'missions/' + msId); ok('a day ahead, the server hides the exact spot from people in other circles, even ones who said yes', m && m.spot === '' && m.roles.length === 3, m && JSON.stringify({ spot: m.spot, roles: m.roles.length }));
    const k = await db('kenji', 'missions/' + msId); ok('people who haven’t said yes don’t get the secret briefings', k && k.roles.length === 0);
    const r = await api('carol', 'update', { path: 'missions/' + msId, data: { title: 'Hijacked', confirms: { fakecircle: 'x' } } }); const m2 = await db('alice', 'missions/' + msId);
    ok('another circle can confirm for itself, not rename a Mission or confirm for others', m2.title === 'The Slow Walk' && !('fakecircle' in m2.confirms) && Object.keys(m2.confirms).length === 1, JSON.stringify(m2.confirms)); }
  await ok('Carol gets a secret briefing on the card', async () => ((await screen('carol')).includes('YOUR BRIEFING')));
  log('Alice', 'Proposed a Mission for Saturday afternoon: “The Slow Walk”, with three secret briefings and the exact spot under the arch. The map shows a 350 m circle, nudged so it doesn’t give the spot away. Carol confirmed for Night Shift and said she’s in; she got her briefing, not the spot.');
  { const cid = await evalIn('alice', () => S.me.circle); const r = await api('alice', 'query', { col: `circles/${cid}/midnight` });
    ok('before midnight the server sends no text, and no author is stored', r.body.docs.length === 1 && r.body.docs[0].data.text === null && !('by' in r.body.docs[0].data));
    const s2 = await api('bob', 'query', { col: `circles/${cid}/sealed` }); ok('sealed text stays on the server until it opens', s2.body.docs[0].data.text === null && s2.body.docs[0].data.by); }
  await setClock(at(5, 0, 5)); // the sweep releases Midnight within 20 s: the check below polls for it
  { const cid = await evalIn('alice', () => S.me.circle); await ok('after midnight (Lisbon) the text is out', async () => { const r = await api('alice', 'query', { col: `circles/${cid}/midnight` }); return r.body.docs[0].data.text && r.body.docs[0].data.text.includes('boiler'); }, '', 45000); }
  { const pl = async () => (await (await fetch(B + '/api/dev/pushlog')).json()).log; // the sweep that releases it sends the push: poll for it
    await ok('Midnight goes out at 00:00, held for quiet hours (Alice’s are 23:00–08:00)', async () => (await pl()).some(l => l.title === 'Midnight' && l.held === 'quiet'), async () => JSON.stringify((await pl()).filter(l => l.title === 'Midnight').slice(0, 2)), 45000); }
  log('Bob', 'Wrote an unsigned Midnight message. Until midnight the server sent nobody its text, and it never stored who wrote it. At 00:00 it went out; the notification was held because everyone was in quiet hours.');

  /* ===== Day 5, Saturday: a trail and the Mission ===== */
  await setClock(at(5, 10));
  await tab('carol', 'city'); await tap('carol', '[data-act=sseg][data-v=map]'); await tap('carol', '[data-act=sheet][data-v=trail-new]'); await type('carol', '#tr-title', 'The Bridges Trail');
  for (const [n, ll, d] of [['River steps', '38.7071, -9.1365', 'Count the arches out loud'], ['Old tram stop', '38.7110, -9.1330', ''], ['Miradouro', '38.7130, -9.1300', 'Point at your house']]) { await type('carol', '#tr-sname', n); if (d) await type('carol', '#tr-sdare', d); await pin('carol', 'drop', ll); await tap('carol', '[data-act=tr-add]'); }
  await type('carol', '#tr-date', await ymdIn('carol', at(5, 10))); await type('carol', '#tr-from', await hmIn('carol', at(5, 10))); await type('carol', '#tr-to', await hmIn('carol', at(5, 13))); await tap('carol', '[data-act=tr-create]');
  await shot('carol', 'p12b-trail'); await esc('carol');
  await tab('erin', 'city'); await tap('erin', '[data-act=sseg][data-v=map]'); await tap('erin', '.drop:has-text("Bridges Trail")'); await tap('erin', '[data-act=tr-stamp]'); await until('erin', async () => (await evalIn('erin', () => S.toast || '')).includes('from River steps'));
  await ok('stamping from home is refused: Erin’s phone says she’s 7 km away', async () => ((await evalIn('erin', () => S.toast || '')).includes('from River steps') && !(await evalIn('erin', () => S.stamps.some(x => x.uid === S.uid)))), async () => (await evalIn('erin', () => S.toast)));
  await PEOPLE.erin.ctx.setGeolocation({ latitude: 38.70715, longitude: -9.13655, accuracy: 10 });
  await tap('erin', '[data-act=tr-stamp]'); await until('erin', async () => evalIn('erin', () => S.stamps.some(x => x.uid === S.uid)), 8000);
  { const st = await evalIn('erin', () => S.stamps.find(x => x.uid === S.uid)); ok('at the river steps the stamp is checked by GPS', st && Object.values(st.stops)[0].how === 'gps', JSON.stringify(st && st.stops)); }
  await PEOPLE.erin.ctx.setGeolocation({ latitude: PEOPLE.erin.geo[0], longitude: PEOPLE.erin.geo[1], accuracy: 12 }); await esc('erin');
  await setClock(at(5, 12, 30)); // 13:30 Lisbon, 90 min before the Mission
  { const m = await db('carol', 'missions/' + msId); ok('two hours before, the exact spot goes to Carol because she said yes', m && m.spot === 'Under the arch on the river side', m && m.spot);
    const k = await db('kenji', 'missions/' + msId); ok('…and still not to anyone who didn’t', k && k.spot === ''); }
  { const tid = await evalIn('erin', () => S.trails[0].id); await setClock(at(5, 13, 30)); const uid = await evalIn('erin', () => S.uid);
    const r = await api('erin', 'set', { path: `stamps/${tid}_${uid}`, data: { trail: tid, uid, stops: { 1: { at: 1, how: 'gps' } } } }); ok('the server refuses stamps after the trail closes', r.status === 400, r.status); }
  log('Erin', 'Opened Night Shift’s Bridges Trail from home and tapped Stamp: refused, her phone said she was kilometres away. At the river steps it stamped by GPS. After the trail closed the server refused late stamps.');
  await setClock(at(5, 15)); await tab('carol', 'city'); await tap('carol', '[data-act=sseg][data-v=map]'); await tap('carol', '[data-act=ms-verdict][data-x=y]');
  { const m = await db('alice', 'missions/' + msId); ok('afterwards, people who were in say whether it happened as described', Object.values(m.verdict || {}).includes(true)); }
  log('Carol', 'At 13:30 the spot appeared on her card (“under the arch on the river side”); people who hadn’t said yes still saw only the area. After the walk she told INSANE it happened as described, which keeps Third Floor’s Reliability.');

  /* ===== Day 5, Saturday: meeting in person ===== */
  await setClock(at(5, 16));
  await tab('carol', 'circle'); await tap('carol', '[data-act=cseg][data-v=people]'); await tap('carol', '[data-act=sheet][data-v=meet]'); await tap('carol', '[data-act=pair-show]');
  await ok('meet shows a QR code and the 6 digits', async () => ((await PEOPLE.carol.page.locator('.sheet .qr svg').count()) === 1));
  const pcode = (await PEOPLE.carol.page.locator('.sheet .big').innerText()).trim();
  await shot('carol', 'p13-meet');
  { const r = await api('mariana', 'set', { path: 'met/' + [await evalIn('mariana', () => S.uid), await evalIn('carol', () => S.uid)].sort().join('__'), data: { ids: [await evalIn('mariana', () => S.uid), await evalIn('carol', () => S.uid)], code: '123456' } });
    ok('nobody can make a “met” without being shown the code', r.status === 400, JSON.stringify(r.body)); }
  // Alice scans the QR with her phone camera: it opens INSANE at /#m<code>
  await PEOPLE.alice.page.goto(B + '/#m' + pcode); await PEOPLE.alice.page.waitForSelector('nav.tabs');
  await ok('scanning the QR connects Alice and Carol', async () => (await until('alice', async () => (await evalIn('alice', () => S.met.some(m => m.ids.some(i => S.people[i] && S.people[i].name === 'Carol')))), 8000)));
  await tap('carol', '[data-act=sheet-close]').catch(() => { });
  await tab('alice', 'circle'); await tap('alice', '[data-act=cseg][data-v=people]'); await tap('alice', '.thr:has-text("Carol")');
  await type('alice', '#m-text', 'good to meet you at the drop!'); await enter('alice', '#m-text');
  await tab('carol', 'circle'); await tap('carol', '[data-act=cseg][data-v=people]');
  await ok('direct messages work only after meeting', async () => (await until('carol', async () => { await tap('carol', '.thr:has-text("Alice")').catch(() => { }); return (await screen('carol')).includes('good to meet you'); })));
  log('Alice', 'Met Carol from the other circle. Scanned her QR with the phone camera; INSANE opened with the code and connected them. A MET stamp, then a first direct message.');

  /* ===== Day 6, Sunday: the week in review ===== */
  await setClock(at(6, 9));
  for (const d of [6]) { await tab('alice', 'today'); await tap('alice', '[data-act=tick]').catch(() => { }); }
  await setClock(at(6, 10)); await tab('alice', 'you'); await tab('alice', 'today'); await tap('alice', '[data-act=tick]').catch(() => { });
 
  const aliceToday = await screen('alice');
  ok('Sunday shows “Your week” from the private timeline', /your week/i.test(aliceToday), aliceToday.slice(0, 200));
  await shot('alice', 'p14-sunday');

  /* ===== Day 7–13: a dare, and the Mole ===== */
  await setClock(at(7, 9));
  await tab('alice', 'today'); await tap('alice', '[data-act=make]'); await tap('alice', '[data-act=mk][data-v=dare]'); await tap('alice', '.sheet [data-act=dare-to]:has-text("Bob")');
  await type('alice', '#dr-text', 'Ask the bus driver for their favourite stop'); await tap('alice', '[data-act=dare-lvl][data-v="4"]'); await tap('alice', '[data-act=dare-add]');
  await ok('Bob is notified he’s been dared', async () => (await evalIn('bob', () => S.priv.inbox?.items || [])).some(i => /Alice dared you/.test(i.title)));
  await tab('bob', 'today'); await until('bob', async () => /alice dared you/i.test(await screen('bob'))); await tap('bob', '[data-act=dare-accept]');
  await tap('bob', '[data-act=sheet][data-v=proof]:not([data-id=daily])'); await tap('bob', '[data-act=dare-did]');
  { const cid = await evalIn('bob', () => S.me.circle); const r = await api('alice', 'query', { col: `circles/${cid}/dares` }); const d = r.body.docs.find(x => x.data.to); ok('Bob accepts and does the dare; only he could mark it done', d && d.data.status === 'done'); }
  await tab('bob', 'circle'); await tap('bob', '[data-act=cseg][data-v=mole]'); await tap('bob', '[data-act=mole-claim]');
  await ok('Bob takes the Mole for week 2 and sees three secret tasks', async () => ((await PEOPLE.bob.page.locator('.tasks li').count()) === 3));
  { const cid = await evalIn('bob', () => S.me.circle); const wk = await evalIn('bob', () => weekKey()); const m = await db('alice', `circles/${cid}/moles/${wk}`);
    await ok('the server stores no name on the Mole', async () => (m && !JSON.stringify(m).includes(await evalIn('bob', () => S.uid))), JSON.stringify(m));
    const r = await api('alice', 'update', { path: `circles/${cid}/moles/${wk}`, data: { revealed: { uid: await evalIn('alice', () => S.uid), done: 3 } } }); ok('nobody but the Mole can reveal the Mole', r.status === 403, r.status); }
  for (let i = 0; i < 3; i++) { await tap('bob', '[data-act=mole-step]'); }
  await tab('alice', 'circle'); await tap('alice', '[data-act=cseg][data-v=mole]'); await tap('alice', '[data-act=mole-vote]:has-text("Bob")');
  await tab('dani', 'circle'); await tap('dani', '[data-act=cseg][data-v=mole]'); await tap('dani', '[data-act=mole-vote]:has-text("Rui")');
  await tab('rui', 'circle'); await tap('rui', '[data-act=cseg][data-v=mole]'); await tap('rui', '[data-act=mole-vote]:has-text("Dani")');
  log('Bob', 'Picked up the Mole for week 2: three tasks from INSANE’s list, visible only to him. The store says only “someone is the Mole”. Alice guessed Bob; Dani and Rui guessed each other.');

  /* ===== Day 7–8: dark and calm ===== */
  await setClock(at(8, 12));
  await tab('bob', 'you'); await tap('bob', '[data-act=dark-setup]'); await tap('bob', '[data-act=darkH][data-v="6"]'); await tap('bob', '[data-act=dark-go]');
  await ok('Go dark blanks INSANE with a countdown and a breathing circle', async () => ((await PEOPLE.bob.page.locator('.darkall .breath').count()) === 1));
  await shot('bob', 'p15-dark');
  await tab('alice', 'circle'); await tap('alice', '[data-act=close]').catch(() => { }); await tap('alice', '[data-act=cseg][data-v=chat]'); await tap('alice', '.thr:has-text("Quiz night")');
  await type('alice', '#m-text', 'same time next week?'); await enter('alice', '#m-text');
  { const pl = await (await fetch(B + '/api/dev/pushlog')).json(); const bobUid = await evalIn('bob', () => S.uid);
    ok('while Bob is dark, the server holds his notifications', pl.log.some(l => l.uid === bobUid && l.held === 'quiet' && /Quiz night/.test(l.title))); }
  await tab('carol', 'you'); await PEOPLE.carol.page.check('input[data-pref=calm]'); await tab('carol', 'today');
  await ok('calm mode hides the bell count and red dots', async () => ((await PEOPLE.carol.page.locator('.bell .cnt, nav .dot').count()) === 0));
  log('Bob', 'Went dark for 6 hours. Alice posted in Quiz night meanwhile; the server held his notification. Carol switched on calm mode: no counts, no dots, less on Today.');

  /* ===== Day 9: here now ===== */
  await setClock(at(9, 18));
  await tab('alice', 'today'); await tab('bob', 'today').catch(() => { });
  await PEOPLE.bob.page.evaluate(() => S.db.doc('people/' + S.uid).update({ darkUntil: 0 }));
  await ok('Today shows who in your circle is here now', async () => (await until('alice', async () => /here now/.test(await screen('alice')), 6000)));

  /* ===== Day 10–12: calls, distances, changing your place ===== */
  await setClock(at(10, 17));
  await meet('tunde', 'ada'); // they finally see each other at five-a-side
  await tab('tunde', 'city'); await tap('tunde', '[data-act=sseg][data-v=calls]'); await type('tunde', '#c-ask', 'two more for five-a-side on Saturday'); await tap('tunde', 'form[data-form=call] button[type=submit]');
  await tab('ada', 'city'); await tap('ada', '[data-act=sseg][data-v=calls]');
  await ok('a call from your own circle can’t be answered by you (it needs another circle)', async () => (!(await screen('ada')).includes('We can help')));
  log('Tunde', 'Calls were locked until he and Ada scanned phones at five-a-side. Then he sent a call for two more players. Lagos has only one circle in the test, so nobody could answer: the call waits. (A real finding: calls need a second circle nearby.)');
  await setClock(at(12, 10));
  await tab('carol', 'city'); await tap('carol', '[data-act=sseg][data-v=map]'); await tap('carol', '[data-act=sheet][data-v=host]');
  await tap('carol', '[data-act=dkind][data-v=swap]'); await type('carol', '#d-venue', 'Santos Swap Box'); await type('carol', '#d-prize', 'A box of paperbacks');
  { const dd = await evalIn('carol', t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }, at(13, 17)); await type('carol', '#d-date', dd); }
  await tap('carol', '[data-act=d-create]'); await tap('carol', '[data-act=sheet-close]');
  await setClock(at(12, 12));
  await tab('erin', 'city'); await tap('erin', '[data-act=sseg][data-v=map]');
  await ok('Erin (10 km) sees the new Santos swap box, 8 km away', async () => ((await screen('erin')).includes('Santos Swap Box')));
  await tab('erin', 'you'); await tap('erin', '[data-act=sheet][data-v=profile]'); await tap('erin', '[data-act=lp-radius][data-v="2"]'); await tap('erin', '[data-act=pf-save]');
  await tab('erin', 'city'); await tap('erin', '[data-act=sseg][data-v=map]');
  const et = await screen('erin');
  ok('shrinking the distance to 2 km takes the 8 km drop off Erin’s list and says how many are further out', !et.includes('Santos Swap Box') && /further than your 2 km/.test(et), et.slice(0, 300));

  /* ===== Day 13: owner's numbers, export, delete ===== */
  await setClock(at(13, 19));
  await tab('alice', 'you'); await tap('alice', '[data-act=stats]');
  await ok('owner’s Test results count all eleven people', async () => /11 people/.test(await screen('alice')), async () => ((await screen('alice')).match(/\d+ people[^.]*/) || [''])[0]);
  await setClock(at(13, 21, 5)); // Sunday 21:05 Lisbon (clocks went back on day 6)
  await tab('bob', 'circle'); await tap('bob', '[data-act=cseg][data-v=mole]'); await tap('bob', '[data-act=mole-reveal]');
  await tab('alice', 'circle'); await tap('alice', '[data-act=cseg][data-v=mole]');
  await ok('Sunday 21:00: Bob reveals himself; 1 of 3 guessed him, so he got away with it', async () => (await until('alice', async () => /Bob was the Mole\.[^\n]*1 vote out of 3\. Got away with it\./.test(await screen('alice')))), async () => ((await screen('alice')).match(/was the Mole[^\n]*/)?.[0]));
  await shot('alice', 'p16b-mole');
  log('Bob', 'Sunday 21:00 he revealed himself: tasks done, one vote out of three. He got away with it.');
  await shot('alice', 'p16-results');
  await tab('mariana', 'you'); await tap('mariana', '[data-act=del-ask]'); await tap('mariana', '[data-act=del-yes]');
  { const r = await api('alice', 'get', { path: 'people/' + (await evalIn('mariana', () => S.uid)) }); ok('delete removes Mariana’s profile from the server', r.status === 200 && r.body.doc === null); }
  await tab('yui', 'you'); await tap('yui', '[data-act=signout]'); await PEOPLE.yui.page.waitForSelector('#si-email');
  ok('sign out returns to the email screen', true);

  // layout
  for (const who of ['alice', 'kenji']) { const w = await evalIn(who, () => document.documentElement.scrollWidth); ok('no sideways scroll at 400 px: ' + who, w <= 400, w); }
  ok('no script errors in eleven browsers over two weeks', errors.length === 0, errors.slice(0, 6).join(' | '));

  // ---- write the diary
  const pass = results.filter(r => r[0] === 'PASS').length;
  const md = [`# Playtest: two weeks, eleven people, four cities`, ``, `Run ${new Date().toISOString().slice(0, 16)} UTC against the INSANE server (real email sign-in, real GPS per person, OpenStreetMap search and tiles). Simulated days start Monday ${new Date(T0).toISOString().slice(0, 10)}.`, ``, `**${pass}/${results.length} checks passed.**`, ``, `## Diary`, ``, ...diary.map(d => `- **${d.at} · ${d.who}.** ${d.what}`), ``, `## Timings`, ``, `| Person | Sign-in (email to signed in) | Onboarding (name to first screen) | Taps |`, `|---|---|---|---|`, ...Object.values(PEOPLE).filter(p => p.signin).map(p => `| ${p.name} | ${(p.signin / 1000).toFixed(1)} s | ${(p.onboard / 1000).toFixed(1)} s | ${p.onboardTaps} |`), ``, `Scripted taps are faster than a person's; read these as relative, not absolute.`, ``, `## Checks`, ``, ...results.map(r => `- ${r[0] === 'PASS' ? '✅' : '❌'} ${r[1]}${r[2] ? ` (${r[2].replace(/\n/g, ' ')})` : ''}`)].join('\n');
  fs.writeFileSync(path.join(OUT, 'PLAYTEST.md'), md);
  fs.writeFileSync(path.join(OUT, 'playtest.json'), JSON.stringify({ T0, results, diary, timings, people: Object.fromEntries(Object.entries(PEOPLE).map(([k, p]) => [k, { signin: p.signin, onboard: p.onboard, taps: p.onboardTaps }])) }, null, 1));
  console.log(results.map(r => r.join('  ')).join('\n'));
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close(); await server.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(async e => {
  console.error(e);
  if (process.env.DEBUG) for (const [k, P] of Object.entries(PEOPLE)) if (P.page) { try { const t = Date.now(); const st = await P.page.evaluate(() => { const b = document.querySelector('[data-act=sseg][data-v=map]'); const r = b && b.getBoundingClientRect(); const top = r && document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return JSON.stringify({ acts: window.__acts, sheet: S.ui.sheet, top: top && top.outerHTML.slice(0, 120), r }); }); console.log('DEBUG', k, Date.now() - t, 'ms', st); } catch (x) { console.log('DEBUG', k, x.message.slice(0, 200)); } }
  for (const [k, P] of Object.entries(PEOPLE)) if (P.page) { try { console.log('---', k, (await P.page.locator('#app').innerText()).slice(0, 500).replace(/\s+/g, ' ')); await P.page.screenshot({ path: path.join(OUT, 'crash-' + k + '.png') }); } catch (x) { } }
  console.log('ERRORS', errors.join(' | ')); if (server) await server.close(); process.exit(2);
});
