// Rules for checkins/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'checkins' && s.length === 2) {
      if (!s[1].endsWith('_' + u.uid) && !isOwner(u)) throw new Refuse('permission_denied', 'You can only check yourself in.');
      if (op === 'delete') return data;
      if (op === 'update') { const keep = {}; if ('swapped' in data) keep.swapped = !!data.swapped; return keep; }
      const drop = getDoc('drops/' + data.drop);
      if (!drop) throw new Refuse('failed_precondition', 'That drop has gone.');
      const t = now();
      if (t < drop.start || t > drop.end) throw new Refuse('failed_precondition', 'This drop isn’t open right now.');
      if (String(data.code || '').toUpperCase() !== String(drop.code).toUpperCase()) throw new Refuse('failed_precondition', 'wrong_code');
      delete data.code; data.at = t; data.uid = u.uid; data.verified = 'server';
      return data;
    }
    return data;
  },
});
