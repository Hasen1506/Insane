// Deterministic e2e helpers. Rule: wait on a condition, never on the wall clock.
// Nothing in here sleeps for a fixed time; every wait polls a predicate and fails loudly on timeout.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const APP = () => path.resolve(process.env.APP || path.join(REPO, 'app', 'index.html')); // the built single file
const APP_DIR = () => path.resolve(process.env.APP_DIR || path.join(REPO, 'app'));          // data/ lives here

/* ---------- waiting ---------- */
const tick = () => new Promise(r => setImmediate(r));
// p, or give up waiting after ms (a timeout: resolves as soon as p does). Resolves undefined on timeout.
function within(p, ms) { let t; return Promise.race([p, new Promise(done => { t = setTimeout(done, ms); })]).finally(() => clearTimeout(t)); }
// Poll fn() until it returns truthy. Returns the value; throws with `what` on timeout.
async function until(fn, { timeout = 10000, every = 25, what = 'condition' } = {}) {
  const end = Date.now() + timeout; let last;
  for (; ;) {
    try { const v = await fn(); if (v) return v; } catch (e) { last = e; }
    if (Date.now() > end) throw new Error(`timed out after ${timeout} ms waiting for ${what}` + (last ? ': ' + last.message : ''));
    await new Promise(r => setTimeout(r, every)); // a poll interval, not a sleep: we exit as soon as fn is true
  }
}
// The page has painted what the last state change asked for: two animation frames and no pending render.
const settled = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
// The #app text stops changing between two frames (renders are rAF-batched in INSANE).
async function stable(page, sel = '#app', opt = {}) {
  let prev = null;
  return until(async () => { await settled(page); const t = await page.locator(sel).innerText().catch(() => null); const same = t !== null && t === prev; prev = t; return same; }, { what: `${sel} to stop changing`, ...opt });
}
// The app is idle: every act() started by a tap or form has finished, and the screen has been drawn.
// Needs actProbe on the context/page (an init script that counts act() calls in flight; no app change:
// act is a top-level function, so window.act can be wrapped after the app's script has run).
const actProbe = ctxOrPage => ctxOrPage.addInitScript(() => {
  window.__acts = 0; window.__actN = 0; window.__mut = 0;
  addEventListener('DOMContentLoaded', () => {
    new MutationObserver(m => { window.__mut += m.length; }).observe(document.body, { childList: true, subtree: true });
    const orig = window.act; if (typeof orig !== 'function' || orig.__probed) return;
    const wrapped = function (...a) { window.__acts++; window.__actN++; let r; try { r = orig.apply(this, a); } catch (e) { window.__acts--; throw e; } Promise.resolve(r).finally(() => { window.__acts--; }); return r; };
    wrapped.__probed = true; window.act = wrapped;
  });
});
async function idle(page, { timeout = 8000 } = {}) {
  try { await page.waitForFunction(() => !window.__acts, null, { timeout, polling: 'raf' }); } catch (e) { if (!/Timeout/.test(e.message)) throw e; } // a never-ending act (e.g. waiting on GPS) shouldn't wedge a run
  await within(settled(page).catch(() => { }), 2000); // a bound, not a sleep: ends at the next two frames; rAF can stall in a hidden tab
}
// A tap that can't double-fire. Playwright's normal click waits for the target to be stable; on a slow
// machine that can time out even though the click went through. Fall back to a forced click only if
// no act() ran (needs actProbe), so a toggle like "Paste a maps link" is never flipped twice.
async function tapOnce(page, sel, { timeout = 4000, forceTimeout } = {}) {
  const l = page.locator(sel).first();
  const n0 = await page.evaluate(() => window.__actN || 0).catch(() => 0);
  try { await l.click({ timeout }); return 'click'; } catch (e) {
    const n1 = await page.evaluate(() => window.__actN || 0).catch(() => 0);
    if (n1 > n0) return 'clicked-late';
    await l.click({ force: true, ...(forceTimeout ? { timeout: forceTimeout } : {}) }); return 'force';
  }
}
const textHas = (page, s, sel = '#app', opt = {}) => until(async () => (await page.locator(sel).innerText()).includes(s), { what: `"${s}" in ${sel}`, ...opt });
const gone = (page, sel, opt = {}) => until(async () => (await page.locator(sel).count()) === 0, { what: `${sel} to go`, ...opt });

/* ---------- clocks ---------- */
// Browser: Playwright's fake clock. Install before the first goto; move with set/advance.
const clock = {
  install: (page, t) => page.clock.install({ time: t }),
  set: (page, t) => page.clock.setSystemTime(t),
  advance: (page, ms) => page.clock.runFor(ms),
  // Server (DEV only): /api/dev/clock moves the server's now() by an offset.
  server: async (base, t) => { const r = await fetch(base + '/api/dev/clock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ offset: t - Date.now() }) }); return (await r.json()).now; },
};

/* ---------- serving the app the way claude.ai / a static host would ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.tsv': 'text/tab-separated-values; charset=utf-8', '.svg': 'image/svg+xml' };
function serveStatic({ port = +process.env.APP_PORT || 0, file = APP(), dir = APP_DIR() } = {}) {
  const srv = http.createServer((q, r) => {
    const u = q.url.split('?')[0]; const f = u === '/' || u === '/index.html' ? file : path.join(dir, path.normalize(u).replace(/^(\.\.[/\\])+/, ''));
    fs.readFile(f, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(b); } });
  });
  return new Promise(res => srv.listen(port, '127.0.0.1', () => res({ srv, port: srv.address().port, url: `http://localhost:${srv.address().port}`, close: () => new Promise(r => srv.close(r)) })));
}

/* ---------- the INSANE server in DEV mode ---------- */
// Spawns server/server.js with a temp DB, or attaches to $SERVER_URL if one is already running
// (e.g. `DEV=1 OWNER_EMAIL=owner@x.com DB_FILE=/tmp/x.db PORT=8099 node server/server.js`).
async function startServer({ port = +process.env.SERVER_PORT || 8791, owner = 'owner@x.com', env = {} } = {}) {
  if (process.env.SERVER_URL) { const url = process.env.SERVER_URL.replace(/\/$/, ''); await until(async () => (await fetch(url + '/api/hello')).ok, { what: 'server at ' + url }); return { url, close: async () => { } }; }
  const db = path.join(os.tmpdir(), `insane-test-${process.pid}-${port}.db`);
  for (const s of ['', '-wal', '-shm']) fs.rmSync(db + s, { force: true });
  const proc = spawn(process.execPath, [path.join(REPO, 'server', 'server.js')], { env: { ...process.env, DEV: '1', PORT: String(port), DB_FILE: db, OWNER_EMAIL: owner, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stderr.on('data', d => { if (!/ExperimentalWarning|trace-warnings/.test(d)) process.stderr.write('[server] ' + d); });
  const url = `http://localhost:${port}`;
  await until(async () => (await fetch(url + '/api/hello')).ok, { timeout: 15000, what: 'server to answer /api/hello' });
  return { url, proc, db, close: async () => { proc.kill(); await new Promise(r => proc.once('exit', r)); for (const s of ['', '-wal', '-shm']) fs.rmSync(db + s, { force: true }); } };
}
// The sign-in code from the DEV outbox, read the way a person reads their inbox.
async function outboxCode(base, email) {
  return until(async () => { const j = await (await fetch(`${base}/api/dev/outbox?email=${encodeURIComponent(email)}`)).json(); const m = j.mail && /code is (\d{6})/.exec(j.mail.text); return m && m[1]; }, { what: 'a code in the outbox for ' + email });
}

/* ---------- results ---------- */
function results(prefix = '') {
  const list = [];
  const ok = (name, cond, extra = '') => { list.push([cond ? 'PASS' : 'FAIL', prefix + name, String(extra).slice(0, 300)]); if (!cond) console.log('FAIL', prefix + name, String(extra).slice(0, 300)); return !!cond; };
  return { list, ok, passed: () => list.filter(r => r[0] === 'PASS').length };
}

module.exports = { REPO, APP, APP_DIR, tick, within, until, settled, stable, actProbe, idle, tapOnce, textHas, gone, clock, serveStatic, startServer, outboxCode, results };
