// Versioned migrations (C83, PLAN-V09 §8), no dependencies. Two layers:
//  1. SQL schema: PRAGMA user_version, one ordered step per version (tables the server itself needs).
//  2. The document store: a `meta/schema` doc {version}. Each step is an ordered, idempotent function over a
//     small store interface, so the same steps can run on SQLite here and, ported, on the claude.ai shared
//     store (artifact mode, PLAN §8). Running a step twice changes nothing and never loses a doc.
// On boot the server runs both inside one transaction, after a `VACUUM INTO backup-pre-v<N>.db` snapshot
// when there is data to protect. Rollback = stop v0.9, restore that file, deploy the v0.8 tag.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validTz, DEFAULT_TZ } = require('./tz');

const SCHEMA = [
  // 1: v0.8's tables, as v0.8 created them (CREATE IF NOT EXISTS, so a v0.8 file passes straight through)
  `CREATE TABLE IF NOT EXISTS docs(path TEXT PRIMARY KEY, parent TEXT NOT NULL, data TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS docs_parent ON docs(parent);
   CREATE TABLE IF NOT EXISTS users(uid TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, created INTEGER);
   CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, uid TEXT NOT NULL, exp INTEGER);
   CREATE TABLE IF NOT EXISTS otps(email TEXT PRIMARY KEY, hash TEXT, exp INTEGER, tries INTEGER, sent TEXT);
   CREATE TABLE IF NOT EXISTS push(endpoint TEXT PRIMARY KEY, uid TEXT NOT NULL, sub TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);`,
  // 2: v0.9: server-only content (never served as a doc), first-party funnel counts, and the daily-salted
  //    dedupe set that lets a count be "people" rather than "taps" without storing who.
  `CREATE TABLE IF NOT EXISTS server_content(k TEXT PRIMARY KEY, v TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS funnel(day TEXT NOT NULL, step TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, step));
   CREATE TABLE IF NOT EXISTS funnel_seen(day TEXT NOT NULL, h TEXT NOT NULL, PRIMARY KEY(day, h));`,
];
const SCHEMA_VERSION = SCHEMA.length;

const STORE_VERSION = 9;
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
const ANSWER_COLS = /^(solves|decode|puzzles)$|^circles\/[^/]+\/(decode|puzzles)$/;

// Store steps. `st` is { list(col) → [{path, data}], get(path), put(path, data), users() → [uid], content(k, v) }.
// Each returns how many docs it changed (0 on a second run).
const STEPS = [
  { v: 9, id: 'people.circles', what: 'people/{uid}.circle → circles: [cid] (circle kept as primary for one release)', run(st) {
    let n = 0;
    for (const { path: p, data: d } of st.list('people')) {
      if (!isObj(d)) continue;
      const cs = Array.isArray(d.circles) ? d.circles.filter(x => typeof x === 'string' && x) : [];
      if (d.circle && !cs.includes(d.circle)) cs.unshift(d.circle);
      const next = [...new Set(cs)];
      if (!Array.isArray(d.circles) || JSON.stringify(next) !== JSON.stringify(d.circles)) { st.put(p, { ...d, circles: next }); n++; }
    }
    return n;
  } },
  { v: 9, id: 'circles.roles', what: 'add roles to each circle (creator → admin)', run(st) {
    let n = 0;
    for (const { path: p, data: d } of st.list('circles')) {
      if (!isObj(d) || isObj(d.roles)) continue;
      const admin = d.by || (Array.isArray(d.members) ? d.members[0] : null);
      st.put(p, { ...d, roles: admin ? { [admin]: 'admin' } : {} }); n++;
    }
    return n;
  } },
  { v: 9, id: 'decode.answers', what: 'move Decode answers out of client-visible docs into server_content', run(st) {
    let n = 0;
    for (const col of st.collections().filter(c => ANSWER_COLS.test(c))) for (const { path: p, data: d } of st.list(col)) {
      if (!isObj(d) || !('answer' in d || 'ans' in d)) continue;
      const { answer, ans, ...rest } = d;
      st.content('answer:' + p, answer !== undefined ? answer : ans);
      st.put(p, rest); n++;
    }
    return n;
  } },
  { v: 9, id: 'consent.backfill', what: 'backfill data/users/{uid}/consent = {version: 0} (prompted on next open)', run(st) {
    let n = 0;
    for (const uid of st.users()) { const p = `data/users/${uid}/consent`; if (!st.get(p)) { st.put(p, { version: 0, at: null, backfilled: true }); n++; } }
    return n;
  } },
  { v: 9, id: 'circles.tz', what: 'add tz to each circle, from the creator’s last seen tz', run(st, { defaultTz = DEFAULT_TZ } = {}) {
    let n = 0;
    for (const { path: p, data: d } of st.list('circles')) {
      if (!isObj(d) || validTz(d.tz)) continue;
      const by = d.by ? st.get('people/' + d.by) : null, tz = by && validTz(by.tz) ? by.tz : defaultTz;
      st.put(p, { ...d, tz, tzFrom: by && validTz(by.tz) ? 'creator' : 'default' }); n++;
    }
    return n;
  } },
  { v: 9, id: 'drops.drawVersion', what: 'drops keep the legacy draw (drawVersion: 1)', run(st) {
    let n = 0;
    for (const { path: p, data: d } of st.list('drops')) if (isObj(d) && d.drawVersion === undefined) { st.put(p, { ...d, drawVersion: 1 }); n++; }
    return n;
  } },
];

// Run every store step above the store's version. Returns {from, to, changed: {id: n}}.
function migrateStore(st, opts = {}) {
  const meta = st.get('meta/schema'), from = meta && +meta.version || 8, changed = {};
  if (from >= STORE_VERSION) return { from, to: from, changed };
  for (const s of STEPS) if (s.v > from) changed[s.id] = s.run(st, opts);
  st.put('meta/schema', { version: STORE_VERSION, from, at: opts.at || Date.now(), steps: STEPS.filter(s => s.v > from).map(s => s.id) });
  return { from, to: STORE_VERSION, changed };
}

// The same steps over a plain {path: doc} object: used by tests and fit to port to artifact mode.
function memoryStore(docs = {}, uids = null, content = {}) {
  const parent = p => p.split('/').slice(0, -1).join('/');
  return {
    docs, content: (k, v) => { content[k] = v; }, contentMap: content,
    list: col => Object.keys(docs).filter(p => parent(p) === col).sort().map(p => ({ path: p, data: docs[p] })),
    collections: () => [...new Set(Object.keys(docs).map(parent))],
    get: p => docs[p] === undefined ? null : docs[p],
    put: (p, d) => { docs[p] = d; },
    users: () => uids || [...new Set(Object.keys(docs).filter(p => /^people\/[^/]+$/.test(p)).map(p => p.split('/')[1]))],
  };
}

function sqliteStore(db) {
  const get = db.prepare('SELECT data FROM docs WHERE path=?'), kids = db.prepare('SELECT path,data FROM docs WHERE parent=? ORDER BY path');
  const put = db.prepare('INSERT INTO docs(path,parent,data) VALUES(?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data');
  const sc = db.prepare('INSERT INTO server_content(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v');
  return {
    list: col => kids.all(col).map(r => ({ path: r.path, data: JSON.parse(r.data) })),
    collections: () => db.prepare('SELECT DISTINCT parent FROM docs').all().map(r => r.parent),
    get: p => { const r = get.get(p); return r ? JSON.parse(r.data) : null; },
    put: (p, d) => put.run(p, p.split('/').slice(0, -1).join('/'), JSON.stringify(d)),
    users: () => db.prepare('SELECT uid FROM users ORDER BY uid').all().map(r => r.uid),
    content: (k, v) => sc.run(k, JSON.stringify(v)),
  };
}

function schemaVersion(db) { return db.prepare('PRAGMA user_version').get().user_version; }
const hasTable = (db, t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);

// Boot-time entry point. Snapshot first if anything is about to change and there is data, then migrate in
// one transaction (a failure rolls everything back and the server refuses to start rather than half-migrate).
function migrate(db, { file, backupDir, log = console.log, at, defaultTz } = {}) {
  const sv = schemaVersion(db);
  const hadDocs = hasTable(db, 'docs') && db.prepare('SELECT COUNT(*) n FROM docs').get().n > 0;
  const metaRow = hadDocs ? db.prepare("SELECT data FROM docs WHERE path='meta/schema'").get() : null;
  const storeV = metaRow ? +JSON.parse(metaRow.data).version || 8 : (hadDocs ? 8 : 0);
  const needs = sv < SCHEMA_VERSION || (hadDocs && storeV < STORE_VERSION);
  let backup = null;
  if (needs && hadDocs && file && file !== ':memory:') {
    const dir = backupDir || path.dirname(file); fs.mkdirSync(dir, { recursive: true });
    backup = path.join(dir, `backup-pre-v${STORE_VERSION}.db`);
    if (fs.existsSync(backup)) backup = path.join(dir, `backup-pre-v${STORE_VERSION}-${Date.now()}.db`);
    db.exec(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
    log(`[migrate] snapshot before migrating: ${backup}`);
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    for (let v = sv; v < SCHEMA_VERSION; v++) db.exec(SCHEMA[v]);
    if (sv < SCHEMA_VERSION) db.exec(`PRAGMA user_version=${SCHEMA_VERSION}`);
    const r = migrateStore(sqliteStore(db), { at, defaultTz });
    db.exec('COMMIT');
    if (sv < SCHEMA_VERSION || r.to !== r.from) log(`[migrate] sql ${sv}→${SCHEMA_VERSION}, store v${r.from}→v${r.to} ${JSON.stringify(r.changed)}`);
    return { sql: [sv, SCHEMA_VERSION], store: r, backup };
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

module.exports = { migrate, migrateStore, memoryStore, sqliteStore, STEPS, SCHEMA, SCHEMA_VERSION, STORE_VERSION, schemaVersion };
