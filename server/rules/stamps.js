// Rules for stamps/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'stamps' && s.length === 2) {
      if (!s[1].endsWith('_' + u.uid)) throw new Refuse('permission_denied', 'Stamp your own card.');
      if (op === 'delete') return data;
      const tr = getDoc('trails/' + data.trail); const t = now();
      if (!tr || t < tr.start || t > tr.end) throw new Refuse('failed_precondition', 'This trail isn’t on right now.');
      data.uid = u.uid; return data;
    }
    return data;
  },
});
