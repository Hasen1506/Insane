// C97 restore drill (WS-I): back up a LIVE server's DB online, wipe it, restore with the CLI, and boot on the
// restored file with the data and the sign-in intact. Then the same through a (fake) S3-compatible bucket,
// whose requests must be SigV4-signed. Plus the SigV4 key derivation against AWS's published example.
'use strict';
const fs = require('fs'), path = require('path');
const { start, fake, cli, tmpDir } = require('../lib/server-proc');
const { signingKey, signS3, prune } = require('../../server/backup');

module.exports = async function (t) {
  // AWS's documented example (Signature Version 4 "deriving the signing key"): secret wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY, 20120215, us-east-1, iam
  t.ok('SigV4 signing key matches AWS’s published example', signingKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20120215', 'us-east-1', 'iam').toString('hex') === 'f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d');
  { const s = signS3({ endpoint: 'https://acct.r2.cloudflarestorage.com', bucket: 'b', region: 'auto', id: 'AKID', secret: 'S' }, 'PUT', 'insane/x.db', Buffer.from('hi'), {}, Date.UTC(2026, 9, 17, 10, 15)); t.ok('S3 requests are path-style, dated and signed', s.url === 'https://acct.r2.cloudflarestorage.com/b/insane/x.db' && s.headers['x-amz-date'] === '20261017T101500Z' && /^AWS4-HMAC-SHA256 Credential=AKID\/20261017\/auto\/s3\/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/.test(s.headers.authorization), JSON.stringify(s)); }
  { const d = tmpDir('prune'); for (let i = 0; i < 5; i++) fs.writeFileSync(path.join(d, `insane-2026101${i}T000000Z.db`), ''); const gone = prune(d, 2); t.ok('retention keeps the newest BACKUP_KEEP snapshots', gone.length === 3 && fs.readdirSync(d).sort().join() === 'insane-20261013T000000Z.db,insane-20261014T000000Z.db'); fs.rmSync(d, { recursive: true, force: true }); }

  const store = new Map();
  const s3 = await fake((req, body) => {
    if (!/^AWS4-HMAC-SHA256 Credential=AKIDTEST\//.test(req.headers.authorization || '') || !req.headers['x-amz-date'] || !req.headers['x-amz-content-sha256']) return { status: 403, body: '<Error>unsigned</Error>' };
    const u = new URL(req.url, 'http://x');
    if (req.method === 'PUT') { store.set(decodeURIComponent(u.pathname.replace(/^\/bk\//, '')), body); return { body: '' }; }
    if (req.method === 'GET' && u.pathname === '/bk' && u.searchParams.get('list-type') === '2') return { headers: { 'content-type': 'application/xml' }, body: `<ListBucketResult>${[...store.keys()].map(k => `<Contents><Key>${k}</Key></Contents>`).join('')}</ListBucketResult>` };
    if (req.method === 'GET') { const b = store.get(decodeURIComponent(u.pathname.replace(/^\/bk\//, ''))); return b ? { headers: { 'content-type': 'application/octet-stream' }, body: b } : { status: 404, body: '' }; }
    return { status: 400, body: '' };
  });
  const dir = tmpDir('bk'), db = path.join(dir, 'insane.db');
  const BENV = { DB_FILE: db, BACKUP_DIR: path.join(dir, 'backups'), BACKUP_BUCKET: 'bk', BACKUP_ENDPOINT: s3.url, BACKUP_REGION: 'auto', BACKUP_PREFIX: 'insane/', BACKUP_ACCESS_KEY_ID: 'AKIDTEST', BACKUP_SECRET_ACCESS_KEY: 'secret' };
  let S = await start({ dir, db });
  let uid;
  try {
    uid = await S.signIn('meera@example.in');
    for (let i = 0; i < 20; i++) await S.post('set', { path: `posts/b${i}`, data: { by: uid, text: 'note ' + i } }, 'meera@example.in').catch(() => { });
    await S.post('set', { path: 'people/' + uid, data: { name: 'Meera', circle: null, adult: true, consent: { v: '2026-10-draft' } } }, 'meera@example.in');
    // online backup while the server is running and holding the WAL
    const b = await cli(['backup'], BENV);
    const out = b.code === 0 && JSON.parse(b.out);
    t.ok('`node server/backup.js backup` snapshots the live DB and uploads it', b.code === 0 && fs.existsSync(out.file) && out.docs >= 5 && /^insane\/insane-\d{8}T\d{6}Z\.db$/.test(out.key) && store.has(out.key), b.out + b.err);
    // a write after the backup: the restore must not have it
    await S.post('set', { path: 'posts/after', data: { by: uid, text: 'after' } }, 'meera@example.in');
  } finally { await S.stop(); }

  // disaster: the disk is wiped
  for (const s of ['', '-wal', '-shm']) fs.rmSync(db + s, { force: true });
  fs.rmSync(path.join(dir, 'backups'), { recursive: true, force: true });
  const r = await cli(['restore', 'latest'], BENV);
  t.ok('`restore latest` pulls the newest snapshot from the bucket and checks it', r.code === 0 && fs.existsSync(db) && JSON.parse(r.out).docs >= 5, r.out + r.err);
  S = await start({ dir, db });
  try {
    S.useToken('meera', null);
    const again = await S.signIn('meera@example.in');
    t.ok('after the restore the same person signs in to the same account', again === uid);
    const me = (await S.post('get', { path: 'people/' + uid }, 'meera@example.in')).body.doc;
    const posts = (await S.post('query', { col: 'posts' }, 'meera@example.in')).body.docs;
    t.ok('restored data is all there, up to the backup', me && me.name === 'Meera' && posts.filter(p => /^b\d+$/.test(p.id)).length >= 10, JSON.stringify({ me, n: posts.length }));
    t.ok('writes after the backup are not (point-in-time = the snapshot)', !posts.some(p => p.id === 'after'));
    t.ok('the restored server is healthy and still at store v9', (await S.get('health')).body.store === 9);
  } finally { await S.stop(); }

  // a corrupt file is refused and the live DB is left alone
  const bad = path.join(dir, 'bad.db'); fs.writeFileSync(bad, 'not a database at all '.repeat(100));
  const before = fs.readFileSync(db);
  const rb = await cli(['restore', bad], { ...BENV, BACKUP_BUCKET: '' });
  t.ok('restoring a corrupt file fails and leaves the DB untouched', rb.code !== 0 && Buffer.compare(before, fs.readFileSync(db)) === 0, rb.err.slice(0, 200));
  // local-only (no bucket): backup then restore by path
  const lb = await cli(['backup'], { ...BENV, BACKUP_BUCKET: '' }), lf = lb.code === 0 && JSON.parse(lb.out).file;
  const lr = lf && await cli(['restore', lf], { ...BENV, BACKUP_BUCKET: '' });
  t.ok('without a bucket, backups stay on disk and restore by path', lb.code === 0 && !JSON.parse(lb.out).key && lr && lr.code === 0, lb.out + lb.err);
  await s3.close();
  fs.rmSync(dir, { recursive: true, force: true });
};
