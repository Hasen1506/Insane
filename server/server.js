// INSANE server: email sign-in, a live document store with the same API as the artifact's db,
// storage rules, the checks a page can't be trusted with (door codes, Decode answers, meeting codes,
// Midnight release), web push and a place-search proxy. Node 22+, no dependencies.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { DatabaseSync } = require('node:sqlite');

const ENV = process.env;
const PORT = +ENV.PORT || 8080;
const ROOT = path.resolve(__dirname, '..', 'app');
const DEV = ENV.DEV === '1';
const OWNER = (ENV.OWNER_EMAIL || '').trim().toLowerCase();
const PUBLIC_URL = (ENV.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE = PUBLIC_URL.startsWith('https://');
const TILE_URL = ENV.TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = ENV.TILE_ATTR || '© OpenStreetMap contributors';

let clockOffset = 0; // only moved by the dev clock, for tests that run a fortnight in minutes
const now = () => Date.now() + clockOffset;
const MIN = 6e4, HOUR = 36e5, DAY = 864e5;

/* ---------- storage ---------- */
const db = new DatabaseSync(ENV.DB_FILE || path.join(__dirname, 'insane.db'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS docs(path TEXT PRIMARY KEY, parent TEXT NOT NULL, data TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS docs_parent ON docs(parent);
CREATE TABLE IF NOT EXISTS users(uid TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, uid TEXT NOT NULL, exp INTEGER);
CREATE TABLE IF NOT EXISTS otps(email TEXT PRIMARY KEY, hash TEXT, exp INTEGER, tries INTEGER, sent TEXT);
CREATE TABLE IF NOT EXISTS push(endpoint TEXT PRIMARY KEY, uid TEXT NOT NULL, sub TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);`);
const q = {
  get: db.prepare('SELECT data FROM docs WHERE path=?'),
  put: db.prepare('INSERT INTO docs(path,parent,data) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data'),
  del: db.prepare('DELETE FROM docs WHERE path=?'),
  kids: db.prepare('SELECT path,data FROM docs WHERE parent=?'),
  count: db.prepare('SELECT COUNT(*) n FROM docs'),
};
const parentOf = p => p.split('/').slice(0, -1).join('/');
const getDoc = p => { const r = q.get.get(p); return r ? JSON.parse(r.data) : null; };
const putDoc = (p, d) => q.put.run(p, parentOf(p), JSON.stringify(d));
const kv = {
  get: k => { const r = db.prepare('SELECT v FROM kv WHERE k=?').get(k); return r ? JSON.parse(r.v) : null; },
  set: (k, v) => db.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, JSON.stringify(v)),
};
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const rid = (n = 16) => crypto.randomBytes(n).toString('base64url').slice(0, n);

/* ---------- rules: the same ones the artifact enforces ---------- */
const isOwner = u => !!u && !!OWNER && u.email === OWNER;
function canRead(p, u) {
  if (!u) return false;
  const s = p.split('/');
  if (s[0] === 'data' && s[1] === 'users') return s[2] === u.uid;
  if (s[0] === 'ev') return s.length === 1 ? isOwner(u) : (s[1] === u.uid || isOwner(u));
  return true;
}
function canWrite(p, u) {
  if (!u) return false;
  const s = p.split('/');
  if (s[0] === 'data' && s[1] === 'users') return s[2] === u.uid;
  if (['people', 'pair', 'ev', 'live'].includes(s[0])) return s[1] === u.uid || (isOwner(u) && s[0] !== 'live');
  return true;
}
const merge = (a, b) => { for (const k in b) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], v); else a[k] = v; } return a; };
class Refuse extends Error { constructor(code, msg) { super(msg); this.code = code; } }

/* ---------- the checks a page can't be trusted with ---------- */
const ANS = ['WATERLOO', 'MARKET', 'CARD', 'MUSEUM', 'BRIDGE', 'STATION', 'GARDEN', 'TOWER'];
const weekIdx = wk => (+String(wk).split('W')[1]) % ANS.length;
function beforeWrite(op, p, data, u) {
  const s = p.split('/'), old = getDoc(p);
  if (s[0] === 'checkins' && s.length === 2) {
    if (!s[1].endsWith('_' + u.uid) && !isOwner(u)) throw new Refuse('permission_denied', 'You can only check yourself in.');
    if (op === 'delete') return data;
    if (op === 'update') { const keep = {}; if ('swapped' in data) keep.swapped = !!data.swapped; return keep; }
    const drop = getDoc('drops/' + data.drop);
    if (!drop) throw new Refuse('failed_precondition', 'That drop has gone.');
    const t = now();
    if (t < drop.start || t > drop.end) throw new Refuse('failed_precondition', 'This drop isn’t open right now.');
    if (String(data.code || '').toUpperCase() !== String(drop.code).toUpperCase()) throw new Refuse('failed_precondition', 'wrong_code');
    delete data.code; data.at = t; data.uid = u.uid; data.verified = 'server';
    return data;
  }
  if (s[0] === 'solves' && s.length === 2) {
    if (op === 'delete') throw new Refuse('permission_denied', 'Solves stay.');
    if (!s[1].endsWith('_' + u.uid) || old) throw new Refuse('permission_denied', 'One solve each.');
    const a = String(data.answer || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (a !== ANS[weekIdx(data.week)]) throw new Refuse('failed_precondition', 'wrong_answer');
    delete data.answer; data.at = now(); data.uid = u.uid;
    return data;
  }
  if (s[0] === 'met' && s.length === 2) {
    if (op !== 'set') throw new Refuse('permission_denied', 'Meetings are only made by code.');
    const ids = (data.ids || []).slice().sort();
    if (ids.length !== 2 || !ids.includes(u.uid) || s[1] !== ids.join('__')) throw new Refuse('permission_denied', 'Not your meeting.');
    const other = ids.find(x => x !== u.uid), pr = getDoc('pair/' + other);
    if (!pr || pr.exp < now() || String(pr.code) !== String(data.code)) throw new Refuse('failed_precondition', 'expired_code');
    delete data.code; data.at = now();
    return data;
  }
  if (s[0] === 'drops' && s.length === 2) {
    if (op === 'set' && (!old || old.host === u.uid)) { data.host = u.uid; return data; }
    if (op === 'delete') { if (old && old.host !== u.uid && !isOwner(u)) throw new Refuse('permission_denied', 'Only the host can cancel a drop.'); return data; }
    if (old && old.host !== u.uid) { const keep = {}; for (const k of ['item', 'swaps']) if (k in data) keep[k] = data[k]; return keep; }
    return data;
  }
  if (s[0] === 'posts' && s.length === 2 && old && old.by !== u.uid && !isOwner(u)) {
    if (op !== 'update') throw new Refuse('permission_denied', 'Not your post.');
    const keep = {};
    if ('flags' in data) keep.flags = [...new Set([...(old.flags || []), u.uid])];
    if (data.reacts && u.uid in data.reacts) { const r = data.reacts[u.uid]; keep.reacts = { [u.uid]: r && ['love', 'in', 'steal'].includes(r.r) ? { r: r.r, circle: String(r.circle || ''), cname: String(r.cname || '').slice(0, 28) } : null }; }
    return keep;
  }
  if (s[0] === 'circles' && s[2] === 'midnight' && s.length === 4) {
    if (op === 'set') return { text: String(data.text || '').slice(0, 400), releaseAt: Math.max(+data.releaseAt || 0, now() + MIN), flags: [] }; // no author, by construction
    if (op === 'update') {
      const keep = {};
      if ('flags' in data) keep.flags = [...new Set([...(old?.flags || []), u.uid])];
      if (data.reacts && u.uid in data.reacts) { const r = data.reacts[u.uid]; keep.reacts = { [u.uid]: ['same', 'brave', '❤'].includes(r) ? r : null }; }
      if (data.removed === true) keep.removed = true;
      return keep;
    }
  }
  // Threads: pledges and plan answers are your own; only the organiser confirms a payment landed.
  if (s[0] === 'circles' && s[2] === 'threads' && s.length === 4 && op === 'update' && old) {
    data = { ...data };
    if (data.pledges) data.pledges = u.uid in data.pledges ? { [u.uid]: !!data.pledges[u.uid] } : {};
    if (data.going) data.going = u.uid in data.going ? { [u.uid]: !!data.going[u.uid] } : {};
    if (data.paid) { const pd = {}; for (const [k, v] of Object.entries(data.paid)) { if (v === 'wait' && k === u.uid) pd[k] = 'wait'; else if (v === true && old.by === u.uid) pd[k] = true; } data.paid = pd; }
    if (data.via) data.via = { [u.uid]: String(data.via[u.uid] || '').slice(0, 20) };
    if ('closed' in data && old.by !== u.uid) delete data.closed;
    return data;
  }
  // Favors: you ask for yourself, you say you'll help as yourself, and only the person helped logs the hours.
  if (s[0] === 'circles' && s[2] === 'favors' && s.length === 4) {
    if (op === 'delete') { if (old && old.asker !== u.uid && !isOwner(u)) throw new Refuse('permission_denied', 'Only the asker can take it down.'); if (old && old.status === 'logged') throw new Refuse('permission_denied', 'Logged favors stay.'); return data; }
    const h = [0.25, 0.5, 1, 2, 4].includes(+data.h) ? +data.h : null;
    if (op === 'set') {
      if (old) throw new Refuse('permission_denied', 'Already exists.');
      if (data.asker !== u.uid || !h) throw new Refuse('permission_denied', 'You can only ask or log for yourself.');
      if (data.status === 'logged') { if (!data.doer || data.doer === u.uid) throw new Refuse('invalid_argument', 'Pick who helped.'); if (balanceOf(s[1], u.uid) - h < -5) throw new Refuse('failed_precondition', 'That would take you below −5 h.'); return { what: String(data.what || '').slice(0, 60), h, asker: u.uid, doer: data.doer, status: 'logged', at: now(), loggedAt: now() }; }
      if (balanceOf(s[1], u.uid) <= -5) throw new Refuse('failed_precondition', 'You’re at the −5 h limit. Help someone first.');
      return { what: String(data.what || '').slice(0, 60), h, asker: u.uid, doer: null, status: 'open', at: now() };
    }
    if (!old) throw new Refuse('invalid_argument', 'Document does not exist');
    if (data.status === 'claimed' && old.status === 'open' && old.asker !== u.uid) return { doer: u.uid, status: 'claimed', claimedAt: now() };
    if (data.status === 'done' && old.status === 'claimed' && old.doer === u.uid) return { status: 'done', h: h || old.h, doneAt: now() };
    if (data.status === 'logged' && old.status === 'done' && old.asker === u.uid) { if (balanceOf(s[1], u.uid) - old.h < -5) throw new Refuse('failed_precondition', 'That would take you below −5 h.'); return { status: 'logged', loggedAt: now() }; }
    throw new Refuse('permission_denied', 'That isn’t yours to change.');
  }
  // The Mole: the store never says who claimed the week. The server keeps it aside so only that person can reveal.
  if (s[0] === 'circles' && s[2] === 'moles' && s.length === 4) {
    if (op === 'delete') throw new Refuse('permission_denied', 'The Mole stays.');
    if (op === 'set') { if (old) throw new Refuse('permission_denied', 'Someone got there first.'); kv.set('mole:' + p, u.uid); return { at: now(), n: 3 }; }
    if (kv.get('mole:' + p) !== u.uid || !data.revealed) throw new Refuse('permission_denied', 'Only the Mole can reveal the Mole.');
    const m = getDoc(`data/users/${u.uid}/mole`) || {}; const N = [3, 1, 1, 1, 3, 1, 1, 1];
    const done = (m.tasks || []).filter((t, i) => ((m.prog || [])[i] || 0) >= N[t]).length;
    return { revealed: { uid: u.uid, done, at: now() } };
  }
  if (s[0] === 'circles' && s[2] === 'molevotes' && s.length === 4) {
    if (!s[3].endsWith('_' + u.uid)) throw new Refuse('permission_denied', 'One vote each, your own.');
    if (op === 'delete') return data;
    return { week: String(data.week || ''), by: u.uid, vote: String(data.vote || ''), at: now() };
  }
  if (s[0] === 'circles' && s[2] === 'cheers' && s.length === 4) {
    if (op === 'delete') throw new Refuse('permission_denied', 'Cheers stay.');
    if (op !== 'set' || data.from !== u.uid || !s[3].includes('_' + u.uid + '_')) throw new Refuse('permission_denied', 'Cheer as yourself.');
    return { to: String(data.to || ''), from: u.uid, label: String(data.label || '').slice(0, 90), week: String(data.week || ''), at: now() };
  }
  if (s[0] === 'circles' && s[2] === 'clips' && s.length === 4) {
    if (op === 'set') { if (old || data.by !== u.uid) throw new Refuse('permission_denied', 'Post clips as yourself.'); if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.img || '') || data.img.length > 200000) throw new Refuse('invalid_argument', 'Not a photo.'); return { by: u.uid, what: String(data.what || '').slice(0, 80), note: String(data.note || '').slice(0, 120), img: data.img, at: now(), exp: now() + 24 * 3600e3, seen: {} }; }
    if (op === 'update') return data.seen && u.uid in data.seen ? { seen: { [u.uid]: true } } : {};
    if (old && old.by !== u.uid && old.exp > now() && !isOwner(u)) throw new Refuse('permission_denied', 'Not your clip.');
    return data;
  }
  if (s[0] === 'circles' && s[2] === 'dares' && s.length === 4) {
    if (op === 'set') { if (old) throw new Refuse('permission_denied', 'Already exists.'); return { text: String(data.text || '').slice(0, 100), level: Math.max(1, Math.min(6, +data.level || 3)), by: u.uid, at: now(), to: data.to || null, status: data.to ? 'open' : null }; }
    if (!old) throw new Refuse('invalid_argument', 'Document does not exist');
    if (op === 'delete') { if (old.by !== u.uid && !isOwner(u)) throw new Refuse('permission_denied', 'Only whoever wrote it can take it out.'); return data; }
    if (old.to !== u.uid) throw new Refuse('permission_denied', 'Only the person dared can answer it.');
    const st = { accepted: 1, declined: 1, done: 1 }[data.status] ? data.status : old.status;
    return { status: st, ...(st === 'done' ? { doneAt: now(), note: String(data.note || '').slice(0, 120) } : {}) };
  }
  if (s[0] === 'circles' && s[2] === 'daily' && s.length === 4 && op !== 'delete') {
    const v = (data.done || {})[u.uid]; const keep = { done: { [u.uid]: { at: now(), note: String((v && v.note) || '').slice(0, 120) } } };
    if (op === 'set') { if (old) throw new Refuse('failed_precondition', 'Already started today.'); keep.dare = String(data.dare || '').slice(0, 100); }
    return keep;
  }
  // Missions: the host circle edits its own; everyone else can only confirm for their circle, join as themselves, or give a verdict.
  if (s[0] === 'missions' && s.length === 2) {
    if (op === 'set' && !old) { data.by = u.uid; data.at = now(); if (!(+data.when > now() + 2 * 3600e3)) throw new Refuse('invalid_argument', 'Give it at least two hours’ notice.'); return data; }
    if (!old) throw new Refuse('invalid_argument', 'Document does not exist');
    if (old.by === u.uid || isOwner(u)) return data;
    if (op !== 'update') throw new Refuse('permission_denied', 'Not your Mission.');
    const me = getDoc('people/' + u.uid) || {}, keep = {};
    if (data.confirms && me.circle && me.circle in data.confirms && me.circle !== old.cid) keep.confirms = { [me.circle]: String(data.confirms[me.circle] || '').slice(0, 28) };
    if (data.ins && u.uid in data.ins) keep.ins = { [u.uid]: data.ins[u.uid] ? { circle: me.circle || null, cname: String(data.ins[u.uid].cname || '').slice(0, 28) } : null };
    if (data.verdict && u.uid in data.verdict && old.when < now() && (old.ins || {})[u.uid]) keep.verdict = { [u.uid]: !!data.verdict[u.uid] };
    return keep;
  }
  if (s[0] === 'trails' && s.length === 2) {
    if (op === 'set' && !old) { data.by = u.uid; data.at = now(); return data; }
    if (old && old.by !== u.uid && !isOwner(u)) throw new Refuse('permission_denied', 'Not your trail.');
    return data;
  }
  if (s[0] === 'stamps' && s.length === 2) {
    if (!s[1].endsWith('_' + u.uid)) throw new Refuse('permission_denied', 'Stamp your own card.');
    if (op === 'delete') return data;
    const tr = getDoc('trails/' + data.trail); const t = now();
    if (!tr || t < tr.start || t > tr.end) throw new Refuse('failed_precondition', 'This trail isn’t on right now.');
    data.uid = u.uid; return data;
  }
  if (s[0] === 'circles' && s[2] === 'sealed' && s.length === 4 && old && op !== 'set' && old.by !== u.uid) throw new Refuse('permission_denied', 'Sealed means sealed.');
  return data;
}
function balanceOf(cid, uid) {
  let b = 0; for (const r of q.kids.all(`circles/${cid}/favors`)) { const f = JSON.parse(r.data); if (f.status !== 'logged') continue; if (f.doer === uid) b += f.h; if (f.asker === uid) b -= f.h; }
  return b;
}
function readFilter(p, d, u) {
  if (!d) return d;
  const s = p.split('/');
  if (s[0] === 'missions' && d.by !== u.uid) {
    const me = getDoc('people/' + u.uid) || {}, host = me.circle && me.circle === d.cid, inn = !!(d.ins || {})[u.uid];
    if (!host && !(inn && now() >= d.when - 2 * 3600e3)) d = { ...d, spot: '' };
    if (!host && !inn) d = { ...d, roles: [] };
  }
  if (s[0] === 'drops' && d.host !== u.uid) { d = { ...d }; delete d.code; }
  if (s[0] === 'pair' && s[1] !== u.uid) { d = { ...d }; delete d.code; }
  if (s[0] === 'circles' && s[2] === 'midnight' && d.releaseAt > now()) d = { ...d, text: null };
  if (s[0] === 'circles' && s[2] === 'sealed' && d.openAt > now()) d = { ...d, text: null };
  return d;
}
const timeBound = p => /^circles\/[^/]+\/(midnight|sealed)/.test(p) || p.startsWith('pair');

/* ---------- queries ---------- */
const test = (x, op, v) => ({ '==': x === v, '!=': x !== v, '<': x < v, '<=': x <= v, '>': x > v, '>=': x >= v, 'in': Array.isArray(v) && v.includes(x), 'not-in': Array.isArray(v) && !v.includes(x), 'array-contains': Array.isArray(x) && x.includes(v) })[op];
function runQuery(spec, u) {
  const p = spec.col;
  if (!canRead(p + '/x', u) && !(p === 'ev' && isOwner(u))) throw new Refuse('permission_denied', 'Not yours to read.');
  if (p === 'pair' && !(spec.where || []).some(w => w[0] === 'code' && w[1] === '==')) throw new Refuse('permission_denied', 'Meeting codes can only be looked up one at a time.');
  let rows = q.kids.all(p).map(r => ({ id: r.path.split('/').pop(), path: r.path, data: JSON.parse(r.data) }));
  for (const [f, op, v] of spec.where || []) rows = rows.filter(r => test(r.data[f], op, v));
  if (spec.orderBy) { const [f, dir] = spec.orderBy; rows.sort((a, b) => { const x = a.data[f], y = b.data[f]; if (x === undefined) return 1; if (y === undefined) return -1; return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1); }); }
  else rows.sort((a, b) => a.id < b.id ? -1 : 1);
  if (spec.limit) rows = rows.slice(0, spec.limit);
  return rows.map(r => ({ id: r.id, data: readFilter(r.path, r.data, u) }));
}
function readDoc(p, u) { if (!canRead(p, u)) throw new Refuse('permission_denied', 'Not yours to read.'); return readFilter(p, getDoc(p), u); }

/* ---------- live subscriptions over server-sent events ---------- */
const clients = new Map(); // cid -> {uid, res, subs: Map(subId -> {spec, last})}
function evalSub(c, sub) {
  const u = userById(c.uid);
  try { return sub.spec.doc ? { doc: readDoc(sub.spec.doc, u) } : { docs: runQuery(sub.spec, u) }; }
  catch (e) { return { error: e.code || 'internal' }; }
}
function pushSub(c, id, sub, force) {
  if (!c.res) return;
  const r = evalSub(c, sub), j = JSON.stringify(r);
  if (!force && j === sub.last) return;
  sub.last = j; c.res.write(`data: ${JSON.stringify({ sub: id, ...r })}\n\n`);
}
function touched(paths) {
  for (const c of clients.values()) for (const [id, sub] of c.subs) {
    const sp = sub.spec.doc || sub.spec.col;
    if (paths.some(p => p === sp || parentOf(p) === sp || (sub.spec.doc && p === sub.spec.doc))) pushSub(c, id, sub);
  }
}
setInterval(() => { for (const c of clients.values()) for (const [id, sub] of c.subs) if (timeBound(sub.spec.doc || sub.spec.col)) pushSub(c, id, sub); }, 15000);
setInterval(() => { for (const [cid, c] of clients) if (!c.res && now() - c.gone > 10 * MIN) clients.delete(cid); }, MIN);
function setLive(uid) {
  const on = [...clients.values()].some(c => c.uid === uid && c.res);
  const p = 'live/' + uid, cur = getDoc(p);
  if (!cur || cur.on !== on) { putDoc(p, { on, at: now() }); touched([p]); }
}

/* ---------- users and sessions ---------- */
const userById = uid => { const r = db.prepare('SELECT uid,email FROM users WHERE uid=?').get(uid); return r || null; };
function userFromReq(req) {
  const m = /(?:^|;\s*)insane_s=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const s = db.prepare('SELECT uid,exp FROM sessions WHERE hash=?').get(sha(m[1]));
  if (!s || s.exp < Date.now()) return null;
  return userById(s.uid);
}
const hits = new Map();
function limited(key, n, ms) { const t = Date.now(), a = (hits.get(key) || []).filter(x => t - x < ms); a.push(t); hits.set(key, a); return a.length > n; }
async function sendMail(to, subject, text) {
  if (ENV.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: 'Bearer ' + ENV.RESEND_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ from: ENV.MAIL_FROM || 'INSANE <onboarding@resend.dev>', to: [to], subject, text }) });
    if (!r.ok) throw new Error('mail ' + r.status + ' ' + await r.text());
    return 'sent';
  }
  console.log(`[mail] to ${to}: ${subject}\n${text}`);
  return 'logged';
}

/* ---------- web push (VAPID, no payload: the service worker fetches the note) ---------- */
let vapid = kv.get('vapid');
if (!vapid) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' }), pub = publicKey.export({ format: 'jwk' });
  vapid = { d: jwk.d, x: pub.x, y: pub.y };
  kv.set('vapid', vapid);
}
const vapidPublic = Buffer.concat([Buffer.from([4]), Buffer.from(vapid.x, 'base64url'), Buffer.from(vapid.y, 'base64url')]).toString('base64url');
const vapidKey = crypto.createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: vapid.d, x: vapid.x, y: vapid.y }, format: 'jwk' });
function vapidJWT(aud) {
  const h = Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })).toString('base64url');
  const b = Buffer.from(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: ENV.VAPID_SUBJECT || 'mailto:admin@example.com' })).toString('base64url');
  const sig = crypto.sign('sha256', Buffer.from(h + '.' + b), { key: vapidKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${h}.${b}.${sig}`;
}
const pushLog = [];
function quiet(person) {
  if (!person) return false;
  if (person.darkUntil > now() && (person.darkFrom || 0) <= now()) return true;
  const qh = person.quiet; if (!qh || qh.off) return false;
  let h = new Date(now()).getHours();
  try { if (person.tz) h = +new Date(now()).toLocaleString('en-GB', { timeZone: person.tz, hour: '2-digit', hourCycle: 'h23' }); } catch (e) { /* unknown zone: server time */ }
  const from = qh.from ?? 23, to = qh.to ?? 8;
  return from > to ? (h >= from || h < to) : (h >= from && h < to);
}
async function notify(uid, title, body, tag) {
  const person = getDoc('people/' + uid);
  if (quiet(person)) { pushLog.push({ uid, title, held: 'quiet', at: now() }); return; }
  const box = getDoc(`data/users/${uid}/inbox`) || { items: [] };
  box.items = [{ title, body, tag, at: now() }, ...box.items].slice(0, 40);
  putDoc(`data/users/${uid}/inbox`, box); touched([`data/users/${uid}/inbox`]);
  pushLog.push({ uid, title, at: now() });
  for (const r of db.prepare('SELECT endpoint FROM push WHERE uid=?').all(uid)) {
    try {
      const u = new URL(r.endpoint);
      const res = await fetch(r.endpoint, { method: 'POST', headers: { TTL: '3600', Urgency: 'normal', Authorization: `vapid t=${vapidJWT(u.origin)}, k=${vapidPublic}`, 'Content-Length': '0' } });
      if (res.status === 404 || res.status === 410) db.prepare('DELETE FROM push WHERE endpoint=?').run(r.endpoint);
    } catch (e) { /* a dead endpoint shouldn't stop the others */ }
  }
}
// Who hears about a write: the people in that thread, room or chat, never the writer.
function afterWrite(op, p, data, u) {
  const s = p.split('/');
  if (s[0] === 'circles' && s.length === 4 && op !== 'delete') {
    const circleIds = () => q.kids.all('people').map(r => ({ id: r.path.split('/')[1], d: JSON.parse(r.data) })).filter(x => x.d.circle === s[1] && x.id !== u.uid).map(x => x.id);
    const name = (getDoc('people/' + u.uid) || {}).name || 'Someone', doc = getDoc(p) || {};
    if (s[2] === 'favors' && op === 'set' && doc.status === 'open') for (const id of circleIds()) notify(id, `${name} asks a favor`, doc.what, 'fv:' + s[3]);
    if (s[2] === 'favors' && doc.status === 'done' && data.status === 'done') notify(doc.asker, `${name} did your favor`, `${doc.what} · confirm to log it`, 'fv:' + s[3]);
    if (s[2] === 'dares' && op === 'set' && doc.to) notify(doc.to, `${name} dared you`, doc.text, 'dare:' + s[3]);
    return;
  }
  if (op !== 'set' || s[s.length - 2] !== 'msgs') return;
  const by = data.by, text = String(data.text || '').slice(0, 90), name = data.name || 'Someone';
  if (s[0] === 'circles' && s[2] === 'threads') {
    const t = getDoc(s.slice(0, 4).join('/')); if (!t || t.muted) return;
    const ids = q.kids.all('people').map(r => ({ id: r.path.split('/')[1], d: JSON.parse(r.data) })).filter(x => x.d.circle === s[1] && x.id !== by);
    const going = t.kind === 'plan' ? t.going || {} : null;
    for (const x of ids) if (!going || going[x.id]) notify(x.id, `${name} in ${t.title}`, text, 't:' + s[3]);
  } else if (s[0] === 'rooms') {
    const r = getDoc('rooms/' + s[1]); if (!r) return;
    for (const row of q.kids.all('people')) { const d = JSON.parse(row.data), id = row.path.split('/')[1]; if (id !== by && r.circles.includes(d.circle)) notify(id, `${name} · ${r.title}`, text, 'r:' + s[1]); }
  } else if (s[0] === 'dms') {
    for (const id of s[1].split('__')) if (id !== by) notify(id, name, text, 'd:' + s[1]);
  }
}
// Once a minute: Midnight messages going out, drops opening in 15 minutes near people.
let lastSweep = now();
setInterval(sweep, 20000);
function sweep() {
  const t = now(), from = lastSweep; lastSweep = t;
  for (const c of q.kids.all('circles')) {
    const cid = c.path.split('/')[1];
    const out = q.kids.all(`circles/${cid}/midnight`).map(r => JSON.parse(r.data)).filter(m => m.releaseAt > from && m.releaseAt <= t);
    if (out.length) for (const row of q.kids.all('people')) { const d = JSON.parse(row.data); if (d.circle === cid) notify(row.path.split('/')[1], 'Midnight', `${out.length} unsigned message${out.length > 1 ? 's' : ''} just went out in your circle.`, 'midnight'); }
  }
  const gone = [];
  for (const c of q.kids.all('circles')) for (const r of q.kids.all(c.path + '/clips')) if (JSON.parse(r.data).exp < t) { q.del.run(r.path); gone.push(r.path); }
  if (gone.length) touched(gone);
  const people = q.kids.all('people').map(r => ({ id: r.path.split('/')[1], d: JSON.parse(r.data) }));
  for (const row of q.kids.all('drops')) {
    const d = JSON.parse(row.data), soon = d.start - 15 * MIN;
    if (soon > from && soon <= t) for (const x of people) {
      const c = x.d.cell; if (!c || x.id === d.host) continue;
      if (km([c.lat, c.lon], [d.lat, d.lon]) <= (x.d.radius || 5)) notify(x.id, `${d.venue} opens in 15 min`, `${d.prize} · ${km([c.lat, c.lon], [d.lat, d.lon]).toFixed(1)} km away`, 'drop:' + row.path.split('/')[1]);
    }
  }
}
function km(a, b) { const r = x => x * Math.PI / 180, dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); }

/* ---------- place search beyond towns: OpenStreetMap's Nominatim, one request a second ---------- */
const geoCache = new Map(); let geoNext = 0;
async function geocode(qs) {
  const key = qs.toLowerCase().trim();
  if (geoCache.has(key)) return geoCache.get(key);
  const wait = Math.max(0, geoNext - Date.now()); geoNext = Date.now() + wait + 1100;
  await new Promise(r => setTimeout(r, wait));
  const u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=6&q=' + encodeURIComponent(qs);
  const r = await fetch(u, { headers: { 'User-Agent': `INSANE/0.8 (${PUBLIC_URL})`, 'Accept-Language': 'en' } });
  if (!r.ok) throw new Error('geocode ' + r.status);
  const out = (await r.json()).map(x => ({ name: x.display_name, lat: +x.lat, lon: +x.lon, kind: x.type }));
  geoCache.set(key, out); if (geoCache.size > 2000) geoCache.delete(geoCache.keys().next().value);
  return out;
}

/* ---------- http ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.tsv': 'text/tab-separated-values; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const gzCache = new Map();
function sendFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file), type = TYPES[ext] || 'application/octet-stream';
    const etag = `"${st.size}-${st.mtimeMs}"`;
    const h = { 'content-type': type, etag, 'cache-control': ext === '.html' || file.endsWith('sw.js') ? 'no-cache' : 'public, max-age=86400', 'x-content-type-options': 'nosniff' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
    if (/gzip/.test(req.headers['accept-encoding'] || '') && /\.(html|js|json|tsv|svg)$/.test(ext)) {
      let g = gzCache.get(file);
      if (!g || g.etag !== etag) { g = { etag, buf: zlib.gzipSync(fs.readFileSync(file)) }; gzCache.set(file, g); }
      res.writeHead(200, { ...h, 'content-encoding': 'gzip', 'content-length': g.buf.length });
      return res.end(req.method === 'HEAD' ? undefined : g.buf);
    }
    res.writeHead(200, { ...h, 'content-length': st.size });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
const json = (res, code, obj, extra = {}) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra }); res.end(JSON.stringify(obj)); };
function body(req) {
  return new Promise((ok, bad) => { let n = 0; const parts = []; req.on('data', c => { n += c.length; if (n > 300 * 1024) { bad(new Refuse('invalid_argument', 'Too big.')); req.destroy(); } else parts.push(c); }); req.on('end', () => { try { ok(parts.length ? JSON.parse(Buffer.concat(parts)) : {}); } catch (e) { bad(new Refuse('invalid_argument', 'Bad JSON.')); } }); });
}
const validPath = (p, even) => typeof p === 'string' && p.length <= 1000 && /^[A-Za-z0-9_\-:.@]+(\/[A-Za-z0-9_\-:.@]+)*$/.test(p) && (p.split('/').length % 2 === 0) === even && !p.split('/').some(x => x === '.' || x === '..');
const cookie = (v, age) => `insane_s=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${SECURE ? '; Secure' : ''}`;

async function api(req, res, url) {
  const u = userFromReq(req), r = url.pathname.slice(5);
  if (req.method === 'GET' && r === 'hello') return json(res, 200, { insane: true, version: '0.8', signedIn: !!u, uid: u?.uid || null, email: u?.email || null, isOwner: isOwner(u), tiles: TILE_URL, attr: TILE_ATTR, vapid: vapidPublic, dev: DEV, now: now() });
  if (req.method === 'GET' && r === 'stream') {
    if (!u) return json(res, 401, { code: 'unauthenticated' });
    const cid = url.searchParams.get('cid') || rid();
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 2000\n\n');
    let c = clients.get(cid); if (!c || c.uid !== u.uid) { c = { uid: u.uid, res: null, subs: new Map() }; clients.set(cid, c); }
    c.res = res; for (const [id, sub] of c.subs) pushSub(c, id, sub, true);
    setLive(u.uid);
    const ka = setInterval(() => res.write(': ka\n\n'), 25000);
    req.on('close', () => { clearInterval(ka); if (c.res === res) { c.res = null; c.gone = now(); } setLive(u.uid); });
    return;
  }
  if (req.method === 'GET' && r === 'geocode') {
    if (!u) return json(res, 401, { code: 'unauthenticated' });
    const qs = (url.searchParams.get('q') || '').slice(0, 120);
    if (qs.length < 3) return json(res, 200, { results: [] });
    if (limited('geo:' + u.uid, 20, MIN)) return json(res, 429, { code: 'resource_exhausted' });
    try { return json(res, 200, { results: await geocode(qs) }); } catch (e) { return json(res, 502, { code: 'unavailable', message: 'Place search is down. Try a town name or tap the map.' }); }
  }
  if (req.method === 'GET' && r === 'notes/latest') {
    if (!u) return json(res, 401, { code: 'unauthenticated' });
    const box = getDoc(`data/users/${u.uid}/inbox`) || { items: [] };
    return json(res, 200, box.items[0] || { title: 'INSANE', body: 'Something new.' });
  }
  if (DEV && req.method === 'GET' && r === 'dev/outbox') { const row = db.prepare('SELECT sent FROM otps WHERE email=?').get((url.searchParams.get('email') || '').toLowerCase()); return json(res, 200, { mail: row ? JSON.parse(row.sent) : null }); }
  if (DEV && req.method === 'GET' && r === 'dev/pushlog') return json(res, 200, { log: pushLog });
  // C11 (WS-B; route to be owned by WS-I): a public invite preview, so a link opened signed out can say who
  // invited you. Only the circle's name, its size and the creator's first name. Rate-limited per address.
  if (req.method === 'GET' && /^invite\/[A-Za-z0-9]{6}$/.test(r)) {
    if (limited('inv:' + req.socket.remoteAddress, 30, MIN)) return json(res, 429, { code: 'resource_exhausted' });
    const code = r.split('/')[1].toUpperCase(), cd = getDoc('codes/' + code), c = cd && getDoc('circles/' + cd.cid);
    if (!c) return json(res, 404, { code: 'not_found' });
    const count = q.kids.all('people').filter(x => JSON.parse(x.data).circle === cd.cid).length || (c.members || []).length;
    const by = String((getDoc('people/' + c.by) || {}).name || '').trim().split(/\s+/)[0].slice(0, 24);
    return json(res, 200, { name: String(c.name || '').slice(0, 28), count, max: 8, by }, { 'cache-control': 'no-store' });
  }
  if (req.method !== 'POST') return json(res, 405, { code: 'invalid_argument' });
  const b = await body(req);
  if (r === 'auth/start') {
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) throw new Refuse('invalid_argument', 'That doesn’t look like an email address.');
    const ip = req.socket.remoteAddress;
    if (limited('otp:' + email, 4, 10 * MIN) || limited('otpip:' + ip, 30, HOUR)) throw new Refuse('resource_exhausted', 'Too many codes. Wait a few minutes.');
    const code = String(crypto.randomInt(100000, 1000000));
    const text = `Your INSANE sign-in code is ${code}\n\nIt works for 10 minutes. If you didn’t ask for it, ignore this email.\n\n${PUBLIC_URL}`;
    db.prepare('INSERT INTO otps(email,hash,exp,tries,sent) VALUES(?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET hash=excluded.hash,exp=excluded.exp,tries=0,sent=excluded.sent').run(email, sha(email + code), Date.now() + 10 * MIN, JSON.stringify(DEV ? { to: email, subject: 'Your INSANE code: ' + code, text, at: Date.now() } : { at: Date.now() }));
    const how = await sendMail(email, 'Your INSANE code: ' + code, text);
    return json(res, 200, { ok: true, how });
  }
  if (r === 'auth/verify') {
    const email = String(b.email || '').trim().toLowerCase(), code = String(b.code || '').replace(/\D/g, '');
    const row = db.prepare('SELECT hash,exp,tries FROM otps WHERE email=?').get(email);
    if (!row || row.exp < Date.now() || row.tries >= 5) throw new Refuse('failed_precondition', 'That code has expired. Ask for a new one.');
    if (row.hash !== sha(email + code)) { db.prepare('UPDATE otps SET tries=tries+1 WHERE email=?').run(email); throw new Refuse('failed_precondition', 'That code isn’t right. Check the email again.'); }
    db.prepare('DELETE FROM otps WHERE email=?').run(email);
    let user = db.prepare('SELECT uid,email FROM users WHERE email=?').get(email);
    if (!user) { user = { uid: 'u_' + rid(14), email }; db.prepare('INSERT INTO users(uid,email,created) VALUES(?,?,?)').run(user.uid, email, Date.now()); }
    const tok = rid(40);
    db.prepare('INSERT INTO sessions(hash,uid,exp) VALUES(?,?,?)').run(sha(tok), user.uid, Date.now() + 60 * DAY);
    return json(res, 200, { ok: true, uid: user.uid }, { 'set-cookie': cookie(tok, 60 * 86400) });
  }
  if (r === 'auth/logout') {
    const m = /(?:^|;\s*)insane_s=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '');
    if (m) db.prepare('DELETE FROM sessions WHERE hash=?').run(sha(m[1]));
    return json(res, 200, { ok: true }, { 'set-cookie': cookie('', 0) });
  }
  if (DEV && r === 'dev/clock') { clockOffset = +b.offset || 0; return json(res, 200, { now: now() }); }
  if (!u) throw new Refuse('unauthenticated', 'Sign in first.');
  if (r === 'push/sub') {
    const sub = b.subscription; if (!sub || !/^https:\/\//.test(sub.endpoint || '')) throw new Refuse('invalid_argument', 'Bad subscription.');
    db.prepare('INSERT INTO push(endpoint,uid,sub) VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET uid=excluded.uid,sub=excluded.sub').run(sub.endpoint, u.uid, JSON.stringify(sub));
    return json(res, 200, { ok: true });
  }
  if (r === 'sub') {
    const c = clients.get(b.cid) || (clients.set(b.cid, { uid: u.uid, res: null, subs: new Map(), gone: now() }), clients.get(b.cid));
    if (c.uid !== u.uid) throw new Refuse('permission_denied', 'Not your stream.');
    const spec = b.spec || {};
    if (spec.doc ? !validPath(spec.doc, true) : !validPath(spec.col, false)) throw new Refuse('invalid_argument', 'Bad path.');
    if (c.subs.size >= 64 && !c.subs.has(b.sub)) throw new Refuse('resource_exhausted', 'Too many live views.');
    const sub = { spec, last: null }; c.subs.set(b.sub, sub); pushSub(c, b.sub, sub, true);
    return json(res, 200, { ok: true });
  }
  if (r === 'unsub') { const c = clients.get(b.cid); if (c && c.uid === u.uid) c.subs.delete(b.sub); return json(res, 200, { ok: true }); }
  if (r === 'get') { if (!validPath(b.path, true)) throw new Refuse('invalid_argument', 'Bad path.'); return json(res, 200, { doc: readDoc(b.path, u) }); }
  if (r === 'query') { if (!validPath(b.col, false)) throw new Refuse('invalid_argument', 'Bad path.'); return json(res, 200, { docs: runQuery(b, u) }); }
  if (['set', 'update', 'delete'].includes(r)) {
    if (!validPath(b.path, true)) throw new Refuse('invalid_argument', 'Bad path.');
    if (!canWrite(b.path, u)) throw new Refuse('permission_denied', 'Not yours to change.');
    if (limited('w:' + u.uid, 40, 10000)) throw new Refuse('resource_exhausted', 'Too fast.');
    let data = r === 'delete' ? null : b.data;
    if (r !== 'delete' && (!data || typeof data !== 'object' || Array.isArray(data))) throw new Refuse('invalid_argument', 'Data must be an object.');
    data = beforeWrite(r, b.path, data, u);
    if (r === 'delete') q.del.run(b.path);
    else if (r === 'set') { if (q.count.get().n > 200000) throw new Refuse('quota_exceeded', 'Storage is full.'); putDoc(b.path, data); }
    else { const old = getDoc(b.path); if (!old) throw new Refuse('invalid_argument', 'Document does not exist'); putDoc(b.path, merge(old, data)); }
    touched([b.path]);
    try { afterWrite(r, b.path, data, u); } catch (e) { console.warn('afterWrite', e); }
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { code: 'not_found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/' || url.pathname === '/index.html') return sendFile(req, res, path.join(ROOT, 'index.html'));
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (url.pathname === '/sw.js') return sendFile(req, res, path.join(__dirname, 'public', 'sw.js'));
    if (url.pathname === '/manifest.webmanifest' || url.pathname === '/icon.svg') return sendFile(req, res, path.join(__dirname, 'public', url.pathname.slice(1)));
    const f = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!f.startsWith(path.join(ROOT, 'data') + path.sep)) { res.writeHead(404); return res.end('Not found'); }
    return sendFile(req, res, f);
  } catch (e) {
    if (e instanceof Refuse) return json(res, e.code === 'unauthenticated' ? 401 : e.code === 'permission_denied' ? 403 : e.code === 'resource_exhausted' ? 429 : 400, { code: e.code, message: e.message });
    console.error(e); return json(res, 500, { code: 'internal', message: 'Something broke on the server.' });
  }
});
server.listen(PORT, () => console.log(`INSANE on ${PUBLIC_URL} (port ${PORT})${DEV ? ' [dev: codes in /api/dev/outbox, movable clock]' : ''}`));
