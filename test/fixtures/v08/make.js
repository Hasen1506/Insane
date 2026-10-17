#!/usr/bin/env node
// Builds test/fixtures/v08/insane-v08.db by running the REAL v0.8 server (fac3720, from the cached .v08
// git worktree) and writing through its API exactly as v0.8 clients do: sign-in by emailed code, onboarding,
// two circles, a solo user, plans, messages, favors, Midnight, a drop, a Decode solve, the Mole, dares,
// cheers, posts. The result is committed, so tests never need v0.8 running; re-run this to regenerate:
//   node test/fixtures/v08/make.js
// manifest.json records the fake test users' uids and the doc counts the migration test checks.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');
const { v08Dir } = require('../../lib/load');
const { until } = require('../../lib/e2e');
const OUT = __dirname, PORT = +process.env.FIXTURE_PORT || 8977, B = `http://localhost:${PORT}`;
const DAY = 864e5;

(async () => {
  let uids = {};
  const dir = v08Dir(), db = path.join(os.tmpdir(), `insane-v08-fixture-${process.pid}.db`);
  for (const s of ['', '-wal', '-shm']) fs.rmSync(db + s, { force: true });
  const proc = spawn(process.execPath, ['--no-warnings', path.join(dir, 'server', 'server.js')], { env: { ...process.env, DEV: '1', PORT: String(PORT), DB_FILE: db, OWNER_EMAIL: 'arjun@example.in' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await until(async () => (await fetch(B + '/api/hello')).ok, { timeout: 15000, what: 'v0.8 server' });
    const hello = await (await fetch(B + '/api/hello')).json();
    if (hello.version !== '0.8') throw new Error('not v0.8: ' + JSON.stringify(hello));
    const T = hello.now, tokens = {};
    const call = async (who, r, body) => { const res = await fetch(`${B}/api/${r}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: 'insane_s=' + tokens[who] }, body: JSON.stringify(body) }); const j = await res.json(); if (!res.ok) throw new Error(`${who} ${r} ${JSON.stringify(body).slice(0, 120)} → ${res.status} ${JSON.stringify(j)}`); return j; };
    const set = (who, p, data) => call(who, 'set', { path: p, data }), update = (who, p, data) => call(who, 'update', { path: p, data });
    async function signIn(who, email) {
      await fetch(B + '/api/auth/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const mail = (await (await fetch(`${B}/api/dev/outbox?email=${encodeURIComponent(email)}`)).json()).mail;
      const code = /code is (\d{6})/.exec(mail.text)[1];
      const r = await fetch(B + '/api/auth/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) });
      tokens[who] = /insane_s=([^;]+)/.exec(r.headers.get('set-cookie'))[1]; uids[who] = (await r.json()).uid;
    }
    const P = {
      arjun: { email: 'arjun@example.in', name: 'Arjun', tz: 'Asia/Kolkata', cell: { lat: 13.07, lon: 80.24 }, city: 'Chennai' },
      kavya: { email: 'kavya@example.in', name: 'كافيا Kavya', tz: 'Asia/Kolkata', cell: { lat: 13.03, lon: 80.27 }, city: 'Chennai' },
      ravi: { email: 'ravi@example.in', name: 'Ravi', tz: null, cell: { lat: 12.97, lon: 77.59 }, city: 'Bengaluru' },
      meera: { email: 'meera@example.in', name: 'Meera 🌸 Lakshminarayanan', tz: 'Asia/Kolkata', cell: { lat: 13.23, lon: 80.32 }, city: 'Chennai' },
      dev: { email: 'dev@example.in', name: 'Dev', tz: 'Asia/Kolkata', cell: { lat: 13.06, lon: 80.25 }, city: 'Chennai' },
    };
    for (const k in P) await signIn(k, P[k].email);
    // onboarding, as 71-onboarding.js writes it (Ravi's browser sent no zone, as some do)
    for (const k in P) { const x = P[k]; await set(k, 'people/' + uids[k], { name: x.name, handle: k.toUpperCase().slice(0, 4) + '7', circle: null, joined: T, seen: T, quiet: { from: 23, to: 8 }, ...(x.tz ? { tz: x.tz } : {}), cell: x.cell, city: x.city, radius: 5 }); }
    // circles: Arjun's (Arjun, Kavya, Dev) and Ravi's (Ravi alone); Meera stays solo
    const c1 = 'c_mylapore01', c2 = 'c_ravi000001';
    await set('arjun', 'codes/MAD8HT', { cid: c1, at: T }); await set('arjun', 'circles/' + c1, { name: 'Mylapore Mad Hatters', code: 'MAD8HT', city: 'Chennai', members: [uids.arjun], createdAt: T, by: uids.arjun });
    await update('arjun', 'people/' + uids.arjun, { circle: c1 });
    for (const k of ['kavya', 'dev']) { await update(k, 'circles/' + c1, { members: [uids.arjun, uids.kavya, ...(k === 'dev' ? [uids.dev] : [])] }); await update(k, 'people/' + uids[k], { circle: c1 }); }
    await set('ravi', 'codes/RAVI42', { cid: c2, at: T }); await set('ravi', 'circles/' + c2, { name: 'Indiranagar Night Owls', code: 'RAVI42', city: 'Bengaluru', members: [uids.ravi], createdAt: T, by: uids.ravi });
    await update('ravi', 'people/' + uids.ravi, { circle: c2 });
    // a plan with answers and messages, the general thread
    await set('arjun', `circles/${c1}/threads/t_plan1`, { kind: 'plan', title: 'Filter coffee Sunday', by: uids.arjun, at: T, when: T + 2 * DAY, going: { [uids.arjun]: true } });
    await update('kavya', `circles/${c1}/threads/t_plan1`, { going: { [uids.kavya]: true } });
    await set('kavya', `circles/${c1}/threads/t_plan1/msgs/m1`, { by: uids.kavya, name: 'Kavya', text: 'I’m in, Ratna Café?', at: T });
    await set('arjun', `circles/${c1}/threads/general/msgs/m2`, { by: uids.arjun, name: 'Arjun', text: 'Welcome all', at: T });
    // a pot thread
    await set('arjun', `circles/${c1}/threads/t_pot1`, { kind: 'pot', title: 'Gift for Dev', by: uids.arjun, at: T, cur: 'INR', goal: 1500, pledges: {}, paid: {} });
    await update('kavya', `circles/${c1}/threads/t_pot1`, { pledges: { [uids.kavya]: true }, paid: { [uids.kavya]: 'wait' } });
    // favors: one open, one logged (Dev helped Kavya)
    await set('kavya', `circles/${c1}/favors/f1`, { what: 'Lift to Central', h: 1, asker: uids.kavya, status: 'open' });
    await set('kavya', `circles/${c1}/favors/f2`, { what: 'Fixed my bike', h: 2, asker: uids.kavya, doer: uids.dev, status: 'logged' });
    // Midnight queued for tonight 00:00 IST (one far away so it is still pending)
    await set('dev', `circles/${c1}/midnight/mn1`, { text: 'I still can’t cook rice', releaseAt: T + 3 * DAY, flags: [] });
    // the Mole, a vote, a cheer, a dare, the daily dare, a sealed note
    await set('dev', `circles/${c1}/moles/2026W42`, {});
    await set('kavya', `circles/${c1}/molevotes/2026W42_${uids.kavya}`, { week: '2026W42', vote: uids.dev });
    await set('arjun', `circles/${c1}/cheers/2026W42_${uids.arjun}_${uids.kavya}`, { to: uids.kavya, from: uids.arjun, label: 'Ran 3x', week: '2026W42' });
    await set('arjun', `circles/${c1}/dares/d1`, { text: 'Sing at the beach', level: 3, to: uids.kavya });
    await set('kavya', `circles/${c1}/daily/2026-10-17`, { dare: 'Compliment a stranger', done: { [uids.kavya]: { note: 'done!' } } });
    await set('arjun', `circles/${c1}/sealed/s1`, { by: uids.arjun, text: 'Open in a year', openAt: T + 365 * DAY });
    // a drop (door code), a Decode solve, a City post and call, a meeting code, private docs, events
    await set('arjun', 'drops/dr1', { city: 'Chennai', lat: 13.05, lon: 80.26, venue: 'Ratna Café', prize: 'Free coffee', kind: 'prize', start: T + DAY, end: T + DAY + 36e5, code: 'K7Q2ZX', codeHash: 'x', at: T });
    const wk = '2026W' + String(42).padStart(2, '0'); // weekIdx(2026W42) = 42 % 8 = 2 → CARD
    await set('kavya', `solves/${wk}_${uids.kavya}`, { week: wk, answer: 'CARD', hints: 0 });
    await set('meera', 'posts/p1', { by: uids.meera, text: 'Anyone for a Marina walk?', city: 'Chennai', at: T });
    await set('meera', 'calls/cl1', { by: uids.meera, text: 'Need a badminton 4th', city: 'Chennai', at: T });
    await set('dev', `data/users/${uids.dev}/mole`, { tasks: [0, 1, 2], prog: [3, 1, 0] });
    await set('meera', 'ev/' + uids.meera, { first: { signedIn: T }, days: ['2026-10-17'] });
    await set('arjun', 'pair/' + uids.arjun, { code: '4242', exp: T + 6e5 });
  } finally {
    proc.kill(); await new Promise(r => proc.once('exit', r));
  }
  // fold the WAL in and compact, so the fixture is one small file
  execFileSync('sqlite3', [db, 'PRAGMA wal_checkpoint(TRUNCATE); VACUUM;']);
  const counts = {}; for (const line of execFileSync('sqlite3', [db, "SELECT CASE WHEN parent LIKE 'circles/%/%' THEN 'circles/*/' || substr(parent, instr(substr(parent, 9), '/') + 9) ELSE parent END p, COUNT(*) FROM docs GROUP BY p ORDER BY p"]).toString().trim().split('\n')) { const [p, n] = line.split('|'); counts[p] = (counts[p] || 0) + +n; }
  const total = +execFileSync('sqlite3', [db, 'SELECT COUNT(*) FROM docs']).toString().trim();
  fs.copyFileSync(db, path.join(OUT, 'insane-v08.db'));
  for (const s of ['', '-wal', '-shm']) fs.rmSync(db + s, { force: true });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ made: 'by test/fixtures/v08/make.js against the v0.8 server at fac3720', total, counts, uids, circles: { arjun: 'c_mylapore01', ravi: 'c_ravi000001' } }, null, 2) + '\n');
  console.log(`wrote ${path.join(OUT, 'insane-v08.db')} (${total} docs)`);
})().catch(e => { console.error(e); process.exit(1); });
