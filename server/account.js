// Your account on the server (WS-D): delete for good in one transaction, then signed out (C59);
// signed-in devices, revoke and sign out everywhere (C60); change email by a code to the new address (C60);
// consent records (C63); a human-readable export (C62). server.js calls route(); nothing here listens.
'use strict';
const crypto = require('node:crypto');

const FORMER = 'former';
const MIN = 6e4;

// "Android · Chrome", "iPhone · Safari", "Mac · Firefox": enough to recognise a device, nothing more.
function device(ua) {
  ua = String(ua || '');
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux|CrOS/.test(ua) ? 'Linux' : 'Unknown device';
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return os + ' · ' + br;
}
// Every trace of uid out of a doc: map keys dropped, list entries dropped, values re-signed "former".
function scrub(v, uid) {
  if (Array.isArray(v)) return v.filter(x => x !== uid).map(x => scrub(x, uid));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (k !== uid && !k.includes(uid)) o[k] = scrub(x, uid);
    if (o.by === FORMER && 'name' in o && 'text' in o) o.name = 'Former member'; // a message or a thread's last line
    return o;
  }
  if (v === uid) return FORMER;
  if (typeof v === 'string' && v.includes(uid)) return v.split(uid).join(FORMER);
  return v;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = function account(ctx, mod) {
  const { db, q, getDoc, putDoc, now, Refuse, sha, touched, sendMail, endStreams, limited, DEV, PUBLIC_URL } = ctx;
  for (const col of ['created INTEGER', 'seen INTEGER', 'ua TEXT']) { try { db.exec('ALTER TABLE sessions ADD COLUMN ' + col); } catch (e) { /* already there */ } }

  // Called on every signed-in request: when the session was last used, and from what.
  function touch(hash, req) {
    const t = Date.now(), r = db.prepare('SELECT seen,ua FROM sessions WHERE hash=?').get(hash);
    if (!r) return;
    if (!r.seen || t - r.seen > MIN || !r.ua) db.prepare('UPDATE sessions SET seen=?, ua=COALESCE(ua,?), created=COALESCE(created,?) WHERE hash=?').run(t, String(req.headers['user-agent'] || '').slice(0, 300), t, hash);
  }
  const sessions = u => db.prepare('SELECT hash,created,seen,ua FROM sessions WHERE uid=? AND exp>? ORDER BY seen DESC').all(u.uid, Date.now())
    .map(r => ({ id: r.hash.slice(0, 16), device: device(r.ua), created: r.created || null, seen: r.seen || null, current: r.hash === u.sess }));

  /* ---------- delete for good (C59, P25) ---------- */
  function deleteAccount(u) {
    const uid = u.uid, email = u.email, gone = [], changed = [];
    db.exec('BEGIN IMMEDIATE');
    try {
      // Circles they own pass to the next member, or close if they were the last one.
      for (const r of q.kids.all('circles')) {
        const c = JSON.parse(r.data), cid = r.path.split('/')[1];
        if (mod.ownerOf(c) !== uid) continue;
        const others = (c.members || []).filter(x => x !== uid);
        if (others.length) putDoc(r.path, { ...c, owner: others[0] }); else mod.closeCircle(cid, FORMER);
      }
      const like = '%' + uid + '%';
      for (const r of db.prepare('SELECT path,data FROM docs WHERE path LIKE ? OR data LIKE ?').all(like, like)) {
        const s = r.path.split('/'), d = JSON.parse(r.data), col = s[0] === 'circles' ? s[2] : s[0];
        const mine = (s.length === 2 && ['posts', 'calls', 'missions', 'trails'].includes(col) && d.by === uid) || (s.length === 2 && col === 'drops' && d.host === uid)
          || (s[0] === 'circles' && s.length === 4 && ['clips', 'dares', 'sealed', 'cheers'].includes(col) && (d.by === uid || d.from === uid));
        if (r.path.includes(uid) || mine) { q.del.run(r.path); gone.push(r.path); continue; }
        putDoc(r.path, scrub(d, uid)); changed.push(r.path); // messages stay in their threads, signed "Former member"
      }
      // Children of anything deleted above (a deleted Mission's or post's sub-collections).
      for (const p of gone) for (const r of db.prepare('SELECT path FROM docs WHERE path LIKE ?').all(p + '/%')) { q.del.run(r.path); gone.push(r.path); }
      db.prepare('DELETE FROM sessions WHERE uid=?').run(uid);
      db.prepare('DELETE FROM push WHERE uid=?').run(uid);
      db.prepare('DELETE FROM otps WHERE email=?').run(email);
      db.prepare('DELETE FROM users WHERE uid=?').run(uid);
      db.prepare('DELETE FROM kv WHERE v=?').run(JSON.stringify(uid)); // the Mole's secret claim
      db.prepare('UPDATE reports SET by=? WHERE by=?').run(FORMER, uid);
      db.prepare('UPDATE reports SET target=? WHERE target=?').run(FORMER, uid);
      db.prepare('UPDATE audit SET actor=? WHERE actor=?').run(FORMER, uid);
      db.prepare('UPDATE audit SET target=? WHERE target=?').run(FORMER, uid);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    touched([...gone, ...changed]);
    endStreams(c => c.uid === uid);
    // DPDP: confirm the erasure to the address it was for.
    sendMail(email, 'Your INSANE account is deleted', `Your INSANE account and everything in it were deleted on ${new Date(now()).toUTCString()}.\n\nYour profile, private space, posts, progress, memberships, sessions and notification subscriptions are gone. Messages you sent in group threads stay there, signed “Former member”, so other people’s conversations still make sense.\n\nIf you didn’t ask for this, reply to this email.\n\n${PUBLIC_URL}`).catch(e => console.warn('erasure mail', e.message));
    return { gone: gone.length, anonymised: changed.length };
  }

  /* ---------- export (C62) ---------- */
  function exportAll(u) {
    const uid = u.uid, me = getDoc('people/' + uid) || {};
    const priv = Object.fromEntries(q.kids.all('data/users/' + uid).map(r => [r.path.split('/').pop(), JSON.parse(r.data)]));
    const msgs = db.prepare("SELECT path,data FROM docs WHERE path LIKE '%/msgs/%' AND data LIKE ?").all('%' + uid + '%').map(r => ({ path: r.path, ...JSON.parse(r.data) })).filter(m => m.by === uid)
      .map(m => { const t = getDoc(m.path.split('/').slice(0, -2).join('/')) || {}; return { where: t.title || (m.path.startsWith('dms/') ? 'Direct messages' : 'A room'), text: m.text, at: m.at }; }).sort((a, b) => a.at - b.at);
    const favors = me.circle ? q.kids.all(`circles/${me.circle}/favors`).map(r => JSON.parse(r.data)).filter(f => f.asker === uid || f.doer === uid) : [];
    const ledger = favors.filter(f => f.status === 'logged').map(f => ({ what: f.what, h: f.h, you: f.doer === uid ? 'helped' : 'were helped', at: f.loggedAt || f.at }));
    const posts = q.kids.all('posts').map(r => JSON.parse(r.data)).filter(p => p.by === uid).map(p => ({ text: p.text, kind: p.kind, at: p.at }));
    const pots = me.circle ? q.kids.all(`circles/${me.circle}/threads`).map(r => JSON.parse(r.data)).filter(t => t.kind === 'pot' && ((t.pledges || {})[uid] || t.by === uid)).map(t => ({ title: t.title, per: t.per, cur: t.cur, paid: (t.paid || {})[uid] || false, organiser: t.by === uid })) : [];
    const data = { profile: me, private: priv, messages: msgs, ledger, favors, pots, posts, exportedAt: new Date(now()).toISOString() };
    const d = t => t ? new Date(t).toISOString().slice(0, 16).replace('T', ' ') : '';
    const sec = (h, rows, f) => `<h2>${esc(h)}</h2>${rows.length ? `<ul>${rows.map(x => `<li>${f(x)}</li>`).join('')}</ul>` : '<p>Nothing.</p>'}`;
    const journeys = (priv.journeys && priv.journeys.items) || [];
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your INSANE data</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;color:#111}h1{font-size:24px}h2{font-size:18px;margin-top:28px;border-bottom:1px solid #ccc}small{color:#555}li{margin:4px 0}</style>
<h1>Your INSANE data</h1><p><small>Exported ${esc(d(now()))} UTC for ${esc(u.email)}. The full data is in the JSON file next to this one.</small></p>
<h2>Profile</h2><ul><li>Name: ${esc(me.name)}</li><li>Handle: ${esc(me.handle || '–')}</li><li>City: ${esc(me.cityName || me.city || '–')}</li><li>Joined: ${esc(d(me.joined))}</li><li>Consent: ${esc(me.consent ? me.consent.v + ' on ' + d(me.consent.at) : 'not recorded')}</li></ul>
${sec('Messages you wrote', msgs, m => `<small>${esc(d(m.at))} · ${esc(m.where)}</small><br>${esc(m.text)}`)}
${sec('Favor ledger', ledger, f => `${esc(f.what)}: you ${esc(f.you)}, ${esc(f.h)} h <small>${esc(d(f.at))}</small>`)}
${sec('Pots', pots, p => `${esc(p.title)}: ${esc(p.cur || '')}${esc(p.per)} ${p.organiser ? '(you organised it)' : p.paid === true ? '(paid)' : '(pledged)'}`)}
${sec('Posts', posts, p => `<small>${esc(d(p.at))} · ${esc(p.kind)}</small><br>${esc(p.text)}`)}
${sec('Journeys', journeys, j => esc((j.read && j.read.what) || j.text || ''))}
</html>`;
    return { data, html };
  }

  /* ---------- routes ---------- */
  function route(r, b, u, req) {
    if (r === 'account/sessions') return { body: { sessions: sessions(u) } };
    if (r === 'account/revoke') {
      const all = db.prepare('SELECT hash FROM sessions WHERE uid=?').all(u.uid).map(x => x.hash);
      const kill = b.all ? all : b.others ? all.filter(h => h !== u.sess) : all.filter(h => h.slice(0, 16) === String(b.id || ''));
      if (!kill.length) throw new Refuse('failed_precondition', 'That device is already signed out.');
      const del = db.prepare('DELETE FROM sessions WHERE hash=?'); for (const h of kill) del.run(h);
      const set = new Set(kill); endStreams(c => c.sess && set.has(c.sess));
      const me = set.has(u.sess);
      return { body: { ok: true, revoked: kill.length, signedOut: me }, headers: me ? { 'set-cookie': ctx.cookie('', 0) } : {} };
    }
    if (r === 'account/delete') {
      if (b.confirm !== 'DELETE') throw new Refuse('invalid_argument', 'Confirm the delete first.');
      const out = deleteAccount(u);
      return { body: { ok: true, ...out }, headers: { 'set-cookie': ctx.cookie('', 0) } };
    }
    if (r === 'account/email/start') {
      const email = String(b.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) throw new Refuse('invalid_argument', 'That doesn’t look like an email address.');
      if (email === u.email) throw new Refuse('invalid_argument', 'That’s already your email.');
      if (db.prepare('SELECT uid FROM users WHERE email=?').get(email)) throw new Refuse('failed_precondition', 'That email already has an INSANE account.');
      if (limited('chg:' + u.uid, 4, 10 * MIN)) throw new Refuse('resource_exhausted', 'Too many codes. Wait a few minutes.');
      const code = String(crypto.randomInt(100000, 1000000));
      const text = `Your INSANE code is ${code}\n\nUse it to make this your sign-in email. It works for 10 minutes. If you didn’t ask for it, ignore this email.\n\n${PUBLIC_URL}`;
      db.prepare('INSERT INTO otps(email,hash,exp,tries,sent) VALUES(?,?,?,0,?) ON CONFLICT(email) DO UPDATE SET hash=excluded.hash,exp=excluded.exp,tries=0,sent=excluded.sent')
        .run(email, sha('chg|' + u.uid + '|' + email + code), Date.now() + 10 * MIN, JSON.stringify(DEV ? { to: email, subject: 'Change your INSANE email: ' + code, text, at: Date.now() } : { at: Date.now() }));
      return sendMail(email, 'Change your INSANE email: ' + code, text).then(how => ({ body: { ok: true, how } }));
    }
    if (r === 'account/email/verify') {
      const email = String(b.email || '').trim().toLowerCase(), code = String(b.code || '').replace(/\D/g, '');
      const row = db.prepare('SELECT hash,exp,tries FROM otps WHERE email=?').get(email);
      if (!row || row.exp < Date.now() || row.tries >= 5) throw new Refuse('failed_precondition', 'That code has expired. Ask for a new one.');
      if (row.hash !== sha('chg|' + u.uid + '|' + email + code)) { db.prepare('UPDATE otps SET tries=tries+1 WHERE email=?').run(email); throw new Refuse('failed_precondition', 'That code isn’t right. Check the email again.'); }
      if (db.prepare('SELECT uid FROM users WHERE email=?').get(email)) throw new Refuse('failed_precondition', 'That email already has an INSANE account.');
      db.prepare('DELETE FROM otps WHERE email=?').run(email);
      db.prepare('UPDATE users SET email=? WHERE uid=?').run(email, u.uid);
      sendMail(u.email, 'Your INSANE email changed', `Your INSANE sign-in email is now ${email}. If you didn’t do this, reply to this email.\n\n${PUBLIC_URL}`).catch(() => { });
      return { body: { ok: true, email } };
    }
    if (r === 'account/consent') {
      if (b.v !== mod.CONSENT_VERSION) throw new Refuse('invalid_argument', 'That isn’t the current version.');
      const p = 'people/' + u.uid, me = getDoc(p); if (!me) throw new Refuse('failed_precondition', 'Finish signing up first.');
      putDoc(p, { ...me, consent: { v: mod.CONSENT_VERSION, at: now() } }); touched([p]);
      return { body: { ok: true } };
    }
    if (r === 'account/export') return { body: exportAll(u) };
    return undefined;
  }
  return { route, touch, deleteAccount, sessions, device, scrub };
};
module.exports.scrub = scrub;
module.exports.device = device;
module.exports.FORMER = FORMER;
