// C83/C99/C36 (WS-I): the v0.8 fixture DB (made by the real v0.8 server, test/fixtures/v08/make.js) boots on
// v0.9, is snapshotted first, migrates per PLAN §8, loses nothing, migrates once only (idempotent), and still
// serves a v0.8-shaped client (an existing session, v0.8 writes) — the N-1 client against the N server.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { start, tmpDir } = require('../lib/server-proc');
const FIX = path.join(__dirname, '..', 'fixtures', 'v08');
const man = JSON.parse(fs.readFileSync(path.join(FIX, 'manifest.json'), 'utf8'));

const dump = file => { const d = new DatabaseSync(file, { readOnly: true }); try { return Object.fromEntries(d.prepare('SELECT path,data FROM docs ORDER BY path').all().map(r => [r.path, JSON.parse(r.data)])); } finally { d.close(); } };
const sha = s => crypto.createHash('sha256').update(s).digest('hex');

module.exports = async function (t) {
  const dir = tmpDir('mig'), db = path.join(dir, 'insane.db');
  fs.copyFileSync(path.join(FIX, 'insane-v08.db'), db);
  const before = dump(db);
  t.ok(`the v0.8 fixture has ${man.total} docs`, Object.keys(before).length === man.total, Object.keys(before).length);
  // An existing v0.8 session (the cookie a phone already holds) for Kavya, valid for a day.
  const tok = 'v08session_' + crypto.randomBytes(12).toString('hex');
  { const d = new DatabaseSync(db); d.prepare('INSERT INTO sessions(hash,uid,exp) VALUES(?,?,?)').run(sha(tok), man.uids.kavya, Date.now() + 864e5); d.close(); }

  let S = await start({ dir, db, env: { DEFAULT_TZ: 'Asia/Kolkata' } });
  try {
    const h = (await S.get('health')).body;
    t.ok('boots on the v0.8 file and reports schema 2, store v9', h && h.ok && h.schema === 2 && h.store === 9, JSON.stringify(h));
    const snap = path.join(dir, 'backups', 'backup-pre-v9.db');
    t.ok('snapshot backup-pre-v9.db written before migrating', fs.existsSync(snap));
    t.ok('the snapshot is the untouched v0.8 data', fs.existsSync(snap) && JSON.stringify(dump(snap)) === JSON.stringify(before));
    // N-1 client: the old session still works, and v0.8-shaped reads and writes behave.
    S.useToken('kavya', tok);
    const hello = (await S.get('hello', 'kavya')).body;
    t.ok('a v0.8 session cookie is still signed in after the migration', hello.signedIn && hello.uid === man.uids.kavya);
    const me = (await S.post('get', { path: 'people/' + man.uids.kavya }, 'kavya')).body.doc;
    t.ok('a v0.8 client still reads people.circle (kept as primary)', me && me.circle === man.circles.arjun, JSON.stringify(me));
    const mn = (await S.post('query', { col: `circles/${man.circles.arjun}/midnight` }, 'kavya')).body.docs;
    t.ok('pending Midnight text stays hidden after the migration', mn.length === 1 && mn[0].data.text === null);
    const w = await S.post('update', { path: 'people/' + man.uids.kavya, data: { seen: Date.now() } }, 'kavya');
    t.ok('a v0.8 write (people.seen) is accepted', w.status === 200, JSON.stringify(w.body));
    t.ok('the client cannot write meta/schema', (await S.post('set', { path: 'meta/schema', data: { version: 1 } }, 'kavya')).status === 403);
    const meera = await S.signIn('meera@example.in');
    t.ok('email sign-in maps to the same v0.8 uid', meera === man.uids.meera);
  } finally { await S.stop(); }

  const after = dump(db);
  const lost = Object.keys(before).filter(p => !(p in after));
  t.ok('no v0.8 doc is lost', lost.length === 0, lost.join(','));
  const changedFields = Object.keys(before).filter(p => Object.entries(before[p]).some(([k, v]) => k !== 'seen' && JSON.stringify(after[p][k]) !== JSON.stringify(v)));
  t.ok('no v0.8 field is changed (only added)', changedFields.length === 0, changedFields.join(','));
  const ppl = Object.entries(after).filter(([p]) => /^people\/[^/]+$/.test(p));
  t.ok('step 1: every person has circles: [cid] matching circle', ppl.every(([, d]) => Array.isArray(d.circles) && JSON.stringify(d.circles) === JSON.stringify(d.circle ? [d.circle] : [])), JSON.stringify(ppl.map(([, d]) => [d.circle, d.circles])));
  const c1 = after['circles/' + man.circles.arjun], c2 = after['circles/' + man.circles.ravi];
  t.ok('step 2: the creator is admin of each circle', c1.roles[man.uids.arjun] === 'admin' && c2.roles[man.uids.ravi] === 'admin', JSON.stringify([c1.roles, c2.roles]));
  t.ok('step 4: consent {version: 0} backfilled for every user', Object.values(man.uids).every(u => after[`data/users/${u}/consent`] && after[`data/users/${u}/consent`].version === 0));
  t.ok('step 5: circle tz from the creator (Asia/Kolkata) or DEFAULT_TZ when the creator had none', c1.tz === 'Asia/Kolkata' && c1.tzFrom === 'creator' && c2.tz === 'Asia/Kolkata' && c2.tzFrom === 'default', JSON.stringify([c1.tz, c1.tzFrom, c2.tz, c2.tzFrom]));
  t.ok('step 6: drops keep the legacy draw (drawVersion 1)', Object.entries(after).filter(([p]) => /^drops\//.test(p)).every(([, d]) => d.drawVersion === 1));
  t.ok('meta/schema says version 9', after['meta/schema'] && after['meta/schema'].version === 9 && after['meta/schema'].from === 8);
  const added = Object.keys(after).filter(p => !(p in before)).sort();
  t.ok('added docs are exactly meta/schema + one consent per user', added.length === 1 + Object.keys(man.uids).length && added.every(p => p === 'meta/schema' || /\/consent$/.test(p)), added.join(','));

  // Idempotent: boot again, nothing changes and no second snapshot is taken.
  S = await start({ dir, db });
  try { t.ok('second boot is healthy', (await S.get('health')).body.store === 9); } finally { await S.stop(); }
  const again = dump(db);
  t.ok('a second boot changes no doc (idempotent)', JSON.stringify(again) === JSON.stringify(after));
  t.ok('a second boot takes no second snapshot', fs.readdirSync(path.join(dir, 'backups')).filter(f => f.startsWith('backup-pre-v9')).length === 1);
  fs.rmSync(dir, { recursive: true, force: true });
};
