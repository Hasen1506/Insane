// Rules for drops/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'drops' && s.length === 2) {
      if (op === 'set' && (!old || old.host === u.uid)) { data.host = u.uid; return data; }
      if (op === 'delete') { if (old && old.host !== u.uid && !isOwner(u)) throw new Refuse('permission_denied', 'Only the host can cancel a drop.'); return data; }
      if (old && old.host !== u.uid) { const keep = {}; for (const k of ['item', 'swaps']) if (k in data) keep[k] = data[k]; return keep; }
      return data;
    }
    return data;
  },
  read(p, s, d, u) {
    if (s[0] === 'drops' && d.host !== u.uid) { d = { ...d }; delete d.code; }
    return d;
  },
});
