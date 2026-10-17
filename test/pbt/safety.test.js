// WS-D properties against the real server rules, in process (test/lib/inproc.js): thousands of seeded cases.
//   P07  a Midnight message with any token of another member's name (case, accent, zero-width, NFKD,
//        full-width variants; Latin, Arabic, Hebrew, Cyrillic, Tamil, Devanagari, CJK) is refused, on write
//        and again on release for people who joined later; a stored Midnight doc never has an author field
//   P12  a blocked person's content is never visible to the blocker, and neither can reach the other
//   C35  only the circle's owner can remove, rename, transfer, rotate the code or close
//   C35  a removed member can never read the circle, write to it, or get back in on their own
//   P25  after account delete no doc references the uid; sessions and the account row are gone; hours still sum to 0
//   C37  the page's copy of the name screen agrees with the server's on random input
// PBT_RUNS scales every property (defaults: the per-property counts below). PBT_SEED replays.
'use strict';
const { prop, G } = require('./runner');
const I = require('../lib/inproc');
const N = require('../../server/names');

const RUNS = k => Math.max(20, Math.round((+process.env.PBT_RUNS || 1000) * k));
const none = function* () { };
const gen = f => ({ gen: r => f(r), shrink: none }); // scenario generators: replay by seed, no shrinking

// Letters only (\p{L}), so every word is a token of 2+ letters after folding.
const SCRIPTS = {
  latin: [...'abcdefghijklmnopqrstuvwxyz'], accent: [...'àáâäçèéêëíîïñóôöúûüý'], arabic: [...'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'],
  hebrew: [...'אבגדהוזחטיכלמנסעפצקרשת'], cyrillic: [...'абвгдежзийклмнопрстуфхцчшщыэюя'], tamil: [...'கஙசஞடணதநபமயரலவழளறன'],
  devanagari: [...'कखगघचछजझटठडढणतथदधनपफबभमयरलवशसह'], cjk: [...'健二美花太郎陽子山田中村'], kana: [...'あいうえおかきくけこさしすせそ'],
};
const KEYS = Object.keys(SCRIPTS);
const word = (r, script) => { const s = SCRIPTS[script || r.pick(KEYS)]; let w = ''; const n = r.int(2, 7); for (let i = 0; i < n; i++) w += r.pick(s); return w; };
const FILLER = ['i', 'tonight', 'i’m', 'so', 'tired', 'of', 'pretending', 'honestly', 'this', 'week', 'was', 'a', 'lot', '—', 'and', 'yes', 'I', 'ate', 'the', 'last', 'samosa'];
const ZW = ['\u200b', '\u200c', '\u200d', '\u2060', '\ufeff', '\u00ad'];
const MARKS = ['\u0301', '\u0308', '\u0327', '\u0300'];
// One way of writing a name that a person (or a script) might use to slip it past a filter.
function variant(r, w) {
  const how = r.int(0, 6); let v = w;
  if (how === 0) v = w.toUpperCase();
  if (how === 1) v = w[0].toUpperCase() + w.slice(1);
  if (how === 2) { const cs = [...w]; v = cs.map((c, i) => c + (i < cs.length - 1 && r.bool(.6) ? r.pick(ZW) : '')).join(''); } // zero-width between letters
  if (how === 3) v = [...w].map(c => c + (r.bool(.4) ? r.pick(MARKS) : '')).join(''); // stray accents
  if (how === 4) v = w.normalize('NFD');
  if (how === 5) v = [...w].map(c => /[a-z]/.test(c) ? String.fromCodePoint(c.codePointAt(0) - 0x61 + 0xff41) : c).join(''); // full-width Latin
  if (how === 6) v = [...w].map(c => r.bool(.5) ? c.toUpperCase() : c).join('');
  return v;
}
const sentence = (r, inside) => { const out = []; const n = r.int(0, 8), at = r.int(0, n); for (let i = 0; i <= n; i++) out.push(i === at ? inside : r.pick(FILLER)); return out.join(r.pick([' ', ' ', ', ', '! ', '… '])) + r.pick(['', '.', '!', '?']); };
const pair = (a, b) => [a.uid, b.uid].sort().join('__');
let WHY = ''; const fail = w => { WHY = w; return false; }; // which check failed, for the report

module.exports = async function (t) {
  const report = async (name, res) => { WHY = ''; res = await res; t.ok(`${name} (${res.runs} cases, seed ${res.seed})`, res.ok, (WHY ? WHY + ': ' : '') + (res.message || '')); };

  /* ---------- P07: names never get through Midnight ---------- */
  await report('P07 any token of another member’s name, in any variant or script, is refused on write', prop('P07 write', gen(r => {
    const k = r.int(2, 5), members = Array.from({ length: k }, () => ({ name: Array.from({ length: r.int(1, 3) }, () => word(r)).join(' '), handle: r.bool(.3) ? word(r, 'latin').toUpperCase() + (r.bool() ? r.int(1, 99) : '') : null }));
    const victim = r.int(1, k - 1), w = r.pick(members[victim].name.split(' '));
    return { members, text: sentence(r, variant(r, w)) };
  }), c => {
    I.reset();
    const ppl = c.members.map(m => I.person(m.name, { handle: m.handle }));
    const { cid } = I.circle(ppl[0]); for (const p of ppl.slice(1)) I.join(p, cid);
    const res = I.wr('set', `circles/${cid}/midnight/m1`, { text: c.text, releaseAt: 0 }, ppl[0]);
    return res.reason === 'names_blocked' && I.S.getDoc(`circles/${cid}/midnight/m1`) === null;
  }, { runs: RUNS(1.5) }));

  await report('P07 a handle is refused whole (one word in any case; several words as the phrase)', prop('P07 handle', gen(r => {
    const multi = r.bool(), h = multi ? word(r, 'latin') + ' ' + word(r, 'latin') : word(r, 'latin') + r.int(0, 99);
    return { h: h.toUpperCase(), text: sentence(r, multi ? h.split(' ').map(x => variant(r, x)).join(' ') : variant(r, h)) };
  }), c => {
    I.reset();
    const a = I.person('Arjun'), b = I.person('Ravi', { handle: c.h });
    const { cid } = I.circle(a); I.join(b, cid);
    return I.wr('set', `circles/${cid}/midnight/m1`, { text: c.text, releaseAt: 0 }, a).reason === 'names_blocked';
  }, { runs: RUNS(.5) }));

  await report('P07 a stored Midnight doc never names its author, whatever the page sends', prop('P07 author', gen(r => {
    const extra = {}; for (const k of ['by', 'uid', 'author', 'name', 'from', 'email', 'who', 'u']) if (r.bool(.5)) extra[k] = r.bool() ? 'SELF' : word(r, 'latin');
    return { extra, text: sentence(r, word(r, 'latin')) };
  }), c => {
    I.reset();
    const a = I.person('Zz Author'), b = I.person('Qq Other'); const { cid } = I.circle(a); I.join(b, cid);
    const data = { text: c.text, releaseAt: Date.now() + 5e5 }; for (const [k, v] of Object.entries(c.extra)) data[k] = v === 'SELF' ? a.uid : v;
    const res = I.wr('set', `circles/${cid}/midnight/m1`, data, a);
    if (!res.ok) return res.reason === 'names_blocked';
    I.wr('update', `circles/${cid}/midnight/m1`, { flags: [a.uid], reacts: { [a.uid]: 'brave' }, by: a.uid, author: a.uid }, b);
    const d = I.S.getDoc(`circles/${cid}/midnight/m1`), keys = Object.keys(d).filter(k => !['text', 'releaseAt', 'flags', 'm', 'reacts', 'removed', 'removedAt'].includes(k));
    // m is everyone in the circle when it was written, so it can't single anyone out
    return keys.length === 0 && JSON.stringify(d.m) === JSON.stringify([a.uid, b.uid].sort()) && !(d.reacts && d.reacts[a.uid]);
  }, { runs: RUNS(.5) }));

  await report('P07 on release, the name of someone who joined after it was written is held back', prop('P07 release', gen(r => ({ late: word(r) })), c => {
    I.reset();
    const a = I.person('Arjun'), b = I.person('Meera'); const { cid } = I.circle(a); I.join(b, cid);
    const w = I.wr('set', `circles/${cid}/midnight/m1`, { text: 'I owe ' + c.late + ' an apology', releaseAt: 0 }, a); if (!w.ok) return false;
    const late = I.person(c.late); I.join(late, cid);
    I.S.setClock(I.S.getDoc(`circles/${cid}/midnight/m1`).releaseAt - Date.now() + 6e4); // past releaseAt (int-1: since WS-I's C102 that is 00:00 circle time, not now + 1 min)
    try { return [a, b, late].every(u => { const d = I.query(`circles/${cid}/midnight`, u).docs[0].data; return d.text === null && d.removed === true; }); }
    finally { I.S.setClock(0); }
  }, { runs: RUNS(.3) }));

  /* ---------- the page's copy agrees with the server's ---------- */
  const app = require('../lib/load').loadV09(), CN = app.get('NAMES');
  await report('C37 the page’s name and dare screens agree with the server’s on random input', prop('C37 agree', G.tuple(G.str({ max: 40 }), G.array(G.tuple(G.str({ max: 16 }), G.str({ max: 10 })), { max: 4 })), ([text, ms]) => {
    const people = ms.map(([name, handle]) => ({ name, handle }));
    return N.nameHit(text, people) === CN.nameHit(text, people) && N.unsafeDare(text) === CN.unsafeDare(text);
  }, { runs: RUNS(2) }));

  /* ---------- P12: blocks ---------- */
  await report('P12 a blocked person’s content never reaches the blocker, and neither can reach the other', prop('P12', gen(r => {
    const k = r.int(3, 5);
    return { k, ops: Array.from({ length: r.int(4, 24) }, () => ({ op: r.pick(['post', 'msg', 'dare', 'cheer', 'dm', 'react', 'block', 'block', 'unblock']), a: r.int(0, k - 1), b: r.int(0, k - 1), x: r.int(0, 1e6) })) };
  }), c => {
    I.reset();
    const ppl = Array.from({ length: c.k }, (_, i) => I.person('P' + i)); const { cid } = I.circle(ppl[0]); for (const p of ppl.slice(1)) I.join(p, cid);
    const hidden = (a, b) => I.S.SAFE.hidden(a.uid, b.uid);
    for (const o of c.ops) {
      const A = ppl[o.a], B = ppl[o.b], id = 'x' + o.x, blocked = A !== B && hidden(A, B);
      if (o.op === 'post') I.wr('set', 'posts/' + id, { city: 'chennai', by: A.uid, name: 'P', text: 'hi ' + id, at: o.x, flags: [] }, A);
      if (o.op === 'msg') I.wr('set', `circles/${cid}/threads/general/msgs/${id}`, { by: A.uid, name: 'P', text: 'm', at: o.x }, A);
      if (o.op === 'dare' && A !== B && I.wr('set', `circles/${cid}/dares/${id}`, { text: 'Sing a song', level: 2, to: B.uid }, A).ok && blocked) return false;
      if (o.op === 'cheer' && A !== B && I.wr('set', `circles/${cid}/cheers/${B.uid}_${A.uid}_w_${id}`, { to: B.uid, from: A.uid, label: 'run', week: 'w' }, A).ok && blocked) return false;
      if (o.op === 'dm' && A !== B && I.wr('set', `dms/${pair(A, B)}/msgs/${id}`, { by: A.uid, name: 'P', text: 'psst', at: o.x }, A).ok && blocked) return false;
      if (o.op === 'react' && A !== B) { const p = I.S.q.kids.all('posts').map(r => ({ id: r.path.split('/')[1], d: JSON.parse(r.data) })).find(x => x.d.by === B.uid); if (p && I.wr('update', 'posts/' + p.id, { reacts: { [A.uid]: { r: 'love' } } }, A).ok && blocked) return false; }
      if (o.op === 'block' && A !== B) I.route('block', { uid: B.uid, on: true }, A);
      if (o.op === 'unblock' && A !== B) I.route('block', { uid: B.uid, on: false }, A);
    }
    // everywhere someone else's words can show up, read as each person
    for (const A of ppl) for (const B of ppl) {
      if (A === B || !hidden(A, B)) continue;
      const seen = ['posts', `circles/${cid}/threads/general/msgs`, `circles/${cid}/dares`, `circles/${cid}/cheers`, `dms/${pair(A, B)}/msgs`].flatMap(col => I.query(col, A).docs || []);
      if (seen.some(d => [d.data.by, d.data.from, d.data.to].includes(B.uid))) return false;
      if (I.get(`dms/${pair(A, B)}`, A).doc) return false;
    }
    return true;
  }, { runs: RUNS(.4) }));

  /* ---------- C35: only the owner runs the circle ---------- */
  await report('C35 only the owner can remove, rename, transfer, rotate the code or close', prop('C35 owner', gen(r => ({ actor: r.pick(['owner', 'member', 'member', 'outsider', 'appowner']), act: r.pick(['circle/rename', 'circle/remove', 'circle/transfer', 'circle/code', 'circle/close', 'doc-name', 'doc-owner', 'doc-removed', 'doc-members', 'doc-delete']), x: r.int(0, 999) })), c => {
    I.reset();
    const o = I.person('Owner'), m = I.person('Member'), m2 = I.person('Member Two'), out = I.person('Outsider'), boss = I.person('Boss', {}, I.OWNER);
    const { cid } = I.circle(o); I.join(m, cid); I.join(m2, cid);
    const before = JSON.stringify(I.S.getDoc('circles/' + cid));
    const actor = { owner: o, member: m, outsider: out, appowner: boss }[c.actor];
    let res;
    if (c.act.startsWith('circle/')) res = I.route(c.act, { cid, uid: m2.uid, name: 'New ' + c.x, confirm: 'Third Floor' }, actor);
    else if (c.act === 'doc-delete') res = I.wr('delete', 'circles/' + cid, null, actor);
    else res = I.wr('update', 'circles/' + cid, { 'doc-name': { name: 'Hijacked' }, 'doc-owner': { owner: actor.uid, by: actor.uid }, 'doc-removed': { removed: { [m2.uid]: 1 } }, 'doc-members': { members: [actor.uid] } }[c.act], actor);
    const after = I.S.getDoc('circles/' + cid);
    if (c.actor !== 'owner') return !res.ok || JSON.stringify(after) === before; // refused, or a no-op
    if (c.act === 'doc-delete') return !res.ok && !!after;
    if (c.act.startsWith('doc-')) return after.owner === o.uid && !(after.removed || {})[m2.uid] && JSON.stringify(after.members) === JSON.stringify(JSON.parse(before).members);
    return res.ok;
  }, { runs: RUNS(.5) }));

  /* ---------- C35: removed means removed ---------- */
  await report('C35 a removed member can never read the circle, write to it, or get back in on their own', prop('C35 removed', gen(r => ({ tries: Array.from({ length: r.int(1, 10) }, () => r.pick(['read-doc', 'read-threads', 'read-midnight', 'read-favors', 'read-msgs', 'write-msg', 'rejoin-person', 'rejoin-members', 'set-doc', 'join-by-code', 'owner-renames'])), undo: r.bool(.15) })), c => {
    I.reset();
    const o = I.person('Owner'), x = I.person('Ex'), m = I.person('Other'); const { cid, code } = I.circle(o); I.join(x, cid); I.join(m, cid);
    I.wr('set', `circles/${cid}/threads/general/msgs/a1`, { by: o.uid, name: 'Owner', text: 'secret plan', at: 1 }, o);
    if (!I.route('circle/remove', { cid, uid: x.uid }, o).ok) return false;
    for (const tr of c.tries) {
      if (tr === 'read-doc' && I.get('circles/' + cid, x).doc) return false;
      const col = { 'read-threads': 'threads', 'read-midnight': 'midnight', 'read-favors': 'favors', 'read-msgs': 'threads/general/msgs' }[tr];
      if (col) { const q = I.query(`circles/${cid}/${col}`, x); if (!q.code && q.docs.length) return false; }
      if (tr === 'write-msg' && I.wr('set', `circles/${cid}/threads/general/msgs/z${Math.random().toString(36).slice(2)}`, { by: x.uid, text: 'back' }, x).ok) return false;
      if (tr === 'rejoin-person') I.wr('update', 'people/' + x.uid, { circle: cid }, x);
      if (tr === 'rejoin-members') I.wr('update', 'circles/' + cid, { members: [o.uid, m.uid, x.uid] }, x);
      if (tr === 'set-doc') I.wr('set', 'circles/' + cid, { name: 'Mine now', members: [x.uid] }, x);
      if (tr === 'join-by-code') { const cd = I.get('codes/' + code, x).doc; if (cd) I.join(x, cd.cid); }
      if (tr === 'owner-renames') I.route('circle/rename', { cid, name: 'Renamed' }, o);
      const c2 = I.S.getDoc('circles/' + cid), p = I.S.getDoc('people/' + x.uid);
      if ((c2.members || []).includes(x.uid) || p.circle === cid || c2.owner !== o.uid) return false;
    }
    if (c.undo) { // the owner's 24 h undo is the one way back
      I.route('circle/unremove', { cid, uid: x.uid }, o);
      return (I.S.getDoc('circles/' + cid).members || []).includes(x.uid) && !!I.get(`circles/${cid}/threads/general`, x).doc;
    }
    return true;
  }, { runs: RUNS(.4) }));

  /* ---------- P25: delete leaves nothing behind ---------- */
  await report('P25 after account delete no doc references the uid, the session is gone, and hours still sum to 0', prop('P25', gen(r => ({ k: r.int(2, 4), who: r.int(0, 3), ops: Array.from({ length: r.int(3, 18) }, () => ({ op: r.pick(['post', 'msg', 'favor', 'pledge', 'dare', 'cheer', 'dm', 'block', 'midnight', 'react', 'met']), a: r.int(0, 3), b: r.int(0, 3), x: r.int(0, 1e6) })) })), async c => {
    I.reset();
    const ppl = Array.from({ length: c.k }, (_, i) => I.person('P' + i)); const { cid } = I.circle(ppl[0]); for (const p of ppl.slice(1)) I.join(p, cid);
    const pot = `circles/${cid}/threads/pot1`; I.wr('set', pot, { kind: 'pot', title: 'Pot', by: ppl[0].uid, at: 1, pledges: {}, paid: {}, per: 100, min: 2 }, ppl[0]);
    for (const o of c.ops) {
      const A = ppl[o.a % c.k], B = ppl[o.b % c.k], id = 'x' + o.x;
      if (o.op === 'post') I.wr('set', 'posts/' + id, { city: 'chennai', by: A.uid, name: 'P', text: 'hi', at: o.x, flags: [] }, A);
      if (o.op === 'msg') I.wr('set', `circles/${cid}/threads/general/msgs/${id}`, { by: A.uid, name: 'P', text: 'm', at: o.x }, A);
      if (o.op === 'favor' && A !== B) I.wr('set', `circles/${cid}/favors/${id}`, { what: 'help', h: 1, asker: A.uid, doer: B.uid, status: 'logged' }, A);
      if (o.op === 'pledge') I.wr('update', pot, { pledges: { [A.uid]: true } }, A);
      if (o.op === 'dare' && A !== B) I.wr('set', `circles/${cid}/dares/${id}`, { text: 'Sing', level: 2, to: B.uid }, A);
      if (o.op === 'cheer' && A !== B) I.wr('set', `circles/${cid}/cheers/${B.uid}_${A.uid}_w_${id}`, { to: B.uid, from: A.uid, label: 'x', week: 'w' }, A);
      if (o.op === 'dm' && A !== B) I.wr('set', `dms/${pair(A, B)}/msgs/${id}`, { by: A.uid, name: 'P', text: 'psst', at: o.x }, A);
      if (o.op === 'block' && A !== B) I.route('block', { uid: B.uid }, A);
      if (o.op === 'midnight') I.wr('set', `circles/${cid}/midnight/${id}`, { text: 'about me', releaseAt: 0 }, A);
      if (o.op === 'react') { const p = (I.query('posts', A).docs || [])[0]; if (p) I.wr('update', 'posts/' + p.id, { reacts: { [A.uid]: { r: 'love' } } }, A); }
      if (o.op === 'met' && A !== B) I.S.putDoc('met/' + pair(A, B), { ids: [A.uid, B.uid].sort(), at: 1 });
    }
    const D = ppl[c.who % c.k];
    const res = await I.route('account/delete', { confirm: 'DELETE' }, D);
    if (!res.ok || !/Max-Age=0/.test(res.headers['set-cookie'])) return fail('delete refused ' + JSON.stringify(res));
    { const left = I.allDocs().filter(d => d.path.includes(D.uid) || d.data.includes(D.uid)); if (left.length) return fail('still references the uid: ' + JSON.stringify(left).slice(0, 300)); }
    for (const tb of ['sessions', 'users', 'push']) if (I.S.db.prepare(`SELECT COUNT(*) n FROM ${tb} WHERE uid=?`).get(D.uid).n) return fail('row left in ' + tb);
    if (I.S.db.prepare('SELECT COUNT(*) n FROM kv WHERE v LIKE ?').get('%' + D.uid + '%').n) return fail('kv');
    const c2 = I.S.getDoc('circles/' + cid);
    if (c2 && !(c2.members || []).every(u => ppl.some(p => p.uid === u && p !== D))) return fail('members ' + JSON.stringify(c2.members));
    if (c2 && !ppl.some(p => p !== D && p.uid === (c2.owner || c2.by))) return fail('owner ' + JSON.stringify(c2)); // ownership passed on
    const bal = {}; for (const r of I.S.q.kids.all(`circles/${cid}/favors`)) { const f = JSON.parse(r.data); if (f.status !== 'logged') continue; bal[f.doer] = (bal[f.doer] || 0) + f.h; bal[f.asker] = (bal[f.asker] || 0) - f.h; }
    return Math.abs(Object.values(bal).reduce((a, b) => a + b, 0)) < 1e-9 || fail('hours ' + JSON.stringify(bal));
  }, { runs: RUNS(.3) }));

  /* ---------- unsafe dares: the screen lets the starter jar through ---------- */
  const starters = app.get('STARTER_DARES');
  t.ok('C88 every starter dare passes the keyword screen', starters.every(([d]) => !N.unsafeDare(d)), starters.filter(([d]) => N.unsafeDare(d)).map(x => x[0]).join(' | '));
};
