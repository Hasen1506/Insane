// Rules for circles/{cid}/cheers/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN, safe }) => ({
  write(op, p, s, data, u, old) {
    { const sd = safe().beforeWrite(op, p, data, u, old); if (sd !== undefined) return sd; } // WS-D (server/moderation.js): dare screen and flags, blocks
    if (s[0] === 'circles' && s[2] === 'cheers' && s.length === 4) {
      if (op === 'delete') throw new Refuse('permission_denied', 'Cheers stay.');
      if (op !== 'set' || data.from !== u.uid || !s[3].includes('_' + u.uid + '_')) throw new Refuse('permission_denied', 'Cheer as yourself.');
      return { to: String(data.to || ''), from: u.uid, label: String(data.label || '').slice(0, 90), week: String(data.week || ''), at: now() };
    }
    return data;
  },
});
