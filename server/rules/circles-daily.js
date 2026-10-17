// Rules for circles/{cid}/daily/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN, safe }) => ({
  write(op, p, s, data, u, old) {
    { const sd = safe().beforeWrite(op, p, data, u, old); if (sd !== undefined) return sd; } // WS-D (server/moderation.js): dare screen and flags, blocks
    if (s[0] === 'circles' && s[2] === 'daily' && s.length === 4 && op !== 'delete') {
      const v = (data.done || {})[u.uid]; const keep = { done: { [u.uid]: { at: now(), note: String((v && v.note) || '').slice(0, 120) } } };
      if (op === 'set') { if (old) throw new Refuse('failed_precondition', 'Already started today.'); keep.dare = String(data.dare || '').slice(0, 100); }
      return keep;
    }
    return data;
  },
});
