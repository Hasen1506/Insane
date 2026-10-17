// Rules for circles/{cid}/favors/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
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
    return data;
  },
});
