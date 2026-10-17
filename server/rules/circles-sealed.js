// Rules for circles/{cid}/sealed/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'circles' && s[2] === 'sealed' && s.length === 4 && old && op !== 'set' && old.by !== u.uid) throw new Refuse('permission_denied', 'Sealed means sealed.');
    return data;
  },
  read(p, s, d, u) {
    if (s[0] === 'circles' && s[2] === 'sealed' && d.openAt > now()) d = { ...d, text: null };
    return d;
  },
});
