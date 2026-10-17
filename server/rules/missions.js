// Rules for missions/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    // Missions: the host circle edits its own; everyone else can only confirm for their circle, join as themselves, or give a verdict.
    if (s[0] === 'missions' && s.length === 2) {
      if (op === 'set' && !old) { data.by = u.uid; data.at = now(); if (!(+data.when > now() + 2 * 3600e3)) throw new Refuse('invalid_argument', 'Give it at least two hours’ notice.'); return data; }
      if (!old) throw new Refuse('invalid_argument', 'Document does not exist');
      if (old.by === u.uid || isOwner(u)) return data;
      if (op !== 'update') throw new Refuse('permission_denied', 'Not your Mission.');
      const me = getDoc('people/' + u.uid) || {}, keep = {};
      if (data.confirms && me.circle && me.circle in data.confirms && me.circle !== old.cid) keep.confirms = { [me.circle]: String(data.confirms[me.circle] || '').slice(0, 28) };
      if (data.ins && u.uid in data.ins) keep.ins = { [u.uid]: data.ins[u.uid] ? { circle: me.circle || null, cname: String(data.ins[u.uid].cname || '').slice(0, 28) } : null };
      if (data.verdict && u.uid in data.verdict && old.when < now() && (old.ins || {})[u.uid]) keep.verdict = { [u.uid]: !!data.verdict[u.uid] };
      return keep;
    }
    return data;
  },
  read(p, s, d, u) {
    if (s[0] === 'missions' && d.by !== u.uid) {
      const me = getDoc('people/' + u.uid) || {}, host = me.circle && me.circle === d.cid, inn = !!(d.ins || {})[u.uid];
      if (!host && !(inn && now() >= d.when - 2 * 3600e3)) d = { ...d, spot: '' };
      if (!host && !inn) d = { ...d, roles: [] };
    }
    return d;
  },
});
