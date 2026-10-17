// C96/C100 (WS-I): the deploy config. With docker on PATH the image is built and its health check run;
// without docker (CI sandboxes, this one) the Dockerfile, entrypoint and render.yaml are linted instead,
// and the image's exact CMD and HEALTHCHECK are run against the real server on this machine.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync, spawnSync } = require('child_process');
const { start } = require('../lib/server-proc');
const ROOT = path.resolve(__dirname, '..', '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const hasDocker = (() => { try { return spawnSync('docker', ['version', '--format', '{{.Server.Version}}'], { stdio: 'pipe', timeout: 5000 }).status === 0; } catch (e) { return false; } })();

module.exports = async function (t) {
  const df = read('Dockerfile'), lines = df.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const joined = df.replace(/\\\n\s*/g, ' ').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const instr = k => joined.filter(l => l.toUpperCase().startsWith(k + ' '));
  const nvm = read('.nvmrc').trim(), pkg = JSON.parse(read('package.json'));
  const from = (instr('FROM')[0] || '').split(/\s+/)[1] || '';
  t.ok('Dockerfile FROM is node:<.nvmrc>-slim, pinned (no latest, no floating major)', from === `node:${nvm}-slim`, from + ' vs ' + nvm);
  t.ok('.nvmrc satisfies engines.node (>=22.5) and is the version tests run on', /^22\.(\d+)\.\d+$/.test(nvm) && +nvm.split('.')[1] >= 5 && pkg.engines.node === '>=22.5' && process.version === 'v' + nvm, process.version);
  t.ok('package.json has no runtime dependencies (C96)', !pkg.dependencies || Object.keys(pkg.dependencies).length === 0);
  t.ok('the image runs no npm install (there is nothing to install)', !lines.some(l => /npm (ci|install)/.test(l)));
  const copies = instr('COPY').flatMap(l => l.split(/\s+/).slice(1, -1));
  t.ok('every COPY source exists', copies.length >= 4 && copies.every(c => fs.existsSync(path.join(ROOT, c))), copies.join(' '));
  const ign = read('.dockerignore').split('\n').map(s => s.trim()).filter(Boolean);
  t.ok('.dockerignore keeps app/, server/ and the tools the image copies', !ign.some(i => /^(app|server|tools|server\/rules|package\.json)\/?$/.test(i)) && ign.includes('test') && ign.includes('.git'));
  const cmd = JSON.parse((instr('CMD')[0] || 'CMD []').slice(4)), ep = JSON.parse((instr('ENTRYPOINT')[0] || 'ENTRYPOINT []').slice(11));
  t.ok('CMD is exec-form node with the ExperimentalWarning suppressed (C100)', cmd[0] === 'node' && cmd.includes('--disable-warning=ExperimentalWarning') && cmd.at(-1) === 'server/server.js', JSON.stringify(cmd));
  const epFile = path.join(ROOT, ep[0].replace(/^\/app\//, ''));
  t.ok('the entrypoint exists, is executable, drops root with setpriv and never runs the server as root', fs.existsSync(epFile) && (fs.statSync(epFile).mode & 0o111) !== 0 && /setpriv --reuid=node/.test(fs.readFileSync(epFile, 'utf8')) && /exec "\$@"/.test(fs.readFileSync(epFile, 'utf8')));
  if (fs.existsSync(epFile)) t.ok('the entrypoint is valid sh', spawnSync('sh', ['-n', epFile]).status === 0);
  const hc = instr('HEALTHCHECK')[0] || '';
  t.ok('HEALTHCHECK probes /api/health', /\/api\/health/.test(hc));
  const env = Object.fromEntries((instr('ENV')[0] || '').slice(4).trim().split(/\s+/).map(x => x.split('=')));
  t.ok('ENV puts the DB and backups on /var/data and listens on the EXPOSEd port', env.DB_FILE === '/var/data/insane.db' && env.BACKUP_DIR === '/var/data/backups' && instr('EXPOSE')[0] === 'EXPOSE ' + env.PORT && env.TRUST_PROXY === '1', JSON.stringify(env));

  const ry = read('render.yaml');
  const mount = (/mountPath:\s*(\S+)/.exec(ry) || [])[1];
  t.ok('render.yaml: a docker web service with a persistent disk where DB_FILE lives', /runtime:\s*docker/.test(ry) && /type:\s*web/.test(ry) && mount === path.posix.dirname(env.DB_FILE) && /sizeGB:\s*\d+/.test(ry), mount);
  t.ok('render.yaml: health check at /api/health, deploys are deliberate (autoDeploy false)', /healthCheckPath:\s*\/api\/health/.test(ry) && /autoDeploy:\s*false/.test(ry));
  const keys = [...ry.matchAll(/- key:\s*([A-Z_]+)/g)].map(m => m[1]);
  const need = ['PUBLIC_URL', 'OWNER_EMAIL', 'RESEND_API_KEY', 'MAIL_FROM', 'TILE_URL', 'VAPID_SUBJECT', 'SENTRY_DSN', 'GOOGLE_CLIENT_ID', 'BACKUP_BUCKET', 'BACKUP_ENDPOINT', 'BACKUP_ACCESS_KEY_ID', 'BACKUP_SECRET_ACCESS_KEY', 'DEFAULT_TZ', 'TRUST_PROXY'];
  t.ok('render.yaml declares every env var the server reads for production', need.every(k => keys.includes(k)), need.filter(k => !keys.includes(k)).join(','));
  const secrets = ['RESEND_API_KEY', 'SENTRY_DSN', 'BACKUP_SECRET_ACCESS_KEY', 'BACKUP_ACCESS_KEY_ID'];
  t.ok('secrets are never given values in render.yaml (sync: false)', secrets.every(k => new RegExp(`- key:\\s*${k}[^\\n]*\\n\\s*sync:\\s*false`).test(ry)));
  const srv = read('server/server.js'), used = [...new Set([...srv.matchAll(/ENV\.([A-Z_]+)/g)].map(m => m[1]))];
  const devOnly = ['PORT', 'DEV', 'DB_FILE', 'BACKUP_DIR', 'CSP_EXTRA', 'GOOGLE_TOKENINFO_URL', 'MAX_BODY', 'BACKUP_EVERY_H', 'LISTEN', 'SEED'];
  t.ok('every env var server.js reads is in render.yaml or set by the Dockerfile (or is dev/test only)', used.every(k => keys.includes(k) || k in env || devOnly.includes(k)), used.filter(k => !keys.includes(k) && !(k in env) && !devOnly.includes(k)).join(','));

  if (hasDocker) {
    const tag = 'insane-test:' + process.pid;
    const b = spawnSync('docker', ['build', '-q', '-t', tag, ROOT], { stdio: 'pipe', timeout: 600000 });
    t.ok('docker build succeeds', b.status === 0, String(b.stderr).slice(-400));
    if (b.status === 0) {
      const run = spawnSync('docker', ['run', '--rm', '-e', 'DEV=0', tag, 'node', '-e', "require('node:sqlite');console.log(new Intl.DateTimeFormat('en',{timeZone:'Asia/Kolkata'}).resolvedOptions().timeZone)"], { stdio: 'pipe', timeout: 60000 });
      t.ok('the image has node:sqlite and full ICU time zones', run.status === 0 && /Asia\/Kolkata/.test(run.stdout), String(run.stderr).slice(-300));
      try { execFileSync('docker', ['rmi', '-f', tag], { stdio: 'ignore' }); } catch (e) { }
    }
  } else t.ok('docker is not on PATH: Dockerfile linted instead of built (set up docker to also build it)', true);

  // The image's own CMD flags and HEALTHCHECK command, run here against the real server.
  const S = await start({ env: { DEV: '' }, nodeArgs: cmd.slice(1, -1) });
  try {
    const probe = JSON.parse(hc.replace(/^HEALTHCHECK.*?CMD\s+/, ''));
    const r = spawnSync(probe[0] === 'node' ? process.execPath : probe[0], probe.slice(1), { env: { ...process.env, PORT: String(S.port) }, stdio: 'pipe', timeout: 10000 });
    t.ok('the HEALTHCHECK command exits 0 against a running production-mode server', r.status === 0, String(r.stderr));
    const h = (await S.get('health')).body;
    t.ok('/api/health reports ok, build, schema and store version', h.ok === true && typeof h.build === 'string' && h.schema >= 2 && h.store === 9, JSON.stringify(h));
    t.ok('production mode has no dev routes', (await S.post('dev/tick', {})).status !== 200 && (await S.get('dev/outbox?email=a@b.c')).status !== 200);
    t.ok('the server prints no ExperimentalWarning with the image’s flags (log)', !/ExperimentalWarning/.test(S.log), S.log.slice(0, 200));
  } finally { await S.stop(); }
};
