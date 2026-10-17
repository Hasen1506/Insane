// Rules for circles/{cid}/dares/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'circles' && s[2] === 'dares' && s.length === 4) {
      if (op === 'set') { if (old) throw new Refuse('permission_denied', 'Already exists.'); return { text: String(data.text || '').slice(0, 100), level: Math.max(1, Math.min(6, +data.level || 3)), by: u.uid, at: now(), to: data.to || null, status: data.to ? 'open' : null }; }
      if (!old) throw new Refuse('invalid_argument', 'Document does not exist');
      if (op === 'delete') { if (old.by !== u.uid && !isOwner(u)) throw new Refuse('permission_denied', 'Only whoever wrote it can take it out.'); return data; }
      if (old.to !== u.uid) throw new Refuse('permission_denied', 'Only the person dared can answer it.');
      const st = { accepted: 1, declined: 1, done: 1 }[data.status] ? data.status : old.status;
      return { status: st, ...(st === 'done' ? { doneAt: now(), note: String(data.note || '').slice(0, 120) } : {}) };
    }
    return data;
  },
});
