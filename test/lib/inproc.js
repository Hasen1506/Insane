// The real server's rules, in this process: server/server.js required (it doesn't listen when required)
// on a temp DB. Writes go through the same doWrite() as POST /api/set|update|delete, minus the rate limit,
// so property tests can run thousands of cases in seconds. One server per process, shared by every suite file.
'use strict';
const path = require('path'), os = require('os'), fs = require('fs');
if (!process.env.INSANE_INPROC_DB) {
  process.env.INSANE_INPROC_DB = path.join(os.tmpdir(), `insane-inproc-${process.pid}.db`);
  for (const s of ['', '-wal', '-shm']) fs.rmSync(process.env.INSANE_INPROC_DB + s, { force: true });
  process.on('exit', () => { for (const s of ['', '-wal', '-shm']) try { fs.rmSync(process.env.INSANE_INPROC_DB + s, { force: true }); } catch (e) { } });
}
const OWNER = 'owner@insane.test';
const saved = { DB_FILE: process.env.DB_FILE, OWNER_EMAIL: process.env.OWNER_EMAIL, DEV: process.env.DEV };
process.env.DB_FILE = process.env.INSANE_INPROC_DB; process.env.OWNER_EMAIL = OWNER; process.env.DEV = '1';
const origLog = console.log; console.log = (...a) => { if (!/^\[mail\]/.test(String(a[0]))) origLog(...a); }; // DEV mail goes to stdout
const S = require('../../server/server.js');
for (const k in saved) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];

const CONSENT = S.SAFE.CONSENT_VERSION;
let n = 0;
function reset() {
  S.db.exec("DELETE FROM docs; DELETE FROM users; DELETE FROM sessions; DELETE FROM otps; DELETE FROM push; DELETE FROM reports; DELETE FROM audit; DELETE FROM kv WHERE k<>'vapid';");
}
function user(email) {
  const uid = 'u_' + (++n).toString(36).padStart(4, '0') + Math.random().toString(36).slice(2, 12);
  email = email || uid + '@t.test';
  S.db.prepare('INSERT INTO users(uid,email,created) VALUES(?,?,?)').run(uid, email, Date.now());
  const sess = S.ACC && require('crypto').createHash('sha256').update(uid + 'tok').digest('hex');
  S.db.prepare('INSERT INTO sessions(hash,uid,exp) VALUES(?,?,?)').run(sess, uid, Date.now() + 864e5);
  return { uid, email, sess };
}
const owner = () => { const r = S.db.prepare('SELECT uid,email FROM users WHERE email=?').get(OWNER); return r || user(OWNER); };
// {ok:true} or {code, message, reason}; never throws for a refusal.
function wr(op, p, data, u) { try { S.doWrite(op, { path: p, data }, u, false); return { ok: true }; } catch (e) { if (e instanceof S.Refuse) return { code: e.code, message: e.message, reason: e.reason }; throw e; } }
function get(p, u) { try { return { doc: S.readDoc(p, u) }; } catch (e) { if (e instanceof S.Refuse) return { code: e.code }; throw e; } }
function query(col, u, where) { try { return { docs: S.runQuery({ col, where: where || [] }, u) }; } catch (e) { if (e instanceof S.Refuse) return { code: e.code }; throw e; } }
async function route(r, b, u) {
  try {
    if (r.startsWith('account/')) { const o = await S.ACC.route(r, b || {}, u, { headers: {} }); return o ? { ok: true, ...o.body, headers: o.headers } : { code: 'not_found' }; }
    const o = S.SAFE.route(r, b || {}, u); return o ? { ok: true, ...o } : { code: 'not_found' };
  } catch (e) { if (e instanceof S.Refuse) return { code: e.code, message: e.message, reason: e.reason }; throw e; }
}
// A signed-up person (age + consent, as onboarding writes it), optionally in a circle.
function person(name, extra = {}, email) {
  const u = user(email);
  const r = wr('set', 'people/' + u.uid, { name, handle: extra.handle || null, circle: null, joined: Date.now(), city: 'chennai', cityName: 'Chennai', cell: { lat: 13.08, lon: 80.27, s: 1 }, adult: true, consent: { v: CONSENT }, ...extra, circle: null }, u);
  if (!r.ok) throw new Error('sign-up refused: ' + JSON.stringify(r));
  u.name = name; return u;
}
function circle(by, name = 'Third Floor') {
  const cid = 'c' + (++n).toString(36) + Math.random().toString(36).slice(2, 8), code = Math.random().toString(36).slice(2, 8).toUpperCase();
  let r = wr('set', 'circles/' + cid, { name, code, city: 'chennai', members: [by.uid], createdAt: Date.now(), by: by.uid }, by); if (!r.ok) throw new Error('circle: ' + JSON.stringify(r));
  wr('set', 'codes/' + code, { cid, at: Date.now() }, by);
  r = wr('set', `circles/${cid}/threads/general`, { kind: 'talk', title: 'General', by: by.uid, at: Date.now(), muted: true }, by); if (!r.ok) throw new Error('general: ' + JSON.stringify(r));
  r = wr('update', 'people/' + by.uid, { circle: cid }, by); if (!r.ok) throw new Error('join own: ' + JSON.stringify(r));
  return { cid, code };
}
function join(u, cid) {
  const r = wr('update', 'people/' + u.uid, { circle: cid }, u); if (!r.ok) return r;
  const c = S.getDoc('circles/' + cid); return wr('update', 'circles/' + cid, { members: [...new Set([...(c.members || []), u.uid])] }, u);
}
const allDocs = () => S.db.prepare('SELECT path,data FROM docs').all();
module.exports = { S, reset, user, owner, wr, get, query, route, person, circle, join, allDocs, CONSENT, OWNER };
