// Rules for solves/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
const ANS = ['WATERLOO', 'MARKET', 'CARD', 'MUSEUM', 'BRIDGE', 'STATION', 'GARDEN', 'TOWER'];
const weekIdx = wk => (+String(wk).split('W')[1]) % ANS.length;
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'solves' && s.length === 2) {
      if (op === 'delete') throw new Refuse('permission_denied', 'Solves stay.');
      if (!s[1].endsWith('_' + u.uid) || old) throw new Refuse('permission_denied', 'One solve each.');
      const a = String(data.answer || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (a !== ANS[weekIdx(data.week)]) throw new Refuse('failed_precondition', 'wrong_answer');
      delete data.answer; data.at = now(); data.uid = u.uid;
      return data;
    }
    return data;
  },
});
