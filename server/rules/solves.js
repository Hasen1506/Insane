// Rules for solves/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
// WS-E (C48): v0.8's ANS table is gone. The answer is checked against the city's puzzle for that week by
// server/content.js (solveDoc in server.js, shared with POST /api/decode/solve); the page never has it.
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN, solveDoc }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'solves' && s.length === 2) {
      if (op === 'delete') throw new Refuse('permission_denied', 'Solves stay.');
      if (!s[1].endsWith('_' + u.uid) || old || op !== 'set') throw new Refuse('permission_denied', 'One solve each.');
      if (s[1] !== String(data.week || '') + '_' + u.uid) throw new Refuse('invalid_argument', 'A solve is filed under its week.');
      return solveDoc(u, data);
    }
    return data;
  },
});
