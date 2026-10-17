// Safety on the server (WS-D): blocks (C87), reports (C87), unsafe-dare flags and the keyword screen (C88),
// the owner's moderation queue and audit log (C89), presence and squares kept inside the circle (C90, C44),
// the Midnight name screen (C37), circle membership and admin (C35), age and consent on sign-up (C17, C63).
// server.js calls in through canRead / canWrite / beforeWrite / readFilter / route; nothing here listens.
'use strict';
const { nameHit, unsafeDare } = require('./names');

const CONSENT_VERSION = '2026-10-draft';
const REPORT_CATS = ['harassment', 'hate', 'unsafe', 'sexual', 'spam', 'impersonation', 'underage', 'other'];
const UNDO_MS = 24 * 36e5;

module.exports = function moderation(ctx) {
  const { db, q, getDoc, putDoc, now, isOwner, Refuse, rid, touched, refreshUser } = ctx;
  // reports and audit are created by server/migrate.js (schema step 3), which server.js runs before this module loads
  for (const t of ['reports', 'audit']) if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t)) throw new Error(`moderation: table ${t} is missing; run server/migrate.js first`);
  const audit = (actor, action, target, note = '') => db.prepare('INSERT INTO audit(at,actor,action,target,note) VALUES(?,?,?,?,?)').run(now(), actor, action, String(target || ''), String(note || '').slice(0, 300));

  /* ---------- who is who ---------- */
  const person = uid => getDoc('people/' + uid) || {};
  // int-1: a person can be in up to MAX_CIRCLES circles (WS-I, people/{uid}.circles); `circle` is the primary one.
  // Every membership and read check below goes through circlesOfDoc, so it holds for each circle, not just the primary.
  const circlesOfDoc = d => { const cs = Array.isArray(d && d.circles) ? d.circles.filter(x => typeof x === 'string' && x) : []; return d && d.circle && !cs.includes(d.circle) ? [d.circle, ...cs] : cs; };
  const circleOf = uid => person(uid).circle || null; // the primary circle: defaults only (reports, the admin route's cid)
  const circlesOf = uid => circlesOfDoc(person(uid));
  const isMember = (uid, cid) => !!uid && !!cid && (circlesOf(uid).includes(cid) || ((getDoc('circles/' + cid) || {}).members || []).includes(uid));
  const shareCircle = (a, b) => { const mine = circlesOf(a); return circlesOfDoc(b).some(c => mine.includes(c)); };
  const ownerOf = c => c && (c.owner || c.by);
  const membersOf = cid => q.kids.all('people').map(r => ({ id: r.path.split('/')[1], ...JSON.parse(r.data) })).filter(p => circlesOfDoc(p).includes(cid));
  const blocksOf = uid => ((getDoc(`data/users/${uid}/blocks`) || {}).ids) || {};
  // Blocking works both ways: neither person sees the other's content, and neither can reach the other.
  const hidden = (a, b) => !!a && !!b && a !== b && (!!blocksOf(a)[b] || !!blocksOf(b)[a]);

  /* ---------- reads ---------- */
  function canRead(p, u) {
    const s = p.split('/');
    if (s[0] === 'circles' && s.length >= 3) return isMember(u.uid, s[1]) || isOwner(u);
    if (s[0] === 'dms' && s.length >= 2) { const ids = s[1].split('__'); return (ids.includes(u.uid) && !hidden(ids[0], ids[1])) || isOwner(u); }
    return true;
  }
  function canWrite(p, u) {
    const s = p.split('/');
    if (s[0] === 'circles' && s.length >= 3) return isMember(u.uid, s[1]) || isOwner(u);
    if (s[0] === 'dms' && s.length >= 2) { const ids = s[1].split('__'); return ids.includes(u.uid) && !hidden(ids[0], ids[1]); }
    return true;
  }
  // Fields that name who wrote a doc, per collection: if viewer and author have blocked each other, it's gone.
  function authorsOf(s, d) {
    const c = s[0] === 'circles' ? s[2] : s[0];
    if (s[s.length - 2] === 'msgs') return [d.by];
    if (s[0] === 'circles' && s.length === 4) return c === 'dares' ? [d.by, d.to] : c === 'clips' ? [d.by] : c === 'cheers' ? [d.from, d.to] : [];
    if (s.length === 2) return c === 'posts' || c === 'calls' || c === 'missions' || c === 'trails' ? [d.by] : c === 'drops' ? [d.host] : [];
    return [];
  }
  function readFilter(p, d, u) {
    if (!d) return d;
    const s = p.split('/');
    if (s[0] === 'people' && s.length === 2 && s[1] !== u.uid) {
      d = { ...d }; delete d.consent; delete d.adultAt;
      if (!shareCircle(u.uid, d) && !isOwner(u)) delete d.cell; // C44: strangers never get your square
      return d;
    }
    if (s[0] === 'live' && s.length === 2 && s[1] !== u.uid) { // C90: presence is for your circle only, and can be off
      const them = person(s[1]);
      if (!shareCircle(u.uid, them) || them.presenceOff || hidden(u.uid, s[1])) return null;
      return d;
    }
    if (s[0] === 'circles' && s.length === 2) {
      if (isMember(u.uid, s[1]) || isOwner(u)) return d;
      if ((d.removed || {})[u.uid]) return null; // removed: the circle is gone, as far as they can tell
      return { name: d.name, city: d.city, n: (d.members || []).length, members: [] }; // the invite preview
    }
    if (s[0] === 'circles' && s[2] === 'dares' && s.length === 4 && !isOwner(u) && (d.pulled || (d.flags || []).includes(u.uid))) return null;
    if (s[0] === 'circles' && s[2] === 'midnight' && s.length === 4 && d.text && d.releaseAt <= now()) {
      // On release, again: anyone who joined after it was written is screened for too.
      const seen = new Set(d.m || []); const late = membersOf(s[1]).filter(m => !seen.has(m.id));
      if (late.length && nameHit(d.text, late)) return { ...d, text: null, removed: true, held: 'names' };
    }
    if (s[0] === 'dms' && s.length === 2) { const ids = s[1].split('__'); if (hidden(ids[0], ids[1])) return null; }
    for (const a of authorsOf(s, d)) if (hidden(u.uid, a)) return null;
    return d;
  }

  /* ---------- writes ---------- */
  function joinCheck(cid, uid) {
    const c = getDoc('circles/' + cid);
    if (!c) throw new Refuse('failed_precondition', 'That circle has closed.');
    if ((c.removed || {})[uid]) throw new Refuse('permission_denied', 'You were removed from this circle.');
    if (!(c.members || []).includes(uid) && membersOf(cid).length >= 8) throw new Refuse('failed_precondition', `${c.name} is full. Circles stop at 8.`);
    return c;
  }
  // Membership follows people/{uid}.circles (and .circle, mirrored into it by server/rules/people.js), which only
  // the person sets: each circle added is checked (closed, removed, full) and adds you; each one dropped takes you off.
  // Every join is checked before any circle doc changes, so a refused join leaves nothing half done.
  function moveMember(uid, from, to) {
    const out = [], fromS = new Set(from), toS = new Set(to);
    const joins = [...toS].filter(c => !fromS.has(c)).map(cid => [cid, joinCheck(cid, uid)]);
    for (const cid of fromS) {
      if (toS.has(cid)) continue;
      const c = getDoc('circles/' + cid);
      if (c) {
        c.members = (c.members || []).filter(x => x !== uid);
        if (ownerOf(c) === uid && c.members.length) { c.owner = c.members[0]; audit(uid, 'owner-left', cid, 'ownership passed on'); }
        putDoc('circles/' + cid, c); out.push('circles/' + cid);
      }
    }
    for (const [cid, c] of joins) { c.members = [...new Set([...(c.members || []), uid])]; putDoc('circles/' + cid, c); out.push('circles/' + cid); }
    return out;
  }
  function beforeWrite(op, p, data, u, old) {
    const s = p.split('/');
    if (s[0] === 'people' && s.length === 2) {
      if (op === 'delete') return data;
      data = { ...data };
      if (!old && op === 'set') { // sign-up: an age attestation and an explicit consent, both recorded by the server
        if (data.adult !== true) throw new Refuse('failed_precondition', 'Confirm you’re old enough to use INSANE.');
        if (!data.consent || data.consent.v !== CONSENT_VERSION) throw new Refuse('failed_precondition', 'Agree to the Terms, Privacy notice and Community rules first.');
        data.adult = true; data.adultAt = now(); data.consent = { v: CONSENT_VERSION, at: now() };
      } else {
        delete data.adult; delete data.adultAt; delete data.consent;
        if (op === 'set' && old) { data.adult = old.adult; data.adultAt = old.adultAt; data.consent = old.consent; }
      }
      if ('presenceOff' in data) data.presenceOff = !!data.presenceOff;
      if ('circle' in data || 'circles' in data) {
        if ('circle' in data) data.circle = data.circle || null;
        const to = circlesOfDoc(op === 'set' || !old ? data : { ...old, ...data }), from = circlesOfDoc(old);
        const paths = moveMember(s[1], from, to);
        if (paths.length) setImmediate(() => touched(paths));
      }
      return data;
    }
    if (s[0] === 'circles' && s.length === 2) {
      const cid = s[1];
      if (op === 'delete') throw new Refuse('permission_denied', 'Only the owner can close a circle, from Circle settings.');
      if (!old) {
        if (op !== 'set') throw new Refuse('invalid_argument', 'Document does not exist');
        return { name: String(data.name || 'Circle').slice(0, 28), code: String(data.code || ''), city: data.city ?? null, createdAt: now(), by: u.uid, owner: u.uid, members: [u.uid], removed: {} };
      }
      const keep = {};
      if (Array.isArray(data.members)) keep.members = (old.members || []).slice(); // membership is people/{uid}.circle's job
      if (data.verified && typeof data.verified === 'object') {
        const mem = new Set(old.members || []), v = {};
        for (const [k, x] of Object.entries(data.verified)) if (x === true && mem.has(k)) v[k] = true;
        keep.verified = v;
      }
      if ('name' in data && ownerOf(old) === u.uid) keep.name = String(data.name || old.name).slice(0, 28);
      if (op === 'set') return { ...old, ...keep };
      return keep;
    }
    if (s[0] === 'circles' && s[2] === 'midnight' && s.length === 4) {
      if (op === 'set') {
        const text = String(data.text || '').slice(0, 400);
        const mem = membersOf(s[1]);
        const others = mem.filter(m => m.id !== u.uid), hit = nameHit(text, others);
        if (hit) { const who = others.find(m => nameHit(text, [m])) || {}; throw new Refuse('failed_precondition', `Midnight is about you. Take out ${who.name ? '“' + who.name + '”' : 'their name'} and say it about yourself.`, 'names_blocked'); }
        // No author, by construction. m is everyone in the circle at the time, so a later joiner is screened on release.
        return { text, releaseAt: Math.max(+data.releaseAt || 0, now() + 6e4), flags: [], m: mem.map(x => x.id).sort() };
      }
      if (op === 'update') {
        const keep = {};
        if ('flags' in data) keep.flags = [...new Set([...(old?.flags || []), u.uid])];
        if (data.reacts && u.uid in data.reacts) { const r = data.reacts[u.uid]; keep.reacts = { [u.uid]: ['same', 'brave', '❤'].includes(r) ? r : null }; }
        if (data.removed === true) { keep.removed = true; keep.removedAt = now(); }
        return keep;
      }
      throw new Refuse('permission_denied', 'Midnight messages stay; remove one for everyone instead.');
    }
    if (s[0] === 'circles' && s[2] === 'dares' && s.length === 4) {
      if (op === 'set' && !old) {
        const why = unsafeDare(data.text);
        if (why) throw new Refuse('failed_precondition', 'Not that one. ' + why, 'unsafe_dare');
        if (data.to && (hidden(u.uid, data.to) || !isMember(data.to, s[1]))) throw new Refuse('permission_denied', 'You can’t dare them.');
        return undefined; // the rest is the usual dare rule
      }
      if (op === 'update' && old && 'flags' in data && !('status' in data)) {
        const flags = [...new Set([...(old.flags || []), u.uid])], keep = { flags };
        if (flags.length >= 2 && !old.pulled) { keep.pulled = true; keep.pulledAt = now(); audit('circle', 'dare-pulled', p, old.text); }
        return keep;
      }
      return undefined;
    }
    if (s[0] === 'circles' && s[2] === 'daily' && s.length === 4 && op !== 'delete' && data.flags && !data.done) {
      const flags = [...new Set([...((old && old.flags) || []), u.uid])];
      if (flags.length === 2) audit('circle', 'daily-flagged', p, (old && old.dare) || data.dare);
      return old ? { flags } : { dare: String(data.dare || '').slice(0, 100), done: {}, flags };
    }
    if (s[0] === 'circles' && s[2] === 'cheers' && s.length === 4 && op === 'set' && hidden(u.uid, data.to)) throw new Refuse('permission_denied', 'You can’t cheer them.');
    if (s[0] === 'posts' && s.length === 2 && old && old.by !== u.uid && hidden(u.uid, old.by)) throw new Refuse('permission_denied', 'Not your post.');
    return undefined;
  }
  // Don't tell a person about something done by someone they've blocked (or who blocked them).
  const mutedFor = (to, from) => hidden(to, from);

  /* ---------- circle admin (C35) ---------- */
  function ownedCircle(u, cid) {
    const c = getDoc('circles/' + String(cid || ''));
    if (!c) throw new Refuse('failed_precondition', 'That circle has closed.');
    if (ownerOf(c) !== u.uid) throw new Refuse('permission_denied', 'Only the circle’s owner can do that.');
    return c;
  }
  function removeMember(cid, uid, actor) {
    const c = getDoc('circles/' + cid);
    c.members = (c.members || []).filter(x => x !== uid); c.removed = { ...(c.removed || {}), [uid]: now() };
    putDoc('circles/' + cid, c);
    const pp = getDoc('people/' + uid);
    if (pp && circlesOfDoc(pp).includes(cid)) { // off every list: the primary, and circles[] (WS-I)
      const cs = circlesOfDoc(pp).filter(x => x !== cid);
      if (Array.isArray(pp.circles) || cs.length) pp.circles = cs;
      if (pp.circle === cid) pp.circle = cs[0] || null;
      putDoc('people/' + uid, pp);
    }
    q.del.run(`circles/${cid}/progress/${uid}`);
    audit(actor, 'remove-member', cid, uid);
    touched(['circles/' + cid, 'people/' + uid, `circles/${cid}/progress/${uid}`]); refreshUser(uid);
  }
  function closeCircle(cid, actor) {
    const c = getDoc('circles/' + cid); if (!c) return [];
    const gone = db.prepare("SELECT path FROM docs WHERE path LIKE ? ESCAPE '\\'").all(('circles/' + cid).replace(/[%_\\]/g, x => '\\' + x) + '/%').map(r => r.path);
    for (const pth of gone) q.del.run(pth);
    q.del.run('circles/' + cid); if (c.code && (getDoc('codes/' + c.code) || {}).cid === cid) q.del.run('codes/' + c.code);
    const people = membersOf(cid);
    for (const m of people) { const pp = getDoc('people/' + m.id); pp.circle = null; putDoc('people/' + m.id, pp); }
    audit(actor, 'close-circle', cid, c.name);
    touched(['circles/' + cid, ...gone, ...people.map(m => 'people/' + m.id)]);
    for (const m of people) refreshUser(m.id);
    return people.map(m => m.id);
  }
  const CODEA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newCode = () => { for (;;) { const c = Array.from(require('node:crypto').randomBytes(6), x => CODEA[x % CODEA.length]).join(''); if (!getDoc('codes/' + c)) return c; } };

  /* ---------- the owner's queue (C89) ---------- */
  function queue() {
    const all = (col) => db.prepare("SELECT path,data FROM docs WHERE path LIKE ?").all(col).map(r => ({ path: r.path, ...JSON.parse(r.data) }));
    const reports = db.prepare("SELECT * FROM reports WHERE status='open' ORDER BY at DESC LIMIT 200").all()
      .map(r => ({ ...r, targetName: r.target ? (person(r.target).name || null) : null, byName: person(r.by).name || null }));
    const posts = q.kids.all('posts').map(r => ({ path: r.path, ...JSON.parse(r.data) })).filter(x => (x.flags || []).length).map(x => ({ path: x.path, text: x.text, name: x.name, flags: x.flags.length, at: x.at }));
    const dares = all('circles/%/dares/%').filter(x => (x.flags || []).length).map(x => ({ path: x.path, text: x.text, level: x.level, flags: x.flags.length, pulled: !!x.pulled }));
    const daily = all('circles/%/daily/%').filter(x => (x.flags || []).length).map(x => ({ path: x.path, text: x.dare, flags: x.flags.length }));
    const midnight = all('circles/%/midnight/%').filter(x => x.removed || (x.flags || []).length >= 2).map(x => ({ path: x.path, text: x.text, removed: !!x.removed, flags: (x.flags || []).length, at: x.releaseAt }));
    const t = now();
    const missions = q.kids.all('missions').map(r => ({ path: r.path, ...JSON.parse(r.data) })).filter(m => m.when > t - 7 * 864e5)
      .map(m => { const v = Object.values(m.verdict || {}); return { path: m.path, title: m.title || m.what || '', when: m.when, cname: m.cname || '', bad: v.filter(x => !x).length, good: v.filter(Boolean).length }; });
    return { reports, posts, dares: [...dares, ...daily], midnight, missions };
  }
  const MODPATH = /^(posts\/[^/]+|missions\/[^/]+|circles\/[^/]+\/(dares|daily|midnight)\/[^/]+)$/;

  /* ---------- routes ---------- */
  function route(r, b, u) {
    if (r === 'block') {
      const who = String(b.uid || '');
      if (!/^[A-Za-z0-9_-]{3,40}$/.test(who) || who === u.uid) throw new Refuse('invalid_argument', 'Pick someone else.');
      const pth = `data/users/${u.uid}/blocks`, cur = getDoc(pth) || { ids: {} }; cur.ids = cur.ids || {};
      if (b.on === false) delete cur.ids[who]; else cur.ids[who] = now();
      putDoc(pth, cur); touched([pth]); refreshUser(u.uid); refreshUser(who);
      return { ok: true, blocked: !!cur.ids[who] };
    }
    if (r === 'report') {
      const kind = ['person', 'message', 'post', 'dare', 'midnight', 'mission'].includes(b.kind) ? b.kind : 'person';
      const category = REPORT_CATS.includes(b.category) ? b.category : 'other';
      if (ctx.limited('report:' + u.uid, 20, 864e5)) throw new Refuse('resource_exhausted', 'That’s a lot of reports today. The owner will look at the ones you sent.');
      const target = String(b.uid || '').slice(0, 40), pth = String(b.path || '').slice(0, 300);
      if (!target && !pth) throw new Refuse('invalid_argument', 'Say who or what.');
      const id = rid(12);
      db.prepare('INSERT INTO reports(id,at,by,kind,target,path,cid,category,note,status) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, now(), u.uid, kind, target, pth, circleOf(u.uid), category, String(b.note || '').slice(0, 500), 'open');
      if (b.block && target && target !== u.uid) route('block', { uid: target, on: true }, u);
      return { ok: true, id };
    }
    if (r.startsWith('admin/')) {
      if (!isOwner(u)) throw new Refuse('permission_denied', 'Only the owner can moderate.');
      if (r === 'admin/queue') return queue();
      if (r === 'admin/audit') return { log: db.prepare('SELECT * FROM audit ORDER BY at DESC LIMIT 200').all() };
      if (r === 'admin/act') {
        const action = String(b.action || '');
        if (action === 'dismiss-report' || action === 'resolve-report') { db.prepare('UPDATE reports SET status=? WHERE id=?').run(action === 'dismiss-report' ? 'dismissed' : 'resolved', String(b.id || '')); audit(u.uid, action, b.id, b.note); return { ok: true }; }
        const pth = String(b.path || '');
        if (!MODPATH.test(pth)) throw new Refuse('invalid_argument', 'Not something the queue can act on.');
        const d = getDoc(pth); if (!d) return { ok: true, gone: true };
        if (action === 'remove') { if (/\/midnight\//.test(pth)) putDoc(pth, { ...d, removed: true, text: null }); else q.del.run(pth); audit(u.uid, 'remove', pth, d.text || d.title || d.dare || ''); touched([pth]); return { ok: true }; }
        if (action === 'clear') { const n = { ...d, flags: [] }; delete n.pulled; putDoc(pth, n); audit(u.uid, 'clear-flags', pth, d.text || ''); touched([pth]); return { ok: true }; }
        throw new Refuse('invalid_argument', 'Unknown action.');
      }
      return undefined;
    }
    if (r.startsWith('circle/')) {
      const cid = String(b.cid || circleOf(u.uid) || '');
      const c = ownedCircle(u, cid);
      if (r === 'circle/rename') { const name = String(b.name || '').trim().slice(0, 28); if (!name) throw new Refuse('invalid_argument', 'Give it a name.'); putDoc('circles/' + cid, { ...c, name }); audit(u.uid, 'rename', cid, name); touched(['circles/' + cid]); return { ok: true, name }; }
      if (r === 'circle/remove') {
        const who = String(b.uid || '');
        if (who === u.uid) throw new Refuse('invalid_argument', 'Transfer the circle first, then leave.');
        if (!isMember(who, cid)) throw new Refuse('failed_precondition', 'They aren’t in this circle.');
        removeMember(cid, who, u.uid); return { ok: true };
      }
      if (r === 'circle/unremove') {
        const who = String(b.uid || ''), at = (c.removed || {})[who];
        if (!at) throw new Refuse('failed_precondition', 'They weren’t removed.');
        const rem = { ...c.removed }; delete rem[who]; const n = { ...c, removed: rem };
        const back = now() - at <= UNDO_MS && !circlesOf(who).length && (getDoc('people/' + who)); // v0.8 rule kept: only if they're in no circle now
        if (back) { n.members = [...new Set([...(n.members || []), who])]; const pp = getDoc('people/' + who); pp.circle = cid; pp.circles = [cid]; putDoc('people/' + who, pp); }
        putDoc('circles/' + cid, n); audit(u.uid, 'unremove', cid, who); touched(['circles/' + cid, 'people/' + who]); refreshUser(who);
        return { ok: true, back: !!back };
      }
      if (r === 'circle/transfer') {
        const who = String(b.uid || '');
        if (!isMember(who, cid)) throw new Refuse('failed_precondition', 'Pick someone in the circle.');
        putDoc('circles/' + cid, { ...c, owner: who }); audit(u.uid, 'transfer', cid, who); touched(['circles/' + cid]); return { ok: true };
      }
      if (r === 'circle/close') {
        if (String(b.confirm || '').trim().toLowerCase() !== String(c.name || '').trim().toLowerCase()) throw new Refuse('failed_precondition', 'Type the circle’s name to close it.');
        closeCircle(cid, u.uid); return { ok: true };
      }
      if (r === 'circle/code') {
        const code = newCode(); if (c.code && (getDoc('codes/' + c.code) || {}).cid === cid) q.del.run('codes/' + c.code);
        putDoc('codes/' + code, { cid, at: now() }); putDoc('circles/' + cid, { ...c, code }); audit(u.uid, 'rotate-code', cid, '');
        touched(['circles/' + cid, 'codes/' + code]); return { ok: true, code };
      }
    }
    return undefined;
  }

  return { CONSENT_VERSION, canRead, canWrite, readFilter, beforeWrite, route, mutedFor, hidden, closeCircle, ownerOf, membersOf, audit };
};
module.exports.CONSENT_VERSION = CONSENT_VERSION;
