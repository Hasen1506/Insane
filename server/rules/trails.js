// Rules for trails/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'trails' && s.length === 2) {
      if (op === 'set' && !old) { data.by = u.uid; data.at = now(); return data; }
      if (old && old.by !== u.uid && !isOwner(u)) throw new Refuse('permission_denied', 'Not your trail.');
      return data;
    }
    return data;
  },
});
