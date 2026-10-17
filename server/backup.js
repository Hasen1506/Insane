// SQLite backups (C97), no dependencies.
//  - Online snapshot of the live DB with node:sqlite's backup() (page-by-page, never blocks writers for
//    long), or `VACUUM INTO` where backup() is missing. The file is checked with integrity_check.
//  - Kept in BACKUP_DIR (default: <db dir>/backups), newest BACKUP_KEEP (default 14) kept.
//  - Uploaded to any S3-compatible bucket (Cloudflare R2, AWS S3, Backblaze B2, MinIO) when BACKUP_BUCKET
//    is set, signed with AWS SigV4 by hand.
//  - Restore from a local file or a bucket key, checked before it replaces the DB.
// CLI (tools/backup.sh wraps it):
//   node server/backup.js backup            snapshot DB_FILE now (+ upload if BACKUP_BUCKET)
//   node server/backup.js list              local snapshots, and bucket keys if BACKUP_BUCKET
//   node server/backup.js restore <file|s3:key|latest>   replace DB_FILE (the server must be stopped)
// Env: DB_FILE, BACKUP_DIR, BACKUP_KEEP, BACKUP_BUCKET, BACKUP_ENDPOINT (e.g. https://<acct>.r2.cloudflarestorage.com),
//      BACKUP_REGION (auto for R2, else the AWS region), BACKUP_PREFIX (default insane/), BACKUP_ACCESS_KEY_ID,
//      BACKUP_SECRET_ACCESS_KEY.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sqlite = require('node:sqlite');

const stamp = (t = Date.now()) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'); // 20261017T101500Z
const dirFor = (dbFile, env = process.env) => env.BACKUP_DIR || path.join(path.dirname(path.resolve(dbFile)), 'backups');

function check(file) {
  const d = new sqlite.DatabaseSync(file, { readOnly: true });
  try {
    const r = d.prepare('PRAGMA integrity_check').get();
    const ok = r && Object.values(r)[0] === 'ok';
    const docs = d.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='docs'").get().n ? d.prepare('SELECT COUNT(*) n FROM docs').get().n : -1;
    return { ok: ok && docs >= 0, docs, detail: ok ? '' : JSON.stringify(r) };
  } finally { d.close(); }
}

// Snapshot `db` (an open DatabaseSync) to dest. Atomic: written to .part, checked, then renamed.
async function snapshot(db, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const part = dest + '.part'; fs.rmSync(part, { force: true });
  if (typeof sqlite.backup === 'function') await sqlite.backup(db, part);
  else db.exec(`VACUUM INTO '${part.replace(/'/g, "''")}'`);
  const c = check(part); if (!c.ok) { fs.rmSync(part, { force: true }); throw new Error('backup failed integrity_check ' + c.detail); }
  fs.renameSync(part, dest);
  return { file: dest, bytes: fs.statSync(dest).size, docs: c.docs };
}

function prune(dir, keep) {
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^insane-\d{8}T\d{6}Z\.db$/.test(f)).sort() : [];
  const gone = files.slice(0, Math.max(0, files.length - keep));
  for (const f of gone) fs.rmSync(path.join(dir, f), { force: true });
  return gone;
}

/* ---------- S3-compatible upload/download with SigV4 ---------- */
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
const hex = b => crypto.createHash('sha256').update(b).digest('hex');
function signingKey(secret, date, region, service) { return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), service), 'aws4_request'); }
const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function bucketCfg(env = process.env) {
  if (!env.BACKUP_BUCKET) return null;
  const endpoint = (env.BACKUP_ENDPOINT || `https://s3.${env.BACKUP_REGION || 'us-east-1'}.amazonaws.com`).replace(/\/$/, '');
  return { endpoint, bucket: env.BACKUP_BUCKET, region: env.BACKUP_REGION || 'auto', prefix: env.BACKUP_PREFIX ?? 'insane/', id: env.BACKUP_ACCESS_KEY_ID || '', secret: env.BACKUP_SECRET_ACCESS_KEY || '' };
}
// Path-style URL (works on R2, MinIO and AWS). Returns {url, headers} for fetch.
function signS3(cfg, method, key, body = Buffer.alloc(0), query = {}, t = Date.now()) {
  const u = new URL(`${cfg.endpoint}/${cfg.bucket}${key ? '/' + key.split('/').map(enc).join('/') : ''}`);
  const amz = new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), date = amz.slice(0, 8);
  const qs = Object.keys(query).sort().map(k => `${enc(k)}=${enc(query[k])}`).join('&');
  const payload = hex(body);
  const headers = { host: u.host, 'x-amz-content-sha256': payload, 'x-amz-date': amz };
  const names = Object.keys(headers).sort();
  const creq = [method, u.pathname, qs, names.map(n => `${n}:${headers[n]}`).join('\n') + '\n', names.join(';'), payload].join('\n');
  const scope = `${date}/${cfg.region}/s3/aws4_request`;
  const sts = ['AWS4-HMAC-SHA256', amz, scope, hex(creq)].join('\n');
  const sig = crypto.createHmac('sha256', signingKey(cfg.secret, date, cfg.region, 's3')).update(sts).digest('hex');
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${cfg.id}/${scope}, SignedHeaders=${names.join(';')}, Signature=${sig}`;
  delete headers.host;
  return { url: u.toString() + (qs ? '?' + qs : ''), headers };
}
async function upload(cfg, file, key) {
  const body = fs.readFileSync(file), { url, headers } = signS3(cfg, 'PUT', key, body);
  const r = await fetch(url, { method: 'PUT', headers: { ...headers, 'content-type': 'application/vnd.sqlite3' }, body });
  if (!r.ok) throw new Error(`upload ${key}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  return key;
}
async function download(cfg, key, dest) {
  const { url, headers } = signS3(cfg, 'GET', key);
  const r = await fetch(url, { headers }); if (!r.ok) throw new Error(`download ${key}: ${r.status}`);
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer())); return dest;
}
async function listKeys(cfg) {
  const { url, headers } = signS3(cfg, 'GET', '', undefined, { 'list-type': '2', prefix: cfg.prefix });
  const r = await fetch(url, { headers }); if (!r.ok) throw new Error(`list: ${r.status}`);
  return [...(await r.text()).matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1]).sort();
}

// One backup run: snapshot, prune, upload. Used by the server's timer and the CLI.
async function backupNow(db, dbFile, env = process.env, t = Date.now()) {
  const dir = dirFor(dbFile, env), dest = path.join(dir, `insane-${stamp(t)}.db`);
  const out = await snapshot(db, dest);
  out.pruned = prune(dir, +env.BACKUP_KEEP || 14);
  const cfg = bucketCfg(env);
  if (cfg) out.key = await upload(cfg, dest, cfg.prefix + path.basename(dest));
  return out;
}

// Replace dbFile with a checked copy of src. The server must not be running on dbFile.
function restoreFile(src, dbFile) {
  const c = check(src); if (!c.ok) throw new Error(`${src} failed integrity_check: ${c.detail}`);
  const tmp = dbFile + '.restore'; fs.copyFileSync(src, tmp);
  if (fs.existsSync(dbFile)) fs.copyFileSync(dbFile, dbFile + '.before-restore');
  for (const s of ['-wal', '-shm']) fs.rmSync(dbFile + s, { force: true });
  fs.renameSync(tmp, dbFile);
  return { file: dbFile, docs: c.docs, from: src };
}

module.exports = { snapshot, backupNow, restoreFile, prune, check, signS3, signingKey, bucketCfg, upload, download, listKeys, dirFor, stamp };

if (require.main === module) (async () => {
  const env = process.env, [cmd, arg] = process.argv.slice(2);
  const dbFile = path.resolve(env.DB_FILE || path.join(__dirname, 'insane.db')), cfg = bucketCfg(env), dir = dirFor(dbFile, env);
  if (cmd === 'backup') {
    const db = new sqlite.DatabaseSync(dbFile);
    try { console.log(JSON.stringify(await backupNow(db, dbFile, env))); } finally { db.close(); }
  } else if (cmd === 'list') {
    for (const f of fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []) console.log(path.join(dir, f));
    if (cfg) for (const k of await listKeys(cfg)) console.log('s3:' + k);
  } else if (cmd === 'restore' && arg) {
    let src = arg;
    if (arg === 'latest') {
      if (cfg) { const k = (await listKeys(cfg)).filter(k => k.endsWith('.db')).pop(); if (!k) throw new Error('no backups in the bucket'); src = 's3:' + k; }
      else { const f = (fs.existsSync(dir) ? fs.readdirSync(dir) : []).filter(f => /^insane-.*\.db$/.test(f)).sort().pop(); if (!f) throw new Error('no backups in ' + dir); src = path.join(dir, f); }
    }
    let tmp = null;
    if (src.startsWith('s3:')) { if (!cfg) throw new Error('BACKUP_BUCKET is not set'); tmp = src = await download(cfg, src.slice(3), dbFile + '.download'); }
    try { console.log(JSON.stringify(restoreFile(src, dbFile))); } finally { if (tmp) fs.rmSync(tmp, { force: true }); }
  } else { console.error('usage: node server/backup.js backup | list | restore <file|s3:key|latest>'); process.exit(2); }
})().catch(e => { console.error(e.message); process.exit(1); });
