// WS-E over real HTTP (PLAN-V09 §5.b P08, P10; C48, C50, C93): a DEV server on a temp DB, people in
// Chennai, Mumbai, Delhi and Lisbon, a seeded random run of reads, live views, guesses and solves.
//   P08  no response and no SSE message, for any member, carries a Decode answer before its reveal;
//        the page the server hands out has no local pack; the owner tool is the owner's only
//   P10  a drop's seed hash is out from the start, the seed only once it's over, and it checks out;
//        the draw is among the circles people are really in
'use strict';
const crypto = require('crypto');
const { rng } = require('./runner');
const api = require('../lib/api');
const K = require('../lib/content'), C = K.C;
const { loadV09 } = require('../lib/load');
const DAY = 864e5, HOUR = 36e5;

module.exports = async function (t) {
  const A = await api.open({ owner: 'owner@x.com' });
  try {
    // Wednesday 10:00 IST of a fixed week: some hints out, answer not
    const T = Date.UTC(2026, 9, 14, 4, 30); await A.clock(T);
    const R = rng(+process.env.PBT_SEED || 20261014);
    const PEOPLE = [
      ['meera@x.in', 'Meera', 'IN-tamil_nadu-chennai', 'Asia/Kolkata', 80.27], ['arjun@x.in', 'Arjun', 'IN-tamil_nadu-chennai', 'Asia/Kolkata', 80.24],
      ['kavya@x.in', 'Kavya', 'IN-maharashtra-mumbai', 'Asia/Kolkata', 72.88], ['ravi@x.in', 'Ravi', 'IN-delhi-delhi', 'Asia/Kolkata', 77.2],
      ['erin@x.pt', 'Erin', 'PT-lisbon-lisbon', 'Europe/Lisbon', -9.14], ['owner@x.com', 'Owner', 'IN-tamil_nadu-chennai', 'Asia/Kolkata', 80.27],
    ];
    const U = [];
    for (const [email, name, city, tz, lon] of PEOPLE) { const u = await A.user(email); u.city = city; u.name = name; await u.post('set', { path: 'people/' + u.uid, data: { name, city, cityName: name, tz, cell: { lat: 13, lon }, circle: 'circ_' + city.slice(3, 8), joined: T } }); U.push(u); }
    await U[0].post('set', { path: 'circles/circ_tamil', data: { name: 'Minjur Five', code: 'ABCDEF' } });
    const weekOf = u => C.isoWeekKeyUTC(T + C.tzOffset(PEOPLE.find(p => p[0] === u.email)[3], T));
    const ans = {}; for (const u of U) ans[u.city] = (await A.answer(u.city, weekOf(u))).answer;
    t.ok('every member’s city has a puzzle this week (' + Object.entries(ans).map(([c, a]) => c.split('-').pop() + ':' + a.length + ' letters').join(', ') + ')', Object.values(ans).every(a => /^[A-Z]{4,12}$/.test(a)));
    t.ok('Chennai, Mumbai and Delhi get their own packs; Lisbon the generic one', (await U[0].get('decode?week=' + weekOf(U[0]))).body.pack === 'Chennai' && (await U[2].get('decode?week=' + weekOf(U[2]))).body.pack === 'Mumbai' && (await U[3].get('decode?week=' + weekOf(U[3]))).body.pack === 'Delhi' && (await U[4].get('decode?week=' + weekOf(U[4]))).body.pack === 'Anywhere');

    // live views of everything a Decode touches, for every member
    const streams = [];
    for (const u of U) streams.push(await u.stream([{ col: 'solves', where: [['city', '==', u.city]] }, { col: 'solves' }, { col: 'people' }, { doc: 'people/' + u.uid }, { col: 'data/users/' + u.uid }]));
    // a seeded random run: reads, queries, wrong guesses (some of them other cities' answers), forged solves, real solves
    const others = Object.values(ans);
    let solved = new Set(), wrong = 0, refusedForeign = 0;
    for (let i = 0; i < 160; i++) {
      const u = U[R.int(0, U.length - 1)], wk = weekOf(u), op = R.int(0, 9);
      if (op <= 2) await u.get('decode?week=' + (R.bool() ? wk : '2026-W' + R.int(40, 46)));
      else if (op === 3) await u.post('query', { col: 'solves' });
      else if (op === 4) await u.post('get', { path: 'people/' + U[R.int(0, U.length - 1)].uid });
      else if (op === 5) await u.get('content');
      else if (op === 6) { const g = R.pick(others.filter(a => a !== ans[u.city])); const r = await u.post('decode/solve', { week: wk, answer: g }); if (r.status === 400 && r.body.message === 'wrong_answer') refusedForeign++; }
      else if (op === 7) { const r = await u.post('set', { path: `solves/${wk}_${u.uid}`, data: { week: wk, answer: 'X' + R.int(0, 999) } }); if (r.status >= 400) wrong++; }
      else if (op === 8 && !solved.has(u.uid) && u.email !== 'owner@x.com' && R.int(0, 3) === 0) { const r = await u.post('decode/solve', { week: wk, answer: ans[u.city].toLowerCase() }); if (r.body.ok) solved.add(u.uid); }
      else await u.get('hello');
    }
    t.ok(`run: ${solved.size} real solves, ${refusedForeign} other-city answers refused, ${wrong} forged solves refused`, solved.size >= 1 && refusedForeign >= 1 && wrong >= 1);
    // non-owners on the owner tool
    const m = U[0], nonOwner = [await m.get('admin/content'), await m.post('admin/content/preview', { city: m.city }), await m.post('admin/content/save', { kind: 'puzzle', item: {} }), await m.post('admin/content/check', { kind: 'dare', item: {} }), await m.post('admin/content/remove', { kind: 'puzzle', id: 'chennai-01' })];
    t.ok('the owner tool refuses everyone but the owner (5 routes, 403)', nonOwner.every(r => r.status === 403), nonOwner.map(r => r.status).join(','));
    for (const s of streams) s.close();
    // P08: scan everything any member received (the owner's admin answers are the owner's own and excluded)
    const words = Object.values(ans), leak = A.seen.filter(x => !/owner@x\.com (GET|POST) admin\//.test(x.where)).filter(x => words.some(a => C.hasWord(x.body, a)));
    const n = A.seen.length;
    t.ok(`P08: none of ${n} responses and SSE messages carries this week’s answer for any city before its reveal`, !leak.length && n > 150, leak.slice(0, 3).map(x => x.where + ': ' + x.body.slice(0, 160)).join(' | '));
    // positive control: after the reveal the answer is in the payload, so the scan would have seen it
    if (!solved.has(U[0].uid)) await U[0].post('decode/solve', { week: weekOf(U[0]), answer: ans[U[0].city] });
    await A.clock(T + 4 * DAY + 13.5 * HOUR); // Sunday 23:30 IST, same week: with a solve in, the answer is out
    const after = (await U[0].get('decode?week=' + weekOf(U[0]))).body;
    t.ok('control: once the week’s answer is out, /api/decode gives it (the scan above would have caught it)', after.revealed && after.answer === ans[U[0].city]);
    const late = await U[5].post('decode/solve', { week: weekOf(U[5]), answer: ans[U[5].city] }); // the owner never solved in the run
    t.ok('a right answer after the reveal is refused', late.status === 400 && /already out/.test(late.body.message), JSON.stringify(late.body));
    const other = await U[5].post('decode/solve', { week: '2026-W30', answer: 'ANY' });
    t.ok('a solve for another week is refused', other.status === 400, JSON.stringify(other.body));
    await A.clock(T);

    // the page the server hands out has no local pack, not even hashed; the pasteable file does
    const page = await (await fetch(A.base + '/')).text(), file = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'app', 'index.html'), 'utf8');
    t.ok('served page: DECODE_LOCAL is null, no salts or seals, no answer words', /const DECODE_LOCAL=null;/.test(page) && !/"s":"[0-9a-f]{16}","x":/.test(page) && !K.allAnswers().some(a => new RegExp('\\b' + a + '\\b').test(page)) && /"s":"[0-9a-f]{16}","x":/.test(file));
    t.ok('served page is otherwise the built file (only the pack differs)', page === file.replace(/\/\*@decode-local\*\/[\s\S]*?\/\*@end-decode-local\*\//, 'const DECODE_LOCAL=null;'));

    /* ---------- P10 commit-reveal over HTTP ---------- */
    const host = U[5], start = T + 10 * 60e3, end = start + 30 * 60e3;
    await host.post('set', { path: 'drops/dp1', data: { city: host.city, lat: 13, lon: 80.27, g: 'x', venue: 'Kaapi Corner', kind: 'offer', prize: 'Free filter coffee', start, end, host: host.uid, code: 'KAAPI2', seed: 'mine', seedHash: 'abc', at: T } });
    const d0 = (await U[0].post('get', { path: 'drops/dp1' })).body.doc;
    t.ok('P10: the drop is published with a seed hash the host didn’t choose, and no seed', d0 && /^[0-9a-f]{64}$/.test(d0.seedHash) && d0.seedHash !== 'abc' && !('seed' in d0) && !('code' in d0));
    await host.post('set', { path: 'drops/dp1', data: { ...d0, code: 'KAAPI2', seedHash: 'f'.repeat(64) } });
    t.ok('P10: the host can’t re-roll or replace the seed hash by saving again', (await U[0].post('get', { path: 'drops/dp1' })).body.doc.seedHash === d0.seedHash);
    await A.clock(start + 60e3);
    const ci = [];
    for (const u of U.slice(0, 5)) ci.push(await u.post('set', { path: `checkins/dp1_${u.uid}`, data: { drop: 'dp1', city: u.city, week: 'w', uid: u.uid, circle: 'circ_FORGED', cname: 'x', code: 'kaapi2' } }));
    t.ok('check-ins land, and each is filed under the circle its person is really in', ci.every(r => r.status === 200) && (await U[0].post('query', { col: 'checkins', where: [['drop', '==', 'dp1']] })).body.docs.every(x => x.data.circle && x.data.circle.startsWith('circ_') && x.data.circle !== 'circ_FORGED'));
    t.ok('P10: while the drop is on, nobody can read the seed', !('seed' in (await U[2].post('get', { path: 'drops/dp1' })).body.doc));
    await A.clock(end + 60e3);
    const d1 = (await U[2].post('get', { path: 'drops/dp1' })).body.doc;
    const ins = (await U[2].post('query', { col: 'checkins', where: [['drop', '==', 'dp1']] })).body.docs.map(x => x.data);
    t.ok('P10: once it’s over the seed is out and matches the hash published first', d1.seed && crypto.createHash('sha256').update(d1.seed).digest('hex') === d0.seedHash);
    const app = loadV09(), w = app.get('drawWinner')({ id: 'dp1', ...d1 }, ins);
    t.ok('P10: the winner is one of the circles that turned up, never the host’s own', !!w && ins.some(i => i.circle === w) && w !== d1.hostCircle, w + ' host ' + d1.hostCircle);
    t.ok('P10: anyone recomputes the same winner from the published seed', app.get('drawWinner')({ id: 'dp1', ...d1 }, ins.slice().reverse()) === w && loadV09().get('drawWinner')({ ...d1, id: 'dp1' }, ins) === w);

    /* ---------- C93: the owner adds a puzzle for next week, a member gets it next week ---------- */
    const o = U[5], nextWeek = C.isoWeekKeyUTC(T + 5.5 * HOUR + 7 * DAY);
    const sv = await o.post('admin/content/save', { kind: 'puzzle', item: { id: 'chennai-owner-e2e', pack: 'chennai', kind: 'acrostic', data: { text: 'Some Light Over Ancient Kovalam' }, a: 'SLOAK', h: ['First letters only.', 'Five letters.', 'Not a real word: this is a test.'], week: nextWeek } });
    t.ok('C93: owner saves a puzzle pinned to next week', sv.status === 200 && sv.body.ok, JSON.stringify(sv.body));
    const pv = (await o.post('admin/content/preview', { city: 'IN-tamil_nadu-chennai', n: 2 })).body.weeks;
    t.ok('C93: the owner’s preview shows it as next week’s', pv[1].week === nextWeek && pv[1].puzzle.id === 'chennai-owner-e2e');
    t.ok('C93: this week’s Chennai puzzle is unchanged', (await U[0].get('decode?week=' + weekOf(U[0]))).body.id !== 'chennai-owner-e2e');
    await A.clock(T + 7 * DAY);
    const nx = (await U[1].get('decode?week=' + nextWeek)).body;
    t.ok('C93: a week later, a Chennai member gets the owner’s puzzle', nx.id === 'chennai-owner-e2e' && /Some Light Over Ancient Kovalam/.test(nx.q) && !nx.answer, JSON.stringify(nx).slice(0, 200));
    t.ok('C93: and only Chennai: Mumbai doesn’t', (await U[2].get('decode?week=' + nextWeek)).body.id !== 'chennai-owner-e2e');
  } finally { await A.close(); }
};
