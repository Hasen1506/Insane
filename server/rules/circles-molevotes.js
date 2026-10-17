// Rules for circles/{cid}/molevotes/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'circles' && s[2] === 'molevotes' && s.length === 4) {
      if (!s[3].endsWith('_' + u.uid)) throw new Refuse('permission_denied', 'One vote each, your own.');
      if (op === 'delete') return data;
      return { week: String(data.week || ''), by: u.uid, vote: String(data.vote || ''), at: now() };
    }
    return data;
  },
});
