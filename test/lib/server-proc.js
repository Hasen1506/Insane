// Server tests (WS-I): start server/server.js on a free port with its own temp DB (or a given DB_FILE),
// talk to it as signed-in users, and stop it. Condition waits only (no sleeps).
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), net = require('net'), http = require('http'), { spawn } = require('child_process');
const { until } = require('./e2e');
const REPO = path.resolve(__dirname, '..', '..');

const freePort = () => new Promise((ok, bad) => { const s = net.createServer(); s.unref(); s.on('error', bad); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });
const tmpDir = tag => fs.mkdtempSync(path.join(os.tmpdir(), `insane-${tag}-`));

async function start({ env = {}, dir = tmpDir('srv'), db, nodeArgs = ['--no-warnings'] } = {}) {
  const port = await freePort(), file = db || path.join(dir, 'insane.db');
  let log = '';
  const proc = spawn(process.execPath, [...nodeArgs, path.join(REPO, 'server', 'server.js')], { env: { ...process.env, DEV: '1', SEED: 'test-seed', PORT: String(port), DB_FILE: file, OWNER_EMAIL: 'owner@example.com', BACKUP_DIR: path.join(dir, 'backups'), RATE_LIMITS: '', ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', d => { log += d; }); proc.stderr.on('data', d => { log += d; });
  const exited = new Promise(r => proc.once('exit', r));
  const url = `http://127.0.0.1:${port}`;
  await Promise.race([until(async () => (await fetch(url + '/api/health').catch(() => ({}))).ok, { timeout: 15000, what: 'server' }), exited.then(c => { throw new Error('server exited ' + c + '\n' + log); })]);
  const tokens = {};
  const S = {
    url, port, db: file, dir, proc, get log() { return log; },
    async signIn(email) {
      await S.post('auth/start', { email });
      const mail = (await (await fetch(`${url}/api/dev/outbox?email=${encodeURIComponent(email)}`)).json()).mail;
      const code = /code is (\d{6})/.exec(mail.text)[1];
      const r = await fetch(url + '/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) });
      tokens[email] = /insane_s=([^;]+)/.exec(r.headers.get('set-cookie'))[1];
      return (await r.json()).uid;
    },
    useToken(who, tok) { tokens[who] = tok; },
    async post(r, body, who, headers = {}) {
      const res = await fetch(`${url}/api/${r}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(who ? { cookie: 'insane_s=' + tokens[who] } : {}), ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body || {}) });
      let j = null; try { j = await res.json(); } catch (e) { }
      return { status: res.status, body: j, headers: res.headers };
    },
    async get(r, who) {
      const res = await fetch(`${url}/api/${r}`, { headers: who ? { cookie: 'insane_s=' + tokens[who] } : {} });
      let j = null; try { j = await res.json(); } catch (e) { }
      return { status: res.status, body: j, headers: res.headers };
    },
    async stop() { if (proc.exitCode === null) { proc.kill(); await exited; } },
  };
  return S;
}

// A tiny local HTTP server for fakes (Sentry, S3, Google tokeninfo). handler(req, body) → {status, body, headers}.
function fake(handler) {
  return new Promise(ok => {
    const reqs = [];
    const srv = http.createServer((req, res) => {
      const parts = []; req.on('data', c => parts.push(c)); req.on('end', async () => {
        const body = Buffer.concat(parts); reqs.push({ method: req.method, url: req.url, headers: req.headers, body });
        const r = (await handler(req, body)) || {}; res.writeHead(r.status || 200, r.headers || { 'content-type': 'application/json' }); res.end(r.body === undefined ? '{}' : r.body);
      });
    });
    srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}`, reqs, close: () => new Promise(r => srv.close(r)) }));
  });
}

// node server/backup.js … as a child process, with env.
function cli(args, env = {}) {
  return new Promise(ok => {
    const p = spawn(process.execPath, ['--no-warnings', path.join(REPO, 'server', 'backup.js'), ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = ''; p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
    p.on('exit', code => ok({ code, out, err }));
  });
}

module.exports = { start, fake, cli, freePort, tmpDir, REPO };
