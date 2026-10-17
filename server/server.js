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
// v0.9 WS-I modules (ops): each is a new file, wired in below with one or two lines.
const { migrate } = require('./migrate');
const { Limiter, writeClasses, clientIp } = require('./ratelimit');
const { securityHeaders } = require('./headers');
const { createSentry } = require('./sentry');
const { backupNow } = require('./backup');
const { createFunnel } = require('./analytics');
const { unlocks } = require('./unlocks');
const TZ = require('./tz');

const ENV = process.env;
const PORT = +ENV.PORT || 8080;
const ROOT = path.resolve(__dirname, '..', 'app');
const DEV = ENV.DEV === '1';
const OWNER = (ENV.OWNER_EMAIL || '').trim().toLowerCase();
const PUBLIC_URL = (ENV.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE = PUBLIC_URL.startsWith('https://');
// Map tiles (C69, WS-F). tile.openstreetmap.org is never the default: its policy forbids app-scale use.
//   TILE_URL   an XYZ raster template (https://…/{z}/{x}/{y}.png, e.g. Stadia or MapTiler with your key),
//              a .pmtiles URL (Protomaps vector basemap, self-hosted: same origin or R2 with CORS + Range),
//              or "none" for the bundled world map only.
//   Default: /data/basemap.pmtiles, served from TILE_FILE (default app/data/basemap.pmtiles) if that file exists, else "none".
//   TILE_KIND  xyz | pmtiles | none (guessed from TILE_URL); TILE_URL_DARK an optional dark XYZ template;
//   TILE_ATTR  the attribution line; TILE_MAXZ the deepest zoom the source has.
const geo = require('./geo');
const TILE_FILE = ENV.TILE_FILE ? path.resolve(ENV.TILE_FILE) : path.join(ROOT, 'data', 'basemap.pmtiles'); // e.g. a Render disk
const TILE_URL = ENV.TILE_URL || (fs.existsSync(TILE_FILE) ? '/data/basemap.pmtiles' : 'none');
const TILE_KIND = ENV.TILE_KIND || (TILE_URL === 'none' ? 'none' : /\.pmtiles(\?|$)/.test(TILE_URL) ? 'pmtiles' : 'xyz');
const TILE_ATTR = ENV.TILE_ATTR || (TILE_KIND === 'pmtiles' ? '© OpenStreetMap contributors · Protomaps' : TILE_KIND === 'none' ? '' : '© OpenStreetMap contributors');
const TILE_DARK = ENV.TILE_URL_DARK || '';
const TILE_MAXZ = +ENV.TILE_MAXZ || (TILE_KIND === 'pmtiles' ? 15 : 19);

const BUILD_ID = (/<!-- INSANE build ([0-9a-f]{6,})/.exec(fs.existsSync(path.join(ROOT, 'index.html')) ? fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').slice(0, 2000) : '') || [])[1] || 'dev';
const MIN_CLIENT_BUILD = ENV.MIN_CLIENT_BUILD || ''; // C08: a client older than this reloads (it compares X-Insane-Min-Build)
const MAX_BODY = +ENV.MAX_BODY || 300 * 1024;
const GOOGLE_CLIENT_ID = ENV.GOOGLE_CLIENT_ID || '';
const sentry = createSentry({ release: BUILD_ID, environment: ENV.SENTRY_ENV || (DEV ? 'dev' : 'production') });
const SEC = securityHeaders({ secure: SECURE, tileUrl: TILE_URL, extra: ENV.CSP_EXTRA || '' });
const limiter = new Limiter();
let clockOffset = 0; // only moved by the dev clock, for tests that run a fortnight in minutes
const now = () => Date.now() + clockOffset;
const MIN = 6e4, HOUR = 36e5, DAY = 864e5;

/* ---------- storage ---------- */
const DB_FILE = ENV.DB_FILE === ':memory:' ? ':memory:' : path.resolve(ENV.DB_FILE || path.join(__dirname, 'insane.db')); // ':memory:' for the in-process rule tests (test/lib/inproc.js)
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
const MIGRATION = migrate(db, { file: DB_FILE, backupDir: ENV.BACKUP_DIR }); // tables + store steps (server/migrate.js)
const funnel = createFunnel(db);
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
// WS-E: puzzle packs, dares, Mole tasks and seed drops (server/content.js). The schedule's secret comes from
// SEED (tests) or CONTENT_SECRET, else one made once and kept in the DB, so nobody can work out next week.
const CONTENT = require('./content')({ db, now: () => now(), secret: ENV.SEED || ENV.CONTENT_SECRET || kv.get('content:secret') || (s => (kv.set('content:secret', s), s))(rid(32)) });

/* ---------- rules: the same ones the artifact enforces ---------- */
const isOwner = u => !!u && !!OWNER && u.email === OWNER;
function canRead(p, u) {
  if (!u) return false;
  const s = p.split('/');
  if (s[0] === 'data' && s[1] === 'users') return s[2] === u.uid;
  if (s[0] === 'ev') return s.length === 1 ? isOwner(u) : (s[1] === u.uid || isOwner(u));
  return SAFE.canRead(p, u); // circles are for members, DMs for the two people (server/moderation.js)
}
function canWrite(p, u) {
  if (!u) return false;
  const s = p.split('/');
  if (s[0] === 'data' && s[1] === 'users') return s[2] === u.uid;
  if (s[0] === 'meta') return false; // meta/schema is the server's (migrate.js)
  if (['people', 'pair', 'ev', 'live'].includes(s[0])) return s[1] === u.uid || (isOwner(u) && s[0] !== 'live');
  return SAFE.canWrite(p, u);
}
const merge = (a, b) => { for (const k in b) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], v); else a[k] = v; } return a; };
// The third argument is a retry delay in ms (C84, WS-I) or a machine-readable reason (WS-D, e.g. 'names_blocked').
class Refuse extends Error { constructor(code, msg, more) { super(msg); this.code = code; if (typeof more === 'number') { if (more) this.retryMs = more; } else if (more) this.reason = more; } }
// C84: spend one token from each bucket, or refuse with how long to wait.
function rate(cls, who) { const r = limiter.take(cls, who); if (!r.ok) throw new Refuse('resource_exhausted', 'Too fast. Try again in a moment.', r.retryMs); }

/* ---------- the checks a page can't be trusted with: server/rules/<collection>.js ---------- */
// WS-D's safety rules (server/moderation.js) are called from the rule files they belong to through `safe()`;
// its read filter (blocks, removals, presence, squares) runs after every collection's own read rule.
// Decode (WS-E, C48): the answer is checked here against the city's puzzle for that week; the page never has it.
const solvesIn = (city, week) => q.kids.all('solves').filter(r => { const d = JSON.parse(r.data); return d.city === city && d.week === week; }).length;
function solveDoc(u, data) {
  const me = getDoc('people/' + u.uid) || {}, week = String(data.week || '');
  const r = CONTENT.checkSolve(me, week, data.answer, solvesIn(me.city, week));
  if (!r.ok) throw new Refuse(r.code, r.message);
  const c = me.circle ? getDoc('circles/' + me.circle) : null;
  return { week, city: me.city, uid: u.uid, name: String(data.name || me.handle || me.name || 'Someone').slice(0, 24), circle: me.circle || null, cname: c ? String(c.name || '').slice(0, 28) : null, at: now(), hints: r.hints };
}
const dropSeed = id => kv.get('dropseed:' + id); // WS-E (C50): the draw seed, kept aside until the drop closes (rules/drops.js)
const rules = require('./rules')({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN, safe: () => SAFE, CONTENT, solveDoc });
const beforeWrite = rules.beforeWrite;
const readFilter = (p, d, u) => SAFE.readFilter(p, rules.readFilter(p, d, u), u); // null: blocked, removed, flagged away, or another circle's presence
function balanceOf(cid, uid) {
  let b = 0; for (const r of q.kids.all(`circles/${cid}/favors`)) { const f = JSON.parse(r.data); if (f.status !== 'logged') continue; if (f.doer === uid) b += f.h; if (f.asker === uid) b -= f.h; }
  return b;
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
  return rows.map(r => ({ id: r.id, data: readFilter(r.path, r.data, u) })).filter(r => r.data != null);
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
setInterval(() => pushTimeBound(), 15000).unref();
setInterval(() => { for (const [cid, c] of clients) if (!c.res && now() - c.gone > 10 * MIN) clients.delete(cid); }, MIN).unref();
// Re-run every live view one person has open: after a block, a removal or a close their access changed.
function refreshUser(uid) { for (const c of clients.values()) if (c.uid === uid) for (const [id, sub] of c.subs) pushSub(c, id, sub); }
// End live streams (a revoked session, a deleted account): they reconnect, get 401, and the page signs out.
function endStreams(pred) { for (const [cid, c] of clients) if (pred(c)) { try { if (c.res) c.res.end(); } catch (e) { /* already gone */ } c.res = null; c.subs.clear(); clients.delete(cid); } }
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
  const h = sha(m[1]), s = db.prepare('SELECT uid,exp FROM sessions WHERE hash=?').get(h);
  if (!s || s.exp < Date.now()) return null;
  const u = userById(s.uid); if (!u) return null;
  ACC.touch(h, req);
  return { ...u, sess: h };
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
  const h = TZ.localHour(now(), person.tz); // C102: the person's zone, else DEFAULT_TZ (never the server's UTC clock)
  const from = qh.from ?? 23, to = qh.to ?? 8;
  return from > to ? (h >= from || h < to) : (h >= from && h < to);
}
async function notify(uid, title, body, tag, from) {
  if (from && SAFE.mutedFor(uid, from)) return;
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
// C36: v0.9 people docs carry circles: [cid]; v0.8 ones only circle.
const inCircle = (d, cid) => !!d && (d.circle === cid || (Array.isArray(d.circles) && d.circles.includes(cid)));
// Who hears about a write: the people in that thread, room or chat, never the writer.
function afterWrite(op, p, data, u) {
  const s = p.split('/');
  if (s[0] === 'circles' && s.length === 4 && op !== 'delete') {
    const circleIds = () => q.kids.all('people').map(r => ({ id: r.path.split('/')[1], d: JSON.parse(r.data) })).filter(x => inCircle(x.d, s[1]) && x.id !== u.uid).map(x => x.id);
    const name = (getDoc('people/' + u.uid) || {}).name || 'Someone', doc = getDoc(p) || {};
    if (s[2] === 'favors' && op === 'set' && doc.status === 'open') for (const id of circleIds()) notify(id, `${name} asks a favor`, doc.what, 'fv:' + s[3], u.uid);
    if (s[2] === 'favors' && doc.status === 'done' && data.status === 'done') notify(doc.asker, `${name} did your favor`, `${doc.what} · confirm to log it`, 'fv:' + s[3], u.uid);
    if (s[2] === 'dares' && op === 'set' && doc.to) notify(doc.to, `${name} dared you`, doc.text, 'dare:' + s[3], u.uid);
    return;
  }
  if (op !== 'set' || s[s.length - 2] !== 'msgs') return;
  const by = data.by, text = String(data.text || '').slice(0, 90), name = data.name || 'Someone';
  if (s[0] === 'circles' && s[2] === 'threads') {
    const t = getDoc(s.slice(0, 4).join('/')); if (!t || t.muted) return;
    const ids = q.kids.all('people').map(r => ({ id: r.path.split('/')[1], d: JSON.parse(r.data) })).filter(x => inCircle(x.d, s[1]) && x.id !== by);
    const going = t.kind === 'plan' ? t.going || {} : null;
    for (const x of ids) if (!going || going[x.id]) notify(x.id, `${name} in ${t.title}`, text, 't:' + s[3], by);
  } else if (s[0] === 'rooms') {
    const r = getDoc('rooms/' + s[1]); if (!r) return;
    for (const row of q.kids.all('people')) { const d = JSON.parse(row.data), id = row.path.split('/')[1]; if (id !== by && r.circles.some(c => inCircle(d, c))) notify(id, `${name} · ${r.title}`, text, 'r:' + s[1], by); }
  } else if (s[0] === 'dms') {
    for (const id of s[1].split('__')) if (id !== by) notify(id, name, text, 'd:' + s[1], by);
  }
}
// Once a minute: Midnight messages going out, drops opening in 15 minutes near people.
let lastSweep = now();
setInterval(sweep, 20000).unref();
function sweep() {
  const t = now(), from = lastSweep; lastSweep = t; const before = pushLog.length;
  for (const c of q.kids.all('circles')) {
    const cid = c.path.split('/')[1];
    const out = q.kids.all(`circles/${cid}/midnight`).map(r => JSON.parse(r.data)).filter(m => m.releaseAt > from && m.releaseAt <= t);
    if (out.length) for (const row of q.kids.all('people')) { const d = JSON.parse(row.data); if (inCircle(d, cid)) notify(row.path.split('/')[1], 'Midnight', `${out.length} unsigned message${out.length > 1 ? 's' : ''} just went out in your circle.`, 'midnight'); }
  }
  const gone = [];
  for (const c of q.kids.all('circles')) for (const r of q.kids.all(c.path + '/clips')) if (JSON.parse(r.data).exp < t) { q.del.run(r.path); gone.push(r.path); }
  if (gone.length) touched(gone);
  const people = q.kids.all('people').map(r => ({ id: r.path.split('/')[1], d: JSON.parse(r.data) }));
  const revealed = [];
  for (const row of q.kids.all('drops')) { // a closed drop's draw seed goes into the drop itself, so every open view gets it
    const d = JSON.parse(row.data); if (!d.seedHash || d.seed || d.end > t) continue;
    const seed = dropSeed(row.path.split('/')[1]); if (seed) { putDoc(row.path, { ...d, seed }); revealed.push(row.path); }
  }
  if (revealed.length) touched(revealed);
  for (const row of q.kids.all('drops')) {
    const d = JSON.parse(row.data), soon = d.start - 15 * MIN;
    if (soon > from && soon <= t) for (const x of people) {
      const c = x.d.cell; if (!c || x.id === d.host) continue;
      if (km([c.lat, c.lon], [d.lat, d.lon]) <= (x.d.radius || 5)) notify(x.id, `${d.venue} opens in 15 min`, `${d.prize} · ${km([c.lat, c.lon], [d.lat, d.lon]).toFixed(1)} km away`, 'drop:' + row.path.split('/')[1]);
    }
  }
  return { from, to: t, notes: pushLog.length - before, clipsGone: gone.length };
}
// Push time-bound subscriptions (Midnight, sealed, pair codes) whose answer changed with the clock.
function pushTimeBound() { for (const c of clients.values()) for (const [id, sub] of c.subs) if (timeBound(sub.spec.doc || sub.spec.col)) pushSub(c, id, sub); }
function km(a, b) { const r = x => x * Math.PI / 180, dLat = r(b[0] - a[0]), dLon = r(b[1] - a[1]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dLon / 2) ** 2; return 2 * 6371 * Math.asin(Math.sqrt(h)); }

/* ---------- safety and account (WS-D): server/moderation.js, server/account.js ---------- */
const CTX = { db, q, getDoc, putDoc, parentOf, kv, sha, rid, now: () => now(), isOwner, Refuse, touched, refreshUser, endStreams, limited, sendMail, cookie: (v, a) => cookie(v, a), DEV, PUBLIC_URL };
const SAFE = require('./moderation')(CTX);
const ACC = require('./account')(CTX, SAFE);

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
const TYPES = { '.pmtiles': 'application/octet-stream', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.tsv': 'text/tab-separated-values; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const gzCache = new Map();
function sendFile(req, res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(file), type = TYPES[ext] || 'application/octet-stream';
    const etag = `"${st.size}-${st.mtimeMs}"`;
    // content-hashed files (data/places/<key>.<hash>.tsv) never change: cache them for a year (C81)
    const immutable = /\.[0-9a-f]{10}\.tsv$/.test(file);
    const h = { 'content-type': type, etag, 'cache-control': ext === '.html' || file.endsWith('sw.js') || file.endsWith('index.json') ? 'no-cache' : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=86400', 'x-content-type-options': 'nosniff' };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
    // PMTiles are read by byte range, one directory or tile at a time
    const rg = ext === '.pmtiles' && /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (ext === '.pmtiles') h['accept-ranges'] = 'bytes';
    if (rg) {
      const a = +rg[1], b = Math.min(st.size - 1, rg[2] ? +rg[2] : st.size - 1);
      if (a > b) { res.writeHead(416, { 'content-range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...h, 'content-range': `bytes ${a}-${b}/${st.size}`, 'content-length': b - a + 1 });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
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
  if (+req.headers['content-length'] > MAX_BODY) return Promise.reject(new Refuse('payload_too_large', 'Too big.'));
  return new Promise((ok, bad) => { let n = 0; const parts = []; req.on('data', c => { n += c.length; if (n > MAX_BODY) { bad(new Refuse('payload_too_large', 'Too big.')); req.destroy(); } else parts.push(c); }); req.on('end', () => { try { ok(parts.length ? JSON.parse(Buffer.concat(parts)) : {}); } catch (e) { bad(new Refuse('invalid_argument', 'Bad JSON.')); } }); });
}
const validPath = (p, even) => typeof p === 'string' && p.length <= 1000 && /^[A-Za-z0-9_\-:.@]+(\/[A-Za-z0-9_\-:.@]+)*$/.test(p) && (p.split('/').length % 2 === 0) === even && !p.split('/').some(x => x === '.' || x === '..');
const cookie = (v, age) => `insane_s=${v}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${SECURE ? '; Secure' : ''}`;

async function api(req, res, url) {
  const u = userFromReq(req), r = url.pathname.slice(5);
  if (req.method === 'GET' && r === 'health') { const n = db.prepare('SELECT COUNT(*) n FROM docs').get().n; return json(res, 200, { ok: true, build: BUILD_ID, schema: MIGRATION.sql[1], store: MIGRATION.store.to, docs: n }); }
  if (req.method === 'GET' && r === 'hello') {
    if (u) dayOneReturn(u);
    return json(res, 200, { insane: true, version: '0.8', build: BUILD_ID, minBuild: MIN_CLIENT_BUILD || null, google: GOOGLE_CLIENT_ID || null, signedIn: !!u, uid: u?.uid || null, email: u?.email || null, isOwner: isOwner(u), tiles: TILE_URL, attr: TILE_ATTR, tileKind: TILE_KIND, tileDark: TILE_DARK, tileMaxZ: TILE_MAXZ, vapid: vapidPublic, dev: DEV, now: now(), consent: SAFE.CONSENT_VERSION });
  }
  if (req.method === 'GET' && r === 'stream') {
    if (!u) return json(res, 401, { code: 'unauthenticated' });
    const cid = url.searchParams.get('cid') || rid();
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
    res.write('retry: 2000\n\n');
    let c = clients.get(cid); if (!c || c.uid !== u.uid) { c = { uid: u.uid, res: null, subs: new Map() }; clients.set(cid, c); }
    c.res = res; c.sess = u.sess; for (const [id, sub] of c.subs) pushSub(c, id, sub, true);
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
  // Place search and areas (C81): server mode never sends the town list to phones. Open to signed-out pages
  // (the picker can run before sign-in), rate-limited per address.
  if (req.method === 'GET' && (r === 'places' || r === 'place' || r === 'place/guess')) {
    if (limited('places:' + (u ? u.uid : req.socket.remoteAddress), 120, MIN)) return json(res, 429, { code: 'resource_exhausted' });
    if (r === 'places') return json(res, 200, { results: geo.search(url.searchParams.get('q') || '', +url.searchParams.get('n') || 8) });
    if (r === 'place/guess') return json(res, 200, geo.guess(url.searchParams.get('tz') || '', req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || ''));
    const lat = +url.searchParams.get('lat'), lon = +url.searchParams.get('lon');
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json(res, 400, { code: 'invalid_argument' });
    return json(res, 200, geo.info(lat, lon));
  }
  if (req.method === 'GET' && r === 'notes/latest') {
    if (!u) return json(res, 401, { code: 'unauthenticated' });
    const box = getDoc(`data/users/${u.uid}/inbox`) || { items: [] };
    return json(res, 200, box.items[0] || { title: 'INSANE', body: 'Something new.' });
  }
  // C11: the public invite preview (WS-I's route, WS-B's contract): only the circle's name, its size and the
  // creator's first name, never ids, places or other members' names. Rate-limited per address (C84 'invite').
  if (req.method === 'GET' && r.startsWith('invite/')) {
    rate('invite', clientIp(req));
    const code = r.slice(7).toUpperCase();
    const cd = /^[A-Z0-9]{4,12}$/.test(code) && getDoc('codes/' + code), circle = cd && cd.cid && getDoc('circles/' + cd.cid);
    if (!circle) return json(res, 404, { code: 'not_found', message: 'No circle has that code.' });
    const count = q.kids.all('people').filter(x => inCircle(JSON.parse(x.data), cd.cid)).length || (Array.isArray(circle.members) ? circle.members.length : 0);
    const by = String((getDoc('people/' + circle.by) || {}).name || '').trim().split(/\s+/)[0].slice(0, 24);
    return json(res, 200, { name: String(circle.name || '').slice(0, 28), count, max: 8, by: by || null }, { 'cache-control': 'no-store' });
  }
  // C25: what this person has unlocked in their (primary or ?circle=) circle.
  if (req.method === 'GET' && r === 'unlocks') {
    if (!u) return json(res, 401, { code: 'unauthenticated' });
    return json(res, 200, unlocksFor(u, url.searchParams.get('circle')));
  }
  // C101: the owner's funnel view (aggregate counts only).
  if (req.method === 'GET' && r === 'funnel') {
    if (!isOwner(u)) return json(res, 403, { code: 'permission_denied' });
    return json(res, 200, funnel.report(+url.searchParams.get('days') || 30));
  }
  if (DEV && req.method === 'GET' && r === 'dev/outbox') { const row = db.prepare('SELECT sent FROM otps WHERE email=?').get((url.searchParams.get('email') || '').toLowerCase()); return json(res, 200, { mail: row ? JSON.parse(row.sent) : null }); }
  if (DEV && req.method === 'GET' && r === 'dev/pushlog') return json(res, 200, { log: pushLog });
  // DEV only, for tests: this week's answer for a city (what the legacy e2e used to read out of the page)
  if (DEV && req.method === 'GET' && r === 'dev/decode') { const city = url.searchParams.get('city') || '', week = url.searchParams.get('week') || ''; const p = CONTENT.puzzleFor(city, week); return json(res, 200, { city, week, id: p && p.id, answer: p && p.a }); }
  if (req.method === 'GET' && r === 'decode') {
    if (!u) return json(res, 401, { code: 'unauthenticated' });
    const me = getDoc('people/' + u.uid) || {}, week = String(url.searchParams.get('week') || '');
    return json(res, 200, CONTENT.decodeView(me, week, solvesIn(me.city, week)));
  }
  if (req.method === 'GET' && r === 'content') { if (!u) return json(res, 401, { code: 'unauthenticated' }); return json(res, 200, CONTENT.publicLists()); }
  if (req.method === 'GET' && r === 'admin/content') { if (!isOwner(u)) return json(res, 403, { code: 'permission_denied', message: 'Owner only.' }); return json(res, 200, CONTENT.admin.list()); }
  if (req.method !== 'POST') return json(res, 405, { code: 'invalid_argument' });
  const b = await body(req);
  if (r === 'funnel') { // C101: {step, anon?}; counted once per person (uid or anon browser id) per day
    rate('funnel', clientIp(req));
    return json(res, 200, { ok: true, counted: funnel.count(String(b.step || ''), u ? u.uid : (typeof b.anon === 'string' ? b.anon.slice(0, 64) : null)) });
  }
  if (r === 'err') { // C98: browser errors, scrubbed and forwarded to Sentry (a no-op without SENTRY_DSN)
    rate('err', clientIp(req));
    sentry.captureClient(b);
    return json(res, 200, { ok: true, sent: sentry.enabled });
  }
  if (r === 'auth/google') { // C14: Google Sign-In, only when GOOGLE_CLIENT_ID is set
    if (!GOOGLE_CLIENT_ID) throw new Refuse('failed_precondition', 'Google sign-in isn’t set up here.');
    rate('auth', clientIp(req));
    const email = await googleEmail(String(b.credential || ''));
    return json(res, 200, { ok: true, uid: signIn(email).uid }, { 'set-cookie': cookie(signIn.tok, 60 * 86400) });
  }
  if (r === 'auth/start') {
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) throw new Refuse('invalid_argument', 'That doesn’t look like an email address.');
    const ip = req.socket.remoteAddress;
    if (limited('otp:' + email, 4, 10 * MIN) || limited('otpip:' + ip, 30, HOUR)) throw new Refuse('resource_exhausted', 'Too many codes. Wait a few minutes.');
    const code = String(crypto.randomInt(100000, 1000000));
    const text = `Your INSANE sign-in code is ${code}\n\nIt works for 10 minutes. If you didn’t ask for it, ignore this email.\n\n${PUBLIC_URL}`;
    db.prepare('INSERT INTO otps(email,hash,exp,tries,sent) VALUES(?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET hash=excluded.hash,exp=excluded.exp,tries=0,sent=excluded.sent').run(email, sha(email + code), Date.now() + 10 * MIN, JSON.stringify(DEV ? { to: email, subject: 'Your INSANE code: ' + code, text, at: Date.now() } : { at: Date.now() }));
    const how = await sendMail(email, 'Your INSANE code: ' + code, text);
    funnel.count('email', email);
    return json(res, 200, { ok: true, how });
  }
  if (r === 'auth/verify') {
    const email = String(b.email || '').trim().toLowerCase(), code = String(b.code || '').replace(/\D/g, '');
    const row = db.prepare('SELECT hash,exp,tries FROM otps WHERE email=?').get(email);
    if (!row || row.exp < Date.now() || row.tries >= 5) throw new Refuse('failed_precondition', 'That code has expired. Ask for a new one.');
    if (row.hash !== sha(email + code)) { db.prepare('UPDATE otps SET tries=tries+1 WHERE email=?').run(email); throw new Refuse('failed_precondition', 'That code isn’t right. Check the email again.'); }
    db.prepare('DELETE FROM otps WHERE email=?').run(email);
    const user = signIn(email);
    funnel.count('code', user.uid);
    return json(res, 200, { ok: true, uid: user.uid }, { 'set-cookie': cookie(signIn.tok, 60 * 86400) });
  }
  if (r === 'auth/logout') {
    const m = /(?:^|;\s*)insane_s=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '');
    if (m) db.prepare('DELETE FROM sessions WHERE hash=?').run(sha(m[1]));
    return json(res, 200, { ok: true }, { 'set-cookie': cookie('', 0) });
  }
  if (DEV && r === 'dev/clock') { clockOffset = +b.offset || 0; pushTimeBound(); return json(res, 200, { now: now() }); } // time-bound views (Midnight, sealed) follow the jump at once
  if (DEV && r === 'dev/tick') { // PLAN §5.0: run the sweep now (Midnight release, drop reminders, clip expiry) and push what the clock changed
    if ('offset' in b) clockOffset = +b.offset || 0;
    const swept = sweep(); pushTimeBound();
    return json(res, 200, { now: now(), ...swept });
  }
  if (!u) throw new Refuse('unauthenticated', 'Sign in first.');
  if (r.startsWith('account/')) { const out = await ACC.route(r, b, u, req); if (out) return json(res, 200, out.body, out.headers || {}); }
  { const out = SAFE.route(r, b, u); if (out) return json(res, 200, out); }
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
  if (r === 'decode/solve') {
    const p = 'solves/' + String(b.week || '') + '_' + u.uid;
    if (!validPath(p, true)) throw new Refuse('invalid_argument', 'Bad week.');
    if (getDoc(p)) throw new Refuse('permission_denied', 'One solve each.');
    if (limited('dec:' + u.uid, 30, 10 * MIN)) throw new Refuse('resource_exhausted', 'Too many tries. Give it a few minutes.');
    const d = solveDoc(u, b); putDoc(p, d); touched([p]);
    return json(res, 200, { ok: true, rank: solvesIn(d.city, d.week), hints: d.hints });
  }
  if (r.startsWith('admin/content/')) {
    if (!isOwner(u)) throw new Refuse('permission_denied', 'Owner only.');
    const a = r.slice(14), A = CONTENT.admin;
    if (a === 'check') return json(res, 200, A.check(b.kind, b.item || {}));
    if (a === 'save') { const x = A.save(b.kind, b.item || {}); if (x.ok && b.kind === 'drop' && b.publish) x.published = publishDrop(x.item, u); return json(res, x.ok ? 200 : 400, x); }
    if (a === 'remove') return json(res, 200, A.remove(b.kind, b.id));
    if (a === 'restore') return json(res, 200, A.restore(b.kind, b.id));
    if (a === 'preview') return json(res, 200, { city: b.city, weeks: A.preview(String(b.city || ''), b.n) });
    return json(res, 404, { code: 'not_found' });
  }
  if (r === 'unsub') { const c = clients.get(b.cid); if (c && c.uid === u.uid) c.subs.delete(b.sub); return json(res, 200, { ok: true }); }
  if (r === 'get') { if (!validPath(b.path, true)) throw new Refuse('invalid_argument', 'Bad path.'); return json(res, 200, { doc: readDoc(b.path, u) }); }
  if (r === 'query') { if (!validPath(b.col, false)) throw new Refuse('invalid_argument', 'Bad path.'); return json(res, 200, { docs: runQuery(b, u) }); }
  if (['set', 'update', 'delete'].includes(r)) { doWrite(r, b, u, true, req); return json(res, 200, { ok: true }); }
  return json(res, 404, { code: 'not_found' });
}
// One write, the way /api/set|update|delete does it. Exported (without the rate limit) for the in-process rule tests.
function doWrite(r, b, u, limit, req) {
  {
    if (!validPath(b.path, true)) throw new Refuse('invalid_argument', 'Bad path.');
    if (!canWrite(b.path, u)) throw new Refuse('permission_denied', 'Not yours to change.');
    if (limit) { rate('write', u.uid); rate('writeIp', clientIp(req)); } // in-process rule tests pass limit=false and no req
    let data = r === 'delete' ? null : b.data;
    if (limit) { const exists = r === 'set' && !!q.get.get(b.path); for (const cls of writeClasses(r, b.path, data, exists)) rate(cls, u.uid); }
    if (r !== 'delete' && (!data || typeof data !== 'object' || Array.isArray(data))) throw new Refuse('invalid_argument', 'Data must be an object.');
    data = beforeWrite(r, b.path, data, u);
    if (r === 'delete') q.del.run(b.path);
    else if (r === 'set') { if (q.count.get().n > 200000) throw new Refuse('quota_exceeded', 'Storage is full.'); putDoc(b.path, data); }
    else { const old = getDoc(b.path); if (!old) throw new Refuse('invalid_argument', 'Document does not exist'); putDoc(b.path, merge(old, data)); }
    touched([b.path]);
    try { afterWrite(r, b.path, data, u); } catch (e) { console.warn('afterWrite', e); }
    try { funnelWrite(r, b.path, data, u); } catch (e) { /* counts never block a write */ }
  }
}

// A seed drop from /admin/content becomes a real drop, hosted by the owner, with the same commit-reveal draw.
function publishDrop(it, u) {
  const p = 'drops/' + it.id, old = getDoc(p);
  if (old) return { id: it.id, already: true };
  const code = Array.from(crypto.randomBytes(6), x => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
  const r = x => Math.round(x * 1e6) / 1e6;
  const gOf = (lat, lon, s = 25) => { const iy = Math.floor(lat * 111.32 / s), latC = (iy * s / 111.32 + (iy + 1) * s / 111.32) / 2, kl = 111.32 * Math.max(.05, Math.cos(latC * Math.PI / 180)); return s + ':' + iy + ':' + Math.floor(lon * kl / s); }; // = the page's gOf (10-places.js cellOf)
  const data = beforeWrite('set', p, { city: it.city, lat: r(it.lat), lon: r(it.lon), g: gOf(it.lat, it.lon), venue: String(it.venue).slice(0, 40), addr: String(it.addr || '').slice(0, 80), kind: it.kind, prize: String(it.prize).slice(0, 60), dare: it.kind === 'dare' ? String(it.dare || '').slice(0, 80) : '', item: it.kind === 'swap' ? String(it.prize).slice(0, 60) : '', swaps: [], start: it.start, end: it.start + it.len * MIN, hostName: 'INSANE', code, at: now(), seeded: true }, u);
  putDoc(p, data); touched([p]);
  return { id: it.id, code };
}
// The page the server hands out has no local Decode pack at all (not even hashed): in server mode the
// clue comes from /api/decode and the answer stays here. The pasteable app/index.html keeps its sealed
// pack for claude.ai and local mode (C86).
const LOCAL_PACK = /\/\*@decode-local\*\/[\s\S]*?\/\*@end-decode-local\*\//;
let indexCache = null;
function sendIndex(req, res) {
  const file = path.join(ROOT, 'index.html');
  fs.stat(file, (err, st) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const key = st.size + '-' + st.mtimeMs;
    if (!indexCache || indexCache.key !== key) {
      const html = fs.readFileSync(file, 'utf8').replace(LOCAL_PACK, 'const DECODE_LOCAL=null;');
      const buf = Buffer.from(html); indexCache = { key, buf, gz: zlib.gzipSync(buf), etag: '"' + sha(html).slice(0, 20) + '"' };
    }
    const h = { 'content-type': 'text/html; charset=utf-8', etag: indexCache.etag, 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' };
    if (req.headers['if-none-match'] === indexCache.etag) { res.writeHead(304, h); return res.end(); }
    const gz = /gzip/.test(req.headers['accept-encoding'] || ''), b = gz ? indexCache.gz : indexCache.buf;
    res.writeHead(200, { ...h, ...(gz ? { 'content-encoding': 'gzip' } : {}), 'content-length': b.length });
    res.end(req.method === 'HEAD' ? undefined : b);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  for (const k in SEC) res.setHeader(k, SEC[k]); // C85
  try {
    if (url.pathname.startsWith('/api/')) { res.setHeader('x-insane-build', BUILD_ID); if (MIN_CLIENT_BUILD) res.setHeader('x-insane-min-build', MIN_CLIENT_BUILD); return await api(req, res, url); }
    if (url.pathname === '/' || url.pathname === '/index.html') return sendIndex(req, res); // WS-E: served without the local Decode pack
    if (url.pathname === '/admin/content') return sendFile(req, res, path.join(__dirname, 'admin', 'content.html')); // owner tool; its API checks the owner
    if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (url.pathname === '/sw.js') return sendFile(req, res, path.join(__dirname, 'public', 'sw.js'));
    if (/^\/(manifest\.webmanifest|icon\.svg|icon-(192|512|maskable-512)\.png|apple-touch-icon(-precomposed)?\.png)$/.test(url.pathname)) return sendFile(req, res, path.join(__dirname, 'public', url.pathname.slice(1).replace('-precomposed', ''))); // WS-A hook (C02): PNG icons
    { const m = /^\/legal\/(terms|privacy|rules)(\.html)?$/.exec(url.pathname); if (m) return sendFile(req, res, path.join(ROOT, 'legal', m[1] + '.html')); }
    if (url.pathname === '/data/basemap.pmtiles') return sendFile(req, res, TILE_FILE);
    const f = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!f.startsWith(path.join(ROOT, 'data') + path.sep)) { res.writeHead(404); return res.end('Not found'); }
    return sendFile(req, res, f);
  } catch (e) {
    if (e instanceof Refuse) return json(res, { unauthenticated: 401, permission_denied: 403, resource_exhausted: 429, payload_too_large: 413, not_found: 404 }[e.code] || 400, { code: e.code, message: e.message, ...(e.reason ? { reason: e.reason } : {}) }, e.retryMs ? { 'retry-after': String(Math.ceil(e.retryMs / 1000)) } : {});
    console.error(e); sentry.captureException(e, { tags: { route: url.pathname.slice(0, 40) } });
    if (res.headersSent) return res.end();
    return json(res, 500, { code: 'internal', message: 'Something broke on the server.' });
  }
});
/* ---------- v0.9 helpers: sign-in, unlocks, funnel, backups, crash reports ---------- */
// One session for an email, creating the user on first sign-in. signIn.tok holds the new cookie token.
function signIn(email) {
  let user = db.prepare('SELECT uid,email FROM users WHERE email=?').get(email);
  if (!user) { user = { uid: 'u_' + rid(14), email }; db.prepare('INSERT INTO users(uid,email,created) VALUES(?,?,?)').run(user.uid, email, Date.now()); }
  const tok = rid(40); signIn.tok = tok;
  db.prepare('INSERT INTO sessions(hash,uid,exp) VALUES(?,?,?)').run(sha(tok), user.uid, Date.now() + 60 * DAY);
  return user;
}
// C14: check a Google ID token with Google's tokeninfo endpoint (GOOGLE_TOKENINFO_URL is for tests).
async function googleEmail(cred) {
  if (!/^[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(cred) || cred.length > 4096) throw new Refuse('invalid_argument', 'That Google sign-in didn’t come through.');
  let t;
  try { const r = await fetch((ENV.GOOGLE_TOKENINFO_URL || 'https://oauth2.googleapis.com/tokeninfo') + '?id_token=' + encodeURIComponent(cred)); t = r.ok ? await r.json() : null; } catch (e) { t = null; }
  if (!t) throw new Refuse('failed_precondition', 'Google didn’t accept that sign-in. Try again.');
  const ok = t.aud === GOOGLE_CLIENT_ID && ['accounts.google.com', 'https://accounts.google.com'].includes(t.iss) && (t.email_verified === true || t.email_verified === 'true') && +t.exp * 1000 > Date.now() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t.email || '');
  if (!ok) throw new Refuse('permission_denied', 'That Google sign-in isn’t for this app.');
  return String(t.email).toLowerCase();
}
// C25: the inputs for unlocks() from the store. Peak size is kept so a feature never locks again.
function unlocksFor(u, want) {
  const me = getDoc('people/' + u.uid) || {}, cids = Array.isArray(me.circles) && me.circles.length ? me.circles : me.circle ? [me.circle] : [];
  const cid = want && cids.includes(want) ? want : cids[0] || null, c = cid ? getDoc('circles/' + cid) : null;
  const members = c && Array.isArray(c.members) ? c.members.length : cid ? 1 : 0;
  const peakKey = 'peak:' + cid, peak = Math.max(members, cid ? kv.get(peakKey) || 0 : 0); if (cid && peak > (kv.get(peakKey) || 0)) kv.set(peakKey, peak);
  const user = db.prepare('SELECT created FROM users WHERE uid=?').get(u.uid), joined = me.joined || (user && user.created) || now();
  const met = q.kids.all('met').some(r => r.path.split('/')[1].split('__').includes(u.uid));
  const plans = cid ? q.kids.all(`circles/${cid}/threads`).filter(r => JSON.parse(r.data).kind === 'plan').length : 0;
  const inputs = { members, maxMembers: peak, days: Math.floor((now() - joined) / DAY), met, plans };
  return { circle: cid, inputs, ...unlocks(inputs) };
}
// C101: the counts the server can see for itself; the rest the client posts to /api/funnel.
function dayOneReturn(u) {
  const row = db.prepare('SELECT created FROM users WHERE uid=?').get(u.uid); if (!row || !row.created) return;
  const d = Date.now() - row.created; if (d >= DAY && d < 2 * DAY) funnel.count('day1_return', u.uid);
}
function funnelWrite(op, p, data, u) {
  const s = p.split('/'); if (op === 'delete') return;
  if (s[0] === 'people' && s.length === 2 && s[1] === u.uid) {
    if (op === 'set' && data.name) { funnel.count('name', u.uid); if (data.cell || data.city) funnel.count('place', u.uid); }
    if (data.circle) { const c = getDoc('circles/' + data.circle); if (c && c.by && c.by !== u.uid) funnel.count('invite_joined', u.uid); }
  }
  if (s[0] === 'circles' && s.length === 2 && op === 'set') funnel.count('circle', u.uid);
}
// C97: snapshot every BACKUP_EVERY_H hours (default 24; 0 turns it off), to BACKUP_DIR and the bucket if set.
const BACKUP_EVERY_H = ENV.BACKUP_EVERY_H === undefined ? (DEV ? 0 : 24) : +ENV.BACKUP_EVERY_H;
if (BACKUP_EVERY_H > 0) setInterval(() => backupNow(db, DB_FILE).then(r => console.log('[backup]', JSON.stringify(r))).catch(e => { console.error('[backup] failed', e.message); sentry.captureException(e, { tags: { job: 'backup' } }); }), BACKUP_EVERY_H * HOUR).unref();
process.on('uncaughtException', e => { console.error(e); sentry.captureException(e, { tags: { fatal: 'uncaught' } }).finally(() => process.exit(1)); });
process.on('unhandledRejection', e => { console.error(e); sentry.captureException(e, { tags: { fatal: 'rejection' } }); });

module.exports = { server, doWrite, userById, getDoc, putDoc, readDoc, runQuery, beforeWrite, canRead, canWrite, merge, db, q, kv, SAFE, ACC, Refuse, setClock: off => { clockOffset = off; }, now: () => now() };
if (require.main === module || ENV.LISTEN === '1') setImmediate(() => { try { geo.load(); } catch (e) { console.error('places:', e.message); } }); // WS-F: parse the town list before the first search (it loads lazily otherwise)
if (require.main === module || ENV.LISTEN === '1') server.listen(PORT, () => console.log(`INSANE on ${PUBLIC_URL} (port ${PORT})${DEV ? ' [dev: codes in /api/dev/outbox, movable clock]' : ''}`));
