// Rules for met/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'met' && s.length === 2) {
      if (op !== 'set') throw new Refuse('permission_denied', 'Meetings are only made by code.');
      const ids = (data.ids || []).slice().sort();
      if (ids.length !== 2 || !ids.includes(u.uid) || s[1] !== ids.join('__')) throw new Refuse('permission_denied', 'Not your meeting.');
      const other = ids.find(x => x !== u.uid), pr = getDoc('pair/' + other);
      if (!pr || pr.exp < now() || String(pr.code) !== String(data.code)) throw new Refuse('failed_precondition', 'expired_code');
      delete data.code; data.at = now();
      return data;
    }
    return data;
  },
});
