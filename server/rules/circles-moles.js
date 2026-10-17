// Rules for circles/{cid}/moles/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    // The Mole: the store never says who claimed the week. The server keeps it aside so only that person can reveal.
    if (s[0] === 'circles' && s[2] === 'moles' && s.length === 4) {
      if (op === 'delete') throw new Refuse('permission_denied', 'The Mole stays.');
      if (op === 'set') { if (old) throw new Refuse('permission_denied', 'Someone got there first.'); kv.set('mole:' + p, u.uid); return { at: now(), n: 3 }; }
      if (kv.get('mole:' + p) !== u.uid || !data.revealed) throw new Refuse('permission_denied', 'Only the Mole can reveal the Mole.');
      const m = getDoc(`data/users/${u.uid}/mole`) || {}; const N = [3, 1, 1, 1, 3, 1, 1, 1];
      const done = (m.tasks || []).filter((t, i) => ((m.prog || [])[i] || 0) >= N[t]).length;
      return { revealed: { uid: u.uid, done, at: now() } };
    }
    return data;
  },
});
