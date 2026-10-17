// Rules for pair/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  read(p, s, d, u) {
    if (s[0] === 'pair' && s[1] !== u.uid) { d = { ...d }; delete d.code; }
    return d;
  },
});
