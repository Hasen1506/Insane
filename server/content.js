// INSANE server content (WS-E): Decode puzzle packs per city, daily-dare starters, Mole tasks and seed
// drops, plus the owner's additions and edits from /admin/content. Answers live here and in the DB
// only; nothing in this module is reachable through the document store (its tables aren't `docs`).
//
//   const content = require('./content')({ db, now, secret });
//   content.decodeView(person, week, nSolves)      what a member may see this week (clue, unlocked hints, answer once out)
//   content.checkSolve(person, week, answer, n)    {ok, hints} or {code, message}
//   content.publicLists()                          dares and Mole tasks for /api/content
//   content.admin.*                                owner-only list / save / remove / preview
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const C = require('./content-core');
const HINT_AT = [3, 8, 15], HINT_DAY = [1, 3, 5]; // the same as the client's 35-decode.js
const { DAY, HOUR } = C;

module.exports = function makeContent({ db, now = Date.now, secret = 'dev', dir = path.join(__dirname, 'content') }) {
  db.exec(`CREATE TABLE IF NOT EXISTS content_items(kind TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, at INTEGER, PRIMARY KEY(kind,id));
CREATE TABLE IF NOT EXISTS content_sched(kind TEXT NOT NULL, scope TEXT NOT NULL, period TEXT NOT NULL, id TEXT NOT NULL, at INTEGER, PRIMARY KEY(kind,scope,period));`);
  const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const SEED = { puzzles: read('puzzles.json'), dares: read('dares.json').dares, mole: read('mole.json').tasks, drops: read('drops.json').drops };
  const q = {
    items: db.prepare('SELECT id,data FROM content_items WHERE kind=?'),
    put: db.prepare('INSERT INTO content_items(kind,id,data,at) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,at=excluded.at'),
    del: db.prepare('DELETE FROM content_items WHERE kind=? AND id=?'),
    sched: db.prepare('SELECT id FROM content_sched WHERE kind=? AND scope=? AND period=?'),
    hist: db.prepare('SELECT period,id FROM content_sched WHERE kind=? AND scope=? ORDER BY period'),
    putSched: db.prepare('INSERT OR IGNORE INTO content_sched(kind,scope,period,id,at) VALUES(?,?,?,?,?)'),
    recent: db.prepare('SELECT scope,period,id FROM content_sched WHERE kind=? ORDER BY period DESC LIMIT ?'),
  };
  // owner rows: {…item} adds or replaces the seed item with that id; {off:true} hides it
  const owner = kind => new Map(q.items.all(kind).map(r => [r.id, JSON.parse(r.data)]));
  const mergeList = (seed, kind, key = 'id') => {
    const o = owner(kind), out = [];
    for (const s of seed) { const k = String(s[key]); const x = o.get(k); if (x && x.off) continue; out.push(x ? { ...x, source: 'edited' } : { ...s, source: 'seed' }); o.delete(k); }
    for (const [, x] of o) if (!x.off) out.push({ ...x, source: 'owner' });
    return out;
  };
  function packs() {
    const ps = mergeList(SEED.puzzles.packs.map(p => ({ id: p.id, name: p.name, cities: p.cities })), 'pack');
    const all = mergeList(SEED.puzzles.packs.flatMap(p => p.puzzles.map(z => ({ ...z, pack: p.id }))), 'puzzle');
    return ps.map(p => ({ ...p, puzzles: all.filter(z => z.pack === p.id) }));
  }
  const packFor = city => C.packFor(packs(), city);
  const dares = () => mergeList(SEED.dares, 'dare');
  const mole = () => mergeList(SEED.mole.map(m => ({ ...m, id: String(m.i) })), 'mole').sort((a, b) => a.i - b.i);
  const moleN = i => { const m = mole().find(x => x.i === +i); return m ? m.n : 1; };

  /* ---------- which puzzle a city gets in a week: no repeats until its pack is used up ---------- */
  const rng = (...k) => C.mulberry(crypto.createHmac('sha256', String(secret)).update(k.join('|')).digest().readUInt32BE(0));
  function choose(city, week, hist) {
    const pack = packFor(city), all = pack.puzzles;
    if (!all.length) return null;
    const pinned = all.filter(p => p.week === week && (!p.city || p.city === city));
    if (pinned.length) return pinned.sort((a, b) => a.id < b.id ? -1 : 1)[0];
    const pool = all.filter(p => !(p.week && p.week > week)).map(p => p.id).sort(); // a puzzle pinned to a later week waits for it
    const ids = pool.length ? pool : all.map(p => p.id).sort();
    let used = new Set(), last = null;
    for (const h of hist) { last = h.id; if (ids.includes(h.id)) used.add(h.id); if (ids.every(x => used.has(x))) used = new Set(); }
    let left = ids.filter(x => !used.has(x));
    if (left.length > 1 && !used.size && last) left = left.filter(x => x !== last); // a fresh cycle never opens with last week's
    const id = left[Math.floor(rng('decode', city, week)() * left.length)];
    return all.find(p => p.id === id);
  }
  function puzzleFor(city, week, { dry = false } = {}) {
    const row = q.sched.get('puzzle', city, week);
    const byId = id => packs().flatMap(p => p.puzzles).find(p => p.id === id);
    if (row && byId(row.id)) return byId(row.id);
    const p = choose(city, week, q.hist.all('puzzle', city).filter(h => h.period < week));
    if (p && !dry) q.putSched.run('puzzle', city, week, p.id, now());
    return p;
  }
  // The next n weeks for a city, as they'd go if nothing changes (owner preview; nothing is stored)
  function preview(city, n = 4, from = now()) {
    const out = [], hist = q.hist.all('puzzle', city).slice();
    for (let i = 0; i < n; i++) {
      const week = C.isoWeekKeyUTC(from + i * 7 * DAY), row = q.sched.get('puzzle', city, week);
      const p = row ? packs().flatMap(x => x.puzzles).find(x => x.id === row.id) : choose(city, week, hist.filter(h => h.period < week));
      if (p && !row) hist.push({ period: week, id: p.id });
      out.push({ week, stored: !!row, puzzle: p || null });
    }
    return out;
  }

  /* ---------- a person's Decode week, judged in their own time zone ---------- */
  function timing(person, week, n, t = now()) {
    const off = C.judgeOffset(person && person.tz, person && person.cell && person.cell.lon, t);
    const ws = C.weekStartUTC(week) - off, k = Math.min(n, 24);
    const revealAt = Math.max(ws + 4 * DAY, ws + 7 * DAY - k * 3 * HOUR);
    const hints = HINT_AT.map((m, i) => n >= m || t >= ws + HINT_DAY[i] * DAY);
    const weeks = [...new Set([-HOUR, 0, HOUR].map(d => C.isoWeekKeyUTC(t + off + d)))];
    return { off, ws, revealAt, revealed: t >= revealAt, hints, nh: hints.filter(Boolean).length, current: C.isoWeekKeyUTC(t + off), weeks };
  }
  function decodeView(person, week, n) {
    const city = person && person.city;
    if (!city) return { none: true };
    let tm = timing(person, week, n);
    if (!tm.weeks.includes(week)) { week = tm.current; tm = timing(person, week, n); }
    const p = puzzleFor(city, week);
    if (!p) return { none: true, week, city };
    return { week, city, pack: packFor(city).name, id: p.id, q: p.q, h: p.h.map((h, i) => tm.hints[i] ? h : null), n, revealAt: tm.revealAt, revealed: tm.revealed, answer: tm.revealed ? p.a : null };
  }
  function checkSolve(person, week, answer, n) {
    if (!person || !person.city) return { code: 'failed_precondition', message: 'Pick your town first.' };
    const tm = timing(person, week, n);
    if (!tm.weeks.includes(week)) return { code: 'failed_precondition', message: 'That week’s Decode is closed.' };
    if (tm.revealed) return { code: 'failed_precondition', message: 'Right or wrong, the answer is already out.' };
    const p = puzzleFor(person.city, week);
    if (!p || C.decNorm(answer) !== p.a) return { code: 'failed_precondition', message: 'wrong_answer' };
    return { ok: true, hints: tm.nh, puzzle: p.id };
  }
  const publicLists = () => ({ dares: dares().map(d => ({ id: d.id, text: d.text, level: d.level })), mole: mole().map(m => ({ i: m.i, text: m.text, n: m.n })) });

  /* ---------- the owner's tool ---------- */
  const KIND = { puzzle: 'puzzle', dare: 'dare', mole: 'mole', pack: 'pack', drop: 'drop' };
  function normalise(kind, it) {
    it = { ...it }; delete it.source;
    if (kind === 'puzzle') {
      it.id = String(it.id || '').trim().toLowerCase(); it.a = C.decNorm(it.a); it.kind = String(it.kind || '');
      if (it.data && typeof it.data === 'object' && Array.isArray(it.data.nums)) it.data.nums = it.data.nums.map(Number);
      if (it.data && 'shift' in it.data) it.data.shift = +it.data.shift;
      if (!it.q && C.ASK[it.kind] && it.data) it.q = C.ASK[it.kind](it.data);
      if (!packs().some(p => p.id === it.pack)) it.pack = 'generic';
      if (it.week && !/^\d{4}-W\d{2}$/.test(it.week)) it.week = '';
      for (const k of ['week', 'city']) if (!it[k]) delete it[k];
      return { item: it, problems: C.checkPuzzle(it).concat(dupAnswer(it)) };
    }
    if (kind === 'dare') { it.id = String(it.id || '').trim().toLowerCase() || 'o' + Date.now().toString(36); it.level = +it.level; it.text = String(it.text || '').trim(); return { item: it, problems: C.checkDare(it) }; }
    if (kind === 'mole') {
      if (it.i === undefined || it.i === '' || it.i === null) it.i = Math.max(-1, ...mole().map(m => m.i), ...[...owner('mole').values()].map(m => +m.i)) + 1;
      it.i = +it.i; it.n = +it.n || 1; it.id = String(it.i); it.text = String(it.text || '').trim(); return { item: it, problems: C.checkMole(it) };
    }
    if (kind === 'pack') { it.id = String(it.id || '').trim().toLowerCase(); it.name = String(it.name || '').slice(0, 40); it.cities = (Array.isArray(it.cities) ? it.cities : String(it.cities || '').split(/[\s,]+/)).filter(Boolean).slice(0, 40); return { item: it, problems: /^[a-z][a-z0-9-]{1,30}$/.test(it.id) ? [] : ['pack id must be lower-case letters'] }; }
    if (kind === 'drop') {
      it.id = String(it.id || '').trim() || 'seed-' + crypto.randomBytes(5).toString('hex');
      const bad = [];
      for (const k of ['venue', 'prize', 'city']) if (!String(it[k] || '').trim()) bad.push(k + ' is needed');
      if (!isFinite(+it.lat) || !isFinite(+it.lon) || Math.abs(+it.lat) > 90 || Math.abs(+it.lon) > 180) bad.push('lat/lon must be real coordinates');
      if (!['offer', 'swap', 'twokey', 'dare', 'cash'].includes(it.kind)) bad.push('kind must be offer, swap, twokey, dare or cash');
      if (!(+it.start > 0)) bad.push('start must be a time'); if (![30, 60, 120].includes(+it.len)) bad.push('len must be 30, 60 or 120 minutes');
      const u = C.screenText([it.prize, it.dare].join(' ')); if (u.length && it.kind === 'dare') bad.push('dare not safe: ' + u.join(', '));
      Object.assign(it, { lat: +it.lat, lon: +it.lon, start: +it.start, len: +it.len });
      return { item: it, problems: bad };
    }
    return { item: it, problems: ['unknown kind'] };
  }
  function dupAnswer(it) { const p = packs().find(x => x.id === it.pack); const d = p && p.puzzles.find(z => z.a === it.a && z.id !== it.id); return d ? [`${it.pack} already has ${it.a} (${d.id})`] : []; }
  const admin = {
    list: () => ({ kinds: C.KINDS, packs: packs(), dares: dares(), mole: mole(), drops: mergeList(SEED.drops, 'drop'), recent: q.recent.all('puzzle', 60) }),
    check: (kind, item) => KIND[kind] ? normalise(kind, item) : { problems: ['unknown kind'] },
    save(kind, item) {
      const { item: it, problems } = admin.check(kind, item);
      if (problems.length) return { ok: false, problems };
      q.put.run(kind, String(it.id), JSON.stringify(it), now());
      return { ok: true, item: it };
    },
    remove(kind, id) { if (!KIND[kind]) return { ok: false, problems: ['unknown kind'] }; q.put.run(kind, String(id), JSON.stringify({ id: String(id), off: true }), now()); return { ok: true }; },
    restore(kind, id) { q.del.run(kind, String(id)); return { ok: true }; },
    preview: (city, n) => preview(city, Math.max(1, Math.min(12, +n || 4))),
  };
  return { packs, packFor, puzzleFor, preview, timing, decodeView, checkSolve, dares, mole, moleN, publicLists, admin, HINT_AT, HINT_DAY };
};
module.exports.core = C;
